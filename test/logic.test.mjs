// Unit tests for the split / settle / parse logic. Run: node --test
// The logic lives in index.html (<script id="split-logic">) so the app stays one file;
// this pulls that block out and runs it in a sandbox.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script id="split-logic">([\s\S]*?)<\/script>/)[1];
const ctx = { Intl, URLSearchParams };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const L = ctx.SplitLogic;
const sum = a => a.reduce((x, y) => x + y, 0);
// vm objects come from another realm; compare as plain JSON
const plain = x => JSON.parse(JSON.stringify(x));

test('₹100 split three ways is 33.34 + 33.33 + 33.33 (robustness case 6)', () => {
  assert.deepEqual(plain(L.allocate(10000, [1, 1, 1])), [3334, 3333, 3333]);
});

test('allocate always adds up exactly and gives leftovers to the largest remainders, ties to earlier members', () => {
  assert.deepEqual(plain(L.allocate(100, [1, 1, 1, 1, 1, 1, 1])), [15, 15, 14, 14, 14, 14, 14]);
  assert.deepEqual(plain(L.allocate(1000, [1, 2])), [333, 667]);
  assert.deepEqual(plain(L.allocate(-1001, [1, 1])), [-501, -500]);
  assert.deepEqual(plain(L.allocate(500, [0, 0])), [250, 250]);
  for (let i = 0; i < 500; i++) {
    const total = Math.floor(Math.random() * 1e7) - 2e6;
    const w = Array.from({ length: 1 + Math.floor(Math.random() * 9) }, () => Math.floor(Math.random() * 1e5));
    const parts = L.allocate(total, w);
    assert.equal(sum(parts), total);
    parts.forEach(p => assert.ok(Number.isInteger(p)));
  }
});

test('tax is shared in proportion to item subtotals (₹1,000 bill, ₹100 tax, ₹600 of items pays ₹60)', () => {
  const r = L.itemizedShares(
    [{ name: 'A stuff', total: 60000, assignees: ['a'] }, { name: 'B stuff', total: 40000, assignees: ['b'] }],
    [{ kind: 'tax', label: 'GST', amount: 10000 }], ['a', 'b']);
  assert.deepEqual(plain(r.shares), { a: 66000, b: 44000 });
});

test('the Night Canteen scenario reconciles to ₹840 exactly', () => {
  // pizza for all four, one Maggi each for three people, two cold coffees for Meera, 5% GST
  const ids = ['riya', 'arjun', 'meera', 'kabir'];
  const items = [
    { name: 'Large Pizza', total: 40000, assignees: ids },
    { name: 'Masala Maggi', total: 7000, assignees: ['arjun'] },
    { name: 'Cheese Maggi', total: 9000, assignees: ['kabir'] },
    { name: 'Egg Maggi', total: 8000, assignees: ['riya'] },
    { name: 'Cold Coffee', total: 16000, assignees: ['meera'] },
  ];
  const charges = [{ kind: 'tax', label: 'CGST', amount: 2000 }, { kind: 'tax', label: 'SGST', amount: 2000 }];
  const r = L.itemizedShares(items, charges, ids);
  assert.equal(r.total, 84000);
  assert.equal(sum(Object.values(r.shares)), 84000);
  assert.deepEqual(plain(r.subtotals), { riya: 18000, arjun: 17000, meera: 26000, kabir: 19000 });
  assert.deepEqual(plain(r.shares), { riya: 18900, arjun: 17850, meera: 27300, kabir: 19950 });
});

test('discounts and odd paise still reconcile', () => {
  const r = L.itemizedShares(
    [{ name: 'x', total: 3333, assignees: ['a', 'b', 'c'] }, { name: 'y', total: 101, assignees: ['b'] }],
    [{ kind: 'discount', amount: -500 }, { kind: 'service', amount: 172 }, { kind: 'roundoff', amount: -6 }], ['a', 'b', 'c']);
  assert.equal(sum(Object.values(r.shares)), 3333 + 101 - 500 + 172 - 6);
});

