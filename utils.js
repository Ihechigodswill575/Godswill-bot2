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

// ── Groq keys ─────────────────────────────────────────────────
function getGroqKeys() {
    return [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3,
        process.env.GROQ_API_KEY_4,
    ].filter(Boolean)
}

let groqKeyIndex = 0

// Models tried in order — all free on Groq
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
]

async function tryGroq(msgs, preferModel) {
    const keys = getGroqKeys()
    if (!keys.length) {
        console.error('[AI] GROQ_API_KEY is not set in Railway env vars!')
        return null
    }
    const models = preferModel ? [preferModel, ...GROQ_MODELS.filter(m => m !== preferModel)] : GROQ_MODELS
    for (const model of models) {
        for (let attempt = 0; attempt < keys.length; attempt++) {
            const idx = (groqKeyIndex + attempt) % keys.length
            const key = keys[idx]
            try {
                const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model,
                    messages   : msgs,
                    temperature: 0.7,
                    max_tokens : 2048,
                }, {
                    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                    timeout: 25_000,
                })
                const t = r.data?.choices?.[0]?.message?.content?.trim()
                if (t) {
                    groqKeyIndex = (idx + 1) % keys.length
                    console.log(`[AI] Groq OK: model=${model} key=${idx+1}`)
                    return t
                }
            } catch (e) {
                const status = e.response?.status
                const msg    = e.response?.data?.error?.message || e.message
                console.log(`[AI] Groq key=${idx+1} model=${model} status=${status} err=${msg}`)
                // 401/403 = bad key, skip key; 429 = rate limit, try next key; 503/500 try next model
                if (status === 503 || status === 500) break // try next model
            }
        }
    }
    return null
}

// ── Main AI — Groq primary, minimal fallback ──────────────────
async function askAI(prompt, system) {
    system = system || ''
    const msgs = []
    if (system) msgs.push({ role: 'system', content: system })
    msgs.push({ role: 'user', content: prompt })

    // Groq first (multiple keys + models)
    const groqResult = await tryGroq(msgs)
    if (groqResult) return groqResult

    // Last resort: Pollinations (completely free, no key needed)
    try {
        const r = await axios.post('https://text.pollinations.ai/', {
            messages: msgs, model: 'openai-large',
        }, { timeout: 30_000 })
        const t = r.data?.choices?.[0]?.message?.content?.trim()
            || (typeof r.data === 'string' && r.data.trim() ? r.data.trim() : null)
        if (t) { console.log('[AI] Fallback: Pollinations'); return t }
    } catch (e) { console.log('[AI] Pollinations failed:', e.message) }

    // If everything fails, return a useful message (not "AI unavailable")
    return '🤔 I\'m having trouble connecting right now. Please try again in a few seconds!'
}

async function askCodeAI(prompt) {
    return askAI(prompt,
        'You are an expert programmer. Write clean, working, well-commented code. Be concise. Use code blocks with language tags.')
}

// createWebsite uses 70b for best HTML quality
async function createWebsite(description) {
    const system = [
        'You are a professional full-stack web developer.',
        'Create a complete, beautiful, FULLY FUNCTIONAL single-file HTML page with embedded CSS and JavaScript.',
        '- Modern design with gradients, animations, glassmorphism or clean card layouts',
        '- Mobile-responsive with proper viewport meta tag',
        '- All functionality works without external dependencies',
        '- Use Google Fonts CDN for fonts',
        '- Smooth transitions and hover effects',
        'Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown. No backticks. No explanation.',
    ].join('\n')

    const msgs = [
        { role: 'system', content: system },
        { role: 'user',   content: 'Create a website for: ' + description },
    ]

    let html = await tryGroq(msgs, 'llama-3.3-70b-versatile')
    if (!html) html = await tryGroq(msgs, 'llama3-70b-8192')
    if (!html) {
        try {
            const r = await axios.post('https://text.pollinations.ai/', {
                messages: msgs, model: 'openai-large',
            }, { timeout: 45_000 })
            html = r.data?.choices?.[0]?.message?.content?.trim()
                || (typeof r.data === 'string' ? r.data.trim() : null)
        } catch {}
    }
    if (!html) return null
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    if (!html.toLowerCase().startsWith('<!')) return null
    return html
}

async function translateText(text, targetLang) {
    targetLang = targetLang || 'English'
    return askAI(
        `Translate the following text to ${targetLang}. Return ONLY the translated text, no explanation:\n\n${text}`)
}

// ── Image search ──────────────────────────────────────────────
async function searchImages(query, count) {
    count = count || 5
    const GOOGLE_KEY = process.env.GOOGLE_CSE_KEY || ''
    const GOOGLE_CX  = process.env.GOOGLE_CSE_ID  || ''
    const candidates = []

    if (GOOGLE_KEY && GOOGLE_CX) {
        try {
            const r = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: { key: GOOGLE_KEY, cx: GOOGLE_CX, q: query, searchType: 'image', num: 10, safe: 'active' },
                timeout: 15_000,
            })
            for (const item of r.data?.items || []) candidates.push(item.link)
        } catch {}
    }

    if (candidates.length < count) {
        try {
            const vqdRes = await axios.get('https://duckduckgo.com/', {
                params: { q: query, iax: 'images', ia: 'images' },
                headers: { 'User-Agent': UA }, timeout: 10_000,
            })
            const vqdMatch = vqdRes.data.match(/vqd=['"]([^'"]+)['"]/)
            if (vqdMatch) {
                const imgRes = await axios.get('https://duckduckgo.com/i.js', {
                    params: { q: query, o: 'json', vqd: vqdMatch[1], f: ',,,,,', p: '1' },
                    headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' },
                    timeout: 12_000,
                })
                for (const img of imgRes.data?.results || []) {
                    if (candidates.length >= count * 3) break
                    if (img?.image?.startsWith('http')) candidates.push(img.image)
                }
            }
        } catch {}
    }

    if (candidates.length < count) {
        try {
            const r = await axios.get('https://www.bing.com/images/search', {
                params: { q: query, form: 'HDRSC2', first: '1', count: '20' },
                headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
                timeout: 15_000,
            })
            const matches = [...r.data.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g)]
            for (const m of matches) {
                if (candidates.length >= count * 3) break
                candidates.push(decodeURIComponent(m[1]))
            }
        } catch {}
    }

    const unique = [], seen = new Set()
    for (const url of candidates) {
        if (!seen.has(url)) { seen.add(url); unique.push(url) }
        if (unique.length >= count) break
    }
    return unique
}

