const fmt = v => v == null ? '\u2014' : Number(v).toLocaleString('ru-RU');

let DATA = null;
let expanded = {};
let dayCache = {};

const today = new Date().toISOString().slice(0, 10);
document.getElementById('start').value = today;
document.getElementById('end').value = today;

async function loadData() {
  const partner = document.getElementById('partner').value;
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  const btn = document.getElementById('loadBtn');
  const status = document.getElementById('status');
  btn.disabled = true;
  status.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  status.appendChild(spinner);
  status.append(' Загрузка...');
  expanded = {};
  dayCache = {};
  try {
    const resp = await fetch(
      '/api/summary?partner=' + encodeURIComponent(partner) +
      '&start=' + encodeURIComponent(start) +
      '&end=' + encodeURIComponent(end)
    );
    DATA = await resp.json();
    if (DATA.error) { status.textContent = DATA.error; return; }
    renderCards();
    renderTable();
    status.textContent = '';
  } catch (e) {
    status.textContent = 'Ошибка: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

function renderCards() {
  document.getElementById('cards').style.display = '';
  const d = DATA.days;
  const split = DATA.partner.split;
  const sO = d.reduce((s, r) => s + r.opens, 0);
  const sT = d.reduce((s, r) => s + r.transitions, 0);
  const sI = d.reduce((s, r) => s + r.issued, 0);
  const sK = d.reduce((s, r) => s + r.kv, 0);
  document.getElementById('c-opens').textContent = fmt(sO);
  document.getElementById('c-trans').textContent = fmt(sT);
  document.getElementById('c-anke').textContent = fmt(DATA.ankety_total);
  document.getElementById('c-issued').textContent = fmt(sI);
  document.getElementById('c-kv').textContent = fmt(sK);
  document.getElementById('c-insapp').textContent = fmt(Math.round(sK * (100 - split) / 100));
}

function renderTable() {
  const wrap = document.getElementById('tableWrap');
  const d = DATA.days;
  const split = DATA.partner.split;
  if (!d.length) {
    wrap.textContent = '';
    const em = document.createElement('div');
    em.className = 'empty';
    em.textContent = 'Нет данных за период';
    wrap.appendChild(em);
    return;
  }

  const tbl = document.createElement('table');

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['', 'Дата', 'Откр.', 'Перех.', 'Анкеты', 'Отказы', 'Выдачи', 'Вх.КВ',
   'Партн. ' + split + '%', 'Insapp ' + (100 - split) + '%', 'EPC', 'EPL'].forEach(t => {
    const th = document.createElement('th');
    th.textContent = t;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (const r of d) {
    const pk = r.kv * split / 100;
    const ik = r.kv * (100 - split) / 100;
    const epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    const epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    const parts = r.date.slice(5).split('-');
    const dd = parts[1] + '.' + parts[0];
    const isExp = expanded[r.date];

    const tr = document.createElement('tr');
    tr.className = 'day-row';
    tr.addEventListener('click', () => toggleDay(r.date));
    const vals = [
      isExp ? '\u2212' : '+', dd, fmt(r.opens), fmt(r.transitions), fmt(r.ankety),
      fmt(r.rejected), fmt(r.issued), fmt(r.kv), fmt(Math.round(pk)), fmt(Math.round(ik)),
      epc != null ? fmt(epc) : '\u2014', epl != null ? fmt(epl) : '\u2014'
    ];
    vals.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);

    if (isExp) {
      if (dayCache[r.date]) {
        appendMfoRows(tbody, dayCache[r.date], split);
      } else {
        const loadTr = document.createElement('tr');
        loadTr.className = 'mfo-row';
        const loadTd = document.createElement('td');
        loadTd.colSpan = 12;
        loadTd.style.textAlign = 'center';
        loadTd.style.color = 'var(--t4)';
        const sp = document.createElement('span');
        sp.className = 'spinner';
        loadTd.appendChild(sp);
        loadTd.append(' Загрузка...');
        loadTr.appendChild(loadTd);
        tbody.appendChild(loadTr);
      }
    }
  }

  const totO = d.reduce((s, r) => s + r.opens, 0);
  const totT = d.reduce((s, r) => s + r.transitions, 0);
  const totR = d.reduce((s, r) => s + r.rejected, 0);
  const totI = d.reduce((s, r) => s + r.issued, 0);
  const totK = d.reduce((s, r) => s + r.kv, 0);
  const totPk = Math.round(totK * split / 100);
  const totIk = Math.round(totK * (100 - split) / 100);
  const totEpc = totT ? Math.round(totK / totT) : null;
  const totEpl = DATA.ankety_total ? Math.round(totK / DATA.ankety_total) : null;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  ['', 'Итого', fmt(totO), fmt(totT), fmt(DATA.ankety_total), fmt(totR), fmt(totI),
   fmt(totK), fmt(totPk), fmt(totIk),
   totEpc != null ? fmt(totEpc) : '\u2014',
   totEpl != null ? fmt(totEpl) : '\u2014'
  ].forEach(v => {
    const td = document.createElement('td');
    td.textContent = v;
    totalTr.appendChild(td);
  });
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.textContent = '';
  wrap.appendChild(tbl);
}

function appendMfoRows(tbody, mfo, split) {
  if (!mfo.length) return;
  for (const r of mfo) {
    const pk = r.kv * split / 100;
    const ik = r.kv * (100 - split) / 100;
    const epc = r.transitions ? Math.round(r.kv / r.transitions) : null;
    const epl = r.ankety ? Math.round(r.kv / r.ankety) : null;
    const tr = document.createElement('tr');
    tr.className = 'mfo-row';
    const vals = [
      '', r.mfo, '', fmt(r.transitions), fmt(r.ankety), fmt(r.rejected), fmt(r.issued),
      fmt(r.kv), fmt(Math.round(pk)), fmt(Math.round(ik)),
      epc != null ? fmt(epc) : '\u2014', epl != null ? fmt(epl) : '\u2014'
    ];
    vals.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

async function toggleDay(date) {
  if (expanded[date]) {
    delete expanded[date];
    renderTable();
    return;
  }
  expanded[date] = true;
  renderTable();
  if (!dayCache[date]) {
    const partner = document.getElementById('partner').value;
    try {
      const resp = await fetch(
        '/api/day?partner=' + encodeURIComponent(partner) +
        '&date=' + encodeURIComponent(date)
      );
      const data = await resp.json();
      dayCache[date] = data.mfo || [];
    } catch (e) {
      dayCache[date] = [];
    }
    renderTable();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') loadData();
});
