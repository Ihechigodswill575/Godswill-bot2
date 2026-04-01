'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBERS, BAD_WORDS, PREFIX, BOT_NAME, CHATBOT_RATE_LIMIT, CHATBOT_RATE_WINDOW_MS } = require('./config')
const utils  = require('./utils')

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

function cleanNumber(jid = '') {
    return jid
        .replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '')
        .replace(/[^0-9]/g, '')
        .replace(/^0+/, '')
}

function checkIsOwner(senderRaw) {
    const sender = cleanNumber(senderRaw)
    if (!sender || sender.length < 5) return false

    console.log(`[OWNER CHECK] sender="${sender}" against owners=[${OWNER_NUMBERS.map(cleanNumber).join(', ')}]`)

    return OWNER_NUMBERS.some(ownerRaw => {
        const owner = cleanNumber(ownerRaw)
        if (!owner) return false
        if (sender === owner) return true
        // Suffix match handles country-code variations
        if (sender.length >= 7 && owner.endsWith(sender)) return true
        if (owner.length  >= 7 && sender.endsWith(owner)) return true
        return false
    })
}

// ── Chatbot rate limiter ──────────────────────────────────────
function chatbotAllowed(chatId) {
    const now = Date.now()
    if (!state.chatbotRate[chatId]) {
        state.chatbotRate[chatId] = { count: 1, windowStart: now }
        return true
    }
    const r = state.chatbotRate[chatId]
    if (now - r.windowStart > CHATBOT_RATE_WINDOW_MS) {
        r.count       = 1
        r.windowStart = now
        return true
    }
    r.count++
    return r.count <= CHATBOT_RATE_LIMIT
}

