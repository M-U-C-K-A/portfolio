/**
 * Tests du champ de pixels de l'image de partage.
 *
 * La vignette n'est rendue qu'au build, et personne ne la regarde ensuite :
 * une dérive de paramètre s'y installerait sans bruit. Deux propriétés
 * comptent — que le champ ne se vide pas, et qu'il laisse les textes lisibles.
 * La seconde est invisible à la relecture du code, puisqu'elle tient à la
 * rencontre d'une courbe et de quatre rectangles.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CELL, HEIGHT, KEEP_OUT, WIDTH, waveCells, waveSvg } from "../src/lib/og-wave.ts";
import { PIXEL_PALETTE } from "../src/lib/pixel-engine.ts";

/** Le fond de la vignette, sur lequel les cellules se composent. */
const PAPER = [250, 250, 248];

function luminanceOverPaper(tone: number, alpha: number) {
  const hex = PIXEL_PALETTE[tone];
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = rgb.map((v, i) => v * alpha + PAPER[i] * (1 - alpha));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const overlapping = (box: (typeof KEEP_OUT)[number]) =>
  waveCells().filter(
    (c) =>
      c.left + CELL > box.x0 &&
      c.left < box.x1 &&
      c.top + CELL > box.y0 &&
      c.top < box.y1,
  );

describe("champ de la vignette", () => {
  it("est identique d'un appel à l'autre", () => {
    // Le tirage est semé : sans cela la vignette changerait à chaque
    // déploiement, pour rien.
    assert.deepEqual(waveCells(), waveCells());
  });

  it("couvre la page sans la saturer", () => {
    const cells = waveCells();
    assert.ok(
      cells.length > 250 && cells.length < 520,
      `${cells.length} cellules allumées, hors de la fourchette attendue`,
    );
    for (const c of cells) {
      assert.ok(c.left > -CELL && c.left < WIDTH, `x hors cadre : ${c.left}`);
      assert.ok(c.top > -CELL && c.top < HEIGHT, `y hors cadre : ${c.top}`);
    }
  });

  it("laisse les petits textes sur du presque blanc", () => {
    // Le titre pèse 132 px : il supporte un fond. La ville, le rôle et le
    // domaine sont en 22 et 26 px gris — derrière eux, il ne doit rien rester.
    for (const box of KEEP_OUT.slice(1)) {
      for (const cell of overlapping(box)) {
        const l = luminanceOverPaper(cell.tone, cell.alpha);
        assert.ok(l > 200, `cellule trop sombre (${l.toFixed(0)}) en ${cell.left},${cell.top}`);
      }
    }
  });

  it("laisse le titre lisible", () => {
    for (const cell of overlapping(KEEP_OUT[0])) {
      const l = luminanceOverPaper(cell.tone, cell.alpha);
      assert.ok(l > 170, `cellule trop sombre (${l.toFixed(0)}) sous le titre`);
    }
  });

  it("garde l'accent groupé et rare", () => {
    const accent = waveCells().filter((c) => c.tone === 5);
    assert.ok(
      accent.length >= 3 && accent.length <= 20,
      `${accent.length} cellules d'accent`,
    );
    const xs = accent.map((c) => c.left);
    const spread = Math.max(...xs) - Math.min(...xs);
    assert.ok(spread < 280, `l'accent s'étale sur ${spread} px au lieu de tenir en traînée`);
  });

  it("produit un SVG aux dimensions de la vignette", () => {
    const svg = waveSvg();
    assert.match(svg, /^<svg [^>]*viewBox="0 0 1200 630"/);
    assert.equal(svg.match(/<rect /g)?.length, waveCells().length);
  });
});
