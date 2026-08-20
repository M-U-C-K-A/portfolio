/**
 * Tests des visuels des projets.
 *
 * Les images sont des fichiers posés à la main dans `public/work/`, et rien
 * dans la chaîne de build ne s'en plaint : un fichier manquant donne un 404
 * silencieux, un fichier au mauvais format donne un recadrage silencieux.
 * D'où ces vérifications — c'est le seul endroit qui relie le tableau de
 * `content.ts` aux octets sur le disque.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { projects, type ProjectImage } from "../src/lib/content.ts";

const WORK = new URL("../public/", import.meta.url);

const allImages: ProjectImage[] = projects.flatMap((project) => [
  project.cover,
  ...project.shots,
]);

/**
 * Dimensions d'un JPEG, lues dans son en-tête.
 *
 * Le fichier est une suite de segments `FF <marqueur> <longueur>` ; celui qui
 * porte la taille est un « start of frame ». Une vingtaine de lignes évite ici
 * une dépendance de plus pour une seule lecture.
 */
function jpegSize(bytes: Buffer) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, "en-tête JPEG attendu");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    assert.equal(bytes[offset], 0xff, `marqueur attendu à l'octet ${offset}`);
    const marker = bytes[offset + 1];
    // SOF0 à SOF15, moins DHT, JPG et DAC qui ne portent pas de dimensions.
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error("aucun segment de dimensions trouvé");
}

describe("visuels des projets", () => {
  it("donne une image de couverture et des aperçus à chaque projet", () => {
    for (const project of projects) {
      assert.ok(project.cover, `${project.slug} n'a pas de couverture`);
      assert.ok(
        project.shots.length >= 3,
        `${project.slug} n'a que ${project.shots.length} aperçus`,
      );
    }
  });

  it("sert tout depuis public/work, sans image distante", () => {
    for (const image of allImages) {
      assert.match(
        image.src,
        /^\/work\/[a-z0-9-]+\.jpg$/,
        `chemin inattendu : ${image.src}`,
      );
    }
  });

  it("a un fichier derrière chaque image déclarée, aux bonnes dimensions", () => {
    for (const image of allImages) {
      const file = new URL(`.${image.src}`, WORK);
      let bytes: Buffer;
      try {
        bytes = readFileSync(file);
      } catch {
        throw new Error(`fichier absent : public${image.src}`);
      }
      const size = jpegSize(bytes);
      assert.deepEqual(
        size,
        { width: image.width, height: image.height },
        `public${image.src} fait ${size.width}×${size.height}, ` +
          `déclaré ${image.width}×${image.height}`,
      );
    }
  });

  it("légende chaque image", () => {
    for (const image of allImages) {
      assert.ok(
        image.caption.length > 12,
        `légende trop courte pour ${image.src}`,
      );
    }
  });
});
