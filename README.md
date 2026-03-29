# ET AI Money Mentor

**Tagline: *"India's first AI financial advisor for the middle-class family — Tamil voice included"***

## Problem
95% of Indians have no financial plan. We fixed that with a multi-agent system that analyzes mutual fund portfolios and provides actionable, localized advice.

## Architecture
- **Backend Core**: Flask APIs processing CAMS mutual fund PDFs.
- **Agent 1 (Parser)**: PyMuPDF + Gemini 2.5 Flash extracts data into structured JSON.
- **Agent 2 (Math Engine)**: Calculates True XIRR using `scipy brentq` and aggregates expense drag / overlap warnings.
- **Agent 3 (Advisor)**: Gemini 2.5 Flash plans rebalancing, grades the portfolio, and defines FIRE timeline.
- **Agent 4 (Voice)**: `gTTS` generates a Tamil localized audio summary of the AI advice.
- **Frontend**: Vite + React modern web application with Recharts for visual insights.
- **WhatsApp Bot**: Node.js automated chat answering queries and providing comprehensive text reports.

## Local Setup

### 1. Backend
```bash
cd backend
pip install -r ../requirements.txt
# Set your Gemini API Key first
$env:GEMINI_KEY="your_api_key_here"
python app.py
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. WhatsApp Integration
Take the code snippet in `whatsapp-bot/bot.js` and inject it into your existing Twilio/WhatsApp webhook handlers to complete the loop!

---

## Market Impact Model
14 crore demat accounts × 30% active MF investors = 4.2 crore users
Average expense drag saved: ₹8,000/year
Average XIRR improvement via rebalancing: ₹4,000/year
Total per user: ₹12,000/year
Total market impact: 4.2 Cr × ₹12,000 = ₹50,400 Cr/year
