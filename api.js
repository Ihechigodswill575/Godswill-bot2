'use strict'

const axios = require('axios')

const EVO_URL      = process.env.EVO_URL      || 'https://evolution-api-production-09bdd.up.railway.app'
const EVO_KEY      = process.env.EVO_KEY      || '57695a473ad9b3f8c0f7ffee6f15dee960f35f5fc18dd903d36276150a3c17b4'
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'tavik-bot'

const client = axios.create({
    baseURL : EVO_URL,
    headers : { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
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

function formatNumber(n) { return n.includes('@') ? n : n }

// ── Normalize participant — resolve @lid to real number ───────
function participantToNumber(p) {
    if (!p) return ''
    if (p.phone) return String(p.phone).replace(/[^0-9]/g, '')
    if (p.phones?.[0]) return String(p.phones[0]).replace(/[^0-9]/g, '')
    const id = p.id || p.jid || ''
    if (id.includes('@s.whatsapp.net')) return id.split('@')[0].replace(/[^0-9]/g, '')
    if (id.includes('@lid')) return '' // @lid = unresolvable alias, skip
    return id.replace(/[^0-9]/g, '')
}

function normalizeParticipants(participants) {
    return (participants || []).map(p => ({ ...p, realNumber: participantToNumber(p) }))
}

// ── Get group participants — tries every known endpoint ───────
async function getGroupInfo(groupId) {
    const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`

    // S1: v2 GET with query param (standard)
    try {
        const res = await client.get(`/group/participants/${EVO_INSTANCE}`, { params: { groupJid: jid } })
        if (res.data?.participants?.length) {
            res.data.participants = normalizeParticipants(res.data.participants)
            console.log('[API] getGroupInfo S1 OK')
            return res.data
        }
    } catch (e) { console.log('[API] S1:', e.response?.status, e.message) }

    // S2: fetchAllGroups
    try {
        const res = await client.get(`/group/fetchAllGroups/${EVO_INSTANCE}`, { params: { getParticipants: 'true' } })
        const groups = Array.isArray(res.data) ? res.data : (res.data?.groups || [])
        const found  = groups.find(g => g.id === jid || g.groupJid === jid || g.subject?.id === jid)
        if (found?.participants?.length) {
            found.participants = normalizeParticipants(found.participants)
            console.log('[API] getGroupInfo S2 OK')
            return found
        }
    } catch (e) { console.log('[API] S2:', e.response?.status, e.message) }

    // S3: POST body
    try {
        const res = await client.post(`/group/participants/${EVO_INSTANCE}`, { groupJid: jid })
        if (res.data?.participants?.length) {
            res.data.participants = normalizeParticipants(res.data.participants)
            console.log('[API] getGroupInfo S3 OK')
            return res.data
        }
    } catch (e) { console.log('[API] S3:', e.response?.status, e.message) }

    // S4: findGroupInfos
    try {
        const res = await client.get(`/group/findGroupInfos/${EVO_INSTANCE}`, { params: { groupJid: jid } })
        if (res.data?.participants?.length) {
            res.data.participants = normalizeParticipants(res.data.participants)
            console.log('[API] getGroupInfo S4 OK')
            return res.data
        }
    } catch (e) { console.log('[API] S4:', e.response?.status, e.message) }

    // S5: findGroupByJid
    try {
        const res = await client.get(`/group/findGroupByJid/${EVO_INSTANCE}`, { params: { groupJid: jid } })
        if (res.data?.participants?.length) {
            res.data.participants = normalizeParticipants(res.data.participants)
            console.log('[API] getGroupInfo S5 OK')
            return res.data
        }
    } catch (e) { console.log('[API] S5:', e.response?.status, e.message) }

    console.log('[API] getGroupInfo ALL strategies failed for', jid)
    return null
}

// ── Get invite link — dedicated endpoint ──────────────────────
async function getGroupInviteCode(groupId) {
    const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`
    // Try v2 endpoint
    try {
        const res = await client.get(`/group/inviteCode/${EVO_INSTANCE}`, { params: { groupJid: jid } })
        return res.data?.inviteCode || res.data?.code || res.data?.invite || null
    } catch {}
    // Try inside group info
    try {
        const info = await getGroupInfo(jid)
        return info?.inviteCode || info?.invite || info?.code || null
    } catch {}
    return null
}

// ── Update group info (name/description) ─────────────────────
async function updateGroupInfo(groupId, data) {
    const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`
    // Try v2
    try {
        const res = await client.put(`/group/updateGroupInfo/${EVO_INSTANCE}`, { groupJid: jid, ...data })
        return res.data
    } catch {}
    // Try patch
    try {
        const res = await client.patch(`/group/updateGroupInfo/${EVO_INSTANCE}`, { groupJid: jid, ...data })
        return res.data
    } catch {}
    return null
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
async function sendSticker(chatId, url, quotedId = null) {
    const body = { number: formatNumber(chatId), mediatype: 'sticker', media: url }
    if (quotedId) body.quoted = { key: { id: quotedId } }
    return request('post', `/message/sendMedia/${EVO_INSTANCE}`, body)
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
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, { groupJid: groupId, action: 'add', participants })
}
async function removeGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, { groupJid: groupId, action: 'remove', participants })
}
async function promoteGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, { groupJid: groupId, action: 'promote', participants })
}
async function demoteGroupParticipants(groupId, participants) {
    return request('post', `/group/updateParticipant/${EVO_INSTANCE}`, { groupJid: groupId, action: 'demote', participants })
}
async function checkHealth() { return request('get', `/instance/connectionState/${EVO_INSTANCE}`) }
async function setWebhook(url) {
    return request('post', `/webhook/set/${EVO_INSTANCE}`, {
        url, enabled: true, events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE']
    })
}
async function updateBlockStatus(number, action) {
    return request('post', `/chat/updateBlockStatus/${EVO_INSTANCE}`, {
        number: formatNumber(number), status: action
    })
}

module.exports = {
    request, participantToNumber,
    sendText, sendImage, sendVideo, sendAudio, sendDocument, sendSticker,
    sendReaction, deleteMessage, markRead, sendTyping,
    getGroupInfo, getGroupInviteCode, updateGroupInfo,
    addGroupParticipants, removeGroupParticipants,
    promoteGroupParticipants, demoteGroupParticipants,
    checkHealth, setWebhook, updateBlockStatus,
}
