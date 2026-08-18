---
title: "REST, GraphQL, WebSockets : choisir comment tes données circulent"
description: "Chaque protocole est un type de conversation. Le tour complet — REST, polling, GraphQL, WebSockets, SSE, webhooks, gRPC, Server Actions, tRPC — avec le critère qui permet de trancher."
date: "2026-01-14"
tags: ["Architecture", "API", "Next.js", "Temps réel"]
---

Comment les données circulent entre le client et le serveur est l'une des
décisions les plus structurantes d'un projet. C'est aussi celle qu'on prend le
plus vite, souvent par habitude, et qu'on paie le plus longtemps.

La manière la plus utile de s'y retrouver est de voir chaque protocole comme un
**type de conversation**. Parfois on veut un courrier formel, parfois un SMS,
parfois une ligne téléphonique qu'on ne raccroche jamais.

## REST : le courrier

La base du web moderne. Chaque URL est une ressource, chaque verbe HTTP une
intention. C'est prévisible, cachable, et tout le monde sait le lire.

> **Client** — `GET /api/factures/42`
> **Serveur** — 200, voici la facture complète.

Le vrai avantage de REST est celui qu'on oublie : **il est cachable par toute
l'infrastructure**. Navigateur, CDN, proxy — tout le monde comprend un `GET`
avec un `ETag`. Aucun autre protocole de cette liste n'offre ça gratuitement.

Sa limite est aussi connue : le sur-transfert. Tu veux un prénom, tu reçois
l'objet utilisateur complet. Et le sous-transfert, son symétrique : afficher une
page demande trois appels enchaînés.

**Pour** : API publiques, CRUD, tout ce qui doit être consommé par des clients
que tu ne contrôles pas.

## Le polling : « on arrive quand ? »

Quand un traitement prend du temps, le client doit bien savoir quand c'est prêt.

**Le polling court** interroge toutes les X secondes.

> — C'est prêt ? — Non. *(2 s)* — C'est prêt ? — Non. *(2 s)* — C'est prêt ? — Oui.

Simple, et coûteux : sur mille utilisateurs et un intervalle de deux secondes,
c'est cinq cents requêtes par seconde dont la quasi-totalité ne rapportent
rien. Ça réveille aussi la radio du téléphone en permanence — l'ennemi numéro un
de l'autonomie.

**Le polling long** garde la requête ouverte jusqu'à ce qu'une réponse existe.

> — C'est prêt ? — *(le serveur attend 25 s, puis répond)* Oui.

Bien meilleur rapport signal/bruit, au prix d'une connexion maintenue par
client. C'est une solution de repli honorable, pas une cible.

**Pour** : un correctif rapide, ou un repli quand le temps réel n'est pas
disponible.

## GraphQL : le personnel de courses

Le client décrit ce dont il a besoin, le serveur renvoie exactement cela.

> **Client** — De l'utilisateur 42, je veux `username` et `photo_url`. Rien d'autre.
> **Serveur** — Voici ces deux champs.

Un aller-retour au lieu de trois, et une charge utile réduite. Sur des
interfaces riches alimentées par de nombreuses entités, le gain est net.

Ce que ça coûte, en revanche, est rarement annoncé :

- **Le cache HTTP disparaît.** Tout passe par un `POST` sur une seule URL. Il
  faut reconstruire une couche de cache applicative.
- **Les requêtes N+1** se propagent sans qu'on les voie. `DataLoader` n'est pas
  optionnel, c'est une condition de fonctionnement.
- **La complexité est une surface d'attaque.** Une requête profondément
  imbriquée peut mettre un serveur à genoux ; il faut plafonner la profondeur
  et le coût.

**Pour** : des applications riches en données, avec plusieurs clients aux
besoins différents — web, mobile, partenaires.

## WebSockets : la ligne ouverte

Une connexion bidirectionnelle persistante. Les deux parties parlent quand elles
veulent.

> **Client** — Je me connecte. *(la ligne reste ouverte)*
> **Serveur** — Nouveau message.
> **Client** — Je suis en train d'écrire.

