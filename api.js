'use strict'

const axios = require('axios')
const { WHAPI_TOKEN, WHAPI_URL } = require('./config')

// ── Axios instance ───────────────────────────────────────────
const client = axios.create({
    baseURL : WHAPI_URL,
    headers : {
        Authorization  : `Bearer ${WHAPI_TOKEN}`,
        'Content-Type' : 'application/json',
        Accept         : 'application/json',
    },
    // Also pass token as query param (Whapi supports both)
    params : {
        token : WHAPI_TOKEN,
    },
    timeout : 30_000,
})

// ── Base request ─────────────────────────────────────────────
async function request(method, endpoint, data = null) {
    try {
        const res = await client({ method, url: endpoint, data })
        return res.data
    } catch (e) {
        console.error(`[API] ${method.toUpperCase()} ${endpoint} — ${e.response?.status} — ${e.response?.data?.message || e.message}`)
        return null
    }
}

// ── Text message ─────────────────────────────────────────────
async function sendText(chatId, text, quotedId = null) {
    const body = { to: chatId, body: text }
    if (quotedId) body.quoted = { message_id: quotedId }
    return request('post', '/messages/text', body)
}

// ── Image ────────────────────────────────────────────────────
async function sendImage(chatId, url, caption = '', quotedId = null) {
    const body = { to: chatId, media: url, caption }
    if (quotedId) body.quoted = { message_id: quotedId }
    return request('post', '/messages/image', body)
}

// ── Video ────────────────────────────────────────────────────
async function sendVideo(chatId, url, caption = '', quotedId = null) {
    const body = { to: chatId, media: url, caption }
    if (quotedId) body.quoted = { message_id: quotedId }
    return request('post', '/messages/video', body)
}

// ── Audio ────────────────────────────────────────────────────
async function sendAudio(chatId, url) {
    return request('post', '/messages/audio', { to: chatId, media: url })
}

// ── Document ─────────────────────────────────────────────────
async function sendDocument(chatId, url, filename = 'file') {
    return request('post', '/messages/document', { to: chatId, media: url, filename })
}

// ── Reaction ─────────────────────────────────────────────────
async function sendReaction(chatId, messageId, emoji) {
    return request('post', '/messages/reaction', { to: chatId, message_id: messageId, emoji })
}

// ── Delete message ───────────────────────────────────────────
async function deleteMessage(chatId, messageId) {
    return request('delete', `/messages/${messageId}`, { chat_id: chatId })
}

// ── Mark read ────────────────────────────────────────────────
async function markRead(chatId) {
    return request('patch', `/chats/${chatId}`, { read: true })
}

// ── Typing indicator ─────────────────────────────────────────
async function sendTyping(chatId, seconds = 2) {
    return request('post', '/chats/typing', { chat_id: chatId, seconds })
}

// ── Group info ───────────────────────────────────────────────
async function getGroupInfo(groupId) {
    return request('get', `/groups/${groupId}`)
}

// ── Group participants ───────────────────────────────────────
async function addGroupParticipants(groupId, participants) {
    return request('post', `/groups/${groupId}/participants`, { participants })
}

async function removeGroupParticipants(groupId, participants) {
    return request('delete', `/groups/${groupId}/participants`, { participants })
}

async function promoteGroupParticipants(groupId, participants) {
    return request('patch', `/groups/${groupId}/admins`, { participants })
}

async function demoteGroupParticipants(groupId, participants) {
    return request('delete', `/groups/${groupId}/admins`, { participants })
}

// ── Channel health ───────────────────────────────────────────
async function checkHealth() {
    return request('get', '/health')
}

// ── Webhook setup ────────────────────────────────────────────
async function setWebhook(url) {
    return request('patch', '/settings', {
        webhooks: [
            {
                url,
                events : [
                    { type: 'messages',        method: 'post' },
                    { type: 'message_status',  method: 'post' },
                ],
                mode: 'body',
            }
        ],
        offline_mode : false,
        full_history : false,
    })
}

module.exports = {
    request,
    sendText,
    sendImage,
    sendVideo,
    sendAudio,
    sendDocument,
    sendReaction,
    deleteMessage,
    markRead,
    sendTyping,
    getGroupInfo,
    addGroupParticipants,
    removeGroupParticipants,
    promoteGroupParticipants,
    demoteGroupParticipants,
    checkHealth,
    setWebhook,
}
