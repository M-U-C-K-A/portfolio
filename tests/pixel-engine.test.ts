/**
 * Tests du moteur de grille de pixels.
 *
 * Le moteur ne dépend ni de React ni du DOM au-delà d'un contexte 2D : on lui
 * fournit un contexte enregistreur et on avance la simulation à la main, ce
 * qui rend le rendu vérifiable sans navigateur.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PixelEngine, type PixelMotif } from "../src/lib/pixel-engine.ts";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function makeCanvas() {
  const rects: Rect[] = [];
  let fillStyle = "";
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    setTransform() {},
    clearRect() {
      rects.length = 0;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: fillStyle });
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { canvas, rects };
}

/** Avance la simulation de `frames` images puis peint. */
function run(engine: PixelEngine, frames: number, rects: Rect[], cell: number) {
  const step = (engine as unknown as { step(dt: number): void }).step.bind(
    engine,
  );
  for (let i = 0; i < frames; i++) step(16.7);
  engine.paint();
  const cells = rects.reduce((sum, r) => sum + (r.w / cell) * (r.h / cell), 0);
  return { cells, rects: rects.length };
}

const CELL = 8;

describe("PixelEngine", () => {
  it("atteint une densité stable au repos", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, { cell: CELL, spawn: 6, seed: 7 });
    engine.resize(1280, 500, 1);

    const { cells } = run(engine, 400, rects, CELL);
    assert.ok(
      cells > 30 && cells < 160,
      `densité hors plage : ${cells} cellules allumées`,
    );
  });

  it("remplit un disque au clic, dans la palette attendue", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, { cell: CELL, spawn: 6, seed: 7 });
    engine.resize(1280, 500, 1);
    run(engine, 60, rects, CELL);

    engine.blast(640, 250);
    const after = run(engine, 55, rects, CELL);

    const reach = 1280 * 0.42;
    const discCells = (Math.PI * reach * reach) / (CELL * CELL);
    assert.ok(
      after.cells > discCells * 0.25,
      `explosion trop faible : ${after.cells} cellules`,
    );

    const accentArea = rects
      .filter((r) => r.fill === "#1d3fff")
      .reduce((sum, r) => sum + r.w * r.h, 0);
    const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    assert.ok(
      accentArea / totalArea > 0.5,
      `l’accent doit dominer l’explosion (${Math.round((100 * accentArea) / totalArea)}%)`,
    );
  });

  it("remplit franchement le cœur du disque", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, {
      cell: CELL,
      spawn: 0,
      seed: 7,
      blastReach: 0.3,
    });
    engine.resize(1280, 500, 1);
    engine.blast(640, 250);
    run(engine, 54, rects, CELL);

    // L'érosion par l'amas doit rester cantonnée au pourtour : appliquée
    // partout, elle laisse des trous de fond au milieu de la masse.
    const painted = new Set<string>();
    for (const rect of rects) {
      for (let x = rect.x; x < rect.x + rect.w; x += CELL) {
        painted.add(`${x},${rect.y}`);
      }
    }

    const inner = 1280 * 0.3 * 0.45;
    let inside = 0;
    let lit = 0;
    for (let y = 0; y < 500; y += CELL) {
      for (let x = 0; x < 1280; x += CELL) {
        if (Math.hypot(x + CELL / 2 - 640, y + CELL / 2 - 250) > inner) continue;
        inside++;
        if (painted.has(`${x},${y}`)) lit++;
      }
    }

    const fill = lit / inside;
    assert.ok(
      fill > 0.95,
      `cœur troué : ${Math.round(fill * 100)} % rempli seulement`,
    );
  });

  it("forme des amas plutôt qu’un damier régulier", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, { cell: CELL, spawn: 0, seed: 7 });
    engine.resize(1280, 500, 1);
    engine.blast(640, 250);
    const after = run(engine, 55, rects, CELL);

    // Un seuil ordonné (Bayer) produit à mi-énergie des segments d'une seule
    // cellule : le damier. Le masque bruité doit donner des segments longs.
    const meanRun = after.cells / after.rects;
    assert.ok(
      meanRun > 3,
      `segments trop courts, le rendu tire vers le damier : ${meanRun.toFixed(2)} cellules par rectangle`,
    );
  });

  it("fusionne les cellules voisines plutôt que d’empiler les rectangles", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, { cell: CELL, spawn: 0, seed: 7 });
    engine.resize(1280, 500, 1);
    engine.blast(640, 250);
    const after = run(engine, 55, rects, CELL);

    // Le tramage casse volontairement les aplats : le gain est réel mais
    // modeste. Ce test sert surtout de garde-fou sur le coût de rendu.
    assert.ok(
      after.rects < after.cells,
      `aucune fusion : ${after.rects} rectangles pour ${after.cells} cellules`,
    );
    assert.ok(
      after.rects < 12000,
      `budget de rendu dépassé : ${after.rects} rectangles`,
    );
  });

  it("dissipe entièrement une explosion", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, { cell: CELL, spawn: 0, seed: 7 });
    engine.resize(1280, 500, 1);
    engine.blast(640, 250);

    const peak = run(engine, 55, rects, CELL);
    // Les cellules décroissent à des vitesses différentes : la masse se délite
    // progressivement, il reste donc une traîne clairsemée un moment.
    const mid = run(engine, 200, rects, CELL);
    assert.ok(
      mid.cells < peak.cells * 0.15,
      `dissipation trop lente : ${peak.cells} → ${mid.cells} après 4 s`,
    );

    let frames = 0;
    let remaining = mid.cells;
    while (remaining > 0 && frames < 600) {
      remaining = run(engine, 30, rects, CELL).cells;
      frames += 30;
    }
    assert.equal(remaining, 0, "l’explosion doit finir par disparaître");
  });

  it("donne à chaque motif un rendu distinct et non vide", () => {
    const render = (motif: PixelMotif) => {
      const { canvas, rects } = makeCanvas();
      const engine = new PixelEngine(canvas, {
        cell: CELL,
        spawn: 6,
        seed: 41,
        motif,
      });
      engine.resize(900, 200, 1);
      const { cells } = run(engine, 240, rects, CELL);
      return { cells, signature: JSON.stringify(rects) };
    };

    const motifs: PixelMotif[] = ["sparks", "flow", "rain", "scan"];
    const results = motifs.map((motif) => [motif, render(motif)] as const);

    // Seuil bas : ce test vérifie qu'aucun motif ne rend un champ vide, la
    // densité au repos étant déjà couverte par un test dédié.
    for (const [motif, result] of results) {
      assert.ok(result.cells > 8, `motif « ${motif} » quasi vide`);
    }

    const signatures = new Set(results.map(([, r]) => r.signature));
    assert.equal(
      signatures.size,
      motifs.length,
      "deux motifs produisent le même rendu",
    );
  });

  it("garde la traînée du balayage bornée", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, {
      cell: CELL,
      spawn: 0,
      seed: 41,
      motif: "scan",
    });
    engine.resize(900, 200, 1);
    run(engine, 240, rects, CELL);

    // Sans plafond sur l'énergie déposée, la traînée vit plusieurs secondes et
    // finit par couvrir la moitié du champ au lieu de s'effacer derrière la barre.
    const span =
      Math.max(...rects.map((r) => r.x + r.w)) - Math.min(...rects.map((r) => r.x));
    assert.ok(
      span < 900 * 0.6,
      `traînée trop longue : ${Math.round(span)} px sur 900`,
    );
  });

  it("est déterministe à graine égale", () => {
    const snapshot = (seed: number) => {
      const { canvas, rects } = makeCanvas();
      const engine = new PixelEngine(canvas, { cell: CELL, spawn: 6, seed });
      engine.resize(600, 300, 1);
      run(engine, 120, rects, CELL);
      return JSON.stringify(rects);
    };

    assert.equal(snapshot(42), snapshot(42));
    assert.notEqual(snapshot(42), snapshot(43));
  });

  it("ignore une taille nulle et se remet en place ensuite", () => {
    const { canvas, rects } = makeCanvas();
    const engine = new PixelEngine(canvas, { cell: CELL, spawn: 6, seed: 7 });

    engine.resize(0, 0, 1);
    assert.equal(engine.hasSize, false);

    engine.resize(1280, 500, 1);
    assert.equal(engine.hasSize, true);
    run(engine, 200, rects, CELL);

    engine.resize(640, 500, 1);
    run(engine, 5, rects, CELL);
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    assert.ok(maxX <= 640, `débordement après réduction : x max = ${maxX}`);
  });
});
