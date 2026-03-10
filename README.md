# Insapp Skills for Claude Code

Набор скиллов для [Claude Code](https://claude.ai/code) — автоматизируют рутинные задачи аналитики, отчётности и планирования встреч.

## Скиллы

| Скилл | Команда | Описание | Требования |
|-------|---------|----------|------------|
| [report-mfo](#report-mfo) | `/report-mfo` | МФО-отчёт по партнёру за период | insapp-db MCP |
| [meet](#meet) | `/meet` | Создать встречу в Телемост + Google Календарь | gdrive MCP, telemost MCP |
| [column-auto-width](#column-auto-width) | — | Авто-ширина колонок Google Sheets | gdrive MCP, Playwright |
| [convert-to-table](#convert-to-table) | — | Конвертировать диапазон в таблицу Google Sheets | gdrive MCP, Playwright |

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

Полная инструкция: [skills/meet/SETUP.md](skills/meet/SETUP.md) (Части 2 и 4).

Кратко:
1. [Google Cloud Console](https://console.cloud.google.com) → создать проект → включить Drive, Sheets, Calendar API
2. Credentials → OAuth client ID → Desktop app → скачать JSON
3. Сохранить как `~/.config/google-drive-mcp/gcp-oauth.keys.json`
4. Добавить в `~/.claude.json`:

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

При первом запуске откроется браузер для авторизации Google.

### telemost — для создания встреч

Полная инструкция: [skills/meet/SETUP.md](skills/meet/SETUP.md) (Части 1, 3, 4).

### Playwright — для форматирования таблиц

```bash
claude plugins add playwright
```

---

## Поддержка

Вопросы по скиллам и доступу к `insapp-db` MCP: Telegram @insapp_dev
