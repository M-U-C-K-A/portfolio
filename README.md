# Portfolio — Hugo Delacour

Refonte du portfolio : une page longue en français et une grille de pixels
interactive sur `<canvas>`.

| Route             | Contenu                                                    |
| ----------------- | ---------------------------------------------------------- |
| `/`               | Accueil : hero, projets, points de vue, méthode, parcours, 3 articles, contact |
| `/work/[slug]`    | Cas d'étude détaillés                                       |
| `/articles`       | Index complet des articles                                  |
| `/articles/[slug]`| Article, sommaire collant, 3 suggestions en fin de page      |
| `/cv`             | CV en ligne, imprimable en A4 via `@media print`             |

Les pages d'erreur sont couvertes par `not-found.tsx` (404), `error.tsx` (500,
avec bouton de reprise) et `global-error.tsx` — ce dernier remplaçant le layout
racine, il fournit ses propres `<html>`/`<body>` et ne réutilise aucun composant
du site. Toutes passent par `components/error-screen.tsx`.

## Démarrer

```bash
npm run dev
```

| Commande        | Rôle                                          |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Serveur de développement (Turbopack)          |
| `npm run build` | Build de production                           |
| `npm run lint`  | ESLint (règles React Compiler incluses)       |
| `npm test`      | Tests du moteur de pixels (`node:test`)       |

## Pile

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
(preset `radix-nova`, rayon forcé à 0). Polices : Inter Tight pour l'affichage,
Geist Mono pour les libellés — chargées via `next/font`.

Aucune bibliothèque d'animation : tout le mouvement vient du moteur maison.

## Thèmes et palette

Le site suit le mode système et se laisse forcer par le bouton soleil / lune de
l'en-tête. Le choix explicite est mémorisé dans `localStorage`.

L'implémentation suit ce que décrit l'article `content/articles/dark-theme.md` :

- **`color-scheme: light dark`** sur `:root`, pour que le navigateur peigne déjà
  la bonne couleur de fond avant la feuille de style.
- **`light-dark()`** sur chaque jeton : une seule déclaration par couleur, pas de
  bloc dupliqué à maintenir en double.
- **Un script bloquant** de quelques centaines d'octets dans le `<head>` pose
  `data-theme` avant la première peinture — sans lui, un visiteur en mode sombre
  verrait un flash blanc le temps de l'hydratation.
- **L'impression force `color-scheme: light`**, sinon le CV sortirait sur fond
  noir depuis le mode sombre.
- **La coloration du code émet les deux thèmes** (`min-light` / `min-dark`) dans
  des variables CSS ; la bascule ne recalcule rien.

Une rampe de cinq neutres et un seul accent, qui n'apparaît qu'aux moments
déclenchés — explosions, puces, sélection, focus.

| Nom    | Valeur    | Rôle                                       |
| ------ | --------- | ------------------------------------------ |
| paper  | `#fafaf8` | Fond                                       |
| ink    | `#0f0f11` | Texte, titres, tons les plus sombres       |
| slate  | `#3a3a40` | Rampe du canvas                            |
| steel  | `#6b6b73` | Rampe du canvas                            |
| grey   | `#9c9ca3` | Rampe du canvas                            |
| mist   | `#cdcdd2` | Rampe du canvas, le ton le plus clair      |
| accent | `#1d3fff` | Explosions, puces, liens actifs, sélection |

En mode sombre la rampe s'inverse — sur papier clair les pixels sont sombres,
sur papier sombre ils sont clairs — et l'accent s'éclaircit (`#6b86ff`), le bleu
de jour ne tenant que 2,9:1 sur fond sombre contre 5,9:1 pour sa version claire.

La **source** des couleurs du canvas est `PIXEL_PALETTE` / `PIXEL_PALETTE_DARK`
dans `src/lib/pixel-engine.ts`. `src/app/globals.css` les redéclare en jetons CSS
pour ce qui relève du DOM ; les deux doivent rester synchronisées.

Les cellules stockent un index, pas une couleur : changer de thème est un simple
`setPalette()` suivi d'un repaint, et le champ ne se réinitialise pas sous les
yeux de l'utilisateur.

Au repos, la nuance d'une étincelle suit le bruit d'amas : les pixels voisins
partagent un ton, ce qui donne de la profondeur au champ. Comme ce bruit est
interpolé — donc resserré autour de 0,5 — sa distribution est étalée avant
d'être découpée en cinq crans, faute de quoi presque tout tomberait sur le ton
médian.

## Le moteur de pixels

