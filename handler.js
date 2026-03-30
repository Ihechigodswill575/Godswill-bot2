'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBER, BAD_WORDS, PREFIX } = require('./config')

async function handleMessage(msg) {
    try {
        if (!msg) return

        // ── Debug log ────────────────────────────────────────
        console.log('[MSG RAW]', JSON.stringify(msg).substring(0, 500))

        // ── Ignore outgoing & status messages ────────────────
        if (msg.key?.fromMe === true) return
        if (msg.messageType === 'protocolMessage') return
        if (msg.messageType === 'senderKeyDistributionMessage') return

        // ── Extract text from Evolution API format ───────────
        const text = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            msg.body ||
            msg.text?.body ||
            msg.caption ||
            ''
        ).trim()

        // ── Extract chat ID ──────────────────────────────────
        const chatId = (
            msg.key?.remoteJid ||
            msg.chat_id ||
            msg.from ||
            ''
        )

        if (!chatId) {
            console.log('[HANDLER] No chatId found')
            return
        }

        // ── Extract sender ───────────────────────────────────
        const sender = (
            msg.key?.participant?.replace('@s.whatsapp.net', '') ||
            msg.sender?.phone ||
            msg.pushName ||
            chatId.replace('@s.whatsapp.net', '').replace('@g.us', '') ||
            ''
        )

        // Clean sender number
        const senderNumber = sender.replace(/[^0-9]/g, '')

        const isGroup      = chatId.endsWith('@g.us')
        const isOwner      = senderNumber === OWNER_NUMBER || 
                             senderNumber === OWNER_NUMBER.replace(/\D/g, '')
        const isSudo       = state.sudoUsers.includes(senderNumber)
        const isPrivileged = isOwner || isSudo

        console.log(`[MSG] From: ${senderNumber} | Chat: ${chatId} | Text: ${text}`)

        // ── Auto read ────────────────────────────────────────
        if (state.autoread) {
            await api.markRead(chatId).catch(() => {})
        }

        // ── Auto react ───────────────────────────────────────
        if (state.autoreact && text) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉']
            const msgId = msg.key?.id || msg.id
            if (msgId) {
                await api.sendReaction(chatId, msgId, emojis[Math.floor(Math.random() * emojis.length)]).catch(() => {})
            }
        }

        // ── Auto typing ──────────────────────────────────────
        if (state.autotyping && text) {
            await api.sendTyping(chatId, 1).catch(() => {})
        }

        // ── Anti link ────────────────────────────────────────
        if (isGroup && state.antilink[chatId] && !isPrivileged) {
            if (/(https?:\/\/|wa\.me|chat\.whatsapp\.com)/i.test(text)) {
                const msgId = msg.key?.id || msg.id
                await api.deleteMessage(chatId, msgId).catch(() => {})
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
                const msgId = msg.key?.id || msg.id
                await api.deleteMessage(chatId, msgId).catch(() => {})
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

        // ── Route to commands ────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] ${senderNumber} → ${text}`)
        await handleCommand(chatId, senderNumber, text, msg, isOwner, isSudo, isGroup)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
