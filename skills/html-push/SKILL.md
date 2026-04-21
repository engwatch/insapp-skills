---
name: html-push
description: Use when user invokes /html-push or asks to publish/deploy an HTML file to GitHub Pages with a public link.
---

# HTML Push — Publish ready HTML to GitHub Pages

## Overview

Публикует **уже готовый HTML-файл** на GitHub Pages и возвращает публичную ссылку.
`/html-push` отвечает только за публикацию: repo, push, Pages, пароль, ссылка.

Генерация и дизайн HTML должны происходить отдельно через `/html` или другой специализированный skill.
Файл публикуется в отдельный репозиторий (1 HTML = 1 репо) с автоматической настройкой GitHub Pages.

**Важно:** `/html-push` не должен заново проектировать HTML, менять структуру документа или превращаться в генератор отчёта.

Схема использования:
1. `/html` - сделать локальный HTML
2. проверить локально
3. `/html-push` - опубликовать готовый файл

## Command split
- `/html` - генерация HTML-артефакта
- `/html-push` - публикация готового HTML-артефакта

Нельзя смешивать эти роли в одном skill.

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

### Step 2. Preflight before publish

`/html-push` проверяет, что файл уже готов к публикации.

Перед деплоем:
1. Прочитать исходный HTML-файл.
2. Проверить, что это финальный локальный артефакт, а не черновик.
3. Убедиться, что генерация HTML уже выполнена отдельным шагом (`/html` или другим skill).
4. При необходимости открыть локальный HTML и убедиться, что он не пустой/не битый.
5. После публикации открыть public URL и проверить, что страница доступна.

**Запрещено внутри `/html-push`:**
- заново придумывать дизайн страницы;
- переписывать структуру HTML;
- превращать skill в генератор отчёта;
- изобретать новый password-wrapper вручную, если пользователь просит просто опубликовать существующий HTML.

Если HTML ещё не создан или явно сырой - сначала использовать `/html`, а не расширять `/html-push` до генератора.

### Step 3. Prepare HTML

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

#### КРИТИЧНО: Тема lock-screen — ТОЛЬКО СВЕТЛАЯ

**ЗАПРЕЩЕНО**: тёмный фон, тёмные градиенты (#1a1a2e, #16213e и т.д.), белый текст на тёмном.

**Обязательный стиль lock-screen:**
- Фон: `#f5f6fa` (светло-серый)
- Карточка: `#fff` с `box-shadow: 0 4px 24px rgba(0,0,0,.08)`, border `#e0e0e0`
- Текст: `#2d3436` (заголовок), `#636e72` (подпись)
- Input: `background: #f8f9fa`, `border: #dfe6e9`, `color: #2d3436`
- Focus: `border-color: #0984e3`
- Кнопка по умолчанию: `background: #0984e3`, `color: #fff`
- Hover кнопки: заметно темнее/контрастнее, например `#0770c2`, плюс можно добавить тень/лёгкий lift
- Active/pressed кнопки: ещё одно отдельное состояние — темнее hover, с эффектом нажатия (`transform`, inset-shadow или аналог)
- Ошибка: `color: #d63031`

Это также распространяется на HTML-файлы с встроенной парольной защитой (SHA-1, кастомная) — если у файла есть lock-screen, проверить что он светлый перед деплоем.

#### КРИТИЧНО: Шрифты в зашифрованных страницах

`@import url(...)` внутри `<style>` НЕ РАБОТАЕТ после динамической вставки HTML. CSS-правило игнорируется браузером. Шрифт fallback-ится на serif.

**Обязательный порядок:**

1. **В `<head>` обёртки пароля** — сразу грузить Google Fonts через `<link>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```
Это предзагружает шрифт пока пользователь вводит пароль.

2. **В скрипте расшифровки** — распарсить расшифрованный HTML через `new DOMParser()`, вставить `<link>` на Google Fonts в `<head>` распарсенного документа, затем полностью переписать документ как при обычной загрузке страницы. Это единственный способ заставить браузер нормально перепарсить HTML, включая `@import` и `<link>`.

**КРИТИЧНО: НЕ собирать `<!DOCTYPE html>` через строку с newline вообще.**

Для password-wrapper использовать только безопасный паттерн с несколькими аргументами `document.write()`:
```js
document.open();
document.write('<!DOCTYPE html>', doc.documentElement.outerHTML);
document.close();
```

Почему так:
- `document.write()` по спецификации принимает несколько строк и пишет их по порядку;
- это убирает весь класс ошибок с `\n`, `String.fromCharCode(10)`, сериализацией и случайным попаданием реального line break внутрь JS-строки;
- предыдущие варианты уже ломались в публикации с ошибкой `Invalid or unexpected token`.

**Запрещено в skill:**
- `document.write('<!DOCTYPE html>\n' + ...)`
- `document.write('<!DOCTYPE html>' + '\n' + ...)`
- `document.write('<!DOCTYPE html>' + String.fromCharCode(10) + ...)`
- любой вариант, где между кавычками вообще появляется перенос строки.

Если вставить настоящий newline между кавычками, опубликованная страница ломается с ошибкой `Invalid or unexpected token` ещё до расшифровки — это уже воспроизводилось многократно в `html-push`.

**Обязательная проверка после публикации:** открыть public URL, ввести пароль, убедиться, что пропала lock-screen форма и реально загрузился расшифрованный HTML.

**ЗАПРЕЩЕНО для расшифровки:**
- `document.replaceChild()` — CSS @import не парсится
- `insertAdjacentHTML()` — CSS @import не парсится
- `innerHTML` — CSS @import не парсится
- Инжект `<link>` ПОСЛЕ замены DOM — race condition, шрифт не успевает

**ОБЯЗАТЕЛЬНАЯ финальная проверка после публикации:**
1. открыть public URL;
2. ввести пароль;
3. убедиться, что пропала lock-screen форма и загрузился реальный HTML-документ;
4. проверить, что title страницы сменился с lock-screen на title расшифрованного HTML.

### Step 4. Create GitHub repo

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

### Step 5. Push HTML

```bash
cd "$TMPDIR"
git init && git checkout -b main
git add index.html
git commit -m "Deploy HTML page"
git remote add origin git@github.com:<org>/<repo-name>.git
git push -u origin main --force
```

### Step 6. Enable GitHub Pages

Через API:

```bash
curl -s -X POST https://api.github.com/repos/<org>/<repo-name>/pages \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"source":{"branch":"main","path":"/"}}'
```

Если Pages уже настроен (409 Conflict) — пропустить.

### Step 7. Wait and return

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
