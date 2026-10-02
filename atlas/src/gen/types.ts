export interface GenSettings {
  /** Graine textuelle : même graine + mêmes réglages = même monde. */
  seed: string;
  /** Largeur de la grille en cellules (la hauteur découle de latMax). */
  width: number;
  /** Latitude couverte : de -latMax à +latMax (degrés). */
  latMax: number;
  /** Fraction de la surface émergée (0..1) — pilote le niveau de la mer. */
  landFraction: number;
  plateCount: number;
  /** Multiplicateur d'activité tectonique (hauteur des chaînes, profondeur des fosses). */
  tectonics: number;
  /** 0 = gros blocs continentaux compacts, 1 = archipels et côtes très découpées. */
  fragmentation: number;
  /** Intensité de l'érosion fluviale (0 = aucune). */
  erosion: number;
  /** Décalage global de température (°C). */
  temperature: number;
  /** Multiplicateur d'humidité (évaporation océanique). */
  humidity: number;
  /** Densité du réseau de fleuves affiché. */
  riverDensity: number;
  // --- géopolitique (ne nécessite pas de régénérer le terrain) ---
  countryCount: number;
  cityCount: number;
  /** Taille moyenne d'une province, en cellules. */
  provinceSize: number;
  /** Variante géopolitique : même planète, autre histoire. */
  politicsSeed: string;
}

/** Réglages qui n'affectent que la couche politique. */
export const POLITICS_KEYS = ['countryCount', 'cityCount', 'provinceSize', 'politicsSeed'] as const;

export function terrainKey(s: GenSettings): string {
  const t: Record<string, unknown> = { ...s };
  for (const k of POLITICS_KEYS) delete t[k];
  return JSON.stringify(t);
}

export const DEFAULT_SETTINGS: GenSettings = {
  seed: 'terra',
  width: 1536,
  latMax: 72,
  landFraction: 0.32,
  plateCount: 16,
  tectonics: 1,
  fragmentation: 0.5,
  erosion: 1,
  temperature: 0,
  humidity: 1,
  riverDensity: 1,
  countryCount: 48,
  cityCount: 420,
  provinceSize: 80,
  politicsSeed: '',
};

export interface PlateInfo {
  id: number;
  continental: boolean;
  /** Centroïde en coordonnées de cellule. */
  cx: number;
  cy: number;
  /** Vitesse au centroïde (cellules : x vers l'est, y vers le sud), unité arbitraire. */
  vx: number;
  vy: number;
  /** Part de la surface de la carte. */
  area: number;
}

/** Chemin d'étiquette courbe (Bézier quadratique) en coordonnées de cellule, x déroulé. */
export interface LabelPath {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  /** Hauteur de police en cellules. */
  size: number;
}

export interface ContinentInfo {
  id: number;
  name: string;
  kind: 'continent' | 'microcontinent' | 'archipel';
  /** Surfaces en km². */
  landArea: number;
  shelfArea: number;
  label: LabelPath | null;
}

export interface CultureGroupInfo {
  id: number;
  name: string;
  color: [number, number, number];
  cultures: number[];
}

export interface CultureInfo {
  id: number;
  /** Nom du peuple (« Valdois »). */
  name: string;
  /** Adjectifs masculin / féminin (« valdois », « valdoise »). */
  adjM: string;
  adjF: string;
  group: number;
  color: [number, number, number];
  /** Ville du foyer historique. */
  hearth: number;
  pop: number;
  area: number;
  provinces: number;
  traits: string[];
  /** Quelques mots de la langue (toponymes typiques). */
  sample: string[];
  label: LabelPath | null;
}

export interface ReligionInfo {
  id: number;
  name: string;
  /** Monothéisme, polythéisme, dualisme, philosophie, culte solaire, culte traditionnel. */
  kind: string;
  /** Religion mère pour une confession issue d'un schisme, sinon -1. */
  parent: number;
  folk: boolean;
  color: [number, number, number];
  symbol: string;
  holyCity: number;
  deity: string;
  founder: string;
  founded: number;
  tenets: string[];
  clergy: string;
  temples: string;
  scripture: string;
  description: string;
  pop: number;
  provinces: number;
  label: LabelPath | null;
}

export type Tincture = 'or' | 'argent' | 'gueules' | 'azur' | 'sinople' | 'sable' | 'pourpre';

export interface Heraldry {
  field: Tincture;
  /** Partition ou pièce honorable. */
  division: 'plain' | 'parti' | 'coupe' | 'tranche' | 'ecartele' | 'fasce' | 'pal' | 'bande' | 'chevron' | 'croix' | 'sautoir';
  second: Tincture;
  charge: 'none' | 'etoile' | 'croissant' | 'soleil' | 'tour' | 'epee' | 'couronne' | 'anneau' | 'losange' | 'quartefeuille' | 'cle';
  chargeTincture: Tincture;
  count: 1 | 3;
  blazon: string;
}

