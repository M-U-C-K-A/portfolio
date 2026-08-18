---
title: "Core Web Vitals : ce que Next.js fait pour toi, et ce qu'il ne fera pas"
description: "LCP, CLS, INP. Trois mesures, trois causes racines, et une série de leviers concrets dans Next.js — y compris ceux qui dégradent les scores quand on les utilise mal."
date: "2026-06-10"
tags: ["Next.js", "Performance", "Web Vitals", "SEO"]
---

Un site rapide n'est pas un site qui charge vite. C'est un site qui apparaît
vite, qui ne **bouge pas** pendant qu'on le lit, et qui **répond** quand on le
touche. Les Core Web Vitals mesurent exactement ces trois choses, et rien
d'autre.

Next.js fournit des outils puissants pour chacune — et chacun de ces outils
peut dégrader tes scores s'il est mal employé. Voyons les trois piliers, leur
cause racine, et les leviers réels.

## Avant les trois piliers : le TTFB

Aucune optimisation d'image ne rattrape un serveur qui répond en 800 ms. Le
**Time To First Byte** n'est pas un Core Web Vital, mais il plafonne tous les
autres : le LCP ne peut pas être meilleur que le moment où le premier octet
arrive.

Trois causes dominent, dans cet ordre :

- **Le rendu à la demande là où le statique suffirait.** Une page produit qui
  ne change qu'une fois par jour n'a aucune raison d'être recalculée à chaque
  visite.
- **Les redirections en chaîne.** `http://` → `https://` → `www.` → `/fr` fait
  quatre allers-retours avant que le premier octet utile ne parte. Chacune coûte
  un aller-retour réseau complet, soit 100 à 300 ms sur mobile.
- **Le middleware trop large.** Un `matcher` mal borné fait passer chaque image
  et chaque fichier statique par du code applicatif.

```ts
// ❌ Le middleware s'exécute sur tout, y compris les assets.
export const config = { matcher: "/:path*" };

// ✅ Uniquement sur les pages.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

## LCP — la vitesse perçue

Le **Largest Contentful Paint** mesure le temps d'affichage du plus grand
élément visible : le plus souvent l'image de hero, parfois le titre.

La cause racine est presque toujours la même : **le navigateur découvre
l'élément trop tard**. Il télécharge le HTML, puis le CSS, puis découvre
l'image, puis la demande. Chaque étape est un aller-retour réseau.

### Déclarer l'image critique

```tsx
import Image from "next/image";

<Image
  src="/hero.jpg"
  alt="Vue du tableau de bord"
  width={1600}
  height={900}
  priority
  sizes="100vw"
/>;
```

`priority` fait deux choses : il pose un `<link rel="preload">` dans le `<head>`
et passe l'image en `fetchpriority="high"`. Le navigateur la demande donc
immédiatement, sans attendre la mise en page.

Le contre-emploi classique : mettre `priority` sur cinq images. Si tout est
prioritaire, plus rien ne l'est — la bande passante se répartit et le vrai LCP
arrive plus tard qu'avant. **Une seule image par écran initial.**

`sizes` mérite autant d'attention. Sans lui, Next sert souvent une image bien
plus large que nécessaire sur mobile : le poids explose alors que la surface est
minuscule.

```tsx
// ❌ Sur mobile, le navigateur télécharge une image pleine largeur
//    pour l'afficher dans une carte de 340 px.
<Image src={photo} alt="" fill />

// ✅ On décrit la largeur réelle d'affichage selon le viewport.
<Image
  src={photo}
  alt=""
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

### Le placeholder flou

```tsx
<Image src={photo} alt="" placeholder="blur" />
```

Avec un import statique, Next génère automatiquement une miniature encodée en
base64 dans le HTML. L'utilisateur voit une forme immédiatement au lieu d'un
trou blanc. Cela n'améliore pas la métrique en soi, mais cela change beaucoup la
perception — et c'est gratuit.

Pour une image distante, il faut fournir `blurDataURL` toi-même, sinon
`placeholder="blur"` est ignoré silencieusement.

### Les formats et le vrai poids

`next/image` sert du AVIF ou du WebP selon ce que le navigateur accepte. Deux
réglages valent la peine d'être revus :

```ts title="next.config.ts"
const nextConfig = {
  images: {
    // AVIF pèse 20 à 30 % de moins que WebP, au prix d'un encodage plus lent.
    formats: ["image/avif", "image/webp"],
    // Restreindre les sources distantes autorisées, jamais `**`.
    remotePatterns: [{ protocol: "https", hostname: "cdn.monsite.com" }],
  },
};
```

Et un piège : `unoptimized` désactive tout — redimensionnement, format moderne,
`srcset`. C'est parfois nécessaire (SVG, export statique sans loader), mais
chaque `unoptimized` devrait être justifié en commentaire, sinon il se propage.

### Les polices

Une police web mal chargée retarde le rendu du texte, et le texte est souvent
l'élément LCP.

```ts title="app/layout.ts"
import { Inter_Tight } from "next/font/google";

const display = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
});
```

