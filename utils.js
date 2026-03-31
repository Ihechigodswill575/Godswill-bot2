'use strict'

const axios            = require('axios')
const { UNSPLASH_KEY } = require('./config')

const startTime = Date.now()

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

// ── AI with 3 fallback providers ─────────────────────────────
async function askAI(prompt, systemPrompt = '') {
    const providers = [
        // Provider 1: Pollinations
        async () => {
            const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt
            const res = await axios.get(
                `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`,
                { timeout: 20_000, headers: { Accept: 'text/plain' } }
            )
            const text = typeof res.data === 'string' ? res.data.trim() : ''
            if (!text) throw new Error('empty')
            return text
        },
        // Provider 2: Pollinations with POST
        async () => {
            const res = await axios.post('https://text.pollinations.ai/', {
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
                model: 'openai',
                seed: Math.floor(Math.random() * 1000),
            }, { timeout: 25_000 })
            const text = res.data?.choices?.[0]?.message?.content?.trim() || ''
            if (!text) throw new Error('empty')
            return text
        },
        // Provider 3: Openrouter (free tier)
        async () => {
            const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: 'mistralai/mistral-7b-instruct:free',
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
            }, {
                headers: { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://tavik-bot.railway.app' },
                timeout: 25_000,
            })
            const text = res.data?.choices?.[0]?.message?.content?.trim() || ''
            if (!text) throw new Error('empty')
            return text
        },
    ]

    for (const provider of providers) {
        try {
            return await provider()
        } catch { continue }
    }
    return '❌ AI is unavailable right now. Try again later!'
}

// ── Code AI ──────────────────────────────────────────────────
async function askCodeAI(prompt) {
    return askAI(prompt,
        'You are an expert programmer. Write clean, working code. Be concise. Include brief comments. Format code properly.')
}

// ── Website creator ───────────────────────────────────────────
async function createWebsite(description) {
    return askAI(description,
        'You are a web developer. Create a complete single-file HTML website with inline CSS and JS based on the description. Return ONLY the HTML code, nothing else.')
}

// ── Image search with multiple fallbacks ─────────────────────
async function searchImage(query) {
    // Try 1: Unsplash API with key
    if (UNSPLASH_KEY) {
        try {
            const res = await axios.get('https://api.unsplash.com/search/photos', {
                params: { query, per_page: 10, orientation: 'squarish' },
                headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
                timeout: 8_000,
            })
            const results = res.data?.results || []
            if (results.length) {
                const pick = results[Math.floor(Math.random() * results.length)]
                return pick.urls?.regular || null
            }
        } catch { }
    }

    // Try 2: DuckDuckGo image search scrape
    try {
        const res = await axios.get(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images&format=json`,
            { timeout: 8_000 }
        )
        const results = res.data?.Results || []
        if (results.length) return results[0].Icon?.URL || null
    } catch { }

    // Try 3: Picsum (beautiful random photos — always works)
    return `https://picsum.photos/seed/${encodeURIComponent(query)}/800/600`
}

// ── Reaction GIF (Nekos.best) ─────────────────────────────────
async function getReactionGif(action) {
    try {
        const res = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 10_000 })
        return res.data?.results?.[0]?.url || null
    } catch { return null }
}

// ── Animal images ─────────────────────────────────────────────
async function getCatImage() {
    try {
        const res = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 8_000 })
        return res.data?.[0]?.url || null
    } catch { return null }
}

async function getDogImage() {
    try {
        const res = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 8_000 })
        return res.data?.message || null
    } catch { return null }
}

// ── Weather ───────────────────────────────────────────────────
async function getWeather(city) {
    try {
        const res = await axios.get(
            `https://wttr.in/${encodeURIComponent(city)}?format=4`,
            { timeout: 10_000 }
        )
        return res.data || null
    } catch { return null }
}