test('an unassigned item is an error', () => {
  const r = L.itemizedShares([{ name: 'Mystery', total: 100, assignees: [] }], [], ['a']);
  assert.match(r.error, /Mystery/);
});

test('manual split modes', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(plain(L.manualShares(10000, 'equal', ids).shares), { a: 3334, b: 3333, c: 3333 });
  assert.deepEqual(plain(L.manualShares(10000, 'exact', ids, { a: 5000, b: 2500, c: 2500 }).shares), { a: 5000, b: 2500, c: 2500 });
  assert.match(L.manualShares(10000, 'exact', ids, { a: 5000, b: 2500, c: 2000 }).error, /short by ₹5\.00/);
  assert.deepEqual(plain(L.manualShares(10000, 'percent', ids, { a: 50, b: 25, c: 25 }).shares), { a: 5000, b: 2500, c: 2500 });
  assert.match(L.manualShares(10000, 'percent', ids, { a: 50, b: 25, c: 20 }).error, /95%/);
  assert.deepEqual(plain(L.manualShares(10000, 'shares', ids, { a: 2, b: 1, c: 1 }).shares), { a: 5000, b: 2500, c: 2500 });
  assert.deepEqual(plain(L.manualShares(10000, 'percent', ids, { a: 33.33, b: 33.33, c: 33.34 }).shares), { a: 3333, b: 3333, c: 3334 });
  assert.match(L.manualShares(0, 'equal', ids).error, /above zero/);
  assert.match(L.manualShares(100, 'equal', []).error, /at least one/);
});

test('balances include payments made', () => {
  const b = L.balances(['a', 'b'], [{ payer: 'a', total: 1000, shares: { a: 500, b: 500 } }], [{ from: 'b', to: 'a', amount: 200 }]);
  assert.deepEqual(plain(b), { a: 300, b: -300 });
});

test('A owes B ₹200 and B owes C ₹200: A pays C directly', () => {
  const t = L.settle({ A: -20000, B: 0, C: 20000 });
  assert.deepEqual(plain(t), [{ from: 'A', to: 'C', amount: 20000 }]);
});

// Independent check: the true minimum by trying every way of splitting people into
// zero-sum groups (min payments = people - number of groups)
function bruteMin(vals) {
  const v = vals.filter(x => x);
  let best = 0;
  const rec = (rest, groups) => {
    if (!rest.length) { best = Math.max(best, groups); return; }
    const [first, ...others] = rest;
    const n = others.length;
    for (let m = 0; m < 1 << n; m++) {
      const pick = others.filter((_, i) => m & (1 << i));
      if (first + sum(pick) === 0) rec(others.filter((_, i) => !(m & (1 << i))), groups + 1);
    }
  };
  rec(v, 0);
  return v.length - best;
}
function check(bal) {
  const t = L.settle(bal);
  const left = { ...bal };
  for (const x of t) { assert.ok(x.amount > 0); left[x.from] += x.amount; left[x.to] -= x.amount; }
  assert.ok(Object.values(left).every(v => v === 0), 'every balance is cleared');
  assert.equal(t.length, bruteMin(Object.values(bal)), 'uses the fewest payments');
}

test('five members, ten expenses with mixed payers: minimum payments (robustness case 9)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const exps = [
    [0, 120000, 'equal'], [1, 45000, 'equal'], [2, 30000, [1, 1, 0, 0, 1]], [3, 99900, 'equal'], [4, 25000, [0, 2, 1, 1, 0]],
    [0, 8000, [1, 1, 0, 0, 0]], [1, 64000, 'equal'], [2, 1500, [0, 0, 1, 1, 1]], [3, 32000, [1, 0, 1, 0, 1]], [4, 77700, 'equal'],
  ].map(([p, total, w]) => {
    const parts = w === 'equal' ? ids : ids.filter((_, i) => w[i]);
    const vals = w === 'equal' ? {} : Object.fromEntries(parts.map(id => [id, w[ids.indexOf(id)]]));
    return { payer: ids[p], total, shares: L.manualShares(total, w === 'equal' ? 'equal' : 'shares', parts, vals).shares };
  });
  check(L.balances(ids, exps));
});

