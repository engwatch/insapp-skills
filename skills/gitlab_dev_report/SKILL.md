---
name: gitlab_dev_report
description: Use when user invokes /gitlab_dev_report or asks for a GitLab developer productivity report — commits, lines of code, MR stats, acceptance rates, team efficiency metrics.
---

# GitLab Developer Productivity Report

**Команда:** `/gitlab_dev_report [project] [период]`

Примеры:
- `/gitlab_dev_report`
- `/gitlab_dev_report insapp 2 недели`
- `/gitlab_dev_report backend-api март 2026`

---

## Алгоритм

### Шаг 1. Разбери аргументы

- **Project** — название или ID проекта (если не указан — попробуй `list_merge_requests(scope="all")` без project_id и извлеки уникальные project_id из поля `web_url`)
- **Период** — опционально, по умолчанию последние 14 дней

Вычисли `since` и `until` в ISO 8601 (например `2026-02-24T00:00:00Z`).

### Шаг 2. Получи все коммиты и MR за период параллельно

Запусти оба запроса одновременно:

```
mcp__gitlab__list_commits(project_id=<id>, since=<from>, until=<to>, per_page=100, with_stats=true)
mcp__gitlab__list_merge_requests(project_id=<id>, created_after=<from>, state="all", per_page=100)
```

Если коммитов ровно 100 — запроси страницу 2, 3 и т.д. пока не получишь пустой ответ.

Результаты сохрани в файл (они превышают лимит токенов) — обработай через python:
```python
# Группировка коммитов по author_name, суммирование stats.additions/deletions
# Группировка MR по author.username, подсчёт merged/closed/open, merge times
```

### Шаг 3. Объедини алиасы авторов

Один разработчик может коммитить под разными именами ("Alex" и "Alex Svistunov").
Признаки совпадения:
- Похожие имена (подстрока)
- Очень близкие суммы строк по выборке (~±5%)
- Одинаковый username в MR

Явно укажи в отчёте если объединял: `(коммитит под именами: "Alex", "Alex Svistunov")`.

### Шаг 4. Собери метрики

Для каждого разработчика:

| Метрика | Откуда |
|---------|--------|
| Коммитов | `len(commits)` |
| Строк добавлено / удалено | `sum(stats.additions)` / `sum(stats.deletions)` |
| Строк/день (нетто) | `(additions - deletions) / days` |
| MR создано | count из `list_merge_requests(created_after=...)` |
| MR смержено | state="merged" |
| MR отклонено | state="closed" |
| MR acceptance rate | `merged / (merged + closed) * 100%` |
| Фичи | уникальные branch names из MR (source_branch) |
| Среднее время до merge | `merged_at - created_at` по merged MR |

### Шаг 5. Подтяни описания задач из трекера (опционально)

Если используется Яндекс Трекер MCP — для ключевых задач (QUEUE-XXXX из branch names) вызови параллельно:
```
mcp__tracker__get_issue(issueKey="QUEUE-XXXX")
```

Используй `summary` и `description` для оценки сложности задачи.

**Признаки сложности:**
- ⭐⭐⭐⭐⭐ EPIC / CRITICAL — полные интеграции, race condition в критичных флоу
- ⭐⭐⭐⭐ Высокая — новая интеграция с внешним сервисом (полный цикл), переход на новое API
- ⭐⭐⭐ Средняя — кросс-компонентные изменения, новая бизнес-логика
- ⭐⭐ Низкая — изолированный баг, небольшая фича
- ⭐ Минимальная — cherry-pick, конфиг, watermark

---

## Формат отчёта в терминале

