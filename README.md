# SplitSmart

Share the bill, not the headache. Scan a receipt, give each item to the people who
actually shared it, and settle up with the fewest payments — all in the browser.

**Live site:** https://nothing4601.github.io/splitsmart/

Everything runs on your device: the receipt is read there, speech is transcribed
there, and your gangs and expenses are stored there. The only thing that ever leaves
is a gang you choose to share, and that goes end-to-end encrypted.

## What it does

- **Tour** — a scroll-through of the whole app, and where a phone with no gangs on it
  starts.
- **Expenses** — one dashboard across every gang: what you owe, what you're owed, your
  net position, who owes whom, and your spending by category, by gang and by month.
- **Gangs** — a group per room, trip or canteen run. Expenses, balances, insights,
  members and a full activity log. Rename, delete, import, export.
- **Scan a bill** — photograph or upload a receipt, or several at once for a whole
  trip. Tesseract.js reads it on your device; anything it was unsure of is
  highlighted for you to check. Items, quantities, tax (CGST/SGST), service charge
  and discounts are pulled out, and it tells you if they don't add up to the printed
  total. The photo is kept with the expense.
- **Who had what** — tap people onto each line. Shared items split between their
  assignees, and tax and charges are spread in proportion to what each person ate,
  not equally. Or split the bill equally, by exact amounts, by percentage or by
  shares.
- **Say it** — describe an expense out loud ("Dev paid 600 for pizza, split equally").
  Whisper runs in your browser and drafts it for you. On a scanned bill you can also
  *say who had what* ("I had the vada, the rest between the others").
- **Settle up** — the exact minimum number of payments, with UPI deep links and QR
  codes, and one tap to mark a payment done.
- **Sync with friends** — share a gang by link or file and two phones keep the same
  group in step, end-to-end encrypted through a public relay. No account, no backend.
- **Categories** — each item is sorted into Food, Groceries, Travel, Utilities,
  Entertainment or Other by a zero-shot model that loads only when you first need it.
  Your own choice always wins.
- **Recurring expenses** — monthly things like a Wi-Fi recharge add themselves.
- **Export** — a settlement summary as PDF, the expenses as CSV, the group as JSON.
- **Characters** — a three.js character lobby stands in for avatars; pick one, browse
  all twelve, or mix and match your own.
- Installable as a PWA. Every byte it needs ships with the site, so once installed it
  opens and works with no network at all.

A new install starts completely empty: no sample gangs, no sample expenses, everything
at zero.

## Repository

No build step, no bundler, no backend. The app is one file.

```
index.html              the whole app — CSS, markup and script inline
vendor/                 three.js r147 + OrbitControls + RoomEnvironment
assets/brand/           the 3s intro film
icons/  manifest.webmanifest  sw.js    PWA shell
test/logic.test.mjs     unit tests for the money and parsing logic
```

Tesseract.js, Transformers.js and Whisper are fetched only the first time you scan,
review or speak, so they never hold up the first screen.

## Run locally

```bash
python3 -m http.server
```

Then open http://localhost:8000.

```bash
node --test
```

runs the unit tests for the money and parsing logic.
