---
name: html-push
description: Use when user invokes /html-push or asks to publish/deploy an HTML file to GitHub Pages with a public link.
---

# HTML Push — Deploy HTML to GitHub Pages

## Overview

Деплоит HTML-файл на GitHub Pages и возвращает публичную ссылку.
Файл публикуется в отдельный репозиторий (1 HTML = 1 репо) с автоматической настройкой GitHub Pages.

---

## Arguments

```
/html-push <path-to-html> [repo-name]
```

- `<path-to-html>` — путь к HTML-файлу (обязательный). Если не указан — спросить у пользователя.
- `[repo-name]` — имя репозитория на GitHub (опционально). Если не указано — сгенерировать из имени файла (без расширения).

---

## Configuration

| Параметр | Значение | Как изменить |
|---|---|---|
| GitHub org/user | Читать из `git remote -v` текущего проекта, взять org/user | Пользователь может указать явно |
| Visibility | `public` (GitHub Pages для free tier требует public repo) | — |
| Branch | `main` | — |
| Pages folder | `/ (root)` | — |

---

## Algorithm

### Step 1. Validate input

1. Проверить что файл существует и это `.html`
2. Определить `repo-name`: аргумент или `basename` файла без `.html`
3. Определить GitHub org: из `git remote -v` текущего проекта (`origin`), извлечь org/user
4. Финальный URL будет: `https://<org>.github.io/<repo-name>/`

### Step 2. Create GitHub repo via Playwright

GitHub API требует токен, а `gh auth` может быть не настроен. Используем Playwright:

1. Открыть `https://github.com/new`
2. Если не залогинен — GitHub покажет Dashboard (залогинен) или Login page
3. Если залогинен:
   - Заполнить Repository name = `repo-name`
   - Owner — выбрать нужный org (если org отличается от текущего пользователя, кликнуть dropdown owner)
   - Убедиться что **Public** выбран
   - Нажать **Create repository**
4. Если уже существует репозиторий — GitHub покажет ошибку. В этом случае:
   - Просто использовать существующий: `git remote set-url origin ...` и force push

### Step 3. Push HTML

```bash
TMPDIR=$(mktemp -d)
cp <path-to-html> "$TMPDIR/index.html"
cd "$TMPDIR"
git init
git checkout -b main
git add index.html
git commit -m "Deploy HTML page"
git remote add origin git@github.com:<org>/<repo-name>.git
git push -u origin main --force
```

**Важно:** файл ВСЕГДА называется `index.html` в репо — GitHub Pages его обслуживает как корневую страницу.

### Step 4. Enable GitHub Pages

Через Playwright:

1. Открыть `https://github.com/<org>/<repo-name>/settings/pages`
2. В секции Branch: нажать кнопку "None" (dropdown)
3. Выбрать "main"
4. Folder оставить "/ (root)"
5. Нажать "Save"
6. Дождаться сообщения "GitHub Pages source saved"

### Step 5. Wait for deploy

1. Открыть `https://github.com/<org>/<repo-name>/actions`
2. Проверить что workflow `pages-build-deployment` запущен
3. Подождать 30-60 секунд (деплой GitHub Pages)

### Step 6. Return result

Вернуть пользователю:

```
Готово! HTML опубликован:
https://<org>.github.io/<repo-name>/

Репозиторий: https://github.com/<org>/<repo-name>
```

---

## Edge Cases

### Репо уже существует
Если при создании GitHub выдаёт ошибку "repository already exists":
- Пушить с `--force` в существующий репо
- Pages уже может быть настроен — проверить и пропустить Step 4 если уже active

### Нет SSH-ключа
Проверить `ssh -T git@github.com` перед Step 2. Если не работает — сообщить пользователю.

### Файл с русским именем
При генерации repo-name из filename — транслитерировать или упростить: убрать кириллицу, спецсимволы, оставить `[a-z0-9-]`.

### Несколько HTML файлов
Если пользователь передал несколько файлов или директорию — скопировать все, но `index.html` должен быть один (main page). Остальные файлы доступны по прямым ссылкам.

---

## Notes

- GitHub Pages для free tier работает ТОЛЬКО с public репо
- Deploy занимает ~30-60 секунд после настройки Pages
- Для обновления: повторно запустить `/html-push` с тем же repo-name — сделает force push
- HTTPS включается автоматически для `*.github.io` доменов
