# Aperçus des projets

Les vues du carrousel d'un cas d'étude. La couverture, elle, n'est pas ici :
c'est une composition générée, voir `src/lib/project-cover.ts`.

Un fichier par vue, déclaré dans `src/lib/content.ts` par `shot()`. Le premier
argument est le nom du fichier, **extension comprise** : `shot("plum-2.jpg", …)`
lit `plum-2.jpg`. C'est là aussi que se trouve la légende de chaque image, qui
dit ce qu'elle doit montrer.

Finalytics et Corpus Delta ont leurs vraies captures. Noxus et Plum n'en ont
aucune : mieux vaut pas d'image du tout qu'une image d'emprunt. Leur carrousel
ne s'affiche pas tant qu'il est vide, et la couverture porte seule.

## Déposer une capture

Le format est libre — PNG, JPEG, ou une vidéo (`kind: "video"`, jouée en boucle
et sans son, dix fois plus légère qu'un GIF). N'importe quelles dimensions : le
carrousel a une hauteur fixe et chaque vue prend la largeur que lui donne son
rapport. Il faut
seulement **reporter ses dimensions dans `content.ts`** : elles réservent la
place avant le chargement et donnent son rapport à la figure, qui épouse donc
l'image au lieu de la recadrer. Des dimensions fausses la feraient rogner.

Deux pannes que rien d'autre ne signale — un fichier absent donne un 404
silencieux, des dimensions fausses un recadrage silencieux. `npm test` échoue
dans les deux cas.
