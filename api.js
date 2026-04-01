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

// ── Format number for Evolution API ──────────────────────────
function formatNumber(chatId) {
    if (chatId.includes('@')) return chatId
    return chatId
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

// ── Get group info — tries multiple Evolution API endpoints ───
// Evolution API v1 vs v2 differ in endpoint paths.
// The @lid bug means some versions return 400 for the participants endpoint.
// We try 4 strategies in order:
//   1. GET /group/participants/{instance}?groupJid=xxx  (v2 standard)
//   2. GET /group/fetchAllGroups/{instance}?getParticipants=true  (v2 alt)
//   3. POST /group/participants/{instance} with body { groupJid }  (v1 style)
//   4. GET /group/findGroupInfos/{instance}?groupJid=xxx  (some forks)
async function getGroupInfo(groupId) {
    const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`

    // Strategy 1: standard v2 GET with query param
    try {
        const res = await client({
            method : 'get',
            url    : `/group/participants/${EVO_INSTANCE}`,
            params : { groupJid: jid },
        })
        if (res.data?.participants?.length) {
            console.log(`[API] getGroupInfo strategy1 OK for ${jid}`)
            return res.data
        }
    } catch (e) {
        console.log(`[API] getGroupInfo strategy1 failed: ${e.response?.status} ${e.message}`)
    }

    // Strategy 2: fetchAllGroups then filter
    try {
        const res = await client({
            method : 'get',
            url    : `/group/fetchAllGroups/${EVO_INSTANCE}`,
            params : { getParticipants: 'true' },
        })
        const groups = Array.isArray(res.data) ? res.data : (res.data?.groups || [])
        const found  = groups.find(g => g.id === jid || g.groupJid === jid || g.subject?.id === jid)
        if (found?.participants?.length) {
            console.log(`[API] getGroupInfo strategy2 OK for ${jid}`)
            return found
        }
    } catch (e) {
        console.log(`[API] getGroupInfo strategy2 failed: ${e.response?.status} ${e.message}`)
    }

    // Strategy 3: POST body (v1 style)
    try {
        const res = await client({
            method : 'post',
            url    : `/group/participants/${EVO_INSTANCE}`,
            data   : { groupJid: jid },
        })
        if (res.data?.participants?.length) {
            console.log(`[API] getGroupInfo strategy3 OK for ${jid}`)
            return res.data
        }
    } catch (e) {
        console.log(`[API] getGroupInfo strategy3 failed: ${e.response?.status} ${e.message}`)
    }

    // Strategy 4: findGroupInfos
    try {
        const res = await client({
            method : 'get',
            url    : `/group/findGroupInfos/${EVO_INSTANCE}`,
            params : { groupJid: jid },
        })
        const d = res.data
        if (d?.participants?.length) {
            console.log(`[API] getGroupInfo strategy4 OK for ${jid}`)
            return d
        }
    } catch (e) {
        console.log(`[API] getGroupInfo strategy4 failed: ${e.response?.status} ${e.message}`)
    }

    console.log(`[API] getGroupInfo ALL strategies failed for ${jid}`)
    return null
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
    updateBlockStatus,
}