async function handleMessage(msg) {
    try {
        if (!msg) return
        if (msg.key?.fromMe === true) return

        const msgContent = msg.message
        if (!msgContent)                             return
        if (msgContent.protocolMessage)              return
        if (msgContent.senderKeyDistributionMessage) return
        if (msgContent.reactionMessage)              return
        if (msgContent.pollUpdateMessage)            return

        const text = (
            msgContent.conversation                 ||
            msgContent.extendedTextMessage?.text    ||
            msgContent.imageMessage?.caption        ||
            msgContent.videoMessage?.caption        ||
            msgContent.documentMessage?.caption     ||
            ''
        ).trim()

        const chatId = msg.key?.remoteJid || ''
        if (!chatId) return

        const isGroup = chatId.endsWith('@g.us')

        // In groups the real sender is in participant — NOT remoteJid (which is the group JID)
        let senderJid = ''
        if (isGroup) {
            senderJid =
                msg.key?.participant ||
                msg.participant      ||
                ''
        } else {
            // DM: remoteJid IS the sender
            senderJid = chatId
        }

        const senderNumber = cleanNumber(senderJid)
        if (!senderNumber) {
            console.log(`[WARN] Could not extract sender from JID: "${senderJid}" chatId: "${chatId}"`)
            return
        }

        const msgKeyId     = msg.key?.id || null
        const isOwner      = checkIsOwner(senderNumber)
        const isSudo       = state.sudoUsers.includes(senderNumber)
        const isPrivileged = isOwner || isSudo

        // ── Check if sender is a WhatsApp group admin ─────────
        // Evolution API does NOT inject groupMetadata into webhook payloads.
        // We fetch it live from the Evolution API when needed.
        let isGroupAdmin = false
        if (isGroup) {
            try {
                const info = await api.getGroupInfo(chatId)
                const participants = info?.participants || []
                if (participants.length > 0) {
                    isGroupAdmin = participants.some(p => {
                        const num   = cleanNumber(p.id || p.jid || '')
                        const admin = (p.admin || p.rank || '').toLowerCase()
                        return num === senderNumber && (
                            p.isAdmin === true      ||
                            p.isSuperAdmin === true ||
                            admin === 'admin'       ||
                            admin === 'superadmin'
                        )
                    })
                }
            } catch {
                // silently ignore — isGroupAdmin stays false
            }
            console.log(`[MSG] ${senderNumber} | Owner:${isOwner} | Sudo:${isSudo} | GroupAdmin:${isGroupAdmin} | Group:${isGroup} | "${text.slice(0,60)}"`)
        } else {
            console.log(`[MSG] ${senderNumber} | Owner:${isOwner} | Sudo:${isSudo} | Group:${isGroup} | "${text.slice(0,60)}"`)
        }

        // ── Self mode ─────────────────────────────────────────
        if (state.selfMode && !isOwner) return

        // ── Auto read ─────────────────────────────────────────
        if (state.autoread) await api.markRead(chatId).catch(() => {})

        // ── Auto react ────────────────────────────────────────
        if (state.autoreact && text && msgKeyId) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉', '😍', '🤩']
            await api.sendReaction(chatId, msgKeyId, pick(emojis)).catch(() => {})
        }

        // ── Auto typing ───────────────────────────────────────
        if (state.autotyping && text) {
            await api.sendTyping(chatId, 1).catch(() => {})
        }

        // ── Anti link ─────────────────────────────────────────
        if (isGroup && state.antilink[chatId] && !isPrivileged) {
            if (/(https?:\/\/|wa\.me\/|chat\.whatsapp\.com)/i.test(text)) {
                await api.deleteMessage(chatId, msgKeyId).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Links are not allowed here!`)
                return
            }
        }

        // ── Anti spam ─────────────────────────────────────────
        if (isGroup && state.antispam[chatId] && !isPrivileged) {
            const key = `${chatId}_${senderNumber}`
            const now = Date.now()
            if (!state.spamCount[key] || now - state.spamCount[key].time > 5000) {
                state.spamCount[key] = { count: 0, time: now }
            }
            state.spamCount[key].count++
            if (state.spamCount[key].count > 5) {
                await api.removeGroupParticipants(chatId, [`${senderNumber}@s.whatsapp.net`]).catch(() => {})
                await api.sendText(chatId, `🚫 @${senderNumber} kicked for spamming!`)
                return
            }
        }

        // ── Anti bad word ─────────────────────────────────────
        if (isGroup && state.antibadword[chatId] && !isPrivileged) {
            if (BAD_WORDS.some(w => text.toLowerCase().includes(w))) {
                await api.deleteMessage(chatId, msgKeyId).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Watch your language!`)
                return
            }
        }

        // ── Name trigger ──────────────────────────────────────
        const lower = text.toLowerCase().trim()
        if (!text.startsWith(PREFIX) && (
            lower === 'tavik'          ||
            lower.startsWith('tavik ') ||
            lower.includes(' tavik ')  ||
            lower.endsWith(' tavik')   ||
            lower.includes('@tavik')
        )) {
            const responses = [
                `👀 You called? I'm *${BOT_NAME}*!\nType *${PREFIX}menu* to see what I can do 🔥`,
                `⚡ *${BOT_NAME}* is here! Need something?\nTry *${PREFIX}ai <question>* to chat with me!`,
                `🤖 Yes? *${BOT_NAME}* at your service!\nType *${PREFIX}menu* for all commands.`,
                `👋 Heard my name! I'm *${BOT_NAME}* 🤖\nWhat do you need?`,
                `🔥 Someone said my name! What can I do for you?\nType *${PREFIX}menu* to get started.`,
            ]
            await api.sendTyping(chatId, 1)
            return api.sendText(chatId, pick(responses), msgKeyId)
        }

        // ── Auto reply ────────────────────────────────────────
        if (state.autoreply[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            await api.sendText(chatId, `🤖 Auto Reply!\nType *${PREFIX}menu* for commands.`)
            return
        }

        // ── Chatbot ───────────────────────────────────────────
        if (state.chatbot[chatId] && text && !text.startsWith(PREFIX)) {
            if (!chatbotAllowed(chatId)) {
                console.log(`[CHATBOT] Rate limited: ${chatId}`)
                return
            }
            await api.sendTyping(chatId, 2)
            const reply = await utils.askAI(text,
                'You are a friendly, intelligent WhatsApp assistant. Be helpful, natural, and concise. Keep replies to 1-3 sentences unless asked for more detail. Never reveal what technology or framework powers you.')
            if (reply) return api.sendText(chatId, reply, msgKeyId)
            return
        }

        // ── Commands ──────────────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] Owner:${isOwner} Sudo:${isSudo} GroupAdmin:${isGroupAdmin} | ${senderNumber} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msgKeyId, isOwner, isSudo, isGroup, msg, isGroupAdmin)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
