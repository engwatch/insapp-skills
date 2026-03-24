# Playwright с сохранением сессии (persistent session)

Настройка Playwright MCP для Claude Code с постоянным профилем браузера - логины в Google, Yandex и другие сервисы сохраняются между сессиями.

## Проблема

Стандартный плагин Playwright (`claude plugins add playwright`) каждый раз открывает чистый браузер без логинов. Приходится заново авторизовываться в Google, Yandex и т.д.

## Решение

Заменить стандартный плагин на кастомный MCP-сервер с флагом `--user-data-dir` - браузер сохраняет куки, сессии и localStorage между запусками.

## Установка

### 1. Отключить стандартный плагин Playwright

```bash
claude plugins remove playwright
```

Или вручную в `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "playwright@claude-plugins-official": false
  }
}
```

### 2. Создать папку для профиля

```bash
mkdir -p ~/.playwright-profile
```

### 3. Добавить кастомный MCP-сервер

В `~/.claude.json` в секцию `mcpServers` добавить:

```json
"playwright": {
  "type": "stdio",
  "command": "npx",
  "args": [
    "@playwright/mcp@latest",
    "--user-data-dir",
    "/Users/ВАШ_ИМЯ/.playwright-profile"
  ]
}
```

> **Важно:** замените `/Users/ВАШ_ИМЯ/` на ваш реальный путь (например `/Users/ivan/`).

### 4. Добавить разрешения

В `~/.claude/settings.json` в `permissions.allow` добавить:

```json
"mcp__playwright__*"
```

### 5. Перезапустить Claude Code

```bash
exit
claude
```

### 6. Залогиниться один раз

В первой сессии после настройки попросите Claude:

```
открой через плейрайт accounts.google.com
```

Откроется окно Chrome - залогиньтесь в Google вручную. После этого сессия сохранится навсегда.

## Как это работает

- `--user-data-dir ~/.playwright-profile` - Playwright сохраняет все данные браузера (куки, localStorage, логины) в эту папку
- `@playwright/mcp@latest` - автоматически использует последнюю версию при каждом запуске
- Профиль не шифрует куки (флаг `--use-mock-keychain`), поэтому сессии сохраняются надёжно

## FAQ

**Можно ли скопировать профиль из основного Chrome?**
Нет. Chrome шифрует куки через macOS Keychain, а Playwright использует `--use-mock-keychain`. Скопированные куки не расшифруются. Проще залогиниться один раз в Playwright-браузере.

**Обновляется ли Playwright автоматически?**
Да. `npx @playwright/mcp@latest` всегда скачивает последнюю версию.

**Можно ли работать с основным Chrome одновременно?**
Да. Playwright открывает отдельный экземпляр Chrome со своим профилем, они не конфликтуют.

**Что если сессия слетела?**
Залогиньтесь заново в окне Playwright-браузера. Или удалите профиль и пересоздайте:

```bash
rm -rf ~/.playwright-profile && mkdir -p ~/.playwright-profile
```

## Полный пример конфига

`~/.claude.json` (секция mcpServers):

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--user-data-dir",
        "/Users/ВАШ_ИМЯ/.playwright-profile"
      ]
    }
  }
}
```

`~/.claude/settings.json` (секция permissions):

```json
{
  "permissions": {
    "allow": [
      "mcp__playwright__*"
    ]
  }
}
```
