/**
 * Tests de l'identité visuelle des projets.
 *
 * Une composition est du dessin : elle ne se vérifie pas par un test. Ce qui se
 * vérifie, c'est ce qui la casserait sans prévenir — un motif vide ou débordant
 * de son cadre, une couleur partagée par deux projets, une composition qui
 * change à chaque build, et surtout un fond de bandeau qui ne porterait plus le
 * texte blanc posé dessus.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANNER_COLS,
  BANNER_ROWS,
  bannerPanels,
  brickRows,
  paletteOf,
  type CoverMotif,
} from "../src/lib/project-cover.ts";
import { projects } from "../src/lib/content.ts";

const MOTIFS: CoverMotif[] = ["graph", "routine", "series", "corpus"];
/** Les deux cadres réels : la vignette des cartes, le motif large. */
const FRAMES = [
  { cols: 30, rows: 22 },
  { cols: 72, rows: 20 },
];

const channel = (v: number) =>
  v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const luminance = ([r, g, b]: number[]) =>
  0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const blend = (fg: number[], bg: number[], alpha: number) =>
  fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
const contrast = (a: number[], b: number[]) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

describe("identité visuelle des projets", () => {
  it("donne un motif et une couleur distincts à chaque projet", () => {
    const used = projects.map((project) => project.motif);
    assert.equal(new Set(used).size, projects.length, "deux projets partagent le même motif");
    const banners = used.map((motif) => paletteOf(motif).banner);
    assert.equal(new Set(banners).size, projects.length, "deux projets partagent la même couleur");
  });

  it("porte le texte blanc du bandeau, même au point le plus clair", () => {
    // Le titre est posé sur le bandeau. Les panneaux l'éclaircissent par
    // endroits : le contraste doit tenir là, pas en moyenne. Le pire cas est le
    // recouvrement de deux voiles, soit environ 18 % de blanc.
    const white = [255, 255, 255];
    for (const motif of MOTIFS) {
      const worst = blend(white, parse(paletteOf(motif).banner), 0.18);
      const ratio = contrast(white, worst);
      assert.ok(ratio >= 4.5, `${motif} ne tient que ${ratio.toFixed(2)}:1 sous le blanc`);
    }
  });

  it("garde les voiles du bandeau discrets", () => {
    for (const motif of MOTIFS) {
      const panels = bannerPanels({ motif, seed: 1187 });
      assert.ok(panels.length >= 8, `${motif} ne pose que ${panels.length} panneaux`);
      for (const panel of panels) {
        assert.ok(
          Math.abs(panel.tint) <= 0.12,
          `voile trop marqué : ${panel.tint}`,
        );
        assert.ok(panel.w > 0 && panel.h > 0, "panneau vide");
        assert.ok(
          panel.x < BANNER_COLS && panel.y < BANNER_ROWS,
          "panneau hors du cadre",
        );
      }
    }
  });

  it("remplit la vignette sans déborder", () => {
    for (const motif of MOTIFS) {
      for (const frame of FRAMES) {
        const bricks = brickRows({ motif, seed: 4242, ...frame });
        const covered = bricks.reduce((total, brick) => total + brick.w, 0);
        const share = covered / (frame.cols * frame.rows);
        assert.ok(
          share > 0.3 && share < 0.85,
          `${motif} couvre ${(share * 100) | 0} % de la vignette`,
        );
        const lines = new Set(bricks.map((brick) => brick.y));
        assert.equal(lines.size, frame.rows, `${motif} laisse une rangée vide`);
        for (const brick of bricks) {
          assert.ok(brick.x >= 0 && brick.x + brick.w <= frame.cols, "barre hors cadre");
          assert.ok(brick.y >= 0 && brick.y < frame.rows, "rangée hors cadre");
        }
      }
    }
  });

  it("est identique d'un appel à l'autre", () => {
    // Sans graine, la vignette d'un projet changerait à chaque déploiement.
    for (const motif of MOTIFS) {
      const options = { motif, seed: 5023, ...FRAMES[0] };
      assert.deepEqual(brickRows(options), brickRows(options));
      assert.deepEqual(bannerPanels({ motif, seed: 5023 }), bannerPanels({ motif, seed: 5023 }));
    }
  });
});
