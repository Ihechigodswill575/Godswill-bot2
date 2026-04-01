'use strict'

// OWNER_NUMBER in Railway env should be: 2341245688688
// (your personal number that controls the bot)
// The bot's own number (2347074130463) is the Evolution API instance number — NOT the owner
const rawOwners = process.env.OWNER_NUMBERS || process.env.OWNER_NUMBER || '2348145688688'
const OWNER_NUMBERS = rawOwners.split(',').map(n => n.replace(/[^0-9]/g, '').replace(/^0+/, ''))

module.exports = {
    BOT_NAME      : process.env.BOT_NAME   || 'TAVIK BOT',
    BOT_VERSION   : 'V3.0',
    OWNER_NAME    : process.env.OWNER_NAME || 'TAVIK(GODSWILL)',
    OWNER_NUMBER  : OWNER_NUMBERS[0],
    OWNER_NUMBERS,

    EVO_URL      : process.env.EVO_URL      || 'https://evolution-api-production-09bdd.up.railway.app',
    EVO_KEY      : process.env.EVO_KEY      || '57695a473ad9b3f8c0f7ffee6f15dee960f35f5fc18dd903d36276150a3c17b4',
    EVO_INSTANCE : process.env.EVO_INSTANCE || 'tavik-bot',

    PREFIX    : '.',
    BAD_WORDS : ['fuck', 'shit', 'bitch', 'bastard', 'idiot', 'stupid'],

    // Chatbot rate limit
    CHATBOT_RATE_LIMIT     : 20,
    CHATBOT_RATE_WINDOW_MS : 30_000,
}
