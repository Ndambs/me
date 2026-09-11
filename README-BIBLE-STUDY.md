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

If you already installed a previous version of this update, you only need
to overwrite `css/bible-study.css` and `js/bible-study.js` — those are the
two files that changed for the new color palette and the saved-answers
history feature. `index.html`, `bible-study.html`, and `js/bible-data.js`
are unchanged from before.

Note on old saved notes: the previous version of this page (if you already
tried it) stored a single note per day under a different storage key. On
first load after this update, any note you'd already saved that way is
automatically carried over into the new saved-answers log, marked "saved
previously" instead of a timestamp — nothing is lost.

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
- **Color-coded sections** — each part of the day (setting the scene,
  the passage, the central truth, church history, living it out, the
  prayer) has its own accent color in both dark and light themes, so the
  page reads as distinct movements rather than one flat block. Day titles
  render with a warm gradient (ink → gold → blue) instead of a single flat
  color.
- **Sidebar navigator** — grouped by book, with a live search box and an
  Old Testament / New Testament / All toggle.
- **Progress tracking** — mark a day as read; it's saved in the browser
  (`localStorage`), so a returning reader sees "Continue" pick up right
  where they left off. Nothing is sent anywhere — it's local to the device.
- **Saved reflections with timestamps** — the "Living It Out" box has its
  own **Save this answer** button. Each save is appended (not overwritten)
  to a running log shown right below the box, newest first, each stamped
  with the date and time it was saved — so if someone works through the
  plan more than once, every pass's answer for that day is kept side by
  side. Each saved answer has its own Delete link. All of this lives only
  in the browser's local storage on that device.
- **Keyboard shortcuts** — `←` / `→` to move between days, `/` to jump to
  search, `M` to mark the current day read.
- **Deep links** — every day has its own URL hash (e.g.
  `bible-study.html#ot-42`), so you can link straight to a specific day.
- **Responsive** — a slide‑out drawer on mobile, a fixed two‑pane layout on
  desktop, and a print‑friendly stylesheet if someone wants a paper copy of
  a single day.
- **Theme toggle** on the reader page itself (dark ⇄ light), independent of
  the main site's toggle so it works even though this is a separate page.
  Both themes now use a richer, section-coded palette rather than a single
  blue accent everywhere.
- **"Read more" on A Voice from Church History** — clicking or tapping that
  section asks first, then opens a new tab: for Charles Spurgeon on a Psalm,
  David Guzik, or Matthew Henry, it's a direct link to their real, complete
  commentary on that exact passage (BibleHub.com hosts all three in full).
  For every other teacher quoted in the guide, the page is honest that this
  guide only paraphrases their insight and opens a web search for more of
  their writing on that passage instead — never a guessed or fabricated URL.

## Notes / things you may want to tweak

- The "Voice from Church History" names print in Title Case even where the
  PDF has them in caps — check a few at random to make sure that reads well
  for names with unusual capitalization.
- The homepage promo card's four sample days (OT Day 1, OT Day 11, NT Day 1,
  NT Day 48) are just illustrative — edit them in `index.html` if you'd like
  different highlights.
- Everything is vanilla HTML/CSS/JS — no build step, no dependencies.
