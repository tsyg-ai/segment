Standard action button — one radius (`--radius`), never a full pill.

**Eén maat voor alle knoppen.** Hoogte 32px, 13.5px, weight 700, padding 0 14px. Alleen de *kleur* verschilt per variant — nooit de maat, de tekstgrootte of het gewicht.

De enige uitzondering is `size="major"`: de hoofdactie van een scherm ("Nieuwe taak", "Naar alle taken", de bevestigingsknop onderaan een dialoog). Hoogte 42px, 15px. Maximaal één per scherm.

```jsx
<Button variant="primary" size="major" icon="plus">Nieuwe taak</Button>
<Button variant="secondary" icon="arrow-up-narrow-wide">Sorteren: Stap</Button>
<Button variant="tinted" icon="layout-list" iconEnd="chevron-down">Groeperen: Project</Button>
```

`primary` is the single teal call to action per view. `tinted` marks an *active* filter/group control. `toolbar` and `danger` only appear inside `BulkBar`. `dashed` is the "add another" affordance.

`icon` and `iconEnd` take Lucide names (`Icon`), never characters. `iconEnd` is always `chevron-down`: it marks a button that opens a keuzelijst.

Icon-only knoppen (`IconButton`) zijn altijd 32 × 32.
