# Навык: Поиск кандидатов на hh.ru через Playwright — раундовая методология

## Когда применять
Когда нужно найти специалистов узкого профиля на hh.ru через Playwright.

## Методология: раундовый поиск с углублением

Поиск ведётся итеративно раундами (R1, R2, R3...). Каждый раунд сужает фокус и углубляет поиск.

### Принцип: "компании из резюме → новые запросы"
1. **R1 — широкие запросы** по ролям: "affiliate manager финансы", "head of CPA", "CPA сеть МФО PDL"
2. **R2 — анализ найденных резюме**: выписать ВСЕ компании, где работали кандидаты. Это — список целевых компаний.
3. **R3 — поиск по компаниям**: "Leads.su CPA", "LINKPROFIT affiliate", "Fincpanetwork CPA". Каждая компания из резюме R1-R2 = отдельный запрос.
4. **R4 — "Похожие резюме"**: открыть каждого золотого кандидата → блок "Похожие резюме" внизу → ML-матчинг находит то, что текстовый поиск пропускает.
5. **R5 — целевой поиск**: комбинации "компания + роль" ("Сравни.ру CPA affiliate руководитель"), "продукт + роль" ("CPA сеть финансы вебмастер лидогенерация МФО")
6. **R6 — внешние источники**: LinkedIn, Google, vc.ru, конференции (FinAdTech), RUNET-ID — поиск спикеров и авторов статей по теме
7. **R7 — креативный поиск**: спикеры конференций, авторы статей, упоминания в прессе, отставки/переходы

### Ключевое правило
**С каждым раундом запросы становятся конкретнее.** R1 = "affiliate manager финансы" (609 резюме). R5 = "Сравни.ру партнёрская программа CPA affiliate руководитель лидогенерация" (3 резюме, все релевантные).

### Журнал раундов
Вести таблицу: запрос → кол-во результатов → найдено кандидатов → ключевые компании из их резюме (для следующего раунда).

### Тиринг кандидатов
После каждого раунда — присваивать рейтинг (S/A/B/C или 10-7). Критерии:
- S (10/10): прямой опыт в целевых компаниях, управленческий уровень, знает обе стороны (сеть + рекламодатель)
- A (8-9/10): сильный профильный опыт, но чего-то не хватает (только одна сторона, нет управления)
- B (7/10): релевантная вертикаль, но не точное попадание
- C (<7): слабая релевантность

## Техника: что работает на hh.ru

### Form-based поиск (основной метод)
```
page.goto('/search/resume') → fill input → Enter
```
Или добавить параметр в URL: `hhtmFrom=resume_search_result&hhtmFromLabel=resume_search_line`

### Короткие точные запросы (2-3 слова)
- "affiliate manager финансы" — 609 результатов, релевантные
- "CPA сеть МФО PDL" — 12 результатов, точные
- "Банки.ру affiliate партнёрская программа" — 3 результата, идеальные
- Названия конкретных компаний (Click2Money, LeadGid, Fincpanetwork) — самые точные

### Ввод через Playwright
- Click на поле поиска
- Meta+a (выделить всё)
- Type новый запрос с submit=true

### Блок "Похожие резюме" — ЗОЛОТАЯ ЖИЛА
Внизу каждого резюме — ML-матчинг по навыкам и опыту. Находит то, что текстовый поиск пропускает. Через него найдены золотые кандидаты.

## Что НЕ работает
- Длинные запросы из 5+ слов — hh.ru матчит каждое слово отдельно, выдаёт миллионы мусора
- OR, кавычки, точные фразы — hh.ru их игнорирует
- URL-based поиск с фильтрами (experience=between3And6) — hh.ru возвращает fallback/рекомендуемые резюме
- hh.ru подменяет названия: "Saleads" → "Sales", "LeadGid" → "leaded"

## Ограничения
- Сотрудники маленьких компаний (15 чел.) практически не публикуют резюме
- Google НЕ индексирует отдельные резюме hh.ru
- Контакты скрыты без купленного доступа к базе (5 989₽)

