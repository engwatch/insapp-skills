# Настройка Meeting Assistant

Этот сервис позволяет голосом управлять встречами: создавать встречи в Яндекс Телемост, искать участников в таблице сотрудников и автоматически ставить события в Google Календарь — всё через одну команду в терминале.

---

## Что тебе понадобится

- macOS
- Node.js (v18+): https://nodejs.org
- Claude Code: `npm install -g @anthropic-ai/claude-code`
- Аккаунт Яндекс (для Телемост)
- Аккаунт Google (для Календаря и Таблиц)

---

## Часть 1. Яндекс OAuth токен (для Телемост)

### 1.1 Создай OAuth-приложение

1. Открой https://oauth.yandex.ru/client/new
2. Заполни поля:
   - **Название**: любое, например `Meeting Bot`
   - **Платформы**: поставь галку **Веб-сервисы**
   - **Redirect URI**: введи `https://oauth.yandex.ru/verification_code`
3. В разделе **Доступы** найди категорию **Яндекс Телемост API** и выбери:
   - `telemost-api:conferences.create`
4. Нажми **Создать приложение**
5. Скопируй **ClientID** — он понадобится на следующем шаге

### 1.2 Получи токен

1. Вставь свой ClientID в эту ссылку и открой её в браузере:
   ```
   https://oauth.yandex.ru/authorize?response_type=token&client_id=ТВОЙ_CLIENT_ID
   ```
2. Войди в Яндекс и разреши доступ
3. Тебя перекинет на страницу вида:
   ```
   https://oauth.yandex.ru/verification_code#access_token=y0_XXXXX...&token_type=bearer&...
   ```
4. Скопируй значение после `access_token=` — это и есть твой токен (начинается с `y0_`)

---

## Часть 2. Google API (для Календаря и Таблиц)

### 2.1 Создай проект в Google Cloud Console

1. Открой https://console.cloud.google.com
2. Вверху нажми на выпадающий список проектов → **Новый проект**
3. Назови проект (например, `Meeting Bot`) → **Создать**

### 2.2 Включи нужные API

1. В левом меню: **API и сервисы → Библиотека**
2. Найди и включи поочерёдно (кнопка **Включить** на странице каждого):
   - `Google Calendar API`
   - `Google Sheets API`
   - `Google Drive API`
   - `Gmail API`

### 2.3 Настрой экран согласия OAuth

1. **API и сервисы → Экран согласия OAuth**
2. Выбери **Внешний** → **Создать**
3. Заполни:
   - **Название приложения**: `Meeting Bot`
   - **Email поддержки**: твой gmail
   - **Контактные данные разработчика**: твой gmail
4. Нажми **Сохранить и продолжить** на всех шагах
5. На шаге **Тестовые пользователи** добавь свой gmail

### 2.4 Создай учётные данные (Client ID и Client Secret)

1. **API и сервисы → Учётные данные → Создать учётные данные → Идентификатор клиента OAuth**
2. Тип приложения: **Приложение для ПК (Desktop)**
3. Название: любое → **Создать**
4. Скопируй **Идентификатор клиента** (`CLIENT_ID`) и **Секрет клиента** (`CLIENT_SECRET`)

---

## Часть 3. Установка MCP-сервера Телемост

```bash
mkdir -p ~/.mcp/calendar
cd ~/.mcp/calendar
npm init -y
npm install @modelcontextprotocol/sdk
```

Создай файл `~/.mcp/calendar/index.js` со следующим содержимым:

```js
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const TOKEN = process.env.YANDEX_OAUTH_TOKEN;

const server = new Server(
  { name: 'telemost', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'create_meeting',
    description: 'Создать встречу в Яндекс Телемост и получить ссылку для подключения',
    inputSchema: { type: 'object', properties: {}, required: [] },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'create_meeting') throw new Error(`Unknown tool: ${request.params.name}`);

  const response = await fetch('https://cloud-api.yandex.net/v1/telemost-api/conferences', {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.text();
    return { content: [{ type: 'text', text: `Ошибка ${response.status}: ${error}` }], isError: true };
  }

  const data = await response.json();
  return { content: [{ type: 'text', text: data.join_url }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Добавь в `package.json` строку `"type": "module"`:
```json
{
  "type": "module",
  ...
}
```

---

## Часть 4. Подключи MCP к Claude Code

Открой файл `~/.claude.json` и найди секцию своего проекта в `projects`. Добавь внутрь `mcpServers`:

```json
"telemost": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/ТВОЙ_ПОЛЬЗОВАТЕЛЬ/.mcp/calendar/index.js"],
  "env": {
    "YANDEX_OAUTH_TOKEN": "ВСТАВЬ_СВОЙ_ТОКЕН"
  }
},
"gdrive": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@alanse/mcp-server-google-workspace"],
  "env": {
    "CLIENT_ID": "ВСТАВЬ_СВОЙ_CLIENT_ID",
    "CLIENT_SECRET": "ВСТАВЬ_СВОЙ_CLIENT_SECRET",
    "GWORKSPACE_CREDS_DIR": "/Users/ТВОЙ_ПОЛЬЗОВАТЕЛЬ/.config/google-drive-mcp"
  }
}
```

При первом запуске Google MCP откроется браузер для авторизации — войди в свой Google аккаунт и разреши доступ. Токен сохранится в `GWORKSPACE_CREDS_DIR`.

---

## Часть 5. Создай команду `meeting`

Добавь алиас в `~/.zshrc` (или `~/.bashrc`):

```bash
echo "alias meeting='claude --project \"/Users/ТВОЙ_ПОЛЬЗОВАТЕЛЬ/ПУТЬ_К_ПРОЕКТУ\"'" >> ~/.zshrc
source ~/.zshrc
```

Замени `ТВОЙ_ПОЛЬЗОВАТЕЛЬ` и `ПУТЬ_К_ПРОЕКТУ` на свои значения.

---

## Использование

Открой терминал и напиши:
```
meeting
```

Дальше общайся с Claude на русском:

```
Создай встречу на пятницу в 10:00 МСК, добавь Иванова и Петрову
```

```
Создай встречу завтра в 15:30, добавь ivan@gmail.com
```

Claude сам:
1. Создаст встречу в Яндекс Телемост
2. Найдёт Gmail участников в таблице сотрудников (если указано имя)
3. Создаст событие в Google Календарь с ссылкой и приглашениями

---

## Таблица сотрудников (опционально)

Если хочешь, чтобы Claude искал участников по имени, создай Google Таблицу со структурой:

| A: Имя | B: Корп. почта | C: Статус | D: Почта Google | E: Яндекс почта | F: Telegram |
|--------|---------------|-----------|-----------------|-----------------|-------------|

Скопируй ID таблицы из URL (часть между `/d/` и `/edit`) и сообщи Claude: *"Таблица сотрудников: ID_ТАБЛИЦЫ"*.
