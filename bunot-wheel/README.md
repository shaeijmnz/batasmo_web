# Bunot Wheel

Standalone color wheel app para sa bunot — hiwalay sa BatasMo.

## Paano buksan

Kailangan ng local server dahil gumagamit ng ES modules:

```bash
cd bunot-wheel
npx serve .
```

Buksan ang URL na ibibigay (karaniwang `http://localhost:3000`).

O kung may Python:

```bash
cd bunot-wheel
python3 -m http.server 8080
```

Tapos buksan `http://localhost:8080`.

## Paano gamitin

1. **Entries tab** — nakalista ang lahat ng names sa wheel (isang name bawat line).
2. **Click to spin** o `Ctrl+Enter` / `Cmd+Enter` — mag-spin ang wheel.
3. Ang winner ay **tatanggalin sa wheel** at **lalabas sa Results tab**.
4. Uulitin hanggang maubos ang draw sequence.

## Paano i-update ang names at sequence ng bunot

I-edit ang [`js/config.js`](js/config.js):

```js
export const WHEEL_NAMES = [
  'Juan',
  'Maria',
  // ... hanggang 100 names
];

// Order ng bunot — spin 1 = unang item, spin 2 = pangalawa, etc.
export const DRAW_SEQUENCE = [
  'Maria',
  'Juan',
  // ... 100 names sa gusto mong order
];
```

- `WHEEL_NAMES` — lahat ng names na lalabas sa wheel.
- `DRAW_SEQUENCE` — predetermined order ng bunot (ikaw ang magdedikta kung sino ang ma-bubunot sa bawat spin).

Pagkatapos i-save, i-refresh ang browser.

## Notes

- Pag nagsimula na ang spin, hindi na pwedeng i-edit ang entries o mag-shuffle/sort.
- Shuffle at Sort — gamitin **bago** ang unang spin kung gusto mong baguhin ang order sa wheel.
- Maximum: 100 entries (pwedeng dagdagan sa code kung kailangan).
