---
title: "SSR : ce que le rendu serveur change vraiment, au-delà du SEO"
description: "Le rendu serveur n'est pas un retour aux sites PHP des années 2000. C'est ce qui permet d'afficher du contenu avant que le JavaScript ne se réveille — et sur les applications qui dépendent d'API lentes, la différence est structurelle."
date: "2026-03-17"
tags: ["Next.js", "SSR", "Performance", "Architecture"]
---

Pendant des années, l'application web type ressemblait à ça : on arrive, on
voit un logo qui tourne, et cinq secondes plus tard le contenu apparaît. Le
temps que le JavaScript se télécharge, s'exécute, appelle trois API et rende le
tout.

Le rendu serveur retourne cet ordre. Le serveur fait le travail, envoie du HTML
déjà rempli, et le JavaScript ne sert plus qu'à rendre la page interactive. Ce
n'est pas un retour en arrière vers PHP : c'est un modèle hybride, et il change
plus de choses que le seul référencement.

## Rendu client contre rendu serveur

**Le rendu client (CSR)** — la cuisine en kit. Le serveur envoie une page vide
et un gros paquet de JavaScript. Le navigateur assemble tout, découvre les
requêtes à faire, les lance, attend, puis affiche. Chaque étape est séquentielle
et se déroule sur la machine de l'utilisateur — qui est souvent un téléphone de
milieu de gamme sur un réseau moyen.

**Le rendu serveur (SSR)** — le plat livré chaud. Le serveur récupère les
données, rend le HTML complet et l'envoie. L'utilisateur voit le contenu tout
de suite ; le JavaScript arrive ensuite pour brancher les interactions.

La différence tient en une question : **où se paie la latence ?** En CSR, elle
se paie sur l'appareil de l'utilisateur, après le chargement. En SSR, elle se
paie sur ton serveur, avant l'envoi — sur une machine que tu contrôles, proche
de tes API, avec un cache.

## Trois raisons qui ne sont pas le SEO

Le référencement est l'argument le plus cité, et c'est le moins intéressant.

### Le contenu existe dans la source

Un robot d'indexation exécute du JavaScript, mais avec un budget limité et une
patience finie. Surtout, il n'est pas le seul consommateur du HTML : les
aperçus de lien sur les réseaux sociaux, les messageries, les lecteurs RSS, les
agrégateurs et les outils d'accessibilité lisent la source brute, souvent sans
exécuter la moindre ligne de script.

Une page dont le titre et la description n'apparaissent qu'après hydratation
est une page qui se partage mal — et le partage est souvent la première source
de trafic.

### La latence se déplace là où on peut la traiter

C'est le point vraiment structurant. Une application qui interroge une API
lente — un nœud RPC, un CRM, un ERP, un service tiers à 400 ms — paie cette
latence à chaque visite en CSR, sur chaque appareil.

Côté serveur, la même requête peut être mise en cache, mutualisée entre tous
les visiteurs, exécutée depuis un réseau rapide et proche. La latence ne
disparaît pas ; elle est payée une fois au lieu d'être payée par chacun.

### Les secrets restent secrets

Une clé d'API dans du code client est une clé publique. La minification n'y
change rien : elle est dans le bundle, lisible en trois clics dans les
DevTools.

```tsx
// ❌ Composant client : la clé part chez l'utilisateur.
"use client";
const data = await fetch(`https://api.exemple.com?key=${process.env.NEXT_PUBLIC_KEY}`);

