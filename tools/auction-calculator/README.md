# Auction Max-Buy Calculator (Chrome / Edge extension)

A semi-transparent, draggable calculator that floats on top of any auction
site (Manheim, ADESA, ACV, OVE, etc.) while you appraise.

```
Bank ceiling   = JD Power Clean Trade × 125%
Sale price     = lower of the bank ceiling and Market Value (adjusted for market days supply)
Max Purchase   = Sale price − Target Profit − Transport − Buy Fee − Est. Recon
```

Market Value and Market Days Supply are optional. With only Clean Trade
filled in, the sale price is the bank ceiling.

## Deal grade

Enter a **Bid / Price** to grade that bid; leave it blank to grade the max buy.

### Sell at % and days to sell are linked

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

| You type | Other box shows | Sale price |
|---|---|---|
| 30 days | 94.6% | $16,573 |
| 97% | 39 days | $16,993 |
| 110% | 152 days | $19,271 |

The 10% figure is a starting guess. Change `FASTER_PER_POINT` at the top of
`content.js` once you see how your own price cuts affect speed.

- **Profit** = sale price − (price + transport + buy fee + recon)
- **Per day** = profit ÷ expected days to sell
- **Your cost** = all-in cost ÷ market value (how much of the market value you have in the car)
- **ROI** = profit ÷ all-in cost

| Grade | Rule |
|---|---|
| A | $60+/day **and** your cost ≤ 85% of market |
| B | $35+/day |
| C | $15+/day |
| D | under $15/day, or a loss |

### Pay up to, by grade

Under Max Purchase, the calculator works backwards from the days to sell to
show the most you can pay and still get each grade:

```
Pay up to (grade) = Sale price − Transport − Buy Fee − Recon − ($/day cutoff × days to sell)
```

For an A it's also capped so your all-in cost stays at or under 85% of market
value. Fewer days to sell means you can pay more for the same grade. Max
Purchase itself is still based on your flat Target Profit, since days don't
cost anything until holding cost is added.

Holding cost (depreciation, floorplan, lot) is not included yet. The bands
and grade cutoffs are at the top of `content.js` under "Tunable numbers".

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
  at the bottom of the window showing the max buy and grade (drag it
  sideways if it's in the way). **+** expands it back where it was.
- **Transparency:** slider at the bottom. It turns fully solid while your
  mouse is over it.
- **Copy to Notes:** copies a line like this, ready to paste into the
  auction's notes:
  `MAX BUY: $11,915 | Grade A at bid $11,915: profit $3,500, $117/day, cost 80% of mkt, ~30 days | Pay up to: A $12,787 / B $14,365 / C $14,965 | Sale $17,519 (100% of mkt) | JDP CT $16,375 x125% = $20,469 | Mkt $17,519 | MDS 53 | Profit $3,500 | Transport $494 | Buy Fee $110 | Recon $1,500 | 11/18/2026`
- **New:** clears the per-car fields (Clean Trade, Market Value, MDS, Sell
  at, days to sell, Recon, Bid). Profit, Transport and Buy Fee are kept, since they're usually the
  same from car to car.
