# Handoff: Staff Monitoring App ("OutletPulse")

## Overview
An internal operations tool for a **regional/area manager** who monitors retail staff across many brand stores in multiple shopping malls. It covers five areas:

1. **Summary / Dashboard** — at-a-glance KPIs, follow-up trends, and attention lists.
2. **Brand management** — brands and the outlets they operate in.
3. **Outlet management** — malls and the brands hosted in each.
4. **Staff management** — staff assignments + a transfer flow.
5. **Follow-ups** — scheduling store visits, checklists, and done/pending tracking.

The app has both a **desktop** (sidebar layout) and a **mobile** (phone, bottom-tab layout) presentation.

## About the Design Files
The files in this bundle (`Staff Monitor.dc.html` + `support.js`) are a **design reference created in HTML** — a working prototype that shows the intended look, layout, data model, and interactions. **It is not production code to copy directly.**

`Staff Monitor.dc.html` is authored in a lightweight in-house "Design Component" format (a custom `<x-dc>` template + a `Component` logic class, rendered by `support.js`). Treat it as an interactive spec: open it in a browser to click through the real behavior, and read its source to see exact styles and logic.

**Your task:** recreate this design in the target codebase using its **existing environment and patterns** (React, Vue, Svelte, SwiftUI, native, etc.) and its established component library, state management, and routing. If no environment exists yet, choose the most appropriate stack for the project and implement there. Do **not** ship the HTML/`support.js` runtime as-is.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, layouts, and interactions are all specified here and present in the prototype. Recreate the UI faithfully using the codebase's libraries; the exact hex/spacing/typography values are in **Design Tokens** below. Icons use Google's **Material Symbols Outlined** — map each named glyph to the codebase's icon set.

---

## Data Model (read this first)
The relationships are the heart of the app. Model them explicitly.

```
Brand    { id, name, color (hex chip), category }
Outlet   { id, name, location }
Store    { brandId, outletId }          // JOIN row: a brand operating in an outlet
Staff    { id, name, brandId, outletId, role, joined (ISO date),
           history: [ { brandId, outletId, from, to? } ] }   // assignment log
FollowUp { id, date (ISO), staffId, brandId, outletId,
           status: 'done' | 'pending',
           tasks: [ { label, done: boolean } ] }
```

Rules / derived values:
- **Brand ↔ Outlet is many-to-many.** A brand operates in many outlets; an outlet hosts many brands. The `Store` join models each brand-in-outlet pairing. ("Active stores" KPI = number of Store rows.)
- A **staff member works under one brand at one outlet** (their current `brandId`+`outletId`).
- **Transfer**: moving a staff member to another brand/outlet. On transfer, close the open `history` entry (set its `to`) and push a new entry `{ brandId, outletId, from, reason? }`. `history.length > 1` ⇒ show a "Transferred" badge.
- **Follow-up status** is stored as `done` or `pending`. **Overdue** is *derived*: `status === 'pending' && date < today`. (The prototype uses a fixed "today" = **2026-06-29**; use the real current date in production.)
- A follow-up's **progress** = `tasks.filter(done).length / tasks.length`.

Default task checklist (used when scheduling): `Stock & display`, `Grooming & attendance`, `Sales target review`, `Store cleanliness`, `Promo / POSM setup`.

### Sample data used in the prototype
- **Brands:** Skintific (Skincare, `#0ea5e9`), G2G (Cosmetics, `#8b5cf6`), Facerinna (Beauty, `#ec4899`).
- **Outlets:** Gurney Plaza (Georgetown), Queensbay Mall (Bayan Lepas), Sunway Carnival (Seberang Jaya).
- **Stores:** Skintific @ all 3; G2G @ Gurney + Queensbay; Facerinna @ Queensbay + Sunway (7 stores total).
- **Staff (8):** John Tan (Skintific/Gurney, Supervisor), Peter Lim (G2G/Queensbay, Promoter), Ana Rahman (Facerinna/Sunway, Beauty Advisor), Kiriko Sato (Skintific/Queensbay, Promoter), Mei Ling (G2G/Gurney, Promoter), Raj Kumar (Facerinna/Queensbay, Supervisor), Siti Nurul (Skintific/Sunway, Beauty Advisor), Daniel Wong (G2G/Queensbay, Promoter — has a prior transfer in history).
- **Follow-ups (16):** spread Jan–Jul 2026, mix of done / pending; several pending-and-past = overdue.

---

## Screens / Views

### 1. App Shell
- **Desktop:** fixed left **sidebar** (228px) on dark `--sidebar`; logo ("OutletPulse"), a "MONITORING" section label, 5 nav items, and a manager card pinned to the bottom (avatar "AK", "Aisha Karim", "Area Manager · Penang"). Main column = sticky **top bar** (60px) + scrolling content.
- **Mobile:** no sidebar; the app sits in a phone frame; nav moves to a **bottom tab bar** (5 tabs: Home, Brands, Outlets, Staff, Visits). A small logo chip appears in the top bar.
- **Top bar:** page title + subtitle (left); on desktop a search box (240px) filtering the current list; a **view toggle** button (desktop⇄mobile); a primary **Schedule** button (accent) that opens the Schedule Follow-up modal. On mobile, search is hidden and the toggle/Schedule buttons collapse to icons.
- **Nav items** (icon = Material Symbols): Dashboard `space_dashboard`, Brands `sell`, Outlets `storefront`, Staff `groups`, Follow-ups `fact_check`. The Follow-ups item shows a red count **badge** = number of overdue follow-ups. Active item = accent background, white text.

