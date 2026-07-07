# Staff Phone Number + WhatsApp Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional phone number to staff and a WhatsApp button (on the Staff screen and Visit drawer) that opens a chat with that number.

**Architecture:** A nullable `phone` column on the `staff` table flows through the mapper into `Staff.phone`. A pure, unit-tested module (`whatsapp.ts`) normalizes a typed number to WhatsApp digits (Malaysia default) and validates it. A shared `WhatsAppButton` component renders the launch button wherever a staff phone is available. The edit modal gains an optional, validated phone input.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres), React Query, Vitest (node env). All styling is inline `style={}` objects driven by CSS variables.

## Global Constraints

- All styling is inline `style={}` objects using CSS variables — no CSS framework, no `.module.css`.
- Tests run in `node` env and only match `src/**/*.test.ts` — logic must be pure (no React/DOM) to be tested.
- `npm run build` runs `tsc -b` with `noUnusedLocals`/`noUnusedParameters` — no unused imports/vars/params.
- DB rows are snake_case; domain model is camelCase; always convert via mappers in `src/data/queries/mappers.ts`.
- Phone is **optional**; store the number **exactly as the user typed it**, normalize only at click time.
- SQL migrations are applied manually via the Supabase SQL editor, in order.
- Git commits use `git -c user.email=cch340@gmail.com` and end with the Co-Authored-By trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

- **Create** `supabase/migrations/0013_staff_phone.sql` — adds the `phone` column.
- **Create** `src/data/whatsapp.ts` — pure normalize/validate/url helpers.
- **Create** `src/data/whatsapp.test.ts` — unit tests for the above.
- **Create** `src/components/WhatsAppButton.tsx` — shared launch button.
- **Modify** `src/data/model.ts` — add `phone?` to `Staff`.
- **Modify** `src/data/queries/mappers.ts` — `StaffRow.phone` + map in `rowToStaff`.
- **Modify** `src/data/queries/useStaffCrudMutations.ts` — include `phone` in create/update.
- **Modify** `src/components/StaffModal.tsx` — phone input + validation.
- **Modify** `src/screens/Staff.tsx` — WhatsApp button on rows (desktop + mobile).
- **Modify** `src/components/VisitDrawer.tsx` — WhatsApp button for staff on duty.

---

### Task 1: Pure WhatsApp helper module (TDD)

**Files:**
- Create: `src/data/whatsapp.ts`
- Test: `src/data/whatsapp.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toWaDigits(raw: string): string` — digits-only, leading `0` → `60`, `''` when no digits.
  - `waUrl(raw: string): string | null` — `https://wa.me/<digits>` or `null` when empty.
  - `isValidPhone(raw: string): boolean` — `true` when empty, else `true` only when sanitized digit count is 7–15.

- [ ] **Step 1: Write the failing tests**

Create `src/data/whatsapp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toWaDigits, waUrl, isValidPhone } from './whatsapp'

describe('toWaDigits', () => {
  it('strips symbols and converts a leading 0 to 60 (Malaysia)', () => {
    expect(toWaDigits('012-345 6789')).toBe('60123456789')
  })
  it('strips a leading + and spaces, keeping the country code', () => {
    expect(toWaDigits('+60 12 345 6789')).toBe('60123456789')
  })
  it('leaves an already-normalized 60 number unchanged', () => {
    expect(toWaDigits('60123456789')).toBe('60123456789')
  })
  it('returns empty string when there are no digits', () => {
    expect(toWaDigits('  ')).toBe('')
    expect(toWaDigits('abc')).toBe('')
  })
})

describe('waUrl', () => {
  it('builds a wa.me url from normalized digits', () => {
    expect(waUrl('012-345 6789')).toBe('https://wa.me/60123456789')
  })
  it('returns null when there are no digits', () => {
    expect(waUrl('')).toBeNull()
  })
})

describe('isValidPhone', () => {
  it('treats empty/whitespace as valid (optional field)', () => {
    expect(isValidPhone('')).toBe(true)
    expect(isValidPhone('   ')).toBe(true)
  })
  it('rejects too-short numbers', () => {
    expect(isValidPhone('123')).toBe(false)
  })
  it('accepts a normal MY mobile number', () => {
    expect(isValidPhone('012-345 6789')).toBe(true)
  })
  it('rejects numbers longer than 15 digits (E.164 max)', () => {
    expect(isValidPhone('1234567890123456')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/whatsapp.test.ts`
Expected: FAIL — cannot resolve `./whatsapp` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/data/whatsapp.ts`:

```ts
/** Normalize a user-typed phone to WhatsApp digits. Malaysia default: a leading 0 becomes 60. */
export function toWaDigits(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return '60' + digits.slice(1)
  return digits
}

/** Build a wa.me link, or null when there is no usable number. */
export function waUrl(raw: string): string | null {
  const digits = toWaDigits(raw)
  return digits ? `https://wa.me/${digits}` : null
}

