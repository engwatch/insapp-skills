---
name: gitlab_compar
description: Use when user invokes /gitlab_compar or asks for a team comparison report for a period (default: last 7 days). Shows what each developer worked on — features, lines of code, MRs, complexity. HTML with per-developer tabs and comparison table.
---

# GitLab Team Comparison Report

> **⚠️ Вывод — только HTML-файл.** Никаких Google Sheets, Google Docs, Spreadsheets. Отчёт = терминальная таблица + `~/Downloads/team-compar-YYYY-MM-DD.html`. Всё.

**Команда:** `/gitlab_compar [period] [project_id]`

Примеры:
- `/gitlab_compar` — последние 7 дней
- `/gitlab_compar 2w` — последние 2 недели
- `/gitlab_compar 2026-03` — конкретный месяц
- `/gitlab_compar 2026-02-01:2026-02-28` — произвольный диапазон
- `/gitlab_compar 1w 42` — неделя, проект #42

---

## Шаг 1. Определи период

| Аргумент | Период |
|----------|--------|
| *(нет)* | Сегодня − 7 дней |
| `1w` / `week` | −7 дней |
| `2w` | −14 дней |
| `1m` / `month` | −30 дней |
| `YYYY-MM` | Весь месяц (с 1-го по последний день) |
| `DATE1:DATE2` | Точный диапазон |

`since` и `until` — ISO 8601: `2026-03-04T00:00:00Z`

Вычисли даты через Bash:
```bash
# macOS
since=$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
until=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Linux
since=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)
```

---

## Шаг 2. Найди проект и разработчиков

Если project_id не указан — спроси пользователя или используй последний известный.

```
mcp__gitlab__list_merge_requests(project_id=<id>, state="all", created_after=<since>, per_page=100)
```

Собери уникальных авторов из `author.username` + `author.name`.

---

## Шаг 3. Разрешение алиасов (КРИТИЧНО)

Один разработчик часто коммитит под несколькими именами. **Идентичность = email, не имя.**

### Метод выявления алиасов

1. Для MR автора — возьми несколько SHA из `list_commits(author_username=...)`
2. Для каждого SHA вызови `get_commit` → поле `author_email` и `author_name`
3. Сгруппируй все `(email, name)` пары — все имена с одним email = один человек
4. Паттерн: `author="Alex"` ловит «Alex», «Alex Petrov», «Alexander» одним запросом

**Признаки алиасов:** имя является подстрокой другого («Alex» + «Alex Petrov»), одинаковый email, схожие суммы строк.

После нахождения алиасов — суммируй коммиты по ВСЕМ алиасам и укажи это явно в отчёте.

---

## Шаг 4. Для каждого разработчика — параллельно

Запусти параллельно (Agent run_in_background=true) для каждого активного разработчика.

### 4а. Коммиты

```
mcp__gitlab__list_commits(project_id=<id>, author=<display_name_or_email>, since=<since>, until=<until>, per_page=100)
```

Для каждого коммита статистика строк:
- Если < 20 коммитов — вызови `get_commit(sha)` → `stats.additions/deletions` для каждого
- Если ≥ 20 — возьми выборку 15 штук равномерно, посчитай среднее, умножь на N, пиши `~оценка`

### 4б. MR за период

```
mcp__gitlab__list_merge_requests(project_id=<id>, author_username=<username>, state="all", created_after=<since>, per_page=100)
```

Для каждого MR: `source_branch`, `title`, `state`, `merged_at`, `created_at`.

### 4в. Тикеты из веток

Из `source_branch` извлеки тикеты: `INS-\d+`, `BACK-\d+`, `PROJ-\d+` и т.д.

Для уникальных тикетов (параллельно):
```
mcp__tracker__get_issue(issueKey="PROJ-XXXX")
```

Получи: `summary`, `description`, `status`, `type`.

### 4г. Сложность тикетов

