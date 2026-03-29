from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv(dotenv_path='../.env')
import fitz
import json
import pandas as pd
import numpy as np
from scipy.optimize import brentq
from datetime import datetime
from google import genai
from gtts import gTTS
from deep_translator import GoogleTranslator
import pygame, io, os, logging, threading

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("MentorAI")

GEMINI_API_KEY = os.environ.get("GEMINI_KEY")
if not GEMINI_API_KEY:
    log.warning("GEMINI_KEY not found in environment! Set it in .env")
client = genai.Client(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "gemini-2.5-flash"


import re

def scrub_pii(raw_text):
    """Instantly scrubs high-risk PII before sending to AI."""
    # 1. Mask Indian PAN Cards (5 letters, 4 numbers, 1 letter)
    text = re.sub(r'[A-Z]{5}[0-9]{4}[A-Z]{1}', 'XXXXX9999X', raw_text)
    # 2. Mask Phone Numbers (10+ digits)
    text = re.sub(r'\b\d{10}\b', 'XXXXXXXXXX', text)
    # 3. Mask Email Addresses
    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL_HIDDEN]', text)
    return text

# ── AGENT 1: PDF PARSER ──────────────────────────────────────────
def agent_parse(pdf_bytes):
    log.info("[Agent 1] Parsing & Scrubbing PII from PDF...")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    raw_text = "".join(p.get_text() for p in doc)
    text = scrub_pii(raw_text)

    prompt = f"""
You are a CAMS mutual fund statement parser.
Extract ALL fund holdings from the text below.
Return ONLY a valid JSON array, no markdown, no explanation.
Each item must have these exact keys:
fund_name, folio, units, nav, current_value, invested_amount, purchase_date (YYYY-MM-DD), category

TEXT:
{text[:9000]}
"""
    r = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = r.text.strip().removeprefix("```json").removesuffix("```").strip()
    holdings = json.loads(raw)
    log.info(f"[Agent 1] Found {len(holdings)} holdings")
    return holdings


# ── AGENT 2: MATH ENGINE ─────────────────────────────────────────
def agent_math(holdings):
    log.info("[Agent 2] Running financial calculations...")

    total_inv = sum((h.get("invested_amount") or 0) for h in holdings)
    total_cur = sum((h.get("current_value") or 0) for h in holdings)
    gain = total_cur - total_inv

    # True XIRR using scipy brentq (correct method)
    def xirr_calc(cashflows):
        # cashflows = list of (days_from_start, amount)
        if not cashflows:
            return 0.0
        def npv(rate):
            return sum(cf[1] / ((1 + rate) ** (cf[0] / 365.0))
                       for cf in cashflows)
        try:
            return brentq(npv, -0.999, 100.0)
        except Exception:
            return (gain / total_inv) if total_inv else 0

    today = datetime.today()
    flows = []
    for h in holdings:
        try:
            d = datetime.strptime(h["purchase_date"], "%Y-%m-%d")
            days = (today - d).days
            flows.append((days, -h["invested_amount"]))
        except Exception:
            pass
    if total_cur > 0:
        flows.append((0, total_cur))

    xirr_val = xirr_calc(flows) * 100

    # Expense drag by category
    exp_map = {"Equity": 1.5, "ELSS": 1.8, "Debt": 0.5,
               "Hybrid": 1.2, "Index": 0.2, "ETF": 0.1}
    drag_detail, total_drag = [], 0
    for h in holdings:
        er = exp_map.get(h.get("category", "Equity"), 1.5)
        cost = ((h.get("current_value") or 0) * er) / 100
        total_drag += cost
        drag_detail.append({"fund": h.get("fund_name", "Unknown Fund"),
                             "expense_ratio_pct": er,
                             "annual_cost_inr": round(cost, 2)})

    # Overlap detection
    from collections import Counter
    cats = Counter(h.get("category", "Equity") for h in holdings)
    overlaps = [{"category": c, "count": n,
                 "warning": f"You hold {n} {c} funds — likely stock overlap"}
                for c, n in cats.items() if n > 1]

    log.info(f"[Agent 2] XIRR={xirr_val:.1f}%, drag=₹{total_drag:.0f}/yr")
    return {
        "total_invested": total_inv,
        "total_current_value": total_cur,
        "total_gain": gain,
        "xirr_percent": round(xirr_val, 2),
        "gain_percent": round((gain / total_inv * 100) if total_inv else 0, 2),
        "annual_expense_drag_inr": round(total_drag, 2),
        "drag_detail": drag_detail,
        "overlaps": overlaps
    }


