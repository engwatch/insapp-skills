# Навык: Поиск всех репозиториев разработчика в GitLab

## Когда применять
Когда нужно найти ВСЕ проекты, в которых работает разработчик, и project_id неизвестны.

## Как делать

### Шаг 1: Глобальный поиск через MR
```
list_merge_requests(scope="all", author_username="Фамилия", state="all", per_page=100)
```
Попробовать варианты: `Damaskin`, `damaskin`, `DamaskinI`.

Из результатов извлечь:
- Все уникальные `project_id`
- Username и ID пользователя
- URL проектов (из `web_url` MR)

### Шаг 2: Перебор project_id для коммитов без MR
```
list_commits(project_id=N, author="Имя", since="...", per_page=1)
```
Пройти по всем доступным project_id (1-19), чтобы найти проекты куда коммитил напрямую.

### Шаг 3: Сбор данных с with_stats
```
list_commits(project_id=N, author="Имя", since="...", until="...", per_page=100, with_stats=true)
```

## Почему это работает
- `list_merge_requests` без `project_id` ищет глобально
- `list_commits` — только в конкретном проекте
- GitLab `author` в list_commits — substring match: `author=Ivan` найдёт `Ivan Damaskin`
- Разработчик может иметь несколько email-алиасов, но `author=Имя` ловит все

## Важно
- Проекты 5, 7 — 404. Проекты >= 20 — не существуют.
- Некоторые разработчики коммитят напрямую без MR (Дамаскин, Тарасов) — шаг 2 обязателен.