### 2. Summary / Dashboard
Vertical stack of sections (each section is a card or grid of cards; gap 14px):
- **Stat strip** — 4 cards (`auto-fit minmax(150px,1fr)`): Brands, Outlets, Active stores, Staff monitored. Each: rounded icon tile (accent tint bg) + big mono number + label.
- **Period toggle** — segmented control: **This month** / **Year 2026**. Drives the KPI row below. Label reads "Follow-up performance — June 2026" / "… — Year 2026".
- **KPI row** — 4 cards: **Follow-ups** (count, neutral), **Completion** (% done, green `#16a34a`), **Pending** (amber `#d97706`), **Overdue** (red `#dc2626`). Each: uppercase label + small status icon, big mono value, sub-caption.
- **Follow-ups by month** — bar chart, Jan→Jul. Each month is a stacked bar: **done** segment (solid accent) below, **pending** segment (12–22% accent tint) above; total count label above each bar; legend top-right.
- **Brand × Outlet coverage** — matrix table: rows = brands, columns = outlets. A linked cell shows the **staff count** on a brand-tinted background; an unlinked cell shows "–" on a muted background. This visualizes the many-to-many.
- **Follow-ups by brand** — horizontal bars per brand (bar width ∝ total follow-ups; label "{done}/{total} done").
- **Staff distribution by outlet** — horizontal bars per outlet (label "{n} staff · {n} brands").
- **Overdue follow-ups** — list of red-dot rows (store · staff · date); count chip in header; tap opens the detail drawer. Empty state: "Nothing overdue."
- **Upcoming visits** — list of blue-dot rows (pending, future), tap opens drawer.

### 3. Brand Management
Master–detail, 2 columns (`auto-fit minmax(300px,1fr)`; stacks on mobile).
- **Left list:** one selectable card per brand — square avatar (brand color, 2-letter initials), name, category, and right-aligned "{n} outlets" / "{n} staff". Selected card = accent border + faint accent tint.
- **Right detail:** selected brand header (avatar, name, "{category} · operates in {n} outlets · {n} staff"), then a list of that brand's **outlets**; each outlet block shows name · location, on-site staff count, and pill chips for each staff member (mini avatar + name + role).

### 4. Outlet Management
Mirror of Brands. Left = outlet cards (storefront icon tile, name, location, "{n} brands" / "{n} staff"). Right = selected outlet header + **brands hosted here**; each brand block shows the brand (color dot + name), staff count, and staff chips.

### 5. Staff Management
- **Brand filter chips** at top: "All staff" + one per brand (active = accent).
- **Desktop:** a table inside a card — columns **Staff member** (avatar + name + role; "Transferred" badge if applicable), **Brand** (color dot + name), **Outlet**, **Tenure** (mono, computed from `joined`), **Action** (a "Transfer" button). Horizontal scroll if narrow.
- **Mobile:** stacked **cards** — top row: avatar + name (+ "Moved" badge) + role + an icon-only transfer button (`swap_horiz`); divider; footer row: brand (dot + name) · outlet · tenure (right-aligned mono).
- Search filters by name/role/brand/outlet.

### 6. Follow-ups
- **Filter chips** with counts: **All**, **Pending**, **Overdue**, **Completed**.
- **Desktop rows:** date block (DD / MON, mono) | divider | brand·outlet + staff | progress bar + "{done}/{total}" | **status pill** | a green **Done** quick-action (only when not yet done). Tap row → detail drawer.
- **Mobile rows (simplified — intentionally less data):** small date block | brand·outlet (one line, ellipsis) + staff below | status pill. No progress bar, no inline Done button. Tap row → drawer (complete it there).
- Empty state: "No follow-ups match this filter."

### 7. Follow-up Detail Drawer
Right-side drawer (430px; full-width on mobile). Header: "FOLLOW-UP · {date}", store title (brand dot + brand · outlet), "Staff on duty · {name}", status pill, close button. Body: **Checklist** ("{done}/{total} complete") — each task is a toggle row with a checkbox (green when done) and strike-through label when done. Footer: **Mark complete** (green) when pending; **Reopen follow-up** when done.

### 8. Transfer Modal
Centered modal (~500px). Header: avatar + "Transfer {name}", "Currently {brand} · {outlet}", close. Body: **New brand** (selectable chips), **New outlet** (selectable chips), **Effective date** (date input), **Reason** (text input, optional), and a live summary banner "{name} → {newBrand} at {newOutlet}". Footer: Cancel / **Confirm transfer** (accent). Confirm updates the staff record + appends a history entry (see Data Model).

