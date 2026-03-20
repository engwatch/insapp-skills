# Яндекс Трекер MCP

MCP-сервер для Яндекс Трекера — 15 инструментов: управление задачами, ворклоги, аналитика по сотрудникам и командам. Работает через [Yandex Tracker API v2](https://cloud.yandex.ru/docs/tracker/about-api).

**Исходный код:** [`mcp-servers/tracker/`](../../mcp-servers/tracker/) — [index.js](../../mcp-servers/tracker/index.js) | [api.js](../../mcp-servers/tracker/api.js) | [package.json](../../mcp-servers/tracker/package.json)

**Скиллы:** [`/tracker`](SKILL.md) — интерактивный помощник | [`/tracker_report_active`](../tracker_report_active/SKILL.md) — отчёт активности | [`/tracker_add_task`](../tracker_add_task/SKILL.md) — создание задач

---

## Что понадобится

- macOS / Linux
- Node.js (v18+): https://nodejs.org
- Claude Code: `npm install -g @anthropic-ai/claude-code`
- Аккаунт в Яндекс 360 с доступом к Трекеру
- ID организации в Яндекс 360

---

## Быстрый путь: автоматическая настройка через Claude Code + Playwright

Если у тебя уже установлен Claude Code с плагином Playwright (`claude plugins add playwright`), весь процесс получения токена можно автоматизировать:

1. Скажи Claude:
   ```
   Настрой мне Яндекс Трекер MCP. Логин: ваш@email.ru, пароль: ваш_пароль
   ```
2. Claude через Playwright сам:
   - Откроет https://oauth.yandex.ru/client/new
   - Создаст OAuth-приложение с правами `tracker:read` и `tracker:write`
   - Получит ClientID
   - Откроет страницу авторизации и получит OAuth-токен
   - Скачает файлы MCP-сервера, установит зависимости
   - Пропишет конфиг в `~/.claude.json` и разрешения в `settings.json`
3. После перезапуска Claude Code — трекер готов к работе

> **Безопасность:** логин и пароль используются только в локальном браузере Playwright на твоём компьютере. Они не отправляются ни на какие внешние серверы. Если на аккаунте включена 2FA — Claude попросит ввести код из приложения/SMS.

Если предпочитаешь настроить вручную — следуй пошаговой инструкции ниже.

---

## Часть 1. Создание OAuth-приложения в Яндексе (вручную)

### 1.1 Создай приложение

1. Открой https://oauth.yandex.ru/client/new
2. Заполни поля:
   - **Название**: любое, например `Tracker MCP`
   - **Иконка**: загрузи любую картинку (поле обязательное)
3. Нажми **Продолжить**

### 1.2 Выбери платформу

1. На шаге «Платформы» выбери **Веб-сервисы**
2. **Redirect URI**: введи `https://oauth.yandex.ru/verification_code`
3. Нажми **Продолжить**

### 1.3 Добавь права доступа к Трекеру

1. На шаге «Доступы» найди поле **Дополнительные** (или раздел **Яндекс Трекер**)
2. Добавь два права:
   - `tracker:read` — Чтение из трекера
   - `tracker:write` — Запись в трекер
3. Нажми **Продолжить**

### 1.4 Создай приложение

1. Проверь настройки на шаге предпросмотра
2. Нажми **Создать приложение**
3. Скопируй **ClientID** — он понадобится на следующем шаге

---

## Часть 2. Получение OAuth-токена

1. Подставь свой ClientID в ссылку и открой в браузере:
   ```
   https://oauth.yandex.ru/authorize?response_type=token&client_id=ТВОЙ_CLIENT_ID
   ```
2. Войди в Яндекс (если ещё не вошёл) и нажми **Разрешить**
3. Тебя перенаправит на страницу вида:
   ```
   https://oauth.yandex.ru/verification_code#access_token=y0_XXXXX...&token_type=bearer&...
   ```
4. Скопируй значение после `access_token=` — это твой OAuth-токен (начинается с `y0_`)

> **Срок жизни токена:** по умолчанию ~1 год. Если токен истечёт — повтори этот шаг с той же ссылкой.

---

## Часть 3. Узнай ID организации

ID организации нужен для всех запросов к API Трекера.

**Способ 1:** Открой https://tracker.yandex.ru/ → Администрирование → ID организации в URL или настройках.

**Способ 2:** Спроси у администратора Яндекс 360 вашей компании.

> Для Insapp: `8168995`

---

## Часть 4. Установка MCP-сервера

### 4.1 Скачай файлы из репозитория

```bash
mkdir -p ~/.mcp/tracker

curl -o ~/.mcp/tracker/index.js \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/tracker/index.js

curl -o ~/.mcp/tracker/api.js \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/tracker/api.js

curl -o ~/.mcp/tracker/package.json \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/tracker/package.json
```

### 4.2 Установи зависимости

```bash
cd ~/.mcp/tracker && npm install
```

### 4.3 Проверь что сервер запускается

```bash
YANDEX_OAUTH_TOKEN="ТВОЙ_ТОКЕН" \
YANDEX_ORG_ID="ТВОЙ_ORG_ID" \
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node ~/.mcp/tracker/index.js 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']['tools']), 'tools')"
```

Ожидаемый результат: `15 tools`

---

## Часть 5. Подключение к Claude Code

### 5.1 Добавь MCP-сервер в конфиг

Открой `~/.claude.json` и найди секцию своего проекта в `projects`. Добавь внутрь `mcpServers`:

```json
"tracker": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/ТВОЙ_ПОЛЬЗОВАТЕЛЬ/.mcp/tracker/index.js"],
  "env": {
    "YANDEX_OAUTH_TOKEN": "ВСТАВЬ_СВОЙ_ТОКЕН",
    "YANDEX_ORG_ID": "8168995"
  }
}
```

> Замени `ТВОЙ_ПОЛЬЗОВАТЕЛЬ` на имя пользователя macOS (`echo $USER`).
> Замени `YANDEX_ORG_ID` на ID вашей организации (для Insapp: `8168995`).

### 5.2 Добавь разрешения

В `~/.claude/settings.json` добавь в массив `permissions.allow`:

```json
"mcp__tracker__list_queues",
"mcp__tracker__list_users",
"mcp__tracker__resolve_user",
"mcp__tracker__list_issues",
"mcp__tracker__get_issue",
"mcp__tracker__create_issue",
"mcp__tracker__update_issue",
"mcp__tracker__move_issue",
"mcp__tracker__list_transitions",
"mcp__tracker__add_worklog",
"mcp__tracker__search_issues",
"mcp__tracker__get_employee_stats",
"mcp__tracker__get_worklogs",
"mcp__tracker__get_team_stats",
"mcp__tracker__get_queue_stats"
```

Или кратко: `"mcp__tracker__*"`

### 5.3 Перезапусти Claude Code

После перезапуска инструменты трекера станут доступны. Проверь:

```
/tracker
```

---

## Инструменты (15 штук)

| Инструмент | Описание |
|-----------|----------|
| `list_queues` | Список всех очередей |
| `list_users` | Список сотрудников организации |
| `resolve_user` | Найти все аккаунты сотрудника (старый + новый) |
| `list_issues` | Список задач с фильтрацией |
| `get_issue` | Детали задачи по ключу (INS-123) |
| `create_issue` | Создать задачу |
| `update_issue` | Обновить поля задачи |
| `move_issue` | Сменить статус задачи |
| `list_transitions` | Доступные переходы статуса |
| `add_worklog` | Залогировать время (формат PT2H30M) |
| `search_issues` | Полнотекстовый поиск + сложные фильтры |
| `get_employee_stats` | Статистика сотрудника за период |
| `get_worklogs` | Ворклоги сотрудника за период |
| `get_team_stats` | Сравнительная статистика команды |
| `get_queue_stats` | Сводка по очереди |

---

## Связанные скиллы

После настройки MCP станут доступны скиллы:

- `/tracker` — интерактивный помощник (задачи, ворклоги, статистика)
- `/tracker_report_active [сотрудник] [период]` — отчёт по активности сотрудника
- `/tracker_add_task [описание]` — создать задачу
- `/gitlab_fulltime_report [разработчик]` — полный отчёт (GitLab + Трекер)
- `/gitlab_compar [период]` — сравнение команды (GitLab + Трекер)

---

## Обновление токена

Если токен истёк (ошибка 401):

1. Открой ту же ссылку авторизации с твоим ClientID:
   ```
   https://oauth.yandex.ru/authorize?response_type=token&client_id=ТВОЙ_CLIENT_ID
   ```
2. Скопируй новый токен
3. Обнови `YANDEX_OAUTH_TOKEN` в `~/.claude.json`
4. Перезапусти Claude Code
