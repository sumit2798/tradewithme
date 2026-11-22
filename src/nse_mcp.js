// Official NSE India Bhavcopy Model Context Protocol (MCP) Client & Assistant
// Endpoint: https://mcp.nseindia.in/bhavcopy/cm/mcp

const NSE_MCP_ENDPOINT = 'https://mcp.nseindia.in/bhavcopy/cm/mcp';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class NseMcpClient {
  constructor() {
    this.sessionId = null;
    this.sessionExpiry = 0;
    this.toolsList = null;
    this.reqId = 1;
  }

  /**
   * Initializes session with NSE MCP server
   */
  async initializeSession(force = false) {
    if (!force && this.sessionId && Date.now() < this.sessionExpiry) {
      return this.sessionId;
    }

    try {
      const initPayload = {
        jsonrpc: '2.0',
        id: ++this.reqId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'radar-nse-assistant',
            version: '2.0.0'
          }
        }
      };

      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(NSE_MCP_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream',
              'User-Agent': DEFAULT_USER_AGENT
            },
            body: JSON.stringify(initPayload),
            signal: AbortSignal.timeout(10000)
          });

          if (!res.ok) {
            throw new Error(`NSE MCP initialize failed with status ${res.status}`);
          }

          const sessionId = res.headers.get('mcp-session-id');
          if (sessionId) {
            this.sessionId = sessionId;
            this.sessionExpiry = Date.now() + (15 * 60 * 1000); // 15 mins
          }

          return this.sessionId;
        } catch (err) {
          lastError = err;
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 600));
          }
        }
      }
      throw lastError;
    } catch (err) {
      console.error('[NSE MCP] Session init error:', err.message);
      throw err;
    }
  }

  /**
   * Parse Server-Sent Events (SSE) or raw JSON from NSE MCP
   */
  parseMcpResponseText(rawText) {
    if (!rawText) return null;
    
    // Check if rawText starts with event: or data:
    const lines = rawText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          // continue checking other lines
        }
      }
    }

    // Try parsing entire body directly as JSON
    try {
      return JSON.parse(rawText);
    } catch (e) {
      return { raw: rawText };
    }
  }

  /**
   * Call a tool on the NSE MCP server
   */
  async callTool(name, args = {}) {
    await this.initializeSession();

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': DEFAULT_USER_AGENT
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const payload = {
      jsonrpc: '2.0',
      id: ++this.reqId,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    let res;
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetch(NSE_MCP_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12000)
        });
        if (res.ok) break;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!res) {
      throw lastErr || new Error('Failed to reach NSE MCP server');
    }

    const text = await res.text();
    const parsed = this.parseMcpResponseText(text);

    if (parsed && parsed.error) {
      throw new Error(parsed.error.message || 'MCP Error');
    }

    if (parsed && parsed.result) {
      const content = parsed.result.content;
      if (Array.isArray(content) && content.length > 0) {
        const first = content[0];
        if (first.type === 'text') {
          try {
            return JSON.parse(first.text);
          } catch {
            return first.text;
          }
        }
        return first;
      }
      return parsed.result;
    }

    return parsed;
  }

  /**
   * List available tools from the server
   */
  async listTools() {
    if (this.toolsList) return this.toolsList;

    await this.initializeSession();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': DEFAULT_USER_AGENT
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const payload = {
      jsonrpc: '2.0',
      id: ++this.reqId,
      method: 'tools/list'
    };

    let res;
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetch(NSE_MCP_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12000)
        });
        if (res.ok) break;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!res) {
      throw lastErr || new Error('Failed to reach NSE MCP server');
    }

    const text = await res.text();
    const parsed = this.parseMcpResponseText(text);

    if (parsed && parsed.result && parsed.result.tools) {
      this.toolsList = parsed.result.tools;
      return this.toolsList;
    }
    return [];
  }

  /**
   * Extract potential stock symbols from user query
   */
  extractSymbol(query) {
    const commonWords = new Set([
      'WHAT', 'IS', 'THE', 'OF', 'SHOW', 'ME', 'GET', 'FOR', 'AND', 'IN', 'ON', 'TODAY',
      'STOCK', 'PRICE', 'LTP', 'VOLUME', 'ACTION', 'ACTIONS', 'DIVIDEND', 'HIGH', 'LOW',
      '52W', '52-WEEK', 'MOVING', 'AVERAGE', 'SMA', 'MOVERS', 'TOP', 'GAINERS', 'LOSERS',
      'RADAR', 'MARKET', 'MOOD', 'BREADTH', 'NIFTY', 'SENSEX', 'BANKNIFTY', 'CORPORATE'
    ]);

    // Check uppercase words
    const tokens = query.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (!commonWords.has(t) && t.length >= 3 && t.length <= 12) {
        return t;
      }
    }
    return null;
  }

  /**
   * Process a natural language question and respond with NSE MCP data
   */
  async handleQuery(userMessage) {
    const q = (userMessage || '').trim();
    const upper = q.toUpperCase();

    try {
      // 1. Market Mood / Breadth / VIX
      if (upper.includes('MOOD') || upper.includes('BREADTH') || upper.includes('VIX') || upper.includes('SENTIMENT')) {
        const mood = await this.callTool('get_market_mood', { date: 'today' });
        return this.formatMarketMood(mood);
      }

      // 2. Top Movers / Gainers / Losers
      if (upper.includes('GAINER') || upper.includes('TOP GAIN')) {
        const data = await this.callTool('get_top_movers', { date: 'today', n: 5, direction: 'gain' });
        return this.formatTopMovers(data, 'gain');
      }
      if (upper.includes('LOSER') || upper.includes('TOP LOSS') || upper.includes('TOP DROP')) {
        const data = await this.callTool('get_top_movers', { date: 'today', n: 5, direction: 'loss' });
        return this.formatTopMovers(data, 'loss');
      }

      // 3. Top Traded / Volume
      if (upper.includes('VOLUME') || upper.includes('MOST ACTIVE') || upper.includes('TURNOVER') || upper.includes('TOP TRADE')) {
        const data = await this.callTool('get_top_by_volume', { date: 'today', n: 5, sortBy: 'volume' });
        return this.formatTopVolume(data);
      }

      // 4. Index Valuation (P/E, P/B, Dividend yield)
      if (upper.includes('VALUATION') || upper.includes('PE') || upper.includes('P/E') || (upper.includes('RATIO') && upper.includes('NIFTY'))) {
        let indexName = 'Nifty 50';
        if (upper.includes('BANK')) indexName = 'Nifty Bank';
        if (upper.includes('IT')) indexName = 'Nifty IT';
        if (upper.includes('NEXT')) indexName = 'Nifty Next 50';
        if (upper.includes('MIDCAP')) indexName = 'Nifty Midcap 100';

        const data = await this.callTool('get_index_valuation', { indexName, date: 'today' });
        return this.formatIndexValuation(data, indexName);
      }

      // 5. Index Performance
      if (upper.includes('INDEX') && (upper.includes('PERFORMANCE') || upper.includes('RETURN') || upper.includes('RETURNS'))) {
        let indexName = 'Nifty 50';
        if (upper.includes('BANK')) indexName = 'Nifty Bank';
        if (upper.includes('IT')) indexName = 'Nifty IT';
        const data = await this.callTool('get_index_performance', { indexName, date: 'today' });
        return this.formatIndexPerformance(data, indexName);
      }

      // Extract symbol for stock-specific queries
      const symbol = this.extractSymbol(q);

      // 6. Corporate actions (Dividends, Splits, Bonus)
      if (symbol && (upper.includes('DIVIDEND') || upper.includes('SPLIT') || upper.includes('BONUS') || upper.includes('CORPORATE') || upper.includes('ACTION'))) {
        const data = await this.callTool('get_corporate_actions', { symbol });
        return this.formatCorporateActions(data, symbol);
      }

      // 7. Moving averages
      if (symbol && (upper.includes('AVERAGE') || upper.includes('SMA') || upper.includes('DMA') || upper.includes('MOVING'))) {
        let days = 50;
        if (upper.includes('20')) days = 20;
        if (upper.includes('100')) days = 100;
        if (upper.includes('200')) days = 200;

        const val = await this.callTool('moving_average', { symbol, days });
        return this.formatMovingAverage(symbol, days, val);
      }

      // 8. 52-Week High / Low
      if (symbol && (upper.includes('52') || upper.includes('HIGH') || upper.includes('LOW') || upper.includes('RANGE'))) {
        const data = await this.callTool('get_52_week_high_low', { symbol });
        return this.format52WeekHighLow(data, symbol);
      }

      // 9. Stock inquiry with symbol found
      if (symbol) {
        // Fetch 52w range and corporate actions
        const [range, ca] = await Promise.allSettled([
          this.callTool('get_52_week_high_low', { symbol }),
          this.callTool('get_corporate_actions', { symbol })
        ]);

        const rangeData = range.status === 'fulfilled' ? range.value : null;
        const caData = ca.status === 'fulfilled' ? ca.value : null;

        if (rangeData && rangeData.last_close) {
          return this.formatStockSnapshot(symbol, rangeData, caData);
        }

        // If symbol lookup is needed
        const lookup = await this.callTool('nse_lookup_symbol', { query: symbol });
        return this.formatLookup(symbol, lookup);
      }

      // 10. General Help / Default
      return this.formatHelp();

    } catch (err) {
      console.error('[NSE MCP Error]', err);
      return {
        type: 'error',
        text: `Unable to complete query via NSE MCP: ${err.message}. Please verify the symbol or try one of the quick options below.`,
        disclaimer: 'SEBI Disclaimer: For educational and research purposes only.'
      };
    }
  }

  // Formatters with clean presentation & SEBI disclaimer
  formatMarketMood(data) {
    if (!data) return { text: 'No market mood data available at this time.' };
    const date = data.date || 'Latest';
    const vix = data.india_vix || {};
    const stockBreadth = data.stock_breadth || {};
    const indexBreadth = data.index_breadth || {};
    const benchmarks = data.benchmarks || {};

    let html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge blue">NSE Market Mood</span>
          <span class="mcp-date">As of: ${date}</span>
        </div>
        
        <div class="mcp-metrics-grid">
          <div class="mcp-metric-box">
            <span class="label">India VIX</span>
            <span class="value ${vix.change_1d_pct > 0 ? 'red' : 'green'}">${vix.level || 'N/A'}</span>
            <span class="sub">${vix.change_1d_pct ? (vix.change_1d_pct > 0 ? '+' : '') + vix.change_1d_pct + '% 1D' : ''} (${vix.direction || 'steady'})</span>
          </div>
          <div class="mcp-metric-box">
            <span class="label">Stock Breadth</span>
            <span class="value ${stockBreadth.reading === 'broad advance' ? 'green' : (stockBreadth.reading === 'broad decline' ? 'red' : '')}">${stockBreadth.reading || 'Mixed'}</span>
            <span class="sub">▲ ${stockBreadth.up || 0} rose | ▼ ${stockBreadth.down || 0} fell</span>
          </div>
          <div class="mcp-metric-box">
            <span class="label">Index Breadth</span>
            <span class="value">${indexBreadth.reading || 'N/A'}</span>
            <span class="sub">▲ ${indexBreadth.up || 0} / ${indexBreadth.equity_indices || 0} indices up</span>
          </div>
        </div>

        <div class="mcp-benchmarks-list">
          <strong style="display:block; margin: 0.5rem 0 0.25rem; font-size:0.8rem;">Major Benchmarks:</strong>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
    `;

    for (const [name, b] of Object.entries(benchmarks)) {
      const isUp = (b.change_pct || 0) >= 0;
      html += `
        <span class="benchmark-pill ${isUp ? 'up' : 'down'}">
          ${name}: <strong>${b.close?.toLocaleString('en-IN')}</strong> (${isUp ? '+' : ''}${b.change_pct}%)
        </span>
      `;
    }

    html += `
          </div>
        </div>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Educational & research data only from official NSE Bhavcopy. Not investment advice.
        </div>
      </div>
    `;

    return {
      type: 'market_mood',
      html,
      raw: data
    };
  }

  formatTopVolume(data) {
    if (!data || !data.stocks) return { text: 'No volume data available.' };
    const date = data.date || 'Latest';
    let rows = data.stocks.map(s => `
      <tr>
        <td><strong>${s.symbol}</strong></td>
        <td>Rs. ${s.close ? s.close.toFixed(2) : '-'}</td>
        <td class="${s.pct_change >= 0 ? 'green' : 'red'}">${s.pct_change >= 0 ? '+' : ''}${s.pct_change}%</td>
        <td>${(s.volume / 100000).toFixed(1)} Lakh</td>
        <td>Rs. ${(s.traded_value / 10000000).toFixed(2)} Cr</td>
      </tr>
    `).join('');

    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge green">Top Traded Stocks by Volume</span>
          <span class="mcp-date">${date}</span>
        </div>
        <table class="mcp-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Close</th>
              <th>Change</th>
              <th>Volume</th>
              <th>Turnover</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Factual NSE Bhavcopy turnover rankings. Educational use only.
        </div>
      </div>
    `;

    return { type: 'top_volume', html, raw: data };
  }

  formatTopMovers(data, direction) {
    if (!data || !data.stocks) return { text: `No top ${direction} data available.` };
    const isGain = direction === 'gain';
    let rows = data.stocks.map(s => `
      <tr>
        <td><strong>${s.symbol}</strong></td>
        <td>Rs. ${s.close ? s.close.toFixed(2) : '-'}</td>
        <td class="${isGain ? 'green' : 'red'}"><strong>${s.pct_change >= 0 ? '+' : ''}${s.pct_change}%</strong></td>
        <td>Rs. ${s.high ? s.high.toFixed(2) : '-'} / Rs. ${s.low ? s.low.toFixed(2) : '-'}</td>
      </tr>
    `).join('');

    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge ${isGain ? 'green' : 'red'}">Top NSE ${isGain ? 'Gainers' : 'Losers'}</span>
          <span class="mcp-date">${data.date || 'Latest'}</span>
        </div>
        <table class="mcp-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Close</th>
              <th>% Change</th>
              <th>High / Low</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="mcp-disclaimer">
          Note: Computed from unadjusted bhavcopy. Splits/bonuses may appear as price drops. Educational only.
        </div>
      </div>
    `;

    return { type: 'top_movers', html, raw: data };
  }

  format52WeekHighLow(data, symbol) {
    if (!data || !data.last_close) return { text: `Could not retrieve 52-week data for ${symbol}.` };
    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge purple">${data.symbol} – 52-Week Range</span>
          <span class="mcp-date">Trading days: ${data.trading_days || 245}</span>
        </div>
        
        <div class="mcp-range-container">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.35rem;">
            <span>52W Low: <strong>Rs. ${data['52w_low']}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${data['52w_low_date']})</span></span>
            <span>Current: <strong>Rs. ${data.last_close}</strong></span>
            <span>52W High: <strong>Rs. ${data['52w_high']}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${data['52w_high_date']})</span></span>
          </div>
          <div class="mcp-progress-track">
            <div class="mcp-progress-fill" style="width: ${Math.max(0, Math.min(100, data.position_in_range_pct || 50))}%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">
            <span>+${data.from_52w_low_pct}% from low</span>
            <span>Position in Range: <strong>${data.position_in_range_pct}%</strong></span>
            <span>${data.from_52w_high_pct}% from high</span>
          </div>
        </div>

        <div class="mcp-disclaimer">
          SEBI Disclaimer: Historical NSE Bhavcopy calculation. Educational use only.
        </div>
      </div>
    `;

    return { type: '52w_high_low', html, raw: data };
  }

  formatCorporateActions(data, symbol) {
    if (!data || !data.actions || data.actions.length === 0) {
      return {
        type: 'corporate_actions',
        html: `
          <div class="mcp-card">
            <div class="mcp-card-header">
              <span class="mcp-badge blue">${symbol} Corporate Actions</span>
            </div>
            <p style="font-size:0.85rem; padding:0.5rem 0;">No corporate actions found for ${symbol} in the last 5 years of NSE Bhavcopy records.</p>
          </div>
        `
      };
    }

    const rows = data.actions.slice(0, 8).map(a => `
      <tr>
        <td><strong>${a.exDate}</strong></td>
        <td><span class="mcp-tag ${a.actionType.toLowerCase()}">${a.actionType}</span></td>
        <td>${a.purpose}</td>
      </tr>
    `).join('');

    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge blue">${symbol} Corporate Actions</span>
          <span class="mcp-date">${data.actions.length} records</span>
        </div>
        <table class="mcp-table">
          <thead>
            <tr>
              <th>Ex-Date</th>
              <th>Type</th>
              <th>Purpose / Detail</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Sourced from official NSE filings. Educational research only.
        </div>
      </div>
    `;

    return { type: 'corporate_actions', html, raw: data };
  }

  formatMovingAverage(symbol, days, val) {
    const num = typeof val === 'number' ? val.toFixed(2) : val;
    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge purple">${symbol} Moving Average</span>
          <span class="mcp-date">${days}-Day SMA</span>
        </div>
        <div style="padding:0.75rem 0; font-size:1.1rem;">
          The <strong>${days}-day Simple Moving Average</strong> of <strong>${symbol}</strong> is <strong>Rs. ${num}</strong>.
        </div>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Technical indicator calculated over close prices from NSE Bhavcopy.
        </div>
      </div>
    `;
    return { type: 'moving_average', html };
  }

  formatIndexValuation(data, indexName) {
    if (!data) return { text: `No valuation data for ${indexName}.` };
    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge green">${indexName} Valuation Ratios</span>
          <span class="mcp-date">${data.date || 'Latest'}</span>
        </div>
        <div class="mcp-metrics-grid">
          <div class="mcp-metric-box">
            <span class="label">Price / Earnings (P/E)</span>
            <span class="value">${data.pe || data.p_e || 'N/A'}</span>
          </div>
          <div class="mcp-metric-box">
            <span class="label">Price / Book (P/B)</span>
            <span class="value">${data.pb || data.p_b || 'N/A'}</span>
          </div>
          <div class="mcp-metric-box">
            <span class="label">Dividend Yield</span>
            <span class="value">${data.dividend_yield || data.div_yield ? (data.dividend_yield || data.div_yield) + '%' : 'N/A'}</span>
          </div>
        </div>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Published by NSE Index Services. Research & educational only.
        </div>
      </div>
    `;
    return { type: 'index_valuation', html, raw: data };
  }

  formatIndexPerformance(data, indexName) {
    if (!data) return { text: `No performance data for ${indexName}.` };
    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge blue">${indexName} Performance</span>
          <span class="mcp-date">${data.date || 'Latest'}</span>
        </div>
        <div style="font-size:0.85rem; padding:0.5rem 0;">
          Close: <strong>${data.close?.toLocaleString('en-IN') || '-'}</strong> | 1D: <strong>${data.change_1d_pct || 0}%</strong>
        </div>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Educational analysis of NSE Index returns.
        </div>
      </div>
    `;
    return { type: 'index_performance', html, raw: data };
  }

  formatStockSnapshot(symbol, rangeData, caData) {
    let recentCaText = 'No recent corporate actions.';
    if (caData && caData.actions && caData.actions.length > 0) {
      const top = caData.actions[0];
      recentCaText = `Latest CA: ${top.actionType} on ${top.exDate} (${top.purpose})`;
    }

    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge green">${symbol} Snapshot</span>
          <span class="mcp-date">NSE Bhavcopy</span>
        </div>
        
        <div class="mcp-metrics-grid">
          <div class="mcp-metric-box">
            <span class="label">Last Close</span>
            <span class="value">Rs. ${rangeData.last_close}</span>
          </div>
          <div class="mcp-metric-box">
            <span class="label">52W Range</span>
            <span class="value" style="font-size:0.9rem;">Rs. ${rangeData['52w_low']} – ${rangeData['52w_high']}</span>
          </div>
          <div class="mcp-metric-box">
            <span class="label">Range Position</span>
            <span class="value">${rangeData.position_in_range_pct}%</span>
          </div>
        </div>

        <div style="background:var(--surface-subtle); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.8rem; margin:0.5rem 0;">
          ${recentCaText}
        </div>

        <div class="mcp-disclaimer">
          SEBI Disclaimer: Descriptive Bhavcopy historical data. Does not constitute recommendation.
        </div>
      </div>
    `;

    return { type: 'stock_snapshot', html };
  }

  formatLookup(symbol, lookupData) {
    let matches = [];
    if (Array.isArray(lookupData)) matches = lookupData;
    else if (lookupData && lookupData.matches) matches = lookupData.matches;

    const html = `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge blue">NSE Symbol Search: ${symbol}</span>
        </div>
        <p style="font-size:0.85rem; padding:0.5rem 0;">
          Matching NSE Tickers: ${matches.length > 0 ? matches.map(m => `<code>${m}</code>`).join(', ') : 'None found.'}
        </p>
      </div>
    `;
    return { type: 'lookup', html };
  }

  formatHelp() {
    return {
      type: 'help',
      html: `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge blue">NSE Live Assistant</span>
          </div>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;">
            I am connected directly to the official <strong>NSE Bhavcopy MCP</strong> server (<code>mcp.nseindia.in</code>). Ask me anything about NSE equities and indices!
          </p>
          <div style="font-size:0.8rem; line-height:1.6;">
            <strong>Try asking:</strong>
            <ul style="padding-left:1.25rem; margin-top:0.25rem;">
              <li>"What is the market mood and VIX today?"</li>
              <li>"Show top traded stocks by volume"</li>
              <li>"Who are the top gainers / losers?"</li>
              <li>"Get 52-week high and low of HAL"</li>
              <li>"What are recent corporate actions / dividends for MUTHOOTFIN?"</li>
              <li>"What is the 50-day moving average of INFY?"</li>
              <li>"What is the P/E valuation of Nifty 50?"</li>
            </ul>
          </div>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Educational and research purposes only. Not investment advice.
          </div>
        </div>
      `
    };
  }
}
