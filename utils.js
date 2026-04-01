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

// ── Groq key rotation — never hits rate limit ─────────────────
// HOW IT WORKS:
//   1. Set GROQ_API_KEY in Railway (your main key)
//   2. Optionally set GROQ_API_KEY_2, GROQ_API_KEY_3, GROQ_API_KEY_4 for more keys
//   3. Bot rotates through all keys automatically so you NEVER hit rate limit
//   4. If one key fails, it silently tries the next one
//   5. If ALL Groq keys fail, it tries 3 free fallback providers
// Get free Groq keys at: https://console.groq.com (free, takes 1 minute)
function getGroqKeys() {
    const keys = [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3,
        process.env.GROQ_API_KEY_4,
    ].filter(Boolean)
    return keys
}

// Tracks which key to use next (round-robin rotation)
let groqKeyIndex = 0

async function tryGroq(msgs) {
    const keys = getGroqKeys()
    if (!keys.length) return null

    // Try each key starting from groqKeyIndex (round-robin)
    for (let attempt = 0; attempt < keys.length; attempt++) {
        const idx = (groqKeyIndex + attempt) % keys.length
        const key = keys[idx]
        try {
            const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model      : 'llama3-8b-8192',
                messages   : msgs,
                temperature: 0.7,
                max_tokens : 1024,
            }, {
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                timeout: 18_000,
            })
            const t = r.data?.choices?.[0]?.message?.content?.trim()
            if (t) {
                // Move to next key for next request (rotation)
                groqKeyIndex = (idx + 1) % keys.length
                return t
            }
        } catch (e) {
            const status = e.response?.status
            console.log(`[AI] Groq key ${idx + 1} error: ${e.message} (status: ${status})`)
            // On rate limit (429) or server error (500/503), try next key immediately
            // On auth error (401/403), skip this key permanently for this request
            continue
        }
    }
    return null
}

// ── Main AI function — Groq first, 3 free fallbacks ──────────
async function askAI(prompt, system = '') {
    const msgs = [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
    ]

    // ── Provider 1: Groq (MAIN — fastest, free, always first) ─
    const groqResult = await tryGroq(msgs)
    if (groqResult) return groqResult

    // ── Provider 2: Pollinations POST (free, no key needed) ───
    try {
        const r = await axios.post('https://text.pollinations.ai/', {
            messages: msgs, model: 'openai', seed: Math.floor(Math.random() * 9999),
        }, { timeout: 25_000 })
        const t = r.data?.choices?.[0]?.message?.content?.trim()
        if (t) { console.log('[AI] Used fallback: Pollinations POST'); return t }
    } catch {}

    // ── Provider 3: Pollinations GET (free, no key needed) ────
    try {
        const r = await axios.get(
            `https://text.pollinations.ai/${encodeURIComponent(system ? `${system}\n\n${prompt}` : prompt)}`,
            { timeout: 20_000, headers: { Accept: 'text/plain' } }
        )
        const t = typeof r.data === 'string' ? r.data.trim() : ''
        if (t) { console.log('[AI] Used fallback: Pollinations GET'); return t }
    } catch {}

    // ── Provider 4: OpenRouter free model ─────────────────────
    try {
        const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'mistralai/mistral-7b-instruct:free', messages: msgs,
        }, {
            headers: { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://tavik.app' },
            timeout: 25_000,
        })
        const t = r.data?.choices?.[0]?.message?.content?.trim()
        if (t) { console.log('[AI] Used fallback: OpenRouter'); return t }
    } catch {}

    // ── All providers failed ───────────────────────────────────
    console.log('[AI] All providers failed')
    return '❌ AI is unavailable right now. Please try again in a few seconds!'
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
    if (!html || !html.trim().toLowerCase().startsWith('<!')) return null
    return html
}

