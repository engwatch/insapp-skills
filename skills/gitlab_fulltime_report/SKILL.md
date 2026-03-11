---
name: gitlab_fulltime_report
description: Use when user invokes /gitlab_fulltime_report or asks for a full developer activity report covering their entire work history — all commits, MRs, monthly breakdown, tracker tasks with complexity scoring, quality analysis, and optional HTML report.
---

# GitLab Full-Period Developer Report

**Команда:** `/gitlab_fulltime_report [developer] [project]`

Примеры:
- `/gitlab_fulltime_report`
- `/gitlab_fulltime_report svistunov`
- `/gitlab_fulltime_report alex.petrov backend-api`

---

## Алгоритм

### Шаг 1. Разбери аргументы

- **Developer** — username или имя разработчика
- **Project** — ID или название проекта (если не указан — найди через `list_merge_requests(scope="all")` и покажи список уникальных проектов из `web_url`)

Если проект не указан — покажи список и попроси выбрать.

### Шаг 2. Определи период активности

Запусти параллельно:
```
mcp__gitlab__list_commits(project_id=<id>, per_page=100, page=1)
mcp__gitlab__list_merge_requests(project_id=<id>, author_username=<username>, state="all", per_page=100)
```

Из первой страницы коммитов возьми самый старый — это начало истории.
Период = от первого коммита разработчика до сегодня.

### Шаг 3. Получи все коммиты с пагинацией

```
mcp__gitlab__list_commits(project_id=<id>, author=<email_or_name>, since=<start>, per_page=100, page=1)
```

Повторяй page=2, 3, ... пока ответ не пустой.

**Важно:** `author` = email или display name (не username). Получи email из `list_project_members`.

**Объединение алиасов:** разработчик может коммитить под разными именами ("Alex", "Alex Svistunov"). Признаки: имя является подстрокой другого, схожие суммы строк. Явно укажи в отчёте.

Сохрани все коммиты в файл — при 100+ штуках читай через python-скрипт.

### Шаг 4. Получи все MR с пагинацией

```
mcp__gitlab__list_merge_requests(project_id=<id>, author_username=<username>, state="all", per_page=100, page=1)
```

Повторяй пока ответ не пустой.

### Шаг 5. Получи статистику строк

Для первых 30 коммитов:
```
mcp__gitlab__get_commit(project_id=<id>, sha=<sha>)
```

Возвращает `stats.additions`, `stats.deletions`. Если коммитов > 30 — считай среднее по выборке и умножь на общее количество. Пиши "~оценка".

### Шаг 6. Получи задачи из трекера (параллельно)

Из MR `source_branch` извлеки тикеты вида `INS-XXXX`, `BACK-XXXX` и т.д.

Запусти параллельно для всех уникальных тикетов:
```
mcp__tracker__get_issue(issueKey="INS-XXXX")
```

Используй `summary` и `description` для оценки сложности:

| Сложность | Признаки |
|-----------|----------|
| ⭐⭐⭐⭐⭐ EPIC | Полные интеграции, race condition в критичных флоу |
| ⭐⭐⭐⭐ Высокая | Новая интеграция (полный цикл), переход на новое API |
| ⭐⭐⭐ Средняя | Кросс-компонентные изменения, новая бизнес-логика |
| ⭐⭐ Низкая | Изолированный баг, небольшая фича |
| ⭐ Минимальная | Cherry-pick, конфиг, watermark |

### Шаг 7. Сгруппируй по месяцам

Сгруппируй коммиты и MR по `YYYY-MM`. Для каждого месяца:
- Количество коммитов
- Строк добавлено / удалено
- MR создано / смержено / отклонено
- Ключевые задачи

Флаги активности месяца:
- 🔥 Пиковый месяц (топ-3 по строкам кода)
- ⭐ Сложные задачи (есть задачи ⭐⭐⭐⭐+)
- 📦 Много MR (больше среднего)
- 🔧 Технический долг (преобладают fix/refactor ветки)

---

## Формат отчёта в терминале

```
## 📊 Full-Period Dev Report — [Имя Фамилия] (@username)
Проект: [project name]
Период: [первый коммит] — [сегодня] ([X месяцев / X дней])

---

### 📅 Хронология по месяцам

**[YYYY-MM]** 🔥⭐
Коммитов: 12 | +1 840 / -430 строк | MR: 3 смержено
Задачи: INS-123 (Интеграция с ОСАГО — ⭐⭐⭐⭐), INS-145 (фикс авторизации — ⭐⭐)

**[YYYY-MM]**
Коммитов: 5 | +320 / -80 строк | MR: 1 смержено
Задачи: INS-167 (обновление конфига — ⭐)

...

---

### 📋 Сводная таблица по месяцам

| Месяц | Коммитов | +Строк | -Строк | Нетто | MR | Флаги |
|-------|----------|--------|--------|-------|----|----|
| 2025-08 | 12 | 1840 | 430 | +1410 | 3 | 🔥⭐ |
| 2025-09 | 8 | 920 | 210 | +710 | 2 | |
...
| ИТОГО | 87 | 15230 | 4890 | +10340 | 28 | |

---

### 🎯 Задачи и сложность

| Тикет | Название | Месяц | Ветка | Сложность | Статус |
|-------|----------|-------|-------|-----------|--------|
| INS-123 | Интеграция с ОСАГО | 2025-08 | feature/osago-integration | ⭐⭐⭐⭐ | merged |
...

---

### 📊 Итоговые метрики

**Всего:**
- Коммитов: 87
- Строк добавлено: ~15 230 | Удалено: ~4 890 | Нетто: ~+10 340
- Среднее строк/день: ~47
- MR создано: 28 | Смержено: 24 | Отклонено: 4
- Acceptance rate: 86%
- Среднее время до merge: 1.2 дня

**Активность:**
- Самый продуктивный месяц: [YYYY-MM] (~X строк)
- Пиковых месяцев (топ-3): [список]
- Сложных задач (⭐⭐⭐⭐+): X из Y

**Анализ качества кода:**
- Acceptance rate [высокий/средний/низкий]: [описание паттерна]
- Скорость merge: [быстро/медленно, X дней среднее]
- Соотношение фич к фиксам: [X% фичи, Y% фиксы]

---
```