test('settle finds zero-sum subgroups the greedy method misses', () => {
  // greedy would use 4 payments; pairing (a,d) and (b,c,e) needs only 3
  check({ a: -500, b: -300, c: 100, d: 500, e: 200 });
  check({ a: 1000, b: -1000, c: 700, d: -400, e: -300 });
});

test('settle is minimal on random groups', () => {
  for (let k = 0; k < 300; k++) {
    const n = 2 + Math.floor(Math.random() * 7);
    const v = Array.from({ length: n - 1 }, () => (Math.floor(Math.random() * 9) - 4) * 1000);
    v.push(-sum(v));
    check(Object.fromEntries(v.map((x, i) => ['m' + i, x])));
  }
});

const BILL = `NIGHT OWL CANTEEN
Hostel 7, IIT Campus Road
Ph: +91 98765 43210
GSTIN: 27AABCN1234F1Z5
TAX INVOICE
Bill No: 1042      Date: 18/10/2026
Item              Qty     Rate    Amount
Large Farmhouse Pi   1    400.00    400.00
Masala Maggi         1     70.00     70.00
Cold Coffee          2     80.00    160.00
Sub Total                          630.00
CGST @2.5%                          15.75
SGST @2.5%                          15.75
Grand Total                        661.50
Paid by UPI                        661.50
Thank you! Visit again`;

test('parses a GST bill into items, taxes and total, ignoring the noise', () => {
  const r = plain(L.parseReceipt(BILL));
  assert.deepEqual(r.items.map(i => [i.name, i.qty, i.unit, i.total]), [
    ['Large Farmhouse Pi', 1, 40000, 40000], ['Masala Maggi', 1, 7000, 7000], ['Cold Coffee', 2, 8000, 16000]]);
  assert.deepEqual(r.charges.map(c => [c.kind, c.label, c.amount]), [['tax', 'CGST', 1575], ['tax', 'SGST', 1575]]);
  assert.equal(r.subtotal, 63000);
  assert.equal(r.total, 66150);
  assert.equal(r.merchant, 'NIGHT OWL CANTEEN');
  assert.equal(r.date, '2026-10-18');
  assert.equal(L.checkTotals(r.items, r.charges, r.total).diff, 0);
});

test('service charge, discount and round-off', () => {
  const r = plain(L.parseReceipt('Paneer Tikka 1 280.00 280.00\nVeg Biryani 2 220.00 440.00\nDiscount (Student) -100.00\nService Charge 5% 31.00\nRound Off -0.40\nNet Payable 650.60'));
  assert.deepEqual(r.charges.map(c => [c.kind, c.amount]), [['discount', -10000], ['service', 3100], ['roundoff', -40]]);
  assert.equal(r.total, 65060);
});

test('a receipt with no total, and text with no items', () => {
  const r = L.parseReceipt('FRESH MART\nAmul Milk 1L  2  66.00  132.00\nBrown Bread  1  50.00  50.00\nItems: 2');
  assert.equal(r.total, null);
  assert.equal(L.checkTotals(r.items, r.charges, null).computed, 18200);
  assert.equal(L.parseReceipt('a blurry selfie\n\n~~ ~').items.length, 0);
});

test('OCR slips: split amounts and O/0 confusion', () => {
  const r = L.parseReceipt('Tea 2 15.00 3O.00\nSub Total 30. 00');
  assert.equal(r.items[0].total, 3000);
  assert.equal(r.subtotal, 3000);
});