| Сложность | Признаки |
|-----------|----------|
| ⭐⭐⭐⭐⭐ EPIC | Полная интеграция с внешней системой, race condition в критичных флоу |
| ⭐⭐⭐⭐ Высокая | Новый флоу с нуля, переход на другое API, кросс-сервисная логика |
| ⭐⭐⭐ Средняя | Новая бизнес-логика, кросс-компонентные изменения |
| ⭐⭐ Низкая | Изолированный баг, небольшая фича, UI-правки |
| ⭐ Минимальная | Cherry-pick, конфиг, watermark, переименование |

Если тикета нет — оцени по названию ветки: `feature/` → ⭐⭐⭐, `fix/` → ⭐⭐, `hotfix/` → ⭐⭐, `chore/refactor/` → ⭐.

---

## Шаг 5. Терминальный вывод

```
## 📊 Team Comparison — [период]
Проект: #<id> | [Дата от] — [Дата до]

| Разработчик | Коммитов | +Строк | MR | Смержено | Задач | Сложность avg |
|-------------|----------|--------|-----|----------|-------|---------------|
| alice       | 23       | +4 200 | 8  | 7        | 5     | ⭐⭐⭐         |
| bob         | 18       | +3 100 | 4  | 4        | 3     | ⭐⭐⭐⭐        |
...

Лидер по коммитам:    alice (23)
Лидер по строкам:     alice (+4 200)
Самая сложная задача: PROJ-456 @bob ⭐⭐⭐⭐⭐
```

После терминального — **сразу создай HTML без вопросов**.

---

## Шаг 6. HTML-отчёт

**Путь:** `~/Downloads/team-compar-[YYYY-MM-DD].html`

### Структура (вкладки)

1. **Обзор** — сводная сетка карточек + топ-перформеры
2. **Вкладка каждого разработчика** — подробный разбор задач
3. **Сравнение** — таблица с подсветкой лидеров

