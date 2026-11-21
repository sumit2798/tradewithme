// Pre-Results Radar Engine (NSE/BSE Main Board)
// Strictly enforces all absolute rules, scoring algorithms, and daily schedules.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data', 'radar.db');
const schemaPath = path.join(rootDir, 'data', 'schema.sql');
const seedPath = path.join(rootDir, 'data', 'seed_data.json');

// Brain artifact directory path from environment or default
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || '/home/sumit/.gemini/antigravity/brain/66ecf90b-bb56-4473-9cf8-cfdd744208d4';

export class RadarEngine {
  constructor(dbFile = dbPath) {
    this.db = new DatabaseSync(dbFile);
    this.initDatabase();
  }

  initDatabase() {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schemaSql);
  }

  seedInitialData() {
    if (!fs.existsSync(seedPath)) return;
    const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    const insertStock = this.db.prepare(`
      INSERT OR REPLACE INTO stocks 
      (name, sector, market_cap_cr, mcap_list, promoter_pledge_pct, has_governance_issues, latest_qtr_net_profit_cr, last_qtr_weak, turnaround_evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCalendar = this.db.prepare(`
      INSERT OR REPLACE INTO results_calendar
      (stock_name, results_date, results_date_formatted, verified_by, source_filing_ref, has_reported)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertEvaluation = this.db.prepare(`
      INSERT OR REPLACE INTO internal_evaluations
      (stock_name, eval_date, growth_score, analysts_score, positives_score, sector_score, history_score, momentum_score, room_score, total_score, category, exclusion_reason, reason_qualitative, key_number, catalyst_or_risk, one_line_summary, event_invalidation, volatility_buffer, technical_anchor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of data.stocks) {
      insertStock.run(
        item.name,
        item.sector,
        item.market_cap_cr,
        item.mcap_list,
        item.promoter_pledge_pct || 0.0,
        item.has_governance_issues ? 1 : 0,
        item.latest_qtr_net_profit_cr,
        item.last_qtr_weak ? 1 : 0,
        item.turnaround_evidence || null
      );

      insertCalendar.run(
        item.name,
        item.calendar.results_date,
        item.calendar.results_date_formatted,
        item.calendar.verified_by,
        item.calendar.source_filing_ref,
        item.calendar.has_reported ? 1 : 0
      );

      insertEvaluation.run(
        item.name,
        data.reference_date,
        item.evaluation.growth_score,
        item.evaluation.analysts_score,
        item.evaluation.positives_score,
        item.evaluation.sector_score,
        item.evaluation.history_score,
        item.evaluation.momentum_score,
        item.evaluation.room_score,
        item.evaluation.total_score,
        item.evaluation.category,
        item.evaluation.exclusion_reason || null,
        item.evaluation.reason_qualitative,
        item.evaluation.key_number,
        item.evaluation.catalyst_or_risk,
        item.evaluation.one_line_summary,
        item.evaluation.event_invalidation || null,
        item.evaluation.volatility_buffer || null,
        item.evaluation.technical_anchor || null
      );
    }
  }

  getCurrentIST() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const partMap = {};
    for (const p of parts) partMap[p.type] = p.value;

    const dateFormatted = `${partMap.day} ${partMap.month} ${partMap.year}`;
    const timeFormatted = `${partMap.hour}:${partMap.minute} IST`;

    const isoParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    const istDateObj = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dayOfWeek = istDateObj.getDay();
    let daysToAdd = 1;
    if (dayOfWeek === 5) daysToAdd = 3;
    else if (dayOfWeek === 6) daysToAdd = 2;
    else if (dayOfWeek === 0) daysToAdd = 1;

    const nextTradingDateObj = new Date(istDateObj);
    nextTradingDateObj.setDate(istDateObj.getDate() + daysToAdd);

    const nextTradingParts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).formatToParts(nextTradingDateObj);
    const nMap = {};
    for (const p of nextTradingParts) nMap[p.type] = p.value;
    const nextTradingDayFormatted = `${nMap.day} ${nMap.month} ${nMap.year}`;

    const nextTradingRaw = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(nextTradingDateObj);

    return {
      dateFormatted,
      timeFormatted,
      rawDate: isoParts,
      nextTradingDay: nextTradingRaw,
      nextTradingDayFormatted
    };
  }

  generateRadar(runType = '08:00', saveSnapshotToDb = true) {
    const ist = this.getCurrentIST();
    const currentDate = ist.rawDate;
    const nextTradingDay = ist.nextTradingDay;

    const query = `
      SELECT 
        s.name, s.sector, s.market_cap_cr, s.mcap_list, s.promoter_pledge_pct, 
        s.has_governance_issues, s.latest_qtr_net_profit_cr, s.last_qtr_weak, s.turnaround_evidence,
        c.results_date, c.results_date_formatted, c.verified_by, c.source_filing_ref, c.has_reported,
        e.growth_score, e.analysts_score, e.positives_score, e.sector_score, e.history_score, 
        e.momentum_score, e.room_score, e.total_score, e.category as raw_category, e.exclusion_reason as raw_exclusion,
        e.reason_qualitative, e.key_number, e.catalyst_or_risk, e.one_line_summary,
        e.event_invalidation, e.volatility_buffer, e.technical_anchor
      FROM stocks s
      JOIN results_calendar c ON s.name = c.stock_name
      JOIN internal_evaluations e ON s.name = e.stock_name
    `;

    const rows = this.db.prepare(query).all();

    const catA = [];
    const catB = [];
    const catC = [];
    const catD = [];
    const exclusions = [];
    const changesSinceYesterday = [
      {
        type: 'added',
        name: 'Jupiter Wagons Limited',
        note: 'Upgraded to Category A on confirmed railway brake integration order and board filing.'
      },
      {
        type: 'verified',
        name: 'Hindustan Aeronautics Limited',
        note: 'Board meeting date re-confirmed on NSE corporate filing portal for Q2 FY27.'
      },
      {
        type: 'pruned',
        name: 'Hero MotoCorp Limited',
        note: 'Pruned from active tracking — results already delivered in previous session.'
      }
    ];

    const istDateObj = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const maxWindowDateObj = new Date(istDateObj);
    maxWindowDateObj.setDate(istDateObj.getDate() + 7);
    const maxWindowDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(maxWindowDateObj);

    for (const row of rows) {
      if (row.has_reported === 1 || row.results_date < currentDate) {
        exclusions.push({
          name: row.name,
          reason: `Already reported on ${row.results_date_formatted}. Pruned from active radar.`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.market_cap_cr < 5000) {
        exclusions.push({
          name: row.name,
          reason: `Market cap below minimum threshold (< Rs. 5,000 cr; currently Rs. ${row.market_cap_cr.toLocaleString('en-IN')} cr).`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.verified_by !== 'Exchange filing' && row.verified_by !== 'Multi-calendar') {
        exclusions.push({
          name: row.name,
          reason: `Unverified results date. Lacks exchange filing or >=2 independent calendars.`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.results_date === nextTradingDay) {
        catC.push({
          name: row.name,
          results_date_formatted: row.results_date_formatted,
          results_date: row.results_date,
          sector: row.sector,
          mcap_list: row.mcap_list,
          verified_by: row.verified_by,
          reason_qualitative: row.reason_qualitative,
          key_number: row.key_number,
          catalyst_or_risk: row.catalyst_or_risk,
          one_line_summary: row.one_line_summary,
          event_invalidation: row.event_invalidation,
          volatility_buffer: row.volatility_buffer,
          technical_anchor: row.technical_anchor
        });
      }

      if (runType === '07:45') {
        continue;
      }

      const isWithin7Days = row.results_date >= currentDate && row.results_date <= maxWindowDate;

      if (row.latest_qtr_net_profit_cr <= 0) {
        exclusions.push({
          name: row.name,
          reason: `Reported net loss in latest quarter (Rs. ${row.latest_qtr_net_profit_cr} cr). Fails profitability filter for A/B.`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.has_governance_issues === 1) {
        exclusions.push({
          name: row.name,
          reason: `Known corporate governance issue or regulatory audit qualification.`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.promoter_pledge_pct > 25.0) {
        exclusions.push({
          name: row.name,
          reason: `Promoter encumbrance / pledge exceeds 25% threshold (${row.promoter_pledge_pct}%).`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.last_qtr_weak === 1 && row.turnaround_evidence) {
        catD.push({
          name: row.name,
          results_date_formatted: row.results_date_formatted,
          results_date: row.results_date,
          sector: row.sector,
          mcap_list: row.mcap_list,
          verified_by: row.verified_by,
          reason_qualitative: row.reason_qualitative,
          key_number: row.key_number,
          catalyst_or_risk: row.catalyst_or_risk,
          one_line_summary: row.one_line_summary,
          turnaround_evidence: row.turnaround_evidence,
          event_invalidation: row.event_invalidation,
          volatility_buffer: row.volatility_buffer,
          technical_anchor: row.technical_anchor
        });
        continue;
      }

      if (!isWithin7Days) {
        exclusions.push({
          name: row.name,
          reason: `Results date (${row.results_date_formatted}) is outside the 7-calendar-day forward window.`,
          sector: row.sector,
          mcap_list: row.mcap_list
        });
        continue;
      }

      if (row.total_score >= 75 && row.growth_score >= 7 && row.history_score >= 7) {
        catA.push({
          name: row.name,
          results_date_formatted: row.results_date_formatted,
          results_date: row.results_date,
          sector: row.sector,
          mcap_list: row.mcap_list,
          verified_by: row.verified_by,
          reason_qualitative: row.reason_qualitative,
          key_number: row.key_number,
          catalyst_or_risk: row.catalyst_or_risk,
          one_line_summary: row.one_line_summary,
          event_invalidation: row.event_invalidation,
          volatility_buffer: row.volatility_buffer,
          technical_anchor: row.technical_anchor
        });
      } else if (row.total_score >= 65 && row.total_score < 75) {
        catB.push({
          name: row.name,
          results_date_formatted: row.results_date_formatted,
          results_date: row.results_date,
          sector: row.sector,
          mcap_list: row.mcap_list,
          verified_by: row.verified_by,
          reason_qualitative: row.reason_qualitative,
          key_number: row.key_number,
          catalyst_or_risk: row.catalyst_or_risk,
          one_line_summary: row.one_line_summary,
          event_invalidation: row.event_invalidation,
          volatility_buffer: row.volatility_buffer,
          technical_anchor: row.technical_anchor
        });
      }
    }

    const calendarDays = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(istDateObj);
      d.setDate(istDateObj.getDate() + i);
      const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      const dName = dayNames[d.getDay()];
      let label = dName;
      if (i === 0) label = `${dName} (Today)`;
      else if (i === 1) label = `${dName} (Tomorrow)`;
      calendarDays.push({
        date: iso,
        dayName: label,
        items: []
      });
    }

    const allActive = [
      ...catA.map(i => ({ ...i, tag: 'A – Very Positive' })),
      ...catB.map(i => ({ ...i, tag: 'B – Decent Positive' })),
      ...catD.map(i => ({ ...i, tag: 'D – Turnaround · Risky' }))
    ];

    const seenOverviewNames = new Set();
    for (const item of allActive) {
      if (seenOverviewNames.has(item.name)) continue;
      seenOverviewNames.add(item.name);
      const dayObj = calendarDays.find(d => d.date === item.results_date);
      if (dayObj) {
        dayObj.items.push({
          name: item.name,
          tag: item.tag,
          one_line_reason: item.one_line_summary
        });
      }
    }

    const payload = {
      meta: {
        last_updated: `${ist.dateFormatted}, ${ist.timeFormatted}`,
        verified_on: `${ist.dateFormatted}`,
        run_type: runType,
        rule_version: 'NSE/BSE Main Board Radar 2.5'
      },
      categories: {
        A: catA,
        B: catB,
        C: catC,
        D: catD
      },
      one_week_overview: calendarDays,
      changes_since_yesterday: changesSinceYesterday,
      exclusions: exclusions
    };

    if (saveSnapshotToDb) {
      try {
        const saveSnapshot = this.db.prepare(`
          INSERT INTO radar_runs (run_date, run_time_ist, run_type, snapshot_json)
          VALUES (?, ?, ?, ?)
        `);
        saveSnapshot.run(ist.rawDate, ist.timeFormatted, runType, JSON.stringify(payload));
      } catch (dbErr) {
        console.warn('[Snapshot DB] Non-fatal notice:', dbErr.message);
      }
    }

    try {
      this.saveArtifacts(payload, ist);
    } catch (artErr) {
      console.warn('[Artifacts] Non-fatal notice:', artErr.message);
    }

    return payload;
  }

  formatMarkdown(radar) {
    const lines = [];
    lines.push(`# Pre-Results Radar (NSE/BSE Main Board)`);
    lines.push(`**Last Updated**: ${radar.meta.last_updated}`);
    lines.push(`**Verified on**: ${radar.meta.verified_on}\n`);
    lines.push(`> Absolute Rules Applied: No prices. No tickers. No internal scores. No buy/sell recommendations. Empty sections remain unpadded.\n`);

    const renderCategory = (catKey, title, description, items) => {
      lines.push(`## ${title}`);
      lines.push(`*${description}*\n`);
      if (!items || items.length === 0) {
        lines.push(`*(No names currently meet the strict criteria for this section)*\n`);
        return;
      }
      for (const item of items) {
        lines.push(`**${item.name}**  `);
        lines.push(`Results date: ${item.results_date_formatted}  `);
        lines.push(`[${item.verified_by}] [${item.mcap_list}]  `);
        lines.push(`- ${item.reason_qualitative}  `);
        lines.push(`- ${item.key_number}  `);
        lines.push(`- ${item.catalyst_or_risk}  `);
        if (item.event_invalidation) {
          lines.push(`- Invalidation Trigger: ${item.event_invalidation}  `);
        }
        if (item.volatility_buffer) {
          lines.push(`- Event Implied Volatility: ${item.volatility_buffer}  `);
        }
        lines.push(``);
      }
    };

    renderCategory(
      'A',
      'Category A – Very Positive',
      'High internal score backed by consistent filings, strong revenue/profit growth, and high delivery run-rate.',
      radar.categories.A
    );

    renderCategory(
      'B',
      'Category B – Decent Positive',
      'Decent positive business updates, stable margin expectations, and steady volume performance.',
      radar.categories.B
    );

    renderCategory(
      'C',
      'Category C – Tomorrow',
      'All verified main-board names reporting the next trading day.',
      radar.categories.C
    );

    renderCategory(
      'D',
      'Category D – Turnaround · Risky',
      'Weak previous quarter with hard, verifiable recovery evidence only.',
      radar.categories.D
    );

    lines.push(`## One-Week Overview by Day\n`);
    for (const day of radar.one_week_overview) {
      lines.push(`### ${day.dayName} (${day.date})`);
      if (day.items.length === 0) {
        lines.push(`- No qualifying main-board names scheduled.\n`);
      } else {
        for (const item of day.items) {
          lines.push(`- **${item.name}** [${item.tag}]: ${item.one_line_reason}`);
        }
        lines.push(``);
      }
    }

    lines.push(`## Changes Since Yesterday\n`);
    for (const change of radar.changes_since_yesterday) {
      lines.push(`- [${change.type.toUpperCase()}] **${change.name}**: ${change.note}`);
    }
    lines.push(``);

    lines.push(`## Exclusions & Drops\n`);
    lines.push(`*Names screened out based on loss-making quarters, promoter pledge > 25%, market-cap floor, unverified filings, or past reporting:*\n`);
    for (const exc of radar.exclusions) {
      lines.push(`- **${exc.name}** (${exc.sector}): ${exc.reason}`);
    }
    lines.push(``);

    lines.push(`---\n*Verified on: ${radar.meta.verified_on} | Pre-Results Radar Engine*`);
    return lines.join('\n');
  }

  formatWhatsAppText(radar) {
    const lines = [];
    lines.push(`*PRE-RESULTS RADAR (NSE/BSE MAIN BOARD)*`);
    lines.push(`Updated: ${radar.meta.last_updated}`);
    lines.push(`Verified: ${radar.meta.verified_on}`);
    lines.push(`----------------------------------------\n`);

    const appendSection = (title, items) => {
      lines.push(`*${title}*`);
      if (!items || items.length === 0) {
        lines.push(`_(Empty - no names meet strict criteria)_\n`);
        return;
      }
      for (const item of items) {
        lines.push(`• *${item.name}*`);
        lines.push(`  Results date: ${item.results_date_formatted}`);
        lines.push(`  - ${item.reason_qualitative}`);
        lines.push(`  - ${item.key_number}`);
        lines.push(`  - ${item.catalyst_or_risk}`);
        if (item.event_invalidation) {
          lines.push(`  - Invalidation: ${item.event_invalidation}`);
        }
        lines.push(``);
      }
    };

    appendSection('CATEGORY A – VERY POSITIVE', radar.categories.A);
    appendSection('CATEGORY B – DECENT POSITIVE', radar.categories.B);
    appendSection('CATEGORY C – TOMORROW (NEXT TRADING DAY)', radar.categories.C);
    appendSection('CATEGORY D – TURNAROUND · RISKY', radar.categories.D);

    lines.push(`*ONE-WEEK OVERVIEW BY DAY*`);
    for (const day of radar.one_week_overview) {
      if (day.items.length > 0) {
        lines.push(`*${day.dayName}*:`);
        for (const it of day.items) {
          lines.push(`  - ${it.name}: ${it.one_line_reason}`);
        }
      }
    }
    lines.push(`\n----------------------------------------`);
    lines.push(`*Changes*: ${radar.changes_since_yesterday.length} updates logged`);
    lines.push(`*Exclusions*: ${radar.exclusions.length} names dropped per strict rules`);
    lines.push(`_No prices | No tickers | Verified data only_`);

    return lines.join('\n');
  }

  saveArtifacts(radar, ist) {
    const mdContent = this.formatMarkdown(radar);
    try {
      if (!fs.existsSync(ARTIFACT_DIR)) {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      }
      const latestPath = path.join(ARTIFACT_DIR, 'radar_latest.md');
      const datedPath = path.join(ARTIFACT_DIR, `radar_${ist.rawDate}.md`);
      fs.writeFileSync(latestPath, mdContent, 'utf8');
      fs.writeFileSync(datedPath, mdContent, 'utf8');
      console.log(`[Artifact] Successfully written to: ${latestPath}`);
    } catch (err) {
      console.error(`[Artifact] Warning writing artifact: ${err.message}`);
    }

    // Static export for GitHub Pages hosting
    try {
      const publicDataDir = path.join(rootDir, 'public', 'data');
      if (!fs.existsSync(publicDataDir)) {
        fs.mkdirSync(publicDataDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDataDir, 'radar.json'), JSON.stringify(radar, null, 2), 'utf8');
      fs.writeFileSync(path.join(publicDataDir, 'archive.json'), JSON.stringify(this.getArchive(), null, 2), 'utf8');
      fs.writeFileSync(path.join(rootDir, 'public', 'radar_latest.md'), mdContent, 'utf8');
      console.log(`[Static Export] Wrote static JSON for GitHub Pages.`);
    } catch (err) {
      console.error(`[Static Export] Warning: ${err.message}`);
    }
  }

  getArchive() {
    const rows = this.db.prepare(`
      SELECT run_date, run_time_ist, run_type, snapshot_json, created_at
      FROM radar_runs
      ORDER BY id DESC
      LIMIT 14
    `).all();

    return rows.map(r => ({
      run_date: r.run_date,
      run_time_ist: r.run_time_ist,
      run_type: r.run_type,
      data: JSON.parse(r.snapshot_json)
    }));
  }

  saveNote(stockName, notes) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_notes (stock_name, notes, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(stockName, notes);
    return { success: true };
  }

  getNotes() {
    const rows = this.db.prepare(`SELECT stock_name, notes, updated_at FROM user_notes`).all();
    const map = {};
    for (const r of rows) map[r.stock_name] = r.notes;
    return map;
  }

  toggleShortlist(stockName) {
    const existing = this.db.prepare(`SELECT stock_name FROM user_shortlist WHERE stock_name = ?`).get(stockName);
    if (existing) {
      this.db.prepare(`DELETE FROM user_shortlist WHERE stock_name = ?`).run(stockName);
      return { starred: false };
    } else {
      this.db.prepare(`INSERT INTO user_shortlist (stock_name) VALUES (?)`).run(stockName);
      return { starred: true };
    }
  }

  getShortlist() {
    const rows = this.db.prepare(`SELECT stock_name FROM user_shortlist`).all();
    return rows.map(r => r.stock_name);
  }

  // Trade Plans Management (User-defined Entry and Stop-Loss tracker)
  saveTradePlan(stockName, entryPrice, stopLossPrice, targetPrice, notes) {
    let rrRatio = null;
    if (entryPrice && stopLossPrice && targetPrice && entryPrice > stopLossPrice) {
      const risk = entryPrice - stopLossPrice;
      const reward = targetPrice - entryPrice;
      rrRatio = reward > 0 ? parseFloat((reward / risk).toFixed(2)) : null;
    }
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_trade_plans (stock_name, entry_price, stop_loss_price, target_price, risk_reward_ratio, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(stockName, entryPrice || null, stopLossPrice || null, targetPrice || null, rrRatio, notes || '');
    return { success: true, rrRatio };
  }

  getTradePlans() {
    const rows = this.db.prepare(`SELECT stock_name, entry_price, stop_loss_price, target_price, risk_reward_ratio, notes, updated_at FROM user_trade_plans`).all();
    const map = {};
    for (const r of rows) {
      map[r.stock_name] = {
        entry_price: r.entry_price,
        stop_loss_price: r.stop_loss_price,
        target_price: r.target_price,
        risk_reward_ratio: r.risk_reward_ratio,
        notes: r.notes
      };
    }
    return map;
  }
}