test('low-confidence words are flagged on the field they came from', () => {
  const lines = [{ text: 'Cold Coffee 160.00', words: [{ text: 'Cold', confidence: 95 }, { text: 'Coffee', confidence: 91 }, { text: '160.00', confidence: 41 }] }];
  const it = L.parseReceipt(lines).items[0];
  assert.equal(it.low.price, true);
  assert.equal(it.low.name, false);
});

test('UPI deep link', () => {
  assert.equal(L.upiLink({ vpa: 'riya@okaxis', name: 'Riya S', amount: 21050, note: 'SplitSmart: Room 214' }),
    'upi://pay?pa=riya%40okaxis&pn=Riya%20S&am=210.50&cu=INR&tn=SplitSmart%3A%20Room%20214');
});

test('real bill: whole-rupee prices, Food Total, printed total rounded (the Ramashraya receipt)', () => {
  const r = plain(L.parseReceipt(`RAMASHRAYA
Pure Veg
Bhandarkar Rd.Matunga,Mumbai 19
Ph:24102623,24102369
----------- TAX INVOICE ----------
Date : 19/09/26   Bill No. : 285
T.No.: 16         W. No.   : 8
Particulars          Qty Rate Amount
GHEE PUDI DOSA       3  109    327
IDLI                 4   62    248
PUDI IDLI            1   60     60
VADA                 1   64     64
SWEET LASSI          1   40     40
GHEE MYSORE MASALA   1  129    129
MASALA DOSA          1 90.5  90.50
         Sub Total :      958.50
         SGST @2.5% :      23.96
         CGST @2.5% :      23.96
         Food Total :    1006.42
7/12/6       Total :      1006
GSTIN : 27AASFR2497J1ZD  (08:32 AM)`));
  assert.deepEqual(r.items.map(i => [i.name, i.qty, i.total]), [['GHEE PUDI DOSA', 3, 32700], ['IDLI', 4, 24800], ['PUDI IDLI', 1, 6000],
    ['VADA', 1, 6400], ['SWEET LASSI', 1, 4000], ['GHEE MYSORE MASALA', 1, 12900], ['MASALA DOSA', 1, 9050]]);
  assert.deepEqual(r.charges.map(c => [c.kind, c.amount]), [['tax', 2396], ['tax', 2396], ['roundoff', -42]]);
  assert.equal(r.subtotal, 95850);
  assert.equal(r.total, 100600);
  assert.equal(r.date, '2026-09-19');
  assert.equal(L.checkTotals(r.items, r.charges, r.total).diff, 0);
});

test('photo OCR noise: paper-edge bars, stray letters, misread GST and Total', () => {
  const r = plain(L.parseReceipt(`ee   > Particulars   Qty Rate Amount a
| GHEE PUDI DOSA   3 109 327 |
| VADA           1 64 64 |
| SWEET LASSI    1 40 40 |)
3   Sub Total :     958.50 |
j   OGST @2.5% :      23.96 |
'a  CGST @2.5% :      23. %     a
q   Food Zatal: 1006.42 |
| 7/12/6    Total :    LOOb |`));
  assert.deepEqual(r.items.map(i => [i.name, i.total]), [['GHEE PUDI DOSA', 32700], ['VADA', 6400], ['SWEET LASSI', 4000]]);
  assert.deepEqual(r.charges.filter(c => c.kind === 'tax').map(c => [c.label, c.amount]), [['OGST', 2396], ['CGST', 2396]]);
  assert.equal(r.total, 100600);
});

test('handwritten-style bills: 80/-, Rs 40, dashes, 2 x 15 = 30, Total = 210', () => {
  const r = plain(L.parseReceipt('Canteen - 21/10\nChai  2 x 15 = 30\nSamosa   40\nMaggi - 60\nCold coffee  80/-\nCoke Rs 40\nTotal = 250'));
  assert.deepEqual(r.items.map(i => [i.name, i.qty, i.total]), [['Chai', 2, 3000], ['Samosa', 1, 4000], ['Maggi', 1, 6000], ['Cold coffee', 1, 8000], ['Coke', 1, 4000]]);
  assert.equal(r.total, 25000);
  const t = plain(L.parseReceipt('Chai 2 x IS = 30'));
  assert.deepEqual([t.items[0].qty, t.items[0].unit, t.items[0].low.price], [2, 1500, true]);
});

