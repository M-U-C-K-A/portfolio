# Atlas — générateur procédural de mondes (style Hearts of Iron)

Génère une planète fictive complète — tectonique, relief, érosion, climat, fleuves, lacs, biomes — et
l'affiche avec un rendu cartographique inspiré de HOI4. Chaque graine produit un monde différent et
reproductible.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build statique dans dist/
npx tsx scripts/bench.ts <graine> <largeur> <dossier> ['{"landFraction":0.4}']  # génération + aperçus PNG en Node
```

## Interface et commandes

La carte occupe tout l'écran. Les réglages de génération sont dans une pop-in, ouverte au lancement
(sauf lien `#seed=…`) et via **⟳ Recréer** : graine, résolution (1024 → 8192 de large), planète, climat,
géopolitique, statistiques du monde actuel ; « Nouvelle géopolitique » garde le même terrain.
Le dernier monde est sauvegardé dans le navigateur (IndexedDB, depuis le worker) : rafraîchir la page le
recharge tel quel en quelques secondes au lieu de le régénérer.

| Action | Contrôle |
| --- | --- |
| Déplacer / zoomer | glisser, molette, double-clic (zoom max ×64) |
| Filtres de carte | barre du bas (cliquable) ou clavier : `1`–`6` `E` (États) `H` (régions) géopolitique, `7`–`0` `T` `P` `B` géographie |
| Fiche détaillée | clic sur un pays, une ville, une province, une culture ou une religion (Échap pour fermer) |
| Chroniques (encyclopédie) | bouton **📜 Chroniques** ou `C` |
| Frise historique (carte à une date, lecture animée, événements) | bouton **⌛ Frise** ou `Y` |
| Compteur de performances (images/s, temps de rendu) | `I` |
| Éditeur (frontières au pinceau, noms, régimes, couleurs, souverains, villes) | bouton **✎ Éditeur** ou `K` · annuler `Ctrl/⌘ Z`, rétablir `Ctrl/⌘ Y` |
| Affichage (relief, fleuves, grille, curseur de faction, export) | bouton **⚙ Affichage** · `R` / `G` |
| Nuages · jour / nuit · forêts · villes illustrées · navires et créatures | bascules rondes en bas à droite · `U` / `J` / `O` / `V` / `M` |
| Exporter (cartes de toutes les vues jusqu'en 12K, chroniques illustrées HTML, données JSON, archive ZIP ou dossier) | **⚙ Affichage → Exporter…** |
| Créer un monde | bouton **⟳ Recréer** ou `N` |
| Vue d'ensemble | `F` |

La graine est dans l'URL (`#seed=…`) : un lien suffit pour partager un monde.

Résolution : la simulation complète va jusqu'à 8192 × 3277 (27 M de cellules, ~4 min, ~3 Go pour le worker ;
les textures sont envoyées au GPU par bandes pour ne pas doubler la mémoire). Au-delà (12 288 de large =
60 M de cellules, ~7 Go), ce n'est plus faisable dans un onglet ; l'export **PNG 12K** grave en revanche le monde en 12 288 px par tuiles WebGL, avec le micro-relief
procédural et la couche vectorielle (fleuves, noms, villes) à l'échelle.

Pendant la génération, le worker envoie des images du monde (1024 px) à chaque étape, toutes dans les
teintes de la carte finale — croûte des plaques, relief, érosion, climat, fleuves, forêts, puis frontières
de provinces, de pays et d'États tracées à l'encre, le monde aux origines de la frise et aujourd'hui en
lavis de couleurs. L'écran (`src/ui/genview.ts`, WebGL) les « développe » comme une image qui se débruite :
la carte est découpée en tronçons qui passent chacun, à leur tour, du bruit au flou puis au net à mesure
que la génération avance (à la manière des chunks de Minecraft), sur la carte plane comme sur un globe en
rotation ; une loupe parcourt le détail de l'image la plus récente, à côté du journal des étapes.

Toute l'interface a des infobulles (`src/ui/tips.ts`) : vues de la carte, boutons, options d'affichage,
réglages de création, entrées des Chroniques (résumé du pays, de la dynastie, du peuple ou de la religion).

## Pipeline de génération (`src/gen/`, exécuté dans un Web Worker)

1. **Grille** (`grid.ts`) — équirectangulaire, bouclée en longitude, de −latMax à +latMax. Tous les bruits
   sont échantillonnés sur la sphère 3D : pas de couture, déformation polaire réaliste.
