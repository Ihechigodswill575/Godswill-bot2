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
    console.log(`[OWNER CHECK] sender="${sender}" owners=[${OWNER_NUMBERS.join(', ')}]`)
    return OWNER_NUMBERS.some(ownerRaw => {
        const owner = cleanNumber(ownerRaw)
        if (!owner) return false
        if (sender === owner) return true
        const minLen = Math.min(sender.length, owner.length)
        if (minLen >= 8 && sender.slice(-minLen) === owner.slice(-minLen)) return true
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
        r.count = 1; r.windowStart = now; return true
    }
    r.count++
    return r.count <= CHATBOT_RATE_LIMIT
}

// ── Group participant cache ────────────────────────────────────
const _groupCache = {}
const GROUP_CACHE_TTL = 90_000

async function getGroupParticipants(chatId) {
    const now    = Date.now()
    const cached = _groupCache[chatId]
    if (cached && (now - cached.ts) < GROUP_CACHE_TTL) return cached.participants
    try {
        const info = await api.getGroupInfo(chatId)
        const participants = info?.participants || []
        _groupCache[chatId] = { participants, ts: now }
        return participants
    } catch { return [] }
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

        // ── Sender resolution — prefer @s.whatsapp.net over @lid ──
        let senderJid = ''
        if (isGroup) {
            const candidates = [msg.sender, msg.key?.participant, msg.participant].filter(Boolean)
            senderJid = candidates.find(c => c.includes('@s.whatsapp.net'))
                     || candidates.find(c => !c.includes('@lid'))
                     || candidates[0] || ''

            // ── LID fallback: try to resolve @lid to a known owner number ──
            if (senderJid.includes('@lid')) {
                const lidNum = cleanNumber(senderJid)
                const ownerMatch = OWNER_NUMBERS.find(o => {
                    const oClean = cleanNumber(o)
                    return lidNum === oClean
                        || (lidNum.length >= 7 && oClean.endsWith(lidNum.slice(-7)))
                        || (oClean.length >= 7 && lidNum.endsWith(oClean.slice(-7)))
                })
                if (ownerMatch) senderJid = `${cleanNumber(ownerMatch)}@s.whatsapp.net`
            }
        } else {
            senderJid = msg.sender || chatId
        }

        const senderNumber = cleanNumber(senderJid)
        if (!senderNumber) {
            console.log(`[WARN] No sender: jid="${senderJid}" chatId="${chatId}"`)
            return
        }

        const msgKeyId     = msg.key?.id || null
        const isOwner      = checkIsOwner(senderNumber)
        const isSudo       = state.sudoUsers.includes(senderNumber)
        // Owners bypass all privilege checks — no need to be group admin
        const isPrivileged = isOwner || isSudo

        // ── Group admin check — skip entirely for owner ────────
        let isGroupAdmin = false
        if (isGroup && !isOwner) {
            const participants = await getGroupParticipants(chatId)
            isGroupAdmin = participants.some(p => {
                // Use realNumber set by normalizeGroupInfo, fallback to raw cleanNumber
                const pNum  = p.realNumber || cleanNumber(p.id || p.jid || '')
                if (!pNum) return false
                const rank  = (p.admin || p.rank || '').toLowerCase()
                const match = pNum === senderNumber
                    || (pNum.length >= 7 && senderNumber.endsWith(pNum))
                    || (senderNumber.length >= 7 && pNum.endsWith(senderNumber))
                return match && (p.isAdmin || p.isSuperAdmin || rank === 'admin' || rank === 'superadmin')
            })
        }

        console.log(`[MSG] ${senderNumber} | Owner:${isOwner} | Sudo:${isSudo} | GAdmin:${isGroupAdmin} | "${text.slice(0,50)}"`)

        // ── Self mode ─────────────────────────────────────────
        if (state.selfMode && !isOwner) return

        // ── Auto read / react / typing ────────────────────────
        if (state.autoread)  await api.markRead(chatId).catch(() => {})
        if (state.autoreact && text && msgKeyId) {
            const emojis = ['❤️','😂','🔥','⚡','👍','🎉','😍','🤩']
            await api.sendReaction(chatId, msgKeyId, pick(emojis)).catch(() => {})
        }
        if (state.autotyping && text) await api.sendTyping(chatId, 1).catch(() => {})

        // ── Welcome / Goodbye (join/leave stubs) ─────────────
        if (isGroup && (msg.messageStubType === 27 || msg.messageStubType === 28)) {
            const joined = msg.messageStubType === 27
            if (state.welcome[chatId]?.enabled) {
                for (const m of (msg.messageStubParameters || [])) {
                    const num = cleanNumber(m)
                    const txt = joined
                        ? `👋 Welcome @${num}!\n${state.welcome[chatId].msg || '🎉 Glad to have you!'}`
                        : `👋 @${num} has left.\n${state.welcome[chatId].byeMsg || '😢 We will miss you!'}`
                    await api.sendText(chatId, txt)
                }
            }
            return
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
            if (!state.spamCount[key] || now - state.spamCount[key].time > 5000)
                state.spamCount[key] = { count: 0, time: now }
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

        // ── Anti ghost ping ───────────────────────────────────
        if (isGroup && state.antiGhostPing[chatId] && !isPrivileged) {
            const mentions = msgContent.extendedTextMessage?.contextInfo?.mentionedJid || []
            if (mentions.length > 0 && !text.trim()) {
                await api.deleteMessage(chatId, msgKeyId).catch(() => {})
                await api.sendText(chatId, `👻 @${senderNumber} No ghost pings allowed!`)
                return
            }
        }

        // ── Anti delete ───────────────────────────────────────
        if (isGroup && state.antiDelete[chatId]?.enabled && text && msgKeyId) {
            if (!state.antiDelete[chatId].msgs) state.antiDelete[chatId].msgs = {}
            state.antiDelete[chatId].msgs[msgKeyId] = text.slice(0, 500)
        }
        if (isGroup && state.antiDelete[chatId]?.enabled && msgContent.protocolMessage?.type === 0) {
            const origId  = msgContent.protocolMessage?.key?.id
            const deleted = state.antiDelete[chatId]?.msgs?.[origId]
            if (deleted) await api.sendText(chatId, `🗑️ *@${senderNumber} deleted:*\n\n${deleted}`)
            return
        }

        // ── Announce mode — non-admins blocked ────────────────
        if (isGroup && state.announce[chatId] && !isPrivileged && !isGroupAdmin) {
            await api.deleteMessage(chatId, msgKeyId).catch(() => {})
            return
        }

        // ── XP on every message in groups ─────────────────────
        if (isGroup && text) utils.addXP(state, senderNumber, senderNumber, 2)

        // ── Name trigger ──────────────────────────────────────
        const lower = text.toLowerCase().trim()
        if (!text.startsWith(PREFIX) && (
            lower === 'richard' || lower.startsWith('richard ') ||
            lower.includes(' richard ') || lower.endsWith(' richard') || lower.includes('@richard')
        )) {
            const responses = [
                `👀 You called? I'm *${BOT_NAME}*!\nType *${PREFIX}menu* to see what I can do 🔥`,
                `⚡ *${BOT_NAME}* is here! Need something?\nTry *${PREFIX}ai <question>*!`,
                `🤖 *${BOT_NAME}* at your service!\nType *${PREFIX}menu* for all commands.`,
                `👋 Heard my name! What do you need?\nType *${PREFIX}menu* to get started.`,
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

        // ── Chatbot (Groq) ────────────────────────────────────
        if (state.chatbot[chatId] && text && !text.startsWith(PREFIX)) {
            if (!chatbotAllowed(chatId)) return
            await api.sendTyping(chatId, 2)
            const reply = await utils.askAI(text,
                'You are a friendly, helpful WhatsApp assistant. Be natural and concise. 1-3 sentences unless more detail is needed.')
            if (reply) return api.sendText(chatId, reply, msgKeyId)
            return
        }

        // ── Commands ──────────────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return
        console.log(`[CMD] ${senderNumber} Owner:${isOwner} Sudo:${isSudo} GAdmin:${isGroupAdmin} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msgKeyId, isOwner, isSudo, isGroup, msg, isGroupAdmin)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message, err.stack)
    }
}

module.exports = { handleMessage }
