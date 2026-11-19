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

| Market Days Supply | Sell at |
|---|---|
| under 60 (hot / normal) | 100% of market |
| 60–89 (slow) | 97% |
| 90+ (oversupplied) | 94% |

**Est. days to sell** = Market Days Supply × **Sell speed**. Sell speed
defaults to 100% (leave it blank). Once your own sales show your cars sell
faster or slower than the market, change it: e.g. if you typically sell in
70% of the market's days supply, enter 70%. It's kept between cars.

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
  `MAX BUY: $11,915 | Grade A at bid $11,915: profit $3,500, $66/day, cost 80% of mkt, ~53 days | Sale $17,519 | JDP CT $16,375 x125% = $20,469 | Mkt $17,519 | MDS 53 | Profit $3,500 | Transport $494 | Buy Fee $110 | Recon $1,500 | 11/18/2026`
- **New:** clears the per-car fields (Clean Trade, Market Value, MDS, Recon,
  Bid). Profit, Transport and Buy Fee are kept, since they're usually the
  same from car to car.
