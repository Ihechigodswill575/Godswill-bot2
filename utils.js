'use strict'

/**
 * ============================================================
 *  TAVIK BOT — utils.js
 *  All external API calls and utility helpers
 * ============================================================
 */

const axios           = require('axios')
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

// ── AI (Pollinations — free, no key needed) ──────────────────
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

// ── Image search (Unsplash) ──────────────────────────────────
async function searchImage(query) {
    try {
        if (UNSPLASH_KEY && UNSPLASH_KEY !== '') {
            const res = await axios.get('https://api.unsplash.com/search/photos', {
                params  : { query, per_page: 1 },
                headers : { Authorization: `Client-ID ${UNSPLASH_KEY}` },
                timeout : 10_000,
            })
            const results = res.data?.results
            if (results?.length > 0) return results[0].urls.regular
        }
        // Fallback — no API key needed
        return `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`
    } catch {
        return `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`
    }
}

// ── Image upscale (DeepAI) ───────────────────────────────────
async function upscaleImage(buffer) {
    try {
        const FormData = require('form-data')
        const cdn      = require('./cdn')
        const form     = new FormData()
        form.append('image', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
        const res = await axios.post('https://api.deepai.org/api/torch-srgan', form, {
            headers : { ...form.getHeaders(), 'api-key': 'quickstart-QUdJIGlzIGZ1bg' },
            timeout : 30_000,
        })
        const url = res.data?.output_url
        if (!url) return null
        return cdn.getBuffer(url)
    } catch {
        return null
    }
}

// ── Weather (wttr.in — no key needed) ───────────────────────
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

// ── Joke (JokeAPI — no key needed) ──────────────────────────
async function getJoke() {
    try {
        const res = await axios.get(
            'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist&type=single',
            { timeout: 10_000 }
        )
        return res.data?.joke || null
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
        return res.data?.text || null
    } catch {
        return '🤔 Did you know? TAVIK BOT is the best bot ever!'
    }
}

// ── Advice ───────────────────────────────────────────────────
async function getAdvice() {
    try {
        const res = await axios.get('https://api.adviceslip.com/advice', { timeout: 10_000 })
        return res.data?.slip?.advice || null
    } catch {
        return '💡 Always be yourself!'
    }
}

// ── Quote ────────────────────────────────────────────────────
async function getQuote() {
    try {
        const res = await axios.get('https://api.quotable.io/random', { timeout: 10_000 })
        return res.data
            ? `"${res.data.content}" — ${res.data.author}`
            : null
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
    upscaleImage,
    getWeather,
    getWiki,
    getJoke,
    getFunFact,
    getAdvice,
    getQuote,
    getMeme,
    downloadTiktok,
}
