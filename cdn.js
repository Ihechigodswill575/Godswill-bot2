'use strict'

/**
 * ============================================================
 *  TAVIK BOT — cdn.js
 *  Unified media helper: upload, download, CDN hosting
 *  Replaces: Tavikcdn.js + catbox.js
 * ============================================================
 */

const axios    = require('axios')
const FormData = require('form-data')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// ── Download a URL as a Buffer ───────────────────────────────
async function getBuffer(url) {
    try {
        const res = await axios.get(url, {
            responseType : 'arraybuffer',
            timeout      : 20_000,
            headers      : { 'User-Agent': UA },
        })
        return Buffer.from(res.data)
    } catch {
        return null
    }
}

// ── Upload a Buffer to Catbox.moe (free CDN) ─────────────────
async function upload(buffer, filename = 'file.jpg', mimetype = 'image/jpeg') {
    try {
        const form = new FormData()
        form.append('reqtype', 'fileupload')
        form.append('fileToUpload', buffer, { filename, contentType: mimetype })
        const res = await axios.post('https://catbox.moe/user/api.php', form, {
            headers : form.getHeaders(),
            timeout : 30_000,
        })
        return res.data?.trim() || null
    } catch (e) {
        console.error('[CDN] Upload error:', e.message)
        return null
    }
}

// ── Upload a URL directly to Catbox (no download needed) ─────
async function uploadFromUrl(url) {
    try {
        const form = new FormData()
        form.append('reqtype', 'urlupload')
        form.append('url', url)
        const res = await axios.post('https://catbox.moe/user/api.php', form, {
            headers : form.getHeaders(),
            timeout : 30_000,
        })
        return res.data?.trim() || null
    } catch {
        return null
    }
}

// ── Upload a video Buffer to Catbox ──────────────────────────
async function uploadVideo(buffer, filename = 'video.mp4') {
    return upload(buffer, filename, 'video/mp4')
}

module.exports = { getBuffer, upload, uploadFromUrl, uploadVideo }
