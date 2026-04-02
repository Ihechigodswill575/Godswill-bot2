'use strict'

// ══════════════════════════════════════════════════════════════
//  OWNER CONFIG
//  OWNER_NUMBERS = comma-separated list of owner phone numbers
//  These numbers have FULL control over the bot
//
//  Owner 1: 2348145688688  (main owner - TAVIK)
//  Owner 2: 2349165569672  (second owner - RICHARD)
//
//  BOT number = The Evolution API instance number (+234 703 513 7872)
//  → This is NOT an owner. NEVER put the bot number here.
// ══════════════════════════════════════════════════════════════

const rawOwners = process.env.OWNER_NUMBERS || process.env.OWNER_NUMBER || '2348145688688,2349165569672'
const OWNER_NUMBERS = rawOwners.split(',').map(n => n.replace(/[^0-9]/g, '').replace(/^0+/, '')).filter(Boolean)

module.exports = {
    BOT_NAME      : process.env.BOT_NAME   || 'RICHARD BOT',
    BOT_VERSION   : 'V3.0',
    OWNER_NAME    : process.env.OWNER_NAME || 'TAVIK',
    OWNER_NUMBER  : OWNER_NUMBERS[0],
    OWNER_NUMBERS,

    EVO_URL      : process.env.EVO_URL      || 'https://evolution-api-production-09bdd.up.railway.app',
    EVO_KEY      : process.env.EVO_KEY      || '57695a473ad9b3f8c0f7ffee6f15dee960f35f5fc18dd903d36276150a3c17b4',
    EVO_INSTANCE : process.env.EVO_INSTANCE || '2347035137872',

    PREFIX    : '.',
    BAD_WORDS : ['fuck', 'shit', 'bitch', 'bastard', 'idiot', 'stupid'],

    // Chatbot rate limit — set high so Groq is never blocked
    CHATBOT_RATE_LIMIT     : 100,
    CHATBOT_RATE_WINDOW_MS : 60_000,
}