// ── Wikipedia ─────────────────────────────────────────────────
async function getWiki(query) {
    try {
        const res = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
            { timeout: 10_000 }
        )
        return res.data?.extract || null
    } catch { return null }
}

// ── Dictionary ────────────────────────────────────────────────
async function getDictionary(word) {
    try {
        const res = await axios.get(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
            { timeout: 10_000 }
        )
        const entry = res.data?.[0]
        if (!entry) return null
        const meaning = entry.meanings?.[0]
        return {
            word: entry.word,
            phonetic: entry.phonetic || '',
            partOfSpeech: meaning?.partOfSpeech || '',
            definition: meaning?.definitions?.[0]?.definition || '',
            example: meaning?.definitions?.[0]?.example || '',
        }
    } catch { return null }
}

// ── QR Code ───────────────────────────────────────────────────
async function getQRCode(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`
}

// ── Joke ──────────────────────────────────────────────────────
async function getJoke() {
    try {
        const res = await axios.get(
            'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist&type=single',
            { timeout: 10_000 }
        )
        return res.data?.joke || null
    } catch { return '😂 Why did the bot cross the road? To get to the other side!' }
}

// ── Dad joke ──────────────────────────────────────────────────
async function getDadJoke() {
    try {
        const res = await axios.get('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json' },
            timeout: 10_000,
        })
        return res.data?.joke || null
    } catch { return null }
}

// ── Fun fact ──────────────────────────────────────────────────
async function getFunFact() {
    try {
        const res = await axios.get(
            'https://uselessfacts.jsph.pl/random.json?language=en',
            { timeout: 10_000 }
        )
        return res.data?.text || null
    } catch { return '🤔 Did you know? TAVIK BOT is the best bot ever!' }
}

// ── Advice ────────────────────────────────────────────────────
async function getAdvice() {
    try {
        const res = await axios.get('https://api.adviceslip.com/advice', { timeout: 10_000 })
        return res.data?.slip?.advice || null
    } catch { return '💡 Always be yourself!' }
}

// ── Quote ─────────────────────────────────────────────────────
async function getQuote() {
    try {
        const res = await axios.get('https://api.quotable.io/random', { timeout: 10_000 })
        return res.data ? `"${res.data.content}" — ${res.data.author}` : null
    } catch { return '"Success is not final, failure is not fatal." — Winston Churchill' }
}

// ── Meme ──────────────────────────────────────────────────────
async function getMeme() {
    try {
        const res = await axios.get('https://meme-api.com/gimme', { timeout: 10_000 })
        return res.data?.url || null
    } catch { return null }
}

// ── TikTok download ───────────────────────────────────────────
async function downloadTiktok(url) {
    // Try provider 1
    try {
        const res = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 20_000 }
        )
        const videoUrl = res.data?.video?.noWatermark || res.data?.video?.cover
        if (videoUrl) return videoUrl
    } catch { }
    // Try provider 2
    try {
        const res = await axios.post('https://www.tikwm.com/api/', { url }, { timeout: 20_000 })
        if (res.data?.data?.play) return res.data.data.play
    } catch { }
    return null
}

// ── Password generator ────────────────────────────────────────
function generatePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Upscale image ─────────────────────────────────────────────
async function upscaleImage(imageUrl) {
    try {
        // Use let's enhance free API
        const res = await axios.post('https://deep-image.ai/rest_api/process_result', {
            url: imageUrl,
            width: 'x2',
        }, {
            headers: { 'x-api-key': 'free' },
            timeout: 30_000,
        })
        return res.data?.result_url || null
    } catch { }
    // Fallback: just return a higher-res version hint
    return null
}

module.exports = {
    getUptime, askAI, askCodeAI, createWebsite,
    searchImage, getReactionGif, getCatImage, getDogImage,
    getWeather, getWiki, getDictionary, getQRCode,
    getJoke, getDadJoke, getFunFact, getAdvice, getQuote,
    getMeme, downloadTiktok, generatePassword, upscaleImage,
}
