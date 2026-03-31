'use strict'

const api    = require('./api')
const state  = require('./state')
const { handleCommand } = require('./commands')
const { OWNER_NUMBERS, BAD_WORDS, PREFIX, BOT_NAME } = require('./config')
const utils  = require('./utils')

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

function cleanNumber(jid = '') {
    return jid
        .replace(/@s\.whatsapp\.net|@g\.us/g, '')
        .replace(/[^0-9]/g, '')
        .replace(/^0+/, '')
}

function checkIsOwner(senderNumber) {
    const sender = cleanNumber(senderNumber)
    if (!sender) return false
    return OWNER_NUMBERS.some(ownerRaw => {
        const owner = cleanNumber(ownerRaw)
        if (!owner) return false
        if (sender === owner) return true
        if (sender.length > 6 && owner.endsWith(sender)) return true
        if (owner.length  > 6 && sender.endsWith(owner))  return true
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
            msgContent.conversation                  ||
            msgContent.extendedTextMessage?.text     ||
            msgContent.imageMessage?.caption         ||
            msgContent.videoMessage?.caption         ||
            msgContent.documentMessage?.caption      ||
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

        // ── Self mode ─────────────────────────────────────────
        if (state.selfMode && !isOwner) return

        // ── Auto read ─────────────────────────────────────────
        if (state.autoread) await api.markRead(chatId).catch(() => {})

        // ── Auto react ────────────────────────────────────────
        if (state.autoreact && text && msgKeyId) {
            const emojis = ['❤️', '😂', '🔥', '⚡', '👍', '🎉']
            await api.sendReaction(chatId, msgKeyId,
                emojis[Math.floor(Math.random() * emojis.length)]).catch(() => {})
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

        // ── Name trigger: someone says "tavik" ────────────────
        const lowerText = text.toLowerCase().trim()
        if (!text.startsWith(PREFIX) &&
            (lowerText === 'tavik' ||
             lowerText.startsWith('tavik ') ||
             lowerText.includes(' tavik ') ||
             lowerText.endsWith(' tavik'))) {
            const responses = [
                `👀 You called? I'm *${BOT_NAME}* — how can I help?\nType *${PREFIX}menu* to see what I can do!`,
                `⚡ Yes? *${BOT_NAME}* is here! Type *${PREFIX}menu* for commands.`,
                `🤖 *${BOT_NAME}* at your service! What do you need?\nType *${PREFIX}ai <question>* to chat with me!`,
                `👋 Hey! You mentioned me. I'm *${BOT_NAME}*!\nType *${PREFIX}menu* to see all commands.`,
                `🔥 Someone said my name! I'm *${BOT_NAME}*. Need help? Type *${PREFIX}menu*`,
            ]
            await api.sendTyping(chatId, 1)
            return api.sendText(chatId, pick(responses), msgKeyId)
        }

        // ── Auto reply ────────────────────────────────────────
        if (state.autoreply[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            await api.sendText(chatId, `🤖 Auto Reply!\nType *${PREFIX}menu* to see all commands.`)
            return
        }

        // ── Chatbot mode ──────────────────────────────────────
        if (state.chatbot[chatId] && text && !text.startsWith(PREFIX)) {
            await api.sendTyping(chatId, 2)
            const reply = await utils.askAI(text)
            return api.sendText(chatId, `🤖 ${reply}\n\n_⚡ ${BOT_NAME} AI_`, msgKeyId)
        }

        // ── Route to commands ─────────────────────────────────
        if (!text || !text.startsWith(PREFIX)) return

        console.log(`[CMD] Owner:${isOwner} Sudo:${isSudo} | ${senderNumber} → ${text}`)
        // Pass full msg object so commands can access quoted message info
        await handleCommand(chatId, senderNumber, text, msgKeyId, isOwner, isSudo, isGroup, msg)

    } catch (err) {
        console.error('[HANDLER ERROR]', err.message)
        console.error(err.stack)
    }
}

module.exports = { handleMessage }
