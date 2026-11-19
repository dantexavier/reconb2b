# Auction Max-Buy Calculator (Chrome / Edge extension)

A semi-transparent, draggable calculator that floats on top of any auction
site (Manheim, ADESA, ACV, OVE, etc.) while you appraise.

```
Bank ceiling   = JD Power Clean Trade × 125%
Sale price     = lower of the bank ceiling and Market Value × Sell at %
List price     = Sale price rounded to the nearest $100, minus $5   (the working price)
Max Purchase   = List price − Target Profit − Transport − Buy Fee − Est. Recon
```

Example: $16,573 → $16,600 → **$16,595**. The list price never goes over the
bank ceiling: if rounding up would cross it, it rounds down instead
($20,469 ceiling → $20,395).

Market Value and Market Days Supply are optional. With only Clean Trade
filled in, the sale price is the bank ceiling.

## Pricing for a timeframe: Sell at % and days to sell

Want it sold in 30 days? Type 30 in **Est. days to sell** and Max Purchase
shows what to pay, based on the lower price it takes to sell that fast.

Type in either box and the other fills in (in grey) to match. Typing in one
clears the other, so whichever you typed last is in charge. Leave both blank
to use the market's own numbers:

| Market Days Supply | Default sell at |
|---|---|
| under 60 (hot / normal) | 100% of market |
| 60–89 (slow) | 97% |
| 90+ (oversupplied) | 94% |

…selling in **Market Days Supply × Sell speed** days (Sell speed blank = 100%).

From there, **each 1% you price under that default sells ~10% faster**, and
each 1% over sells ~10% slower. Sell at is limited to 80–110% of market.
Example with MDS 53 and market $17,519:

| You type | Other box shows | List price |
|---|---|---|
| 30 days | 94.6% | $16,595 |
| 97% | 39 days | $16,995 |
| 110% | 152 days | $19,295 |

The 10% figure is a starting guess. Change `FASTER_PER_POINT` at the top of
`content.js` once you see how your own price cuts affect speed.

Holding cost (depreciation, floorplan, lot) is not included yet. The MDS
bands and the price/speed link are at the top of `content.js` under
"Tunable numbers".

## Install (one time, ~1 minute)

1. Download this `tools/auction-calculator` folder to your computer.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and pick the `auction-calculator` folder.
5. Pin it: puzzle-piece icon in the toolbar → pin **Auction Max-Buy Calculator**.

## Use

- **Show / hide:** click the toolbar icon or press **Alt+Shift+A**. It opens
  only on the tab you clicked it in, and stays open on that tab as you click
  through listings. Numbers you've typed carry over if you open it on
  another tab.
- **Move it:** drag the title bar. **–** collapses it to a small bar docked
  at the bottom of the window showing the max buy (drag it
  sideways if it's in the way). **+** expands it back where it was.
- **Transparency:** slider at the bottom. It turns fully solid while your
  mouse is over it.
- **Copy to Notes:** copies a line like this, ready to paste into the
  auction's notes:
  `MAX BUY: $10,991 | Sell in ~30 days | List $16,595 (94.6% of mkt) | JDP CT $16,375 x125% = $20,469 | Mkt $17,519 | MDS 53 | Profit $3,500 | Transport $494 | Buy Fee $110 | Recon $1,500 | 11/19/2026`
- **New:** clears the per-car fields (Clean Trade, Market Value, MDS, Sell
  at, days to sell, Recon). Profit, Transport and Buy Fee are kept, since they're usually the
  same from car to car.
