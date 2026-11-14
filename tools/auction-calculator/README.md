# Auction Max-Buy Calculator (Chrome / Edge extension)

A semi-transparent, draggable calculator that floats on top of any auction
site (Manheim, ADESA, ACV, OVE, etc.) while you appraise.

```
Max Purchase = (JD Power Clean Trade × 125%) − Target Profit − Transport − Buy Fee − Est. Recon
```

## Install (one time, ~1 minute)

1. Download this `tools/auction-calculator` folder to your computer.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and pick the `auction-calculator` folder.
5. Pin it: puzzle-piece icon in the toolbar → pin **Auction Max-Buy Calculator**.

## Use

- **Show / hide:** click the toolbar icon or press **Alt+Shift+A**. It stays
  open as you move between listings and tabs.
- **Move it:** drag the title bar. **–** collapses it to just the max-buy number.
- **Transparency:** slider at the bottom. It turns fully solid while your
  mouse is over it.
- **Copy to Notes:** copies a line like this, ready to paste into the
  auction's notes:
  `MAX BUY: $21,900 | JDP Clean Trade $20,000 x125% = $25,000 | Profit $1,500 | Transport $350 | Buy Fee $450 | Recon $800 | 11/14/2026`
- **New:** clears Clean Trade and Recon for the next car. Profit, Transport
  and Buy Fee are kept, since they're usually the same from car to car.
