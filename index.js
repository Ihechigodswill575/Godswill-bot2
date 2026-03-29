'use strict'

const express = require('express')
const api     = require('./api')
const { handleMessage } = require('./handler')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, WHAPI_TOKEN, WHAPI_URL } = require('./config')

const app  = express()
const PORT = process.env.PORT || 8080

app.use(express.json({ limit: '10mb' }))

// ── Health check ─────────────────────────────────────────────
app.get('/', (_, res) => {
    res.json({
        bot    : `${BOT_NAME} ${BOT_VERSION}`,
        owner  : OWNER_NAME,
        engine : 'TAVIK TECH',
        api    : 'Whapi.Cloud',
        status : 'Running ✅',
    })
})

// ── Webhook ──────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
    res.sendStatus(200)
    try {
        const body = req.body
        if (!body) return
        const messages = body?.messages
        if (Array.isArray(messages) && messages.length > 0) {
            for (const msg of messages) {
                await handleMessage(msg)
            }
        }
    } catch (err) {
        console.error('[WEBHOOK]', err.message)
    }
})

// ── Boot ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 ${BOT_NAME} ${BOT_VERSION} starting...`)
    console.log(`   Owner  : ${OWNER_NAME}`)
    console.log(`   Engine : TAVIK TECH`)
    console.log(`   API    : Whapi.Cloud`)
    console.log(`   Port   : ${PORT}`)
    console.log(`   URL    : ${WHAPI_URL}`)
    console.log(`   Token  : ${WHAPI_TOKEN ? '✅ Set' : '❌ NOT SET!'}\n`)
    console.log(`✅ ${BOT_NAME} is LIVE and waiting for messages!`)
    console.log(`📌 Webhook: https://godswill-bot2-production.up.railway.app/webhook\n`)
})
