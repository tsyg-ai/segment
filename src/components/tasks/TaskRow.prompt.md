One task in the Lijst view: checkbox · position · title (14px, truncated) · deadline chip (12px) · status pill (12px).

```jsx
<TaskRow position={3} title="Verslag intakegesprek afwerken" deadline="3 dagen te laat"
  deadlineTone="late" status="busy" statusLabel="Bezig" selected />
```

Rows stack inside a `<Card>`; the last one gets `divider={false}`. Titles never wrap — the detail panel is where the full text lives.
