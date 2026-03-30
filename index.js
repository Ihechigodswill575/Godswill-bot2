'use strict'

const express = require('express')
const { handleMessage } = require('./handler')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, EVO_INSTANCE } = require('./config')

const app  = express()
const PORT = process.env.PORT || 8080

app.use(express.json({ limit: '50mb' }))

// ── Health check ──────────────────────────────────────────────
app.get('/', (_, res) => {
    res.json({
        bot      : `${BOT_NAME} ${BOT_VERSION}`,
        owner    : OWNER_NAME,
        engine   : 'TAVIK TECH',
        api      : 'Evolution API',
        instance : EVO_INSTANCE,
        status   : '✅ Running',
    })
})

// ── Webhook ───────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
    // Always respond 200 immediately
    res.sendStatus(200)

    try {
        const body = req.body
        if (!body) return

        const event = body.event || ''

        // Only process message events
        if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') return

        const data = body.data
        if (!data) return

        // Single message
        if (data.key) {
            await handleMessage(data)
        }
        // Array of messages
        else if (Array.isArray(data)) {
            for (const msg of data) {
                if (msg?.key) await handleMessage(msg)
            }
        }

    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message)
    }
})

// ── Boot ──────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════╗`)
    console.log(`║   🤖 ${BOT_NAME} ${BOT_VERSION}        ║`)
    console.log(`║   👑 ${OWNER_NAME}     ║`)
    console.log(`║   ⚡ TAVIK TECH             ║`)
    console.log(`╚════════════════════════════╝`)
    console.log(`\n✅ Bot is LIVE on port ${PORT}!`)
    console.log(`📌 Instance: ${EVO_INSTANCE}\n`)
})