/** Empty is valid (phone is optional). Otherwise require a sane phone-length digit count. */
export function isValidPhone(raw: string): boolean {
  if (!(raw ?? '').trim()) return true
  const digits = toWaDigits(raw)
  return digits.length >= 7 && digits.length <= 15
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/whatsapp.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/data/whatsapp.ts src/data/whatsapp.test.ts
git -c user.email=cch340@gmail.com commit -m "feat: add pure whatsapp phone helpers with tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Data schema — migration, model, mapper

**Files:**
- Create: `supabase/migrations/0013_staff_phone.sql`
- Modify: `src/data/model.ts:32-40` (the `Staff` interface)
- Modify: `src/data/queries/mappers.ts:14-22` (`StaffRow`) and `:67-77` (`rowToStaff`)

**Interfaces:**
- Consumes: nothing.
- Produces: `Staff.phone?: string`; `StaffRow.phone: string | null`; `rowToStaff` populates `phone`.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/0013_staff_phone.sql`:

```sql
-- Add an optional phone number to staff (for WhatsApp contact).
alter table staff add column phone text;
```

- [ ] **Step 2: Add `phone` to the `Staff` model**

In `src/data/model.ts`, add `phone` to the `Staff` interface (after `role`):

```ts
export interface Staff {
  id: string
  name: string
  brandId: string
  outletId: string
  role: string
  phone?: string
  joined: string // ISO date
  history: HistoryEntry[]
}
```

- [ ] **Step 3: Add `phone` to `StaffRow` and map it**

In `src/data/queries/mappers.ts`, add `phone` to `StaffRow` (after `role`):

```ts
export interface StaffRow {
  id: string
  name: string
  brand_id: string
  outlet_id: string
  role: string
  phone: string | null
  joined: string
  staff_history: StaffHistoryRow[]
}
```

Then in `rowToStaff`, map it (after `role: r.role,`):

```ts
export const rowToStaff = (r: StaffRow): Staff => ({
  id: r.id,
  name: r.name,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  role: r.role,
  phone: r.phone ?? undefined,
  joined: r.joined,
  history: [...r.staff_history]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(rowToHistory),
})
```

- [ ] **Step 4: Verify the build type-checks**

Run: `npm run build`
Expected: PASS (no type errors). `staff` query uses `select('*, staff_history(*)')` so `phone` is already fetched.

- [ ] **Step 5: Apply the migration in Supabase**

Note for the operator: paste `supabase/migrations/0013_staff_phone.sql` into the Supabase SQL editor and run it (migrations are applied manually, in order). The app build does not require this, but the running app needs the column before create/update with phone will persist.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0013_staff_phone.sql src/data/model.ts src/data/queries/mappers.ts
git -c user.email=cch340@gmail.com commit -m "feat: add optional phone column to staff schema and model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Persist phone in create/update mutations

**Files:**
- Modify: `src/data/queries/useStaffCrudMutations.ts:6-38` (`useCreateStaff`) and `:40-52` (`useUpdateStaff`)

**Interfaces:**
- Consumes: `Staff.phone` (Task 2).
- Produces: `useCreateStaff` mutate input adds `phone?: string`; `useUpdateStaff` mutate input adds `phone?: string`. Empty/undefined is stored as `null`.

- [ ] **Step 1: Add `phone` to `useCreateStaff`**

In `src/data/queries/useStaffCrudMutations.ts`, extend the create input type and insert payload:

```ts
    mutationFn: async (input: {
      name: string
      brandId: string
      outletId: string
      role: string
      phone?: string
      joined: string
    }) => {
      const { data: st, error } = await supabase
        .from('staff')
        .insert({
          name: input.name,
          brand_id: input.brandId,
          outlet_id: input.outletId,
          role: input.role,
          phone: input.phone?.trim() || null,
          joined: input.joined,
        })
        .select('id')
        .single()
```

- [ ] **Step 2: Add `phone` to `useUpdateStaff`**

In the same file, extend the update input type and update payload:

```ts
    mutationFn: async (input: { id: string; name: string; role: string; phone?: string; joined: string }) => {
      const { error } = await supabase
        .from('staff')
        .update({ name: input.name, role: input.role, phone: input.phone?.trim() || null, joined: input.joined })
        .eq('id', input.id)
      if (error) throw error
    },
```

- [ ] **Step 3: Verify the build type-checks**

Run: `npm run build`
Expected: PASS. (StaffModal not yet passing `phone` is fine — the field is optional.)

- [ ] **Step 4: Commit**

```bash
git add src/data/queries/useStaffCrudMutations.ts
git -c user.email=cch340@gmail.com commit -m "feat: persist staff phone in create/update mutations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Phone input + validation in StaffModal

**Files:**
- Modify: `src/components/StaffModal.tsx`

**Interfaces:**
- Consumes: `isValidPhone` (Task 1); `useCreateStaff`/`useUpdateStaff` `phone` input (Task 3); `Staff.phone` (Task 2).
- Produces: modal collects and validates `phone`, passing it to both mutations.

- [ ] **Step 1: Import the validator and add phone state**

In `src/components/StaffModal.tsx`, add the import near the other imports:

```ts
import { isValidPhone } from '../data/whatsapp'
```

Add phone + error state alongside the existing `useState` calls (after the `role` line):

```ts
  const [role, setRole] = useState(existing?.role ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [phoneError, setPhoneError] = useState(false)
```

- [ ] **Step 2: Validate and pass phone in `submit`**

Replace the `submit` function body so it validates phone and forwards it:

```ts
  const submit = () => {
    if (!name.trim() || !joined) return
    if (!isValidPhone(phone)) {
      setPhoneError(true)
      return
    }
    if (m.mode === 'add') {
      if (!brandId || !outletId) return
      create.mutate(
        { name: name.trim(), role: role.trim(), phone: phone.trim(), joined, brandId, outletId },
        { onSuccess: () => closeStaffModal(), onError: (e) => alert(e.message) },
      )
    } else {
      update.mutate(
        { id: m.id, name: name.trim(), role: role.trim(), phone: phone.trim(), joined },
        { onSuccess: () => closeStaffModal(), onError: (e) => alert(e.message) },
      )
    }
  }
```

- [ ] **Step 3: Add the Phone field to the form**

In the JSX, add a Phone field after the Role/Joined row (after the `</div>` that closes the `flex` row containing Role and Joined, before the `m.mode === 'add'` block):

```tsx
      <div>
        <div style={modalFieldLabel}>Phone</div>
        <input
          value={phone}
          onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(false) }}
          placeholder="e.g. 012-345 6789"
          style={{ ...modalInput, borderColor: phoneError ? '#dc2626' : 'var(--border)' }}
        />
        {phoneError && (
          <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6 }}>Enter a valid phone number</div>
        )}
      </div>
```

- [ ] **Step 4: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Manually verify in the dev server**

Run: `npm run dev`. Open Add staff → type `12` in Phone → Create → expect the red "Enter a valid phone number" error and no save. Fix to `012-345 6789` → Create succeeds. Edit the staff → phone shows what was typed.

- [ ] **Step 6: Commit**

```bash
git add src/components/StaffModal.tsx
git -c user.email=cch340@gmail.com commit -m "feat: add validated phone field to staff modal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Shared WhatsAppButton component

**Files:**
- Create: `src/components/WhatsAppButton.tsx`

**Interfaces:**
- Consumes: `waUrl` (Task 1); `actionBtn` from `../theme`.
- Produces: `WhatsAppButton({ phone, compact }: { phone?: string; compact?: boolean })` — renders `null` when there is no usable number; otherwise a button that opens the wa.me link in a new tab.

- [ ] **Step 1: Create the component**

Create `src/components/WhatsAppButton.tsx`:

```tsx
import { waUrl } from '../data/whatsapp'
import { actionBtn } from '../theme'

const WA_GREEN = '#25D366'

/** Inline WhatsApp glyph (Material Symbols has no brand icon). */
function WhatsAppGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={WA_GREEN} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.004c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.8c2.16 0 4.19.84 5.72 2.37a8.05 8.05 0 0 1 2.37 5.73c0 4.46-3.63 8.09-8.1 8.09-1.5 0-2.97-.4-4.25-1.17l-.3-.18-3.13.82.83-3.05-.2-.31a8.06 8.06 0 0 1-1.24-4.3c0-4.46 3.63-8.09 8.1-8.09Zm-2.83 4.34c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66 0 .98.72 1.93.82 2.06.1.13 1.4 2.14 3.4 3 .48.2.85.33 1.14.42.48.15.92.13 1.26.08.39-.06 1.18-.48 1.35-.95.17-.47.17-.87.12-.95-.05-.08-.18-.13-.38-.23-.2-.1-1.18-.58-1.36-.65-.18-.07-.32-.1-.45.1-.13.2-.51.65-.63.78-.12.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.11-1.38-.12-.2-.01-.31.09-.41.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.09-.62-1.49-.16-.39-.33-.34-.45-.34-.12-.01-.25-.01-.38-.01Z" />
    </svg>
  )
}

