---
name: auto-width
description: Use when columns in a Google Sheet need to be auto-fitted to content width via Playwright browser automation
---

# Auto-Width Google Sheets Columns

## Overview

Google Sheets MCP has no column resize tool. Use Playwright `browser_run_code` with direct `page.mouse` API to right-click the column header and trigger auto-fit.

**Key insight:** Google Sheets renders on a canvas starting at `y=142`. Column headers are at `y≈152` (10px into the canvas top).

## Steps

### 1. Select columns via Name Box

```js
await page.locator('#t-name-box').fill('A:C'); // or any range like 'A:A'
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
```

### 2. Right-click column header

```js
// Canvas starts at y=142. Headers are at y≈152.
// x coordinate = center of any selected column header
await page.mouse.click(178, 152, { button: 'right' });
await page.waitForTimeout(500);
```

### 3. Use snapshot to find menu item ref, then click

```js
// Find ref for "Изменить размер столбцов A–C" in snapshot, then:
await page.getByRole('menuitem', { name: 'Изменить размер столбцов A–C' }).click();
```

### 4. Select auto-fit and confirm

```js
await page.getByRole('radio', { name: 'Автоподбор размера' }).click();
await page.getByRole('button', { name: 'ОК' }).click();
```

## Full One-Shot Code Block

```js
async (page) => {
  // 1. Select columns
  await page.locator('#t-name-box').click();
  await page.locator('#t-name-box').fill('A:C');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // 2. Right-click column header (canvas y=142, headers at y≈152)
  await page.mouse.click(178, 152, { button: 'right' });
  await page.waitForTimeout(500);

  // 3. Click resize menu item
  await page.getByRole('menuitem', { name: /Изменить размер столбцов/ }).click();

  // 4. Auto-fit
  await page.getByRole('radio', { name: 'Автоподбор размера' }).click();
  await page.getByRole('button', { name: 'ОК' }).click();
}
```

Pass this to `mcp__plugin_playwright_playwright__browser_run_code`.

## Set Fixed Pixel Width (instead of auto-fit)

Use when a column has long text in a footnote/note cell that would distort auto-fit (e.g. column A with dates but a long note in A9).

```js
async (page) => {
  await page.locator('#t-name-box').click();
  await page.locator('#t-name-box').fill('A:A');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);

  await page.mouse.click(88, 152, { button: 'right' });
  await page.waitForTimeout(500);
  await page.getByRole('menuitem', { name: /Изменить размер столбц/ }).click();
  await page.waitForTimeout(400);

  // Use dialog's textbox — always works via getByRole('dialog').getByRole('textbox')
  const dialog = page.getByRole('dialog');
  const textbox = dialog.getByRole('textbox');
  await textbox.click({ clickCount: 3 });
  await textbox.fill('100'); // pixel width
  await dialog.getByRole('button', { name: 'ОК' }).click();
  await page.waitForTimeout(400);
}
```

## Text Wrap Modes (Format > Перенос)

Three modes — actual Russian menu names:
- **"Перекрывать соседние ячейки"** — Overflow: text flows into adjacent empty cells visually, no merge needed. Use for **title/header rows** (B1, B2) so the heading spans the sheet naturally.
- **"Переносить по словам"** — Wrap: text wraps within the cell. Use for **data/content cells** with long text.
- **"Обрезать текст"** — Clip: text is hidden beyond cell boundary.

### NEVER use merged cells for titles

Merged cells cause auto-fit to size columns based on the merged content width, stretching columns. Instead:
1. Put title text in B1 (leave A1 empty)
2. Set B1 wrap mode to **"Перекрывать соседние ячейки"** — text overflows into C1, D1 etc.
3. Run auto-fit — column B sizes to data, not title

Apply via Playwright:
```js
await page.locator('#t-name-box').click();
await page.locator('#t-name-box').fill('B1:B2');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.getByRole('menuitem', { name: 'Формат' }).click();
await page.waitForTimeout(400);
await page.getByRole('menuitem', { name: /Перенос/ }).click();
await page.waitForTimeout(400);
await page.getByRole('menuitem', { name: 'Перекрывать соседние ячейки' }).click();
```

## Notes

- **Navigate first** — make sure the sheet is open (`browser_navigate` to the spreadsheet URL)
- **Column x coords** — for A: `x≈88`, B: `x≈178`, C: `x≈271`. Any x within selected columns works.
- **y=152 is fixed** — canvas always starts at y=142 in Google Sheets
- **Regex match** — use `/Изменить размер столбцов/` to match regardless of column letters in the label
- **Don't use `browser_click` with coordinates** — it maps to element center, not pixel coords. Always use `browser_run_code` with `page.mouse.click()`
- **Auto-fit pitfall** — if a column contains a long title/note cell, auto-fit will make it huge. Use fixed pixel width OR set Overflow wrap mode on the title rows first.
- **Dialog textbox** — find via `page.getByRole('dialog').getByRole('textbox')`. Don't use `Control+a` — it selects sheet cells. Use `.click({ clickCount: 3 })` then `.fill()`.
- **Формулы в русской локали** — десятичный разделитель `,` (не `.`): `=E2*0,2`. Разделитель аргументов `;` (не `,`): `=ЕСЛИОШИБКА(D2/B2;0)`.
- **Alignment** — numbers auto-align right, mixing with emoji/text left-aligns. To normalize: use `gsheets_format_cells` with `horizontalAlignment: "LEFT"` on the entire column.
