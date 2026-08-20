# Visuels des projets

Un fichier par image, déclaré dans `src/lib/content.ts` par `shot()`. Le premier
argument est le nom du fichier, **extension comprise** : `shot("plum-2.jpg", …)`
lit `plum-2.jpg`. C'est là aussi que se trouve la légende de chaque image, qui
dit ce qu'elle doit montrer.

Finalytics a ses vraies captures. Les autres projets portent encore des photos
de remplacement, en attendant les leurs.

## Déposer une capture

Le format est libre — PNG ou JPEG, n'importe quelles dimensions. Il faut
seulement **reporter ses dimensions dans `content.ts`** : elles réservent la
place avant le chargement et donnent son rapport à la figure, qui épouse donc
l'image au lieu de la recadrer. Des dimensions fausses la feraient rogner.

Deux pannes que rien d'autre ne signale — un fichier absent donne un 404
silencieux, des dimensions fausses un recadrage silencieux. `npm test` échoue
dans les deux cas.
