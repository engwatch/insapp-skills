# Insapp Skills for Claude Code

Набор скиллов для [Claude Code](https://claude.ai/code) — автоматизируют рутинные задачи аналитики, отчётности и планирования встреч.

## Скиллы

| Скилл | Команда | Описание | Требования |
|-------|---------|----------|------------|
| [audio_script](#audio_script) | `/audio_script` | Расшифровка звонков через Whisper + готовый скрипт для AI колл-бота | Python, ffmpeg |
| [gitlab_dev_report](#gitlab_dev_report) | `/gitlab_dev_report` | Отчёт продуктивности команды: коммиты, строки кода, MR, acceptance rate | gitlab MCP |
| [gitlab_fulltime_report](#gitlab_fulltime_report) | `/gitlab_fulltime_report` | Полный отчёт по разработчику за всё время: коммиты, MR, помесячная разбивка, сложность задач, HTML | gitlab MCP, tracker MCP |
| [gitlab_compar](#gitlab_compar) | `/gitlab_compar` | Командный сравнительный отчёт за период (по умолчанию неделя): что делал каждый разработчик, строки кода, фичи, сложность задач. HTML с вкладками | gitlab MCP, tracker MCP |
| [report-mfo](#report-mfo) | `/report-mfo` | МФО-отчёт по партнёру за период | insapp-db MCP |
| [meet](#meet) | `/meet` | Создать встречу в Телемост + Google Календарь | gdrive MCP, telemost MCP |
| [tracker_report_active](#tracker_report_active) | `/tracker_report_active` | Отчёт по сотруднику из Яндекс Трекера: задачи + часы | tracker MCP |
| [tracker](#tracker) | `/tracker` | Интерактивный помощник Яндекс Трекера: задачи, ворклоги, статистика | tracker MCP |
| [tracker_add_task](#tracker_add_task) | `/tracker_add_task` | Создать задачу в Яндекс Трекере | tracker MCP |
| [telegram_daily](#telegram_daily) | `/telegram_daily` | Дайджест Telegram за 24ч: упоминания, прямые теги, сводка целевых групп | Telegram MCP (локальный) |
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

### audio_script

**Команда:** `/audio_script [папка с записями]`

Расшифровывает аудиозаписи звонков (MP3, M4A, WAV) через локальный Whisper и создаёт готовый скрипт для AI колл-бота с ветками возражений.

**Примеры:**
```
/audio_script
/audio_script ~/Downloads/calls
/audio_script "Call centr"
```

**Что делает:**
1. Находит все аудиофайлы в папке
2. Устанавливает `openai-whisper` и `ffmpeg` если не установлены
3. Расшифровывает каждый звонок (модель `small`, язык `ru`)
4. Размечает реплики «Менеджер / Клиент» по контексту
5. Создаёт `TRANSCRIPT_RAW.md` — все расшифровки с разметкой спикеров
6. Анализирует паттерны: типовые возражения, успешные ответы, USP
7. Создаёт `CALLBOT_SCRIPT.md` — готовый скрипт с системным промптом, ветками, стоп-фразами, JSON-конфигом

**Пример вывода:**
```
call-folder/
├── call_001.mp3
├── call_002.mp3
├── TRANSCRIPT_RAW.md      ← расшифровки с разметкой
└── CALLBOT_SCRIPT.md      ← скрипт для AI колл-бота
```

**Структура CALLBOT_SCRIPT.md:**
- Системный промпт с переменными `{CLIENT_NAME}`, `{PRODUCT_NAME}` и т.д.
- Приветствие (дословно из записей)
- Ветки возражений — по одной на каждый тип из реальных звонков
- Завершение разговора
- Таблица ключевых фактов (кэшбэки, USP, условия)
- Стоп-фразы и реакция бота
- JSON-конфиг (таймаут, перезвон, эскалация на оператора)

**Требования:** Python 3, `openai-whisper` (`pip3 install openai-whisper`), `ffmpeg` (`brew install ffmpeg`)

**Установка зависимостей (один раз):**
```bash
pip3 install openai-whisper --break-system-packages
brew install ffmpeg   # macOS
# sudo apt install ffmpeg  # Ubuntu/Debian
```

📄 [SKILL.md](skills/audio_script/SKILL.md)

---

### gitlab_dev_report

**Команда:** `/gitlab_dev_report [project] [период]`

Собирает отчёт по продуктивности команды разработки за период: коммиты, строки кода, MR статистика, acceptance rate, среднее время до merge. Опционально — оценка сложности задач из трекера и экспорт в Google Sheets.

**Примеры:**
```
/gitlab_dev_report
/gitlab_dev_report insapp 2 недели
/gitlab_dev_report backend-api март 2026
```

**Что делает:**
1. Находит проект по названию или ID (если не указан — показывает доступные проекты)
2. Забирает все коммиты и MR за период (с пагинацией)
3. Группирует по разработчикам, объединяет алиасы (`Alex` + `Alex Svistunov` → один человек)
4. Считает метрики: коммиты, +/- строк, строк/день (нетто), MR создано/merged/closed, acceptance rate, avg merge time
5. Опционально подтягивает задачи из трекера и оценивает сложность (⭐–⭐⭐⭐⭐⭐)
6. Выводит отчёт в терминале — и предлагает создать Google Sheet (3 листа: сводная, детали, задачи)

**Пример вывода:**
```
## 📊 GitLab Dev Report — insapp
Период: 24 фев — 10 мар 2026

### 👨‍💻 Dmitriy Listopad (@Listopad)

Коммиты: 44  |  +21 914 / -794 строк  |  ~1 509 строк/день

Merge Requests:
- Создано: 17  |  Смержено: 15  |  Отклонено: 1
- Acceptance rate: 94%
- Среднее время до merge: 22 ч

Фичи:
- reliability-fix → merged  ⭐⭐⭐⭐⭐ CRITICAL
- payment-patch-v2 → merged  ⭐⭐
```

**Требования:**
- `gitlab` MCP — любой `@zereight/mcp-gitlab` или совместимый (read_api + read_repository токен)
- `gdrive` MCP — опционально, для экспорта в Google Sheets
- `tracker` MCP — опционально, для оценки сложности задач

**Настройка gitlab MCP:**
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

📄 [SKILL.md](skills/gitlab_dev_report/SKILL.md)

---

### gitlab_fulltime_report

**Команда:** `/gitlab_fulltime_report [developer] [project]`

Полный отчёт по деятельности разработчика за всё время работы в проекте: коммиты, строки кода, MR статистика, помесячная разбивка, оценка сложности задач из трекера, качественный анализ. Опционально — HTML-отчёт в светлой теме.

**Примеры:**
```
/gitlab_fulltime_report
/gitlab_fulltime_report svistunov
/gitlab_fulltime_report alex.petrov backend-api
```

**Что делает:**
1. Определяет период активности разработчика (от первого коммита до сегодня)
2. Забирает все коммиты с пагинацией, объединяет алиасы (разные git-имена одного человека)
3. Собирает все MR за весь период
4. Группирует по месяцам с флагами: 🔥 пиковый, ⭐ сложные задачи, 📦 много MR, 🔧 техдолг
5. Подтягивает задачи из трекера (INS-XXXX, BACK-XXXX из branch names) и оценивает сложность (⭐–⭐⭐⭐⭐⭐)
6. Выводит отчёт в терминале с итоговыми метриками и анализом качества
7. Опционально генерирует HTML-файл (светлая тема, карточки, таблицы, quality bar)

**Пример вывода:**
```
## 📊 Full-Period Dev Report — Alex Svistunov (@svistunov)
Проект: backend-api
Период: 2025-08-01 — 2026-03-11 (7 месяцев)

### 📅 Хронология по месяцам
**2025-08** 🔥⭐
Коммитов: 12 | +1 840 / -430 строк | MR: 3 смержено
Задачи: INS-123 (Интеграция — ⭐⭐⭐⭐), INS-145 (фикс — ⭐⭐)

### 📊 Итоговые метрики
Коммитов: 87 | Строк: +15 230 / -4 890 | Нетто: +10 340
MR создано: 28 | Смержено: 24 | Acceptance rate: 86%
```

**Требования:**
- `gitlab` MCP — `@zereight/mcp-gitlab` или совместимый (read_api + read_repository)
- `tracker` MCP — опционально, для оценки сложности задач

📄 [SKILL.md](skills/gitlab_fulltime_report/SKILL.md)

---

### gitlab_compar

**Команда:** `/gitlab_compar [period] [project_id]`

Командный сравнительный отчёт за период. По умолчанию — последние 7 дней. Показывает что каждый разработчик делал: фичи, строки кода, MR, сложность задач. Сохраняет HTML-файл в `~/Downloads/`.

**Примеры:**
```
/gitlab_compar                       — последняя неделя
/gitlab_compar 2w                    — 2 недели
/gitlab_compar 2026-03               — март 2026
/gitlab_compar 2026-02-01:2026-02-28 — произвольный диапазон
/gitlab_compar 1w 42                 — неделя, проект #42
```

**Что делает:**
1. Вычисляет даты периода (Bash)
2. Находит всех активных разработчиков за период
3. Параллельно собирает по каждому: коммиты + строки кода + MR + тикеты из трекера
4. Определяет алиасы (один человек — несколько git-имён) по email
5. Группирует задачи по типу: интеграции / баги / бизнес-логика / инфраструктура
6. Оценивает сложность каждой задачи (⭐–⭐⭐⭐⭐⭐)
7. Создаёт HTML-отчёт `~/Downloads/team-compar-YYYY-MM-DD.html` с вкладками per-developer
8. Открывает HTML в браузере

**Формат вывода:**

Терминал (сводная таблица) → HTML-файл (вкладки: Обзор / каждый разработчик / Сравнение).

Главный блок каждой вкладки — «Задачи периода»: группированные по типу, с объёмом строк кода и сложностью. Инсайты — максимум 3 строки, читается за 5 секунд.

**Требования:**
- `gitlab` MCP — `@zereight/mcp-gitlab` или совместимый (read_api + read_repository)
- `tracker` MCP — опционально, для оценки сложности задач по тикетам

📄 [SKILL.md](skills/gitlab_compar/SKILL.md)

---

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

### telegram_daily

**Команда:** `/telegram_daily [keyword]`

Дайджест Telegram за последние 24 часа: кто тебя тегал, что происходило в целевых группах, какие вопросы остались без ответа.

**Примеры:**
```
/telegram_daily
/telegram_daily Acme
/telegram_daily MyCompany
```

**Что делает:**
1. Вызывает `get_daily_summary` из Telegram MCP
2. Извлекает прямые упоминания `@username` — сортирует по приоритету (внешние партнёры > коллеги)
3. Собирает сводку по группам, содержащим ключевое слово (по умолчанию "Insapp")
4. Выделяет сообщения с вопросами (`?`, "подскажи", "когда") — они требуют ответа
5. Выводит форматированный дайджест с разделами: прямые обращения / сводка групп / требуют ответа

**Пример вывода:**
```
## 📬 Прямые обращения к @username

**1. [08:12] Финуслуги | Insapp | МФО — Nikaletta**
"обещали по трафику вернуться с 27 февраля, пока трафика нет @username"
→ требует ответа

## 📊 Сводка групп [Insapp] — 12 групп, 89 сообщений

**2030ai | Insapp (36 сообщений)**
- [06:04] Geo M: Залил скилл с локальным Whisper...
- [10:23] Глеб: ИИ плохо отрабатывает скиллы...
```

**Требования:** Telegram MCP (локальный Python-сервер, инструкция ниже)

**Установка:** см. [telegram MCP setup](#telegram--для-дайджеста-telegram) или полный гайд в [SKILL.md](skills/telegram_daily/SKILL.md)

📄 [SKILL.md](skills/telegram_daily/SKILL.md)

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

### telegram — для дайджеста Telegram

Локальный Python MCP-сервер на базе [Telethon](https://github.com/LonamiWebs/Telethon). Читает твой Telegram через официальный User API — данные не покидают компьютер.

**Шаг 1. Получи API-ключи**

1. Открой [https://my.telegram.org](https://my.telegram.org) → войди под своим номером
2. **API development tools** → создай новое приложение (название любое)
3. Скопируй `App api_id` (число) и `App api_hash` (строка)

**Шаг 2. Создай директорию и скачай файлы**

```bash
mkdir -p ~/.claude/mcp-servers/telegram/session

curl -o ~/.claude/mcp-servers/telegram/server.py \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/telegram/server.py

curl -o ~/.claude/mcp-servers/telegram/auth.py \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/telegram/auth.py

curl -o ~/.claude/mcp-servers/telegram/requirements.txt \
  https://raw.githubusercontent.com/engwatch/insapp-skills/main/mcp-servers/telegram/requirements.txt
```

**Шаг 3. Вставь свои ключи**

Открой `~/.claude/mcp-servers/telegram/server.py` и `auth.py`, замени:
```python
API_ID = 0           # ← вставить число из my.telegram.org
API_HASH = ""        # ← вставить строку из my.telegram.org
```

**Шаг 4. Установи зависимости**

```bash
cd ~/.claude/mcp-servers/telegram
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

**Шаг 5. Авторизуйся (один раз)**

```bash
./venv/bin/python3 auth.py
```

Скрипт спросит номер телефона, код из Telegram-приложения и пароль 2FA (если включён). После создаётся `session/user.session`.

**Шаг 6. Добавь в конфиг Claude Desktop**

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "telegram": {
      "command": "/Users/YOUR_USERNAME/.claude/mcp-servers/telegram/venv/bin/python3",
      "args": [
        "/Users/YOUR_USERNAME/.claude/mcp-servers/telegram/server.py"
      ]
    }
  }
}
```

> Заменить `YOUR_USERNAME` на реальное имя пользователя (`echo $USER`).

**Шаг 7. Добавь разрешения**

В `~/.claude/settings.json` добавь в `permissions.allow`:
```json
"mcp__telegram__*"
```

**Шаг 8. Перезапусти Claude Code**

Доступные инструменты:
- `get_daily_summary` — полный дайджест за 24ч
- `get_mentions(hours)` — только упоминания за N часов
- `get_insapp_summary(hours)` — только группы с ключевым словом
- `send_message(chat, text)` — отправить сообщение

### Playwright — для форматирования таблиц

```bash
claude plugins add playwright
```

---

## Поддержка

Вопросы по скиллам и доступу к `insapp-db` MCP: Telegram @insapp_dev
