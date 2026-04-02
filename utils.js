'use strict'

const axios     = require('axios')
const startTime = Date.now()
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function getUptime() {
    const s = Math.floor((Date.now() - startTime) / 1000)
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60), sec = s % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
}

// ── Groq — tries multiple models, never gives up ──────────────
function getGroqKeys() {
    return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3, process.env.GROQ_API_KEY_4].filter(Boolean)
}
let groqKeyIndex = 0
// llama-3.1-8b-instant is the BEST stable model — fast, updated, not deprecated
const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama3-8b-8192', 'gemma2-9b-it', 'mixtral-8x7b-32768']
const GROQ_BIG    = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it']

async function tryGroq(msgs, big) {
    const keys   = getGroqKeys()
    if (!keys.length) { console.error('[AI] GROQ_API_KEY not set!'); return null }
    const models = big ? GROQ_BIG : GROQ_MODELS
    for (const model of models) {
        for (let i = 0; i < keys.length; i++) {
            const idx = (groqKeyIndex + i) % keys.length
            try {
                const r = await axios.post('https://api.groq.com/openai/v1/chat/completions',
                    { model, messages: msgs, temperature: 0.7, max_tokens: 2048 },
                    { headers: { Authorization: `Bearer ${keys[idx]}`, 'Content-Type': 'application/json' }, timeout: 25_000 })
                const t = r.data?.choices?.[0]?.message?.content?.trim()
                if (t) { groqKeyIndex = (idx + 1) % keys.length; console.log(`[AI] Groq OK: ${model}`); return t }
            } catch (e) {
                const s = e.response?.status
                console.log(`[AI] Groq key${idx+1} ${model} → ${s}`)
                if (s === 500 || s === 503) break // bad model, try next
            }
        }
    }
    return null
}

async function askAI(prompt, system) {
    const msgs = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }]
    const r = await tryGroq(msgs)
    if (r) return r
    // Free fallback — Pollinations (no key needed)
    try {
        const res = await axios.post('https://text.pollinations.ai/',
            { messages: msgs, model: 'openai-large' }, { timeout: 30_000 })
        const t = res.data?.choices?.[0]?.message?.content?.trim() || (typeof res.data === 'string' ? res.data.trim() : null)
        if (t) return t
    } catch {}
    return '🤔 Please try again in a moment!'
}

async function askCodeAI(prompt) {
    return askAI(prompt, 'You are an expert programmer. Write clean, working, well-commented code with code blocks.')
}

async function createWebsite(description) {
    const system = 'You are a professional web developer. Create a complete beautiful single-file HTML page with embedded CSS+JS. Modern design, mobile-responsive, smooth animations. Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown, no backticks.'
    const msgs = [{ role: 'system', content: system }, { role: 'user', content: 'Create a website for: ' + description }]
    let html = await tryGroq(msgs, true)
    if (!html) {
        try {
            const r = await axios.post('https://text.pollinations.ai/', { messages: msgs, model: 'openai-large' }, { timeout: 45_000 })
            html = r.data?.choices?.[0]?.message?.content?.trim() || (typeof r.data === 'string' ? r.data.trim() : null)
        } catch {}
    }
    if (!html) return null
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    return html.toLowerCase().startsWith('<!') ? html : null
}

async function translateText(text, targetLang) {
    return askAI(`Translate to ${targetLang || 'English'}. Return ONLY the translation:\n\n${text}`)
}