test('keyword categories', () => {
  const g = n => L.guessCategory(n);
  assert.deepEqual(['Egg Maggi', 'Eggs (12)', 'Basmati Rice 5kg', 'Cold Coffee', 'Uber to station', 'Airtel recharge', 'PVR movie ticket', 'Stapler'].map(g),
    ['Food', 'Groceries', 'Groceries', 'Food', 'Travel', 'Utilities', 'Entertainment', 'Other']);
});

test('money parsing', () => {
  assert.equal(L.toPaise('1,234.5'), 123450);
  assert.equal(L.toPaise('₹ 40'), 4000);
  assert.ok(Number.isNaN(L.toPaise('abc')));
  assert.equal(L.rupees(123456), '₹1,234.56');
});

// ---------- Sync between phones (mergeGroups) ----------
const base = () => ({
  id: 'g1', name: 'Flat', created: 1, nameUpdated: 1, deleted: {},
  members: [{ id: 'm0', name: 'Asha', updated: 1, me: true }, { id: 'm1', name: 'Ravi', updated: 1 }],
  expenses: [{ id: 'e1', desc: 'Rent', total: 1000, created: 10, updated: 10 }],
  settlements: [], recurring: [], activity: [{ ts: 10, text: 'Added Rent' }],
});
const content = g => { const { members, ...rest } = plain(g); return { ...rest, members: members.map(({ me, ...m }) => m) }; };

test('merging phone copies gives the same group whichever phone merges, and merging twice changes nothing', () => {
  const a = base(), b = base();
  a.expenses.push({ id: 'e2', desc: 'Milk', total: 60, created: 20, updated: 20 });
  b.expenses.push({ id: 'e3', desc: 'Gas', total: 900, created: 15, updated: 15 });
  b.members = b.members.map(m => ({ ...m, me: m.id === 'm1' }));
  const ab = L.mergeGroups(a, b), ba = L.mergeGroups(b, a);
  assert.deepEqual(content(ab), content(ba));
  assert.deepEqual(plain(ab.expenses).map(e => e.id), ['e1', 'e3', 'e2']);
  assert.deepEqual(plain(L.mergeGroups(ab, b)), plain(ab));
  // each phone keeps knowing who it is
  assert.equal(ab.members.find(m => m.me).id, 'm0');
  assert.equal(ba.members.find(m => m.me).id, 'm1');
  assert.equal(ab.members.filter(m => m.me).length, 1);
});

test('the newer edit wins, a delete beats older copies, and an edit after a delete brings it back', () => {
  const a = base(), b = base();
  b.expenses[0] = { ...b.expenses[0], total: 1200, updated: 30 };
  assert.equal(L.mergeGroups(a, b).expenses[0].total, 1200);
  assert.equal(L.mergeGroups(b, a).expenses[0].total, 1200);

  const del = base(); del.expenses = []; del.deleted = { e1: 40 };
  assert.equal(L.mergeGroups(base(), del).expenses.length, 0);
  assert.equal(L.mergeGroups(del, base()).expenses.length, 0);
  assert.equal(L.mergeGroups(del, b).expenses.length, 0, 'edit at 30 is older than delete at 40');

  const late = base(); late.expenses[0] = { ...late.expenses[0], total: 1500, updated: 50 };
  const back = L.mergeGroups(del, late);
  assert.equal(back.expenses.length, 1);
  assert.equal(back.expenses[0].total, 1500);
  assert.equal(back.deleted.e1, 40);
});