# ── AGENT 3: GEMINI AI ADVISOR ───────────────────────────────────
def agent_gemini(holdings, math_result):
    log.info("[Agent 3] Calling Gemini 2.5 Flash...")
    prompt = f"""
You are a SEBI-registered financial advisor helping a retail investor in India.
Analyse this portfolio and return ONLY a JSON object with these keys:
health_score (0-100), health_grade (A/B/C/D/F),
top_issues (array of 3 strings),
recommendations (array of 4 specific actionable steps),
estimated_annual_savings_inr (number),
fire_years_estimate (number — years to financial independence assuming 15% returns),
summary (2 plain-English sentences),
tamil_summary (translate summary to Tamil script)

Portfolio:
- Total invested: ₹{math_result['total_invested']:,.0f}
- Current value: ₹{math_result['total_current_value']:,.0f}
- XIRR: {math_result['xirr_percent']}%
- Annual expense drag: ₹{math_result['annual_expense_drag_inr']:,.0f}
- Overlaps: {json.dumps(math_result['overlaps'])}
- Holdings: {json.dumps(holdings[:8])}

Return ONLY the JSON, no markdown.
"""
    r = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = r.text.strip().removeprefix("```json").removesuffix("```").strip()
    plan = json.loads(raw)
    log.info(f"[Agent 3] Health score: {plan.get('health_score')}")
    return plan


# ── AGENT 4: TAMIL VOICE ─────────────────────────────────────────
def _play_voice(tamil_text):
    """Run in a background thread so it never blocks the HTTP response."""
    try:
        tts = gTTS(text=tamil_text[:400], lang='ta')
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        pygame.mixer.init()
        pygame.mixer.music.load(buf)
        pygame.mixer.music.play()
        log.info("[Agent 4] Tamil audio playing")
    except Exception as e:
        log.warning(f"[Agent 4] Voice skipped: {e}")

def agent_voice(tamil_text):
    log.info("[Agent 4] Launching Tamil voice in background thread...")
    t = threading.Thread(target=_play_voice, args=(tamil_text,), daemon=True)
    t.start()
    return True


# ── COUPLE'S PLANNER ─────────────────────────────────────────────
def couple_fire_plan(data):
    log.info("[Couple] Generating FIRE plan...")
    prompt = f"""
You are a financial planner for an Indian couple.
Return ONLY a JSON object with:
combined_monthly_income, recommended_monthly_sip, fire_target_corpus,
years_to_fire (number), fire_age_husband, fire_age_wife,
hra_optimization (string), nps_recommendation (string),
insurance_gaps (string), joint_vs_separate_sip (string),
tamil_summary (2 sentences in Tamil script)

Input: {json.dumps(data)}
Return ONLY the JSON, no markdown.
"""
    r = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = r.text.strip().removeprefix("```json").removesuffix("```").strip()
    return json.loads(raw)


# ── ROUTES ───────────────────────────────────────────────────────
@app.route('/analyze', methods=['POST'])
def analyze():
    if 'pdf' not in request.files:
        return jsonify({"error": "No PDF"}), 400
    try:
        pdf_bytes = request.files['pdf'].read()
        holdings   = agent_parse(pdf_bytes)
        math       = agent_math(holdings)
        ai_plan    = agent_gemini(holdings, math)
        tamil_text = ai_plan.get("tamil_summary", "")
        if tamil_text:
            agent_voice(tamil_text)
        return jsonify({
            "holdings": holdings,
            "math": math,
            "ai_recommendation": ai_plan,
            "audit_log": [
                "Agent 1: PDF parsed via PyMuPDF + Gemini",
                "Agent 2: XIRR calculated via scipy brentq",
                "Agent 3: Rebalancing plan via Gemini 2.5 Flash",
                "Agent 4: Tamil voice generated via gTTS"
            ]
        })
    except Exception as e:
        log.error(f"[Analyze] Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/couple', methods=['POST'])
def couple():
    try:
        data = request.get_json()
        plan = couple_fire_plan(data)
        tamil = plan.get("tamil_summary", "")
        if tamil:
            agent_voice(tamil)
        return jsonify(plan)
    except Exception as e:
        log.error(f"[Couple] Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    # use_reloader=False prevents the double-process issue with pygame
    app.run(debug=True, port=5000, use_reloader=False)
