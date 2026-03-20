---
name: publick-push
description: Use when user invokes /publick_push or asks to publish/push skills to the public repo engwatch/insapp-skills.
---

# Publish Skills to Public Repo

## Overview

Синхронизирует скиллы из локального проекта в публичный репо `engwatch/insapp-skills`.

**Public repo:** `git@github.com:engwatch/insapp-skills.git`
**Local tmp:** `/tmp/insapp-skills`

---

## Steps

### 1. Pull latest public repo

```bash
if [ -d /tmp/insapp-skills ]; then
  git -C /tmp/insapp-skills pull origin main
else
  git clone git@github.com:engwatch/insapp-skills.git /tmp/insapp-skills
fi
```

### 2. Determine what to sync

Источники скиллов:
- `~/.claude/skills/[skill-name]/SKILL.md` — актуальные версии
- `~/Library/Mobile Documents/com~apple~CloudDocs/Cursor cloud/B-project/for-partners/` — публичная папка проекта

Правило: если скилл изменился в `~/.claude/skills/` — копируй оттуда. Если новый скилл из проекта — из `for-partners/skills/`.

### 3. Copy updated skills

```bash
# Пример копирования конкретного скилла:
cp ~/.claude/skills/report-mfo/SKILL.md /tmp/insapp-skills/skills/report-mfo/SKILL.md

# Или всю папку:
cp -r ~/.claude/skills/[skill-name] /tmp/insapp-skills/skills/
```

Убедись, что личные данные (токены, ID таблиц, API-ключи) заменены на плейсхолдеры перед копированием.

### 4. Update README if needed

Если добавлен новый скилл — обнови `/tmp/insapp-skills/README.md`: добавь строку в таблицу скиллов и секцию описания.

### 5. Commit and push

```bash
cd /tmp/insapp-skills
git add -A
git status   # проверь что едет в коммит
git commit -m "[краткое описание изменений]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

### 6. Return public repo URL

`https://github.com/engwatch/insapp-skills`

---

## Skill Mapping

| Локальный скилл | Путь в публичном репо |
|---|---|
| `~/.claude/skills/report-mfo/` | `skills/report-mfo/` |
| `~/.claude/skills/publick-push/` | — (не публикуется, internal) |
| `~/.claude/skills/meet/` → из `calendar/for-friends/` | `skills/meet/` |
| `sheet-command/column-auto-width/` | `skills/column-auto-width/` |
| `sheet-command/convert-to-table/` | `skills/convert-to-table/` |
| `~/.claude/skills/telegram_daily/` | `skills/telegram_daily/` |

---

## Notes

- **Не публиковать:** скиллы с личными токенами, ID таблиц сотрудников, внутренними URL
- **Всегда проверять** `git status` перед коммитом — не должно быть лишних файлов
- **Синхронизировать** `B-project/for-partners/` после push: скопировать обратно из `/tmp/insapp-skills` если там были правки README