test('a month of a recurring expense added on two phones appears once, and the newer group name wins', () => {
  const a = base(), b = base();
  const auto = { id: 'r1-2026-10', desc: 'Wi-Fi', total: 799, created: 100, updated: 1, recurringId: 'r1' };
  a.expenses.push({ ...auto }); b.expenses.push({ ...auto, created: 101 });
  b.name = 'Flat 4B'; b.nameUpdated = 5;
  const m = L.mergeGroups(a, b);
  assert.equal(m.expenses.filter(e => e.recurringId === 'r1').length, 1);
  assert.equal(m.name, 'Flat 4B');
  assert.equal(L.mergeGroups(b, a).name, 'Flat 4B');
  assert.equal(m.activity.length, 1, 'the same log line is not repeated');
});

test('both phones settle on the same live-sync key whichever merges first', () => {
  const a = { ...base(), syncKey: 'k-bbbbbbbbbbbbbbbbbbbb' }, b = { ...base(), syncKey: 'k-aaaaaaaaaaaaaaaaaaaa' };
  assert.equal(L.mergeGroups(a, b).syncKey, 'k-aaaaaaaaaaaaaaaaaaaa');
  assert.equal(L.mergeGroups(b, a).syncKey, 'k-aaaaaaaaaaaaaaaaaaaa');
  assert.equal(L.mergeGroups(base(), a).syncKey, 'k-bbbbbbbbbbbbbbbbbbbb', 'an old copy without a key picks it up');
  assert.equal('syncKey' in L.mergeGroups(base(), base()), false);
});

// ---------- Spoken expenses ----------
const GANG = [{ id: 'r', name: 'Riya', me: true }, { id: 'a', name: 'Arjun' }, { id: 'm', name: 'Meera' }, { id: 'k', name: 'Kabir' }, { id: 'h', name: 'Heet' }];
const say = text => plain(L.parseSpoken(text, GANG, 'r'));
const ALL = ['r', 'a', 'm', 'k', 'h'];

test('spoken: payer, amount, what for, split equally', () => {
  assert.deepEqual(say('Riya paid 600 for pizza, split equally.')[0], { kind: 'expense', payer: 'r', total: 60000, desc: 'Pizza', mode: 'equal', participants: ALL, values: {}, notes: [], payerName: 'Riya' });
  const d = say('Two thousand four hundred rupees for dinner paid by Meera')[0];
  assert.deepEqual([d.payer, d.total, d.desc], ['m', 240000, 'Dinner']);
  assert.deepEqual(say('Dinner 2400 by Meera, everyone except Kabir.')[0].participants, ['r', 'a', 'm', 'h']);
  assert.equal(say('Kabeer paid five hundred and fifty for the movie')[0].total, 55000);
  assert.equal(say('I paid Rs. 1,200/- for the cab')[0].total, 120000);
  assert.equal(say('Meera paid 1.5k for drinks')[0].total, 150000);
});

test('spoken: who is in (between, split with, for, except)', () => {
  assert.deepEqual(say('Arjun paid 1200 for groceries, split between me, Arjun and Heet.')[0].participants, ['r', 'a', 'h']);
  assert.deepEqual(say('₹1,200 for movie tickets, Kabir paid, split with Heet.')[0].participants, ['k', 'h']);
  const g = say('I spent 450 on groceries for me and Meera.')[0];
  assert.deepEqual([g.desc, g.participants], ['Groceries', ['r', 'm']]);
});

