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

## Notes

- **Navigate first** — make sure the sheet is open (`browser_navigate` to the spreadsheet URL)
- **Column x coords** — for A: `x≈88`, B: `x≈178`, C: `x≈271`. Any x within selected columns works.
- **y=152 is fixed** — canvas always starts at y=142 in Google Sheets
- **Regex match** — use `/Изменить размер столбцов/` to match regardless of column letters in the label
- **Don't use `browser_click` with coordinates** — it maps to element center, not pixel coords. Always use `browser_run_code` with `page.mouse.click()`