// ✅ Server Component : la clé ne quitte jamais le serveur.
async function Prices() {
  const data = await fetch("https://api.exemple.com", {
    headers: { Authorization: `Bearer ${process.env.API_KEY}` },
    next: { revalidate: 60 },
  });
  return <PriceTable rows={await data.json()} />;
}
```

Le préfixe `NEXT_PUBLIC_` n'est pas une option de configuration, c'est un
avertissement : cette valeur sera publique.

## Le côté sombre : l'hydratation

Le SSR a un défaut qu'il faut connaître, parce qu'il produit une expérience
particulièrement frustrante — la **vallée de l'étrange**.

Le HTML est arrivé, la page a l'air prête. L'utilisateur clique. Rien ne se
passe : le JavaScript n'a pas encore pris le relais. Une interface qui paraît
prête mais ne répond pas est pire qu'un indicateur de chargement honnête, parce
qu'elle ment.

Trois leviers, par ordre d'efficacité :

**Envoyer moins de JavaScript.** Un Server Component n'a rien à hydrater. La
fenêtre d'inertie n'existe pas si le composant n'est pas interactif.

**Hydrater par îlots.** React ne bloque plus sur l'arbre entier : le travail
est découpé, priorisé, et une interaction de l'utilisateur fait remonter le
composant concerné en tête de file.

**Rendre visible ce qui n'est pas prêt.** Si un bouton dépend de JavaScript,
qu'il soit `disabled` dans le HTML initial et activé à l'hydratation. Un bouton
grisé qui s'active est honnête ; un bouton actif qui ne répond pas ne l'est pas.

## Le streaming : ne pas attendre le plus lent

L'erreur la plus coûteuse en SSR : attendre que **toutes** les données soient
prêtes avant d'envoyer quoi que ce soit. La page entière avance alors à la
vitesse de sa requête la plus lente.

```tsx title="app/dashboard/page.tsx"
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <>
      {/* Part immédiatement : ne dépend d'aucune donnée. */}
      <Header />
      <Summary />

      {/* Streamé dès que prêt, sans retenir le reste de la page. */}
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart />
      </Suspense>

      <Suspense fallback={<FeedSkeleton />}>
        <ActivityFeed />
      </Suspense>
    </>
  );
}
```

La coque part en quelques dizaines de millisecondes, les trous se remplissent
au fil de l'eau. Le TTFB cesse d'être l'otage de la requête la plus lente.

Deux conditions pour que ça marche vraiment :

- **Les `fallback` doivent avoir la bonne hauteur**, sinon le décalage de mise
  en page est simplement reporté un peu plus tard.
- **Ne pas `await` avant le premier `Suspense`.** Un seul `await` dans le
  composant de page, en amont, annule tout le bénéfice : plus rien ne part
  tant qu'il n'est pas résolu.

## Où exécuter le rendu ?

| Environnement | Démarrage à froid | API disponibles         | Bon pour                                   |
| ------------- | ----------------- | ----------------------- | ------------------------------------------ |
| Node.js       | Notable           | Complètes (`fs`, natifs) | Rendu lourd, accès base, dépendances riches |
| Edge          | Quasi nul         | Restreintes (Web API)   | Redirections, personnalisation légère, géo  |

L'Edge exécute le code au plus près de l'utilisateur : la latence réseau est
minimale. Mais l'environnement est bridé — pas de `fs`, pas de modules natifs,
pas de client de base de données classique, et une limite de taille sur le code
déployé.

Le mauvais réflexe est d'y mettre le rendu complet d'une page qui appelle une
base située dans une seule région : tu gagnes 30 ms de proximité utilisateur et
tu en perds 200 sur la requête, parce que ton Edge est maintenant loin de ta
base. **L'Edge est excellent pour ce qui décide, moyen pour ce qui calcule.**

Le middleware est le cas d'usage idéal : détection de langue, tests A/B,
redirections, garde d'authentification. Court, sans dépendance lourde, exécuté
à chaque requête.

## Statique, ISR, SSR, PPR

Le SSR n'est pas un but en soi. C'est un point sur un axe, et le meilleur point
est presque toujours plus à gauche.

| Stratégie | Quand le HTML est produit         | Coût par visite | Fraîcheur          |
| --------- | --------------------------------- | --------------- | ------------------ |
| Statique  | Au build                          | Nul             | Au déploiement     |
| ISR       | Au build, régénéré après un délai | Quasi nul       | Réglable           |
| SSR       | À chaque requête                  | Élevé           | Immédiate          |
| PPR       | Coque au build, trous à la requête | Faible          | Immédiate là où il faut |

La règle : **statique par défaut, dynamique par exception**. Une page rendue à
la demande doit pouvoir expliquer pourquoi elle ne peut pas être pré-rendue.

Le **Partial Prerendering** est ce qui réconcilie les deux, et c'est la
direction prise par Next.js. Une coque statique part du CDN instantanément ;
les zones réellement dynamiques — le panier, le nom de l'utilisateur, un prix
en direct — sont streamées ensuite. Encore expérimental, mais c'est
manifestement là que va l'écosystème.

### Le piège des bascules involontaires

Une page peut passer en dynamique sans que personne ne l'ait décidé. Lire
`cookies()`, `headers()` ou `searchParams` dans un composant suffit, où que ce
soit dans l'arbre.

```bash
npm run build
```

La sortie indique le mode de chaque route. C'est la première chose à relire
après avoir ajouté une fonctionnalité : une page passée de statique à dynamique
sans raison, c'est un TTFB multiplié par dix pour un besoin qui n'existait pas.

## Le paysage en 2026

| Framework | Écosystème       | Ce qui le distingue                                    |
| --------- | ---------------- | ------------------------------------------------------ |
| Next.js   | React            | Server Components, PPR, l'écosystème le plus fourni     |
| Nuxt      | Vue              | Expérience développeur très aboutie, SSR fluide         |
| Remix     | React            | Adossé aux standards web, gestion des formulaires       |
| SvelteKit | Svelte           | Le plus léger à l'exécution, très rapide                |
| Astro     | Multi-framework  | Sites de contenu avec des îlots d'interactivité         |

Le choix se fait moins sur la technique que sur ce que tu construis. Pour un
site majoritairement éditorial avec quelques zones interactives, Astro envoie
nettement moins de JavaScript. Pour une application complète, Next.js et Nuxt
sont les plus outillés.

## En résumé

Le rendu serveur n'est pas un retour en arrière, c'est un partage du travail :
le serveur livre du contenu immédiatement, le JavaScript rend la page vivante
ensuite.

1. **La vraie valeur n'est pas le SEO** mais le déplacement de la latence vers
   un endroit où on peut la traiter, et la protection des secrets.
2. **L'hydratation est le coût du modèle.** On le réduit en envoyant moins de
   JavaScript, pas en le cachant.
3. **Le streaming évite d'attendre le plus lent** — à condition de ne pas
   `await` en amont.
4. **L'Edge est fait pour décider, pas pour calculer.**
5. **Statique par défaut**, et on relit la sortie du build pour vérifier qu'on
   n'a pas basculé sans le vouloir.

Le but n'a jamais été de rendre côté serveur pour le principe. Il est d'envoyer
à l'utilisateur quelque chose d'utile le plus tôt possible — et le HTML reste,
de loin, ce qui arrive le plus vite.