C'est le seul de la liste à offrir un vrai canal montant en temps réel. C'est
aussi le plus exigeant en exploitation : connexions à maintenir, reconnexion
avec temporisation exponentielle, état à partager entre instances, montée en
charge à penser. Une infrastructure sans état ne gère pas les WebSockets sans
un service dédié.

**Pour** : messagerie, édition collaborative, jeu, tout ce qui a besoin de
remonter des événements du client vers le serveur en continu.

## SSE : la radio

Comme les WebSockets, mais dans un seul sens : du serveur vers le client. Et
c'est du HTTP standard.

> **Client** — `GET /api/flux`, je reste à l'écoute.
> **Serveur** — Événement. *(plus tard)* Événement.

C'est le protocole le plus sous-utilisé du lot, et souvent le bon choix. Il
passe les proxys et les pare-feux sans configuration, il **reconnecte tout seul**
via `EventSource`, et il tient dans une trentaine de lignes des deux côtés.

```ts title="app/api/flux/route.ts"
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of watchEvents()) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

```ts title="components/live-feed.tsx"
const source = new EventSource("/api/flux");
source.onmessage = (event) => setItems((prev) => [JSON.parse(event.data), ...prev]);
// Pas de logique de reconnexion à écrire : le navigateur s'en charge.
```

**Pour** : notifications, tableaux de bord en direct, flux de tokens d'un
modèle de langage, barres de progression. Autrement dit : la grande majorité
des besoins « temps réel », qui sont en fait descendants.

## Webhooks : « ne m'appelle pas, je t'appelle »

L'inversion complète : c'est un service tiers qui appelle ton serveur quand un
événement se produit.

> **Stripe** — `POST /api/webhooks/stripe` : paiement confirmé.
> **Ton serveur** — 200, reçu.

Trois règles non négociables :

1. **Vérifier la signature.** Sans cette vérification, n'importe qui peut
   déclarer un paiement réussi. C'est une faille critique, pas un détail.
2. **Répondre vite, traiter après.** Renvoie 200 immédiatement et empile le
   travail. La plupart des fournisseurs coupent au-delà de quelques secondes et
   réessaient — tu doublerais le traitement.
3. **Rendre le traitement idempotent.** Les webhooks sont réémis. Le même
   événement arrivera deux fois, et il ne doit pas facturer deux fois.

**Pour** : paiements, intégrations continues, tout événement asynchrone venant
d'un service que tu ne contrôles pas.

## gRPC : la formule 1

Des messages binaires typés par des Protocol Buffers, sur HTTP/2. Beaucoup plus
compact et plus rapide à sérialiser que du JSON.

Le point à connaître : **un navigateur ne parle pas gRPC directement**. Il faut
passer par gRPC-Web et un proxy. C'est une technologie de communication
inter-services, pas de front-end.

**Pour** : microservices, chemins critiques en performance, systèmes fortement
typés entre équipes.

## Ce que Next.js change : Server Actions et tRPC

**Les Server Actions** suppriment purement et simplement la couche API pour ton
propre front-end. Tu écris une fonction serveur et tu l'appelles depuis un
composant.

```tsx title="app/factures/actions.ts"
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

const schema = z.object({ clientId: z.string().uuid(), amount: z.number().positive() });

