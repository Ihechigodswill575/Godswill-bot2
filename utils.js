'use strict'

const axios            = require('axios')
const { UNSPLASH_KEY } = require('./config')

const startTime = Date.now()

// ── Uptime ───────────────────────────────────────────────────
function getUptime() {
    const totalSecs = Math.floor((Date.now() - startTime) / 1000)
    const d = Math.floor(totalSecs / 86400)
    const h = Math.floor((totalSecs % 86400) / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

// ── AI (Pollinations — free) ─────────────────────────────────
async function askAI(prompt) {
    try {
        const res = await axios.get(
            `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
            { timeout: 30_000, headers: { Accept: 'text/plain' } }
        )
        return typeof res.data === 'string' ? res.data.trim() : 'No response from AI.'
    } catch {
        return '❌ AI is busy right now. Try again later!'
    }
}

// ── Image search — uses multiple fallbacks ───────────────────
async function searchImage(query) {
    try {
        // Try Unsplash with key first
        if (UNSPLASH_KEY) {
            const res = await axios.get('https://api.unsplash.com/search/photos', {
                params  : { query, per_page: 1, orientation: 'squarish' },
                headers : { Authorization: `Client-ID ${UNSPLASH_KEY}` },
                timeout : 10_000,
            })
            const url = res.data?.results?.[0]?.urls?.regular
            if (url) return url
        }
        // Fallback: Picsum (always works, random beautiful photos)
        const res = await axios.get(
            `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&client_id=AJNNMFe3yNIqDMNV0v3FiYLhpXjQGRQX0jYZ8FKXPGE`,
            { timeout: 8_000 }
        )
        if (res.data?.urls?.regular) return res.data.urls.regular
    } catch { }
    // Final fallback — Picsum random image
    return `https://picsum.photos/800/600?random=${Math.floor(Math.random()*1000)}`
}

// ── Reaction GIF (Nekos.best — free anime GIFs) ──────────────
async function getReactionGif(action) {
    try {
        const res = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 10_000 })
        return res.data?.results?.[0]?.url || null
    } catch {
        return null
    }
}

// ── Weather ──────────────────────────────────────────────────
async function getWeather(city) {
    try {
        const res = await axios.get(
            `https://wttr.in/${encodeURIComponent(city)}?format=4`,
            { timeout: 10_000 }
        )
        return res.data || null
    } catch {
        return null
    }
}

// ── Wikipedia ────────────────────────────────────────────────
async function getWiki(query) {
    try {
        const res = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
            { timeout: 10_000 }
        )
        return res.data?.extract || null
    } catch {
        return null
    }
}

// ── Joke ─────────────────────────────────────────────────────
async function getJoke() {
    try {
        const res = await axios.get(
            'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist&type=single',
            { timeout: 10_000 }
        )
        return res.data?.joke || '😂 Why did the bot cross the road? To get to the other side!'
    } catch {
        return '😂 Why did the bot cross the road? To get to the other side!'
    }
}

// ── Fun fact ─────────────────────────────────────────────────
async function getFunFact() {
    try {
        const res = await axios.get(
            'https://uselessfacts.jsph.pl/random.json?language=en',
            { timeout: 10_000 }
        )
        return res.data?.text || '🤔 Did you know? TAVIK BOT is the best bot ever!'
    } catch {
        return '🤔 Did you know? TAVIK BOT is the best bot ever!'
    }
}

// ── Advice ───────────────────────────────────────────────────
async function getAdvice() {
    try {
        const res = await axios.get('https://api.adviceslip.com/advice', { timeout: 10_000 })
        return res.data?.slip?.advice || '💡 Always be yourself!'
    } catch {
        return '💡 Always be yourself!'
    }
}

// ── Quote ────────────────────────────────────────────────────
async function getQuote() {
    try {
        const res = await axios.get('https://api.quotable.io/random', { timeout: 10_000 })
        return res.data ? `"${res.data.content}" — ${res.data.author}` : null
    } catch {
        return '"Success is not final, failure is not fatal." — Winston Churchill'
    }
}

// ── Meme ─────────────────────────────────────────────────────
async function getMeme() {
    try {
        const res = await axios.get('https://meme-api.com/gimme', { timeout: 10_000 })
        return res.data?.url || null
    } catch {
        return null
    }
}

// ── TikTok download ──────────────────────────────────────────
async function downloadTiktok(url) {
    try {
        const res = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 20_000 }
        )
        return res.data?.video?.noWatermark || res.data?.video?.cover || null
    } catch {
        return null
    }
}

module.exports = {
    getUptime,
    askAI,
    searchImage,
    getReactionGif,
    getWeather,
    getWiki,
    getJoke,
    getFunFact,
    getAdvice,
    getQuote,
    getMeme,
    downloadTiktok,
}