2. **Plaques tectoniques** (`tectonics.ts`) — germes espacés ; croissance par front dont la priorité est la
   distance réelle au germe (pondérée par plaque) plus un décalage bruité propre à chaque plaque : frontières
   sinueuses à toutes les échelles (une somme de pas 8-voisins donnait des frontières, rifts et lacs
   rectilignes). Rotation rigide autour d'un pôle d'Euler par plaque ; chaque frontière est classée
   **convergente / divergente / transformante** d'après la vitesse relative, lissée le long de la frontière.
   La distance à la frontière (profils de chaînes, fosses, rifts) est géodésique, non chanfreinée ; les
   profils tectoniques sont lissés (~45 km) avant la rugosité, sinon chaque point-frontière imposait ses
   propriétés à un « rayon » de terrain et laissait des crêtes rectilignes perpendiculaires à la frontière.
3. **Relief** (`relief.ts`)
   - croûte continentale : plaques continentales floutées à deux échelles (dôme) + bruit basse fréquence,
     amincie près des rifts (ouverture d'océans type Atlantique), micro-continents ;
   - profil plaine abyssale → talus → plateau continental → plaines côtières → intérieur ;
   - orogenèse selon le type de frontière et la croûte des deux côtés : collision (Himalaya + plateau),
     subduction sous un continent (cordillère + fosse), arcs insulaires, dorsales médio-océaniques,
     rifts continentaux ; points chauds (chaînes volcaniques type Hawaï alignées sur le mouvement de la
     plaque) ; vieilles chaînes érodées ; régions de collines ; piémonts ;
   - niveau de la mer fixé pour obtenir exactement la part de terres demandée (pondérée par la surface).
4. **Circulation atmosphérique** (`climate.ts`) — cellules de Hadley/Ferrel/polaire, courants océaniques
   (upwellings froids, courants chauds de bord ouest, dérive nord-atlantique), advection de l'humidité,
   pluies orographiques et ombre pluviométrique, recyclage par la végétation, continentalité.
5. **Érosion fluviale** (`erosion.ts`, `drainage.ts`) — loi de puissance (stream power), schéma implicite
   de Braun & Willett, aire drainée pondérée par la pluie, diffusion de versant dépendant de l'altitude.
6. **Hydrographie** (`hydrology.ts`) — priority-flood avec percée des verrous (breaching), débits
   (ruissellement de Budyko), lacs avec bilan hydrique : lac d'eau douce à exutoire ou lac salé
   endoréique dont le niveau baisse jusqu'à l'équilibre (voire salar), tracé des fleuves lissé.
7. **Biomes** (`biomes.ts`) — température × aridité (P/ETP), altitude, pente, humidité du sol.

## Géopolitique (`src/gen/politics/`, recalculée seule si le terrain ne change pas)

1. **Continents géologiques** (`continents.ts`) — terres + plateau continental (< 500 m de fond) connexes,
   découpés par plaque tectonique quand plusieurs grands cratons sont soudés ; îles océaniques rattachées
   au bloc proche ou regroupées en archipels.
2. **Peuplement** (`habitat.ts`) — habitabilité (biome, altitude, pente, fleuves, côtes) → densité.
3. **Villes** (`cities.ts`) — sites favorables (confluences, embouchures, baies, lacs), espacement
   selon la fertilité, population par bassin de peuplement.
4. **Provinces** (`provinces.ts`, `graph.ts`) — une par ville + germes denses dans les régions peuplées,
   croissance où grands fleuves, crêtes et lacs font frontière ; type de terrain façon HOI4.
5. **Pays** (`countries.ts`) — capitales espacées parmi les grandes villes, expansion sur le graphe des
   provinces (montagnes, fleuves frontaliers, détroits freinent), puissance variable, îles isolées en
   États propres ou possessions. Noms par langues procédurales (famille par continent, dialecte par pays).
6. **Commerce** (`trade.ts`) — routes par A* sur le terrain (réutilisation → axes principaux), lignes
   maritimes entre ports, flux gravitaires entre **toutes** les paires de villes routés sur le réseau,
   trafic cumulé par tronçon, principaux partenaires de chaque ville.
7. **Zones d'influence** (`influence.ts`) — aires de marché par coût de trajet pondéré par la taille.

### Lore (même dossier)

- **Cultures** (`cultures.ts`) — familles culturelles puis cultures diffusées depuis des foyers historiques,
  indépendamment des frontières actuelles (minorités, peuples transfrontaliers), traits liés au milieu,
  langues apparentées : les toponymes d'un peuple partagent sa phonologie. Les États suivent de préférence
  les frontières culturelles.
- **Religions** (`religions.ts`) — grandes fois nées dans des villes saintes, diffusées par le commerce et
  l'affinité culturelle, religions d'État et conversions partielles, schismes en confessions régionales,
  cultes traditionnels là où rien n'est arrivé. Doctrine, clergé, lieux de culte, texte sacré, préceptes.
- **Dynasties** (`dynasties.ts`, `heraldry.ts`) — maisons régnantes avec lignée (numéros de règne, parenté,
  fins de règne), branches cadettes et unions dynastiques, devise, armoiries blasonnées en français
  héraldique ; dirigeants élus pour les républiques ; portraits choisis parmi `public/face/` (âge, sexe,
  coiffe selon le titre, style selon la latitude du foyer culturel — `src/ui/faces.ts`).
- **Chroniques** (`lore.ts`) — alliés, rivaux héréditaires, frise d'événements et récit de chaque pays.
- **États et régions historiques** (`states.ts`) — comme dans HOI4 : chaque pays est découpé en États de
  quelques provinces autour d'une ville principale (limites de préférence sur les crêtes, grands fleuves et
  limites de peuples ; îlots rattachés par la mer), nommés dans la langue du peuple (« Haute- / Basse- »,
  « Val de », « Côte de », « Monts de »…), avec catégorie (mégalopole → terres sauvages) et ressources ;
  les régions historiques regroupent des États voisins par la géographie (plaines, massifs, littoraux,
  archipels, marches) sans tenir compte des frontières.
