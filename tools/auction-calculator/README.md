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

| Market Days Supply | Priced at | Expected days to sell |
|---|---|---|
| under 30 (hot) | 100% of market | ~20 |
| 30–59 (normal) | 100% | ~35 |
| 60–89 (slow) | 97% | ~55 |
| 90+ (oversupplied) | 94% | ~75 |

- **Profit** = sale price − (price + transport + buy fee + recon)
- **Per day** = profit ÷ expected days to sell
- **Cost to mkt** = all-in cost ÷ market value
- **ROI** = profit ÷ all-in cost

| Grade | Rule |
|---|---|
| A | $60+/day **and** cost to market ≤ 85% |
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
- **Move it:** drag the title bar. **–** collapses it to just the max-buy number.
- **Transparency:** slider at the bottom. It turns fully solid while your
  mouse is over it.
- **Copy to Notes:** copies a line like this, ready to paste into the
  auction's notes:
  `MAX BUY: $20,400 | Grade B at bid $19,000: profit $2,900, $83/day, 88% cost-to-mkt | Sale $23,500 | JDP CT $20,000 x125% = $25,000 | Mkt $23,500 | MDS 40 | Profit $1,500 | Transport $350 | Buy Fee $450 | Recon $800 | 11/18/2026`
- **New:** clears the per-car fields (Clean Trade, Market Value, MDS, Recon,
  Bid). Profit, Transport and Buy Fee are kept, since they're usually the
  same from car to car.
