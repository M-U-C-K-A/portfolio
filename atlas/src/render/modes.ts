export const MAP_MODES = [
  { id: 'political', label: 'Pays', key: '1', group: 'geo', tip: 'Carte politique : frontières des États, capitales et villes. Survolez un pays pour ses informations, cliquez pour ouvrir sa fiche.' },
  { id: 'provinces', label: 'Provinces', key: '2', group: 'geo', tip: 'Découpage administratif : chaque province en nuance de la couleur de son pays. Cliquez une province pour sa fiche.' },
  { id: 'states', label: 'États', key: 'e', group: 'geo', tip: "États à la manière de Hearts of Iron IV : quelques provinces d'un pays autour d'une ville principale, avec leur nom, leur catégorie (de la mégalopole aux terres sauvages) et leurs ressources. Cliquez un État pour sa fiche." },
  { id: 'regions', label: 'Régions', key: 'h', group: 'geo', tip: 'Régions historiques : grands ensembles géographiques (plaines, massifs, littoraux, archipels) qui ignorent les frontières politiques. Cliquez une région pour sa fiche.' },
  { id: 'cultures', label: 'Cultures', key: '3', group: 'geo', tip: 'Peuples et familles culturelles (traits épais). Ils ignorent les frontières politiques : minorités et peuples transfrontaliers.' },
  { id: 'religions', label: 'Religions', key: '4', group: 'geo', tip: 'Confession dominante de chaque province ; médaillons sur les villes saintes, traits épais entre grandes familles religieuses.' },
  { id: 'trade', label: 'Commerce', key: '5', group: 'geo', tip: 'Réseau commercial : routes terrestres (épaisseur = trafic) et lignes maritimes, convois et navires en mouvement. Cliquez une ville pour voir ses partenaires.' },
  { id: 'influence', label: 'Influence', key: '6', group: 'geo', tip: "Zones d'influence des villes : aire de marché selon le temps de trajet et la taille ; l'intensité décroît loin du centre." },
  { id: 'terrain', label: 'Terrain', key: '7', group: 'phys', tip: 'Rendu naturel : végétation selon le climat, roche et neige des montagnes, lacs, fleuves, banquise.' },
  { id: 'relief', label: 'Relief', key: '8', group: 'phys', tip: 'Altitudes en teintes hypsométriques, de la plaine verte aux sommets enneigés, et profondeurs marines.' },
  { id: 'continents', label: 'Continents', key: '9', group: 'phys', tip: 'Continents géologiques : terres émergées et plateaux continentaux immergés (moins de 500 m de fond).' },
  { id: 'plates', label: 'Plaques', key: '0', group: 'phys', tip: 'Plaques tectoniques et leurs frontières : convergentes (rouge), divergentes (bleu), transformantes (jaune).' },
  { id: 'temperature', label: 'Températures', key: 't', group: 'phys', tip: 'Température moyenne annuelle, selon la latitude, l\'altitude et les courants.' },
  { id: 'precipitation', label: 'Précipitations', key: 'p', group: 'phys', tip: 'Précipitations annuelles (mm) : vents dominants, effet de foehn derrière les montagnes, déserts sous les anticyclones.' },
  { id: 'biomes', label: 'Biomes', key: 'b', group: 'phys', tip: 'Grands biomes déduits de la température et de l\'aridité : forêts, steppes, déserts, toundra…' },
] as const;

export type MapMode = (typeof MAP_MODES)[number]['id'];

export const modeIndex = (m: MapMode): number => MAP_MODES.findIndex((x) => x.id === m);

/** Modes où la géopolitique (villes, étiquettes) est affichée. */
export const GEO_MODES: readonly MapMode[] = ['political', 'provinces', 'states', 'regions', 'cultures', 'religions', 'trade', 'influence'];
