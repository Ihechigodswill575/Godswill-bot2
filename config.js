'use strict'

module.exports = {
    BOT_NAME      : process.env.BOT_NAME      || 'TAVIK BOT',
    BOT_VERSION   : 'V2.0',
    OWNER_NAME    : process.env.OWNER_NAME    || 'TAVIK(GODSWILL)',
    OWNER_NUMBER  : process.env.OWNER_NUMBER  || '2348145688688',

    // Evolution API settings
    EVO_URL       : process.env.EVO_URL       || 'https://evolution-api-production-09bdd.up.railway.app',
    EVO_KEY       : process.env.EVO_KEY       || '57695a473ad9b3f8c0f7ffee6f15dee960f35f5fc18dd903d36276150a3c17b4',
    EVO_INSTANCE  : process.env.EVO_INSTANCE  || 'tavik-bot',

    // Keep Whapi as fallback
    WHAPI_TOKEN   : process.env.WHAPI_TOKEN   || '',
    WHAPI_URL     : process.env.WHAPI_URL     || 'https://gate.whapi.cloud',

    UNSPLASH_KEY  : process.env.UNSPLASH_KEY  || '',
    PREFIX        : '.',
    BAD_WORDS     : ['fuck', 'shit', 'bitch', 'bastard', 'idiot', 'stupid'],
}
