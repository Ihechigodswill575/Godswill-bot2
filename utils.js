'use strict'

const axios = require('axios')
const { UNSPLASH_KEY } = require('./config')
const startTime = Date.now()

function getUptime() {
    const s = Math.floor((Date.now() - startTime) / 1000)
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60), sec = s % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
}

// ── AI with 3 fallbacks ───────────────────────────────────────
async function askAI(prompt, system = '') {
    const msgs = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }]

    // Provider 1: Pollinations POST
    try {
        const r = await axios.post('https://text.pollinations.ai/', {
            messages: msgs, model: 'openai', seed: Math.floor(Math.random() * 9999)
        }, { timeout: 25_000 })
        const t = r.data?.choices?.[0]?.message?.content?.trim()
        if (t) return t
    } catch {}

    // Provider 2: Pollinations GET
    try {
        const r = await axios.get(
            `https://text.pollinations.ai/${encodeURIComponent(system ? `${system}\n\n${prompt}` : prompt)}`,
            { timeout: 20_000, headers: { Accept: 'text/plain' } }
        )
        const t = typeof r.data === 'string' ? r.data.trim() : ''
        if (t) return t
    } catch {}

    // Provider 3: OpenRouter free
    try {
        const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'mistralai/mistral-7b-instruct:free', messages: msgs
        }, {
            headers: { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://tavik-bot.app' },
            timeout: 25_000,
        })
        const t = r.data?.choices?.[0]?.message?.content?.trim()
        if (t) return t
    } catch {}

    return '❌ AI is busy right now. Try again in a moment!'
}

async function askCodeAI(prompt) {
    return askAI(prompt, 'You are an expert programmer. Write clean, working, well-commented code. Be concise and practical. Format code with proper indentation.')
}

async function createWebsite(description) {
    return askAI(description, 'You are a professional web developer. Create a complete, beautiful, single-file HTML page with embedded CSS and JavaScript based on the description. Return ONLY the raw HTML code. No explanation, no markdown, no backticks.')
}

// ── Image search — Unsplash only (proper search) ──────────────
async function searchImage(query) {
    // Try Unsplash with key
    if (UNSPLASH_KEY) {
        try {
            const r = await axios.get('https://api.unsplash.com/search/photos', {
                params: { query, per_page: 20, orientation: 'squarish' },
                headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
                timeout: 10_000,
            })
            const results = r.data?.results || []
            if (results.length) return results[Math.floor(Math.random() * Math.min(results.length, 10))].urls?.regular
        } catch {}
    }

    // Try Unsplash without key (public endpoint)
    try {
        const r = await axios.get(`https://source.unsplash.com/featured/800x600/?${encodeURIComponent(query)}`, {
            timeout: 10_000, maxRedirects: 5
        })
        if (r.request?.res?.responseUrl) return r.request.res.responseUrl
    } catch {}

    // Fallback: themed Picsum with seed from query
    const seed = query.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return `https://picsum.photos/seed/${seed}/800/600`
}

// ── Reaction GIFs (nekos.best) ────────────────────────────────
async function getReactionGif(action) {
    try {
        const r = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 10_000 })
        return r.data?.results?.[0]?.url || null
    } catch { return null }
}

// ── Animal images ─────────────────────────────────────────────
async function getCatImage() {
    try {
        const r = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 8_000 })
        return r.data?.[0]?.url || null
    } catch { return null }
}

async function getDogImage() {
    try {
        const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 8_000 })
        return r.data?.message || null
    } catch { return null }
}

// ── Weather ───────────────────────────────────────────────────
async function getWeather(city) {
    try {
        const r = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=4`, { timeout: 10_000 })
        return r.data || null
    } catch { return null }
}

// ── Wikipedia ─────────────────────────────────────────────────
async function getWiki(query) {
    try {
        const r = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
            { timeout: 10_000 }
        )
        return r.data?.extract || null
    } catch { return null }
}

// ── Dictionary ────────────────────────────────────────────────
async function getDictionary(word) {
    try {
        const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 10_000 })
        const e = r.data?.[0], m = e?.meanings?.[0]
        if (!e) return null
        return {
            word: e.word, phonetic: e.phonetic || '',
            partOfSpeech: m?.partOfSpeech || '',
            definition: m?.definitions?.[0]?.definition || '',
            example: m?.definitions?.[0]?.example || '',
        }
    } catch { return null }
}

// ── QR Code ───────────────────────────────────────────────────
function getQRCode(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`
}

// ── Password generator ────────────────────────────────────────
function generatePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Joke ──────────────────────────────────────────────────────
async function getJoke() {
    try {
        const r = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist&type=single', { timeout: 10_000 })
        return r.data?.joke || null
    } catch { return '😂 Why did the programmer quit? Because they didn\'t get arrays!' }
}

async function getDadJoke() {
    try {
        const r = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 10_000 })
        return r.data?.joke || null
    } catch { return null }
}

// ── Fun fact ──────────────────────────────────────────────────
async function getFunFact() {
    try {
        const r = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 10_000 })
        return r.data?.text || null
    } catch { return '🤔 The average person walks about 100,000 miles in their lifetime!' }
}

// ── Advice & Quote ────────────────────────────────────────────
async function getAdvice() {
    try {
        const r = await axios.get('https://api.adviceslip.com/advice', { timeout: 10_000 })
        return r.data?.slip?.advice || null
    } catch { return '💡 Always be yourself!' }
}

async function getQuote() {
    try {
        const r = await axios.get('https://api.quotable.io/random', { timeout: 10_000 })
        return r.data ? `"${r.data.content}"\n— _${r.data.author}_` : null
    } catch { return '"The only way to do great work is to love what you do."\n— _Steve Jobs_' }
}

// ── Meme ──────────────────────────────────────────────────────
async function getMeme() {
    try {
        const r = await axios.get('https://meme-api.com/gimme', { timeout: 10_000 })
        return r.data?.url || null
    } catch { return null }
}

// ── TikTok download (2 providers) ────────────────────────────
async function downloadTiktok(url) {
    try {
        const r = await axios.post('https://www.tikwm.com/api/', { url, hd: 1 }, { timeout: 20_000 })
        const d = r.data?.data
        if (d?.hdplay) return d.hdplay
        if (d?.play) return d.play
    } catch {}
    try {
        const r = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 20_000 })
        const v = r.data?.video
        if (v?.noWatermark) return v.noWatermark
        if (v?.cover) return v.cover
    } catch {}
    return null
}

module.exports = {
    getUptime, askAI, askCodeAI, createWebsite,
    searchImage, getReactionGif, getCatImage, getDogImage,
    getWeather, getWiki, getDictionary, getQRCode,
    generatePassword, getJoke, getDadJoke, getFunFact,
    getAdvice, getQuote, getMeme, downloadTiktok,
}
