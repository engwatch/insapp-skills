const fmt = v => v == null ? '\u2014' : Number(v).toLocaleString('ru-RU');
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '';

function mkCell(v, sub, cls) {
  const td = document.createElement('td');
  td.textContent = v;
  if (sub) { const s = document.createElement('span'); s.className = 'pct'; s.textContent = ' (' + sub + ')'; td.appendChild(s); }
  if (cls) td.className = cls;
  return td;
}
function mkTh(t, cls) {
  const th = document.createElement('th');
  th.textContent = t;
  if (cls) th.className = cls;
  return th;
}

let viewMode = 'partner';
let DATA = null;
let MFO_DATA = null;
let expanded = {};
let dayCache = {};
let mfoExpanded = {};
let mfoDayCache = {};

const today = new Date().toISOString().slice(0, 10);
document.getElementById('start').value = today;
document.getElementById('end').value = today;

/* View toggle */

function switchView(mode) {
  viewMode = mode;
  document.getElementById('togglePartner').classList.toggle('active', mode === 'partner');
  document.getElementById('toggleMfo').classList.toggle('active', mode === 'mfo');
  document.getElementById('partner').style.display = mode === 'partner' ? '' : 'none';
  document.getElementById('mfoSelect').style.display = mode === 'mfo' ? '' : 'none';
  document.getElementById('cards').style.display = 'none';
  document.getElementById('tableWrap').textContent = '';
}

/* Load dispatcher */

