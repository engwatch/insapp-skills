# Insapp Skills for Claude Code

Набор скиллов для [Claude Code](https://claude.ai/code) — автоматизируют рутинные задачи аналитики, отчётности и планирования встреч.

## Скиллы

| Скилл | Команда | Описание | Требования |
|-------|---------|----------|------------|
| [report-mfo](#report-mfo) | `/report-mfo` | МФО-отчёт по партнёру за период | insapp-db MCP |
| [meet](#meet) | `/meet` | Создать встречу в Телемост + Google Календарь | gdrive MCP, telemost MCP |
| [tracker_report_active](#tracker_report_active) | `/tracker_report_active` | Отчёт по сотруднику из Яндекс Трекера: задачи + часы | tracker MCP |
| [tracker](#tracker) | `/tracker` | Интерактивный помощник Яндекс Трекера: задачи, ворклоги, статистика | tracker MCP |
| [tracker_add_task](#tracker_add_task) | `/tracker_add_task` | Создать задачу в Яндекс Трекере | tracker MCP |
| [column-auto-width](#column-auto-width) | — | Авто-ширина колонок Google Sheets | gdrive MCP, Playwright |
| [convert-to-table](#convert-to-table) | — | Конвертировать диапазон в таблицу Google Sheets | gdrive MCP, Playwright |
| [github-setup](#github-setup) | `/github-setup` | Настройка SSH для GitHub, создание приватного/публичного репо, подключение папки | — |

---

## Установка

### 1. Клонируй репозиторий

```bash
git clone git@github.com:engwatch/insapp-skills.git /tmp/insapp-skills
```

### 2. Скопируй нужные скиллы

```bash
# Все скиллы сразу
mkdir -p ~/.claude/skills
cp -r /tmp/insapp-skills/skills/. ~/.claude/skills/

# Или только конкретный
cp -r /tmp/insapp-skills/skills/report-mfo ~/.claude/skills/
```

### 3. Проверь

Запусти Claude Code — скиллы появятся в автодополнении при вводе `/`.

---

## Описание скиллов

### report-mfo

**Команда:** `/report-mfo "[партнёр]" "[период]"`

Создаёт отчёт по МФО-партнёру: визиты, переходы, выдачи, комиссии — по дням.

**Примеры:**
```
/report-mfo "ЛОКО-БАНК" "6–10 марта 2026"
/report-mfo "Тинькофф" "март 2026"
```

**Что делает:**
1. Находит партнёра в БД Insapp
2. Запрашивает статистику по дням (визиты, переходы в МФО, выдачи, комиссии)
3. Выводит таблицу в терминале (всегда, без Google MCP)
4. Если настроен gdrive MCP — создаёт Google Sheet по шаблону

**Пример вывода в терминале:**
```
## Отчёт: ЛОКО-БАНК | 6–8 марта 2026

| Дата       | Переходов | МФО           | Выдачи | Вход. КВ | Исх. КВ  | Доход   |   CR  |  EPC  |   EPL   |
|------------|-----------|---------------|--------|----------|----------|---------|-------|-------|---------|
| 06.03.2026 |       229 | OneClickMoney |      1 |  9 000 ₽ |  7 200 ₽ | 1 800 ₽ | 0.44% |  39 ₽ | 9 000 ₽ |
| 07.03.2026 |       169 | OneClickMoney |      2 | 18 000 ₽ | 14 400 ₽ | 3 600 ₽ | 1.18% | 107 ₽ | 9 000 ₽ |
| ИТОГО      |       398 | —             |      3 | 27 000 ₽ | 21 600 ₽ | 5 400 ₽ | 0.75% |  68 ₽ | 9 000 ₽ |
```

**Требования:** `insapp-db` MCP (обязательно), `gdrive` MCP (опционально для Google Sheets)

📄 [SKILL.md](skills/report-mfo/SKILL.md)

---

### meet

**Команда:** `/meet` или фраза "создай встречу..."

Создаёт встречу в Яндекс Телемост, находит участников по имени в таблице сотрудников, ставит событие в Google Календарь с приглашениями.

**Примеры:**
```
Создай встречу на пятницу в 10:00, добавь Иванова и Петрову
Встреча завтра в 15:30 с ivan@gmail.com
```

**Требования:** `gdrive` MCP (Google Календарь + Таблицы), `telemost` MCP (Яндекс Телемост)

📄 [SKILL.md](skills/meet/SKILL.md) · 📋 [Инструкция по установке](skills/meet/SETUP.md)

---

### tracker

**Команда:** `/tracker [запрос]`

Интерактивный помощник для работы с Яндекс Трекером. Если запрос не указан — спрашивает что нужно сделать и предлагает меню действий.

**Примеры:**
```
/tracker
/tracker покажи мои задачи
/tracker INS-123
/tracker создай задачу
/tracker залогируй 2 часа INS-456
```

**Что умеет:**
- Просмотр задач (по ключу, мои задачи, поиск)
- Создание задач с резолвом исполнителя по имени
- Обновление задач: статус, поля, переходы
- Логирование времени
- Статистика по сотруднику / команде / очереди

**Требования:** `tracker` MCP — Яндекс Трекер

📄 [SKILL.md](skills/tracker/SKILL.md)

---

### tracker_report_active

**Команда:** `/tracker_report_active "[сотрудник]" "[период]"`

Отчёт по активности сотрудника в Яндекс Трекере за период. Показывает задачи, сгруппированные по статусу, и залогированные часы (если есть).

**Примеры:**
```
/tracker_report_active Котов
/tracker_report_active Свистунов 2–10 марта
/tracker_report_active Листопад март 2026
```

**Что делает:**
1. Находит оба аккаунта сотрудника (старый + новый) в Трекере
2. Ищет задачи по обоим аккаунтам параллельно
3. Проверяет залогированные часы
4. Выводит задачи по группам статусов + итоговую строку

**Требования:** `tracker` MCP — Яндекс Трекер

📄 [SKILL.md](skills/tracker_report_active/SKILL.md)

---

### tracker_add_task

**Команда:** `/tracker_add_task`

Создаёт задачу в Яндекс Трекере. Принимает параметры в свободной форме, резолвит исполнителя по имени, устанавливает дедлайн.

**Примеры:**
```
/tracker_add_task
/tracker_add_task Внедрить Claude Code → Гуркин, срок 11 марта, очередь INS
```

**Параметры:**
- `summary` — название (обязательно, спросит если не указано)
- `assignee` — исполнитель по имени или логину
- `queue` — очередь (по умолчанию `INS`)
- `deadline` — срок (понимает "11 марта", "2026-03-11")
- `description` — описание задачи
- `priority` — `critical`, `blocker`, `major`, `normal`, `minor`

Возвращает ссылку на созданную задачу `https://tracker.yandex.ru/INS-XXXX`.

**Требования:** `tracker` MCP — Яндекс Трекер

📄 [SKILL.md](skills/tracker_add_task/SKILL.md)

---

### column-auto-width

Подгоняет ширину колонок Google Sheets под содержимое через Playwright.

Используется другими скиллами автоматически. Можно вызвать вручную, сослав на этот скилл в запросе.

**Особенности:**
- Если колонка содержит длинный текст в одной ячейке — используй фиксированную ширину вместо авто-подбора
- Canvas Google Sheets всегда начинается с `y=142`, заголовки колонок на `y≈152`

**Требования:** Playwright MCP (`claude plugins add playwright`)

📄 [SKILL.md](skills/column-auto-width/SKILL.md)

---

### convert-to-table

Конвертирует диапазон Google Sheets в структурированную таблицу (фильтры, сортировка, чередование строк) через Playwright. MCP не умеет этого — только через браузерную автоматизацию.

**Требования:** Playwright MCP (`claude plugins add playwright`)

📄 [SKILL.md](skills/convert-to-table/SKILL.md)

---

### github-setup

**Команда:** `/github-setup`

Полная настройка GitHub через SSH: генерация ключа, подключение к GitHub, создание репозитория (приватного или публичного), привязка существующей локальной папки.

**Что делает:**
1. Проверяет/создаёт SSH ключ ed25519
2. Добавляет GitHub в known_hosts и проверяет соединение
3. Настраивает имя и почту для коммитов
4. Создаёт репозиторий через GitHub API (без gh CLI — используется токен)
5. Подключает существующую папку проекта к репозиторию (или клонирует если папки нет)
6. Первый коммит и push

**Важные особенности:**
- Использует GitHub API (`curl`) вместо `gh` CLI — gh требует scope `read:org`, что вызывает ошибку
- При подключении существующей папки использует `git init` + `git remote add`, а НЕ `git clone`
- Превентивно добавляет GitHub в `known_hosts` через `ssh-keyscan`

**Требования:** нет (только bash + git + ssh)

📄 [SKILL.md](skills/github-setup/SKILL.md)

---

## Настройка MCP

### insapp-db — обязательно для report-mfo

Получи API-ключ у команды разработки Insapp.

Добавь в `~/.claude.json` → секция твоего проекта → `mcpServers`:
```json
"insapp-db": {
  "type": "http",
  "url": "https://db-mcp.insapp.pro/mcp",
  "headers": {
    "x-api-key": "ВАШ_API_КЛЮЧ"
  }
}
```

### gdrive — для Google Sheets и Календаря

Используется пакет `@alanse/mcp-server-google-workspace`. Полная инструкция: [skills/meet/SETUP.md](skills/meet/SETUP.md) (Части 2 и 4).

Кратко:
1. [Google Cloud Console](https://console.cloud.google.com) → создать проект → включить Drive, Sheets, Calendar API
2. **API и сервисы → Credentials → Create Credentials → OAuth client ID → Desktop app**
3. Скопируй `Client ID` и `Client Secret` из созданного credential (скачивать JSON и сохранять файл не нужно)
4. Создай папку для токена авторизации:
   ```bash
   mkdir -p ~/.config/google-drive-mcp
   ```
5. Добавь в `~/.claude.json`:

```json
"gdrive": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@alanse/mcp-server-google-workspace"],
  "env": {
    "CLIENT_ID": "ВАШ_CLIENT_ID",
    "CLIENT_SECRET": "ВАШ_CLIENT_SECRET",
    "GWORKSPACE_CREDS_DIR": "/Users/ВАШ_ИМЯ/.config/google-drive-mcp"
  }
}
```

При первом запуске Claude Code откроется браузер для авторизации Google — токен сохранится в `GWORKSPACE_CREDS_DIR` автоматически.

### tracker — для работы с Яндекс Трекером

Используется скиллами `tracker_report_active` и `tracker_add_task`. Требует OAuth-токен Яндекса и ID организации.

1. Получи OAuth-токен: [oauth.yandex.ru](https://oauth.yandex.ru) (приложение с правами на Трекер)
2. ID организации — в URL трекера: `https://tracker.yandex.ru/` → настройки организации
3. Установи MCP-сервер:

```bash
git clone git@github.com:engwatch/insapp-skills.git /tmp/insapp-skills
# Или возьми готовый из репозитория (если опубликован)
```

Добавь в `~/.claude.json` → секция твоего проекта → `mcpServers`:
```json
"tracker": {
  "type": "stdio",
  "command": "node",
  "args": ["/путь/к/tracker-mcp/index.js"],
  "env": {
    "YANDEX_OAUTH_TOKEN": "ВАШ_ТОКЕН",
    "YANDEX_ORG_ID": "ВАШ_ORG_ID"
  }
}
```

### telemost — для создания встреч

Полная инструкция: [skills/meet/SETUP.md](skills/meet/SETUP.md) (Части 1, 3, 4).

### Playwright — для форматирования таблиц

```bash
claude plugins add playwright
```

---

## Поддержка

Вопросы по скиллам и доступу к `insapp-db` MCP: Telegram @insapp_dev
