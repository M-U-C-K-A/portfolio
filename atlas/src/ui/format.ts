export const fmtInt = (v: number): string => Math.round(v).toLocaleString('fr-FR');

export function fmtPop(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2).replace('.', ',')} Md`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} k`;
  return fmtInt(v);
}

export function fmtArea(km2: number): string {
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(1).replace('.', ',')} M km²`;
  return `${fmtInt(km2)} km²`;
}
