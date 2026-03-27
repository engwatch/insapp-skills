# Insapp Skills for Claude Code

Набор скиллов для [Claude Code](https://claude.ai/code) — автоматизируют рутинные задачи аналитики, отчётности и планирования встреч.

## Скиллы

| Скилл | Команда | Описание | Требования |
|-------|---------|----------|------------|
| [audio_script](skills/audio_script/) | `/audio_script` | Расшифровка звонков через Whisper + скрипт для AI колл-бота | Python, ffmpeg |
| [gitlab_dev_report](skills/gitlab_dev_report/) | `/gitlab_dev_report` | Отчёт продуктивности команды: коммиты, строки кода, MR, acceptance rate | gitlab MCP |
| [gitlab_fulltime_report](skills/gitlab_fulltime_report/) | `/gitlab_fulltime_report` | Полный отчёт по разработчику за всё время: помесячная разбивка, сложность задач, HTML | gitlab MCP, tracker MCP |
| [gitlab_compar](skills/gitlab_compar/) | `/gitlab_compar` | Сравнение команды за период: фичи, строки кода, сложность. HTML с вкладками | gitlab MCP, tracker MCP |
| [report-mfo](skills/report-mfo/) | `/report-mfo` | МФО-отчёт по партнёру за период | insapp-db MCP |
| [mfo-daily](skills/mfo-daily/) | `/mfo-daily` | Ежедневный МФО-отчёт по ВСЕМ партнёрам с трафиком за период | insapp-db MCP |
| [meet](skills/meet/) | `/meet` | Встреча в Телемост + Google Календарь | gdrive MCP, telemost MCP |
| [tracker](skills/tracker/) | `/tracker` | Интерактивный помощник Яндекс Трекера | tracker MCP |
| [tracker_report_active](skills/tracker_report_active/) | `/tracker_report_active` | Отчёт по сотруднику из Трекера: задачи + часы | tracker MCP |
| [tracker_add_task](skills/tracker_add_task/) | `/tracker_add_task` | Создать задачу в Яндекс Трекере | tracker MCP |
| [telegram_daily](skills/telegram_daily/) | `/telegram_daily` | Дайджест Telegram за 24ч: упоминания, сводка групп | Telegram MCP |
| [column-auto-width](skills/column-auto-width/) | — | Авто-ширина колонок Google Sheets | Playwright |
| [convert-to-table](skills/convert-to-table/) | — | Конвертировать диапазон в таблицу Google Sheets | Playwright |
| [github-setup](skills/github-setup/) | `/github-setup` | Настройка SSH для GitHub, создание репо, подключение папки | — |
| [legal_new_mfo](skills/legal_new_mfo/) | `/legal_new_mfo` | Генерация договоров лидогенерации МФО + обновление реестра | gdrive MCP |
| [html-push](skills/html-push/) | `/html-push` | Деплой HTML на GitHub Pages с публичной ссылкой | Playwright, SSH |
| [mfo-month-vendor](skills/mfo-month-vendor/) | `/mfo-month-vendor` | Сверка МФО по вендорам за месяц: листы партнёров + Итог | insapp-db MCP, gdrive MCP |
| [report_claude_use](skills/report_claude_use/) | `/report_claude_use` | Отчёт по использованию Claude Code: HTML-дашборд | — |
| [gitlab-find-dev-repos](skills/gitlab-find-dev-repos/) | — | Поиск всех репозиториев разработчика в GitLab | gitlab MCP |
| [hh-resume-search](skills/hh-resume-search/) | — | Эффективный поиск кандидатов на hh.ru через Playwright | Playwright |
| [playwright-tips](skills/playwright-tips/) | — | Блокировка JS-редиректов и обход anti-DDoS | Playwright |
| [tracker-tips](skills/tracker-tips/) | — | Резолв аккаунтов Яндекс Трекера: маппинг логинов | tracker MCP |
| [publick-push](skills/publick-push/) | `/publick_push` | Публикация скиллов в общий репозиторий | Git, SSH |
| [mfo-health-check](skills/mfo-health-check/) | `/mfo-health-check` | Диагностика финпродуктов: ошибки, комиссии, постбеки, выдачи | insapp-db MCP |

## Утилиты

| Утилита | Описание |
|---------|----------|
| [cc](tools/cc/) | Обёртка для `claude` — автоименование сессий во вкладке терминала |
| [statusline](tools/statusline/) | Статус-бар: контекст, дневной/недельный лимит, папка, сессия (авто-установка ИИ-агентом) |

## Гайды

| Гайд | Описание |
|------|----------|
| [claude-learning-system](guides/claude-learning-system/) | Система самообучения Claude Code: журналирование, навыки, долгосрочная память между сессиями |
| [playwright-persistent-session](guides/playwright-persistent-session/) | Playwright с сохранением логинов: Google, Yandex и др. между сессиями |

## MCP-серверы

Код серверов с инструкциями по установке:

| Сервер | Описание | Установка |
|--------|----------|-----------|
| [tracker](mcp-servers/tracker/) | Яндекс Трекер — 15 инструментов | [SETUP.md](skills/tracker/SETUP.md) |
| [telegram](mcp-servers/telegram/) | Telegram — дайджест, упоминания, отправка | [инструкция ниже](#telegram) |

Внешние MCP (устанавливаются через npm/pip):

| Сервер | Пакет | Установка |
|--------|-------|-----------|
| [gitlab](#gitlab) | `@zereight/mcp-gitlab` | конфиг ниже |
| [gdrive](#gdrive) | `@alanse/mcp-server-google-workspace` | [SETUP.md](skills/meet/SETUP.md) |
| [insapp-db](#insapp-db) | — | API-ключ от команды Insapp |
| [telemost](#telemost) | — | [SETUP.md](skills/meet/SETUP.md) |
| [Playwright](#playwright) | кастомный MCP | [инструкция](guides/playwright-persistent-session/) |

---

## Установка скиллов

```bash
# 1. Клонируй
git clone git@github.com:engwatch/insapp-skills.git /tmp/insapp-skills

# 2. Скопируй нужные скиллы
mkdir -p ~/.claude/skills
cp -r /tmp/insapp-skills/skills/. ~/.claude/skills/

# 3. Проверь — скиллы появятся в автодополнении при вводе /
```

---

## Настройка MCP

### insapp-db

Получи API-ключ у команды разработки Insapp.

```json
"insapp-db": {
  "type": "http",
  "url": "https://db-mcp.insapp.pro/mcp",
  "headers": {
    "x-api-key": "ВАШ_API_КЛЮЧ"
  }
}
```

### gdrive

Полная инструкция: [skills/meet/SETUP.md](skills/meet/SETUP.md) (Части 2 и 4).

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

### gitlab

```json
"gitlab": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@zereight/mcp-gitlab"],
  "env": {
    "GITLAB_PERSONAL_ACCESS_TOKEN": "ВАШ_ТОКЕН",
    "GITLAB_API_URL": "https://YOUR_GITLAB_HOST/api/v4"
  }
}
```

### tracker

Полная инструкция: [skills/tracker/SETUP.md](skills/tracker/SETUP.md)

```json
"tracker": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/ВАШ_ИМЯ/.mcp/tracker/index.js"],
  "env": {
    "YANDEX_OAUTH_TOKEN": "ВАШ_ТОКЕН",
    "YANDEX_ORG_ID": "8168995"
  }
}
```

### telemost

Полная инструкция: [skills/meet/SETUP.md](skills/meet/SETUP.md) (Части 1, 3, 4).

### telegram

Локальный Python MCP-сервер на [Telethon](https://github.com/LonamiWebs/Telethon). Данные не покидают компьютер.

**1. Получи API-ключи:** [my.telegram.org](https://my.telegram.org) → API development tools → `api_id` и `api_hash`

**2. Скачай и установи:**

```bash
mkdir -p ~/.claude/mcp-servers/telegram/session

curl -o ~/.claude/mcp-servers/telegram/server.py \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/telegram/server.py

curl -o ~/.claude/mcp-servers/telegram/auth.py \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/telegram/auth.py

curl -o ~/.claude/mcp-servers/telegram/requirements.txt \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/telegram/requirements.txt
```

**3. Вставь ключи** в `server.py` и `auth.py`:
```python
API_ID = 0           # ← число из my.telegram.org
API_HASH = ""        # ← строка из my.telegram.org
```

**4. Установи и авторизуйся:**

```bash
cd ~/.claude/mcp-servers/telegram
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python3 auth.py
```

**5. Добавь в конфиг** (`~/.claude.json` или `claude_desktop_config.json`):

```json
"telegram": {
  "command": "/Users/ВАШ_ИМЯ/.claude/mcp-servers/telegram/venv/bin/python3",
  "args": ["/Users/ВАШ_ИМЯ/.claude/mcp-servers/telegram/server.py"]
}
```

В `~/.claude/settings.json` → `permissions.allow`: `"mcp__telegram__*"`

### Playwright

Рекомендуется кастомный MCP с сохранением сессий (логины Google, Yandex и т.д.):
**[Полная инструкция](guides/playwright-persistent-session/)**

```json
"playwright": {
  "type": "stdio",
  "command": "npx",
  "args": ["@playwright/mcp@latest", "--user-data-dir", "/Users/ВАШ_ИМЯ/.playwright-profile"]
}
```

---

## Поддержка

Вопросы по скиллам и доступу к `insapp-db` MCP: Telegram [@danielspe](https://t.me/danielspe)
