-- Pre-Results Radar Database Schema
CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    sector TEXT NOT NULL,
    market_cap_cr REAL NOT NULL,
    mcap_list TEXT NOT NULL CHECK(mcap_list IN ('List 1', 'List 2')),
    promoter_pledge_pct REAL NOT NULL DEFAULT 0.0,
    has_governance_issues INTEGER NOT NULL DEFAULT 0,
    latest_qtr_net_profit_cr REAL NOT NULL,
    last_qtr_weak INTEGER NOT NULL DEFAULT 0,
    turnaround_evidence TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS results_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_name TEXT UNIQUE NOT NULL,
    results_date TEXT NOT NULL, -- 'YYYY-MM-DD'
    results_date_formatted TEXT NOT NULL, -- 'DD Mon YYYY'
    verified_by TEXT NOT NULL CHECK(verified_by IN ('Exchange filing', 'Multi-calendar', 'Estimate-heavy')),
    source_filing_ref TEXT,
    has_reported INTEGER NOT NULL DEFAULT 0,
    reported_at DATETIME,
    FOREIGN KEY(stock_name) REFERENCES stocks(name)
);

CREATE TABLE IF NOT EXISTS internal_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_name TEXT NOT NULL,
    eval_date TEXT NOT NULL,
    growth_score REAL NOT NULL,     -- max 25
    analysts_score REAL NOT NULL,   -- max 15
    positives_score REAL NOT NULL,  -- max 15
    sector_score REAL NOT NULL,     -- max 10
    history_score REAL NOT NULL,    -- max 15
    momentum_score REAL NOT NULL,   -- max 10
    room_score REAL NOT NULL,       -- max 10
    total_score REAL NOT NULL,      -- max 100
    category TEXT NOT NULL CHECK(category IN ('A', 'B', 'C', 'D', 'EXCLUDED')),
    exclusion_reason TEXT,
    reason_qualitative TEXT NOT NULL,
    key_number TEXT NOT NULL,
    catalyst_or_risk TEXT NOT NULL,
    one_line_summary TEXT NOT NULL,
    event_invalidation TEXT,
    volatility_buffer TEXT,
    technical_anchor TEXT,
    UNIQUE(stock_name, eval_date),
    FOREIGN KEY(stock_name) REFERENCES stocks(name)
);

CREATE TABLE IF NOT EXISTS radar_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TEXT NOT NULL,
    run_time_ist TEXT NOT NULL,
    run_type TEXT NOT NULL, -- '07:45', '08:00', 'manual'
    snapshot_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_notes (
    stock_name TEXT PRIMARY KEY,
    notes TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_shortlist (
    stock_name TEXT PRIMARY KEY,
    starred_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_trade_plans (
    stock_name TEXT PRIMARY KEY,
    entry_price REAL,
    stop_loss_price REAL,
    target_price REAL,
    risk_reward_ratio REAL,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
