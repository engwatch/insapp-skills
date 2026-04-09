/* Partner cabinet — МТС Банк */
var PARTNER = 'mts';
var SPLIT = 80;
var DATA = null;
var sortCol = 6;
var activeFromTime = null;
var hourMode = false;
var HOUR_ENTRIES = null;

var fmt = function(v) { return v == null ? '\u2014' : Number(v).toLocaleString('ru-RU'); };
var pct = function(a, b) { return b ? Math.round(a / b * 100) + '%' : ''; };

function mkCell(v, sub, cls) {
  var td = document.createElement('td');
  td.textContent = v;
  if (sub) { var s = document.createElement('span'); s.className = 'pct'; s.textContent = ' (' + sub + ')'; td.appendChild(s); }
  if (cls) td.className = cls;
  return td;
}
function mkTh(t, cls, sortIdx) {
  var th = document.createElement('th');
  th.textContent = t;
  if (cls) th.className = cls;
  if (sortIdx != null) {
    th.classList.add('sortable');
    if (sortCol === sortIdx) {
      var arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = ' \u2193';
      th.appendChild(arrow);
    }
    th.addEventListener('click', function() {
      sortCol = sortCol === sortIdx ? 6 : sortIdx;
      renderTable();
    });
  }
  return th;
}
function appendCells(tr, cells) { for (var i = 0; i < cells.length; i++) tr.appendChild(cells[i]); }
function sortDesc(arr, fn) {
  return arr.slice().sort(function(a, b) {
    var va = fn(a), vb = fn(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  });
}
function colVal(r, col) {
  var pk = r.kv * SPLIT / 100;
  var approved = r.ankety - r.rejected;
  switch (col) {
    case 1: return r.opens;
    case 2: return r.transitions;
    case 3: return r.ankety;
    case 4: return r.rejected;
    case 5: return approved;
    case 6: return r.issued;
    case 7: return pk;
    case 8: return r.transitions ? Math.round(pk / r.transitions) : null;
    case 9: return r.ankety ? Math.round(pk / r.ankety) : null;
    default: return 0;
  }
}

/* Init */
(function() {
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  document.getElementById('start').value = today;
  document.getElementById('end').value = today;
  loadData();
})();

/* Load */
async function loadData() {
  var btn = document.getElementById('loadBtn');
  var status = document.getElementById('status');
  btn.disabled = true;
  status.textContent = '';
  var spinner = document.createElement('span');
  spinner.className = 'spinner';
  status.appendChild(spinner);
  status.append(' Загрузка...');
  try {
    var start = document.getElementById('start').value;
    var end = document.getElementById('end').value;
    activeFromTime = null;
    sortCol = 6;
    var resp = await fetch('/api/summary?partner=' + PARTNER +
      '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
    DATA = await resp.json();
    if (DATA.error) { status.textContent = DATA.error; return; }
    renderCards();
    document.getElementById('subToggle').style.display = '';
    renderTable();
    status.textContent = '';
  } catch (e) {
    status.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

/* Refresh */
async function refreshData() {
  if (activeFromTime) {
    var btn = document.getElementById('loadBtn');
    var status = document.getElementById('status');
    btn.disabled = true;
    status.textContent = '';
    var spinner = document.createElement('span');
    spinner.className = 'spinner';
    status.appendChild(spinner);
    status.append(' Обновление...');
    try {
      var resp = await fetch('/api/summary?partner=' + PARTNER +
        '&from_time=' + encodeURIComponent(activeFromTime));
      DATA = await resp.json();
      if (DATA.error) { status.textContent = DATA.error; return; }
      renderCards();
      renderTable();
      status.textContent = '';
    } catch (e) {
      status.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + e.message;
    } finally {
      btn.disabled = false;
    }
  } else {
    loadData();
  }
}

/* Hour mode */
function toggleHourMode() {
  hourMode = document.getElementById('hourToggle').checked;
  document.getElementById('hourSelect').style.display = hourMode ? '' : 'none';
  if (hourMode) {
    loadHourEntries();
  } else {
    activeFromTime = null;
  }
}

async function loadHourEntries() {
  var sel = document.getElementById('hourSelect');
  if (HOUR_ENTRIES) return;
  var status = document.getElementById('status');
  status.textContent = '';
  var spinner = document.createElement('span');
  spinner.className = 'spinner';
  status.appendChild(spinner);
  status.append(' Загрузка...');
  try {
    var now = new Date();
    var entries = [];
    for (var h = 0; h < 48; h++) {
      var t = new Date(now.getTime() - h * 3600000);
      var iso = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0') +
        'T' + String(t.getHours()).padStart(2,'0') + ':00:00+03:00';
      var label = String(t.getDate()).padStart(2,'0') + '.' + String(t.getMonth()+1).padStart(2,'0') + ' ' +
        String(t.getHours()).padStart(2,'0') + ':00';
      entries.push({time: iso, label: label});
    }
    HOUR_ENTRIES = entries;
    while (sel.options.length > 1) sel.remove(1);
    for (var i = 0; i < entries.length; i++) {
      var opt = document.createElement('option');
      opt.value = entries[i].time;
      opt.textContent = entries[i].label;
      sel.appendChild(opt);
    }
    status.textContent = '';
  } catch (e) {
    status.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + e.message;
  }
}

async function loadHourData() {
  var sel = document.getElementById('hourSelect');
  var fromTime = sel.value;
  if (!fromTime) return;
  activeFromTime = fromTime;
  refreshData();
}

/* Cards */
function renderCards() {
  document.getElementById('cards').style.display = '';
  var d = DATA.days;
  document.getElementById('c-opens').textContent = fmt(d.reduce(function(s, r) { return s + r.opens; }, 0));
  document.getElementById('c-trans').textContent = fmt(d.reduce(function(s, r) { return s + r.transitions; }, 0));
  document.getElementById('c-anke').textContent = fmt(DATA.ankety_total);
  document.getElementById('c-issued').textContent = fmt(d.reduce(function(s, r) { return s + r.issued; }, 0));
  var totalKv = d.reduce(function(s, r) { return s + r.kv; }, 0);
  var income = Math.round(totalKv * SPLIT / 100);
  document.getElementById('c-income').textContent = fmt(income);
  renderRunRate(d);
}

function renderRunRate(days) {
  var el = document.getElementById('c-runrate');
  var sorted = days.slice().sort(function(a, b) { return a.date > b.date ? 1 : -1; });
  var fullDays = sorted.length > 1 ? sorted.slice(0, -1) : [];
  if (!fullDays.length) { el.textContent = '\u2014'; return; }
  var endDate = new Date(sorted[sorted.length - 1].date);
  var daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  var totalKv = fullDays.reduce(function(s, r) { return s + r.kv; }, 0);
  var totalIncome = totalKv * SPLIT / 100;
  var rr = Math.round(totalIncome / fullDays.length * daysInMonth);
  el.textContent = fmt(rr);
}

/* Table */
function renderTable() {
  var wrap = document.getElementById('tableWrap');
  var d = DATA.days;
  if (!d.length) { wrap.textContent = ''; var em = document.createElement('div'); em.className = 'empty'; em.textContent = '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0437\u0430 \u043f\u0435\u0440\u0438\u043e\u0434'; wrap.appendChild(em); return; }

  if (sortCol != null) d = sortDesc(d, function(x) { return colVal(x, sortCol); });

  var tbl = document.createElement('table');
  tbl.className = 'mode-mfo-single';
  var thead = document.createElement('thead');
  var hr = document.createElement('tr');
  ['\u0414\u0430\u0442\u0430', '\u041e\u0442\u043a\u0440.', '\u041f\u0435\u0440\u0435\u0445.', '\u0410\u043d\u043a\u0435\u0442\u044b', '\u041e\u0442\u043a\u0430\u0437\u044b', '\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u043e', '\u0412\u044b\u0434\u0430\u0447\u0438', '\u0414\u043e\u0445\u043e\u0434', 'EPC', 'EPL'].forEach(function(t, i) {
    hr.appendChild(mkTh(t, i === sortCol ? 'col-issued' : null, i >= 1 ? i : null));
  });
  thead.appendChild(hr);
  tbl.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var j = 0; j < d.length; j++) {
    var r = d[j];
    var pk = Math.round(r.kv * SPLIT / 100);
    var epc = r.transitions ? Math.round(pk / r.transitions) : null;
    var epl = r.ankety ? Math.round(pk / r.ankety) : null;
    var approved = r.ankety - r.rejected;
    var parts = r.date.slice(5).split('-');
    var dd = parts[1] + '.' + parts[0];

    var tr = document.createElement('tr');
    tr.className = 'day-row';
    appendCells(tr, [mkCell(dd), mkCell(fmt(r.opens)), mkCell(fmt(r.transitions)),
     mkCell(fmt(r.ankety)), mkCell(fmt(r.rejected), pct(r.rejected, r.ankety)),
     mkCell(fmt(approved), pct(approved, r.ankety)),
     mkCell(fmt(r.issued), pct(r.issued, approved)),
     mkCell(fmt(pk)),
     mkCell(epc != null ? fmt(epc) : '\u2014'), mkCell(epl != null ? fmt(epl) : '\u2014')
    ]);
    tbody.appendChild(tr);
  }

  var origDays = DATA.days;
  var totO = origDays.reduce(function(s, r) { return s + r.opens; }, 0);
  var totT = origDays.reduce(function(s, r) { return s + r.transitions; }, 0);
  var totR = origDays.reduce(function(s, r) { return s + r.rejected; }, 0);
  var totI = origDays.reduce(function(s, r) { return s + r.issued; }, 0);
  var totK = origDays.reduce(function(s, r) { return s + r.kv; }, 0);
  var totA = DATA.ankety_total;
  var totAp = totA - totR;
  var totPk = Math.round(totK * SPLIT / 100);
  var totEpc = totT ? Math.round(totPk / totT) : null;
  var totEpl = totA ? Math.round(totPk / totA) : null;
  var totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  appendCells(totalTr, [mkCell('\u0418\u0442\u043e\u0433\u043e'), mkCell(fmt(totO)), mkCell(fmt(totT)), mkCell(fmt(totA)),
   mkCell(fmt(totR), pct(totR, totA)), mkCell(fmt(totAp), pct(totAp, totA)),
   mkCell(fmt(totI), pct(totI, totAp)),
   mkCell(fmt(totPk)),
   mkCell(totEpc != null ? fmt(totEpc) : '\u2014'), mkCell(totEpl != null ? fmt(totEpl) : '\u2014')
  ]);
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.textContent = '';
  wrap.appendChild(tbl);
}
