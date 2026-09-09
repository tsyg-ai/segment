/**
 * Afgeleide tinten van een opgeslagen hex-kleur (status- of projectkleur).
 * De app kent één licht thema, dus tinten worden simpelweg met wit gemengd;
 * de tekstkleur wordt iets verdonkerd zodat ook de lichtste rampkleuren
 * leesbaar blijven op hun eigen achtergrond.
 */

export interface Tint {
  /** Tekst-/icoonkleur. */
  color: string;
  /** Zachte vlakvulling. */
  background: string;
  /** Randkleur, iets sterker dan de vulling. */
  borderColor: string;
}

/** `#rgb` / `#rrggbb` → kanalen, of `null` als het geen hex is. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const raw = m[1];
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Meng richting zwart (`amount` 0..1) — houdt bleke rampkleuren leesbaar. */
function darken(c: { r: number; g: number; b: number }, amount: number) {
  const f = 1 - amount;
  return `rgb(${Math.round(c.r * f)}, ${Math.round(c.g * f)}, ${Math.round(c.b * f)})`;
}

/** Relatieve luminantie (WCAG), gebruikt om bleke kleuren extra te verdonkeren. */
function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/**
 * Pill-/chiptinten voor een entiteitskleur. `null` bij een onleesbare waarde,
 * zodat de aanroeper op de neutrale tokens kan terugvallen.
 */
export function tintFromHex(hex: string | null | undefined): Tint | null {
  if (!hex) return null;
  const c = hexToRgb(hex);
  if (!c) return null;
  // Bleke rampkleuren (grijs, zand) hebben meer verdonkering nodig dan de
  // verzadigde functionele kleuren om op hun eigen tint te blijven contrasteren.
  const l = luminance(c);
  const amount = l > 0.45 ? 0.5 : l > 0.28 ? 0.32 : 0.12;
  return {
    color: darken(c, amount),
    background: `rgba(${c.r}, ${c.g}, ${c.b}, 0.14)`,
    borderColor: `rgba(${c.r}, ${c.g}, ${c.b}, 0.42)`,
  };
}
