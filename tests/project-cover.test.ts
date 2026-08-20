/**
 * Tests des couvertures génératives.
 *
 * Une couverture est du dessin : elle ne peut pas être vérifiée par un test.
 * Ce qui peut l'être, c'est ce qui la rendrait invisible sans prévenir — un
 * champ vide, un ton hors rampe, une composition qui change à chaque build, ou
 * deux projets qui finissent par se ressembler.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COVER_TONES,
  coverCells,
  coverRuns,
  type CoverMotif,
} from "../src/lib/project-cover.ts";
import { projects } from "../src/lib/content.ts";

const MOTIFS: CoverMotif[] = ["graph", "routine", "series", "corpus"];
/** Les deux cadres réels : le bandeau du cas d'étude, la vignette des cartes. */
const FRAMES = [
  { cols: 72, rows: 20 },
  { cols: 30, rows: 22 },
];

describe("couvertures des projets", () => {
  it("donne un motif distinct à chaque projet", () => {
    const used = projects.map((project) => project.motif);
    assert.equal(
      new Set(used).size,
      projects.length,
      "deux projets partagent le même motif",
    );
  });

  it("est identique d'un appel à l'autre", () => {
    // Sans graine, la couverture d'un projet changerait à chaque déploiement.
    for (const motif of MOTIFS) {
      const options = { motif, seed: 1187, ...FRAMES[0] };
      assert.deepEqual(coverCells(options), coverCells(options));
    }
  });

  it("remplit chaque cadre sans le saturer", () => {
    for (const motif of MOTIFS) {
      for (const frame of FRAMES) {
        const cells = coverCells({ motif, seed: 4242, ...frame });
        const fill = cells.length / (frame.cols * frame.rows);
        assert.ok(
          fill > 0.08 && fill < 0.75,
          `${motif} en ${frame.cols}×${frame.rows} remplit ${(fill * 100) | 0} %`,
        );
      }
    }
  });

  it("reste dans la rampe et dans le cadre", () => {
    for (const motif of MOTIFS) {
      const frame = FRAMES[0];
      for (const cell of coverCells({ motif, seed: 77, ...frame })) {
        assert.ok(
          cell.tone >= 0 && cell.tone < COVER_TONES.length,
          `ton hors rampe : ${cell.tone}`,
        );
        assert.ok(cell.col >= 0 && cell.col < frame.cols, `colonne ${cell.col}`);
        assert.ok(cell.row >= 0 && cell.row < frame.rows, `rangée ${cell.row}`);
      }
    }
  });

  it("garde l'accent rare", () => {
    // L'accent ne se déclenche qu'aux moments qui portent le sens : noyé dans
    // la composition, il devient une seconde couleur et la rampe perd son rôle.
    for (const motif of MOTIFS) {
      const cells = coverCells({ motif, seed: 909, ...FRAMES[0] });
      const accent = cells.filter((cell) => cell.tone === 5).length;
      assert.ok(
        accent / cells.length < 0.12,
        `${motif} pose ${((accent / cells.length) * 100) | 0} % d'accent`,
      );
    }
  });

  it("fusionne les voisines de même ton", () => {
    // Un rectangle par cellule ferait des dizaines de milliers de nœuds sur la
    // page d'accueil, qui porte quatre couvertures.
    for (const motif of MOTIFS) {
      const options = { motif, seed: 31, ...FRAMES[0] };
      const cells = coverCells(options);
      const runs = coverRuns(options);
      assert.ok(runs.length <= cells.length, "plus de rectangles que de cellules");
      assert.equal(
        runs.reduce((total, run) => total + run.length, 0),
        cells.length,
        "des cellules ont été perdues à la fusion",
      );
    }
  });
});
