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
import { projects, type ProjectMedia } from "../src/lib/content.ts";

const WORK = new URL("../public/", import.meta.url);

const allImages: ProjectMedia[] = projects.flatMap((project) => project.shots);

/**
 * Dimensions d'une image, lues dans son en-tête.
 *
 * Deux formats cohabitent : les captures livrées sont en PNG, les photos de
 * remplacement en JPEG. Une trentaine de lignes évite une dépendance de plus
 * pour une seule lecture.
 *
 * Le PNG annonce sa taille tout de suite, dans le premier bloc. Le JPEG est
 * une suite de segments `FF <marqueur> <longueur>` qu'il faut parcourir
 * jusqu'au « start of frame », le seul qui la porte.
 */
function imageSize(bytes: Buffer) {
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  assert.equal(bytes.readUInt16BE(0), 0xffd8, "en-tête PNG ou JPEG attendu");
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
  it("donne un motif de couverture et des aperçus à chaque projet", () => {
    for (const project of projects) {
      assert.ok(project.motif, `${project.slug} n'a pas de motif de couverture`);
      assert.ok(
        project.shots.length >= 4,
        `${project.slug} n'a que ${project.shots.length} aperçus`,
      );
    }
  });

  it("sert tout depuis public/work, sans image distante", () => {
    for (const image of allImages) {
      assert.match(
        image.src,
        /^\/work\/[a-z0-9-]+\.(jpg|png)$/,
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
      const size = imageSize(bytes);
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
