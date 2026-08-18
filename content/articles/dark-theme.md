---
title: "Mode sombre : la méthode propre, sans flash blanc"
description: "Le flash blanc au chargement n'est pas une fatalité, c'est un problème d'ordre d'exécution. Comment poser un mode sombre robuste avec color-scheme, light-dark() et un script bloquant minimal."
date: "2026-05-13"
tags: ["CSS", "Next.js", "UX", "Design System"]
---

Tout le monde a déjà vécu ça : le site est en mode sombre, on recharge, et
pendant deux dixièmes de seconde l'écran devient blanc avant de repasser au
noir. C'est le **FOUC** — *Flash of Unstyled Content* — et à trois heures du
matin, c'est agressif.

Ce n'est pas un problème de CSS mal écrit. C'est un problème d'**ordre
d'exécution** : le navigateur peint la page avant que ton JavaScript n'ait pu
lui dire quel thème appliquer. Toute la solution consiste à inverser cet ordre.

## Un : prévenir le navigateur

Avant même la première variable CSS, il faut dire au navigateur que le site
gère les deux modes.

```css
:root {
  color-scheme: light dark;
}
```

Cette ligne ne change pas tes couleurs — elle change celles du **navigateur**.
Barres de défilement, champs de formulaire, boutons natifs, fond de page par
défaut : tout s'adapte au mode système. Et surtout, si l'utilisateur est en
mode sombre, le fond de page devient sombre **avant même que ta feuille de
style ne soit chargée**.

Une bonne moitié du flash blanc disparaît avec ces trois mots.

Quand l'utilisateur a fait un choix explicite, on le force :

```css
:root[data-theme="light"] {
  color-scheme: light;
}
:root[data-theme="dark"] {
  color-scheme: dark;
}
```

## Deux : `light-dark()`, pour ne plus dupliquer

Historiquement on écrivait chaque variable deux fois : une fois sur `:root`,
une fois sous `.dark` ou dans une media query. Deux blocs à maintenir, et une
occasion sur deux d'en oublier un.

`light-dark()` supprime la duplication : la fonction lit `color-scheme` et
choisit la bonne valeur.

```css
:root {
  color-scheme: light dark;

  --surface: light-dark(#ffffff, #101013);
  --text: light-dark(#101013, #f2f2f0);
  --muted: light-dark(#6e6e72, #9a9aa2);
  --border: light-dark(rgb(0 0 0 / 0.12), rgb(255 255 255 / 0.14));
}

body {
  background: var(--surface);
  color: var(--text);
}
```

Un seul bloc, une seule source. Ajouter une couleur, c'est ajouter une ligne —
pas deux lignes à deux endroits.

Le point d'attention : `light-dark()` dépend de `color-scheme`. Si tu oublies
de le déclarer, la fonction retombe toujours sur la valeur claire, et tu passes
une heure à chercher pourquoi rien ne bascule.

## Trois : tuer le flash pour de bon

Il reste le cas du choix explicite. L'utilisateur a sélectionné « sombre »
alors que son système est en clair : cette préférence est dans un cookie ou
dans `localStorage`, et personne ne la lit avant l'hydratation React.

La solution est un script minuscule, **synchrone**, injecté dans le `<head>` —
donc exécuté avant le premier rendu.

```tsx title="app/layout.tsx"
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    // Mode navigation privée, stockage bloqué : on laisse le mode système.
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Synchrone et bloquant : c'est exactement ce qu'on veut ici. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Trois détails comptent :

- **Il doit être bloquant.** C'est le seul script d'une application dont on
  souhaite qu'il bloque le rendu. Il fait moins de 300 octets et s'exécute en
  une fraction de milliseconde ; le coût est nul face au flash qu'il évite.
- **Le `try/catch` n'est pas décoratif.** En navigation privée sur certains
  navigateurs, `localStorage` lève une exception. Sans le catch, le script
  meurt et le thème ne s'applique pas du tout.
- **`suppressHydrationWarning` sur `<html>`.** Le script modifie le DOM avant
  React, donc le serveur et le client divergent sur cet attribut. C'est le seul
  endroit du projet où cette prop est légitime.

### L'ordre d'exécution, en clair

| Étape | Ce qui se passe                          | État visible                         |
| ----- | ---------------------------------------- | ------------------------------------ |
| 1     | Le HTML arrive                           | Fond natif, déjà bon grâce à `color-scheme` |
| 2     | Le script inline pose `data-theme`        | Le thème choisi est fixé, avant peinture |
| 3     | Le CSS s'applique                        | Couleurs finales                     |
| 4     | React s'hydrate                          | Le sélecteur devient interactif      |

L'utilisateur ne voit jamais l'étape intermédiaire, parce qu'il n'y en a plus.

## Quatre : deux niveaux de jetons

L'erreur d'architecture la plus fréquente : écrire des couleurs brutes dans les
composants. Six mois plus tard, `#1a1a1a` est semé dans quarante fichiers et
personne n'ose y toucher.

Il faut deux couches.

**Les primitives** — la palette brute, indépendante du thème. Elles ne sont
jamais utilisées directement dans un composant.

