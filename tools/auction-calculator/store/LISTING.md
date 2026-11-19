# Chrome Web Store submission — copy/paste sheet

Upload file: `tools/dist/auction-calculator-2.0.0.zip`

---

## Package tab

Upload the ZIP above. (It contains `manifest.json` at the top level, plus
`background.js`, `content.js` and `icons/`.)

## Store listing tab

**Name** (comes from the extension)
Auction Max-Buy Calculator

**Summary** (comes from the extension, 132 characters max)
Floating calculator for appraising vehicles at online auctions: max purchase price from JD Power, market value and days supply.

**Description**

```
A floating, see-through calculator that sits on top of online auction listings so you can work out what to pay without leaving the page.

Enter the JD Power Clean Trade, market value and market days supply, plus your target profit, transport, buy fee and estimated recon. The calculator gives you:

• Bank ceiling: 125% of JD Power Clean Trade
• List price: the lower of the bank ceiling and market value, rounded to the nearest $100 minus $5
• Max Purchase: list price minus your target profit and expenses

Want the car sold in a set number of days? Type the days to sell and the calculator works out the price it takes to sell that fast, and the max purchase that goes with it. Or type a price (% of market) and it estimates the days to sell.

One click copies a summary line you can paste into the auction's notes, e.g.:
MAX BUY: $10,991 | Sell in ~30 days | List $16,595 (94.6% of mkt) | ...

Features
• Drag it anywhere; collapse it to a small bar at the bottom of the window
• Adjustable transparency (solid while your mouse is over it)
• Opens only on the tab you click it in, and stays open as you click through listings
• Remembers your usual profit, transport and buy fee between cars; "New" clears the per-car numbers
• Shortcut: Alt+Shift+A

Works on Manheim, ADESA / OPENLANE and ACV Auctions automatically. On any other site, click the icon and Chrome asks once whether to allow it there.

Everything stays in your browser. Nothing is sent anywhere.

Not affiliated with or endorsed by J.D. Power, Manheim, ADESA, OPENLANE or ACV Auctions.
```

**Category:** Tools

**Language:** English (United States)

**Store icon (128×128):** `tools/auction-calculator/icons/icon128.png`

**Screenshots (1280×800):** `tools/auction-calculator/store/screenshot-1280x800.png`

## Privacy tab

**Single purpose description**

```
Shows a floating calculator on vehicle auction pages that works out the maximum purchase price for a vehicle from values the user types in.
```

**Permission justifications**

| Permission | Justification (paste) |
|---|---|
| storage | `Saves the numbers the user types, the panel position and transparency so they carry over between listings and tabs.` |
| activeTab | `Lets the calculator open on the page the user is viewing when they click the toolbar icon.` |
| scripting | `Adds the calculator panel to the current page when the user clicks the toolbar icon, and keeps it loading on sites the user has allowed.` |
| Host permissions | `The calculator panel runs on the vehicle auction sites Manheim, ADESA, OPENLANE and ACV Auctions. Other sites are only requested at runtime, one site at a time, when the user clicks the icon on that site and approves Chrome's prompt.` |

**Are you using remote code?** No, I am not using remote code.

**Data usage:** check **none** of the data types. The extension does not
collect or transmit any user data. Then tick all three certification boxes:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** normally not required when no user data is
collected. If the dashboard insists, use a page with this text:

```
Auction Max-Buy Calculator does not collect, store on any server, or share any personal or usage data. The numbers you type are saved only in your own browser (Chrome extension storage) so they carry over between pages, and never leave your computer.
```

## Distribution tab

- **Payments:** Free
- **Visibility:** **Unlisted** (only people with the link can find it)
- **Regions:** United States (or All regions)

Then click **Submit for review**. Review usually takes a few days.

## Publishing an update later

1. Raise `"version"` in `manifest.json` (e.g. 2.0.0 → 2.0.1).
2. Build a new ZIP of the extension files.
3. In the dashboard, open the item → **Package** → **Upload new package** → **Submit for review**.

Everyone who installed it gets the update automatically once it's approved.
