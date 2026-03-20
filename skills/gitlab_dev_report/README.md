# GitLab Dev Report — отчёт продуктивности команды

Собирает отчёт по продуктивности команды разработки за период: коммиты, строки кода, MR статистика, acceptance rate, среднее время до merge.

## Команда

```
/gitlab_dev_report [project] [период]
/gitlab_dev_report insapp 2 недели
/gitlab_dev_report backend-api март 2026
```

## Что делает

1. Находит проект по названию или ID
2. Забирает все коммиты и MR за период (с пагинацией)
3. Группирует по разработчикам, объединяет алиасы (`Alex` + `Alex Svistunov` → один человек)
4. Считает метрики: коммиты, +/- строк, строк/день (нетто), MR создано/merged/closed, acceptance rate, avg merge time
5. Опционально подтягивает задачи из трекера и оценивает сложность
6. Выводит отчёт в терминале — и предлагает создать Google Sheet

## Пример вывода

```
## GitLab Dev Report — insapp
Период: 24 фев — 10 мар 2026

### Dmitriy Listopad (@Listopad)
Коммиты: 44  |  +21 914 / -794 строк  |  ~1 509 строк/день

Merge Requests:
- Создано: 17  |  Смержено: 15  |  Отклонено: 1
- Acceptance rate: 94%
- Среднее время до merge: 22 ч
```

## Требования

- `gitlab` MCP — `@zereight/mcp-gitlab` или совместимый (read_api + read_repository)
- `gdrive` MCP — опционально, для экспорта в Google Sheets
- `tracker` MCP — опционально, для оценки сложности задач

### Настройка gitlab MCP

```json
"gitlab": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@zereight/mcp-gitlab"],
  "env": {
    "GITLAB_PERSONAL_ACCESS_TOKEN": "ВАШ_ТОКЕН",
    "GITLAB_API_URL": "https://YOUR_GITLAB_HOST/api/v4"
  }
}
```