// ── Image search ──────────────────────────────────────────────
async function searchImages(query, count = 5) {
    const GOOGLE_KEY = process.env.GOOGLE_CSE_KEY  || ''
    const GOOGLE_CX  = process.env.GOOGLE_CSE_ID   || ''
    const candidates = []

    // Source A: Google Custom Search
    if (GOOGLE_KEY && GOOGLE_CX) {
        try {
            const r = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: { key: GOOGLE_KEY, cx: GOOGLE_CX, q: query, searchType: 'image', num: 10, safe: 'active' },
                timeout: 15_000,
            })
            for (const item of r.data?.items || []) {
                candidates.push({ url: item.link, title: item.title || '', source: item.displayLink || '' })
            }
        } catch (e) { console.log('[PINT] Google CSE error:', e.message) }
    }

    // Source B: DuckDuckGo
    if (candidates.length < count * 3) {
        try {
            const vqdRes = await axios.get('https://duckduckgo.com/', {
                params: { q: query, iax: 'images', ia: 'images' },
                headers: { 'User-Agent': UA },
                timeout: 10_000,
            })
            const vqdMatch = vqdRes.data.match(/vqd=['"]([^'"]+)['"]/)
            if (vqdMatch) {
                const imgRes = await axios.get('https://duckduckgo.com/i.js', {
                    params: { q: query, o: 'json', vqd: vqdMatch[1], f: ',,,,,', p: '1' },
                    headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' },
                    timeout: 12_000,
                })
                for (const img of imgRes.data?.results || []) {
                    if (candidates.length >= count * 4) break
                    if (img?.image && img.image.startsWith('http'))
                        candidates.push({ url: img.image, title: img.title || '', source: img.url || '' })
                }
            }
        } catch {}
    }

    // Source C: Bing scrape
    if (candidates.length < count * 3) {
        try {
            const r = await axios.get('https://www.bing.com/images/search', {
                params: { q: query, form: 'HDRSC2', first: '1', count: '20' },
                headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
                timeout: 15_000,
            })
            const murlMatches  = [...r.data.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g)]
            const titleMatches = [...r.data.matchAll(/t2&quot;:&quot;([^&"]+)&quot;/g)]
            murlMatches.forEach((m, i) => {
                if (candidates.length >= count * 4) return
                const url   = decodeURIComponent(m[1])
                const title = titleMatches[i] ? decodeURIComponent(titleMatches[i][1]) : ''
                if (url.startsWith('http')) candidates.push({ url, title, source: 'bing' })
            })
        } catch {}
    }

    if (!candidates.length) return []

    // Groq AI verifies images are relevant
    const groqKeys = getGroqKeys()
    if (groqKeys.length) {
        try {
            const list = candidates.slice(0, 20).map((c, i) =>
                `${i + 1}. URL: ${c.url}\n   Title: ${c.title}\n   Source: ${c.source}`
            ).join('\n\n')

            const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama3-8b-8192',
                messages: [{
                    role: 'system',
                    content: 'You are a strict image relevance checker. Given a search query and image candidates (URL, title, source domain), return ONLY the index numbers of images that are clearly and accurately about the query. Reject anything vague, unrelated, or generic. Return a JSON array of numbers only like [1,3,5]. No explanation.',
                }, {
                    role: 'user',
                    content: `Search query: "${query}"\n\nCandidates:\n${list}`,
                }],
                temperature: 0,
                max_tokens: 100,
            }, {
                headers: { Authorization: `Bearer ${groqKeys[0]}`, 'Content-Type': 'application/json' },
                timeout: 15_000,
            })

            const raw   = r.data?.choices?.[0]?.message?.content?.trim() || '[]'
            const match = raw.match(/\[[\d,\s]+\]/)
            if (match) {
                const approved = JSON.parse(match[0])
                const verified = approved.map(n => candidates[n - 1]).filter(Boolean).map(c => c.url).slice(0, count)
                if (verified.length > 0) return verified
            }
        } catch (e) { console.log('[PINT] Groq verification error:', e.message) }
    }

    return candidates.slice(0, count).map(c => c.url)
}

async function upscaleImage(imageUrl) {
    try {
        const r = await axios.get('https://api.waifu2x.udp.jp/api', {
            params: { style: 'photo', noise: 1, scale: 2, url: imageUrl },
            timeout: 30_000,
            responseType: 'arraybuffer',
        })
        if (r.status === 200 && r.data?.byteLength > 1000) {
            const b64 = Buffer.from(r.data).toString('base64')
            return `data:image/png;base64,${b64}`
        }
    } catch {}

    try {
        const r = await axios.post('https://techzbots1-image-enhancer.hf.space/run/predict', {
            data: [imageUrl, 2]
        }, { timeout: 40_000 })
        const out = r.data?.data?.[0]
        if (out && out.startsWith('http')) return out
    } catch {}

    return null
}

async function searchImage(query) {
    const imgs = await searchImages(query, 1)
    return imgs[0] || null
}

async function getReactionGif(action) {
    try {
        const r = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 10_000 })
        return r.data?.results?.[0]?.url || null
    } catch { return null }
}

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
            { timeout: 10_000 }
        )
        return r.data?.extract || null
    } catch { return null }
}

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

function getQRCode(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`
}

function generatePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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

async function getFunFact() {
    try {
        const r = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 10_000 })
        return r.data?.text || null
    } catch { return '🤔 The average person walks about 100,000 miles in their lifetime!' }
}

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

module.exports = {
    getUptime, askAI, askCodeAI, createWebsite,
    searchImage, searchImages, upscaleImage,
    getReactionGif, getCatImage, getDogImage,
    getWeather, getWiki, getDictionary, getQRCode,
    generatePassword, getJoke, getDadJoke, getFunFact,
    getAdvice, getQuote, getMeme, downloadTiktok,
}