test('spoken: percentages, exact amounts with "rest equally", shares and ratios', () => {
  const p = say('I paid 900 for the cab, Arjun 50 percent, Meera 30, me 20.')[0];
  assert.deepEqual([p.mode, p.values, p.participants], ['percent', { a: 50, m: 30, r: 20 }, ['r', 'a', 'm']]);
  const e = say('Heet paid 500, his share 200, rest equally.')[0];
  assert.deepEqual([e.mode, e.values], ['exact', { h: 20000, r: 7500, a: 7500, m: 7500, k: 7500 }]);
  const each = say('Kabir paid 1000 for snacks, Arjun and Meera 300 each, rest equally.')[0];
  assert.deepEqual(each.values, { a: 30000, m: 30000, r: 13334, k: 13333, h: 13333 });
  assert.equal(Object.values(each.values).reduce((x, y) => x + y, 0), 100000);
  const pr = say('I paid 1000 for the trip, Arjun 40%, rest split equally.')[0];
  assert.deepEqual([pr.mode, pr.values.a, pr.values.k], ['exact', 40000, 15000]);
  assert.deepEqual(say('Meera paid 1500 for drinks, Arjun 2 shares, Meera 1 share, Kabir 1 share.')[0].values, { a: 2, m: 1, k: 1 });
  const r = say('Kabir paid 550 for the movie, split 2:1:1 between Kabir, Heet and me.')[0];
  assert.deepEqual([r.mode, r.values], ['shares', { k: 2, h: 1, r: 1 }]);
  // every draft's split is valid for the form
  for (const d of [p, e, each, pr, r]) assert.ok(!L.manualShares(d.total, d.mode, d.participants, d.values).error);
});

test('spoken: two bills in one sentence, payments between people, misheard and unknown names', () => {
  const two = say('Riya paid 300 for chai and Arjun paid 150 for the auto.');
  assert.deepEqual(two.map(d => [d.payer, d.total, d.desc]), [['r', 30000, 'Chai'], ['a', 15000, 'Auto']]);
  assert.deepEqual(say('I paid Arjun 300.')[0], { kind: 'payment', from: 'r', to: 'a', amount: 30000, notes: [] });
  assert.deepEqual(say('Arjun paid me back 250')[0], { kind: 'payment', from: 'a', to: 'r', amount: 25000, notes: [] });
  assert.equal(say('Hit paid 400 for the cake.')[0].payer, 'h');
  const misheard = say('Arjan paid Rs. 350 for chai and samosa, split with Mira.')[0];
  assert.deepEqual([misheard.payer, misheard.desc, misheard.participants], ['a', 'Chai and samosa', ['a', 'm']]);
  const unknown = say('Rahul paid 300 for lunch.')[0];
  assert.equal(unknown.payer, 'r');
  assert.match(unknown.notes[0], /rahul/);
  assert.deepEqual(say('hello there'), []);
});

test('spoken: what Whisper actually writes (pauses as full stops, split or glued names)', () => {
  const one = t => say(t)[0];
  assert.deepEqual(one('Kabir paid 1,000 for snacks. Arjun and Meera, 300 each, rest equally.').values, { a: 30000, m: 30000, r: 13334, k: 13333, h: 13333 });
  assert.deepEqual(one('Dinner, 2,400 paid by Mira. Everyone except Kabir.').participants, ['r', 'a', 'm', 'h']);
  assert.deepEqual(one('I paid 900 for the cab. Arjun, 50%, Meera, 30, Me.').values, { a: 50, m: 30, r: 20 });
  assert.deepEqual(one('I paid Arjun, 300.'), { kind: 'payment', from: 'r', to: 'a', amount: 30000, notes: [] });
  const g = one('R-Jun paid, $1,200 for groceries, split between me, R-Jun and Heat.');
  assert.deepEqual([g.payer, g.total, g.participants], ['a', 120000, ['r', 'a', 'h']]);
  assert.equal(one('Our Gen. paid 200 for coffee.').payer, 'a');
  assert.equal(one('Mirrapade 450 for the movie, split with Kabir.').payer, 'm');
  assert.equal(say('Riya paid 300 for chai. Arjun paid 150 for the auto.').length, 2);
  assert.equal(one('I paid 200 for the cup, split equally').desc, 'Cup');
});

// ---------- Saying who had what on a scanned bill ----------
const FOUR = [{ id: 'r', name: 'Riya', me: true }, { id: 'a', name: 'Arjun' }, { id: 'm', name: 'Meera' }, { id: 'k', name: 'Kabir' }];
const MENU = [{ key: 1, name: 'Large Farmhouse Pi' }, { key: 2, name: 'Masala Maggi' }, { key: 3, name: 'Cheese Maggi' }, { key: 4, name: 'Egg Maggi' }, { key: 5, name: 'Cold Coffee' }];
const who = text => plain(L.parseAssignSpeech(text, MENU, FOUR, 'r', 84000));
const byKey = r => Object.fromEntries(r.items.map(x => [x.key, x.ids]));