export function WhatsAppButton({ phone, compact = false }: { phone?: string; compact?: boolean }) {
  const url = waUrl(phone ?? '')
  if (!url) return null
  return (
    <button
      type="button"
      title="Message on WhatsApp"
      aria-label="Message on WhatsApp"
      onClick={(e) => {
        e.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
      }}
      style={actionBtn()}
    >
      <WhatsAppGlyph />
      {!compact && 'WhatsApp'}
    </button>
  )
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `npm run build`
Expected: PASS. (The component is not yet used; TypeScript does not flag unused exports, and it will be consumed in Tasks 6–7.)

- [ ] **Step 3: Commit**

```bash
git add src/components/WhatsAppButton.tsx
git -c user.email=cch340@gmail.com commit -m "feat: add shared WhatsAppButton component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: WhatsApp button on Staff screen rows

**Files:**
- Modify: `src/screens/Staff.tsx`

**Interfaces:**
- Consumes: `WhatsAppButton` (Task 5); `Staff.phone` (Task 2).
- Produces: each staff row (desktop + mobile) shows a WhatsApp button when the staff has a phone.

- [ ] **Step 1: Import the button**

In `src/screens/Staff.tsx`, add near the imports:

```ts
import { WhatsAppButton } from '../components/WhatsAppButton'
```

- [ ] **Step 2: Include `phone` on the row view-model**

In the `rows` map, add `phone` to the returned object (after `role: s.role,`):

```ts
      role: s.role,
      phone: s.phone,
```

- [ ] **Step 3: Add the button to the desktop action group**

In the desktop table row's action `<div style={{ width: 200, ... }}>`, add the WhatsApp button as the first action (before the Edit button):

```tsx
                <div style={{ width: 200, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <WhatsAppButton phone={r.phone} compact />
                  <button
                    onClick={(e) => { e.stopPropagation(); openStaffModal({ mode: 'edit', id: r.id }) }}
                    style={actionBtn()}
                  >
```

- [ ] **Step 4: Add the button to the mobile action group**

In the mobile card's action row `<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, ... }}>`, add the WhatsApp button as the first child (before the Edit button that has `marginLeft: 'auto'`):

```tsx
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <WhatsAppButton phone={r.phone} compact />
                <button
                  onClick={(e) => { e.stopPropagation(); openStaffModal({ mode: 'edit', id: r.id }) }}
                  style={{ ...actionBtn(), marginLeft: 'auto' }}
                >
```

- [ ] **Step 5: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manually verify in the dev server**

Run: `npm run dev`. On the Staff screen: a staff with a phone shows a green WhatsApp button; one without shows none. Clicking opens `https://wa.me/<number>` in a new tab. Check both desktop and a narrow (mobile) viewport.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Staff.tsx
git -c user.email=cch340@gmail.com commit -m "feat: WhatsApp button on staff screen rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: WhatsApp button for staff on duty in Visit drawer

**Files:**
- Modify: `src/components/VisitDrawer.tsx:207-228` (the "Staff on duty" block)

**Interfaces:**
- Consumes: `WhatsAppButton` (Task 5); `staffForStore` (already imported); `openF.staffId`.
- Produces: the Visit drawer shows a WhatsApp button for the currently-assigned staff when that staff has a phone.

- [ ] **Step 1: Import the button**

In `src/components/VisitDrawer.tsx`, add near the imports:

```ts
import { WhatsAppButton } from './WhatsAppButton'
```

- [ ] **Step 2: Resolve the on-duty staff's phone**

After the existing `const storeStaff = staffForStore(data, openF.brandId, openF.outletId)` line, add:

```ts
  const onDutyPhone = storeStaff.find((st) => st.id === openF.staffId)?.phone
```

- [ ] **Step 3: Render the button in the "Staff on duty" row**

In the "Staff reassign" block, add the button after the staff chips, inside the same flex container (after the `storeStaff.length === 0 ? ... : (...)` expression, before the closing `</div>`):

```tsx
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>Staff on duty</span>
              {storeStaff.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>Unassigned</span>
              ) : (
                storeStaff.map((st) => (
                  <button
                    key={st.id}
                    onClick={() =>
                      updateVisit.mutate(
                        { visitId: openF.id, staffId: st.id },
                        { onError: (e) => alert(e.message) },
                      )
                    }
                    style={chip(openF.staffId === st.id)}
                  >
                    {st.name}
                  </button>
                ))
              )}
              <WhatsAppButton phone={onDutyPhone} compact />
            </div>
```

- [ ] **Step 4: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Manually verify in the dev server**

Run: `npm run dev`. Open a visit whose assigned staff has a phone → a green WhatsApp button appears next to the staff chips; switching to a staff without a phone hides it. Clicking opens the wa.me link.

- [ ] **Step 6: Commit**

```bash
git add src/components/VisitDrawer.tsx
git -c user.email=cch340@gmail.com commit -m "feat: WhatsApp button for on-duty staff in visit drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Run the full test suite: `npm test` — expect all pass (including `whatsapp.test.ts`).
- [ ] Run `npm run build` — expect a clean type-check + production build.
- [ ] Confirm `supabase/migrations/0013_staff_phone.sql` has been applied in Supabase so create/update with phone persists in the running app.
