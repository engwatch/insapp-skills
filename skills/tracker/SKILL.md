---
name: tracker
description: Use when user invokes /tracker or asks to work with Yandex Tracker via MCP. Interactive assistant — asks what to do if not specified. Handles tasks, worklogs, stats, transitions, queues.
---

# Tracker — интерактивный помощник Яндекс Трекера

**Команда:** `/tracker [опциональный запрос]`

Примеры:
- `/tracker` — спросить что нужно
- `/tracker покажи мои задачи`
- `/tracker создай задачу`
- `/tracker INS-123`
- `/tracker залогируй 2 часа INS-456`

---

## Шаг 1. Определи намерение

Если пользователь не уточнил что нужно — спроси:

```
Что вы хотите сделать в Трекере?

1. 📋 Посмотреть задачи (мои / по очереди / поиск)
2. ✅ Создать задачу
3. ✏️ Обновить задачу (статус, поля, комментарий)
4. ⏱ Залогировать время
5. 📊 Статистика (сотрудник / команда / очередь)
6. 🔍 Найти задачу по ключу (INS-XXX)

Напишите номер или опишите своими словами.
```

Если запрос уже содержит намерение — распознай и сразу выполни.

---

## Шаг 2. Выполни действие

### 📋 Посмотреть задачи

**Мои задачи** — `mcp__tracker__list_issues` с фильтром `assignee: me` или через `mcp__tracker__search_issues`:
```json
{"assignee": "<current_user>", "status": ["open", "inProgress", "review"]}
```

**По ключу задачи (INS-XXX)** — `mcp__tracker__get_issue`:
```json
{"issueKey": "INS-XXX"}
```
Выводи: ключ, название, статус, исполнитель, срок, описание.

**Поиск** — `mcp__tracker__search_issues` с параметрами из запроса пользователя.

**Список очередей** — `mcp__tracker__list_queues` если нужно.

---

### ✅ Создать задачу

Собери параметры:
- `summary` — название (обязательно, спроси если не указано)
- `queue` — очередь (по умолчанию `INS`)
- `assignee` — исполнитель (опционально)
- `deadline` — срок в `YYYY-MM-DD` (опционально)
- `description` — описание (опционально)
- `priority` — `critical` / `blocker` / `major` / `normal` / `minor` (по умолчанию `normal`)

Если указан исполнитель по имени — резолви через `mcp__tracker__resolve_user`.

Создай через `mcp__tracker__create_issue`.

Ответ:
```
✅ Задача создана: INS-XXXX
https://tracker.yandex.ru/INS-XXXX
```

---

### ✏️ Обновить задачу

Уточни у пользователя ключ задачи если не указан.

**Сменить статус** — `mcp__tracker__list_transitions` → покажи доступные переходы → `mcp__tracker__move_issue`.

**Обновить поля** (assignee, summary, deadline, priority, description) — `mcp__tracker__update_issue`.

Ответ: подтверди что обновлено и что стало.

---

### ⏱ Залогировать время

Нужно: ключ задачи + количество часов (или формат `2h30m`).

```
mcp__tracker__add_worklog:
  issueKey: INS-XXX
  duration: "PT2H30M"   # ISO 8601 duration
  comment: <опциональный комментарий>
```

Конвертация: 1.5 часа → `PT1H30M`, 2 часа → `PT2H`.

Ответ: `⏱ Залогировано 2ч 30мин в INS-XXX`.

---

### 📊 Статистика

**Сотрудник** — `mcp__tracker__get_employee_stats` (если нужен конкретный человек)

**Команда** — `mcp__tracker__get_team_stats`

**Очередь** — `mcp__tracker__get_queue_stats`

Если нужны ворклоги за период — `mcp__tracker__get_worklogs`.

---

## Правила

- Если запрос содержит ключ задачи (паттерн `[A-Z]+-\d+`) — сразу вызови `get_issue`
- Очередь по умолчанию везде `INS`
- Всегда возвращай ссылку `https://tracker.yandex.ru/<KEY>` для задач
- Для исполнителей используй `resolve_user` — берёт и новый (newId), и старый (oldLogin) аккаунт
- Если пользователь написал время как "2 часа" — конвертируй в ISO 8601 (`PT2H`)
- Спрашивай только то что действительно нужно для выполнения операции
