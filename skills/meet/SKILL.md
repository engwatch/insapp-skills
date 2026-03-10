---
name: meet
description: Use when user asks to create a meeting (создать встречу, запланировать встречу, meet). Creates Telemost meeting, looks up attendees in Google Sheets, creates Google Calendar event.
---

# Meet — создание встречи

## Алгоритм (строго по порядку, всё параллельно где возможно)

### Шаг 1 + 2 параллельно: Телемост и поиск участников

**Телемост** — используй `mcp__telemost__create_meeting`.
Если недоступен — curl:
```
curl -s -X POST https://cloud-api.yandex.net/v1/telemost-api/conferences \
  -H "Authorization: OAuth [YANDEX_OAUTH_TOKEN]" \
  -H "Content-Type: application/json" -d '{}'
```

**Поиск участников** — если указаны имена (не email):
- Таблица сотрудников: ID указан в настройках проекта (`EMPLOYEES_SHEET_ID`)
- Колонка A = Имя, Колонка D = Gmail
- Искать через `mcp__gdrive__gsheets_read`, брать email из колонки D
- Никогда не искать через Gmail

### Шаг 3: Google Календарь

`mcp__gdrive__calendar_create_event`:
- `calendarId`: `primary`
- `summary`: название от пользователя, иначе "Встреча"
- `startTime` / `endTime`: ISO 8601, МСК = `+03:00`, длительность 1 час по умолчанию
- `description`: ссылка Телемост из шага 1
- `attendees`: Gmail из шага 2
- `sendUpdates`: `all`

## Ответ пользователю
- Название, дата/время МСК
- Ссылка Телемост
- Кто приглашён (имя + email)
