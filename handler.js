'use strict'

const axios     = require('axios')
const startTime = Date.now()

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function getUptime() {
    const s   = Math.floor((Date.now() - startTime) / 1000)
    const d   = Math.floor(s / 86400)
    const h   = Math.floor((s % 86400) / 3600)
    const m   = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
}

// ── AI with 3 fallbacks ───────────────────────────────────────
async function askAI(prompt, system = '') {
    const msgs = [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
    ]

    // Provider 1: Pollinations POST
    try {
        const r = await axios.post('https://text.pollinations.ai/', {
            messages: msgs, model: 'openai', seed: Math.floor(Math.random() * 9999),
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
            model: 'mistralai/mistral-7b-instruct:free', messages: msgs,
        }, {
            headers: { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://tavik.app' },
            timeout: 25_000,
        })
        const t = r.data?.choices?.[0]?.message?.content?.trim()
        if (t) return t
    } catch {}

    return '❌ AI is busy right now. Try again in a moment!'
}

async function askCodeAI(prompt) {
    return askAI(prompt, 'You are an expert programmer. Write clean, working, well-commented code. Be concise and practical.')
}

async function createWebsite(description) {
    const system = [
        'You are a professional full-stack web developer.',
        'Create a complete, beautiful, FULLY FUNCTIONAL single-file HTML page with embedded CSS and JavaScript.',
        'Requirements:',
        '- Modern design with gradients, animations, glassmorphism or clean card layouts',
        '- Mobile-responsive with proper viewport meta tag',
        '- All functionality working without external dependencies',
        '- Clean, professional fonts (use Google Fonts CDN)',
        '- Smooth transitions and hover effects',
        'Return ONLY raw HTML. No markdown. No backticks. No explanation. Just the HTML file.',
    ].join('\n')
    const html = await askAI(description, system)
    // Validate it looks like HTML
    if (!html || !html.trim().toLowerCase().startsWith('<!')) return null
    return html
}

// ── Image search — 5 results from multiple free sources ───────
// Sources: DuckDuckGo images, Pixabay, Pexels (no key needed paths), Lorem Picsum seeds
async function searchImages(query, count = 5) {
    const results = []

    // Source 1: DuckDuckGo image search (scrape the vqd token + results)
    try {
        const vqdRes = await axios.get(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
            headers: { 'User-Agent': UA }, timeout: 10_000,
        })
        const vqdMatch = vqdRes.data.match(/vqd=['"]([^'"]+)['"]/)
        if (vqdMatch) {
            const imgRes = await axios.get('https://duckduckgo.com/i.js', {
                params: { q: query, o: 'json', vqd: vqdMatch[1], f: ',,,,,', p: '1' },
                headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' },
                timeout: 12_000,
            })
            const imgs = imgRes.data?.results || []
            for (const img of imgs.slice(0, 10)) {
                if (results.length >= count) break
                if (img?.image && img.image.startsWith('http')) results.push(img.image)
            }
        }
    } catch {}

    // Source 2: Pixabay free (no key for low-res)
    if (results.length < count) {
        try {
            const r = await axios.get('https://pixabay.com/api/', {
                params: {
                    key: '44268846-e08c3b90e3c1af79e7882ee6e',
                    q: query, image_type: 'photo', per_page: 10, safesearch: 'true',
                },
                timeout: 10_000,
            })
            const hits = r.data?.hits || []
            for (const h of hits) {
                if (results.length >= count) break
                if (h.webformatURL) results.push(h.webformatURL)
            }
        } catch {}
    }

    // Source 3: Pexels (free public API key for non-commercial)
    if (results.length < count) {
        try {
            const r = await axios.get('https://api.pexels.com/v1/search', {
                params: { query, per_page: 10 },
                headers: { Authorization: 'yVOSmRzuA6VTBB1RKpnFaMKhHkmxSqlVDv3KnSHxIriuyCXQjJbCMbOe' },
                timeout: 10_000,
            })
            const photos = r.data?.photos || []
            for (const p of photos) {
                if (results.length >= count) break
                if (p?.src?.medium) results.push(p.src.medium)
            }
        } catch {}
    }

    // Source 4: Seeded Picsum fallback (always works)
    if (results.length < count) {
        const seed = query.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
        while (results.length < count) {
            results.push(`https://picsum.photos/seed/${seed + results.length}/800/600`)
        }
    }

    // Deduplicate
    return [...new Set(results)].slice(0, count)
}

// Legacy single-image helper used by .pint
async function searchImage(query) {
    const imgs = await searchImages(query, 1)
    return imgs[0] || null
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
            word        : e.word,
            phonetic    : e.phonetic || '',
            partOfSpeech: m?.partOfSpeech || '',
            definition  : m?.definitions?.[0]?.definition || '',
            example     : m?.definitions?.[0]?.example || '',
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
    } catch { return "😂 Why don't scientists trust atoms? Because they make up everything!" }
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

// ── TikTok download ───────────────────────────────────────────
async function downloadTiktok(url) {
    try {
        const r = await axios.post('https://www.tikwm.com/api/', { url, hd: 1 }, { timeout: 20_000 })
        const d = r.data?.data
        if (d?.hdplay) return d.hdplay
        if (d?.play)   return d.play
    } catch {}
    try {
        const r = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 20_000 })
        const v = r.data?.video
        if (v?.noWatermark) return v.noWatermark
        if (v?.cover)       return v.cover
    } catch {}
    return null
}

module.exports = {
    getUptime, askAI, askCodeAI, createWebsite,
    searchImage, searchImages,
    getReactionGif, getCatImage, getDogImage,
    getWeather, getWiki, getDictionary, getQRCode,
    generatePassword, getJoke, getDadJoke, getFunFact,
    getAdvice, getQuote, getMeme, downloadTiktok,
}
