'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBERS, BAD_WORDS, PREFIX, BOT_NAME } = require('./config')
const utils  = require('./utils')

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

function cleanNumber(jid = '') {
    return jid.replace(/@s\.whatsapp\.net|@g\.us/g, '').replace(/[^0-9]/g, '').replace(/^0+/, '')
}

function checkIsOwner(senderNumber) {
    const sender = cleanNumber(senderNumber)
    if (!sender) return false
    return OWNER_NUMBERS.some(ownerRaw => {
        const owner = cleanNumber(ownerRaw)
        if (!owner) return false
        if (sender === owner) return true
        if (sender.length > 6 && owner.endsWith(sender)) return true
        if (owner.length  > 6 && sender.endsWith(owner)) return true
        return false
    })
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

        const isGroup      = chatId.endsWith('@g.us')
        const senderJid    = isGroup ? (msg.key?.participant || '') : chatId
        const senderNumber = cleanNumber(senderJid)
        if (!senderNumber) return

        const msgKeyId     = msg.key?.id || null
        const isOwner      = checkIsOwner(senderNumber)
        const isSudo       = state.sudoUsers.includes(senderNumber)
        const isPrivileged = isOwner || isSudo

        console.log(`[MSG] ${senderNumber} | Owner:${isOwner} | Sudo:${isSudo} | Group:${isGroup} | "${text}"`)

        // ── Self mode: works in BOTH DMs and groups ───────────
        // Owners always pass through, everyone else is blocked
        if (state.selfMode && !isOwner) return

        // ── Auto read ─────────────────────────────────────────
        if (state.autoread) await api.markRead(chatId).catch(() => {})

        // ── Auto react ────────────────────────────────────────
        if (state.autoreact && text && msgKeyId) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉', '😍', '🤩']
            await api.sendReaction(chatId, msgKeyId, emojis[Math.floor(Math.random() * emojis.length)]).catch(() => {})
        }

        // ── Auto typing ───────────────────────────────────────
        if (state.autotyping && text) {
            await api.sendTyping(chatId, 1).catch(() => {})
        }

        // ── Anti link ─────────────────────────────────────────
        if (isGroup && state.antilink[chatId] && !isPrivileged) {
            if (/(https?:\/\/|wa\.me\/|chat\.whatsapp\.com)/i.test(text)) {
                await api.deleteMessage(chatId, msgKeyId).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Links are not allowed!`)
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

        // ── Name trigger: responds when someone says "tavik" ──
        const lower = text.toLowerCase().trim()
        if (!text.startsWith(PREFIX) && (
            lower === 'tavik' ||
            lower.startsWith('tavik ') ||
            lower.includes(' tavik ') ||
            lower.endsWith(' tavik') ||
            lower.includes('@tavik')
        )) {
            const responses = [
                `👀 You called? I'm *${BOT_NAME}*!\nType *${PREFIX}menu* to see what I can do 🔥`,
                `⚡ *${BOT_NAME}* is here! Need something?\nTry *${PREFIX}ai <question>* to chat with me!`,
                `🤖 Yes? *${BOT_NAME}* at your service!\nType *${PREFIX}menu* for all commands.`,
                `👋 Heard my name! I'm *${BOT_NAME}* 🤖\nWhat do you need?`,
                `🔥 Someone said *Tavik*! That's me!\nType *${PREFIX}menu* to get started.`,
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

        // ── Chatbot: AI replies to every non-command message ──
        if (state.chatbot[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            const reply = await utils.askAI(text,
                'You are a friendly, smart WhatsApp chatbot. Be natural, helpful and concise. Keep responses short (1-3 sentences unless asked for more).')
            return api.sendText(chatId, reply, msgKeyId)
        }

        // ── Route to commands ─────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] Owner:${isOwner} Sudo:${isSudo} | ${senderNumber} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msgKeyId, isOwner, isSudo, isGroup, msg)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
