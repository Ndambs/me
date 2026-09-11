# Bible Study — install into ndambs/me

This zip contains **only the new/changed files**. It does **not** include your
existing `css/style.css` or `js/main.js` — those stay exactly as they are.
The new page borrows your site's fonts, colors, nav, and buttons by simply
loading your existing `css/style.css` alongside the new stylesheet below.

## Files in this zip

```
index.html              → REPLACES your current index.html
bible-study.html        → NEW — the standalone study reader (opens in a new tab)
css/bible-study.css     → NEW — styles for the reader + the homepage promo card
js/bible-data.js        → NEW — all 274 days of content, generated from your PDF
js/bible-study.js       → NEW — the reader app (search, progress, notes, nav)
```

## How to install

1. Download this zip and unzip it.
2. Copy `bible-study.html`, `css/bible-study.css`, `js/bible-data.js`, and
   `js/bible-study.js` into the matching folders in your `Ndambs/me` repo.
3. Replace your repo's `index.html` with the one in this zip — it's your
   original file with three small additions:
   - a **"Bible Study"** link in the desktop nav, mobile nav, and footer
     (opens in a new tab)
   - a new **"07 — Bible Study"** section on the homepage (a promo card with
     stats and an "Open the Study ↗" button)
   - the old **"07 — Contact"** section is renumbered to **"08 — Contact"**
     (nothing else about Contact changed)
4. Commit and push. GitHub Pages will pick it up automatically.

If you'd rather not replace `index.html` wholesale, the diff is small — just
search this zip's `index.html` for `bible-study` to find the three insertion
points and copy them into your own file by hand.

## What the reader does

- **All 274 days**, Genesis to Revelation, parsed straight from your PDF:
  setting the scene, the passage opened up chapter‑by‑chapter, the central
  truth, a voice from church history, living it out, and the closing prayer.
- **Sidebar navigator** — grouped by book, with a live search box and an
  Old Testament / New Testament / All toggle.
- **Progress tracking** — mark a day as read; it's saved in the browser
  (`localStorage`), so a returning reader sees "Continue" pick up right
  where they left off. Nothing is sent anywhere — it's local to the device.
- **Personal reflection notes** — the "Living It Out" question has a text
  box that autosaves per-day, also local to the device.
- **Keyboard shortcuts** — `←` / `→` to move between days, `/` to jump to
  search, `M` to mark the current day read.
- **Deep links** — every day has its own URL hash (e.g.
  `bible-study.html#ot-42`), so you can link straight to a specific day.
- **Responsive** — a slide‑out drawer on mobile, a fixed two‑pane layout on
  desktop, and a print‑friendly stylesheet if someone wants a paper copy of
  a single day.
- **Theme toggle** on the reader page itself (dark ⇄ light), independent of
  the main site's toggle so it works even though this is a separate page.

## Notes / things you may want to tweak

- The "Voice from Church History" names print in Title Case even where the
  PDF has them in caps — check a few at random to make sure that reads well
  for names with unusual capitalization.
- The homepage promo card's four sample days (OT Day 1, OT Day 11, NT Day 1,
  NT Day 48) are just illustrative — edit them in `index.html` if you'd like
  different highlights.
- Everything is vanilla HTML/CSS/JS — no build step, no dependencies.