`src/lib/pixel-engine.ts` — indépendant de React, donc testable sans navigateur.

Une grille de cellules porte une énergie et un index de couleur. Le rendu
n'allume une cellule que si son énergie dépasse un **seuil** propre à cette
cellule. Tout se joue sur la façon dont ce seuil est distribué.

Une matrice de Bayer donnerait un seuil *ordonné* : à mi-énergie, les cellules
d'une même zone franchissent leur seuil en alternance et produisent un damier
régulier, mécanique. `src/lib/pixel-noise.ts` le remplace par un masque bruité
en deux couches :

- une couche **grossière** — bruit de valeur interpolé sur deux octaves — qui
  fait que des cellules voisines partagent un seuil proche et s'allument donc
  ensemble : ce sont les amas ;
- une couche **fine**, un aléa par cellule, qui déchiquette les bords des amas.

L'explosion module son énergie par l'**inverse** de l'amas : comme le seuil
monte avec l'amas, injecter moins d'énergie là où le seuil est haut creuse des
trous nets au lieu de les compenser.

Cette érosion est en revanche **pondérée par le rayon** — nulle au cœur,
maximale sur le pourtour. Appliquée uniformément, elle laissait des taches de
fond au milieu de la masse, ce qui se lit comme un défaut de rendu et non comme
une texture. Le disque est donc plein et franc au centre, déchiqueté au bord,
puis se délite du bord vers le centre sous l'effet de la décroissance. Un test
mesure le taux de remplissage du cœur pour éviter la régression.

### Les motifs

Toutes les zones ne sont pas cliquables. Celles qui ne le sont pas portent un
motif propre, sinon elles paraissent inertes à côté des grilles réactives —
option `motif` :

| Motif    | Comportement                                              | Où                    |
| -------- | --------------------------------------------------------- | --------------------- |
| `sparks` | Étincelles isolées en bandes lentes (défaut)               | Hero, bandeaux cliquables |
| `flow`   | Ruban qui ondule sur la largeur, deux harmoniques lentes    | Section méthode       |
| `rain`   | Traînées verticales, une vitesse et une cadence par colonne | Pied de page          |
| `scan`   | Barre verticale qui traverse en laissant une traînée        | Bandeau des articles  |

Le reste :

- **Rendu** — les cellules voisines de même couleur sont fusionnées en un seul
  `fillRect` par balayage de ligne.
- **Économie** — pause hors écran (`IntersectionObserver`) et onglet caché
  (`visibilitychange`) ; `prefers-reduced-motion` respecté, avec activation
  explicite proposée à l'utilisateur.

`src/lib/pixel-plate.ts` réutilise le même masque pour les vignettes des
projets : chaque projet a une composition dérivée de sa graine, cuite une fois
et seulement seuillée à chaque image.

## Contenu

- **Le texte du site** est dans `src/lib/content.ts`. Les composants n'en
  contiennent aucun, ce qui rend une future internationalisation mécanique.
- **Les articles** sont des fichiers markdown dans `content/articles/`, avec
  frontmatter (`title`, `description`, `date`, `tags`). Ajouter un fichier
  suffit : la route, le sommaire, le temps de lecture et l'index sont dérivés.

Le rendu markdown (`src/lib/articles.ts`) passe par remark/rehype avec
`remark-gfm` pour les tableaux et `rehype-pretty-code` (Shiki, thème
`min-light`) pour la coloration. Tout se fait au build ; rien n'atteint le
navigateur.

La page d'article pose une colonne étroite pour le sommaire (`11rem`) et cale
le texte juste après, borné à `40rem` — soit une mesure d'environ 75 signes.
Le vide à droite est assumé : c'est ce qui garde le texte lisible et à gauche
plutôt qu'échoué au milieu de la page. Le sommaire suit la lecture via un
`IntersectionObserver` (`src/components/article-toc.tsx`).

## Un piège à ne pas réintroduire

Le `body` porte `overflow-x: clip`, **pas** `hidden`. `hidden` force le calcul
de `overflow-y` à `auto`, ce qui transforme le body en conteneur de défilement
autonome : la molette cesse alors de remonter jusqu'au viewport et la page
paraît figée. Dans le même esprit, `main` utilise `grow` et non `flex-1` —
`flex-1` pose `flex-basis: 0`, ce qui contraint la hauteur du contenu au lieu
de simplement pousser le pied de page vers le bas.

## À reprendre

- Les liens « voir le projet » en ligne ne sont pas repris : aucune URL
  publique n'existait sur le site source.
