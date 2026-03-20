# HTML Push — деплой на GitHub Pages

Деплоит любой HTML-файл на GitHub Pages и возвращает публичную ссылку. Один HTML = один репо. Идеально для отчётов, дашбордов и презентаций.

## Команда

```
/html-push <path-to-html> [repo-name]
/html-push ~/reports/dashboard.html my-dashboard
```

Результат: `https://engwatch.github.io/my-dashboard/`

## Что делает

1. Создаёт публичный GitHub-репозиторий через Playwright
2. Пушит HTML как `index.html` через SSH
3. Включает GitHub Pages (main branch, root)
4. Ждёт деплоя и возвращает публичную ссылку

## Требования

- Playwright MCP (`claude plugins add playwright`)
- SSH-ключ для GitHub (`ssh -T git@github.com` должен работать)
