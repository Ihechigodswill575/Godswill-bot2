'use strict'

const axios = require('axios')

const EVO_URL      = process.env.EVO_URL      || 'https://evolution-api-production-09bdd.up.railway.app'
const EVO_KEY      = process.env.EVO_KEY      || '57695a473ad9b3f8c0f7ffee6f15dee960f35f5fc18dd903d36276150a3c17b4'
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'tavik-bot'

const client = axios.create({
    baseURL : EVO_URL,
    headers : {
        'apikey'       : EVO_KEY,
        'Content-Type' : 'application/json',
    },
    timeout : 30_000,
})

async function request(method, endpoint, data = null) {
    try {
        const res = await client({ method, url: endpoint, data })
        return res.data
    } catch (e) {
        const status = e.response?.status
        const msg    = e.response?.data?.message || e.message
        console.error(`[API] ${method.toUpperCase()} ${endpoint} → ${status} ${msg}`)
        return null
    }
}

function formatNumber(chatId) {
    if (chatId.includes('@')) return chatId
    return chatId
}

// ── Normalize a participant object to extract real phone number ──
// Evolution API v2 sometimes returns @lid IDs.
// Real number is found in: p.phone, p.phones[0], or p.id if @s.whatsapp.net
function participantToNumber(p) {
    if (!p) return ''
    // Best: explicit phone field
    if (p.phone) return String(p.phone).replace(/[^0-9]/g, '')
    if (p.phones && p.phones[0]) return String(p.phones[0]).replace(/[^0-9]/g, '')
    // p.id might be @s.whatsapp.net (real) or @lid (fake)
    const id = p.id || p.jid || ''
    if (id.includes('@s.whatsapp.net')) {
        return id.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')
    }
    if (id.includes('@lid')) {
        // @lid is a numeric alias — NOT a phone number, skip it
        // Try other fields
        if (p.notify) return ''   // display name, not a number
        return ''                 // can't resolve — caller must skip this participant
    }
    // plain number
    return id.replace(/[^0-9]/g, '')
}

