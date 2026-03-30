'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBER, BAD_WORDS, PREFIX } = require('./config')

// ── Helper: clean number ──────────────────────────────────────
function cleanNumber(jid = '') {
    return jid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace(/[^0-9]/g, '')
        .replace(/^0+/, '') // remove leading zeros
}

// ── Helper: check if owner ────────────────────────────────────
function checkIsOwner(senderNumber) {
    const clean1 = cleanNumber(senderNumber)
    const clean2 = cleanNumber(OWNER_NUMBER)
    // Check with and without country code
    return clean1 === clean2 ||
           clean1.endsWith(clean2) ||
           clean2.endsWith(clean1)
}

async function handleMessage(msg) {
    try {
        if (!msg) return

        // ── Ignore outgoing ───────────────────────────────────
        if (msg.key?.fromMe === true) return

        // ── Ignore non-text events ────────────────────────────
        const msgContent = msg.message
        if (!msgContent) return
        if (msgContent.protocolMessage) return
        if (msgContent.senderKeyDistributionMessage) return
        if (msgContent.reactionMessage) return
        if (msgContent.pollUpdateMessage) return

        // ── Extract text ──────────────────────────────────────
        const text = (
            msgContent.conversation ||
            msgContent.extendedTextMessage?.text ||
            msgContent.imageMessage?.caption ||
            msgContent.videoMessage?.caption ||
            msgContent.documentMessage?.caption ||
            ''
        ).trim()

        // ── Extract chat ID ───────────────────────────────────
        const chatId = msg.key?.remoteJid || ''
        if (!chatId) return

        const isGroup = chatId.endsWith('@g.us')

        // ── Extract sender ────────────────────────────────────
        // In groups: msg.key.participant has the sender
        // In DMs: msg.key.remoteJid is the sender
        const senderJid = isGroup
            ? (msg.key?.participant || '')
            : chatId

        const senderNumber = cleanNumber(senderJid)
        if (!senderNumber) return

        // ── Check privileges ──────────────────────────────────
        const isOwner      = checkIsOwner(senderNumber)
        const isSudo       = state.sudoUsers.includes(senderNumber)
        const isPrivileged = isOwner || isSudo

        // Log every message
        console.log(`[MSG] ${senderNumber} | Owner: ${isOwner} | Text: "${text}" | Group: ${isGroup}`)

        // ── Auto read ─────────────────────────────────────────
        if (state.autoread) await api.markRead(chatId).catch(() => {})

        // ── Auto react ────────────────────────────────────────
        if (state.autoreact && text && msg.key?.id) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉']
            await api.sendReaction(chatId, msg.key.id,
                emojis[Math.floor(Math.random() * emojis.length)]).catch(() => {})
        }

        // ── Auto typing ───────────────────────────────────────
        if (state.autotyping && text) {
            await api.sendTyping(chatId, 1).catch(() => {})
        }

        // ── Anti link ─────────────────────────────────────────
        if (isGroup && state.antilink[chatId] && !isPrivileged) {
            if (/(https?:\/\/|wa\.me|chat\.whatsapp\.com)/i.test(text)) {
                await api.deleteMessage(chatId, msg.key.id).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Links are not allowed!`)
                return
            }
        }

        // ── Anti spam ─────────────────────────────────────────
        if (isGroup && state.antispam[chatId] && !isPrivileged) {
            const key = `${chatId}_${senderNumber}`
            if (!state.spamCount[key]) state.spamCount[key] = { count: 0, time: Date.now() }
            if (Date.now() - state.spamCount[key].time > 5000) {
                state.spamCount[key] = { count: 0, time: Date.now() }
            }
            state.spamCount[key].count++
            if (state.spamCount[key].count > 5) {
                await api.removeGroupParticipants(chatId,
                    [`${senderNumber}@s.whatsapp.net`]).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} kicked for spamming!`)
                return
            }
        }

        // ── Anti bad word ─────────────────────────────────────
        if (isGroup && state.antibadword[chatId] && !isPrivileged) {
            if (BAD_WORDS.some(w => text.toLowerCase().includes(w))) {
                await api.deleteMessage(chatId, msg.key.id).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Watch your language!`)
                return
            }
        }

        // ── Auto reply ────────────────────────────────────────
        if (state.autoreply[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            await api.sendText(chatId,
                `🤖 Auto Reply!\nType *${PREFIX}menu* to see commands.`)
            return
        }

        // ── Route to commands ─────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] Owner:${isOwner} Sudo:${isSudo} | ${senderNumber} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msg, isOwner, isSudo, isGroup)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