test('who had what: people and items in any order, the rest, clipped receipt names', () => {
  const r = who('Arjun and Meera had the pizza, I had the cold coffee, masala maggi for Kabir, the rest everyone shared.');
  assert.deepEqual(byKey(r), { 1: ['a', 'm'], 5: ['r'], 2: ['k'] });
  assert.deepEqual(r.rest, ['r', 'a', 'm', 'k']);
  const s = who('Everyone shared the farmhouse pizza. Cheese maggi was Kabir. Egg maggi and masala maggi for me. Cold coffee Arjun and Meera.');
  assert.deepEqual(byKey(s), { 1: ['r', 'a', 'm', 'k'], 3: ['k'], 4: ['r'], 2: ['r'], 5: ['a', 'm'] });
  assert.deepEqual(byKey(who('I had the cold coffee, masala maggi and egg maggi. Pizza for Arjun.')), { 5: ['r'], 1: ['a'], 2: ['r'], 4: ['r'] });
  assert.deepEqual(byKey(who('Everyone except Kabir had the pizza, Kabir had cheese maggi')), { 1: ['r', 'a', 'm'], 3: ['k'] });
  assert.deepEqual(who('Everything shared by everyone except Kabir').every, ['r', 'a', 'm']);
  assert.deepEqual(byKey(who('Mira had cold coffees and Our Gen had the egg Maggie.')), { 5: ['m'], 4: ['a'] });
});

test('who had what: unclear items are left to tap; a whole-bill split comes back as bill', () => {
  const amb = who('Kabir had the maggi.');
  assert.equal(amb.items.length, 0);
  assert.match(amb.notes[0], /Masala Maggi or Cheese Maggi or Egg Maggi/);
  assert.match(who('I had the burger').notes[0], /burger/);
  assert.deepEqual(who('Split it equally between me and Arjun.').bill, { mode: 'equal', participants: ['r', 'a'], values: {} });
  assert.deepEqual(who('Arjun 50%, Meera 30, me 20.').bill, { mode: 'percent', participants: ['r', 'a', 'm'], values: { a: 50, m: 30, r: 20 } });
});

test('who had what: "the remaining list was shared by other people" means the people not named', () => {
  const team = [{ id: 'r', name: 'Srikrishna', me: true }, { id: 'h', name: 'Heet' }, { id: 'a', name: 'Arjun' }, { id: 'm', name: 'Meera' }];
  const menu = [{ key: 1, name: 'GHEE PUDI Dosh ti«.«109' }, { key: 2, name: 'VADA' }, { key: 3, name: 'SWEET LASSI' }, { key: 4, name: 'IDLI' }];
  const r = plain(L.parseAssignSpeech('I had GHEE PUDI DOSA, Heet had VADA, I had a LASSI, then the remaining list was shared by other people.', menu, team, 'r', 100600));
  assert.deepEqual([byKey(r), r.rest, r.notes], [{ 1: ['r'], 2: ['h'], 3: ['r'] }, ['a', 'm'], []]);
  assert.deepEqual(plain(L.parseAssignSpeech('Heet had the vada, everyone else shared the rest.', menu, team, 'r', 1)).rest, ['r', 'a', 'm']);
  assert.deepEqual(plain(L.parseAssignSpeech('I had the idli, the rest of the items were shared by the others.', menu, team, 'r', 1)).rest, ['h', 'a', 'm']);
  // only two of us named and nobody else in the group: "the others" falls back to everyone
  assert.deepEqual(plain(L.parseAssignSpeech('I had the vada, the rest shared by other people', menu, team.slice(0, 1), 'r', 1)).rest, ['r']);
});
