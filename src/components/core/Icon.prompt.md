Lucide icon, inline SVG, inherits `currentColor`. The only icon set — no other SVG, no emoji, no typographic stand-ins.

```jsx
<Icon name="chevron-down" size={13} />        {/* keuzelijst / dropdown */}
<Icon name="x" size={15} label="Sluiten" />   {/* label = only icon, no text beside it */}
```

Stroke is derived from size (`38 / size`, clamped 1.5–3) so every icon reads as the same ~1.6px line. Sizes: 13 in chips/pills/xs buttons, 16 default, 18 in `lg` buttons and `IconButton`. Icons double a Dutch label; the only label-free icons are the keuzelijst chevron, the checkbox check, `x` and `ellipsis`.
