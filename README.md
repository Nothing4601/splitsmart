# SplitSmart

Share the bill, not the headache. Scan a receipt, give each item to the people who
actually shared it, and settle up with the fewest payments — all in the browser,
with nothing sent to a server.

**Live site:** https://nothing4601.github.io/splitsmart-premium/

## What it does

- **Expenses** — one dashboard across every gang: what you owe, what you're owed, your
  net position, who owes whom, and your spending by category, by gang and by month.
- **Gangs** — a group per room, trip or canteen run. Expenses, balances, insights,
  members and a full activity log.
- **Scan a bill** — photograph or upload a receipt. Tesseract.js reads it on your
  device, you check the items, then tap who had what. Item-by-item splitting, or any
  split you like (equal, exact amounts, percentages, shares).
- **Say it** — describe an expense out loud ("Dev paid 600 for pizza, split equally").
  Whisper runs in your browser and drafts the expense for you. On a scanned bill you
  can also *say who had what*.
- **Settle up** — the exact minimum number of payments, with UPI deep links and QR
  codes, and one tap to mark a payment done.
- **Sync with friends** — share a gang by link or file and two phones keep the same
  group in step, end-to-end encrypted through a public relay.
- **Characters** — a three.js character lobby stands in for avatars; pick one, browse
  all twelve, or mix and match your own.
- Installable as a PWA and works offline after the first visit.

A new install starts completely empty: no sample gangs, no sample expenses, everything
at zero.

## Run locally

```bash
python3 -m http.server
```

Then open http://localhost:8000.

```bash
node --test
```

runs the unit tests for the money and parsing logic.
