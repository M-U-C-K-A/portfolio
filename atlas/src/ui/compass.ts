/** Rose des vents à 16 branches, style cartes anciennes (or, ivoire, encre). */
export function compassSvg(): string {
  const c = 100;
  const ray = (angle: number, len: number, width: number, light: string, dark: string): string => {
    const a = (angle * Math.PI) / 180;
    const tip = [c + Math.sin(a) * len, c - Math.cos(a) * len];
    const l = [c + Math.sin(a - Math.PI / 2) * width, c - Math.cos(a - Math.PI / 2) * width];
    const r = [c + Math.sin(a + Math.PI / 2) * width, c - Math.cos(a + Math.PI / 2) * width];
    const f = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    return `<polygon points="${f([c, c])} ${f(tip)} ${f(l)}" fill="${light}"/><polygon points="${f([c, c])} ${f(tip)} ${f(r)}" fill="${dark}"/>`;
  };
  let rays = '';
  for (let i = 0; i < 8; i++) rays += ray(22.5 + i * 45, 46, 5, '#e9dcb4', '#8a6a2c');
  for (let i = 0; i < 4; i++) rays += ray(45 + i * 90, 62, 8, '#f3e6c0', '#6b5222');
  for (let i = 0; i < 4; i++) rays += ray(i * 90, 88, 11, i === 0 ? '#f7eccb' : '#efe2b8', i === 0 ? '#9c2a22' : '#3b2e18');
  let ticks = '';
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r0 = i % 4 === 0 ? 63 : 66, r1 = 70;
    ticks += `<line x1="${(c + Math.sin(a) * r0).toFixed(1)}" y1="${(c - Math.cos(a) * r0).toFixed(1)}" x2="${(c + Math.sin(a) * r1).toFixed(1)}" y2="${(c - Math.cos(a) * r1).toFixed(1)}"/>`;
  }
  const letter = (t: string, x: number, y: number) => `<text x="${x}" y="${y}">${t}</text>`;
  return `<svg viewBox="0 0 200 200" width="100%" height="100%">
  <defs><radialGradient id="cr-bg" r="0.5"><stop offset="0.6" stop-color="#1a1610" stop-opacity="0.55"/><stop offset="1" stop-color="#1a1610" stop-opacity="0"/></radialGradient></defs>
  <circle cx="100" cy="100" r="96" fill="url(#cr-bg)"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="#c9a24a" stroke-width="1.6"/>
  <circle cx="100" cy="100" r="62" fill="none" stroke="#c9a24a" stroke-width="0.8" opacity="0.8"/>
  <g stroke="#c9a24a" stroke-width="0.9">${ticks}</g>
  <g stroke="#1b140a" stroke-width="0.7" stroke-linejoin="round">${rays}</g>
  <circle cx="100" cy="100" r="7" fill="#c9a24a" stroke="#1b140a" stroke-width="1"/><circle cx="100" cy="100" r="3" fill="#9c2a22"/>
  <g font-family="Cinzel, Georgia, serif" font-weight="700" font-size="17" fill="#f3e6c0" stroke="#1b140a" stroke-width="3" paint-order="stroke" text-anchor="middle">
    ${letter('N', 100, 9 + 6)}${letter('S', 100, 199)}${letter('E', 192, 106)}${letter('O', 8, 106)}
  </g>
</svg>`;
}