### HTML-шаблон

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Team Comparison — [период]</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; color: #1e293b; font-size: 14px; }
.nav { background: white; border-bottom: 1px solid #e2e8f0; padding: 0 24px; display: flex; align-items: center; gap: 2px; overflow-x: auto; position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.nav-title { font-size: 13px; font-weight: 700; color: #374151; padding: 14px 0; margin-right: 16px; white-space: nowrap; }
.nav-btn { padding: 12px 14px; font-size: 12px; font-weight: 600; color: #64748b; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.nav-btn.active { color: var(--accent, #2563eb); border-bottom-color: var(--accent, #2563eb); }
.page { display: none; padding: 24px; max-width: 1000px; margin: 0 auto; }
.page.active { display: block; }
.page-title { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
.page-sub { color: #64748b; font-size: 14px; margin-bottom: 24px; }

/* Overview */
.ov-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.ov-card { background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; border-top: 4px solid var(--accent); }
.ov-name { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
.ov-username { font-size: 12px; color: #94a3b8; margin-bottom: 12px; }
.ov-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ov-stat { background: #f8fafc; border-radius: 8px; padding: 8px 10px; }
.ov-stat-v { font-size: 18px; font-weight: 800; color: var(--accent); }
.ov-stat-l { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
.ov-badge { margin-top: 10px; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600; background: #f0fdf4; border: 1px solid #86efac; color: #166534; }

/* Dev page */
.dev-header { border-radius: 16px; padding: 24px 28px; margin-bottom: 20px; background: white; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: relative; overflow: hidden; }
.dev-header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--accent); }
.dev-header h2 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.dev-sub { color: #64748b; font-size: 13px; }
.stats-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.stat-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; flex: 1; min-width: 100px; }
.stat-v { font-size: 20px; font-weight: 800; color: #1e293b; }
.stat-v.green { color: #059669; } .stat-v.amber { color: #d97706; } .stat-v.blue { color: #2563eb; } .stat-v.red { color: #dc2626; }
.stat-l { font-size: 11px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; }

/* Tasks block */
.quality-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 20px; }
.qc-title { font-size: 16px; font-weight: 700; color: #1a202c; margin-bottom: 16px; }
.feature-group { margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.fg-header { background: #f8fafc; padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
.fg-icon { font-size: 16px; }
.fg-name { font-weight: 700; color: #1e293b; flex: 1; font-size: 13px; }
.fg-stats { color: #64748b; font-size: 12px; white-space: nowrap; }
.task-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid #f1f5f9; font-size: 13px; flex-wrap: wrap; }
.task-ticket { font-weight: 700; color: #2563eb; min-width: 70px; font-size: 12px; flex-shrink: 0; }
.task-name { flex: 1; color: #374151; min-width: 150px; }
.task-complexity { min-width: 70px; flex-shrink: 0; }
.task-lines { color: #64748b; font-size: 12px; min-width: 130px; text-align: right; flex-shrink: 0; }
.task-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.task-badge.merged { background: #d1fae5; color: #065f46; }
.task-badge.closed { background: #fee2e2; color: #991b1b; }
.task-badge.opened { background: #dbeafe; color: #1d4ed8; }
.no-tasks { padding: 16px; color: #94a3b8; font-size: 13px; font-style: italic; }

/* Insights */
.insights { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.ins { padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
.ins.green { background: #f0fdf4; color: #166534; border-left: 3px solid #22c55e; }
.ins.blue { background: #eff6ff; color: #1d4ed8; border-left: 3px solid #3b82f6; }
.ins.amber { background: #fffbeb; color: #92400e; border-left: 3px solid #f59e0b; }
.ins.red { background: #fef2f2; color: #991b1b; border-left: 3px solid #ef4444; }

/* Qbar */
.qbar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.qbar-label { font-size: 13px; color: #475569; min-width: 200px; font-weight: 500; }
.qbar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.qbar-fill { height: 100%; border-radius: 4px; }
.qbar-fill.g { background: linear-gradient(90deg, #10b981, #34d399); }
.qbar-fill.b { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.qbar-fill.a { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.qbar-fill.r { background: linear-gradient(90deg, #ef4444, #f87171); }
.qbar-val { font-size: 13px; font-weight: 700; color: #1e293b; min-width: 100px; text-align: right; }

/* Comparison table */
.cmp-wrap { overflow-x: auto; margin-bottom: 20px; }
table.cmp { width: 100%; border-collapse: collapse; font-size: 12px; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
table.cmp thead { background: #f8fafc; }
table.cmp th { padding: 10px 12px; text-align: left; font-weight: 700; color: #374151; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
table.cmp td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
table.cmp tr:last-child td { border-bottom: none; }
.best { background: #f0fdf4 !important; font-weight: 700; color: #059669; }
.warn { background: #fef2f2 !important; color: #dc2626; }
.mid { color: #94a3b8; }
</style>
<script>
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector('[data-page="'+id+'"]').classList.add('active');
}
</script>
</head>
<body>

<nav class="nav">
  <div class="nav-title">📊 Team Compar · [период]</div>
  <button class="nav-btn active" data-page="overview" onclick="show('overview')">Обзор</button>
  <!-- Кнопка для каждого разработчика -->
  <button class="nav-btn" data-page="dev-alice" onclick="show('dev-alice')" style="--accent:#2563eb">Alice</button>
  <button class="nav-btn" data-page="comparison" onclick="show('comparison')">Сравнение</button>
</nav>

<!-- OVERVIEW -->
<div id="overview" class="page active">
  <div class="page-title">Команда · [период]</div>
  <div class="page-sub">[N] разработчиков · [X] MR · [Y] смёрджено · project #<id></div>
  <div class="ov-grid">
    <div class="ov-card" onclick="show('dev-alice')" style="--accent:#2563eb">
      <div class="ov-name">Alice Smith</div>
      <div class="ov-username">@alice · Senior Dev</div>
      <div class="ov-stats">
        <div class="ov-stat"><div class="ov-stat-v">23</div><div class="ov-stat-l">Коммитов</div></div>
        <div class="ov-stat"><div class="ov-stat-v">+4.2к</div><div class="ov-stat-l">Строк</div></div>
        <div class="ov-stat"><div class="ov-stat-v">8</div><div class="ov-stat-l">MR</div></div>
        <div class="ov-stat"><div class="ov-stat-v">97%</div><div class="ov-stat-l">Acceptance</div></div>
      </div>
      <div class="ov-badge">🎯 Интеграция с PROJ-123 — основной вклад недели</div>
    </div>
  </div>
</div>

<!-- DEV PAGE — повторить для каждого разработчика -->
<div id="dev-alice" class="page" style="--accent:#2563eb">
  <div class="dev-header">
    <h2>Alice Smith</h2>
    <div class="dev-sub">@alice · Senior Dev · [период]</div>
  </div>

  <!-- 1. МЕТРИКИ -->
  <div class="stats-row">
    <div class="stat-card"><div class="stat-v blue">23</div><div class="stat-l">Коммитов</div></div>
    <div class="stat-card"><div class="stat-v green">+4 200</div><div class="stat-l">Строк добавлено</div></div>
    <div class="stat-card"><div class="stat-v">8</div><div class="stat-l">MR создано</div></div>
    <div class="stat-card"><div class="stat-v green">97%</div><div class="stat-l">Acceptance</div></div>
    <div class="stat-card"><div class="stat-v">1.2 дн</div><div class="stat-l">До merge avg</div></div>
  </div>

  <!-- 2. ЗАДАЧИ ПЕРИОДА — ГЛАВНЫЙ БЛОК -->
  <div class="quality-card">
    <div class="qc-title">🗂 Задачи периода</div>

    <!-- Группа 1 -->
    <div class="feature-group">
      <div class="fg-header">
        <span class="fg-icon">🔗</span>
        <span class="fg-name">Интеграции с партнёрами</span>
        <span class="fg-stats">2 задачи · +3 800 / -600 стр.</span>
      </div>
      <div class="task-row">
        <span class="task-ticket">PROJ-123</span>
        <span class="task-name">Интеграция с новым payment provider</span>
        <span class="task-complexity">⭐⭐⭐⭐</span>
        <span class="task-lines">+3 200 / -400 стр.</span>
        <span class="task-badge merged">merged</span>
      </div>
      <div class="task-row">
        <span class="task-ticket">PROJ-130</span>
        <span class="task-name">Фикс webhook авторизации</span>
        <span class="task-complexity">⭐⭐</span>
        <span class="task-lines">+180 / -90 стр.</span>
        <span class="task-badge merged">merged</span>
      </div>
    </div>

    <!-- Группа 2 -->
    <div class="feature-group">
      <div class="fg-header">
        <span class="fg-icon">🐛</span>
        <span class="fg-name">Баги / hotfix</span>
        <span class="fg-stats">1 задача · +90 / -45 стр.</span>
      </div>
      <div class="task-row">
        <span class="task-ticket">—</span>
        <span class="task-name">fix/payment-retry-logic</span>
        <span class="task-complexity">⭐⭐</span>
        <span class="task-lines">+90 / -45 стр.</span>
        <span class="task-badge merged">merged</span>
      </div>
    </div>

    <!-- Инсайты — 2-3 строки -->
    <div class="insights">
      <div class="ins green">📦 <b>Основная нагрузка:</b> интеграция с payment provider — ~80% строк кода. Крупная фича, завершена полностью.</div>
      <div class="ins blue">⭐ <b>Сложность:</b> 1 задача ⭐⭐⭐⭐ (архитектурный уровень) + 2 мелких фикса.</div>
    </div>
  </div>

  <!-- 3. ПРОФИЛЬ АКТИВНОСТИ -->
  <div class="quality-card">
    <div class="qc-title">📊 Профиль периода</div>
    <div class="qbar-row"><div class="qbar-label">Acceptance rate</div><div class="qbar-track"><div class="qbar-fill g" style="width:97%"></div></div><div class="qbar-val">97%</div></div>
    <div class="qbar-row"><div class="qbar-label">Commit/день (vs команда max)</div><div class="qbar-track"><div class="qbar-fill b" style="width:75%"></div></div><div class="qbar-val">3.3/день</div></div>
    <div class="qbar-row"><div class="qbar-label">Строк кода (vs команда max)</div><div class="qbar-track"><div class="qbar-fill b" style="width:100%"></div></div><div class="qbar-val">+4 200 ★</div></div>
    <div class="qbar-row"><div class="qbar-label">Скорость merge (5д=0%)</div><div class="qbar-track"><div class="qbar-fill g" style="width:76%"></div></div><div class="qbar-val">1.2 дн</div></div>
    <div class="qbar-row"><div class="qbar-label">Feature % (vs fix)</div><div class="qbar-track"><div class="qbar-fill b" style="width:80%"></div></div><div class="qbar-val">80%</div></div>
  </div>
</div>

<!-- COMPARISON -->
<div id="comparison" class="page">
  <div class="page-title">Сравнение · [период]</div>
  <div class="cmp-wrap">
    <table class="cmp">
      <thead>
        <tr>
          <th>Разработчик</th>
          <th>Коммитов</th>
          <th>+Строк</th>
          <th>Ком/день</th>
          <th>MR</th>
          <th>Acceptance</th>
          <th>До merge</th>
          <th>Задач</th>
          <th>Макс. сложность</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><b>Alice</b><br><span style="color:#94a3b8;font-size:11px">@alice</span></td>
          <td class="best">23 ★</td>
          <td class="best">+4 200 ★</td>
          <td>3.3</td>
          <td>8</td>
          <td class="best">97% ★</td>
          <td>1.2 дн</td>
          <td>3</td>
          <td>⭐⭐⭐⭐</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

</body>
</html>
```

---

## Правила группировки задач

### Типы групп
1. **🔗 Интеграции** — ключи в ветке/тикете: `widget`, `partner`, `integration`, `api`, `webhook`
2. **🔐 Авторизация / безопасность** — `auth`, `login`, `token`, `security`, `oauth`
3. **📋 Бизнес-логика** — `flow`, `calc`, `application`, `status`, `payment`
4. **🏗 Инфраструктура** — `config`, `deploy`, `migration`, `infra`, `docker`
5. **🐛 Баги / hotfix** — `fix`, `bug`, `hotfix`, `revert`, `patch`
6. **🔧 Рефакторинг** — `refactor`, `cleanup`, `chore`, `tech-debt`

Если тикет подходит под несколько — берись за приоритет сверху вниз.

---

## Правила инсайтов (2–3 строки)

- **Читается за 5 секунд** — максимум 3 инсайт-блока
- **Жирный ярлык в начале:** «Основная нагрузка», «Сложность», «Тренд», «Риск»
- **Конкретные числа:** не «много строк», а «+3 200 стр.», «4 из 5 задач — feature»
- `class="ins green"` — позитивное, `amber` — нейтральное, `red` — риск
- Если нет активности → одна строка: `<div class="ins amber">Нет активности за период.</div>`

---

## Критические ловушки

### ❌ Алиасы — всегда выявляй через email
Один разработчик может коммитить под «Alice», «Alice Smith», «alice.smith@corp.com» — это один человек. Метод: `get_commit(sha)` → `author_email`.

### ⚠️ `author` в list_commits — не username
Передавай display name или email, не GitLab username.

### ⚠️ Неактивные разработчики
Не показывай карточку для тех у кого 0 коммитов + 0 MR за период. Добавь сноску: «Нет активности: [список]».

### ⚠️ Период "последняя неделя" — правильная дата
Всегда вычисляй `since`/`until` через Bash перед запросами, не хардкодируй.
