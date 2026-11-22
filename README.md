# Pre-Results Radar (NSE/BSE Main Board)

> Clean, actionable, decision-friendly pre-results dashboard and automated intelligence engine for Indian main-board stocks.

[![Deploy to GitHub Pages](https://github.com/actions/workflows/deploy.yml/badge.svg)](https://github.com)
[![Node.js](https://img.shields.io/badge/Node.js-v22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## 🎯 Executive Overview

The **Pre-Results Radar** operates daily to synthesize regulatory corporate filings, broker consensus estimates, volume execution run-rates, and sector tailwinds for companies scheduled to report earnings within the next 7 calendar days.

The dashboard enables investors and analysts to review the active results landscape in **under 60 seconds** without information overload.

---

## ⚖️ Absolute Non-Discretionary Rules (Never Broken)

- **English only**. All currency figures formatted strictly using **"Rs."** (e.g., *Rs. 1,480 cr*).
- **Never invent data**. Grounded exclusively in exchange filings or $\ge 2$ independent corporate calendars.
- **Never show prices, tickers, or internal scores**. Full company legal names only.
- **Never recommend "buy" or "sell"**.
- **Never pad lists**. Empty categories stay empty.
- **Drop unverified dates**. Any company without an official board-meeting intimation or verified multi-calendar confirmation is rejected.
- **Drop already reported names**. Active tracking prunes past-reported entities.
- **7-day forward horizon for A & B**.
- **Market-cap thresholds**:
  - **List 1**: $\ge$ Rs. 20,000 cr
  - **List 2**: Rs. 5,000 – 20,000 cr
  - *(Entities under Rs. 5,000 cr are strictly screened out)*.
- **Exclusion triggers**: Loss-makers in the trailing quarter, promoter pledge $> 25\%$, or active governance concerns.

---

## 📊 Radar Categorization

| Category | Color Code | Qualification Criteria |
| :--- | :--- | :--- |
| **A – Very Positive** | Deep Green | Internal score $\ge 75$ + Growth $\ge 7/25$ + History $\ge 7/15$, supported by filings & estimates |
| **B – Decent Positive** | Soft Green | Internal score $65 - 74$, steady volume run-rate & margins |
| **C – Tomorrow** | Royal Blue | All verified main-board names reporting the next trading day |
| **D – Turnaround · Risky** | Warm Amber | Weak trailing quarter + hard, verifiable recovery evidence only |

### Strict Output Format per Card
```text
COMPANY FULL NAME
Results date: DD Mon YYYY
• Reason / qualitative edge
• Key number (add "est." if estimate)
• Catalyst or risk
• Thesis Invalidation: Objective fundamental stop trigger
• Implied Event Move: Historical 1-day earnings swing band
```

---

## 🛡️ Interactive Trade Planning & Stop Loss Tracker

To support tactical risk management while preserving regulatory neutrality:
- Click **`🛡️ Set Entry & Stop Loss`** on any stock card.
- Enter your intended **Planned Entry (Rs.)** and **Planned Stop Loss (Rs.)**.
- The interactive calculator computes:
  - **Risk per Share** & **Risk %**
  - **Calculated 1:2 Target (Rs.)** and **1:3 Target (Rs.)**
  - **Risk-to-Reward Ratio (R:R)**
- Plans persist locally in your browser and sync with the database.
- Use the **"Planned Stops"** filter switch to focus exclusively on names with defined risk parameters.

---

## 🤖 Official NSE Bhavcopy MCP Live Assistant

Integrated with the official **National Stock Exchange of India (NSE) Model Context Protocol (MCP)** server at `https://mcp.nseindia.in/bhavcopy/cm/mcp` ([NSE MCP Portal](https://www.nseindia.in/nse-mcp)).

### Capabilities via Chat
- **📊 Market Mood & India VIX**: Real-time factual VIX levels, 1-day/1-week/1-month trend, equity index advance/decline breadth, and major benchmark closes.
- **📈 Top Movers & Volume Leaders**: Live Bhavcopy turnover rankings and top gainers/losers.
- **🎯 52-Week High / Low**: Historical 52-week price range, current position within range (%), and distance from extremes.
- **🏢 Official Corporate Actions**: Direct regulatory corporate action history (Dividends, Splits, Bonus issues, AGMs) with ex-dates.
- **📉 Index Valuation & Performance**: P/E, P/B, and Dividend yield metrics across Nifty 50, Nifty Bank, Nifty IT, and broader indices.
- **Dual Deployment Architecture**:
  - **Local (`http://localhost:3456`)**: Connects via server proxy `/api/mcp/chat` and `/api/mcp/tool` for full real-time MCP communication.
  - **GitHub Pages (`https://sumit2798.github.io/tradewithme/`)**: Features an in-browser intelligence engine with pre-indexed Bhavcopy data ensuring zero downtime and instant answers.
- **SEBI Compliance**: All responses strictly follow the statutory disclaimer: educational and research purposes only, no investment advice.

---

## 🚀 Running Locally

### Prerequisites
- Node.js v22+

### Setup & Launch
```bash
# Clone the repository
git clone https://github.com/<your-username>/pre-results-radar.git
cd pre-results-radar

# Build initial snapshot and static feeds
npm run build

# Start the local server
npm start
```
Open **[http://localhost:3456](http://localhost:3456)** in your browser.

### Daily Scheduled Jobs (IST)
- **07:45 IST**: `npm run radar:0745` (Build Category C + prune reported names)
- **08:00 IST**: `npm run radar:0800` (Full refresh of A/B/D, One-week overview, Changes & Exclusions)

---

## 🌐 GitHub Pages Deployment

This repository includes a pre-configured GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit of Pre-Results Radar"
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```
2. **Enable GitHub Pages**:
   - Go to your repository **Settings** $\rightarrow$ **Pages**.
   - Under **Build and deployment** $\rightarrow$ **Source**, select **GitHub Actions**.
3. **Automated Refresh**:
   - GitHub Actions will build and deploy the site automatically on push.
   - It also automatically triggers every weekday at **07:45 IST (02:15 UTC)** and **08:00 IST (02:30 UTC)** via cron.
   - The deployed static site functions 100% client-side with offline local persistence for stars, notes, and trade plans!

---

## 📁 Repository Structure

```text
├── .github/
│   └── workflows/
│       └── deploy.yml        # Automated GitHub Pages CI/CD & Cron
├── bin/
│   └── cli.js                # Command-line runner for scheduled jobs
├── data/
│   ├── schema.sql            # SQLite schema definition
│   └── seed_data.json        # Verified filings & consensus dataset
├── public/
│   ├── data/
│   │   ├── radar.json        # Static JSON feed for GitHub Pages
│   │   └── archive.json      # Historical archives feed
│   ├── app.js                # Frontend client logic & offline handlers
│   ├── index.html            # Semantic, accessible UI
│   └── styles.css            # Modern CSS with light-dark() tokens
├── src/
│   ├── engine.js             # Core rules, scoring, and snapshot generator
│   └── scheduler.js          # Background daemon IST job scheduler
├── package.json
└── server.js                 # Local API & static server
```

---

## 📜 Compliance Disclaimer

*Pre-Results Radar is an informational research and workflow tool. It does not provide investment advice, buy/sell recommendations, or price targets. All company metrics must be independently verified against official exchange filings prior to making financial decisions.*