После отчёта в терминале — **спроси пользователя:**

> Создать HTML-отчёт?

---

## HTML-отчёт

Если пользователь ответил «да» / «создай» — сгенерируй HTML-файл.

**Путь:** `~/Downloads/[username]-report-[YYYY-MM].html`

**Структура HTML (светлая тема):**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>[Имя] — Dev Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f5f7fa; color: #1a1a2e; margin: 0; padding: 32px; }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 32px; font-size: 15px; }
    .stats-row { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
    .stat-card { background: white; border-radius: 12px; padding: 20px 24px; min-width: 150px;
                 box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .stat-value { font-size: 28px; font-weight: 700; color: #2563eb; }
    .stat-label { font-size: 13px; color: #888; margin-top: 4px; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px;
               box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h2 { font-size: 18px; margin: 0 0 16px; }
    .month-card { border-left: 4px solid #e2e8f0; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0; }
    .month-card.peak { border-color: #f59e0b; background: #fffbeb; }
    .month-card.complex { border-color: #8b5cf6; }
    .month-name { font-weight: 600; font-size: 15px; }
    .month-flags { display: inline-block; margin-left: 8px; }
    .month-stats { color: #555; font-size: 14px; margin-top: 4px; }
    .month-tasks { font-size: 13px; color: #888; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-weight: 600; color: #374151; }
    td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-merged { background: #d1fae5; color: #065f46; }
    .badge-closed { background: #fee2e2; color: #991b1b; }
    .quality-bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 8px; }
    .quality-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #10b981, #3b82f6); }
    .insight { padding: 10px 16px; background: #f0f9ff; border-radius: 8px; margin-bottom: 8px; font-size: 14px; color: #0369a1; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Заголовок -->
    <h1>[Имя Фамилия]</h1>
    <div class="subtitle">@username · [project] · [период]</div>

    <!-- Ключевые метрики -->
    <div class="stats-row">
      <div class="stat-card"><div class="stat-value">[N]</div><div class="stat-label">Коммитов</div></div>
      <div class="stat-card"><div class="stat-value">+[X]к</div><div class="stat-label">Строк добавлено</div></div>
      <div class="stat-card"><div class="stat-value">[N]</div><div class="stat-label">Merge Requests</div></div>
      <div class="stat-card"><div class="stat-value">[X]%</div><div class="stat-label">Acceptance rate</div></div>
      <div class="stat-card"><div class="stat-value">[X] дн</div><div class="stat-label">Среднее до merge</div></div>
    </div>

    <!-- Хронология по месяцам -->
    <div class="section">
      <h2>📅 Хронология по месяцам</h2>
      <!-- month-card для каждого месяца, class="peak" для пиковых -->
    </div>

    <!-- Сводная таблица -->
    <div class="section">
      <h2>📋 Сводная таблица</h2>
      <!-- таблица: Месяц | Коммитов | +Строк | -Строк | Нетто | MR -->
    </div>

    <!-- Задачи -->
    <div class="section">
      <h2>🎯 Задачи и сложность</h2>
      <!-- таблица: Тикет | Название | Ветка | Сложность | Статус -->
    </div>

    <!-- Анализ качества -->
    <div class="section">
      <h2>📊 Анализ качества</h2>
      <!-- инсайты и quality bar -->
    </div>
  </div>
</body>
</html>
```

Открой файл в браузере через Playwright для проверки:
```
mcp__plugin_playwright_playwright__browser_navigate(url="file:///[path]")
mcp__plugin_playwright_playwright__browser_take_screenshot()
```

Верни путь к файлу.

---

## Правила

- **Период** — от первого коммита разработчика до сегодня
- **Алиасы:** если разработчик коммитит под разными именами — объедини и укажи явно
- **Строки кода:** при > 30 коммитах — считай среднее по выборке, пиши "~оценка"
- **Acceptance rate** — только если есть хотя бы 1 closed/merged MR
- **Трекер задачи** — только для тикетов из branch names; остальные MR без тикета — без оценки сложности
- **Флаги месяца:** 🔥 топ-3 по нетто-строкам, ⭐ есть задачи 4★+, 📦 MR > среднего, 🔧 > 50% fix/refactor веток

---

## Критические ловушки

### ❌ `list_projects` не существует в этом MCP
Найти проект: `list_merge_requests(scope="all", per_page=100)` без project_id, извлеки `project_id` из `web_url`.

### ❌ `author` в list_commits — не username
`list_commits` принимает `author` как email или display name. Получи email из `list_project_members`.

### ⚠️ Пагинация обязательна
При 100 коммитах/MR — запроси page=2, 3, ... пока ответ не пустой.

### ⚠️ Результаты > лимит токенов
При 100+ коммитах сохрани в файл. Обрабатывай через python-скрипт в Bash, не читай через Read.

### ⚠️ `gsheets_batch_update` и `+строки`
Используй `valueInputOption: RAW` — иначе `+123 / -45` интерпретируется как формула → `#ERROR!`.

### ⚠️ Один разработчик — несколько имён в git
"Alex" и "Alex Svistunov" — один человек. Признак: имя является подстрокой, схожие суммы строк.
