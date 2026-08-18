---
title: "Sortir de la zone grise : les dégradés avec OKLCH"
description: "Pourquoi un dégradé entre deux couleurs vives passe par un gris terne au milieu, ce que sRGB fait de travers, et comment OKLCH règle le problème — pour les dégradés comme pour les palettes accessibles."
date: "2026-02-11"
tags: ["CSS", "Design", "Couleur", "Accessibilité"]
---

Tu choisis un bleu profond et un jaune éclatant, tu écris un `linear-gradient`,
et le résultat traverse une bande de gris boueux au milieu. Deux couleurs
vibrantes, un dégradé terne. Le réflexe est d'ajouter un point de couleur au
milieu pour rattraper — c'est un pansement.

Le problème n'est pas ton choix de couleurs. C'est l'espace dans lequel le
navigateur calcule le chemin entre les deux.

## Pourquoi ce gris apparaît

Par défaut, un dégradé CSS interpole en **sRGB** : le navigateur fait la
moyenne des composantes rouge, verte et bleue, canal par canal.

Prenons un bleu `rgb(0 0 255)` et un jaune `rgb(255 255 0)`. Au milieu du
chemin :

```txt
R : (0 + 255) / 2   = 127
V : (0 + 255) / 2   = 127
B : (255 + 0) / 2   = 127
             → rgb(127 127 127), un gris parfait
```

Le calcul est juste. Le résultat est laid. Parce que sRGB est un cube de
nombres, pas un modèle de la perception humaine : le segment droit entre deux
sommets opposés de ce cube passe mécaniquement par le centre, et le centre du
cube, c'est le gris.

## Trois modèles, trois logiques

**RGB** décrit comment un écran *fabrique* une couleur : combien de rouge, de
vert, de bleu. Parfait pour un moniteur, inutilisable pour raisonner. `#E67E22`
ne te dit rien tant que tu ne l'as pas affiché.

**HSL** ajoute une intuition : une teinte sur 360°, une saturation, une
luminosité. On peut enfin parler de « la même couleur en plus clair ». Mais la
luminosité de HSL est un artefact mathématique, pas une luminosité perçue.

C'est le piège central de HSL, et il est spectaculaire :

```css
/* Les deux ont L = 50 %. À l'œil, l'un est deux fois plus clair que l'autre. */
.jaune { background: hsl(60 100% 50%); }
.bleu  { background: hsl(240 100% 50%); }
```

Un jaune et un bleu « à 50 % » n'ont rien de comparable. Toute palette
construite sur cette hypothèse produit des contrastes imprévisibles.

**OKLCH** est **perceptuellement uniforme** : une même valeur de luminance
donne la même impression de clarté, quelle que soit la teinte.

- **L** — la luminance perçue, de 0 à 1.
- **C** — le chroma, l'intensité. 0 est gris ; la borne haute dépend de la teinte.
- **H** — la teinte, de 0 à 360°.

```css
/* Ces deux couleurs sont perçues comme également claires. */
.jaune { background: oklch(0.75 0.16 95); }
.bleu  { background: oklch(0.75 0.16 250); }
```

Cette propriété est ce qui rend OKLCH utile bien au-delà des dégradés.

## Le correctif tient en deux mots

CSS permet de choisir l'espace d'interpolation. Le gris disparaît sans toucher
aux couleurs.

```css
/* Traverse le gris. */
.terne {
  background: linear-gradient(90deg, #0000ff, #ffff00);
}

/* Contourne par les couleurs saturées : vert, cyan, turquoise. */
.vibrant {
  background: linear-gradient(in oklch, #0000ff, #ffff00);
}
```

`in oklch` demande au navigateur de faire le trajet dans l'espace perceptuel.
Au lieu de couper par le centre du cube, il fait le tour par l'extérieur — et
c'est exactement ce que fait un peintre.

### Choisir le sens du tour

Pour deux teintes éloignées, il y a deux chemins possibles sur le cercle
chromatique. CSS te laisse décider :

```css
/* Chemin court (défaut) : bleu → violet → magenta → jaune */
background: linear-gradient(in oklch shorter hue, #0000ff, #ffff00);

/* Chemin long : bleu → cyan → vert → jaune */
background: linear-gradient(in oklch longer hue, #0000ff, #ffff00);
```

`longer hue` produit ces dégradés très riches qu'on voit dans les interfaces
soignées : le trajet passe par plus de teintes, donc par plus de nuances.

## Des palettes cohérentes, sans tâtonner

L'application la plus utile d'OKLCH n'est pas décorative, elle est
systématique. Une échelle de gris construite en OKLCH est régulière par
construction :

```css
:root {
  --grey-50:  oklch(0.98 0.002 260);
  --grey-200: oklch(0.90 0.004 260);
  --grey-400: oklch(0.74 0.006 260);
  --grey-600: oklch(0.56 0.008 260);
  --grey-800: oklch(0.34 0.008 260);
  --grey-950: oklch(0.16 0.006 260);
}
```

Les écarts de L sont réguliers, donc les écarts perçus le sont aussi. Fais la
même chose en hexadécimal et tu passeras une heure à corriger le cran qui
« saute ».

Mieux : décliner une couleur de marque devient mécanique. On garde H, on fait
varier L, on ajuste C à la marge — les teintes très claires ou très sombres
supportent moins de chroma.

```css
:root {
  --brand-h: 258;
  --brand-500: oklch(0.55 0.24 var(--brand-h));
  --brand-300: oklch(0.72 0.17 var(--brand-h));
  --brand-700: oklch(0.42 0.19 var(--brand-h));
}
```

