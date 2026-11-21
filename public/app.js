// Pre-Results Radar Frontend Application
// Strictly complies with Modern Web Guidance and Radar Engine rules

document.addEventListener('DOMContentLoaded', () => {
  // Theme Management (Modern Web Guidance compliance)
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  function getSystemScheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getEffectiveScheme() {
    const stored = localStorage.getItem('color-scheme');
    if (stored === 'dark' || stored === 'light') return stored;
    return getSystemScheme();
  }

  function updateThemeUI() {
    const scheme = getEffectiveScheme();
    themeIcon.textContent = scheme === 'dark' ? '☀️' : '🌙';
    themeToggleBtn.setAttribute('title', `Switch to ${scheme === 'dark' ? 'light' : 'dark'} mode`);
  }

  themeToggleBtn.addEventListener('click', () => {
    const current = getEffectiveScheme();
    const target = current === 'dark' ? 'light' : 'dark';
    const system = getSystemScheme();

    if (target === system) {
      localStorage.removeItem('color-scheme');
      metaColorScheme.content = 'light dark';
    } else {
      localStorage.setItem('color-scheme', target);
      metaColorScheme.content = target;
    }
    updateThemeUI();
  });

  window.addEventListener('storage', () => {
    const stored = localStorage.getItem('color-scheme') ?? 'light dark';
    metaColorScheme.content = stored;
    updateThemeUI();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem('color-scheme')) {
      updateThemeUI();
    }
  });

  updateThemeUI();

  // State
  let radarData = null;
  let starredSet = new Set(JSON.parse(localStorage.getItem('radar_starred') || '[]'));
  let notesMap = JSON.parse(localStorage.getItem('radar_notes') || '{}');
  let tradePlansMap = JSON.parse(localStorage.getItem('radar_trade_plans') || '{}');
  let activeStockForNote = null;
  let activeStockForPlan = null;

  // DOM Elements
  const liveTimestamp = document.getElementById('live-timestamp');
  const footerVerifiedDate = document.getElementById('footer-verified-date');
  const searchInput = document.getElementById('search-input');
  const mcapFilter = document.getElementById('mcap-filter');
  const sectorFilter = document.getElementById('sector-filter');
  const starredToggle = document.getElementById('starred-toggle');
  const plansToggle = document.getElementById('plans-toggle');
  const quietToggle = document.getElementById('quiet-toggle');
  const archiveSelect = document.getElementById('archive-select');
  const btnForceRefresh = document.getElementById('btn-force-refresh');

  const overviewScrollContainer = document.getElementById('overview-scroll-container');
  const catGridA = document.getElementById('grid-A');
  const catGridB = document.getElementById('grid-B');
  const catGridC = document.getElementById('grid-C');
  const catGridD = document.getElementById('grid-D');
  const countA = document.getElementById('count-A');
  const countB = document.getElementById('count-B');
  const countC = document.getElementById('count-C');
  const countD = document.getElementById('count-D');
  const blockD = document.getElementById('cat-block-D');

  const changesList = document.getElementById('changes-list');
  const changesCountBadge = document.getElementById('changes-count-badge');
  const exclusionsTbody = document.getElementById('exclusions-tbody');
  const exclusionsCountBadge = document.getElementById('exclusions-count-badge');

  // Export Modal Elements
  const exportModal = document.getElementById('export-modal');
  const btnExportOpen = document.getElementById('btn-export-open');
  const btnCloseExport = document.getElementById('btn-close-export');
  const btnDismissExport = document.getElementById('btn-dismiss-export');
  const exportTextarea = document.getElementById('export-textarea');
  const btnCopyWhatsapp = document.getElementById('btn-copy-whatsapp');
  const btnCopyMarkdown = document.getElementById('btn-copy-markdown');

  // Notes Modal Elements
  const notesModal = document.getElementById('notes-modal');
  const notesModalTitle = document.getElementById('notes-modal-title');
  const stockNotesInput = document.getElementById('stock-notes-input');
  const btnSaveNote = document.getElementById('btn-save-note');
  const btnCloseNotes = document.getElementById('btn-close-notes');
  const btnDismissNotes = document.getElementById('btn-dismiss-notes');
  const notesSaveStatus = document.getElementById('notes-save-status');

  // Trade Plan Modal Elements
  const tradePlanModal = document.getElementById('trade-plan-modal');
  const tradePlanTitle = document.getElementById('trade-plan-title');
  const modalInvalidationText = document.getElementById('modal-invalidation-text');
  const modalVolatilityText = document.getElementById('modal-volatility-text');
  const planEntryInput = document.getElementById('plan-entry-input');
  const planStopInput = document.getElementById('plan-stop-input');
  const planTargetInput = document.getElementById('plan-target-input');
  const planNotesInput = document.getElementById('plan-notes-input');
  const planCalcSummary = document.getElementById('plan-calc-summary');
  const calcRiskVal = document.getElementById('calc-risk-val');
  const calcTarget1to2 = document.getElementById('calc-target-1to2');
  const calcRrVal = document.getElementById('calc-rr-val');
  const btnSaveTradePlan = document.getElementById('btn-save-trade-plan');
  const btnClearTradePlan = document.getElementById('btn-clear-trade-plan');
  const btnCloseTradePlan = document.getElementById('btn-close-trade-plan');
  const btnDismissTradePlan = document.getElementById('btn-dismiss-trade-plan');

  // Fetch Radar Data & Trade Plans (with GitHub Pages static fallback & cache-busting)
  async function loadRadarData() {
    const t = Date.now();
    let loaded = false;
    try {
      const res = await fetch(`/api/radar?_t=${t}`, { cache: 'no-store' });
      if (res.ok) {
        radarData = await res.json();
        loaded = true;
      }
    } catch (err) {}

    // Fallback to static JSON for GitHub Pages hosting with cache-busting
    if (!loaded) {
      try {
        const staticRes = await fetch(`./data/radar.json?_t=${t}`, { cache: 'no-store' });
        if (staticRes.ok) {
          radarData = await staticRes.json();
          loaded = true;
        }
      } catch (err) {
        console.error('Static radar fallback error:', err);
      }
    }

    if (radarData) {
      populateSectorFilter(radarData);

      // Also sync trade plans from backend if available
      try {
        const plansRes = await fetch(`/api/plans?_t=${t}`, { cache: 'no-store' });
        if (plansRes.ok) {
          const serverPlans = await plansRes.json();
          tradePlansMap = { ...tradePlansMap, ...serverPlans };
          localStorage.setItem('radar_trade_plans', JSON.stringify(tradePlansMap));
        }
      } catch (e) {}

      renderAll();
      loadArchiveList();
    }
  }

  async function loadArchiveList() {
    const t = Date.now();
    let archives = [];
    try {
      const res = await fetch(`/api/archive?_t=${t}`, { cache: 'no-store' });
      if (res.ok) archives = await res.json();
    } catch (err) {}

    if (!archives.length) {
      try {
        const staticRes = await fetch(`./data/archive.json?_t=${t}`, { cache: 'no-store' });
        if (staticRes.ok) archives = await staticRes.json();
      } catch (e) {}
    }

    archiveSelect.innerHTML = `<option value="latest">Current Radar (Today)</option>`;
    archives.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${item.run_date} (${item.run_time_ist})`;
      archiveSelect.appendChild(opt);
    });
  }

  archiveSelect.addEventListener('change', async (e) => {
    if (e.target.value === 'latest') {
      loadRadarData();
    } else {
      try {
        const t = Date.now();
        let archives = [];
        const res = await fetch(`/api/archive?_t=${t}`, { cache: 'no-store' });
        if (res.ok) archives = await res.json();
        else {
          const sRes = await fetch(`./data/archive.json?_t=${t}`, { cache: 'no-store' });
          if (sRes.ok) archives = await sRes.json();
        }
        const selected = archives[e.target.value];
        if (selected && selected.data) {
          radarData = selected.data;
          renderAll();
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  function getClientCurrentIST() {
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
    const m = {};
    for (const p of parts) m[p.type] = p.value;
    return {
      date: `${m.day} ${m.month} ${m.year}`,
      time: `${m.hour}:${m.minute} IST`
    };
  }

  btnForceRefresh.addEventListener('click', async () => {
    btnForceRefresh.disabled = true;
    btnForceRefresh.innerHTML = `Refreshing...`;
    const t = Date.now();
    try {
      let refreshed = false;
      try {
        const res = await fetch(`/api/refresh?_t=${t}`, { method: 'POST', cache: 'no-store' });
        if (res.ok) {
          radarData = await res.json();
          refreshed = true;
        }
      } catch (e) {}

      if (!refreshed) {
        const staticRes = await fetch(`./data/radar.json?_t=${t}`, { cache: 'no-store' });
        if (staticRes.ok) {
          radarData = await staticRes.json();
        }
      }
      if (radarData) {
        const currentNow = getClientCurrentIST();
        radarData.meta.last_updated = `${currentNow.date}, ${currentNow.time}`;
        radarData.meta.verified_on = currentNow.date;
      }
      renderAll();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      btnForceRefresh.disabled = false;
      btnForceRefresh.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Force Refresh
      `;
    }
  });

  function populateSectorFilter(data) {
    const sectors = new Set();
    const addSectors = (items) => {
      if (!items) return;
      items.forEach(i => { if (i.sector) sectors.add(i.sector); });
    };
    addSectors(data.categories.A);
    addSectors(data.categories.B);
    addSectors(data.categories.C);
    addSectors(data.categories.D);

    sectorFilter.innerHTML = '<option value="all">All Sectors</option>';
    Array.from(sectors).sort().forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec;
      opt.textContent = sec;
      sectorFilter.appendChild(opt);
    });
  }

  function itemMatchesFilter(item) {
    const searchVal = searchInput.value.trim().toLowerCase();
    const selectedMcap = mcapFilter.value;
    const selectedSector = sectorFilter.value;
    const starredOnly = starredToggle.checked;
    const plansOnly = plansToggle.checked;
    const quietMode = quietToggle.checked;

    if (searchVal && !item.name.toLowerCase().includes(searchVal)) {
      return false;
    }
    if (selectedMcap !== 'all' && item.mcap_list !== selectedMcap) {
      return false;
    }
    if (selectedSector !== 'all' && item.sector !== selectedSector) {
      return false;
    }
    if (starredOnly && !starredSet.has(item.name)) {
      return false;
    }
    if (plansOnly && (!tradePlansMap[item.name] || !tradePlansMap[item.name].entry_price)) {
      return false;
    }
    if (quietMode && item.verified_by === 'Estimate-heavy') {
      return false;
    }
    return true;
  }

  function renderStockCard(item) {
    const isStarred = starredSet.has(item.name);
    const hasNote = Boolean(notesMap[item.name]);
    const plan = tradePlansMap[item.name];
    const hasPlan = Boolean(plan && plan.entry_price && plan.stop_loss_price);

    const card = document.createElement('article');
    card.className = 'stock-card';

    let sourceBadgeClass = 'badge-source-exchange';
    if (item.verified_by === 'Multi-calendar') sourceBadgeClass = 'badge-source-calendar';
    else if (item.verified_by === 'Estimate-heavy') sourceBadgeClass = 'badge-source-estimate';

    // Trade Plan pill HTML if active
    let tradePlanPillHtml = '';
    if (hasPlan) {
      const riskAmount = (plan.entry_price - plan.stop_loss_price).toFixed(1);
      const riskPct = (((plan.entry_price - plan.stop_loss_price) / plan.entry_price) * 100).toFixed(1);
      const rrText = plan.risk_reward_ratio ? ` | R:R 1:${plan.risk_reward_ratio}` : '';
      tradePlanPillHtml = `
        <div style="background:#eff6ff; border:1px solid #93c5fd; border-radius:var(--radius-sm); padding:0.4rem 0.6rem; font-size:0.75rem; color:#1e40af; margin-top:0.25rem; display:flex; justify-content:space-between; align-items:center;">
          <span>🎯 <strong>Planned Entry:</strong> Rs. ${plan.entry_price} | <strong>SL:</strong> Rs. ${plan.stop_loss_price} (-${riskPct}%)${rrText}</span>
          <button class="btn-edit-plan" data-name="${item.name}" style="background:none; border:none; cursor:pointer; color:#1d4ed8; text-decoration:underline; font-size:0.75rem;">Edit</button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-group">
          <h3 class="company-name">${item.name}</h3>
          <div class="results-date-line">Results date: ${item.results_date_formatted}</div>
        </div>
        <div class="card-actions">
          <button class="star-btn ${isStarred ? 'active' : ''}" data-name="${item.name}" title="Star / Shortlist">
            ${isStarred ? '★' : '☆'}
          </button>
        </div>
      </div>

      <div class="badges-row">
        <span class="badge ${sourceBadgeClass}">${item.verified_by}</span>
        <span class="badge badge-mcap">${item.mcap_list}</span>
        <span class="badge" style="background:var(--surface-subtle); color:var(--text-muted);">${item.sector}</span>
      </div>

      <ul class="card-bullets">
        <li class="bullet-item bullet-edge">
          <span class="bullet-icon">•</span>
          <span>${item.reason_qualitative}</span>
        </li>
        <li class="bullet-item bullet-key">
          <span class="bullet-icon">•</span>
          <span class="key-highlight">${item.key_number}</span>
        </li>
        <li class="bullet-item bullet-risk">
          <span class="bullet-icon">•</span>
          <span>${item.catalyst_or_risk}</span>
        </li>
        ${item.event_invalidation ? `
        <li class="bullet-item" style="border-top:1px dashed var(--border); padding-top:0.35rem; font-size:0.75rem; color:var(--text-muted);">
          <span class="bullet-icon" style="color:#ef4444;">✕</span>
          <span><strong>Thesis Invalidation:</strong> ${item.event_invalidation}</span>
        </li>` : ''}
        ${item.volatility_buffer ? `
        <li class="bullet-item" style="font-size:0.72rem; color:#2563eb;">
          <span class="bullet-icon" style="color:#2563eb;">⚡</span>
          <span><strong>Event Move Band:</strong> ${item.volatility_buffer}</span>
        </li>` : ''}
      </ul>

      ${tradePlanPillHtml}

      <div class="note-footer">
        <button class="btn-plan-trade" data-name="${item.name}" style="background:none; border:none; cursor:pointer; color:#059669; font-weight:600; display:inline-flex; align-items:center; gap:0.25rem;">
          🛡️ ${hasPlan ? 'Update Entry & Stop Loss' : '+ Set Entry & Stop Loss'}
        </button>
        <button class="btn-note" data-name="${item.name}">
          ${hasNote ? '📝 Edit Thesis' : '📝 Notes'}
        </button>
      </div>
    `;

    // Event listeners
    const starBtn = card.querySelector('.star-btn');
    starBtn.addEventListener('click', () => toggleStar(item.name, starBtn));

    const noteBtn = card.querySelector('.btn-note');
    noteBtn.addEventListener('click', () => openNotesModal(item.name));

    const planBtn = card.querySelector('.btn-plan-trade');
    planBtn.addEventListener('click', () => openTradePlanModal(item));

    const editPlanBtn = card.querySelector('.btn-edit-plan');
    if (editPlanBtn) {
      editPlanBtn.addEventListener('click', () => openTradePlanModal(item));
    }

    return card;
  }

  function toggleStar(name, btn) {
    if (starredSet.has(name)) {
      starredSet.delete(name);
      btn.classList.remove('active');
      btn.textContent = '☆';
    } else {
      starredSet.add(name);
      btn.classList.add('active');
      btn.textContent = '★';
    }
    localStorage.setItem('radar_starred', JSON.stringify(Array.from(starredSet)));
    fetch('/api/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_name: name })
    }).catch(console.warn);

    if (starredToggle.checked) {
      renderAll();
    }
  }

  function openNotesModal(name) {
    activeStockForNote = name;
    notesModalTitle.textContent = `Personal Thesis: ${name}`;
    stockNotesInput.value = notesMap[name] || '';
    notesSaveStatus.style.display = 'none';
    notesModal.classList.add('open');
  }

  btnSaveNote.addEventListener('click', () => {
    if (!activeStockForNote) return;
    const text = stockNotesInput.value.trim();
    if (text) {
      notesMap[activeStockForNote] = text;
    } else {
      delete notesMap[activeStockForNote];
    }
    localStorage.setItem('radar_notes', JSON.stringify(notesMap));
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_name: activeStockForNote, notes: text })
    }).catch(console.warn);

    notesSaveStatus.style.display = 'inline';
    setTimeout(() => {
      notesSaveStatus.style.display = 'none';
    }, 1500);
    renderAll();
  });

  const closeNotesHandler = () => notesModal.classList.remove('open');
  btnCloseNotes.addEventListener('click', closeNotesHandler);
  btnDismissNotes.addEventListener('click', closeNotesHandler);

  // Trade Plan Modal Logic
  function openTradePlanModal(item) {
    activeStockForPlan = item;
    tradePlanTitle.textContent = `Entry & Stop Loss Planning: ${item.name}`;
    modalInvalidationText.textContent = item.event_invalidation ? `Thesis Invalidation: ${item.event_invalidation}` : 'Maintain strict invalidation on results announcement.';
    modalVolatilityText.textContent = item.volatility_buffer ? `Expected Event Volatility: ${item.volatility_buffer}` : '';

    const existing = tradePlansMap[item.name];
    if (existing) {
      planEntryInput.value = existing.entry_price || '';
      planStopInput.value = existing.stop_loss_price || '';
      planTargetInput.value = existing.target_price || '';
      planNotesInput.value = existing.notes || '';
    } else {
      planEntryInput.value = '';
      planStopInput.value = '';
      planTargetInput.value = '';
      planNotesInput.value = '';
    }
    recalculatePlan();
    tradePlanModal.classList.add('open');
  }

  function recalculatePlan() {
    const entry = parseFloat(planEntryInput.value);
    const stop = parseFloat(planStopInput.value);
    const target = parseFloat(planTargetInput.value);

    if (entry && stop && entry > stop) {
      const risk = entry - stop;
      const riskPct = ((risk / entry) * 100).toFixed(2);
      const target2x = (entry + (risk * 2)).toFixed(2);

      calcRiskVal.textContent = `Rs. ${risk.toFixed(2)} (-${riskPct}%)`;
      calcTarget1to2.textContent = `Rs. ${target2x}`;

      if (target && target > entry) {
        const reward = target - entry;
        const rr = (reward / risk).toFixed(2);
        calcRrVal.textContent = `1 : ${rr}`;
      } else {
        calcRrVal.textContent = `1 : 2.0 (Target at Rs. ${target2x})`;
      }
      planCalcSummary.style.display = 'block';
    } else {
      planCalcSummary.style.display = 'none';
    }
  }

  planEntryInput.addEventListener('input', recalculatePlan);
  planStopInput.addEventListener('input', recalculatePlan);
  planTargetInput.addEventListener('input', recalculatePlan);

  btnSaveTradePlan.addEventListener('click', async () => {
    if (!activeStockForPlan) return;
    const entry = parseFloat(planEntryInput.value);
    const stop = parseFloat(planStopInput.value);
    const target = parseFloat(planTargetInput.value) || null;
    const notes = planNotesInput.value.trim();

    if (!entry || !stop) {
      alert('Please enter both Planned Entry and Stop Loss prices.');
      return;
    }
    if (stop >= entry) {
      alert('Stop loss price must be lower than planned entry price.');
      return;
    }

    const payload = {
      stock_name: activeStockForPlan.name,
      entry_price: entry,
      stop_loss_price: stop,
      target_price: target,
      notes: notes
    };

    tradePlansMap[activeStockForPlan.name] = payload;
    localStorage.setItem('radar_trade_plans', JSON.stringify(tradePlansMap));

    try {
      await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn(e);
    }

    tradePlanModal.classList.remove('open');
    renderAll();
  });

  btnClearTradePlan.addEventListener('click', async () => {
    if (!activeStockForPlan) return;
    delete tradePlansMap[activeStockForPlan.name];
    localStorage.setItem('radar_trade_plans', JSON.stringify(tradePlansMap));

    try {
      await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_name: activeStockForPlan.name,
          entry_price: null,
          stop_loss_price: null,
          target_price: null,
          notes: ''
        })
      });
    } catch (e) {
      console.warn(e);
    }

    tradePlanModal.classList.remove('open');
    renderAll();
  });

  const closeTradePlanHandler = () => tradePlanModal.classList.remove('open');
  btnCloseTradePlan.addEventListener('click', closeTradePlanHandler);
  btnDismissTradePlan.addEventListener('click', closeTradePlanHandler);

  function renderCategoryGrid(gridEl, countEl, items) {
    gridEl.innerHTML = '';
    const filtered = items.filter(itemMatchesFilter);
    countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          No names currently meet the strict criteria for this section.
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      gridEl.appendChild(renderStockCard(item));
    });
  }

  function renderOverview(calendarDays) {
    overviewScrollContainer.innerHTML = '';
    calendarDays.forEach(day => {
      const col = document.createElement('div');
      col.className = 'day-column';

      col.innerHTML = `
        <div class="day-title">
          <span>${day.dayName.split(' ')[0]}</span>
          <span class="day-badge">${day.items.length}</span>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">${day.date}</div>
      `;

      if (day.items.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:0.5rem 0;';
        emptyDiv.textContent = 'No names scheduled';
        col.appendChild(emptyDiv);
      } else {
        day.items.forEach(it => {
          let tagClass = 'tag-b';
          if (it.tag.includes('A –')) tagClass = 'tag-a';
          else if (it.tag.includes('D –')) tagClass = 'tag-d';

          const itemDiv = document.createElement('div');
          itemDiv.className = 'day-item';
          itemDiv.innerHTML = `
            <span class="day-item-tag ${tagClass}">${it.tag.split('–')[0].trim()}</span>
            <div class="day-item-name">${it.name}</div>
            <div style="color:var(--text-muted); font-size:0.7rem; line-height:1.3;">${it.one_line_reason}</div>
          `;
          col.appendChild(itemDiv);
        });
      }

      overviewScrollContainer.appendChild(col);
    });
  }

  function renderChanges(changes) {
    changesList.innerHTML = '';
    changesCountBadge.textContent = `(${changes.length} updates)`;
    changes.forEach(ch => {
      const li = document.createElement('li');
      li.className = 'change-item';
      let tagClass = 'tag-verified';
      if (ch.type === 'added') tagClass = 'tag-added';
      if (ch.type === 'pruned') tagClass = 'tag-pruned';

      li.innerHTML = `
        <span class="change-tag ${tagClass}">${ch.type}</span>
        <strong>${ch.name}:</strong>
        <span style="color:var(--text-main);">${ch.note}</span>
      `;
      changesList.appendChild(li);
    });
  }

  function renderExclusions(exclusions) {
    exclusionsTbody.innerHTML = '';
    exclusionsCountBadge.textContent = `(${exclusions.length} dropped)`;
    exclusions.forEach(exc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${exc.name}</strong></td>
        <td>${exc.sector || '—'}</td>
        <td><span class="badge badge-mcap">${exc.mcap_list || 'Filtered'}</span></td>
        <td><span class="exclusion-badge">Rule screen</span> ${exc.reason}</td>
      `;
      exclusionsTbody.appendChild(tr);
    });
  }

  function renderAll() {
    if (!radarData) return;

    const currentNow = getClientCurrentIST();
    const displayLastUpdated = radarData.meta.last_updated || `${currentNow.date}, ${currentNow.time}`;
    const displayVerifiedOn = radarData.meta.verified_on || currentNow.date;

    liveTimestamp.innerHTML = `
      <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981;"></span>
      Last Updated: ${displayLastUpdated}
    `;
    footerVerifiedDate.textContent = displayVerifiedOn;

    if (quietToggle.checked) {
      blockD.style.display = 'none';
    } else {
      blockD.style.display = 'block';
    }

    renderCategoryGrid(catGridA, countA, radarData.categories.A);
    renderCategoryGrid(catGridB, countB, radarData.categories.B);
    renderCategoryGrid(catGridC, countC, radarData.categories.C);
    if (!quietToggle.checked) {
      renderCategoryGrid(catGridD, countD, radarData.categories.D);
    }

    renderOverview(radarData.one_week_overview);
    renderChanges(radarData.changes_since_yesterday);
    renderExclusions(radarData.exclusions);
  }

  searchInput.addEventListener('input', renderAll);
  mcapFilter.addEventListener('change', renderAll);
  sectorFilter.addEventListener('change', renderAll);
  starredToggle.addEventListener('change', renderAll);
  plansToggle.addEventListener('change', renderAll);
  quietToggle.addEventListener('change', renderAll);

  function generateClientWhatsAppText(radar) {
    if (!radar) return '';
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

  function generateClientMarkdown(radar) {
    if (!radar) return '';
    const lines = [];
    lines.push(`# Pre-Results Radar (NSE/BSE Main Board)`);
    lines.push(`**Last Updated**: ${radar.meta.last_updated}`);
    lines.push(`**Verified on**: ${radar.meta.verified_on}\n`);
    lines.push(`> Absolute Rules Applied: No prices. No tickers. No internal scores. No buy/sell recommendations. Empty sections remain unpadded.\n`);

    const renderCategory = (title, description, items) => {
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

    renderCategory('Category A – Very Positive', 'High internal score backed by consistent filings, strong revenue/profit growth, and high delivery run-rate.', radar.categories.A);
    renderCategory('Category B – Decent Positive', 'Decent positive business updates, stable margin expectations, and steady volume performance.', radar.categories.B);
    renderCategory('Category C – Tomorrow', 'All verified main-board names reporting the next trading day.', radar.categories.C);
    renderCategory('Category D – Turnaround · Risky', 'Weak previous quarter with hard, verifiable recovery evidence only.', radar.categories.D);

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
    for (const exc of radar.exclusions) {
      lines.push(`- **${exc.name}** (${exc.sector}): ${exc.reason}`);
    }
    lines.push(``);
    lines.push(`---\n*Verified on: ${radar.meta.verified_on} | Pre-Results Radar Engine*`);
    return lines.join('\n');
  }

  btnExportOpen.addEventListener('click', async () => {
    let text = '';
    try {
      const res = await fetch('/api/export/whatsapp');
      if (res.ok) text = await res.text();
    } catch (e) {}
    if (!text && radarData) {
      text = generateClientWhatsAppText(radarData);
    }
    exportTextarea.value = text;
    exportModal.classList.add('open');
  });

  const closeExportHandler = () => exportModal.classList.remove('open');
  btnCloseExport.addEventListener('click', closeExportHandler);
  btnDismissExport.addEventListener('click', closeExportHandler);

  btnCopyWhatsapp.addEventListener('click', async () => {
    let text = '';
    try {
      const res = await fetch('/api/export/whatsapp');
      if (res.ok) text = await res.text();
    } catch (e) {}
    if (!text && radarData) {
      text = generateClientWhatsAppText(radarData);
    }
    exportTextarea.value = text;
    await navigator.clipboard.writeText(text);
    btnCopyWhatsapp.textContent = 'Copied!';
    setTimeout(() => { btnCopyWhatsapp.textContent = 'Copy WhatsApp / Telegram'; }, 2000);
  });

  btnCopyMarkdown.addEventListener('click', async () => {
    let text = '';
    try {
      const res = await fetch('/api/export/markdown');
      if (res.ok) text = await res.text();
    } catch (e) {}
    if (!text && radarData) {
      text = generateClientMarkdown(radarData);
    }
    exportTextarea.value = text;
    await navigator.clipboard.writeText(text);
    btnCopyMarkdown.textContent = 'Copied!';
    setTimeout(() => { btnCopyMarkdown.textContent = 'Copy Markdown'; }, 2000);
  });

  loadRadarData();
});
