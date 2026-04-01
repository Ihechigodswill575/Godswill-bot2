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

    console.log(`[OWNER CHECK] sender="${sender}" against owners=[${OWNER_NUMBERS.join(', ')}]`)

    return OWNER_NUMBERS.some(ownerRaw => {
        const owner = cleanNumber(ownerRaw)
        if (!owner) return false

        // Exact match
        if (sender === owner) return true

        // Suffix match — handles country code variations
        // e.g. 08145688688 vs 2348145688688 — last 10 digits match
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
        r.count       = 1
        r.windowStart = now
        return true
    }
    r.count++
    return r.count <= CHATBOT_RATE_LIMIT
}

// ── Group participant cache ────────────────────────────────────
const _groupCache = {}
const GROUP_CACHE_TTL = 90_000 // 90 seconds

async function getGroupParticipants(chatId) {
    const now    = Date.now()
    const cached = _groupCache[chatId]
    if (cached && (now - cached.ts) < GROUP_CACHE_TTL) {
        return cached.participants
    }
    try {
        const info = await api.getGroupInfo(chatId)
        const participants = info?.participants || []
        _groupCache[chatId] = { participants, ts: now }
        return participants
    } catch {
        return []
    }
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

        // ── SENDER RESOLUTION ─────────────────────────────────
        // Evolution API v2 sometimes sends @lid identifiers in group messages.
        // msg.sender is the most reliable field — it is always the real phone JID.
        // We try multiple fields and prefer non-@lid values.
        let senderJid = ''
        if (isGroup) {
            const candidates = [
                msg.sender,
                msg.key?.participant,
                msg.participant,
            ].filter(Boolean)

            // prefer a non-@lid JID
            senderJid = candidates.find(c => !c.includes('@lid')) || candidates[0] || ''

            // last resort: if we only have @lid, strip it and treat as plain number
            if (!senderJid || senderJid.includes('@lid')) {
                const stripped = (senderJid || '').replace(/@lid/g, '@s.whatsapp.net')
                senderJid = stripped || msg.sender || ''
            }
        } else {
            senderJid = msg.sender || chatId
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
        // IMPORTANT: If the sender is an owner, we skip the group admin API call entirely.
        // This means owner commands ALWAYS work even when Evolution API returns 400.
        let isGroupAdmin = false
        if (isGroup) {
            if (isOwner) {
                // Owner is always treated as privileged without needing group admin check
                isGroupAdmin = false // doesn't matter — isPrivileged covers it
            } else {
                const participants = await getGroupParticipants(chatId)
                if (participants.length > 0) {
                    isGroupAdmin = participants.some(p => {
                        const pNum  = cleanNumber(p.id || p.jid || '')
                        const admin = (p.admin || p.rank || '').toLowerCase()
                        // match by number, or suffix match for country code variations
                        const numMatch =
                            pNum === senderNumber ||
                            (pNum.length >= 7 && senderNumber.endsWith(pNum)) ||
                            (senderNumber.length >= 7 && pNum.endsWith(senderNumber))
                        return numMatch && (
                            p.isAdmin === true      ||
                            p.isSuperAdmin === true ||
                            admin === 'admin'       ||
                            admin === 'superadmin'
                        )
                    })
                }
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

        // ── Anti ghost ping ───────────────────────────────────
        if (isGroup && state.antiGhostPing[chatId] && !isPrivileged) {
            const isGhost = (
                (msgContent.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0 ||
                 msgContent.extendedTextMessage?.contextInfo?.quotedMessage) &&
                !text
            )
            if (isGhost) {
                await api.deleteMessage(chatId, msgKeyId).catch(() => {})
                await api.sendText(chatId, `👻 @${senderNumber} Ghost ping detected and removed!`)
                return
            }
        }

        // ── Welcome / Goodbye ─────────────────────────────────
        if (isGroup && (msg.messageStubType === 27 || msg.messageStubType === 28)) {
            const joined = msg.messageStubType === 27
            if (state.welcome[chatId]?.enabled) {
                const members = msg.messageStubParameters || []
                for (const m of members) {
                    const num = cleanNumber(m)
                    if (joined) {
                        await api.sendText(chatId,
                            `👋 Welcome @${num} to the group!\n${state.welcome[chatId].msg || '🎉 Glad to have you here!'}`)
                    } else {
                        await api.sendText(chatId,
                            `👋 @${num} has left the group.\n${state.welcome[chatId].byeMsg || '😢 We will miss you!'}`)
                    }
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

        // ── Anti delete ───────────────────────────────────────
        if (isGroup && state.antiDelete[chatId]?.enabled && msgContent.protocolMessage?.type === 0) {
            const origId  = msgContent.protocolMessage?.key?.id
            const deleted = state.antiDelete[chatId]?.msgs?.[origId]
            if (deleted) {
                await api.sendText(chatId,
                    `🗑️ *@${senderNumber} deleted a message:*\n\n${deleted}`)
            }
            return
        }
        // Store message for antidelete
        if (isGroup && state.antiDelete[chatId]?.enabled && text && msgKeyId) {
            if (!state.antiDelete[chatId].msgs) state.antiDelete[chatId].msgs = {}
            state.antiDelete[chatId].msgs[msgKeyId] = text.slice(0, 500)
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

        // ── Chatbot (Groq-powered) ────────────────────────────
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