Changer `--brand-h` fait pivoter toute la marque en restant cohérent. C'est un
niveau de contrôle qu'aucune palette hexadécimale ne donne.

`color-mix()` complète le tableau, dans le bon espace :

```css
/* Un survol, sans écrire une seconde couleur à la main. */
.button:hover {
  background: color-mix(in oklch, var(--brand-500), white 12%);
}
```

## Le lien avec l'accessibilité

C'est l'argument qui devrait convaincre les sceptiques. En OKLCH, **L est un
prédicteur fiable du contraste** parce qu'elle correspond à la clarté perçue.

Si ton texte blanc est lisible sur un fond à `L = 0.45`, il le restera sur
n'importe quel fond à `L = 0.45`, que la teinte soit bleue, rouge ou verte. Tu
peux poser une règle d'équipe : « les fonds de bouton restent entre 0.40 et
0.50 » — et cette règle tient.

En HSL, la même règle est fausse : un fond `hsl(60 100% 45%)` et un fond
`hsl(240 100% 45%)` n'ont rien à voir en contraste réel.

Ce n'est pas une dispense de vérifier — le calcul WCAG reste le juge, et il
sera complété par APCA. Mais on passe d'un tâtonnement à un cadre où l'on se
trompe rarement.

## Les dégradés en maillage

Les fonds les plus travaillés ne sont pas des dégradés linéaires : ce sont des
**mesh gradients**, plusieurs points de couleur flottant dans un plan, dont les
influences se mélangent.

CSS ne les propose pas nativement, mais on les approche très bien en empilant
des dégradés radiaux :

```css
.mesh {
  background-color: oklch(0.96 0.01 260);
  background-image:
    radial-gradient(at 18% 22%, oklch(0.82 0.14 265 / 0.8) 0px, transparent 55%),
    radial-gradient(at 78% 18%, oklch(0.86 0.12 195 / 0.7) 0px, transparent 50%),
    radial-gradient(at 62% 82%, oklch(0.80 0.15 330 / 0.6) 0px, transparent 55%);
}
```

Trois à cinq points suffisent. Au-delà, les couleurs se neutralisent et on
revient à un aplat.

## Deux pièges de finition

### Animer sans faire chauffer le processeur

Animer `background-position` ou les couleurs d'un dégradé force le navigateur à
repeindre la surface à chaque image. Sur un fond plein écran, le coût est réel.

```css
/* ❌ Repeinture complète à chaque image. */
.hero { animation: shift 8s infinite; }
@keyframes shift { to { background-position: 100% 50%; } }

/* ✅ Le dégradé est peint une fois, on ne déplace que le calque. */
.hero { position: relative; isolation: isolate; }
.hero::before {
  content: "";
  position: absolute;
  inset: -25%;
  background: linear-gradient(in oklch, …);
  animation: drift 14s ease-in-out infinite alternate;
  z-index: -1;
}
@keyframes drift {
  to { transform: translate3d(4%, -3%, 0) scale(1.06); }
}
```

`transform` et `opacity` sont les deux seules propriétés que le compositeur
gère sans repeindre. Tout le reste passe par le processeur.

Et le réflexe qui va avec :

```css
@media (prefers-reduced-motion: reduce) {
  .hero::before { animation: none; }
}
```

### Le texte sur un dégradé

Écrire sur un fond dont la couleur change est un pari : le contraste est bon à
gauche, mauvais à droite. Le test WCAG doit passer sur le **point le plus
défavorable**, pas sur la moyenne.

La solution robuste n'est pas l'ombre portée — elle dégrade la lisibilité
autant qu'elle l'aide — mais un voile qui uniformise le fond sous le texte :

```css
.hero-text {
  position: relative;
  padding: 2rem;
}
.hero-text::before {
  content: "";
  position: absolute;
  inset: 0;
  background: oklch(0 0 0 / 0.45);
  z-index: -1;
}
```

Le fond redevient prévisible, et le contraste se calcule une fois.

## Que choisir, et quand

| Espace     | Uniformité perçue | Support     | Bon pour                          |
| ---------- | ----------------- | ----------- | --------------------------------- |
| RGB / hex  | Aucune            | Total       | Valeurs figées, compatibilité     |
| HSL        | Faible            | Total       | Ajustements rapides, prototypes   |
| OKLCH      | Excellente        | Large       | Design systems, palettes, dégradés |
| Display P3 | Excellente        | Écrans récents | Visuels riches sur matériel HDR |

Pour un projet neuf, écris tes jetons en OKLCH et interpole en OKLCH. Le
support est là dans tous les navigateurs à jour, et une valeur de repli en
hexadécimal suffit à couvrir le reste :

```css
:root {
  --brand: #4a3aff; /* repli */
}
@supports (color: oklch(0.5 0.2 260)) {
  :root {
    --brand: oklch(0.52 0.24 268);
  }
}
```

## En résumé

1. **Le gris au milieu d'un dégradé** est une conséquence mathématique de
   l'interpolation en sRGB, pas une erreur de goût.
2. **`in oklch`** le corrige sans changer une seule couleur.
3. **`longer hue` / `shorter hue`** décident du trajet sur le cercle chromatique.
4. **OKLCH sert surtout aux palettes** : L prédit la clarté perçue, donc les
   échelles sont régulières et les contrastes prévisibles.
5. **Anime `transform` et `opacity`**, jamais le dégradé lui-même.

Le conseil qui résume tout : arrête de choisir des couleurs, choisis des
**luminances**. Les teintes viennent après, et elles se rangent toutes seules.