async function loadData() {
  const btn = document.getElementById('loadBtn');
  const status = document.getElementById('status');
  btn.disabled = true;
  status.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  status.appendChild(spinner);
  status.append(' \u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...');
  try {
    if (viewMode === 'partner') await loadPartnerData();
    else await loadMfoData();
    status.textContent = '';
  } catch (e) {
    status.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

/* Partner mode */

async function loadPartnerData() {
  const partner = document.getElementById('partner').value;
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  expanded = {};
  dayCache = {};
  const resp = await fetch('/api/summary?partner=' + encodeURIComponent(partner) +
    '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
  DATA = await resp.json();
  if (DATA.error) { document.getElementById('status').textContent = DATA.error; return; }
  renderPartnerCards();
  renderPartnerTable();
}

function renderPartnerCards() {
  document.getElementById('cards').style.display = '';
  const d = DATA.days;
  const split = DATA.partner.split;
  document.getElementById('c-opens').textContent = fmt(d.reduce((s, r) => s + r.opens, 0));
  document.getElementById('c-trans').textContent = fmt(d.reduce((s, r) => s + r.transitions, 0));
  document.getElementById('c-anke').textContent = fmt(DATA.ankety_total);
  document.getElementById('c-issued').textContent = fmt(d.reduce((s, r) => s + r.issued, 0));
  const sK = d.reduce((s, r) => s + r.kv, 0);
  document.getElementById('c-kv').textContent = fmt(sK);
  document.getElementById('c-insapp').textContent = fmt(Math.round(sK * (100 - split) / 100));
}

function renderPartnerTable() {
  const wrap = document.getElementById('tableWrap');
  const d = DATA.days;
  const split = DATA.partner.split;
  if (!d.length) { wrap.textContent = ''; const em = document.createElement('div'); em.className = 'empty'; em.textContent = '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0437\u0430 \u043f\u0435\u0440\u0438\u043e\u0434'; wrap.appendChild(em); return; }

  const tbl = document.createElement('table');
  tbl.className = 'mode-partner';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['', '\u0414\u0430\u0442\u0430', '\u041e\u0442\u043a\u0440.', '\u041f\u0435\u0440\u0435\u0445.', '\u0410\u043d\u043a\u0435\u0442\u044b', '\u041e\u0442\u043a\u0430\u0437\u044b', '\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u043e', '\u0412\u044b\u0434\u0430\u0447\u0438', '\u0412\u0445.\u041a\u0412',
   '\u041f\u0430\u0440\u0442\u043d. ' + split + '%', 'Insapp ' + (100 - split) + '%', 'EPC', 'EPL'].forEach((t, i) => {
    hr.appendChild(mkTh(t, i === 7 ? 'col-issued' : null));
  });
  thead.appendChild(hr);
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const r of d) {
    const pk = r.kv * split / 100, ik = r.kv * (100 - split) / 100;
    const epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    const epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    const approved = r.ankety - r.rejected;
    const parts = r.date.slice(5).split('-');
    const dd = parts[1] + '.' + parts[0];
    const isExp = expanded[r.date];

    const tr = document.createElement('tr');
    tr.className = 'day-row';
    tr.addEventListener('click', () => toggleDay(r.date));
    [mkCell(isExp ? '\u2212' : '+'), mkCell(dd), mkCell(fmt(r.opens)), mkCell(fmt(r.transitions)),
     mkCell(fmt(r.ankety)), mkCell(fmt(r.rejected), pct(r.rejected, r.ankety)),
     mkCell(fmt(approved), pct(approved, r.ankety)),
     mkCell(fmt(r.issued), pct(r.issued, approved), 'col-issued'),
     mkCell(fmt(r.kv)), mkCell(fmt(Math.round(pk))), mkCell(fmt(Math.round(ik))),
     mkCell(epc != null ? fmt(epc) : '\u2014'), mkCell(epl != null ? fmt(epl) : '\u2014')
    ].forEach(td => tr.appendChild(td));
    tbody.appendChild(tr);

    if (isExp) {
      if (dayCache[r.date]) { appendPartnerMfoRows(tbody, dayCache[r.date], split); }
      else { tbody.appendChild(loadingRow(13)); }
    }
  }

  var totO = d.reduce((s, r) => s + r.opens, 0);
  var totT = d.reduce((s, r) => s + r.transitions, 0);
  var totR = d.reduce((s, r) => s + r.rejected, 0);
  var totI = d.reduce((s, r) => s + r.issued, 0);
  var totK = d.reduce((s, r) => s + r.kv, 0);
  var totA = DATA.ankety_total, totAp = totA - totR;
  var totEpc = totT ? Math.round(totK / totT) : null;
  var totEpl = totA ? Math.round(totK / totA) : null;
  var totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  [mkCell(''), mkCell('\u0418\u0442\u043e\u0433\u043e'), mkCell(fmt(totO)), mkCell(fmt(totT)), mkCell(fmt(totA)),
   mkCell(fmt(totR), pct(totR, totA)), mkCell(fmt(totAp), pct(totAp, totA)),
   mkCell(fmt(totI), pct(totI, totAp), 'col-issued'),
   mkCell(fmt(totK)), mkCell(fmt(Math.round(totK * split / 100))), mkCell(fmt(Math.round(totK * (100 - split) / 100))),
   mkCell(totEpc != null ? fmt(totEpc) : '\u2014'), mkCell(totEpl != null ? fmt(totEpl) : '\u2014')
  ].forEach(td => totalTr.appendChild(td));
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.textContent = '';
  wrap.appendChild(tbl);
}

function appendPartnerMfoRows(tbody, mfo, split) {
  for (var i = 0; i < mfo.length; i++) {
    var r = mfo[i];
    var pk = r.kv * split / 100, ik = r.kv * (100 - split) / 100;
    var epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    var epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    var approved = r.ankety - r.rejected;
    var tr = document.createElement('tr');
    tr.className = 'mfo-row';
    [mkCell(''), mkCell(r.mfo), mkCell(''), mkCell(fmt(r.transitions)), mkCell(fmt(r.ankety)),
     mkCell(fmt(r.rejected), pct(r.rejected, r.ankety)),
     mkCell(fmt(approved), pct(approved, r.ankety)),
     mkCell(fmt(r.issued), pct(r.issued, approved), 'col-issued'),
     mkCell(fmt(r.kv)), mkCell(fmt(Math.round(pk))), mkCell(fmt(Math.round(ik))),
     mkCell(epc != null ? fmt(epc) : '\u2014'), mkCell(epl != null ? fmt(epl) : '\u2014')
    ].forEach(td => tr.appendChild(td));
    tbody.appendChild(tr);
  }
}

async function toggleDay(date) {
  if (expanded[date]) { delete expanded[date]; renderPartnerTable(); return; }
  expanded[date] = true;
  renderPartnerTable();
  if (!dayCache[date]) {
    var partner = document.getElementById('partner').value;
    try {
      var resp = await fetch('/api/day?partner=' + encodeURIComponent(partner) + '&date=' + encodeURIComponent(date));
      var data = await resp.json();
      dayCache[date] = data.mfo || [];
    } catch (e) { dayCache[date] = []; }
    renderPartnerTable();
  }
}

/* MFO mode */

async function loadMfoData() {
  var start = document.getElementById('start').value;
  var end = document.getElementById('end').value;
  mfoExpanded = {};
  mfoDayCache = {};
  var resp = await fetch('/api/mfo-summary?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
  MFO_DATA = await resp.json();
  if (MFO_DATA.error) { document.getElementById('status').textContent = MFO_DATA.error; return; }

  var sel = document.getElementById('mfoSelect');
  var prev = sel.value;
  while (sel.options.length > 0) sel.remove(0);
  var allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = '\u0412\u0441\u0435 \u041c\u0424\u041e';
  sel.appendChild(allOpt);
  for (var i = 0; i < MFO_DATA.mfo.length; i++) {
    var opt = document.createElement('option');
    opt.value = MFO_DATA.mfo[i].mfo;
    opt.textContent = MFO_DATA.mfo[i].mfo;
    sel.appendChild(opt);
  }
  var found = false;
  for (var j = 0; j < sel.options.length; j++) { if (sel.options[j].value === prev) { found = true; break; } }
  sel.value = found ? prev : 'all';

  if (sel.value === 'all') {
    renderMfoCards(MFO_DATA.mfo);
    renderMfoAllTable();
  } else {
    await loadMfoSingle(sel.value);
  }
}

async function loadMfoSingle(mfoName) {
  var start = document.getElementById('start').value;
  var end = document.getElementById('end').value;
  var resp = await fetch('/api/mfo-dates?mfo=' + encodeURIComponent(mfoName) +
    '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
  var data = await resp.json();
  if (data.error) { document.getElementById('status').textContent = data.error; return; }
  renderMfoCards(null, data.days);
  renderMfoSingleTable(data.days, mfoName);
}

function renderMfoCards(mfoList, days) {
  document.getElementById('cards').style.display = '';
  var src = mfoList || days;
  document.getElementById('c-opens').textContent = '\u2014';
  document.getElementById('c-trans').textContent = fmt(src.reduce((s, r) => s + r.transitions, 0));
  document.getElementById('c-anke').textContent = fmt(src.reduce((s, r) => s + r.ankety, 0));
  document.getElementById('c-issued').textContent = fmt(src.reduce((s, r) => s + r.issued, 0));
  document.getElementById('c-kv').textContent = fmt(src.reduce((s, r) => s + r.kv, 0));
  document.getElementById('c-insapp').textContent = '\u2014';
}

function renderMfoAllTable() {
  var wrap = document.getElementById('tableWrap');
  var mfo = MFO_DATA.mfo;
  if (!mfo.length) { wrap.textContent = ''; var em = document.createElement('div'); em.className = 'empty'; em.textContent = '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0437\u0430 \u043f\u0435\u0440\u0438\u043e\u0434'; wrap.appendChild(em); return; }

  var tbl = document.createElement('table');
  tbl.className = 'mode-mfo';
  var thead = document.createElement('thead');
  var hr = document.createElement('tr');
  ['', '\u041c\u0424\u041e', '\u041f\u0435\u0440\u0435\u0445.', '\u0410\u043d\u043a\u0435\u0442\u044b', '\u041e\u0442\u043a\u0430\u0437\u044b', '\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u043e', '\u0412\u044b\u0434\u0430\u0447\u0438', '\u0412\u0445.\u041a\u0412', 'EPC', 'EPL'].forEach(function(t, i) {
    hr.appendChild(mkTh(t, i === 6 ? 'col-issued' : null));
  });
  thead.appendChild(hr);
  tbl.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < mfo.length; i++) {
    var r = mfo[i];
    var approved = r.ankety - r.rejected;
    var epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    var epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    var isExp = mfoExpanded[r.mfo];

    var tr = document.createElement('tr');
    tr.className = 'day-row';
    (function(name) { tr.addEventListener('click', function() { toggleMfoExpand(name); }); })(r.mfo);
    [mkCell(isExp ? '\u2212' : '+'), mkCell(r.mfo), mkCell(fmt(r.transitions)),
     mkCell(fmt(r.ankety)), mkCell(fmt(r.rejected), pct(r.rejected, r.ankety)),
     mkCell(fmt(approved), pct(approved, r.ankety)),
     mkCell(fmt(r.issued), pct(r.issued, approved), 'col-issued'),
     mkCell(fmt(r.kv)),
     mkCell(epc != null ? fmt(epc) : '\u2014'), mkCell(epl != null ? fmt(epl) : '\u2014')
    ].forEach(function(td) { tr.appendChild(td); });
    tbody.appendChild(tr);

    if (isExp) {
      if (mfoDayCache[r.mfo]) { appendMfoDayRows(tbody, mfoDayCache[r.mfo]); }
      else { tbody.appendChild(loadingRow(10)); }
    }
  }

  var totT = mfo.reduce((s, r) => s + r.transitions, 0);
  var totA = mfo.reduce((s, r) => s + r.ankety, 0);
  var totR = mfo.reduce((s, r) => s + r.rejected, 0);
  var totI = mfo.reduce((s, r) => s + r.issued, 0);
  var totK = mfo.reduce((s, r) => s + r.kv, 0);
  var totAp = totA - totR;
  var totEpc = totT ? Math.round(totK / totT) : null;
  var totEpl = totA ? Math.round(totK / totA) : null;
  var totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  [mkCell(''), mkCell('\u0418\u0442\u043e\u0433\u043e'), mkCell(fmt(totT)), mkCell(fmt(totA)),
   mkCell(fmt(totR), pct(totR, totA)), mkCell(fmt(totAp), pct(totAp, totA)),
   mkCell(fmt(totI), pct(totI, totAp), 'col-issued'), mkCell(fmt(totK)),
   mkCell(totEpc != null ? fmt(totEpc) : '\u2014'), mkCell(totEpl != null ? fmt(totEpl) : '\u2014')
  ].forEach(function(td) { totalTr.appendChild(td); });
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.textContent = '';
  wrap.appendChild(tbl);
}

function appendMfoDayRows(tbody, days) {
  for (var i = 0; i < days.length; i++) {
    var r = days[i];
    var approved = r.ankety - r.rejected;
    var epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    var epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    var parts = r.date.slice(5).split('-');
    var dd = parts[1] + '.' + parts[0];
    var tr = document.createElement('tr');
    tr.className = 'mfo-row';
    [mkCell(''), mkCell(dd), mkCell(fmt(r.transitions)), mkCell(fmt(r.ankety)),
     mkCell(fmt(r.rejected), pct(r.rejected, r.ankety)),
     mkCell(fmt(approved), pct(approved, r.ankety)),
     mkCell(fmt(r.issued), pct(r.issued, approved), 'col-issued'),
     mkCell(fmt(r.kv)),
     mkCell(epc != null ? fmt(epc) : '\u2014'), mkCell(epl != null ? fmt(epl) : '\u2014')
    ].forEach(function(td) { tr.appendChild(td); });
    tbody.appendChild(tr);
  }
}

async function toggleMfoExpand(mfoName) {
  if (mfoExpanded[mfoName]) { delete mfoExpanded[mfoName]; renderMfoAllTable(); return; }
  mfoExpanded[mfoName] = true;
  renderMfoAllTable();
  if (!mfoDayCache[mfoName]) {
    var start = document.getElementById('start').value;
    var end = document.getElementById('end').value;
    try {
      var resp = await fetch('/api/mfo-dates?mfo=' + encodeURIComponent(mfoName) +
        '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
      var data = await resp.json();
      mfoDayCache[mfoName] = data.days || [];
    } catch (e) { mfoDayCache[mfoName] = []; }
    renderMfoAllTable();
  }
}

function renderMfoSingleTable(days, mfoName) {
  var wrap = document.getElementById('tableWrap');
  if (!days.length) { wrap.textContent = ''; var em = document.createElement('div'); em.className = 'empty'; em.textContent = '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0437\u0430 \u043f\u0435\u0440\u0438\u043e\u0434'; wrap.appendChild(em); return; }

  var tbl = document.createElement('table');
  tbl.className = 'mode-mfo-single';
  var thead = document.createElement('thead');
  var hr = document.createElement('tr');
  ['\u0414\u0430\u0442\u0430', '\u041f\u0435\u0440\u0435\u0445.', '\u0410\u043d\u043a\u0435\u0442\u044b', '\u041e\u0442\u043a\u0430\u0437\u044b', '\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u043e', '\u0412\u044b\u0434\u0430\u0447\u0438', '\u0412\u0445.\u041a\u0412', 'EPC', 'EPL'].forEach(function(t, i) {
    hr.appendChild(mkTh(t, i === 5 ? 'col-issued' : null));
  });
  thead.appendChild(hr);
  tbl.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < days.length; i++) {
    var r = days[i];
    var approved = r.ankety - r.rejected;
    var epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    var epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    var parts = r.date.slice(5).split('-');
    var dd = parts[1] + '.' + parts[0];
    var tr = document.createElement('tr');
    tr.className = 'day-row';
    [mkCell(dd), mkCell(fmt(r.transitions)), mkCell(fmt(r.ankety)),
     mkCell(fmt(r.rejected), pct(r.rejected, r.ankety)),
     mkCell(fmt(approved), pct(approved, r.ankety)),
     mkCell(fmt(r.issued), pct(r.issued, approved), 'col-issued'),
     mkCell(fmt(r.kv)),
     mkCell(epc != null ? fmt(epc) : '\u2014'), mkCell(epl != null ? fmt(epl) : '\u2014')
    ].forEach(function(td) { tr.appendChild(td); });
    tbody.appendChild(tr);
  }

  var totT = days.reduce((s, r) => s + r.transitions, 0);
  var totA = days.reduce((s, r) => s + r.ankety, 0);
  var totR = days.reduce((s, r) => s + r.rejected, 0);
  var totI = days.reduce((s, r) => s + r.issued, 0);
  var totK = days.reduce((s, r) => s + r.kv, 0);
  var totAp = totA - totR;
  var totEpc = totT ? Math.round(totK / totT) : null;
  var totEpl = totA ? Math.round(totK / totA) : null;
  var totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  [mkCell('\u0418\u0442\u043e\u0433\u043e'), mkCell(fmt(totT)), mkCell(fmt(totA)),
   mkCell(fmt(totR), pct(totR, totA)), mkCell(fmt(totAp), pct(totAp, totA)),
   mkCell(fmt(totI), pct(totI, totAp), 'col-issued'), mkCell(fmt(totK)),
   mkCell(totEpc != null ? fmt(totEpc) : '\u2014'), mkCell(totEpl != null ? fmt(totEpl) : '\u2014')
  ].forEach(function(td) { totalTr.appendChild(td); });
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.textContent = '';
  wrap.appendChild(tbl);
}

/* Shared helpers */

function loadingRow(cols) {
  var tr = document.createElement('tr');
  tr.className = 'mfo-row';
  var td = document.createElement('td');
  td.colSpan = cols;
  td.style.textAlign = 'center';
  td.style.color = 'var(--t4)';
  var sp = document.createElement('span');
  sp.className = 'spinner';
  td.appendChild(sp);
  td.append(' \u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...');
  tr.appendChild(td);
  return tr;
}

/* Events */

document.getElementById('mfoSelect').addEventListener('change', function() {
  if (!MFO_DATA) return;
  var sel = document.getElementById('mfoSelect');
  if (sel.value === 'all') {
    renderMfoCards(MFO_DATA.mfo);
    renderMfoAllTable();
  } else {
    loadMfoSingle(sel.value);
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') loadData();
});
