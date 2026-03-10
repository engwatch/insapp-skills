---
name: github-setup
description: Use when user asks to set up SSH for GitHub, create a new GitHub repository (private or public), or connect an existing local folder to GitHub. Covers full setup from SSH key generation to first push.
---

# GitHub SSH Setup & Repository Creation

## Overview

Полная настройка GitHub через SSH: генерация ключа, проверка соединения, создание репозитория через API, подключение локальной папки.

**Invocation:** `/github-setup`

---

## ШАГ 1 – Проверка и создание SSH ключа

```bash
# Проверить наличие ключей
ls -la ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub 2>&1
ls -la ~/.ssh/ 2>&1
```

**Если ключ найден** — показать содержимое публичного ключа и попросить добавить на https://github.com/settings/keys

**Если ключа нет** — создать:

```bash
ssh-keygen -t ed25519 -C "GitHub для Cursor" -f ~/.ssh/id_ed25519 -N ""
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
cat ~/.ssh/id_ed25519.pub
```

Показать публичный ключ пользователю и попросить добавить его на https://github.com/settings/keys

---

## ШАГ 2 – Подключение SSH к GitHub

После того как пользователь скажет, что добавил ключ:

```bash
# Запустить ssh-agent и добавить ключ
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Добавить GitHub в known_hosts превентивно (избегает ошибки Host key verification failed)
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts

# Проверить соединение
ssh -T git@github.com
```

Ожидаемый ответ: `Hi <username>! You've successfully authenticated...`

---

## ШАГ 3 – Настройка имени и почты для коммитов

```bash
git config --global user.name
git config --global user.email
```

Если пусто или стоят заглушки (`Your Name` / `your.email@example.com`) — спросить имя и почту у пользователя:

```bash
git config --global user.name "Имя Фамилия"
git config --global user.email "email@example.com"
```

> Эти данные попадают в каждый коммит и видны на GitHub.

---

## ШАГ 4 – Создание нового репозитория

### 4.1 Personal Access Token

Попросить пользователя создать токен на https://github.com/settings/tokens/new:
- **Scope:** отметить `repo` (полный доступ к репозиториям)
- **ВАЖНО:** `gh` CLI не использовать — требует дополнительный scope `read:org`, что вызывает ошибку при авторизации

### 4.2 Создать репо через GitHub API

```bash
# Приватный репозиторий:
curl -s -X POST https://api.github.com/user/repos \
  -H "Authorization: token <TOKEN>" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"name":"<repo-name>","private":true,"description":"<description>","auto_init":true}'

# Публичный репозиторий:
curl -s -X POST https://api.github.com/user/repos \
  -H "Authorization: token <TOKEN>" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"name":"<repo-name>","private":false,"description":"<description>","auto_init":true}'
```

Из ответа взять `ssh_url` вида `git@github.com:<username>/<repo-name>.git`

---

## ШАГ 5 – Подключение репозитория к локальной папке

**ВАЖНО:** Сначала спросить пользователя — есть ли уже локальная папка проекта.

### Если папка ЕСТЬ (подключить существующую):

```bash
cd /path/to/existing/project
git init
git remote add origin git@github.com:<username>/<repo-name>.git
git fetch origin
git branch -M main
git branch --set-upstream-to=origin/main main
git remote -v
git status
```

### Если папки НЕТ (клонировать):

```bash
git clone git@github.com:<username>/<repo-name>.git
cd <repo-name>
git remote -v
```

---

## ШАГ 6 – Первый коммит (по желанию)

```bash
# Создать .gitignore если нужно
# Добавить файлы и запушить
git add .
git commit -m "Initial commit"
git push origin main
```

---

## ШАГ 7 – Диагностика (если что-то не работает)

```bash
# Подробная проверка SSH
ssh -vT git@github.com

# Конфигурация SSH
cat ~/.ssh/config

# Права доступа
ls -la ~/.ssh/
```

Объяснить найденные проблемы и предложить конкретные команды для исправления.
