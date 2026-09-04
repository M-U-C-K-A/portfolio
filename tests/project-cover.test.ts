/**
 * Tests des couvertures génératives.
 *
 * Une composition est du dessin : elle ne se vérifie pas par un test. Ce qui se
 * vérifie, c'est ce qui la casserait sans prévenir — un découpage qui laisse un
 * trou ou empile deux tuiles, une couleur qui envahit tout, un aplat sombre de
 * la taille du cadre, ou une composition qui change à chaque build.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coverTiles,
  coverTones,
  type CoverMotif,
} from "../src/lib/project-cover.ts";
import { projects } from "../src/lib/content.ts";

const MOTIFS: CoverMotif[] = ["graph", "routine", "series", "corpus"];
/** Les deux cadres réels : le bandeau du cas d'étude, la vignette des cartes. */
const FRAMES = [
  { cols: 72, rows: 20 },
  { cols: 30, rows: 22 },
];
/** Index du premier ton coloré dans la rampe. */
const FIRST_HUE = 5;

describe("couvertures des projets", () => {
  it("donne un motif et une couleur distincts à chaque projet", () => {
    const used = projects.map((project) => project.motif);
    assert.equal(
      new Set(used).size,
      projects.length,
      "deux projets partagent le même motif",
    );
    const hues = used.map((motif) => coverTones(motif).slice(FIRST_HUE).join());
    assert.equal(new Set(hues).size, projects.length, "deux projets partagent la même couleur");
  });

  it("est identique d'un appel à l'autre", () => {
    // Sans graine, la couverture d'un projet changerait à chaque déploiement.
    for (const motif of MOTIFS) {
      const options = { motif, seed: 1187, ...FRAMES[0] };
      assert.deepEqual(coverTiles(options), coverTiles(options));
    }
  });

  it("pave le cadre exactement, sans trou ni recouvrement", () => {
    for (const motif of MOTIFS) {
      for (const frame of FRAMES) {
        const tiles = coverTiles({ motif, seed: 4242, ...frame });
        const seen = new Uint8Array(frame.cols * frame.rows);
        for (const tile of tiles) {
          assert.ok(tile.w > 0 && tile.h > 0, `tuile vide en ${tile.x},${tile.y}`);
          assert.ok(
            tile.x >= 0 && tile.y >= 0 &&
              tile.x + tile.w <= frame.cols &&
              tile.y + tile.h <= frame.rows,
            `tuile hors cadre en ${tile.x},${tile.y}`,
          );
          for (let y = tile.y; y < tile.y + tile.h; y++) {
            for (let x = tile.x; x < tile.x + tile.w; x++) {
              const at = y * frame.cols + x;
              assert.equal(seen[at], 0, `cellule ${x},${y} couverte deux fois`);
              seen[at] = 1;
            }
          }
        }
        assert.ok(
          seen.every((cell) => cell === 1),
          `${motif} laisse des cellules découvertes en ${frame.cols}×${frame.rows}`,
        );
      }
    }
  });

  it("découpe assez fin pour faire une mosaïque", () => {
    for (const motif of MOTIFS) {
      for (const frame of FRAMES) {
        const tiles = coverTiles({ motif, seed: 77, ...frame });
        assert.ok(tiles.length > 25, `${motif} ne fait que ${tiles.length} tuiles`);
        const biggest = Math.max(...tiles.map((tile) => tile.w * tile.h));
        assert.ok(
          biggest < (frame.cols * frame.rows) / 6,
          `${motif} laisse un bloc de ${biggest} cellules`,
        );
      }
    }
  });

  it("colore sans envahir", () => {
    // La couleur distingue le projet ; elle ne doit pas devenir le fond, sans
    // quoi la composition cesse d'appartenir au reste du site.
    for (const motif of MOTIFS) {
      const frame = FRAMES[0];
      const tiles = coverTiles({ motif, seed: 909, ...frame });
      const colored = tiles
        .filter((tile) => tile.tone >= FIRST_HUE)
        .reduce((total, tile) => total + tile.w * tile.h, 0);
      const share = colored / (frame.cols * frame.rows);
      assert.ok(
        share > 0.04 && share < 0.45,
        `${motif} couvre ${(share * 100) | 0} % de couleur`,
      );
    }
  });

  it("garde les tons dans la rampe et les grands aplats clairs", () => {
    for (const motif of MOTIFS) {
      const frame = FRAMES[0];
      const limit = (frame.cols * frame.rows) / 26;
      for (const tile of coverTiles({ motif, seed: 31, ...frame })) {
        assert.ok(
          tile.tone >= 0 && tile.tone < coverTones(motif).length,
          `ton hors rampe : ${tile.tone}`,
        );
        // Un aplat d'encre de cette taille écrase toute la composition.
        if (tile.w * tile.h > limit * 2.5 && tile.tone < FIRST_HUE) {
          assert.ok(tile.tone >= 2, `grand aplat trop sombre (ton ${tile.tone})`);
        }
      }
    }
  });
});
