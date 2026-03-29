# ET AI Money Mentor - Architecture Document

## System Flow & 4-Agent Framework
The ET AI Money Mentor is built on a modular, multi-agent architecture orchestrated by a Flask API backend. It processes raw financial documents to deliver actionable, localized advice to middle-class retail investors in India.

### 1. The Clients
- **React Web Dashboard (Vite)**: A visually-rich interface with Recharts components displaying the Portfolio X-Ray, Money Health Score, and Couple's FIRE planner.
- **WhatsApp Bot**: A Node.js backend integration that allows users to send PDFs securely over mobile to receive rapid text reports.

### 2. The Flask Orchestrator (`app.py`)
Serves as the gateway that coordinates the sequential execution of four specialized agents. 

### 3. The 4 Agents
#### Agent 1: PDF Parser
- **Core Technology**: `PyMuPDF` (fitz) + Google Gemini API 2.5 Flash.
- **Role**: Parses unstructured CAMS mutual fund statement PDFs. Extracts unstructured text into precise, validated JSON arrays containing `fund_name`, `category`, `invested_amount`, and `current_value`.

#### Agent 2: Financial Math Engine
- **Core Technology**: `scipy.optimize.brentq` + Pandas.
- **Role**: Standardized quantitative analysis. Calculates precise True XIRR using cashflow dates, computes total expense drag (AUM fees siphon), and detects critical category overlaps using frequency counts.

#### Agent 3: AI Advisor
- **Core Technology**: Google Gemini API 2.5 Flash.
- **Role**: Qualitatively assesses the portfolio using SEBI-registered advisory prompts. Computes a Health Score (0-100), summarizes 3 top issues, issues 4 actionable steps, and estimates the FIRE target duration and potential savings from rebalancing.

#### Agent 4: Tamil Voice
- **Core Technology**: Google Text-to-Speech (`gTTS`) + `pygame`.
- **Role**: Enhances accessibility for Tier 2/3 users by converting the AI Advisor's localized Tamil summary text into human-like audio, playing it securely back to the investor. 