`next/font` télécharge la police au build, la sert depuis ton domaine — plus
d'aller-retour vers Google, plus de connexion à un tiers — et calcule une police
de repli avec `size-adjust` pour que la substitution ne décale rien. C'est un
des rares outils qui améliore LCP **et** CLS d'un seul coup.

Deux réflexes en plus : ne déclare que les graisses que tu utilises réellement
(chaque graisse est un fichier), et préfère une police variable quand elle
existe — un seul fichier couvre toute la plage de graisses, souvent pour moins
lourd que deux fichiers statiques.

## CLS — la stabilité visuelle

Rien n'est plus agaçant qu'un bouton qui se déplace au moment du clic. Le
**Cumulative Layout Shift** mesure ces décalages inattendus.

La cause racine est unique : **quelque chose est arrivé et personne ne lui avait
réservé de place.**

### Réserver l'espace, toujours

`next/image` gère le cas des images dès lors que tu donnes `width` et `height`
(ou `fill` dans un conteneur dimensionné). Il en déduit un ratio et réserve la
boîte avant le chargement.

Pour tout le reste — contenu asynchrone, bannières, encarts publicitaires,
bandeau de cookies — c'est à toi de le faire :

```css
.media {
  aspect-ratio: 16 / 9; /* la boîte existe avant le contenu */
}

.skeleton-row {
  min-height: 4.5rem; /* la même hauteur que la ligne réelle */
}
```

Le squelette de chargement doit avoir **exactement** la hauteur du contenu
final. Un squelette plus court est un décalage garanti, et il compte double : il
arrive au moment précis où l'utilisateur commence à lire.

Trois sources de CLS que l'on oublie systématiquement :

- **La barre de défilement.** Un contenu qui grandit fait apparaître la barre et
  décale toute la page de 15 px. `scrollbar-gutter: stable` sur `html` règle le
  problème en une ligne.
- **Les bandeaux insérés en haut de page.** S'ils doivent exister, réserve leur
  hauteur dès le rendu initial, ou pose-les en `position: fixed` pour qu'ils
  sortent du flux.
- **Le contenu injecté au-dessus du pli après hydratation** — une alerte, une
  bannière de version. Tout ce qui pousse le contenu vers le bas après coup est
  compté.

### Streaming et `Suspense`

Le streaming envoie la coque de la page immédiatement et remplit les zones
lentes ensuite. À condition que le `fallback` occupe la bonne place :

```tsx title="app/dashboard/page.tsx"
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <>
      <Header />
      {/* Le fallback doit avoir la hauteur du tableau, sinon on a
          simplement déplacé le décalage plus tard. */}
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <RevenueTable />
      </Suspense>
    </>
  );
}
```

Le streaming a un effet secondaire précieux : il découple le TTFB des requêtes
lentes. La coque part immédiatement, et le LCP se joue sur ce qui est déjà
dans le HTML plutôt que sur la requête la plus lente de la page.

## INP — la réactivité

L'**Interaction to Next Paint** a remplacé le FID en mars 2024, et c'est un juge
nettement plus sévère. Le FID ne mesurait que le délai avant traitement de la
première interaction ; l'INP mesure le temps entre **n'importe quelle**
interaction et le repeint qui s'ensuit, sur toute la session.

La cause racine : **le fil principal est occupé**. Et ce qui l'occupe, dans une
application React, c'est presque toujours du JavaScript d'hydratation.

### Envoyer moins de JavaScript

C'est le levier principal, et de très loin. Un Server Component n'envoie aucun
JavaScript au client : son coût d'hydratation est nul.

```tsx
// ❌ Toute la page bascule côté client pour un seul bouton.
"use client";
export default function ArticlePage({ article }) {
  return (
    <article>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.html }} />
      <LikeButton id={article.id} />
    </article>
  );
}
```

```tsx
// ✅ Seul le bouton est hydraté ; l'article reste du HTML.
export default function ArticlePage({ article }) {
  return (
    <article>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.html }} />
      <LikeButton id={article.id} /> {/* "use client" vit ici */}
    </article>
  );
}
```

Pour vérifier où part le JavaScript, `next build` affiche le poids par route.
Une route qui grossit sans nouvelle fonctionnalité signale un `"use client"`
remonté trop haut, ou une bibliothèque importée en entier là où deux fonctions
suffisaient.

### Déprioriser ce qui peut attendre

Quand une interaction déclenche un rendu coûteux — filtrer une longue liste, par
exemple — `useTransition` indique à React que ce travail est interruptible. La
frappe reste fluide pendant que la liste se recalcule.

```tsx
"use client";
import { useState, useTransition } from "react";

export function FilterableList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(items);
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    setQuery(value); // urgent : le champ doit réagir immédiatement
    startTransition(() => {
      // non urgent : React peut l'interrompre si l'utilisateur retape
      setFiltered(items.filter((i) => i.name.includes(value)));
    });
  }

  return (
    <>
      <input value={query} onChange={(e) => onChange(e.target.value)} />
      <ul data-pending={isPending}>{/* ... */}</ul>
    </>
  );
}
```

### Les scripts tiers

