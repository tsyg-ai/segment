One label/value pair inside the detail panel's Kenmerken grid. Render several inside a `display:grid; grid-template-columns:auto 1fr; gap:9px 14px` wrapper.

```jsx
<div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "9px 14px", alignItems: "center" }}>
  <FieldRow label="Deadline" tone="today" onClick={editDeadline}>vr 29 aug, 14:00</FieldRow>
  <FieldRow label="Prioriteit">Normaal</FieldRow>
</div>
```