## Артефакты
Для каждого кандидата создавать файл `candidate_RX_N_компания.md` с:
- URL резюме, пол/возраст, город, статус (ищет/рассматривает/не ищет)
- Полная карьера с датами и достижениями
- Анализ релевантности, оценка, контакты
- Ключевые компании из опыта (для следующих раундов поиска!)

Итоговый шортлист — HTML-отчёт с тирами (S/A/B/C) для передачи HR/заказчику.

## HTML-шортлист: шаблон оформления

**Референс:** https://engwatch.github.io/hh-search-shortlist/

### Дизайн-принципы
- **Светлая тема** — `background:#f5f6fa`, карточки на белом `#fff`
- Шрифт: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Скруглённые карточки (`border-radius:16px`), мягкие тени (`box-shadow:0 2px 16px rgba(0,0,0,.06)`)
- Цветная полоска слева у карточки по тиру (S=красный, A=зелёный, B=серый)

### Структура HTML

```html
<!-- 1. ШАПКА — тёмный градиент со статистикой -->
<div class="header" style="background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);color:#fff;padding:48px 24px;text-align:center">
  <h1>Хантинг: [название вакансии]</h1>
  <div class="sub">[подзаголовок — что ищем]</div>
  <div class="stats"> <!-- плитки: кандидатов / Tier S+A / запросов / раундов --> </div>
</div>

<!-- 2. МЕТОДОЛОГИЯ — как искали (сетка из 4-6 пунктов) -->
<div class="mbox" style="background:#fff;border-radius:16px;padding:28px">
  <h2>Методология</h2>
  <div class="mgrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
    <div class="mitem" style="background:#f8f9ff;border-radius:12px;padding:16px;border-left:4px solid #0984e3">
      <h3>1. [Критерий]</h3><p>[Объяснение]</p>
    </div>
  </div>
</div>

<!-- 3. КЛЮЧЕВОЙ ФИЛЬТР — жёлтый блок -->
<div style="background:linear-gradient(135deg,#fff9db,#fff3cd);border-radius:14px;padding:20px 24px;border-left:5px solid #f39c12">
  <h3>Ключевой фильтр</h3>
  <p>[Главный вопрос для оценки кандидата]</p>
</div>

<!-- 4. ТИРЫ — секции S, A, B -->
<div class="tier">
  <div class="th"><h2>Tier S — [описание]</h2><span class="tb" style="background:linear-gradient(135deg,#e17055,#d63031);color:#fff;padding:4px 14px;border-radius:20px">Подпись</span></div>

  <!-- КАРТОЧКА КАНДИДАТА -->
  <div class="card" style="background:#fff;border-radius:16px;padding:28px;position:relative;border-left:6px solid #d63031">
    <!-- Рейтинг — кружок в правом верхнем углу -->
    <div style="position:absolute;top:24px;right:24px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#d63031,#e17055);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.15rem">10</div>

    <!-- Заголовок + мета -->
    <div class="ct" style="font-size:1.2rem;font-weight:800">[Должность] — [Компании] <span class="new-badge">РАУНД N</span></div>
    <div class="cm" style="color:#636e72;font-size:.85rem">[Пол, возраст] [Город] [Зарплата] <span class="sp" style="background:#00b894;color:#fff;padding:3px 12px;border-radius:14px">Активно ищет!</span></div>

    <!-- Карьера — хронология с цветными точками -->
    <div class="cr">
      <div class="crr" style="display:flex;gap:10px;margin-bottom:7px">
        <div style="width:10px;height:10px;border-radius:50%;background:#6c5ce7;margin-top:7px"></div>
        <div><strong>[Компания]</strong> — [Должность] <span class="cl" style="background:#6c5ce7;color:#fff;padding:1px 7px;border-radius:6px;font-size:.68rem">CPA-СЕТЬ</span> <span style="color:#b2bec3">(срок)</span><br>[Достижения с цифрами]</div>
      </div>
    </div>

    <!-- Зелёный блок — почему подходит -->
    <div style="background:#e8f8f0;border:1px solid #b2f2d9;border-radius:12px;padding:18px 20px">
      <h4 style="color:#059669">Почему подходит</h4>
      <ul><li><span style="color:#059669;font-weight:600">[Факт]</span> — [объяснение]</li></ul>
    </div>

    <!-- Жёлтый блок — вопросы/риски -->
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:18px 20px">
      <h4 style="color:#d97706">Вопросы для интервью</h4>
      <ul><li><span style="color:#d97706;font-weight:600">[Вопрос]</span> — [зачем]</li></ul>
    </div>

    <!-- Вердикт -->
    <div style="background:#f0f3ff;border-radius:10px;padding:14px 18px"><strong>Вердикт:</strong> [итоговая оценка]</div>

    <!-- Теги -->
    <div class="tags" style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">
      <span style="padding:3px 10px;border-radius:8px;background:#e8f8f0;color:#059669;font-size:.76rem;font-weight:600">[тег]</span>
    </div>

    <!-- Кнопки -->
    <div style="display:flex;gap:8px;margin-top:16px">
      <a href="[url]" class="btn" style="background:#d63031;color:#fff;padding:9px 18px;border-radius:10px;text-decoration:none;font-weight:700">Резюме на hh.ru</a>
    </div>
  </div>
</div>
```

