'use strict'
module.exports = {
    sudoUsers    : [],
    antiDelete   : {},
    autoreply    : {},
    antibadword  : {},
    antilink     : {},
    antispam     : {},
    antifake     : {},   // antifake numbers (non-real numbers)
    spamCount    : {},
    chatbot      : {},
    chatbotRate  : {},
    warnings     : {},
    autoread     : false,
    autoreact    : false,
    autotyping   : false,
    selfMode     : false,
    floodActive  : {},
    antiGhostPing: {},
    welcome      : {},   // { [chatId]: { enabled, msg, byeMsg } }
    announce     : {},   // mute — only admins send
    trivia       : {},
    xpData       : {},
    polls        : {},
    afkUsers     : {},   // { [number]: { reason, time } }
    filters      : {},   // { [chatId]: { [keyword]: response } }
    reminders    : [],   // [{ number, text, time }]
    greetings    : {},   // { [number]: customGreeting }
    msgCount     : {},   // { [chatId]: { [number]: count } }
}
