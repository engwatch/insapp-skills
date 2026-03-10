# Insapp Partner Skills

Скиллы для Claude Code, используемые аналитиками и менеджерами Insapp.

## Доступные скиллы

| Скилл | Команда | Описание |
|-------|---------|----------|
| report-mfo | `/report-mfo` | Отчёт по МФО-партнёру за период |

---

## Установка скиллов

### 1. Клонируй репозиторий (или только папку)

```bash
git clone git@github.com:engwatch/B-project.git /tmp/insapp-skills
```

### 2. Скопируй скилл в директорию Claude Code

```bash
mkdir -p ~/.claude/skills
cp -r /tmp/insapp-skills/for-partners/skills/report-mfo ~/.claude/skills/
```

### 3. Проверь установку

Запусти Claude Code и введи `/report-mfo` — скилл должен появиться в автодополнении.

---

## Использование `/report-mfo`

```
/report-mfo "[партнёр]" "[период]"
```

**Примеры:**
```
/report-mfo "ЛОКО-БАНК" "6–10 марта 2026"
/report-mfo "Тинькофф" "март 2026"
/report-mfo "МТС" "1–15 апреля 2026"
```

**Что делает скилл:**
1. Находит партнёра в базе данных Insapp
2. Запрашивает статистику по дням: визиты, переходы в МФО, выдачи, комиссии
3. Выводит таблицу прямо в терминале
4. Если настроен Google Drive MCP — создаёт Google Sheet и возвращает ссылку

**Вывод в терминале** работает всегда, без Google MCP:

```
## Отчёт: ЛОКО-БАНК | 6–10 марта 2026

| Дата       | Переходов | МФО           | Выдачи | Вход. КВ | Исх. КВ  | Доход    |   CR  |  EPC  |   EPL   |
|------------|-----------|---------------|--------|----------|----------|----------|-------|-------|---------|
| 06.03.2026 |       201 | OneClickMoney |      1 |  9 000 ₽ |  7 200 ₽ |  1 800 ₽ | 0.50% | 44.8₽ | 9 000 ₽ |
| ...        |           |               |        |          |          |          |       |       |         |
| ИТОГО      |       997 | —             |      3 | 27 000 ₽ | 21 600 ₽ |  5 400 ₽ | 0.30% | 27.1₽ | 9 000 ₽ |
```

---

## Требования и настройка MCP

### Обязательно: insapp-db MCP

Все данные запрашиваются из базы данных Insapp через MCP-сервер.

**Получи API-ключ** у команды разработки Insapp (Telegram: @insapp_dev).

**Добавь в конфиг Claude Code** (`~/.claude.json` → раздел твоего проекта → `mcpServers`):

```json
"insapp-db": {
  "type": "http",
  "url": "https://db-mcp.insapp.pro/mcp",
  "headers": {
    "x-api-key": "ВАШ_API_КЛЮЧ"
  }
}
```

**Или через CLI:**
```bash
claude mcp add insapp-db \
  --transport http \
  --url https://db-mcp.insapp.pro/mcp \
  --header "x-api-key: ВАШ_API_КЛЮЧ"
```

Перезапусти Claude Code после добавления.

---

### Опционально: Google Drive MCP (для создания Google Sheets)

Без этого MCP скилл работает в режиме «только терминал».
С ним — дополнительно создаёт отформатированный Google Sheet.

#### Шаг 1. Создай Google Cloud Project

1. Открой [Google Cloud Console](https://console.cloud.google.com/)
2. Нажми «Select a project» → «New Project»
3. Дай название (например, `Claude MCP`) → «Create»

#### Шаг 2. Включи нужные API

В разделе **APIs & Services → Library** включи:
- Google Drive API
- Google Sheets API
- Google Docs API (опционально)
- Google Calendar API (опционально)

#### Шаг 3. Создай OAuth 2.0 credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Desktop app**
3. Скачай JSON-файл с credentials
4. Сохрани его в `~/.config/google-drive-mcp/gcp-oauth.keys.json`

```bash
mkdir -p ~/.config/google-drive-mcp
mv ~/Downloads/client_secret_*.json ~/.config/google-drive-mcp/gcp-oauth.keys.json
```

#### Шаг 4. OAuth consent screen

В разделе **APIs & Services → OAuth consent screen**:
1. User Type: **Internal** (если аккаунт в Google Workspace) или External
2. Заполни App name, email
3. Добавь Scopes: `.../auth/drive`, `.../auth/spreadsheets`
4. Если External — добавь свой email в Test users

#### Шаг 5. Установи MCP-сервер

```bash
npx -y @alanse/mcp-server-google-workspace auth
```

Откроется браузер — авторизуйся под своим Google-аккаунтом.
Токен сохранится автоматически.

#### Шаг 6. Добавь в конфиг Claude Code

В `~/.claude.json` (или через claude mcp add):

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

`CLIENT_ID` и `CLIENT_SECRET` берутся из скачанного JSON-файла.

Перезапусти Claude Code. MCP появится в списке (`/mcp` команда).

---

## Playwright MCP (опционально, для форматирования таблиц)

Используется для конвертации диапазона в «умную таблицу» Google Sheets и подгонки ширины колонок.

```bash
# Устанавливается как плагин Claude Code
claude plugins add playwright
```

Без Playwright скилл создаст таблицу без конвертации в Table-формат.

---

## Структура репозитория

```
for-partners/
├── README.md                  # Эта инструкция
└── skills/
    └── report-mfo/
        └── SKILL.md           # Скилл для Claude Code
```

---

## Поддержка

Вопросы по скиллам и доступу к `insapp-db` MCP: Telegram @insapp_dev