- **Frise historique** (`history.ts`) — l'histoire est « déroulée à rebours » depuis la carte actuelle :
  en remontant le temps, on défait des conquêtes, on dissout les pays fondés cette année-là (retour dans
  le pays dont ils ont fait sécession, ou éclatement en principautés qu'ils ont unifiées) et l'on recrée
  des pays disparus (annexés ou hérités). Relue dans l'ordre, la suite de transferts d'États aboutit
  exactement à la carte actuelle (vérifié) : ~170 pays à l'origine, guerres nommées (« Deuxième guerre du
  Val de X », « Guerre sainte de Y »), unifications, indépendances, héritages après mariage, révoltes,
  schismes. La carte, ses noms et ses couleurs suivent le curseur de la frise. Quand un pays prend le
  contrôle d'un autre, sa couleur se répand sur les provinces conquises comme une encre, derrière un front
  doré (shader : pays précédent et instant du changement par province), et un bandeau nomme l'événement
  sur la région concernée.

## Rendu (`src/render/`)

- WebGL2, un seul fragment shader : altitude bicubique + micro-relief procédural révélé au zoom,
  ombrage, couleur de végétation continue (table température × aridité), roche et neige selon
  pente/altitude/température, bathymétrie, banquise, côtes via champ de distance signée.
