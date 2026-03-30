'use strict'

const express = require('express')
const { handleMessage } = require('./handler')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, EVO_URL, EVO_KEY, EVO_INSTANCE } = require('./config')

const app  = express()
const PORT = process.env.PORT || 8080

app.use(express.json({ limit: '50mb' }))

// ── Health check ─────────────────────────────────────────────
app.get('/', (_, res) => {
    res.json({
        bot      : `${BOT_NAME} ${BOT_VERSION}`,
        owner    : OWNER_NAME,
        engine   : 'TAVIK TECH',
        api      : 'Evolution API',
        status   : 'Running ✅',
    })
})

// ── Webhook for Evolution API ─────────────────────────────────
app.post('/webhook', async (req, res) => {
    res.sendStatus(200)
    try {
        const body = req.body
        if (!body) return

        // Log incoming for debugging
        console.log('[WEBHOOK]', JSON.stringify(body).substring(0, 300))

        const event = body.event || body.type || ''

        // Handle message events
        if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
            const messages = body.data?.messages || body.messages || []
            for (const msg of messages) {
                if (msg) await handleMessage(msg)
            }
        }

        // Direct message object
        else if (body.data?.key || body.key) {
            await handleMessage(body.data || body)
        }

        // Array of messages
        else if (Array.isArray(body.messages)) {
            for (const msg of body.messages) {
                if (msg) await handleMessage(msg)
            }
        }

        // Single message
        else if (body.message || body.text) {
            await handleMessage(body)
        }

    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message)
    }
})

// ── Boot ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 ${BOT_NAME} ${BOT_VERSION} starting...`)
    console.log(`   Owner    : ${OWNER_NAME}`)
    console.log(`   Engine   : TAVIK TECH`)
    console.log(`   API      : Evolution API`)
    console.log(`   Port     : ${PORT}`)
    console.log(`   Evo URL  : ${EVO_URL}`)
    console.log(`   Instance : ${EVO_INSTANCE}\n`)
    console.log(`✅ ${BOT_NAME} is LIVE!`)
    console.log(`📌 Webhook: https://godswill-bot2-production.up.railway.app/webhook\n`)
})