```
## 📊 GitLab Dev Report — [Project Name]
Период: [от] — [до]

---

### 👨‍💻 [Имя Фамилия] (@username)

**Коммиты:** 23  |  **+2 140 / -890 строк**  |  ~89 строк/день

**Merge Requests:**
- Создано: 5  |  Смержено: 4  |  Отклонено: 1
- Acceptance rate: 80%
- Среднее время до merge: 1.5 дня

**Фичи:**
- `feature/payment-integration` → merged
- `fix/auth-token-refresh` → merged
- `feature/dark-mode` → closed (rejected)

---

## 🏆 Сводная таблица

| Разработчик | Коммиты | +Строк | -Строк | Строк/день | MR | Acceptance |
|-------------|---------|--------|--------|------------|-----|-----------|
| Иванов И.   | 23      | 2140   | 890    | ~89        | 5  | 80%       |

## 🔍 Инсайты

- Самый продуктивный по коду: **[Имя]** (~X строк/день)
- Лучший acceptance rate: **[Имя]** (X%)
- Чаще всего отклоняют: **[Имя]** (X из Y MR closed)
- Самый быстрый merge: **[Имя]** (среднее X ч)
- Период: X дней  |  Команда: N разработчиков  |  Итого коммитов: N
```

---

## Google Sheets

**После сбора данных и вывода отчёта в терминал — спроси пользователя:**

> Создать Google Sheet с этим отчётом?

Если ответ "да" / "создай" / "давай" — создай таблицу:

```
1. mcp__gdrive__gsheets_create_spreadsheet(
     title="GitLab Dev Report — [project] | [период]",
     sheets=["Сводная таблица", "Детали по разрабам", "Задачи и сложность"]
   )

2. Заполни через gsheets_batch_update с valueInputOption: RAW:
   - "Сводная таблица": заголовок, период, таблица метрик (сортировка по строк/день), инсайты
   - "Детали по разрабам": по одной строке на разработчика с коммитами, MR, ветками, паттерном
   - "Задачи и сложность": тикет, название, разработчик, сложность ⭐, статус, комментарий

3. Форматирование:
   - Заголовки: тёмный фон (#212121), белый текст, bold
   - Шапки колонок: тёмно-серый фон (#3d3d3d), белый текст, bold
   - freeze_rows для шапок
   - auto_resize COLUMNS для всех листов

4. Верни ссылку на таблицу
```

---

## Правила

- **Не показывай** разработчиков с 0 коммитов И 0 MR (пропускай)
- **Строки/день** считай от `net = additions - deletions` — показывает реальный прирост кода
- **Acceptance rate** считай только если есть хотя бы 1 закрытый/merged MR; иначе "n/a"
- **Фичи** — берёшь `source_branch` из MR, убираешь общие префиксы (`feature/`, `fix/`, `hotfix/`)
- **Инсайты** — пиши только если есть реальные данные (не менее 2 разработчиков для сравнения)
- Если выборка строк кода ограничена — пиши "~оценка" рядом с числом

---

## Критические ловушки

### ❌ `list_projects` не существует в этом MCP
Чтобы найти проекты — вызови `list_merge_requests(scope="all", per_page=100)` без project_id
и извлеки `project_id` + путь из `web_url` (формат: `https://YOUR_GITLAB_HOST/group/project/-/merge_requests/N`).

### ❌ `author` в list_commits — это email или имя, не username
GitLab `list_commits` принимает `author` как строку совпадающую с email или display name автора коммита.
Лучше не фильтровать по автору — получи все коммиты проекта и группируй по `author_name` в python.

### ⚠️ Один разработчик — несколько имён в git
Частая проблема: "Alex" и "Alex Svistunov" — один человек с разным git config.
Признак: очень похожие суммы строк или имя является подстрокой другого.

### ⚠️ MR created_after vs updated_after
- `created_after` — MR созданные в период (для счётчика "создано")
- Для "смержено в период" — фильтруй по `merged_at` в python из полного списка

### ⚠️ Результаты превышают лимит токенов
При 100+ коммитах ответ сохраняется в файл. Обязательно читай через python-скрипт в Bash,
не пытайся читать файл напрямую через Read.

### ⚠️ Пагинация коммитов
Если получил ровно 100 коммитов — запроси page=2. Повторяй пока ответ не пустой.

### ⚠️ Значения +X / -Y в Google Sheets
При записи в таблицу используй `valueInputOption: RAW` — иначе Google Sheets интерпретирует
строки вида `+55 237 / -42` как формулы и выдаёт `#ERROR!` / `#NAME?`.