- Frontières politiques lissées par vote majoritaire bilinéaire + légère déformation (pas d'escaliers).
- Couche Canvas 2D : fleuves, noms de pays/continents courbes façon HOI4, villes et capitales, réseau
  commercial, arcs vers les partenaires de la ville sélectionnée, vecteurs des plaques, vents.
- Ciel (shader) : nuages advectés par les vents dominants (alizés, vents d'ouest, vents polaires), couverture
  selon les précipitations, ombres portées, estompés au fort zoom ; cycle jour / nuit avec terminateur,
  lueur du crépuscule, campagnes faiblement éclairées et halos des villes (`life.ts`) selon la population.
- Villes illustrées (`cityicons.ts`) : petites maisons en perspective cavalière, toits teintés aux couleurs
  du pays, forme selon le peuple (pignon, croupe, avant-toits relevés, terrasses au désert, colombages au
  nord), lieu de culte selon la religion (clocher, dôme et minaret, pagode, ziggourat), remparts pour les
  grandes villes, château et bannière pour les capitales (quatre tours et double enceinte au-delà de
  2 M d'habitants), quai, navire amarré et phare côté mer pour les ports, arbres selon le climat.
- Identité graphique : un seul « atlas peint » — lumière du nord-ouest, ombres au sud-est, teintes
  naturelles légèrement désaturées. Forêts et eaux font partie de la peinture du terrain, pas des
  autocollants posés dessus ; seules les œuvres humaines (villes, navires) sont des illustrations.
- Forêts peintes dans le shader du terrain (`forestPaint`) : densité et type de couvert par biome
  (feuillus, résineux, forêt tropicale dense, arbres épars), lus à une position déformée par du bruit pour
  que les lisières ne suivent pas la grille ; houppiers vus de dessus (cellules de Worley) éclairés comme
  le relief, avec leur ombre portée, sur un sol forestier assombri en proportion du couvert ; deux niveaux
  de grille fondus selon le zoom pour une taille d'arbre lisible ; arbres isolés seulement de près. Sous les
  teintes politiques, la forêt reste visible comme le relief.
- Fleuves en rubans (`overlay.ts`) : largeur croissant doucement avec le débit, berge puis eau tracées
  pour tout le réseau (confluences sans bourrelet), embouchure de chaque affluent raccordée exactement à
  la rivière qui le reçoit, lissage supplémentaire au fort zoom, petits cours d'eau seulement de près.
- Micro-relief du shader : caractère régional (crêtes vives ou croupes arrondies, rugosité, pente spectrale)
  et domaine déformé, pente calculée par dérivées écran (un seul échantillon de bruit par pixel).
- Vie marine (`life.ts`) : caraques marchandes sur les lignes maritimes, convois sur les routes (mode
  Commerce) — les voyageurs vont de carrefour en carrefour sur le réseau, pondérés par le trafic ;
  baleines et serpents de mer dans les grands fonds, qui font surface puis replongent.
- Interface : styles de [warcraftcn/ui](https://github.com/TheOrcDev/warcraftcn-ui) (MIT) repris en CSS pur
  (`src/ui/warcraft.css`, `public/warcraftcn/`) — info-bulle à « rareté » (importance), fiche en cadre de
  bois, accordéons, onglets, cadres d'avatar pour les souverains, curseurs de faction (choisis via les héros),
  panneaux (fond du menu déroulant), champs de saisie, cases à cocher, boutons. La page déclare
  `color-scheme: dark`, `forced-color-adjust: none` et `darkreader-lock` pour que le navigateur ou une
  extension ne recolore pas l'interface.

## Éditeur (`src/world-edit.ts`, `src/ui/editor.ts`)

Pinceau de frontières (province par province ou État entier), clic droit pour choisir le pays sous le
curseur ; nom, régime, couleur et souverain du pays ; nom des villes. Superficie, population, voisins,
capitale (transférée à la plus grande ville si elle est perdue), États et étiquettes sont recalculés ; le
rendu passe par une table province → pays (texture `uProv`), si bien que la carte se met à jour sans
renvoyer les données par cellule. Annuler / rétablir, sauvegarde automatique, export avec les retouches.

## Suite prévue

Régénération plus fine d'une région choisie (îles, côtes), mers stratégiques, économie et ressources.

### Export

Sous Chrome et Edge, l'export demande d'abord où écrire (fichier `.zip` ou dossier, via l'API File System
Access) puis écrit chaque fichier sur le disque dès qu'il est prêt : pas de limite de téléchargements
multiples, et une archive de plusieurs centaines de Mo ne passe jamais par la mémoire JavaScript
(`ZipWriter` en flux, CRC lu par morceaux). Ailleurs (Firefox, Safari, Brave), l'archive est téléchargée
en un seul fichier, et l'option « Fichiers séparés » ouvre une liste de liens à cliquer un par un — les
navigateurs bloquent les téléchargements automatiques au-delà du premier.

### Performances

Le terrain (shader) est calculé en demi-résolution pendant un déplacement ou un zoom, puis recalculé net
à l'arrêt. Les fleuves sont simplifiés selon le zoom et gardés en cache pendant un geste ; les icônes de
villes sont regroupées par paliers de taille (au plus ±12 % d'agrandissement), dessinées une fois et
gardées en ImageBitmap, avec un budget de création par image. Les icônes suivent l'échelle de la carte et
deviennent de simples repères quand elles seraient trop petites. Mesures (Apple M4, écran retina simulé) :
~17 ms par image en moyenne pendant un zoom continu, 60 images/s en déplacement. La touche `I` affiche le
compteur de performances en direct.

