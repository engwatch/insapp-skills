# MFO Dashboard — Insapp Report Viewer

Браузерный дашборд для просмотра отчётов по МФО-партнёрам. Flask-сервер проксирует запросы к MCP API (insapp-db), отдаёт HTML-интерфейс с выбором партнёра, периода и детализацией по дням/МФО.

## Быстрый старт

### 1. Клонировать репо

```bash
git clone https://git.insapp.pro/KlimovS/insapp-claude-skills.git
cd insapp-claude-skills/tools/mfo-dashboard
```

### 2. Установить зависимости

```bash
pip3 install flask requests
```

### 3. Задать API-ключ

Получите ключ от MCP-сервера `insapp-db` (спросите у администратора или возьмите из MCP-конфига Claude Code).

```bash
export INSAPP_DB_API_KEY="ваш_ключ_от_insapp_db"
```

Или создайте файл `.env` и загружайте через `source .env`:

```bash
echo 'export INSAPP_DB_API_KEY="ваш_ключ"' > .env
source .env
```

### 4. Запустить

```bash
python3 app.py
```

Откроется на http://localhost:5000

## Использование

1. Выберите партнёра (МТС Банк / ЛОКО)
2. Задайте период дат
3. Нажмите «Загрузить»
4. Кликните на `+` рядом с датой для детализации по МФО

## Как добавить нового партнёра

В файле `config.py` добавьте запись в словарь `PARTNERS`:

```python
PARTNERS = {
    # ...существующие...
    "new_partner": {
        "id": "uuid-партнёра-из-таблицы-Partners",
        "name": "Название для UI",
        "split": 80,  # процент партнёра от КВ
    },
}
```

Затем добавьте `<option>` в `templates/index.html`:

```html
<option value="new_partner">Название для UI</option>
```

## Для других продуктов

Сейчас дашборд настроен на МФО-займы (`ProductTypeId=5`, `ChannelTypeId=2`). Чтобы адаптировать под другой продукт:

1. В `app.py` замените фильтры `a.ProductTypeId=5 AND a.ChannelTypeId=2` на нужные значения
2. Проверьте что SQL-запросы в `api_summary` и `api_day` корректны для вашего продукта
3. При необходимости измените список колонок в `static/app.js`

## Структура

```
mfo-dashboard/
├── app.py           # Flask-сервер + API-эндпоинты
├── config.py        # MCP-ключ, партнёры (INSAPP_DB_API_KEY)
├── mcp_client.py    # JSON-RPC клиент для insapp-db MCP
├── static/
│   ├── style.css    # Стили в дизайн-системе Insapp
│   └── app.js       # Фронтенд: рендер карточек и таблицы
└── templates/
    └── index.html   # HTML-шаблон с SVG-логотипом Insapp
```

## Требования

- Python 3.8+
- `flask`, `requests`
- Доступ к MCP-серверу `https://db-mcp.insapp.pro/mcp` с валидным API-ключом
