'use strict'

/**
 * ============================================================
 *  TAVIK BOT — state.js
 *  In-memory runtime state. Resets on bot restart.
 * ============================================================
 */

module.exports = {
    sudoUsers   : [],
    antiDelete  : {},
    autoreply   : {},
    antibadword : {},
    antilink    : {},
    antispam    : {},
    spamCount   : {},
    autoread    : false,
    autoreact   : false,
    autotyping  : false,
    floodActive : {},
    selfMode    : false,   // true = only owner can use bot
}
