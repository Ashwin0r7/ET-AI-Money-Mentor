require('dotenv').config({ path: '../.env' });

const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const twilio = require('twilio');

// ── CREDENTIALS (loaded securely from .env) ─────────────────────
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(express.urlencoded({ extended: true }));

const { MessagingResponse } = twilio.twiml;
const BACKEND_URL = 'http://localhost:5000/analyze';

// Helper: send a WhatsApp message (handles 1600 char limit)
async function sendMsg(from, to, body) {
    // Twilio WhatsApp limit is 1600 chars
    if (body.length <= 1500) {
        await twilioClient.messages.create({ from, to, body });
    } else {
        // Split into chunks at newlines
        const lines = body.split('\n');
        let chunk = '';
        for (const line of lines) {
            if ((chunk + '\n' + line).length > 1400) {
                await twilioClient.messages.create({ from, to, body: chunk.trim() });
                chunk = line;
            } else {
                chunk += '\n' + line;
            }
        }
        if (chunk.trim()) {
            await twilioClient.messages.create({ from, to, body: chunk.trim() });
        }
    }
}

app.post('/whatsapp', async (req, res) => {
    const twiml = new MessagingResponse();
    const mediaUrl = req.body.MediaUrl0;
    const from = req.body.From;
    const to = req.body.To;

    if (!mediaUrl) {
        twiml.message("Hello! I am *ET AI Money Mentor*.\n\nSend me your CAMS Mutual Fund PDF and I will analyze it instantly!");
        return res.type('text/xml').send(twiml.toString());
    }

    // Reply IMMEDIATELY so Twilio doesn't time out
    twiml.message("Received your PDF! Analyzing with 4 AI agents... Please wait ~30 seconds.");
    res.type('text/xml').send(twiml.toString());

    // Process in background
    (async () => {
        try {
            console.log("[BOT] Downloading PDF...");

            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN }
            });

            console.log("[BOT] PDF downloaded:", response.data.length, "bytes");

            const form = new FormData();
            form.append('pdf', Buffer.from(response.data), {
                filename: 'statement.pdf',
                contentType: 'application/pdf'
            });

            console.log("[BOT] Sending to Flask...");

            const flaskRes = await axios.post(BACKEND_URL, form, {
                headers: { ...form.getHeaders() },
                timeout: 120000
            });

            const r = flaskRes.data;
            if (r.error) {
                await sendMsg(to, from, "Analysis error: " + r.error);
                return;
            }

            const rec = r.ai_recommendation;
            const math = r.math;

            // ── MESSAGE 1: English Report ───────────────────────
            const english = `*ET AI Money Mentor Report*\n\n` +
                `*Health Score:* ${rec.health_score}/100 (${rec.health_grade})\n` +
                `*Invested:* Rs.${(math.total_invested/100000).toFixed(1)}L\n` +
                `*Current Value:* Rs.${(math.total_current_value/100000).toFixed(1)}L\n` +
                `*XIRR:* ${math.xirr_percent}%\n` +
                `*Fee Drain:* Rs.${Math.round(math.annual_expense_drag_inr)}/yr\n\n` +
                `*Top Issues:*\n${rec.top_issues.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n` +
                `*Action Steps:*\n${rec.recommendations.map((x,i)=>`${i+1}. ${x}`).join('\n')}`;

            await sendMsg(to, from, english);

            // ── MESSAGE 2: Tamil Summary ────────────────────────
            const tamil = rec.tamil_summary;
            if (tamil) {
                const tamilMsg = `*தமிழ் சுருக்கம் (Tamil Summary):*\n\n${tamil}`;
                await sendMsg(to, from, tamilMsg);
            }

            console.log("[BOT] Report sent in English + Tamil!");

        } catch (error) {
            console.error("[BOT] Request Error!");
            let errMsg = error.message;
            if (error.response && error.response.data && error.response.data.error) {
                errMsg = error.response.data.error;
            } else if (error.response && error.response.data) {
                errMsg = JSON.stringify(error.response.data).slice(0, 200);
            }
            console.error("[BOT] Actual Error:", errMsg);
            
            try {
                await sendMsg(to, from, "Sorry, error analyzing the PDF. Reason: " + errMsg);
            } catch (e) {
                console.error("[BOT] Failed to send error msg:", e.message);
            }
        }
    })();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`[BOT] WhatsApp Bot running on port ${PORT}`);
    console.log(`[BOT] Twilio SID: ${TWILIO_ACCOUNT_SID ? 'Loaded' : 'MISSING!'}`);
    console.log(`[BOT] Auth Token: ${TWILIO_AUTH_TOKEN ? 'Loaded' : 'MISSING!'}`);
    console.log(`[BOT] Expose with: npx ngrok http ${PORT}`);
});