### Цветовая палитра

| Элемент | Цвет | Код |
|---|---|---|
| Фон страницы | светло-серый | `#f5f6fa` |
| Карточки | белый | `#fff` |
| Шапка | тёмный градиент | `#1a1a2e → #16213e → #0f3460` |
| Tier S полоска | красный | `#d63031 → #e17055` |
| Tier A полоска | зелёный | `#00b894 → #00cec9` |
| Tier B полоска | серый | `#b2bec3` |
| "Почему подходит" | зелёный блок | `bg:#e8f8f0, border:#b2f2d9, text:#059669` |
| "Вопросы/риски" | жёлтый блок | `bg:#fefce8, border:#fde68a, text:#d97706` |
| "Красные флаги" | красный блок | `bg:#fef2f2, border:#fca5a5, text:#dc2626` |
| Рейтинг 10 | красный круг | `#d63031` |
| Рейтинг 8-9 | зелёный круг | `#00b894` |
| Рейтинг 7 | голубой круг | `#74b9ff` |
| CPA-СЕТЬ лейбл | фиолетовый | `#6c5ce7` |
| МФО лейбл | жёлтый | `bg:#fdcb6e, text:#2d3436` |
| "Активно ищет" | зелёный бейдж | `#00b894` |
| "Рассматривает" | жёлтый бейдж | `#fdcb6e` |
| "Не ищет" | серый бейдж | `#dfe6e9` |
| Точка карьеры: CPA-сеть | фиолетовый | `#6c5ce7` |
| Точка карьеры: МФО | оранжевый | `#e17055` |
| Точка карьеры: другое | зелёный/серый | `#00b894` / `#b2bec3` |

### Обязательные элементы карточки
1. **Рейтинг** — кружок в правом верхнем углу (10/9/8/7)
2. **Бейдж раунда** — в каком раунде найден (РАУНД 3, РАУНД 4...)
3. **Статус поиска** — цветной бейдж (ищет/рассматривает/не ищет)
4. **Хронология карьеры** — точки с цветовой кодировкой типа компании
5. **Зелёный блок** — конкретные причины почему подходит (с цифрами!)
6. **Жёлтый блок** — вопросы для интервью или нюансы
7. **Вердикт** — 1-2 предложения, ключевой вывод
8. **Теги** — 4-6 ключевых фактов в виде бейджей
9. **Кнопка hh.ru** — прямая ссылка на резюме
