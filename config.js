'use strict'

/**
 * ============================================================
 *  TAVIK BOT — config.js
 *  All configuration lives here. Use Railway env vars in prod.
 * ============================================================
 */

module.exports = {
    BOT_NAME      : process.env.BOT_NAME      || 'TAVIK BOT',
    BOT_VERSION   : 'V2.0',
    OWNER_NAME    : process.env.OWNER_NAME    || 'TAVIK(GODSWILL)',
    OWNER_NUMBER  : process.env.OWNER_NUMBER  || '2348145688688',
    WHAPI_TOKEN   : process.env.WHAPI_TOKEN   || 'N7NxCOF3mfQSIiA8xufCr9TJ8jH1lYB0',
    WHAPI_URL     : process.env.WHAPI_URL     || 'https://gate.whapi.cloud',
    UNSPLASH_KEY  : process.env.UNSPLASH_KEY  || '',
    PREFIX        : '.',
    BAD_WORDS     : ['fuck', 'shit', 'bitch', 'bastard', 'idiot', 'stupid'],
}
