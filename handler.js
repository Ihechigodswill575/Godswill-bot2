'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBER, BAD_WORDS, PREFIX } = require('./config')

async function handleMessage(msg) {
    try {
        if (!msg) return

        // ── Evolution API message structure ──────────────────
        // msg.key.remoteJid = chat ID
        // msg.key.fromMe = true/false
        // msg.key.participant = sender in groups
        // msg.message = message content
        // msg.pushName = sender name

        // Ignore outgoing messages
        if (msg.key?.fromMe === true) return

        // Ignore non-message events
        const msgContent = msg.message
        if (!msgContent) return

        // Ignore protocol messages
        if (msgContent.protocolMessage) return
        if (msgContent.senderKeyDistributionMessage) return
        if (msgContent.reactionMessage) return

        // ── Extract text ─────────────────────────────────────
        const text = (
            msgContent.conversation ||
            msgContent.extendedTextMessage?.text ||
            msgContent.imageMessage?.caption ||
            msgContent.videoMessage?.caption ||
            msgContent.documentMessage?.caption ||
            ''
        ).trim()

        // ── Extract IDs ──────────────────────────────────────
        const chatId = msg.key.remoteJid
        if (!chatId) return

        const isGroup = chatId.endsWith('@g.us')

        // In groups sender is in participant, in DMs it's remoteJid
        const senderJid = isGroup
            ? (msg.key.participant || '')
            : chatId

        const senderNumber = senderJid
            .replace('@s.whatsapp.net', '')
            .replace(/[^0-9]/g, '')

        if (!senderNumber) return

        const isOwner      = senderNumber === OWNER_NUMBER
        const isSudo       = state.sudoUsers.includes(senderNumber)
        const isPrivileged = isOwner || isSudo

        console.log(`[MSG] ${senderNumber} → "${text}" | Group: ${isGroup}`)

        // ── Auto read ────────────────────────────────────────
        if (state.autoread) {
            await api.markRead(chatId).catch(() => {})
        }

        // ── Auto react ───────────────────────────────────────
        if (state.autoreact && text) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉']
            await api.sendReaction(
                chatId,
                msg.key.id,
                emojis[Math.floor(Math.random() * emojis.length)]
            ).catch(() => {})
        }

        // ── Auto typing ──────────────────────────────────────
        if (state.autotyping && text) {
            await api.sendTyping(chatId, 1).catch(() => {})
        }

        // ── Anti link ────────────────────────────────────────
        if (isGroup && state.antilink[chatId] && !isPrivileged) {
            if (/(https?:\/\/|wa\.me|chat\.whatsapp\.com)/i.test(text)) {
                await api.deleteMessage(chatId, msg.key.id).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Links are not allowed!`)
                return
            }
        }

        // ── Anti spam ────────────────────────────────────────
        if (isGroup && state.antispam[chatId] && !isPrivileged) {
            const key = `${chatId}_${senderNumber}`
            if (!state.spamCount[key]) state.spamCount[key] = { count: 0, time: Date.now() }
            if (Date.now() - state.spamCount[key].time > 5000) {
                state.spamCount[key] = { count: 0, time: Date.now() }
            }
            state.spamCount[key].count++
            if (state.spamCount[key].count > 5) {
                await api.removeGroupParticipants(chatId, [`${senderNumber}@s.whatsapp.net`]).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} kicked for spamming!`)
                return
            }
        }

        // ── Anti bad word ────────────────────────────────────
        if (isGroup && state.antibadword[chatId] && !isPrivileged) {
            if (BAD_WORDS.some(w => text.toLowerCase().includes(w))) {
                await api.deleteMessage(chatId, msg.key.id).catch(() => {})
                await api.sendText(chatId, `⚠️ @${senderNumber} Watch your language!`)
                return
            }
        }

        // ── Auto reply ───────────────────────────────────────
        if (state.autoreply[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            await api.sendText(chatId,
                `🤖 Auto Reply!\nType *${PREFIX}menu* to see all commands.`)
            return
        }

        // ── Route to commands ─────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] ${senderNumber} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msg, isOwner, isSudo, isGroup)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
