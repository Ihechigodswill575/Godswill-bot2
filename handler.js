'use strict'

/**
 * ============================================================
 *  TAVIK BOT — handler.js
 *  Processes every incoming message from Whapi webhook
 * ============================================================
 */

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBER, BAD_WORDS, PREFIX } = require('./config')

// ── Main message handler ─────────────────────────────────────
async function handleMessage(msg) {
    try {
        // Ignore outgoing messages — prevents infinite loops
        if (msg.from_me) return

        // Extract message text from all possible fields
        const text   = msg.text?.body || msg.caption || ''
        const chatId = msg.chat_id
        const sender = msg.sender?.phone || chatId.replace('@s.whatsapp.net', '').replace('@g.us', '')
        const isGroup = chatId.endsWith('@g.us')
        const isOwner = sender === OWNER_NUMBER
        const isSudo  = state.sudoUsers.includes(sender)
        const isPrivileged = isOwner || isSudo

        // ── Auto read ────────────────────────────────────────
        if (state.autoread) {
            await api.markRead(chatId).catch(() => {})
        }

        // ── Auto react ───────────────────────────────────────
        if (state.autoreact && text) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉', '😍', '🙏']
            await api.sendReaction(
                chatId,
                msg.id,
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
                await api.deleteMessage(chatId, msg.id).catch(() => {})
                await api.sendText(chatId, `⚠️ @${sender} Links are not allowed here!`)
                return
            }
        }

        // ── Anti spam ────────────────────────────────────────
        if (isGroup && state.antispam[chatId] && !isPrivileged) {
            const key = `${chatId}_${sender}`
            if (!state.spamCount[key]) state.spamCount[key] = { count: 0, time: Date.now() }
            if (Date.now() - state.spamCount[key].time > 5000) {
                state.spamCount[key] = { count: 0, time: Date.now() }
            }
            state.spamCount[key].count++
            if (state.spamCount[key].count > 5) {
                await api.removeGroupParticipants(chatId, [`${sender}@s.whatsapp.net`]).catch(() => {})
                await api.sendText(chatId, `⚠️ @${sender} was kicked for spamming!`)
                return
            }
        }

        // ── Anti bad word ────────────────────────────────────
        if (isGroup && state.antibadword[chatId] && !isPrivileged) {
            if (BAD_WORDS.some(w => text.toLowerCase().includes(w))) {
                await api.deleteMessage(chatId, msg.id).catch(() => {})
                await api.sendText(chatId, `⚠️ @${sender} Watch your language!`)
                return
            }
        }

        // ── Auto reply ───────────────────────────────────────
        if (state.autoreply[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            await api.sendText(chatId,
                `🤖 Auto Reply: Thanks for your message!\nType *${PREFIX}menu* to see all commands.`,
                msg.id)
            return
        }

        // ── Route to command handler ─────────────────────────
        if (!text.startsWith(PREFIX)) return
        await handleCommand(chatId, sender, text, msg, isOwner, isSudo, isGroup)

    } catch (err) {
        console.error('[HANDLER]', err.message)
    }
}

module.exports = { handleMessage }
