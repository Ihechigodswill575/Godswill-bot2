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
const { BOT_NAME, BOT_VERSION, OWNER_NAME, WHAPI_TOKEN, WHAPI_URL } = require('./config')

const app  = express()
const PORT = process.env.PORT || 8080

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
    res.sendStatus(200)
    try {
        const body = req.body
        if (!body) return

        // Handle messages
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
app.listen(PORT, async () => {
    console.log(`\n🚀 ${BOT_NAME} ${BOT_VERSION} starting...`)
    console.log(`   Owner  : ${OWNER_NAME}`)
    console.log(`   Engine : TAVIK TECH`)
    console.log(`   API    : Whapi.Cloud`)
    console.log(`   Port   : ${PORT}`)
    console.log(`   URL    : ${WHAPI_URL}`)
    console.log(`   Token  : ${WHAPI_TOKEN ? WHAPI_TOKEN.substring(0, 8) + '...' : 'NOT SET!'}\n`)

    // Try to connect to Whapi
    let retries = 0
    const maxRetries = 3

    const tryConnect = async () => {
        const health = await api.checkHealth()
        if (health) {
            console.log(`✅ ${BOT_NAME} is LIVE!`)
            console.log(`[WHAPI] Status: ${JSON.stringify(health?.status || health)}\n`)
        } else {
            retries++
            if (retries < maxRetries) {
                console.log(`⚠️ Connection attempt ${retries}/${maxRetries} failed. Retrying in 5s...`)
                setTimeout(tryConnect, 5000)
            } else {
                console.error(`❌ Could not connect to Whapi after ${maxRetries} attempts!`)
                console.error(`   Check WHAPI_TOKEN and WHAPI_URL in Railway Variables`)
                console.log(`\n📌 Your webhook URL:`)
                console.log(`   https://godswill-bot2-production.up.railway.app/webhook\n`)
            }
        }
    }

    await tryConnect()
})
