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
/html-push <path-to-html> [repo-name] [password:<пароль>]
```

- `<path-to-html>` — путь к HTML-файлу (обязательный). Если не указан — спросить у пользователя.
- `[repo-name]` — имя репозитория на GitHub (опционально). Если не указано — сгенерировать из имени файла (без расширения).
- `[password:<пароль>]` — опционально. Если указан — HTML шифруется AES-256-GCM, страница показывает форму ввода пароля.

**Примеры:**
```
/html-push ~/report.html
/html-push ~/report.html my-report
/html-push ~/report.html my-report password:secretpass
/html-push ~/secret.html password:1234
```

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
2. Определить `repo-name`: аргумент или `basename` файла без `.html` (транслитерировать кириллицу, оставить `[a-z0-9-]`)
3. Определить GitHub org: из `git remote -v` текущего проекта (`origin`), извлечь org/user
4. Определить есть ли пароль: искать аргумент `password:...` в команде
5. Финальный URL: `https://<org>.github.io/<repo-name>/`

### Step 2. Prepare HTML

**Без пароля** — копировать файл как есть:

```bash
TMPDIR=$(mktemp -d)
cp <path-to-html> "$TMPDIR/index.html"
```

**С паролем** — зашифровать AES-256-GCM через Python-скрипт.

Написать Python-скрипт который:
1. Читает оригинальный HTML файл
2. Генерирует случайный salt (16 байт) и iv (12 байт)
3. Деривит ключ через PBKDF2-SHA256 (100000 итераций)
4. Шифрует содержимое через AESGCM
5. Генерирует HTML-обёртку с:
   - Формой ввода пароля (input type=password + кнопка "Открыть")
   - Зашифрованным контентом в base64 (в JS-переменных SALT, IV, CT)
   - Web Crypto API: PBKDF2 → AES-GCM decrypt
   - При успешной расшифровке: заменить всё содержимое страницы на расшифрованный HTML
   - При ошибке: показать "Неверный пароль"
6. Записывает результат в `$TMPDIR/index.html`

Зависимость: `pip3 install cryptography --break-system-packages -q` (если не установлен).

Стиль lock-screen: светлый фон, белая карточка по центру, иконка замка, поле пароля, кнопка.

### Step 3. Create GitHub repo

Получить токен из git credentials и создать через API:

```bash
# Получить токен
TOKEN=$(echo -e "protocol=https\nhost=github.com" | git credential fill 2>/dev/null | grep password | cut -d= -f2)

# Создать репо через API
curl -s -X POST https://api.github.com/user/repos \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"<repo-name>","public":true}'
```

Если ответ содержит "already exists" — использовать существующий.

### Step 4. Push HTML

```bash
cd "$TMPDIR"
git init && git checkout -b main
git add index.html
git commit -m "Deploy HTML page"
git remote add origin git@github.com:<org>/<repo-name>.git
git push -u origin main --force
```

### Step 5. Enable GitHub Pages

Через API:

```bash
curl -s -X POST https://api.github.com/repos/<org>/<repo-name>/pages \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"source":{"branch":"main","path":"/"}}'
```

Если Pages уже настроен (409 Conflict) — пропустить.

### Step 6. Wait and return

Подождать 40 секунд, вернуть пользователю:

```
Готово! HTML опубликован:
https://<org>.github.io/<repo-name>/

Репозиторий: https://github.com/<org>/<repo-name>
```

Если был пароль — добавить:
```
Страница защищена паролем. Контент зашифрован AES-256-GCM.
```

---

## Edge Cases

### Репо уже существует
Пушить с `--force` в существующий. Pages уже может быть настроен — пропустить Step 5.

### Нет SSH-ключа
Проверить `ssh -T git@github.com` перед Step 3. Если не работает — сообщить пользователю.

### Файл с русским именем
При генерации repo-name — убрать кириллицу, спецсимволы, оставить `[a-z0-9-]`.

### Нет модуля cryptography (для password)
```bash
pip3 install cryptography --break-system-packages -q
```

---

## Notes

- GitHub Pages для free tier работает ТОЛЬКО с public репо
- Deploy занимает ~30-60 секунд после настройки Pages
- Для обновления: повторно запустить `/html-push` с тем же repo-name — сделает force push
- HTTPS включается автоматически для `*.github.io` доменов
- Шифрование: AES-256-GCM + PBKDF2 (100k итераций). Без пароля контент не читается даже из исходников страницы.
