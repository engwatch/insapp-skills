---
name: report_claude_use
description: Use when user invokes /report_claude_use or asks for a Claude Code usage report — analyzes all sessions for a given period, groups by activity, generates HTML dashboard and publishes via /html-push.
---

# Report Claude Use — отчёт по использованию Claude Code

## Команда

```
/report_claude_use [период]
```

- `[период]` — опционально: "последние 2 дня", "эта неделя", "7 дней", "март". По умолчанию — **последние 3 дня**.

---

## Алгоритм

### Шаг 1. Сбор сессий

Найти все JSONL-файлы сессий за указанный период:

```bash
find ~/.claude/projects/ -maxdepth 2 -name "*.jsonl" -mtime -<N> ! -path "*/subagents/*"
```

Где `<N>` — количество дней из запрошенного периода.

Для каждой сессии извлечь:
- **Timestamp** — из поля `timestamp` в JSONL строках
- **User messages** — из записей с `type: "user"`, поле `message.content[].text`
- **Assistant texts** — из записей с `type: "assistant"`, поле `message.content[].text`
- **Tools used** — из записей с `type: "assistant"`, блоки `message.content[].type == "tool_use"`, поле `name`
- **MCP tools** — инструменты начинающиеся с `mcp__`

### Шаг 2. Категоризация

Каждой сессии присвоить категории по ключевым словам в user messages:

| Категория | Ключевые слова |
|---|---|
| МФО Отчёты | отчёт, report, мфо, локо, хиппо, пампаду |
| GitLab / Git | gitlab, git, коммит, commit, мерж |
| Yandex Tracker | трекер, tracker, задач |
| Договоры | договор, контракт, legal |
| Настройка / Skills | mcp, скилл, skill, настро, конфиг |
| Сверки | сверк, vendor, вендор |
| Встречи | встреч, meet, calendar |
| Визуализация | html, документ, визуал |
| Web / Playwright | playwright, браузер |
| DevOps / Setup | развернуть, машин, проект |
| Документы | полис, шаблон, ворд, docx |
| Настройка Claude | модель, opus, терминал |

### Шаг 3. Суммаризация

Для каждой категории — сформировать **краткие итоги** (не сырые сообщения!):
- Прочитать user messages и assistant excerpts
- Написать 1-2 предложения что было сделано, с конкретикой (имена, числа, результаты)
- Привязать к дате

**Исключения — не включать в отчёт:**
- Сессии только с системными сообщениями или запусками скиллов без результата
- Чувствительную информацию (токены, пароли, API-ключи)

### Шаг 4. Генерация HTML

Структура HTML (светлые тона, Apple-стиль):

1. **Шапка** — заголовок, период, 4 KPI:
   - Количество сессий
   - Количество направлений (категорий)
   - Количество MCP-сервисов
   - Количество дней

2. **Что было сделано** — сетка 2 колонки из карточек:
   - Каждая карточка = одна категория
   - Заголовок с иконкой, названием и счётчиком
   - Список итогов с датами
   - Цветная левая граница

3. **MCP-интеграции** — сетка 2 колонки:
   - Иконка + название + краткое описание

4. **Хронология** — компактный список:
   - Группировка по дням (Пн/Вт/Ср...)
   - Время | категории | первое сообщение (обрезанное)

5. **Подвал** — "Claude Code (model) · дата генерации"

### Шаг 5. Сохранение и публикация

1. Сохранить HTML в `docs/claude-activity-report.html` текущего проекта
2. Открыть в браузере: `open docs/claude-activity-report.html`
3. Спросить пользователя: нужно ли опубликовать через `/html-push`

---

## Стиль HTML

```css
/* Ключевые параметры */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
background: #f0f2f5;
max-width: 960px;
border-radius: 16px;
/* KPI */
.kpi-value { font-size: 36px; font-weight: 800; color: #0071e3; }
/* Карточки */
.activity-card { border: 1px solid #e5e5ea; border-radius: 12px; }
.activity-header { background: #fafafa; border-left: 4px solid <color>; }
/* Даты в items */
.item-date { font-size: 11px; background: #f5f5f7; border-radius: 4px; }
```

Цвета категорий:

| Категория | Цвет |
|---|---|
| МФО Отчёты | #4A90D9 |
| GitLab | #FC6D26 |
| Yandex Tracker | #FFB800 |
| Договоры | #7B68EE |
| Настройка | #20B2AA |
| Сверки | #FF6B6B |
| Встречи | #4ECDC4 |
| Визуализация | #45B7D1 |
| Web / Playwright | #2ECC71 |
| DevOps | #95A5A6 |
| Документы | #E67E22 |
| Настройка Claude | #9B59B6 |

---

## MCP-сервисы (иконки)

| Сервис | Иконка | Описание |
|---|---|---|
| gdrive | 📁 | Google Drive — Sheets, Docs, Calendar |
| gitlab | 🦊 | GitLab — коммиты, MR, статистика |
| insapp-db | 🗄️ | InsApp DB — SQL-запросы |
| tracker | 📋 | Yandex Tracker — задачи, логи |
| telegram | 💬 | Telegram — дайджест, упоминания |
| telemost | 📹 | Telemost — видеовстречи |
| plugin_playwright_playwright | 🎭 | Playwright — автоматизация браузера |
| figma | 🎨 | Figma — диаграммы |
| plugin_context7_context7 | 📚 | Context7 — документация библиотек |

---

## Notes

- Отчёт должен быть **понятным для человека** — краткие итоги, не сырые логи
- Категории без сессий не показываются
- Пустые категории (только системные сообщения) пропускаются
- Для публикации использовать скилл `/html-push` с repo-name `claude-activity-report`