// ── Get group info with 4 fallback strategies ─────────────────
async function getGroupInfo(groupId) {
    const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`

    // Strategy 1: standard GET
    try {
        const res = await client({ method: 'get', url: `/group/participants/${EVO_INSTANCE}`, params: { groupJid: jid } })
        if (res.data?.participants?.length) {
            console.log(`[API] getGroupInfo S1 OK`)
            return normalizeGroupInfo(res.data)
        }
    } catch (e) { console.log(`[API] S1 failed: ${e.response?.status}`) }

    // Strategy 2: fetchAllGroups
    try {
        const res = await client({ method: 'get', url: `/group/fetchAllGroups/${EVO_INSTANCE}`, params: { getParticipants: 'true' } })
        const groups = Array.isArray(res.data) ? res.data : (res.data?.groups || [])
        const found  = groups.find(g => g.id === jid || g.groupJid === jid)
        if (found?.participants?.length) {
            console.log(`[API] getGroupInfo S2 OK`)
            return normalizeGroupInfo(found)
        }
    } catch (e) { console.log(`[API] S2 failed: ${e.response?.status}`) }

    // Strategy 3: POST body
    try {
        const res = await client({ method: 'post', url: `/group/participants/${EVO_INSTANCE}`, data: { groupJid: jid } })
        if (res.data?.participants?.length) {
            console.log(`[API] getGroupInfo S3 OK`)
            return normalizeGroupInfo(res.data)
        }
    } catch (e) { console.log(`[API] S3 failed: ${e.response?.status}`) }

    // Strategy 4: findGroupInfos
    try {
        const res = await client({ method: 'get', url: `/group/findGroupInfos/${EVO_INSTANCE}`, params: { groupJid: jid } })
        if (res.data?.participants?.length) {
            console.log(`[API] getGroupInfo S4 OK`)
            return normalizeGroupInfo(res.data)
        }
    } catch (e) { console.log(`[API] S4 failed: ${e.response?.status}`) }

    console.log(`[API] getGroupInfo ALL failed for ${jid}`)
    return null
}

// Normalize group info so participants always have a .realNumber field
function normalizeGroupInfo(info) {
    if (!info || !info.participants) return info
    info.participants = info.participants.map(p => {
        const realNumber = participantToNumber(p)
        return { ...p, realNumber }
    // Filter out @lid participants with no resolvable number ONLY for tagall purposes
    // We keep them in the array but mark them
    })
    return info
}

async function sendText(chatId, text, quotedId = null) {
    const body = { number: formatNumber(chatId), text }
    if (quotedId) body.quoted = { key: { id: quotedId } }
    return request('post', `/message/sendText/${EVO_INSTANCE}`, body)
}

async function sendImage(chatId, url, caption = '', quotedId = null) {
    const body = { number: formatNumber(chatId), mediatype: 'image', media: url, caption }
    if (quotedId) body.quoted = { key: { id: quotedId } }
    return request('post', `/message/sendMedia/${EVO_INSTANCE}`, body)
}

async function sendVideo(chatId, url, caption = '', quotedId = null) {
    const body = { number: formatNumber(chatId), mediatype: 'video', media: url, caption }
    if (quotedId) body.quoted = { key: { id: quotedId } }
    return request('post', `/message/sendMedia/${EVO_INSTANCE}`, body)
}

async function sendAudio(chatId, url) {
    return request('post', `/message/sendMedia/${EVO_INSTANCE}`, {
        number: formatNumber(chatId), mediatype: 'audio', media: url
    })
}

async function sendDocument(chatId, url, filename = 'file') {
    return request('post', `/message/sendMedia/${EVO_INSTANCE}`, {
        number: formatNumber(chatId), mediatype: 'document', media: url, fileName: filename
    })
}

async function sendReaction(chatId, messageId, emoji) {
    return request('post', `/message/sendReaction/${EVO_INSTANCE}`, {
        key: { remoteJid: chatId, id: messageId }, reaction: emoji
    })
}

async function deleteMessage(chatId, messageId) {
    return request('delete', `/chat/deleteMessage/${EVO_INSTANCE}`, {
        id: messageId, remoteJid: chatId, fromMe: false
    })
}

async function markRead(chatId) {
    return request('post', `/chat/markMessageAsRead/${EVO_INSTANCE}`, {
        readMessages: [{ remoteJid: chatId, fromMe: false, id: 'all' }]
    })
}

async function sendTyping(chatId, seconds = 2) {
    return request('post', `/chat/sendPresence/${EVO_INSTANCE}`, {
        number: formatNumber(chatId),
        options: { presence: 'composing', delay: seconds * 1000 }
    })
}

async function addGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, {
        groupJid: groupId, action: 'add', participants
    })
}

async function removeGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, {
        groupJid: groupId, action: 'remove', participants
    })
}

async function promoteGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, {
        groupJid: groupId, action: 'promote', participants
    })
}

async function demoteGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, {
        groupJid: groupId, action: 'demote', participants
    })
}

async function checkHealth() {
    return request('get', `/instance/connectionState/${EVO_INSTANCE}`)
}

async function setWebhook(url) {
    return request('post', `/webhook/set/${EVO_INSTANCE}`, {
        url, enabled: true,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE']
    })
}

async function updateBlockStatus(number, action) {
    return request('post', `/chat/updateBlockStatus/${EVO_INSTANCE}`, {
        number: formatNumber(number), status: action
    })
}

module.exports = {
    request,
    participantToNumber,
    sendText, sendImage, sendVideo, sendAudio, sendDocument,
    sendReaction, deleteMessage, markRead, sendTyping,
    getGroupInfo,
    addGroupParticipants, removeGroupParticipants,
    promoteGroupParticipants, demoteGroupParticipants,
    checkHealth, setWebhook, updateBlockStatus,
}
