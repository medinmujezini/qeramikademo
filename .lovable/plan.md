

# Add Gradient Orbs to Headers

## Changes

### `src/pages/Home.tsx` (line 13)
Add a gradient orb inside the `<header>` element. The header already has `sticky top-0 z-50` — add `relative overflow-hidden` and insert a decorative orb div:

```html
<header className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-50 relative overflow-hidden">
  <div className="pointer-events-none absolute -top-20 -right-32 w-[400px] h-[200px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.08)_0%,transparent_70%)]" />
  <!-- existing content -->
</header>
```

### `src/pages/EndUserPlatform.tsx` (line 43)
Same treatment for the Design Studio header — add `overflow-hidden` and insert a gradient orb:

```html
<header className="... relative z-10 overflow-hidden">
  <div className="pointer-events-none absolute -top-16 -right-24 w-[350px] h-[180px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.08)_0%,transparent_70%)]" />
  <!-- existing content -->
</header>
```

### `src/components/admin/AdminLayout.tsx` (top bar, line ~102)
Add the same orb to the admin top bar header for consistency.

## Files

| File | Change |
|---|---|
| `src/pages/Home.tsx` | Gold gradient orb in header |
| `src/pages/EndUserPlatform.tsx` | Gold gradient orb in header |
| `src/components/admin/AdminLayout.tsx` | Gold gradient orb in top bar |

