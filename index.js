'use strict'

/**
 * ============================================================
 *  TAVIK BOT — index.js
 *  Author  : GODSWILL (TAVIK)
 *  Engine  : TAVIK TECH
 *  API     : Whapi.Cloud
 * ============================================================
 */

const express = require('express')
const api     = require('./api')
const { handleMessage } = require('./handler')
const { BOT_NAME, BOT_VERSION, OWNER_NAME } = require('./config')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: '10mb' }))

// ── Health check ─────────────────────────────────────────────
app.get('/', (_, res) => {
    res.json({
        bot     : `${BOT_NAME} ${BOT_VERSION}`,
        owner   : OWNER_NAME,
        engine  : 'TAVIK TECH',
        api     : 'Whapi.Cloud',
        status  : 'Running ✅',
    })
})

// ── Webhook — Whapi.Cloud posts here on every event ──────────
app.post('/webhook', async (req, res) => {
    // Always reply 200 immediately so Whapi doesn't retry
    res.sendStatus(200)

    try {
        const messages = req.body?.messages
        if (!Array.isArray(messages) || messages.length === 0) return
        for (const msg of messages) {
            await handleMessage(msg)
        }
    } catch (err) {
        console.error('[WEBHOOK]', err.message)
    }
})

// ── Boot ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`\n🚀 ${BOT_NAME} ${BOT_VERSION} starting...`)
    console.log(`   Owner  : ${OWNER_NAME}`)
    console.log(`   Engine : TAVIK TECH`)
    console.log(`   API    : Whapi.Cloud`)
    console.log(`   Port   : ${PORT}\n`)

    const health = await api.checkHealth()
    if (health) {
        console.log(`[WHAPI] Status: ${health.status?.connection || 'unknown'}`)
        console.log(`✅ ${BOT_NAME} is LIVE!\n`)
    } else {
        console.error('[WHAPI] ⚠️  Could not reach channel — check your WHAPI_TOKEN!')
    }

    console.log(`📌 Set your webhook URL in Whapi dashboard:`)
    console.log(`   https://YOUR-RAILWAY-URL.up.railway.app/webhook\n`)
})
