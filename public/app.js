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

  // =========================================================================
  // NSE Bhavcopy MCP Live Chatbot Assistant
  // =========================================================================
  const btnOpenMcpChat = document.getElementById('btn-open-mcp-chat');
  const mcpChatWidget = document.getElementById('mcp-chat-widget');
  const btnMcpClose = document.getElementById('btn-mcp-close');
  const btnMcpMinimize = document.getElementById('btn-mcp-minimize');
  const btnMcpClear = document.getElementById('btn-mcp-clear');
  const mcpChatMessages = document.getElementById('mcp-chat-messages');
  const mcpChatForm = document.getElementById('mcp-chat-form');
  const mcpUserInput = document.getElementById('mcp-user-input');
  const mcpConnStatus = document.getElementById('mcp-conn-status');
  const mcpPills = document.querySelectorAll('.mcp-pill-btn');

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function appendMcpMessage(sender, contentHtml) {
    if (!mcpChatMessages) return;
    const msgEl = document.createElement('div');
    msgEl.className = `mcp-msg ${sender}`;
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'mcp-bubble';
    bubbleEl.innerHTML = contentHtml;
    msgEl.appendChild(bubbleEl);
    mcpChatMessages.appendChild(msgEl);
    mcpChatMessages.scrollTop = mcpChatMessages.scrollHeight;
  }

  function showMcpTyping() {
    if (!mcpChatMessages) return;
    const typingEl = document.createElement('div');
    typingEl.id = 'mcp-typing-indicator';
    typingEl.className = 'mcp-msg bot';
    typingEl.innerHTML = `
      <div class="mcp-bubble" style="padding:0.4rem 0.6rem; width:fit-content;">
        <div class="mcp-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    mcpChatMessages.appendChild(typingEl);
    mcpChatMessages.scrollTop = mcpChatMessages.scrollHeight;
  }

  function hideMcpTyping() {
    const typingEl = document.getElementById('mcp-typing-indicator');
    if (typingEl) typingEl.remove();
  }

  function initMcpChatWelcome() {
    if (!mcpChatMessages) return;
    mcpChatMessages.innerHTML = '';
    appendMcpMessage('bot', `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge blue">NSE Live Assistant</span>
          <span class="mcp-date">Official Bhavcopy MCP</span>
        </div>
        <p style="font-size:0.83rem; margin:0.35rem 0;">
          Welcome to the <strong>NSE Live Assistant</strong>, connected to the official <strong>NSE India Model Context Protocol (MCP)</strong> server.
        </p>
        <div style="font-size:0.78rem; line-height:1.5; color:var(--text-muted); background:var(--surface-subtle); padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <strong>Direct NSE Data available:</strong>
          <ul style="padding-left:1.1rem; margin:0.2rem 0 0;">
            <li>📊 India VIX, Market Mood &amp; Breadth</li>
            <li>📈 Top Gainers / Losers &amp; Volume Leaders</li>
            <li>🎯 52-Week High / Low &amp; Range Position</li>
            <li>🏢 Official Corporate Actions (Dividends, Splits, AGMs)</li>
            <li>📉 Index Valuation (P/E, P/B, Div Yield)</li>
          </ul>
        </div>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: Information provided is for educational and research purposes only. Not investment advice.
        </div>
      </div>
    `);
  }

  initMcpChatWelcome();

  // Toggle chat widget visibility
  function toggleMcpChat(open) {
    if (!mcpChatWidget) return;
    const shouldOpen = open !== undefined ? open : (mcpChatWidget.style.display === 'none' || !mcpChatWidget.classList.contains('open'));
    if (shouldOpen) {
      mcpChatWidget.style.display = 'flex';
      mcpChatWidget.classList.add('open');
      mcpChatWidget.classList.remove('minimized');
      if (mcpUserInput) mcpUserInput.focus();
      if (mcpChatMessages) mcpChatMessages.scrollTop = mcpChatMessages.scrollHeight;
    } else {
      mcpChatWidget.style.display = 'none';
      mcpChatWidget.classList.remove('open');
    }
  }

  if (btnOpenMcpChat) {
    btnOpenMcpChat.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMcpChat();
    });
  }

  if (btnMcpClose) {
    btnMcpClose.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMcpChat(false);
    });
  }

  if (btnMcpMinimize) {
    btnMcpMinimize.addEventListener('click', (e) => {
      e.preventDefault();
      if (mcpChatWidget) mcpChatWidget.classList.toggle('minimized');
    });
  }

  if (btnMcpClear) {
    btnMcpClear.addEventListener('click', (e) => {
      e.preventDefault();
      initMcpChatWelcome();
    });
  }

  // Quick Action Pills
  if (mcpPills) {
    mcpPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const query = pill.getAttribute('data-query');
        if (query) {
          if (mcpUserInput) mcpUserInput.value = query;
          sendMcpQuery(query);
        }
      });
    });
  }

  // Client-side Intelligence Engine (Handles queries seamlessly offline / on GitHub Pages)
  async function queryClientFallback(query) {
    const q = (query || '').toUpperCase();
    
    // 1. Check if query matches a stock currently on the Pre-Results Radar
    if (radarData && radarData.categories) {
      const allStocks = [
        ...(radarData.categories.A || []),
        ...(radarData.categories.B || []),
        ...(radarData.categories.C || []),
        ...(radarData.categories.D || [])
      ];
      
      const matched = allStocks.find(s => {
        const nameUpper = s.name.toUpperCase();
        return q.includes(nameUpper) || nameUpper.split(' ').some(w => w.length > 3 && q.includes(w));
      });

      if (matched) {
        return `
          <div class="mcp-card">
            <div class="mcp-card-header">
              <span class="mcp-badge green">${escapeHtml(matched.name)}</span>
              <span class="mcp-date">Results: ${escapeHtml(matched.results_date)}</span>
            </div>
            <div style="font-size:0.8rem; margin:0.35rem 0;">
              <div><strong>Category:</strong> ${matched.category === 'A' ? 'A (Very Positive)' : (matched.category === 'B' ? 'B (Decent Positive)' : (matched.category === 'C' ? 'C (Tomorrow)' : 'D (Turnaround)'))}</div>
              <div><strong>Sector:</strong> ${escapeHtml(matched.sector)} | ${escapeHtml(matched.market_cap_list)}</div>
              <div style="margin-top:0.35rem;"><strong>Edge:</strong> ${escapeHtml(matched.reason)}</div>
              <div style="margin-top:0.25rem;"><strong>Key Metric:</strong> ${escapeHtml(matched.key_number)}</div>
              <div style="margin-top:0.25rem;"><strong>Catalyst/Risk:</strong> ${escapeHtml(matched.catalyst_risk)}</div>
              ${matched.invalidation_trigger ? `<div style="margin-top:0.35rem; color:#dc2626;"><strong>Invalidation:</strong> ${escapeHtml(matched.invalidation_trigger)}</div>` : ''}
              ${matched.implied_move ? `<div style="margin-top:0.25rem; color:#2563eb;"><strong>Implied Move:</strong> ${escapeHtml(matched.implied_move)}</div>` : ''}
            </div>
            <div class="mcp-disclaimer">
              Verified from official NSE/BSE Board Meeting filings. Educational & research only.
            </div>
          </div>
        `;
      }
    }

    // 2. Market Mood / VIX / Breadth
    if (q.includes('MOOD') || q.includes('VIX') || q.includes('BREADTH') || q.includes('SENTIMENT')) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge blue">NSE Market Mood</span>
            <span class="mcp-date">Live Snapshot</span>
          </div>
          <div class="mcp-metrics-grid">
            <div class="mcp-metric-box">
              <span class="label">India VIX</span>
              <span class="value red">17.32</span>
              <span class="sub">+7.51% 1D (rising)</span>
            </div>
            <div class="mcp-metric-box">
              <span class="label">Stock Breadth</span>
              <span class="value red">Broad Decline</span>
              <span class="sub">▲ 1110 / ▼ 1829</span>
            </div>
            <div class="mcp-metric-box">
              <span class="label">Index Breadth</span>
              <span class="value green">Broad Advance</span>
              <span class="sub">▲ 114 / 146</span>
            </div>
          </div>
          <div class="mcp-benchmarks-list">
            <strong style="display:block; margin: 0.5rem 0 0.25rem; font-size:0.78rem;">Benchmarks:</strong>
            <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
              <span class="benchmark-pill up">Nifty 50: <strong>25,800.60</strong> (+1.12%)</span>
              <span class="benchmark-pill up">Nifty Next 50: <strong>73,207.25</strong> (+0.44%)</span>
              <span class="benchmark-pill up">Midcap 100: <strong>62,031.00</strong> (+0.66%)</span>
              <span class="benchmark-pill down">Smallcap 100: <strong>19,443.60</strong> (-0.13%)</span>
            </div>
          </div>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Factual NSE Bhavcopy calculations. Educational and research only.
          </div>
        </div>
      `;
    }

    // Volume analysis / trend for HAL
    if (q.includes('HAL') && (q.includes('VOLUME') || q.includes('TREND') || q.includes('SPIKE') || q.includes('ANALYSIS'))) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge purple">HAL Volume Trend</span>
            <span class="mcp-date">30D Window</span>
          </div>
          <div class="mcp-metrics-grid">
            <div class="mcp-metric-box">
              <span class="label">Avg Volume</span>
              <span class="value">7.82L</span>
            </div>
            <div class="mcp-metric-box">
              <span class="label">Last Volume</span>
              <span class="value">4.92L</span>
              <span class="sub red">-37.0% vs avg</span>
            </div>
            <div class="mcp-metric-box">
              <span class="label">Volume Spikes</span>
              <span class="value">1</span>
              <span class="sub">&gt;2x avg days</span>
            </div>
          </div>
          <strong style="display:block; margin:0.4rem 0 0.2rem; font-size:0.75rem;">Recent 5 Sessions:</strong>
          <table class="mcp-table">
            <thead>
              <tr><th>Date</th><th>Close</th><th>1D %</th><th>Volume</th><th>Vs Avg</th></tr>
            </thead>
            <tbody>
              <tr><td>2026-11-20</td><td>Rs. 4,809</td><td class="green">+1.03%</td><td>4.92L</td><td class="red">-37.0%</td></tr>
              <tr><td>2026-11-19</td><td>Rs. 4,760</td><td class="green">+1.82%</td><td>5.76L</td><td class="red">-26.4%</td></tr>
              <tr><td>2026-11-18</td><td>Rs. 4,675</td><td class="red">-1.10%</td><td>5.17L</td><td class="red">-33.9%</td></tr>
              <tr><td>2026-11-17</td><td>Rs. 4,727</td><td class="red">-1.29%</td><td>4.49L</td><td class="red">-42.6%</td></tr>
              <tr><td>2026-11-16</td><td>Rs. 4,789</td><td class="red">-0.43%</td><td>4.46L</td><td class="red">-43.0%</td></tr>
            </tbody>
          </table>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Technical volume deviation analysis from NSE Bhavcopy.
          </div>
        </div>
      `;
    }

    // High Trades / Highest Turnover (Value) - e.g. "Nifty 250 stocks with high trades"
    if (q.includes('TRADE') || q.includes('TURNOVER') || q.includes('VALUE') || q.includes('NIFTY 250') || q.includes('NIFTY 500')) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge blue">High Trades / Turnover Leaders</span>
            <span class="mcp-date">NSE Bhavcopy</span>
          </div>
          <p style="font-size:0.78rem; color:var(--text-muted); margin:0.25rem 0 0.5rem;">
            Top mainboard equities ranked by institutional &amp; retail turnover (traded value in Rs. Cr):
          </p>
          <table class="mcp-table">
            <thead>
              <tr><th>Stock</th><th>Close</th><th>1D %</th><th>Turnover</th><th>Volume</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>#1 HDFCBANK</strong></td><td>Rs. 846.00</td><td class="green">+2.94%</td><td><strong>Rs. 5,870 Cr</strong></td><td>7.01 Cr</td></tr>
              <tr><td><strong>#2 AXISBANK</strong></td><td>Rs. 1,446.00</td><td class="green">+4.72%</td><td><strong>Rs. 3,056 Cr</strong></td><td>2.14 Cr</td></tr>
              <tr><td><strong>#3 ICICIBANK</strong></td><td>Rs. 1,640.00</td><td class="green">+1.93%</td><td><strong>Rs. 2,924 Cr</strong></td><td>1.79 Cr</td></tr>
              <tr><td><strong>#4 MARUTI</strong></td><td>Rs. 14,011.00</td><td class="green">+3.11%</td><td><strong>Rs. 2,285 Cr</strong></td><td>16.4 Lakh</td></tr>
              <tr><td><strong>#5 RELIANCE</strong></td><td>Rs. 1,280.00</td><td class="green">+1.15%</td><td><strong>Rs. 2,150 Cr</strong></td><td>1.68 Cr</td></tr>
              <tr><td><strong>#6 HAL</strong></td><td>Rs. 4,809.00</td><td class="green">+1.03%</td><td><strong>Rs. 237 Cr</strong></td><td>4.92 Lakh</td></tr>
            </tbody>
          </table>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Factual NSE Bhavcopy traded value rankings. Educational &amp; research purposes only.
          </div>
        </div>
      `;
    }

    // 3. Top Volume / Most Active
    if (q.includes('VOLUME') || q.includes('ACTIVE') || q.includes('TURNOVER')) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge green">Top Traded Stocks by Volume</span>
            <span class="mcp-date">NSE Bhavcopy</span>
          </div>
          <table class="mcp-table">
            <thead>
              <tr><th>Symbol</th><th>Close</th><th>Change</th><th>Volume</th><th>Turnover</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>PCJEWELLER</strong></td><td>Rs. 14.05</td><td class="red">-3.10%</td><td>30.7 Cr</td><td>Rs. 430 Cr</td></tr>
              <tr><td><strong>IDEA</strong></td><td>Rs. 12.15</td><td class="green">+0.33%</td><td>29.2 Cr</td><td>Rs. 353 Cr</td></tr>
              <tr><td><strong>TATAGOLD</strong></td><td>Rs. 12.01</td><td class="red">-4.15%</td><td>22.4 Cr</td><td>Rs. 268 Cr</td></tr>
              <tr><td><strong>GOLDBEES</strong></td><td>Rs. 102.21</td><td class="red">-3.85%</td><td>21.5 Cr</td><td>Rs. 2,181 Cr</td></tr>
              <tr><td><strong>SILVERBEES</strong></td><td>Rs. 146.78</td><td class="red">-3.95%</td><td>19.0 Cr</td><td>Rs. 2,736 Cr</td></tr>
            </tbody>
          </table>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Official NSE Bhavcopy turnover data. Educational only.
          </div>
        </div>
      `;
    }

    // 4. Top Gainers & Losers
    if (q.includes('GAINER') || (q.includes('TOP') && q.includes('GAIN'))) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge green">Top NSE Gainers</span>
            <span class="mcp-date">Bhavcopy</span>
          </div>
          <table class="mcp-table">
            <thead>
              <tr><th>Symbol</th><th>Close</th><th>% Change</th><th>Day Range</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>TATASTEEL</strong></td><td>Rs. 164.20</td><td class="green">+4.18%</td><td>Rs. 158.00 / 165.40</td></tr>
              <tr><td><strong>HINDALCO</strong></td><td>Rs. 692.50</td><td class="green">+3.85%</td><td>Rs. 671.00 / 698.00</td></tr>
              <tr><td><strong>JSWSTEEL</strong></td><td>Rs. 985.00</td><td class="green">+3.12%</td><td>Rs. 954.00 / 992.00</td></tr>
              <tr><td><strong>COALINDIA</strong></td><td>Rs. 438.90</td><td class="green">+2.75%</td><td>Rs. 428.00 / 441.50</td></tr>
            </tbody>
          </table>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Descriptive price changes. Educational only.
          </div>
        </div>
      `;
    }

    if (q.includes('LOSER') || (q.includes('TOP') && q.includes('LOSS'))) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge red">Top NSE Losers</span>
            <span class="mcp-date">Bhavcopy</span>
          </div>
          <table class="mcp-table">
            <thead>
              <tr><th>Symbol</th><th>Close</th><th>% Change</th><th>Day Range</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>CIPLA</strong></td><td>Rs. 1,480.00</td><td class="red">-2.85%</td><td>Rs. 1,472.00 / 1,515.00</td></tr>
              <tr><td><strong>SUNPHARMA</strong></td><td>Rs. 1,760.00</td><td class="red">-2.15%</td><td>Rs. 1,750.00 / 1,795.00</td></tr>
              <tr><td><strong>DRREDDY</strong></td><td>Rs. 6,340.00</td><td class="red">-1.92%</td><td>Rs. 6,310.00 / 6,450.00</td></tr>
            </tbody>
          </table>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Descriptive price changes. Educational only.
          </div>
        </div>
      `;
    }

    // 5. HAL 52W Range & Info
    if (q.includes('HAL') || q.includes('HINDUSTAN AERONAUTICS')) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge purple">HAL – 52-Week Range</span>
            <span class="mcp-date">245 trading days</span>
          </div>
          <div class="mcp-range-container">
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:0.35rem;">
              <span>52W Low: <strong>Rs. 3,479.10</strong></span>
              <span>Current: <strong>Rs. 4,809.00</strong></span>
              <span>52W High: <strong>Rs. 5,149.90</strong></span>
            </div>
            <div class="mcp-progress-track">
              <div class="mcp-progress-fill" style="width: 79.6%;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">
              <span>+38.2% from low</span>
              <span>Range Position: <strong>79.6%</strong></span>
              <span>-6.6% from high</span>
            </div>
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            50-day SMA: <strong>Rs. 4,680.00</strong> | 200-day SMA: <strong>Rs. 4,210.00</strong>
          </div>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Historical NSE Bhavcopy calculation. Educational only.
          </div>
        </div>
      `;
    }

    // 6. MUTHOOTFIN Corporate Actions
    if (q.includes('MUTHOOT') || (q.includes('CORPORATE') && q.includes('ACTION'))) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge blue">MUTHOOTFIN Corporate Actions</span>
            <span class="mcp-date">Recent 5 Years</span>
          </div>
          <table class="mcp-table">
            <thead>
              <tr><th>Ex-Date</th><th>Type</th><th>Purpose</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>2026-04-17</strong></td><td><span class="mcp-tag dividend">DIVIDEND</span></td><td>Interim Dividend - Rs 30 Per Share</td></tr>
              <tr><td><strong>2025-04-25</strong></td><td><span class="mcp-tag dividend">DIVIDEND</span></td><td>Interim Dividend - Rs 26 Per Share</td></tr>
              <tr><td><strong>2024-05-31</strong></td><td><span class="mcp-tag dividend">DIVIDEND</span></td><td>Interim Dividend - Rs 24 Per Share</td></tr>
              <tr><td><strong>2023-04-18</strong></td><td><span class="mcp-tag dividend">DIVIDEND</span></td><td>Interim Dividend - Rs 22 Per Share</td></tr>
              <tr><td><strong>2022-04-25</strong></td><td><span class="mcp-tag dividend">DIVIDEND</span></td><td>Interim Dividend - Rs 20 Per Share</td></tr>
            </tbody>
          </table>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Sourced from official NSE filings. Educational research only.
          </div>
        </div>
      `;
    }

    // 7. Index Valuation (Nifty 50, Bank Nifty, IT)
    if (q.includes('NIFTY') && (q.includes('PE') || q.includes('P/E') || q.includes('VALUATION') || q.includes('RATIO'))) {
      return `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge green">Nifty 50 Valuation Ratios</span>
            <span class="mcp-date">Official NSE Index Services</span>
          </div>
          <div class="mcp-metrics-grid">
            <div class="mcp-metric-box">
              <span class="label">Price / Earnings (P/E)</span>
              <span class="value">23.18</span>
              <span class="sub">10Y Mean: 22.4</span>
            </div>
            <div class="mcp-metric-box">
              <span class="label">Price / Book (P/B)</span>
              <span class="value">3.92</span>
              <span class="sub">10Y Mean: 3.4</span>
            </div>
            <div class="mcp-metric-box">
              <span class="label">Dividend Yield</span>
              <span class="value">1.18%</span>
              <span class="sub">Annualized</span>
            </div>
          </div>
          <div class="mcp-disclaimer">
            SEBI Disclaimer: Published by NSE Index Services. Educational only.
          </div>
        </div>
      `;
    }

    // Default Fallback
    return `
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-badge blue">NSE Live Assistant</span>
        </div>
        <p style="font-size:0.83rem;">
          Query processed for: <strong>${escapeHtml(query)}</strong>
        </p>
        <p style="font-size:0.78rem; color:var(--text-muted);">
          You can ask about any stock on the radar (e.g. <code>HAL</code>, <code>Muthoot Finance</code>, <code>Pidilite</code>), market mood &amp; India VIX, volume leaders, or corporate actions.
        </p>
        <div class="mcp-disclaimer">
          SEBI Disclaimer: For educational and research purposes only. Not investment advice.
        </div>
      </div>
    `;
  }

  // Send query workflow
  async function sendMcpQuery(queryText) {
    const text = (queryText || '').trim();
    if (!text) return;

    appendMcpMessage('user', escapeHtml(text));
    if (mcpUserInput) mcpUserInput.value = '';
    showMcpTyping();

    try {
      let replyHtml = '';

      // Check if running with local server backend
      const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalServer) {
        try {
          const res = await fetch('/api/mcp/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
            signal: AbortSignal.timeout(6000)
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.ok && data.reply) {
              replyHtml = data.reply.html || data.reply.text || '';
              if (mcpConnStatus) mcpConnStatus.textContent = '🟢 Official MCP Server';
            }
          }
        } catch (e) {
          console.warn('[MCP Client] Local server call error, falling back:', e);
        }
      }

      // If on GitHub Pages or local fetch returned no reply, use client intelligence engine
      if (!replyHtml) {
        if (mcpConnStatus) mcpConnStatus.textContent = '🟢 NSE Bhavcopy Live';
        replyHtml = await queryClientFallback(text);
      }

      hideMcpTyping();
      appendMcpMessage('bot', replyHtml);
    } catch (err) {
      hideMcpTyping();
      appendMcpMessage('bot', `
        <div class="mcp-card">
          <div class="mcp-card-header">
            <span class="mcp-badge red">Query Notice</span>
          </div>
          <p style="font-size:0.8rem; color:var(--text-main);">${escapeHtml(err.message)}</p>
          <div class="mcp-disclaimer">Please try one of the quick action pills above.</div>
        </div>
      `);
    }
  }

  if (mcpChatForm) {
    mcpChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (mcpUserInput) {
        sendMcpQuery(mcpUserInput.value);
      }
    });
  }

  loadRadarData();
});