### 9. Schedule Follow-up Modal
Centered modal (~520px), also opened by the top-bar **Schedule** button. Body: **Store** picker (chips: "brand · outlet" for every Store), **Scheduled date**, **Tasks to check** (toggleable checklist seeded from the default 5). Footer: live summary ("{brand} · {outlet} · {n} tasks") + Cancel / **Schedule** (accent). Schedule creates a `pending` follow-up with the selected tasks and navigates to the Follow-ups screen.

---

## Interactions & Behavior
- **Navigation:** sidebar / bottom-tab switches the active screen (single-page; no full reloads).
- **Master-detail:** clicking a brand/outlet card sets the selected entity and updates the right panel.
- **Period toggle / filter chips:** recompute the visible data client-side.
- **Schedule / Transfer:** modal forms; confirming mutates state and (for Schedule) routes to Follow-ups. Clicking the backdrop or close button dismisses.
- **Drawer:** toggling a task updates its `done`; "Mark complete" sets status `done` + all tasks done; "Reopen" flips status back to `pending`.
- **Overlays:** on **desktop** modals/drawer are `position: fixed` (full viewport); on **mobile** they are `position: absolute`, contained within the phone frame.
- **Responsive:** all multi-column grids use `auto-fit minmax(...)` and collapse to one column when narrow. The mobile scroll area must use `min-height: 0` on the flex scroll container (flexbox overflow fix) so content scrolls instead of overflowing.
- **No backend in the prototype** — all data is in-memory seed data; mutations are local state.

## State Management
- `activeScreen`: 'dashboard' | 'brands' | 'outlets' | 'staff' | 'followups'
- `isMobile` (view toggle) — in production this is normally the viewport/media query, not a manual toggle.
- `period`: 'month' | 'year'
- `q`: search string
- `selectedBrandId`, `selectedOutletId`
- `staffBrandFilter`: 'all' | brandId
- `fuFilter`: 'all' | 'pending' | 'overdue' | 'done'
- `openFuId`: id | null (drawer)
- `transferStaffId` + `transferForm` { brandId, outletId, reason, date }
- `addOpen` + `addForm` { storeKey, date, tasks[] }
- Core collections: `brands`, `outlets`, `stores`, `staff`, `followups`.
- **Data fetching (production):** replace seed data with API calls — list/CRUD for brands, outlets, stores (links), staff (incl. transfer = update assignment + history), and follow-ups (incl. create, toggle task, set status).

## Design Tokens

**Typography**
- UI font: **IBM Plex Sans** (weights 400/500/600/700).
- Numbers / dates / data: **IBM Plex Mono** (500/600).
- Icons: **Material Symbols Outlined**.
- Scale: section titles 14–18px/700; body 12.5–13.5px; labels 11px uppercase letter-spacing .04em; big KPI numbers 23–30px/600 mono.

**Color — accent** (themeable; default in current build is slate `#64748b`, original brand is orange `#ea580c`)
- Options: `#ea580c` (orange), `#2563eb` (blue), `#0d9488` (teal), `#7c3aed` (violet), `#64748b` (slate). Accent tints use `color-mix(in srgb, <accent> N%, transparent)`.

**Color — light theme**
- bg `#f5f5f4`, surface `#ffffff`, surface-2 `#fafaf9`, border `#e7e5e4`, text `#1c1917`, dim `#78716c`, sidebar `#1c1917`, sidebar-text `#a8a29e`.

**Color — dark theme**
- bg `#1c1917`, surface `#292524`, surface-2 `#221f1c`, border `#3f3a36`, text `#fafaf9`, dim `#a8a29e`, sidebar `#0c0a09`.

**Color — status**
- done/green `#16a34a`, pending/amber `#d97706`, overdue/red `#dc2626`, upcoming/blue `#2563eb`.

**Color — brand chips**
- Skintific `#0ea5e9`, G2G `#8b5cf6`, Facerinna `#ec4899`.

**Radius:** cards 12px; inputs/buttons 7–9px; pills/status 6px; chips 20px; avatars 50%.
**Density:** comfortable (card padding ~18px, row padding 12px) vs compact (~12px / 8px) — exposed as a theme option.
**Shadow:** modals/drawer `0 30px 80px rgba(0,0,0,.3)`; mobile phone frame `0 40px 90px rgba(0,0,0,.35)`.
**Themeable props** (in the prototype): `accent` (color), `themeMode` (light/dark), `density` (comfortable/compact).

## Assets
- **Fonts** via Google Fonts: IBM Plex Sans, IBM Plex Mono, Material Symbols Outlined. Use the codebase's font setup / icon library equivalents.
- No raster images or logos — the "OutletPulse" name is text; brand identities are color dots/initials. No proprietary/brand assets are used.

## Files
- `Staff Monitor.dc.html` — the full interactive design (template + `Component` logic class with all screens, modals, drawer, seed data, and computations). Open in a browser to interact; read the source for exact styles/logic.
- `support.js` — the runtime that renders the `.dc.html` (reference only; **do not** port this).
