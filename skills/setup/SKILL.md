---
name: setup
description: Use when user invokes /setup or asks to set up the Claude Code self-learning system on a new project or machine. Downloads CLAUDE.md files, creates journals/ folder.
---

# Установка системы самообучения Claude Code

## Вызов
`/setup`
`/setup [что именно]`
`/setup fast`
`/setup thoughtful`

## Поведение

### Что настраивает `/setup`
`/setup` относится к проекту `Projects/self-learning-system/`.
По умолчанию это **thoughtful-проект**: здесь допустим режим работы с планом и осмысленной настройкой.

### Полная установка (`/setup`)
1. Проверь есть ли `~/.claude/CLAUDE.md`
   - Если нет: скачай из https://raw.githubusercontent.com/engwatch/insapp-skills/main/guides/claude-learning-system/CLAUDE.global.md
   - Если есть: обновляй только при реальной необходимости
2. Проверь есть ли `./CLAUDE.md` в корне проекта
   - Если нет: скачай из https://raw.githubusercontent.com/engwatch/insapp-skills/main/guides/claude-learning-system/CLAUDE.project.md
3. Проверь есть ли `Projects/`
   - Если нет: создай
4. Проверь есть ли `Projects/self-learning-system/CONTEXT.md`
   - Если нет: создай минимальный контекст проекта
5. Установи режим проекта в `Projects/self-learning-system/CONTEXT.md`
   - по умолчанию: `thoughtful`
   - если пользователь явно просит `/setup fast` → поставить `fast`
   - если пользователь явно просит `/setup thoughtful` → поставить `thoughtful`
6. Для режима `thoughtful` использовать project-local файлы:
   - `Projects/self-learning-system/GOAL.md`
   - `Projects/self-learning-system/ARCHIVE.md`
   - `Projects/self-learning-system/journals/`
7. Покажи статус: что уже было, что создано, какой режим проекта сохранён

### Частичная установка
- `/setup global` — только глобальный `CLAUDE.md`
- `/setup project` — только проектный `CLAUDE.md`
- `/setup fast` — сохранить для проекта режим `fast`
- `/setup thoughtful` — сохранить для проекта режим `thoughtful`

## Правила режима

### Если проект в режиме `thoughtful`
- можно использовать план;
- цель хранить в `Projects/self-learning-system/GOAL.md`;
- журнал хранить в `Projects/self-learning-system/journals/`;
- `WebSearch` не запускать автоматически — сначала спросить пользователя.

### Если проект в режиме `fast`
- для простых задач не разворачивать тяжёлый протокол;
- не запускать `WebSearch` по умолчанию;
- не создавать журнал и цель без необходимости.

## После установки
Скажи пользователю:
"Система установлена. Для проекта сохранён режим Claude. Дальше Claude должен брать его автоматически и не спрашивать заново, пока вы сами не поменяете режим через /setup fast или /setup thoughtful."