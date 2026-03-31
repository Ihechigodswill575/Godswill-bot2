'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBER, BAD_WORDS, PREFIX } = require('./config')

// ── Helper: strip to digits only, remove leading zeros ───────
function cleanNumber(jid = '') {
    return jid
        .replace(/@s\.whatsapp\.net|@g\.us/g, '')
        .replace(/[^0-9]/g, '')
        .replace(/^0+/, '')
}

// ── Helper: robust owner check ────────────────────────────────
// Handles: full number (2348145688688), local (08145688688), short (8145688688)
function checkIsOwner(senderNumber) {
    const sender = cleanNumber(senderNumber)
    const owner  = cleanNumber(OWNER_NUMBER)

    if (!sender || !owner) return false

    // Exact match
    if (sender === owner) return true

    // One ends with the other (handles country-code vs local variants)
    if (sender.length > 6 && owner.endsWith(sender)) return true
    if (owner.length  > 6 && sender.endsWith(owner))  return true

    return false
}

async function handleMessage(msg) {
    try {
        if (!msg) return

        // ── Ignore outgoing ───────────────────────────────────
        if (msg.key?.fromMe === true) return

        // ── Ignore non-text events ────────────────────────────
        const msgContent = msg.message
        if (!msgContent)                              return
        if (msgContent.protocolMessage)               return
        if (msgContent.senderKeyDistributionMessage)  return
        if (msgContent.reactionMessage)               return
        if (msgContent.pollUpdateMessage)             return

        // ── Extract text ──────────────────────────────────────
        const text = (
            msgContent.conversation                     ||
            msgContent.extendedTextMessage?.text        ||
            msgContent.imageMessage?.caption            ||
            msgContent.videoMessage?.caption            ||
            msgContent.documentMessage?.caption         ||
            ''
        ).trim()

        // ── Extract chat ID ───────────────────────────────────
        const chatId = msg.key?.remoteJid || ''
        if (!chatId) return

        const isGroup = chatId.endsWith('@g.us')

        // ── Extract sender ────────────────────────────────────
        // Groups: participant field holds the actual sender JID
        // DMs:    remoteJid is the sender
        const senderJid    = isGroup ? (msg.key?.participant || '') : chatId
        const senderNumber = cleanNumber(senderJid)
        if (!senderNumber) return

        // ── Message key ID (for quoting replies) ──────────────
        const msgKeyId = msg.key?.id || null

        // ── Check privileges ──────────────────────────────────
        const isOwner      = checkIsOwner(senderNumber)
        const isSudo       = state.sudoUsers.includes(senderNumber)
        const isPrivileged = isOwner || isSudo

        // Log every message
        console.log(`[MSG] ${senderNumber} | Owner:${isOwner} | Sudo:${isSudo} | Group:${isGroup} | "${text}"`)

        // ── Self mode: only owner can trigger anything ─────────
        if (state.selfMode && !isOwner) return

        // ── Auto read ─────────────────────────────────────────
        if (state.autoread) await api.markRead(chatId).catch(() => {})

        // ── Auto react ────────────────────────────────────────
        if (state.autoreact && text && msgKeyId) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉']
            await api.sendReaction(
                chatId, msgKeyId,
                emojis[Math.floor(Math.random() * emojis.length)]
            ).catch(() => {})
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
                await api.sendText(chatId, `🚫 @${senderNumber} was kicked for spamming!`)
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

        // ── Auto reply ────────────────────────────────────────
        if (state.autoreply[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            await api.sendText(chatId, `🤖 Auto Reply!\nType *${PREFIX}menu* to see all commands.`)
            return
        }

        // ── Route to commands ─────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] Owner:${isOwner} Sudo:${isSudo} | ${senderNumber} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msgKeyId, isOwner, isSudo, isGroup)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
