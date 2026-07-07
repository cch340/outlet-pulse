# Staff phone number + WhatsApp button — design

## Goal

Give each staff member an optional phone number, and a WhatsApp button that opens
a chat with that number (`https://wa.me/<number>`). Buttons appear on the Staff
screen row actions and in the Visit drawer for the staff on duty.

## Scope

**In scope**
- Optional `phone` field on staff (DB, model, mapper, mutations, edit modal).
- Pure, tested helper for phone → WhatsApp conversion and validation.
- Shared `WhatsAppButton` component.
- Buttons on the Staff screen (desktop + mobile rows) and the Visit drawer.
- Validation: if a phone is entered, it must look like a phone number.

**Out of scope**
- No phone column in the staff table listing.
- No format-as-you-type masking in the input.
- No click-to-call / SMS — WhatsApp only.

## Data model & storage

- **Migration** `supabase/migrations/0013_staff_phone.sql`:
  ```sql
  alter table staff add column phone text;
  ```
  Nullable/optional. Existing staff have no phone; phone is not required to add staff.
- **Storage policy:** store the number **exactly as the user typed it**
  (e.g. `012-345 6789`), keeping it human-readable in the edit form. Normalize to
  WhatsApp digits only at click time.
- `Staff.phone?: string` in `src/data/model.ts`.
- `StaffRow.phone: string | null` in `src/data/queries/mappers.ts`; `rowToStaff`
  maps `phone: r.phone ?? undefined`.
- `useCreateStaff` / `useUpdateStaff` include `phone` in the insert/update payload
  (`src/data/queries/useStaffCrudMutations.ts`). Send `null` when empty.

## Pure logic module

New `src/data/whatsapp.ts` + `src/data/whatsapp.test.ts` (follows the repo
convention of extracting non-trivial logic into a tested module).

- `toWaDigits(raw: string): string`
  - Strip everything except digits (drops `+`, spaces, dashes, parens).
  - If the result starts with `0`, replace the leading `0` with `60` (Malaysia default).
  - Otherwise use the digits as-is (lets a user type a full `60…`/other-country number).
  - Returns `''` when there are no digits.
- `waUrl(raw: string): string | null`
  - Returns `https://wa.me/<digits>` from `toWaDigits`, or `null` when empty.
- `isValidPhone(raw: string): boolean`
  - `true` for empty/whitespace (phone stays optional).
  - Otherwise `true` only when the sanitized digit count is **7–15** (15 = E.164 max).

**Examples**
- `012-345 6789` → digits `60123456789` → `https://wa.me/60123456789`, valid.
- `+60 12 345 6789` → `60123456789`, valid.
- `60123456789` → unchanged, valid.
- `123` → too short, invalid.
- `` (empty) → valid (optional), `waUrl` = `null`.

**Tests** (`whatsapp.test.ts`): leading-zero MY conversion, already-`60` passthrough,
symbol stripping, empty handling, and `isValidPhone` boundaries (empty ok, `123`
invalid, an 11-digit MY number valid, 16+ digits invalid).

## UI

### Shared `WhatsAppButton` component
New `src/components/WhatsAppButton.tsx`.
- Props: `phone?: string`, and optional `compact?: boolean` (icon-only for mobile).
- Renders `null` when `!phone` (nothing shown for phone-less staff).
- Uses `actionBtn()` styling with an inline WhatsApp SVG glyph in brand green
  (`#25D366`) — Material Symbols has no WhatsApp icon.
- On click: `window.open(waUrl(phone), '_blank')` (guard against `null`).

### StaffModal (`src/components/StaffModal.tsx`)
- Add an optional **Phone** input, sharing the flex row with Role/Joined
  (rewrapped so all three fit).
- Local `phone` state seeded from `existing?.phone ?? ''`.
- On submit: if `!isValidPhone(phone)`, block the save and show an inline error
  under the Phone field ("Enter a valid phone number"), consistent with the
  modal's existing early-return on missing name/joined.
- Pass `phone` (trimmed; `null` when empty) through create and update.

### Staff screen (`src/screens/Staff.tsx`)
- Include `phone` on the row view-model.
- Render `WhatsAppButton` in the action group of each row — desktop (full) and
  mobile (compact), alongside Edit / Transfer / Delete.

### Visit drawer (`src/components/VisitDrawer.tsx`)
- Next to the "Staff on duty" area, render `WhatsAppButton` for the
  **currently-assigned** staff (`openF.staffId`), when that staff has a phone.

## Testing

- Unit tests for `whatsapp.ts` as above (`node` env, matches `src/**/*.test.ts`).
- No component/DOM tests — consistent with the repo (logic lives in pure modules).
- `npm run build` must pass (strict `noUnusedLocals`/`noUnusedParameters`).

## Migration note

`0013_staff_phone.sql` is applied manually via the Supabase SQL editor, in order,
per the repo's migration workflow.
