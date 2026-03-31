

# Fix White Popup Backgrounds — Dark Luxury Theme

## Changes

Apply identical dark luxury styling to all three components:

### Shared pattern (replacing current white glass)

- **Background**: `bg-card/95 backdrop-blur-xl` (replaces `bg-[hsl(0_0%_100%/0.85-0.9)]`)
- **Shadows**: `[box-shadow:0_8px_32px_0_hsl(0_0%_0%/0.4),0_0_20px_0_hsl(38_60%_68%/0.06),inset_0_1px_0_0_hsl(38_60%_68%/0.1),inset_0_0_0_1px_hsl(38_60%_68%/0.08)]`
- **Shine**: `via-white` → `via-primary/15`
- **Corners**: `rounded-2xl` → `rounded-none`

### Per-file specifics

| File | What changes |
|---|---|
| `src/components/ui/dialog.tsx` | DialogContent: bg, shadow, corners, remove glass tint div, gold shine |
| `src/components/ui/popover.tsx` | PopoverContent: bg, shadow, corners, gold shine |
| `src/components/ui/dropdown-menu.tsx` | DropdownMenuContent + DropdownMenuSubContent: bg, shadow, corners, gold shine |

### `src/components/ui/dialog.tsx`
- Line ~42: Replace `bg-[hsl(0_0%_100%/0.85)]` with `bg-card/95`
- Line ~43: `rounded-2xl` → `rounded-none`
- Line ~45-46: Replace white/blue box-shadow with gold-tinted dark shadow
- Line ~53: Remove the glass tint div (`bg-[hsl(217_91%_60%/0.02)]`)
- Line ~51: Change shine `via-white` → `via-primary/15`

### `src/components/ui/popover.tsx`
- Line ~20: Replace `bg-[hsl(0_0%_100%/0.9)]` with `bg-card/95`
- Line ~20: `rounded-2xl` → `rounded-none`
- Line ~22: Replace white/blue box-shadow with gold-tinted dark shadow
- Line ~30: Change shine `via-white` → `via-primary/15`

### `src/components/ui/dropdown-menu.tsx`
- DropdownMenuSubContent (~line 49): Same bg, shadow, corners, shine changes
- DropdownMenuContent (~line 75): Same bg, shadow, corners, shine changes