Analytics, chat de support, tag manager : ce sont eux qui saturent le fil
principal sur la plupart des sites, et ils n'apparaissent dans aucun rapport de
build parce qu'ils sont chargés à l'exécution.

```tsx
import Script from "next/script";

// afterInteractive : après hydratation, avant l'inactivité. Pour l'analytique.
<Script src="https://analytics.exemple.com/script.js" strategy="afterInteractive" />

// lazyOnload : pendant les temps morts. Pour tout ce qui n'est pas critique.
<Script src="https://widget-chat.exemple.com/embed.js" strategy="lazyOnload" />
```

La question à se poser pour chaque script : **de quoi le retirer nous
priverait-il exactement ?** Beaucoup survivent uniquement parce que personne
n'ose les enlever.

## Debugger pour de vrai

Lighthouse donne un score, pas un diagnostic. Pour comprendre **pourquoi** ton
INP est mauvais, il faut deux outils de plus.

**L'onglet Performance de Chrome.** Enregistre, interagis, arrête. Cherche les
longues tâches sur le fil principal — les blocs de plus de 50 ms — et regarde la
pile d'appels : le coupable y est nommé. La piste « Layout Shifts » surligne
directement les éléments qui ont bougé, ce qui répond en trois secondes à une
question qui prend une demi-journée autrement.

**CrUX (Chrome User Experience Report).** Ce sont les données réelles,
collectées anonymement chez les utilisateurs Chrome — et ce sont elles que
Google utilise pour le classement, pas ton Lighthouse local. Ton MacBook en
fibre n'est pas un téléphone milieu de gamme en 4G. L'écart entre les deux est
généralement le vrai sujet.

Deux réflexes pour approcher la réalité depuis ton poste : active le bridage CPU
×4 et le réseau « Slow 4G » dans les DevTools, et regarde le **75e centile**
plutôt que la moyenne. C'est le seuil que Google retient, et c'est celui qui
décrit les utilisateurs que tu ne vois jamais.

### Du symptôme au levier

| Symptôme observé                              | Cause probable                          | Levier                                   |
| --------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| LCP élevé mais TTFB correct                    | Image découverte tard                   | `priority`, `sizes`, preload             |
| LCP et TTFB élevés tous les deux               | Rendu à la demande, redirections        | Statique ou ISR, chaîne de redirections  |
| CLS visible au chargement des polices          | Pas de police de repli ajustée          | `next/font`                              |
| CLS après quelques secondes                    | Contenu injecté sans place réservée     | `aspect-ratio`, `min-height`             |
| INP mauvais uniquement sur mobile              | Hydratation trop lourde                 | Server Components, moins de client       |
| INP mauvais sur une interaction précise        | Rendu synchrone coûteux                 | `useTransition`, virtualisation          |

## Choisir sa stratégie de rendu

Le rendu décide du TTFB, donc plafonne tout le reste.

| Stratégie | Effet sur les CWV                 | Cas d'usage                             |
| --------- | --------------------------------- | --------------------------------------- |
| Statique  | Optimal — le HTML est déjà prêt   | Documentation, blog, site vitrine       |
| ISR       | Excellent, avec fraîcheur         | E-commerce, catalogues                  |
| SSR       | Variable — dépend du serveur      | Pages personnalisées, tableaux de bord  |
| PPR       | Coque statique + trous dynamiques | Pages mixtes (encore expérimental)      |

La règle : **statique par défaut, dynamique par exception**. Chaque page rendue
à la demande devrait pouvoir justifier pourquoi elle ne peut pas être
pré-rendue.

Attention aux bascules involontaires : lire `cookies()`, `headers()` ou
`searchParams` dans un composant rend toute la route dynamique, souvent sans
qu'on s'en aperçoive. `next build` le signale route par route — c'est la
première colonne à relire après chaque fonctionnalité.

## Tenir dans le temps

Un score obtenu une fois est un score perdu la semaine suivante. Deux garde-fous
suffisent.

**Une mesure de terrain permanente**, pour savoir ce que vivent réellement les
utilisateurs :

```tsx title="app/layout.tsx"
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Hors Vercel, `web-vitals` fait la même chose vers l'analytique de ton choix.

**Un budget en intégration continue**, pour que la régression soit refusée avant
d'atteindre la production plutôt que constatée un mois plus tard. Lighthouse CI
échoue la pull request quand un seuil est dépassé :

```json title="lighthouserc.json"
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

## En résumé

Trois métriques, trois causes racines, trois réflexes :

1. **LCP** — le navigateur découvre trop tard. → `priority` sur **une** image,
   `sizes` correct, `next/font`.
2. **CLS** — personne n'a réservé la place. → dimensions, `aspect-ratio`,
   squelettes à la bonne hauteur.
3. **INP** — le fil principal est saturé. → moins de JavaScript, `"use client"`
   le plus bas possible, `useTransition` sur les rendus lourds.

Et en amont des trois : un TTFB tenu, c'est-à-dire du statique partout où c'est
possible et pas de redirections en chaîne.

Surtout : mesure sur le terrain, pas sur ta machine. Un site qui obtient 100 en
local et 62 chez tes utilisateurs n'a pas un problème de score, il a un problème
d'utilisateurs.
