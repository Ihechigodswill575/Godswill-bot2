'use strict'

module.exports = {
    sudoUsers   : [],
    antiDelete  : {},
    autoreply   : {},
    antibadword : {},
    antilink    : {},
    antispam    : {},
    spamCount   : {},
    chatbot     : {},    // { [chatId]: true/false } — works in DMs and GCs
    chatbotRate : {},    // { [chatId]: { count, windowStart } } — rate limiting
    warnings    : {},
    autoread    : false,
    autoreact   : false,
    autotyping  : false,
    selfMode    : false,
    floodActive : {},
}
