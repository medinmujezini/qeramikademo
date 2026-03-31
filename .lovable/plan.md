

# Black & Gold Theme

## Changes

### `src/index.css` — CSS Variables (lines 10-95)

Replace the blue-based HSL palette with black & gold:

| Token | Current (blue) | New (gold) |
|---|---|---|
| `--background` | `222 47% 11%` | `0 0% 4%` (near-black) |
| `--foreground` | `210 40% 98%` | `0 0% 95%` (off-white) |
| `--card` | `223 47% 14%` | `0 0% 8%` (dark card) |
| `--card-foreground` | `210 40% 98%` | `0 0% 95%` |
| `--popover` | `223 47% 14%` | `0 0% 8%` |
| `--primary` | `217 91% 60%` | `43 96% 56%` (rich gold) |
| `--primary-foreground` | `0 0% 100%` | `0 0% 5%` (dark text on gold) |
| `--secondary` | `217 33% 17%` | `0 0% 12%` |
| `--muted` | `217 33% 17%` | `0 0% 12%` |
| `--muted-foreground` | `215 20% 65%` | `0 0% 55%` |
| `--accent` | `217 33% 20%` | `43 50% 18%` (dark gold) |
| `--accent-foreground` | `210 40% 98%` | `43 80% 70%` (light gold) |
| `--border` | `217 33% 20%` | `0 0% 15%` |
| `--input` | `217 33% 20%` | `0 0% 15%` |
| `--ring` | `217 91% 60%` | `43 96% 56%` |
| `--neon-glow` | blue | `43 96% 60%` |
| `--neon-glow-intense` | blue | `43 100% 65%` |
| `--warning` | `38 92% 50%` | `20 90% 50%` (amber-orange, distinct from gold) |
| sidebar tokens | blue variants | matching gold/black variants |

Apply same changes to `.dark` block and update `.light` block primary to gold as well.

### `tailwind.config.ts`

No structural changes needed — it references CSS variables.

### Files with hardcoded blue references

Quick search for any hardcoded `#3B82F6` or `blue-` classes in components — replace with `primary` token usage if found.

## Result

Deep black backgrounds with gold accents on all buttons, links, active states, borders, and highlights across every page.