export interface Portrait {
  female: boolean;
  /** 0 = très foncée … 1 = très claire. */
  skin: number;
  /** 0 noir, 1 brun, 2 châtain, 3 blond, 4 roux, 5 gris. */
  hair: number;
  beard: boolean;
  headwear: 'crown' | 'imperial' | 'turban' | 'furhat' | 'mitre' | 'circlet' | 'hat' | 'none';
  hairLong: boolean;
  seed: number;
}

export interface RulerInfo {
  name: string;
  /** Nom avec numéro de règne (« Aldric III »). */
  regnal: string;
  title: string;
  female: boolean;
  age: number;
  born: number;
  since: number;
  traits: string[];
  portrait: Portrait;
}

export interface LineageEntry {
  name: string;
  title: string;
  from: number;
  to: number;
  relation: string;
  fate: string;
}

export interface DynastyInfo {
  id: number;
  name: string;
  house: string;
  founded: number;
  founder: string;
  culture: number;
  arms: Heraldry;
  motto: string;
  countries: number[];
  lineage: LineageEntry[];
}

export interface CountryEvent {
  year: number;
  text: string;
}

export interface CityInfo {
  id: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  /** Habitants. */
  pop: number;
  country: number;
  province: number;
  capital: boolean;
  port: boolean;
  river: boolean;
  /** Volume commercial total (indice). */
  trade: number;
  /** Principaux partenaires commerciaux (id de ville, part du commerce 0..1). */
  partners: { id: number; share: number }[];
  /** Surface de la zone d'influence (km²). */
  influenceArea: number;
  culture: number;
  religion: number;
  /** Ville sainte d'une religion (id), sinon -1. */
  holyOf: number;
}

export interface ProvinceInfo {
  id: number;
  cx: number;
  cy: number;
  area: number;
  pop: number;
  /** Indice dans PROVINCE_TERRAINS. */
  terrain: number;
  country: number;
  city: number;
  coastal: boolean;
  continent: number;
  culture: number;
  religion: number;
  /** État (regroupement de provinces d'un même pays). */
  state: number;
}

/** État au sens de Hearts of Iron IV : quelques provinces d'un pays autour d'une ville principale. */
export interface StateInfo {
  id: number;
  name: string;
  country: number;
  provinces: number[];
  /** Ville principale (-1 si aucune). */
  capitalCity: number;
  pop: number;
  area: number;
  /** Mégalopole, Métropole, Grande ville, Ville, Rural, Pastoral, Terres sauvages. */
  category: string;
  /** Région historique. */
  region: number;
  /** Terrain dominant (indice dans PROVINCE_TERRAINS). */
  terrain: number;
  coastal: boolean;
  resources: string[];
  /** Peuple majoritaire (-1 si aucun). */
  culture: number;
  /** Altitude moyenne (m). */
  height: number;
  cx: number;
  cy: number;
  /** Contient la capitale du pays. */
  hasCapital: boolean;
  label: LabelPath | null;
}

/** Région historique : ensemble géographique d'États voisins (plaine, massif, littoral, archipel). */
export interface RegionInfo {
  id: number;
  name: string;
  /** Plaines, Montagnes, Littoral, Archipel, Marches… */
  kind: string;
  states: number[];
  area: number;
  pop: number;
  countries: number[];
  culture: number;
  label: LabelPath | null;
}

/** Pays de la frise historique : les pays actuels (mêmes indices) puis les pays disparus. */
export interface HistCountry {
  id: number;
  name: string;
  fullName: string;
  form: string;
  color: [number, number, number];
  culture: number;
  religion: number;
  founded: number;
  /** Année de disparition, null s'il existe encore. */
  ended: number | null;
  /** Ce qu'il est devenu (« conquis par X en 1502 »). */
  fate: string;
  arms: Heraldry;
  present: boolean;
  /** État de la capitale. */
  capitalState: number;
}

export type HistKind = 'guerre' | 'indépendance' | 'unification' | 'fondation' | 'annexion' | 'héritage' | 'mariage' | 'révolte' | 'schisme';

export interface HistEvent {
  year: number;
  /** Début (guerres, révoltes). */
  from?: number;
  kind: HistKind;
  title: string;
  text: string;
  /** Pays concernés (indices de HistoryData.countries) : le vainqueur ou l'acteur d'abord. */
  countries: number[];
  /** États transférés ou concernés. */
  states: number[];
}

/** Frise historique : propriétaire de chaque État au début, puis transferts datés jusqu'au présent. */
export interface HistoryData {
  start: number;
  end: number;
  countries: HistCountry[];
  initial: Int32Array;
  changeYear: Int32Array;
  changeState: Int32Array;
  changeFrom: Int32Array;
  changeTo: Int32Array;
  events: HistEvent[];
}

