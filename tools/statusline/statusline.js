const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

// === НАСТРОЙКИ (измени под себя) ===
// Organization ID из Claude.ai — найди в URL: https://claude.ai/api/organizations/<ID>/usage
const ORG_ID = 'YOUR_ORG_ID_HERE';
// ===================================

const CACHE = os.tmpdir() + '/claude-usage-cache.json';
const CACHE_TTL = 30000;
const COOKIE_FILE = os.homedir() + '/.claude/claude-cookies.txt';
const USAGE_URL = 'https://claude.ai/api/organizations/' + ORG_ID + '/usage';

const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n);

function fmtResetTime(isoDate) {
  if (!isoDate) return '';
  const dt = new Date(new Date(isoDate).getTime() - 1000);
  const pad = n => String(n).padStart(2, '0');
  return pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
}

function fetchUsage() {
  if (ORG_ID === 'YOUR_ORG_ID_HERE') return null;

  let cookies = '';
  try { cookies = fs.readFileSync(COOKIE_FILE, 'utf8').trim(); } catch (_) {}
  if (!cookies) return null;

  try {
    const result = execSync(
      `curl -s "${USAGE_URL}" -H "Cookie: ${cookies}" -H "Host: claude.ai" -H "User-Agent: Claude console" -D -`,
      { timeout: 5000, encoding: 'utf8' }
    );

    const parts = result.split('\r\n\r\n');
    const headers = parts[0] || '';
    const body = parts.slice(1).join('\r\n\r\n');

    // Обновляем sessionKey если пришёл новый
    const skMatch = headers.match(/set-cookie:\s*sessionKey=([^;]+)/i);
    if (skMatch) {
      try { fs.writeFileSync(COOKIE_FILE, 'sessionKey=' + skMatch[1] + ';'); } catch (_) {}
    }

    return JSON.parse(body);
  } catch (_) {
    return null;
  }
}

let s = '';
process.stdin.on('data', c => s += c);
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(s);
    const cw = d.context_window;

    // Текущий контекст
    let current = 'no data';
    if (cw && cw.used_percentage != null) {
      const pct = cw.used_percentage;
      const t = cw.context_window_size || null;
      const u = t !== null ? Math.round(pct / 100 * t) : null;
      const tok = (u !== null && t !== null) ? ' (' + fmt(u) + '/' + fmt(t) + ')' : '';
      current = pct.toFixed(1) + '%' + tok;
    }

    // Кэш API
    let cache = { ts: 0, day: '-', dayReset: '', week: '-', weekReset: '' };
    try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (_) {}

    const now = Date.now();

    if (now - cache.ts > CACHE_TTL) {
      const data = fetchUsage();
      if (data && data.five_hour) {
        const h5 = data.five_hour?.utilization;
        const h5r = data.five_hour?.resets_at;
        const d7 = data.seven_day?.utilization;
        const d7r = data.seven_day?.resets_at;
        cache = {
          ts: now,
          day: h5 != null ? h5.toFixed(0) + '%' : '-',
          dayReset: h5r || '',
          week: d7 != null ? d7.toFixed(0) + '%' : '-',
          weekReset: d7r || '',
        };
        fs.writeFileSync(CACHE, JSON.stringify(cache));
      }
    }

    const dayCD = cache.dayReset ? ' (' + fmtResetTime(cache.dayReset) + ')' : '';
    const weekCD = cache.weekReset ? ' (' + fmtResetTime(cache.weekReset) + ')' : '';

    // Текущая папка и имя сессии
    const cwd = d.cwd || (d.workspace && d.workspace.current_dir) || '';
    const folderName = cwd ? cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() || cwd : '';
    const sessionName = (d.session_name && d.session_name.trim()) ? d.session_name.trim() : '_';

    let line = 'Current Context: ' + current + ' | Day: ' + cache.day + dayCD + ' | Week: ' + cache.week + weekCD;
    if (folderName) line += ' | \\' + folderName;
    line += ' | ' + sessionName;

    process.stdout.write(line);
  } catch (e) {
    process.stdout.write('Context: no data');
  }
});