```css
:root {
  --grey-0: #ffffff;
  --grey-100: #f4f4f2;
  --grey-800: #26262b;
  --grey-950: #101013;
  --blue-500: #1d3fff;
}
```

**Les jetons sémantiques** — ce que les composants consomment. Ils décrivent un
rôle, pas une couleur.

```css
:root {
  color-scheme: light dark;

  --surface: light-dark(var(--grey-0), var(--grey-950));
  --surface-raised: light-dark(var(--grey-100), var(--grey-800));
  --text: light-dark(var(--grey-950), var(--grey-0));
  --accent: var(--blue-500);
}
```

L'avantage est concret : le jour où le fond sombre doit passer de `#101013` à
`#0c0c10`, tu changes une primitive. Aucun composant n'est touché, aucune
régression possible ailleurs.

Le test qui valide l'architecture : **peux-tu changer entièrement de palette en
ne touchant qu'un seul bloc CSS ?** Si non, des couleurs brutes ont fui dans les
composants.

## Cinq : le mode sombre n'est pas une inversion

C'est là que la plupart des implémentations dérapent. Inverser mécaniquement le
clair donne un résultat inconfortable, pour des raisons physiologiques.

**Le blanc pur sur noir pur éblouit.** Le contraste maximal (21:1) provoque un
halo autour des lettres — l'*halation* — particulièrement marqué chez les
personnes astigmates. Vise plutôt `#f2f2f0` sur `#101013`, autour de 17:1 :
largement conforme, nettement plus confortable.

**L'élévation s'inverse.** En mode clair, une carte se détache par une ombre.
En mode sombre les ombres sont invisibles : c'est la **clarté** qui indique
l'élévation. Plus une surface est proche de l'utilisateur, plus elle est
claire.

**Les couleurs saturées vibrent.** Un bleu vif sur fond sombre produit une
impression de tremblement. Il faut désaturer et éclaircir les accents en mode
sombre — c'est exactement le genre de correction que `light-dark()` rend
indolore.

**Les images ont besoin d'aide.** Un PNG à fond blanc devient un rectangle
éblouissant. Deux réponses simples :

```css
/* Adoucir les images très lumineuses sans les dénaturer. */
:root[data-theme="dark"] img:not([data-no-dim]) {
  filter: brightness(0.88) contrast(1.02);
}
```

```html
<!-- Ou servir la bonne image, quand elle existe. -->
<picture>
  <source srcset="/schema-dark.svg" media="(prefers-color-scheme: dark)" />
  <img src="/schema-light.svg" alt="Architecture du pipeline" />
</picture>
```

## Six : la bascule, côté client

Le sélecteur est le seul morceau qui a besoin de JavaScript. Il doit faire
trois choses : écrire la préférence, mettre à jour l'attribut, et rester
synchronisé si le système change.

```tsx title="components/theme-toggle.tsx"
"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  // On lit ce que le script inline a déjà décidé, on ne le recalcule pas.
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? "light");
  }, []);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={() => apply(theme === "dark" ? "light" : "dark")}
      aria-pressed={theme === "dark"}
    >
      Mode {theme === "dark" ? "clair" : "sombre"}
    </button>
  );
}
```

Deux finitions qui font la différence :

- **Ne pas animer la bascule.** Une transition sur `background-color` appliquée
  à toute la page produit un fondu boueux de 300 ms. Le basculement instantané
  est plus net — et gratuit.
- **`aria-pressed` plutôt qu'une icône seule.** Un bouton dont l'état n'est
  annoncé que par un pictogramme est muet pour un lecteur d'écran.

## Les méthodes, comparées

| Méthode                          | Flash supprimé | Duplication CSS | Complexité |
| -------------------------------- | -------------- | --------------- | ---------- |
| Classe `.dark` + Context React    | Non            | Élevée          | Moyenne    |
| `prefers-color-scheme` seul       | Oui            | Élevée          | Faible     |
| `light-dark()` + script inline    | Oui            | Aucune          | Faible     |

La troisième ligne gagne sur les trois colonnes. Sa seule contrainte est le
script inline — trois cents octets qu'on écrit une fois.

Le cas « `prefers-color-scheme` seul » reste parfaitement valable si tu
n'offres pas de bascule manuelle. Pas de choix utilisateur, pas de préférence à
restaurer, donc pas de flash : la media query suffit et tu n'écris aucun
JavaScript.

## En résumé

Le flash blanc n'est pas une fatalité, c'est une question d'ordre :

1. **`color-scheme: light dark`** pour que le navigateur peigne juste dès le
   premier octet.
2. **`light-dark()`** pour n'écrire chaque couleur qu'une fois.
3. **Un script inline bloquant** pour appliquer le choix explicite avant la
   première peinture.
4. **Deux niveaux de jetons** pour que changer la palette reste un geste local.
5. **Concevoir pour l'obscurité**, pas inverser le clair.

Un site ne devrait pas « avoir un mode sombre ». Il devrait être conçu pour la
lumière et pour l'obscurité — ce n'est pas la même phrase, et ça ne donne pas
le même produit.
