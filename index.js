'use strict'

const express = require('express')
const { handleMessage } = require('./handler')
const { BOT_NAME, BOT_VERSION, OWNER_NAME, EVO_URL, EVO_INSTANCE } = require('./config')

const app  = express()
const PORT = process.env.PORT || 8080

app.use(express.json({ limit: '50mb' }))

// ── Health check ─────────────────────────────────────────────
app.get('/', (_, res) => {
    res.json({
        bot    : `${BOT_NAME} ${BOT_VERSION}`,
        owner  : OWNER_NAME,
        engine : 'TAVIK TECH',
        api    : 'Evolution API',
        status : 'Running ✅',
    })
})

// ── Webhook ───────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
    res.sendStatus(200)
    try {
        const body = req.body
        if (!body) return

        const event = body.event || ''
        console.log(`[WEBHOOK] Event: ${event}`)

        // Only handle messages.upsert
        if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
            const data = body.data
            if (!data) return

            // Evolution API wraps single message in data object
            if (data.key) {
                await handleMessage(data)
            }
            // Or array of messages
            else if (Array.isArray(data)) {
                for (const msg of data) {
                    if (msg?.key) await handleMessage(msg)
                }
            }
        }

    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message)
    }
})

// ── Boot ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 ${BOT_NAME} ${BOT_VERSION} started!`)
    console.log(`   Owner    : ${OWNER_NAME}`)
    console.log(`   API      : Evolution API`)
    console.log(`   Instance : ${EVO_INSTANCE}`)
    console.log(`   Port     : ${PORT}\n`)
    console.log(`✅ ${BOT_NAME} is LIVE and ready!\n`)
})
