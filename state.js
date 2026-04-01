'use strict'

module.exports = {
    sudoUsers    : [],
    antiDelete   : {},
    autoreply    : {},
    antibadword  : {},
    antilink     : {},
    antispam     : {},
    spamCount    : {},
    chatbot      : {},    // { [chatId]: true/false }
    chatbotRate  : {},    // { [chatId]: { count, windowStart } }
    warnings     : {},
    autoread     : false,
    autoreact    : false,
    autotyping   : false,
    selfMode     : false,
    floodActive  : {},
    antiGhostPing: {},    // { [chatId]: true/false }
    welcome      : {},    // { [chatId]: { enabled, msg, byeMsg } }
    announce     : {},    // { [chatId]: true/false } — only admins can send
    trivia       : {},    // { [chatId]: { question, answer, active } }
    xpData       : {},    // { [number]: { xp, level, name } }
    polls        : {},    // { [chatId]: { question, options, votes } }
}
