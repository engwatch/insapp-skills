---
name: tracker_add_task
description: Use when user invokes /tracker_add_task or asks to create a task in Yandex Tracker. Collects task details interactively if not provided, resolves assignee, creates issue with deadline.
---

# Создание задачи в Яндекс Трекере

**Команда:** `/tracker_add_task`

Примеры:
- `/tracker_add_task`
- `/tracker_add_task Внедрить Claude Code → Гуркин, срок 11 марта, очередь INS`

---

## Алгоритм

### Шаг 1. Собери параметры

Из сообщения пользователя извлеки (если указаны):
- `summary` — название задачи (обязательно)
- `assignee` — исполнитель (имя или логин)
- `queue` — очередь (по умолчанию `INS`)
- `deadline` — срок (ISO 8601, например `2026-03-11`)
- `description` — описание
- `priority` — приоритет: `critical`, `blocker`, `major`, `normal`, `minor` (по умолчанию `normal`)

Если `summary` не указан — спроси у пользователя прежде чем продолжать.

### Шаг 2. Резолв исполнителя (если указан)

```
mcp__tracker__resolve_user(loginOrName)
```

- Если найден новый аккаунт (newId) — используй числовой `newId` как assignee
- Если только старый (oldLogin) — используй логин
- Если не найден — предупреди пользователя и создай задачу без assignee

### Шаг 3. Создай задачу

```
mcp__tracker__create_issue:
  queue: <queue>
  summary: <summary>
  assignee: <resolved_id_or_login>  # только если определён
  description: <description>         # только если указано
  priority: <priority>
  deadline: <deadline>               # только если указан, формат YYYY-MM-DD
```

**Важно:** `deadline` передаётся напрямую в `create_issue` — не нужно отдельно вызывать `update_issue`.

### Шаг 4. Верни результат

```
✅ Задача создана: [INS-XXXX]
https://tracker.yandex.ru/INS-XXXX

Исполнитель: Имя Фамилия
Срок: DD MMMM YYYY
Очередь: QUEUE
```

---

## Правила

- `queue` по умолчанию `INS`, если пользователь не уточнил
- Всегда возвращай ссылку на задачу в формате `https://tracker.yandex.ru/<KEY>`
- Если `deadline` передан как текст (например, "11 марта") — преобразуй в `YYYY-MM-DD`
- Не создавай задачу без `summary` — спроси его явно
