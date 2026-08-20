# Visuels des projets

Les fichiers ici sont des **photos de remplacement**. Pour mettre les vraies
captures : écraser le fichier, garder le nom et les dimensions. Rien d'autre à
toucher.

- Le nom du fichier est l'argument passé à `shot()` dans `src/lib/content.ts` :
  `shot("plum-2", …)` lit `plum-2.jpg`. C'est là aussi que se trouve la légende
  de chaque image, qui dit ce qu'elle doit montrer.
- Les dimensions comptent : elles réservent la place avant le chargement et
  donnent son rapport à la figure. Un fichier d'un autre format serait recadré.
  Applications mobiles 900×1600, sites 1600×1000, bandeaux 1600×900.
- `npm test` échoue si un fichier manque ou n'a pas les dimensions déclarées.