// ── Image search ──────────────────────────────────────────────
async function searchImages(query, count) {
    count = count || 5
    const GKEY = process.env.GOOGLE_CSE_KEY || '', GCX = process.env.GOOGLE_CSE_ID || ''
    const candidates = []
    if (GKEY && GCX) {
        try {
            const r = await axios.get('https://www.googleapis.com/customsearch/v1',
                { params: { key: GKEY, cx: GCX, q: query, searchType: 'image', num: 10, safe: 'active' }, timeout: 15_000 })
            for (const i of r.data?.items || []) candidates.push(i.link)
        } catch {}
    }
    if (candidates.length < count) {
        try {
            const v = await axios.get('https://duckduckgo.com/', { params: { q: query, iax: 'images', ia: 'images' }, headers: { 'User-Agent': UA }, timeout: 10_000 })
            const m = v.data.match(/vqd=['"]([^'"]+)['"]/)
            if (m) {
                const r = await axios.get('https://duckduckgo.com/i.js',
                    { params: { q: query, o: 'json', vqd: m[1], f: ',,,,,', p: '1' }, headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' }, timeout: 12_000 })
                for (const img of r.data?.results || []) { if (img?.image?.startsWith('http')) candidates.push(img.image) }
            }
        } catch {}
    }
    if (candidates.length < count) {
        try {
            const r = await axios.get('https://www.bing.com/images/search',
                { params: { q: query, form: 'HDRSC2', first: '1', count: '20' }, headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout: 15_000 })
            for (const m of [...r.data.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g)]) candidates.push(decodeURIComponent(m[1]))
        } catch {}
    }
    const seen = new Set(), out = []
    for (const u of candidates) { if (!seen.has(u)) { seen.add(u); out.push(u) } if (out.length >= count) break }
    return out
}
async function searchImage(q) { return (await searchImages(q, 1))[0] || null }
async function upscaleImage(u) { return u }

async function getReactionGif(action) {
    try { const r = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 10_000 }); return r.data?.results?.[0]?.url || null } catch {}
    try { const r = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${action}`, { timeout: 10_000 }); return r.data?.url || null } catch {}
    return null
}
async function getCatImage() {
    try { const r = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 10_000 }); return r.data?.[0]?.url || null } catch { return null }
}
async function getDogImage() {
    try { const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 10_000 }); return r.data?.message || null } catch { return null }
}
async function getWeather(city) {
    try { const r = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=4`, { timeout: 10_000 }); return r.data || null } catch { return null }
}
async function getWiki(q) {
    try { const r = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { timeout: 10_000 }); return r.data?.extract || null } catch { return null }
}
async function getDictionary(word) {
    try {
        const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 10_000 })
        const e = r.data?.[0], m = e?.meanings?.[0]
        if (!e) return null
        return { word: e.word, phonetic: e.phonetic || '', partOfSpeech: m?.partOfSpeech || '', definition: m?.definitions?.[0]?.definition || '', example: m?.definitions?.[0]?.example || '' }
    } catch { return null }
}
function getQRCode(text) { return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}` }
function generatePassword(length) {
    length = length || 16
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
async function getJoke() {
    try { const r = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist&type=single', { timeout: 10_000 }); return r.data?.joke || null } catch { return "Why don't scientists trust atoms? They make up everything!" }
}
async function getDadJoke() {
    try { const r = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 10_000 }); return r.data?.joke || null } catch { return null }
}
async function getFunFact() {
    try { const r = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 10_000 }); return r.data?.text || null } catch { return 'Humans share 50% of their DNA with bananas!' }
}
async function getAdvice() {
    try { const r = await axios.get('https://api.adviceslip.com/advice', { timeout: 10_000 }); return r.data?.slip?.advice || null } catch { return 'Always be yourself!' }
}
async function getQuote() {
    try { const r = await axios.get('https://zenquotes.io/api/random', { timeout: 10_000 }); if (r.data?.[0]) return `"${r.data[0].q}"\n— _${r.data[0].a}_` } catch {}
    return '"The only way to do great work is to love what you do."\n— _Steve Jobs_'
}
async function getMeme() {
    try { const r = await axios.get('https://meme-api.com/gimme', { timeout: 10_000 }); return r.data?.url || null } catch { return null }
}
async function downloadTiktok(url) {
    try {
        const r = await axios.post('https://www.tikwm.com/api/', { url, hd: 1 }, { timeout: 20_000 })
        const d = r.data?.data; if (d?.hdplay) return d.hdplay; if (d?.play) return d.play
    } catch {}
    try {
        const r = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 20_000 })
        const v = r.data?.video; if (v?.noWatermark) return v.noWatermark; if (v?.cover) return v.cover
    } catch {}
    return null
}
async function getLyrics(query) {
    try {
        const r = await axios.get(`https://some-random-api.com/lyrics?title=${encodeURIComponent(query)}`, { timeout: 15_000 })
        if (r.data?.lyrics) return { title: r.data.title, artist: r.data.author, lyrics: r.data.lyrics }
    } catch {}
    const info = await askAI(`Tell me about the song "${query}": who made it, genre, what it is about. Keep it brief.`)
    return info ? { title: query, artist: '', lyrics: info } : null
}
async function shortenUrl(url) {
    try { const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10_000 }); return r.data || null } catch { return null }
}
function screenshotUrl(url) { return `https://image.thum.io/get/width/1280/crop/800/${encodeURIComponent(url)}` }

// ── Sticker conversion via WhatsApp-compatible API ────────────
async function imageToStickerUrl(imageUrl) {
    // Returns a URL that Evolution API can use to send as sticker
    // We use ezgif to convert, or return a direct webp conversion URL
    return `https://api.telegram.org/file/bot${imageUrl}` // placeholder — Evolution handles webp natively
}

