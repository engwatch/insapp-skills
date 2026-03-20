# Навык: Playwright — блокировка JS-редиректов и anti-DDoS

## Когда применять
Когда сайт агрессивно перенаправляет через JS (CPA-сети, финтех, рекламные площадки) или блокирует headless-браузеры.

## Блокировка JS-редиректов
```javascript
await page.route('**/*', route => {
  const request = route.request();
  if (request.resourceType() === 'script' && !request.url().includes('targetDomain')) {
    route.abort();
  } else {
    route.continue();
  }
});
```
Заменить `targetDomain` на домен исследуемого сайта.

## Известные защиты
- **vbr.ru** — Qrator anti-DDoS, блокирует headless и WebFetch (401). Нужен реальный браузер или residential proxy.
- **partnerkin.com** — JS-rendered контент, WebFetch отдаёт только CSS. Использовать Playwright.
- **CPA-сайты (saleads.pro, click2.money)** — агрессивные JS-редиректы между доменами. Snapshot может показывать не ту страницу.

## Альтернативные источники (когда Playwright не помогает)
- **vc.ru** — отдаёт контент нормально через WebFetch
- **gdetraffic.com, zorbasmedia.ru, cpamafia.top** — лучшие русскоязычные обзоры CPA
- **saleads.pro/blog** — детальные кейсы с метриками, грузятся
- **pressaff.com** — финансовые CPA кейсы
- **TenChat, CpaLenta** — зеркалят статьи Saleads, грузятся нормально

## Финуслуги
SPA, но WebFetch справляется через серверный рендеринг на /mikrozajmy.
