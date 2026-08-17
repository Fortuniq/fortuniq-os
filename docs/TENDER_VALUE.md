# Tender Value Field

## The bug

The Value (ZAR) input in the Add/Edit Tender form had `step={1000}` on a
`type="number"` input. HTML's native number-input validation requires
the entered value to be `min + n × step` — with `min=0` and `step=1000`,
only exact multiples of 1000 (1000, 2000, 3000...) passed browser
validation. Any real tender value with cents, or any whole number not
divisible by 1000 (387958, 458.65, 12567.90), triggered the browser's
native "Please enter a valid value" error and silently blocked
submission.

## The fix

- `step="0.01"` — the correct increment for currency to the cent,
  matching the `numeric(14,2)` database column exactly. This still
  blocks genuinely invalid input (three decimal places, for instance)
  while accepting any real Rand-and-cents amount.
- The database column was already `numeric(14, 2)` — see
  `schema.sql` — so no migration was needed; the precision was always
  there, only the input was blocking it from ever reaching the database.
- Server-side validation (`parseTenderValue()` in `tender-actions.ts`)
  is the real enforcement point, not the HTML attributes — it rejects
  negative values and non-numeric input with a clear thrown error,
  independent of whatever the browser does or doesn't block. HTML
  `min`/`step` are a UX nicety on top of that, not the actual guarantee.
- A live-updating formatted preview (`formatZARFull()`, e.g.
  "R387,958.00") appears under the field as the person types, without
  changing what's actually submitted — the raw number is what's typed
  and what's stored.

## Display

- `formatZARFull()` (new, in `src/lib/format.ts`) — always 2 decimal
  places with thousands separators, e.g. `R458.65`, `R387,958.00`,
  `R125,000,000.50`. Used on the tender detail page and the Add/Edit
  form's live preview, since these are the places the exact stored
  value matters most.
- `formatZARCompact()` / `formatZAR()` (existing, unchanged) are still
  used in the Tender Register list column and summary stat cards —
  compact "R4.2M"-style formatting is a deliberate, separate UX choice
  for scannable list/summary views, not a precision bug. The underlying
  numbers behind those compact displays are never rounded — only the
  display string is abbreviated.

## Editing existing tenders

The form initialises from `tender.value` exactly as fetched from the
database (`Number(t.value)` in `data.ts` — a numeric-to-number
conversion, not a rounding one). Opening and re-saving a tender without
touching the Value field submits that same number back unchanged.

## Precision guarantee

`Number(t.value)` on a Postgres `numeric` column preserves full
decimal precision within JS's safe range (well beyond any realistic
tender value) — nothing here rounds to a coarser increment. The only
place a value is ever rounded is `parseTenderValue()`'s
`Math.round(parsed * 100) / 100`, which rounds to the cent (matching
the `numeric(14,2)` column) — not to the nearest thousand or any other
coarse unit like the original bug did.