// ── Text-to-image (for sticker/image commands) ────────────────
async function textToImageUrl(text, style) {
    style = style || 'realistic'
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?nologo=1&width=512&height=512`
}

// ── Movie info ────────────────────────────────────────────────
async function getMovieInfo(title) {
    try {
        const r = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=trilogy`, { timeout: 10_000 })
        if (r.data?.Response === 'True') return r.data
    } catch {}
    // Fallback: use AI
    return { Title: title, info: await askAI(`Give brief info about the movie/show "${title}": year, genre, plot, rating. Use emojis.`) }
}

// ── News ──────────────────────────────────────────────────────
async function getNews(topic) {
    try {
        const r = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(topic || 'world')}&lang=en&max=5&apikey=free`, { timeout: 15_000 })
        return r.data?.articles?.slice(0, 5) || []
    } catch {}
    try {
        const r = await axios.get(`https://newsdata.io/api/1/news?apikey=pub_free&q=${encodeURIComponent(topic || 'world')}&language=en&size=5`, { timeout: 15_000 })
        return r.data?.results?.slice(0, 5) || []
    } catch {}
    return []
}

// ── XP system ─────────────────────────────────────────────────
function addXP(state, number, name, amount) {
    amount = amount || 5
    if (!state.xpData) state.xpData = {}
    if (!state.xpData[number]) state.xpData[number] = { xp: 0, level: 1, name: name || number }
    state.xpData[number].xp += amount
    state.xpData[number].name = name || state.xpData[number].name
    const threshold = state.xpData[number].level * 100
    let leveled = false
    if (state.xpData[number].xp >= threshold) { state.xpData[number].level++; state.xpData[number].xp = 0; leveled = true }
    return { leveled, level: state.xpData[number].level }
}
function getLeaderboard(state, limit) {
    limit = limit || 10
    if (!state.xpData || !Object.keys(state.xpData).length) return null
    return Object.entries(state.xpData)
        .sort((a, b) => (b[1].level * 1000 + b[1].xp) - (a[1].level * 1000 + a[1].xp))
        .slice(0, limit).map((e, i) => `${i + 1}. @${e[0]} — Lvl ${e[1].level} (${e[1].xp} XP)`).join('\n')
}

// ── Trivia ────────────────────────────────────────────────────
async function getTriviaQuestion() {
    try {
        const r = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 10_000 })
        const q = r.data?.results?.[0]; if (!q) return null
        const opts = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
        return { question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'), options: opts, answer: q.correct_answer }
    } catch { return null }
}

// ── Instagram downloader ──────────────────────────────────────
async function downloadInstagram(url) {
    try {
        const r = await axios.get(`https://api.social-media-video-downloader.com/smvd/get/all?url=${encodeURIComponent(url)}`, { timeout: 20_000 })
        return r.data?.links?.[0]?.link || null
    } catch { return null }
}

// ── Facebook downloader ───────────────────────────────────────
async function downloadFacebook(url) {
    try {
        const r = await axios.get(`https://api.social-media-video-downloader.com/smvd/get/all?url=${encodeURIComponent(url)}`, { timeout: 20_000 })
        return r.data?.links?.[0]?.link || null
    } catch { return null }
}

// ── Spotify (metadata only — no download) ────────────────────
async function getSpotifyInfo(query) {
    // Use AI to get song info since Spotify needs OAuth
    return askAI(`Give details about the Spotify song/playlist "${query}": artist, album, year, genre, description.`)
}

// ── Text styles (fancy text) ──────────────────────────────────
function fancyText(text, style) {
    const maps = {
        bold   : s => s.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) < 91 ? c.charCodeAt(0) + 119743 : c.charCodeAt(0) + 119737)),
        italic : s => s.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) < 91 ? c.charCodeAt(0) + 119795 : c.charCodeAt(0) + 119789)),
        mono   : s => s.replace(/[a-z0-9A-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + (c >= 'a' ? 120257 - 97 : c >= 'A' ? 120263 - 65 : 120822 - 48))),
        bubble : s => [...s].map(c => { const n = c.charCodeAt(0); if (n >= 65 && n <= 90) return String.fromCodePoint(n + 9333); if (n >= 97 && n <= 122) return String.fromCodePoint(n + 9327); return c }).join(''),
    }
    return (maps[style] || maps.bold)(text)
}

module.exports = {
    getUptime, askAI, askCodeAI, createWebsite, translateText,
    searchImage, searchImages, upscaleImage,
    getReactionGif, getCatImage, getDogImage,
    getWeather, getWiki, getDictionary, getQRCode,
    generatePassword, getJoke, getDadJoke, getFunFact,
    getAdvice, getQuote, getMeme, downloadTiktok,
    getLyrics, shortenUrl, screenshotUrl,
    textToImageUrl, getMovieInfo, getNews,
    downloadInstagram, downloadFacebook, getSpotifyInfo, fancyText,
    addXP, getLeaderboard, getTriviaQuestion,
}
