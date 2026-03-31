

# Add Subtle Gold Gradient Orb to Background

## Change

**`src/pages/Home.tsx`** — Add a large, soft radial gold gradient orb positioned in the bottom-left corner of the page background. This will be a purely decorative `div` with:

- `absolute` positioning, anchored bottom-left
- Large size (~600-800px)
- Radial gradient using the cream-gold primary color at very low opacity (~8-12%)
- Blur applied for a soft, diffused glow
- `pointer-events-none` and `z-0` so it doesn't interfere with content

The outer wrapper `div` gets `relative overflow-hidden` to contain the orb, and the content stays at `z-10`.

```html
<!-- Decorative orb -->
<div class="pointer-events-none absolute -bottom-32 -left-32 w-[700px] h-[700px] 
  rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.10)_0%,transparent_70%)]" />
```