async function searchImage(query) {
    const r = await searchImages(query, 1)
    return r[0] || null
}

async function upscaleImage(imageUrl) { return imageUrl }

async function getReactionGif(action) {
    try {
        const r = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 10_000 })
        return r.data?.results?.[0]?.url || null
    } catch {}
    try {
        const r = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${action}`, { timeout: 10_000 })
        return r.data?.url || null
    } catch {}
    return null
}

async function getCatImage() {
    try {
        const r = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 10_000 })
        return r.data?.[0]?.url || null
    } catch { return null }
}

async function getDogImage() {
    try {
        const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 10_000 })
        return r.data?.message || null
    } catch { return null }
}

async function getWeather(city) {
    try {
        const r = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=4`, { timeout: 10_000 })
        return r.data || null
    } catch { return null }
}

async function getWiki(query) {
    try {
        const r = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
            { timeout: 10_000 })
        return r.data?.extract || null
    } catch { return null }
}

async function getDictionary(word) {
    try {
        const r = await axios.get(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
            { timeout: 10_000 })
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

function getQRCode(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`
}

function generatePassword(length) {
    length = length || 16
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function getJoke() {
    try {
        const r = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist&type=single', { timeout: 10_000 })
        return r.data?.joke || null
    } catch { return "Why don't scientists trust atoms? Because they make up everything!" }
}

async function getDadJoke() {
    try {
        const r = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 10_000 })
        return r.data?.joke || null
    } catch { return null }
}

async function getFunFact() {
    try {
        const r = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 10_000 })
        return r.data?.text || null
    } catch { return 'The average person walks about 100,000 miles in their lifetime!' }
}

async function getAdvice() {
    try {
        const r = await axios.get('https://api.adviceslip.com/advice', { timeout: 10_000 })
        return r.data?.slip?.advice || null
    } catch { return 'Always be yourself!' }
}

async function getQuote() {
    try {
        const r = await axios.get('https://zenquotes.io/api/random', { timeout: 10_000 })
        if (r.data?.[0]) return `"${r.data[0].q}"\n— _${r.data[0].a}_`
    } catch {}
    return '"The only way to do great work is to love what you do."\n— _Steve Jobs_'
}

async function getMeme() {
    try {
        const r = await axios.get('https://meme-api.com/gimme', { timeout: 10_000 })
        return r.data?.url || null
    } catch { return null }
}

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

async function getLyrics(query) {
    try {
        const r = await axios.get(`https://some-random-api.com/lyrics?title=${encodeURIComponent(query)}`, { timeout: 15_000 })
        if (r.data?.lyrics) return { title: r.data.title, artist: r.data.author, lyrics: r.data.lyrics }
    } catch {}
    const info = await askAI(`Give info about the song "${query}": artist, genre, and what it's about. Keep it short.`)
    return info ? { title: query, artist: '', lyrics: info } : null
}

async function shortenUrl(url) {
    try {
        const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10_000 })
        return r.data || null
    } catch { return null }
}

function screenshotUrl(url) {
    return `https://image.thum.io/get/width/1280/crop/800/${encodeURIComponent(url)}`
}

// ── XP / Level system ─────────────────────────────────────────
function addXP(state, number, name, amount) {
    amount = amount || 5
    if (!state.xpData) state.xpData = {}
    if (!state.xpData[number]) state.xpData[number] = { xp: 0, level: 1, name: name || number }
    state.xpData[number].xp  += amount
    state.xpData[number].name = name || state.xpData[number].name
    const threshold = state.xpData[number].level * 100
    let leveled = false
    if (state.xpData[number].xp >= threshold) {
        state.xpData[number].level++
        state.xpData[number].xp = 0
        leveled = true
    }
    return { leveled, level: state.xpData[number].level }
}

function getLeaderboard(state, limit) {
    limit = limit || 10
    if (!state.xpData || !Object.keys(state.xpData).length) return null
    return Object.entries(state.xpData)
        .sort((a, b) => (b[1].level * 1000 + b[1].xp) - (a[1].level * 1000 + a[1].xp))
        .slice(0, limit)
        .map((e, i) => `${i + 1}. @${e[0]} — Lvl ${e[1].level} (${e[1].xp} XP)`)
        .join('\n')
}

async function getTriviaQuestion() {
    try {
        const r = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 10_000 })
        const q = r.data?.results?.[0]
        if (!q) return null
        const opts = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
        return {
            question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
            options : opts,
            answer  : q.correct_answer,
        }
    } catch { return null }
}

module.exports = {
    getUptime, askAI, askCodeAI, createWebsite,
    translateText,
    searchImage, searchImages, upscaleImage,
    getReactionGif, getCatImage, getDogImage,
    getWeather, getWiki, getDictionary, getQRCode,
    generatePassword, getJoke, getDadJoke, getFunFact,
    getAdvice, getQuote, getMeme, downloadTiktok,
    getLyrics, shortenUrl, screenshotUrl,
    addXP, getLeaderboard, getTriviaQuestion,
}