export interface CountryInfo {
  id: number;
  /** Nom court (affiché sur la carte). */
  name: string;
  /** Nom officiel (« Royaume de … »). */
  fullName: string;
  form: string;
  color: [number, number, number];
  capital: number;
  area: number;
  pop: number;
  provinces: number;
  cities: number;
  neighbors: number[];
  label: LabelPath | null;
  culture: number;
  religion: number;
  /** Maison régnante (-1 pour une république). */
  dynasty: number;
  /** Armoiries (celles de la dynastie pour une monarchie). */
  arms: Heraldry;
  ruler: RulerInfo;
  founded: number;
  cultureShares: { id: number; share: number }[];
  religionShares: { id: number; share: number }[];
  allies: number[];
  rivals: number[];
  /** Pays partageant la même dynastie (union personnelle / branche cadette). */
  unions: number[];
  history: string;
  events: CountryEvent[];
}

export const PROVINCE_TERRAINS = ['Plaines', 'Forêt', 'Jungle', 'Collines', 'Montagnes', 'Désert', 'Marais', 'Toundra', 'Glacier'];

export interface PoliticsData {
  /** 65535 = aucune. */
  province: Uint16Array;
  country: Uint16Array;
  /** Ville dont la zone d'influence couvre la cellule. */
  influence: Uint16Array;
  /** Intensité de l'influence (0..1). */
  influenceStrength: Float32Array;
  /** 255 = aucun ; inclut les plateaux continentaux immergés. */
  continent: Uint8Array;
  /** Densité de population (hab/km²). */
  popDensity: Float32Array;
  provinces: ProvinceInfo[];
  states: StateInfo[];
  regions: RegionInfo[];
  countries: CountryInfo[];
  cities: CityInfo[];
  continents: ContinentInfo[];
  /** Tronçons du réseau commercial : paires (x, y) en cellules (x déroulé), découpés par routeOffsets (en points). */
  routePts: Float32Array;
  routeOffsets: Uint32Array;
  /** 0 = route terrestre, 1 = ligne maritime. */
  routeKind: Uint8Array;
  /** Trafic commercial cumulé sur le tronçon. */
  routeVolume: Float32Array;
  /** Liaisons directes ville ↔ ville du réseau (graphe du commerce). */
  linkA: Uint16Array;
  linkB: Uint16Array;
  linkKind: Uint8Array;
  linkVolume: Float32Array;
  totalPop: number;
  cultureGroups: CultureGroupInfo[];
  cultures: CultureInfo[];
  religions: ReligionInfo[];
  dynasties: DynastyInfo[];
  history: HistoryData;
  /** Année courante du calendrier du monde. */
  year: number;
}

export const NONE16 = 65535;

export interface WorldStats {
  landPct: number;
  maxElevation: number;
  minElevation: number;
  riverCount: number;
  lakeCount: number;
  timings: Record<string, number>;
}

export interface WorldData {
  settings: GenSettings;
  W: number;
  H: number;
  latMax: number;
  /** Altitude (m) relative au niveau de la mer. */
  height: Float32Array;
  /** Température moyenne annuelle (°C). */
  temperature: Float32Array;
  /** Précipitations annuelles (mm). */
  precipitation: Float32Array;
  /** Profondeur de lac (m), 0 si pas de lac. */
  lakeDepth: Float32Array;
  lakeSalt: Uint8Array;
  ocean: Uint8Array;
  biome: Uint8Array;
  plate: Uint8Array;
  /** Type de frontière de plaque : 0 aucune, 1 convergente, 2 divergente, 3 transformante. */
  boundary: Uint8Array;
  /** Débit fluvial (m³/s). */
  discharge: Float32Array;
  /** Fleuves : triplets (x, y, débit) en coordonnées de cellule, x "déroulé" (peut sortir de [0, W)). */
  riverPts: Float32Array;
  /** Index de début de chaque fleuve dans riverPts (en triplets), longueur = nb fleuves + 1. */
  riverOffsets: Uint32Array;
  plates: PlateInfo[];
  /** Champ de vent grossier (cellules/pas) : composantes est et sud. */
  windW: number;
  windH: number;
  windU: Float32Array;
  windV: Float32Array;
  stats: WorldStats;
  politics: PoliticsData;
}

export type WorkerRequest = { type: 'generate'; id: number; settings: GenSettings };

export type WorkerResponse =
  | { type: 'progress'; id: number; stage: string; progress: number }
  | { type: 'preview'; id: number; stage: string; w: number; h: number; pixels: Uint8ClampedArray }
  | { type: 'done'; id: number; world: WorldData }
  | { type: 'error'; id: number; message: string };