export async function createInvoice(formData: FormData) {
  // Toujours valider : une Server Action est un point d'entrée public,
  // exactement comme une route d'API.
  const parsed = schema.parse({
    clientId: formData.get("clientId"),
    amount: Number(formData.get("amount")),
  });

  await db.invoice.create({ data: parsed });
  revalidatePath("/factures");
}
```

Le gain en vitesse de développement est réel — plus de route à déclarer, plus
de types à synchroniser, et le formulaire fonctionne même sans JavaScript. La
limite l'est tout autant : ce n'est pas une API. Un client mobile ou un
partenaire ne peut pas la consommer.

**tRPC** garde une vraie couche API mais partage les types de bout en bout. Tu
renommes un champ côté serveur, l'éditeur signale l'erreur côté client
immédiatement, sans génération de code.

| Critère            | REST          | Server Actions      | tRPC              |
| ------------------ | ------------- | ------------------- | ----------------- |
| Typage             | Manuel (Zod, OpenAPI) | Partiel      | De bout en bout   |
| Vitesse de dev     | Lente         | Très rapide         | Rapide            |
| Client externe     | Facile        | Non prévu           | Possible, spécifique |
| Cache HTTP         | Natif         | Non                 | Non               |

## Sécuriser : la limitation de débit

Ouvrir une API, c'est ouvrir une porte. Il faut un videur, et il se met devant
tout ce qui coûte : authentification, envoi d'e-mail, upload, appel à un modèle.

```ts title="lib/rate-limit.ts"
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  // Fenêtre glissante : pas de rafale au changement de fenêtre, contrairement
  // à un compteur fixe où l'on peut passer deux quotas en deux secondes.
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
});
```

```ts title="app/api/contact/route.ts"
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonyme";
  const { success, reset } = await limiter.limit(ip);

  if (!success) {
    return new Response("Trop de requêtes", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
    });
  }
  // …
}
```

Le compteur doit être partagé — Redis, pas la mémoire du processus. En
serverless, chaque instance a sa propre mémoire : un compteur local ne limite
rien du tout.

### Sessions ou JWT

Le débat éternel, qui se tranche sur une seule question : **as-tu besoin de
révoquer ?**

**Le JWT** est autonome : le serveur le vérifie sans consulter de base. Rapide,
sans état, idéal entre services. Mais il reste valide jusqu'à son expiration.
Un utilisateur banni conserve l'accès jusqu'à la fin du jeton — et une liste de
révocation réintroduit l'état qu'on voulait éviter.

**La session en base**, avec un cookie `HttpOnly`, coûte une lecture par
requête et permet de couper un accès instantanément.

Pour une application classique, la session gagne : la lecture est indexée,
donc négligeable, et la révocation immédiate est une vraie exigence
opérationnelle. Le JWT reste pertinent entre services, où l'on contrôle les
deux extrémités et où les durées sont courtes.

Dans les deux cas : cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Un jeton dans
`localStorage` est lisible par n'importe quel script injecté.

## Le tableau de décision

| Technologie   | Sens              | Difficulté | Cas d'usage type                  |
| ------------- | ----------------- | ---------- | --------------------------------- |
| REST          | Requête/réponse   | Faible     | CRUD, API publiques               |
| Polling long  | Requête/réponse   | Faible     | Repli temps réel                  |
| GraphQL       | Requête/réponse   | Élevée     | Applications riches, clients multiples |
| SSE           | Serveur → client  | Moyenne    | Notifications, flux, progression  |
| WebSockets    | Bidirectionnel    | Élevée     | Chat, collaboration, jeu          |
| Webhooks      | Tiers → toi       | Faible     | Paiements, automatisations        |
| gRPC          | Service ↔ service | Très élevée | Microservices, haute performance |
| Server Actions| Client → serveur  | Très faible | Mutations internes Next.js       |

## Comment trancher

Trois questions suffisent presque toujours.

**Qui parle en premier ?** Si c'est toujours le client, REST ou Server Actions
suffisent. Si le serveur doit initier, il faut SSE ou WebSockets.

**Le client a-t-il besoin de remonter du flux ?** Si non — et c'est le cas neuf
fois sur dix — SSE fait le travail des WebSockets pour un dixième de la
complexité d'exploitation.

**Qui va consommer cette API ?** Toi seul, ou des clients que tu ne contrôles
pas ? Server Actions et tRPC sont excellents dans le premier cas, inadaptés
dans le second.

Le vrai savoir-faire n'est pas de connaître la technologie la plus en vue, mais
de choisir celle qui résout le problème avec le moins de complexité
superflue. Un `GET` bien caché bat une architecture temps réel dont personne
n'avait besoin.
