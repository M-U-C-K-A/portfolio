/**
 * Source unique du contenu du site.
 *
 * Tout est en français et centralisé ici : les composants ne contiennent
 * aucune chaîne éditoriale, ce qui rend une future traduction mécanique.
 */

export const site = {
  name: "Hugo Delacour",
  role: "Développeur Front-End",
  url: "https://www.hugodelacour.com",
  description:
    "Développeur front-end. Interfaces minimales, accessibles et durables — Next.js, TypeScript, atomic design.",
  email: "hugodelacour.pro@gmail.com",
  location: "Paris, France",
  timezone: "Europe/Paris",
  links: {
    github: "https://github.com/M-U-C-K-A",
    linkedin: "https://www.linkedin.com/in/hugo-delacour/",
  },
} as const;

export const hero = {
  headline: ["Propre,", "par défaut."],
  /** Libellés répartis en colonnes, façon bloc justifié. */
  labelRows: [
    ["Développeur", "front-end", "&", "interfaces"],
    ["minimales", "pour", "produits", "durables"],
  ],
  standfirst:
    "Next.js, TypeScript et accessibilité. Des interfaces sobres, structurées, construites pour tenir dans le temps.",
  hint: "Cliquez dans la grille",
} as const;

export const intro = {
  lead: "Un point de vue court sur ma manière de construire — et sur ce qui ne change pas d’un projet à l’autre. Mais d’abord, quelques réalisations :",
} as const;

// --- Projets ----------------------------------------------------------------

export type CaseBlock =
  | { type: "prose"; text: string }
  | { type: "list"; items: string[] }
  | { type: "note"; text: string };

export interface CaseSection {
  title: string;
  blocks: CaseBlock[];
}

/**
 * Visuel d'un projet.
 *
 * `width` et `height` sont les dimensions intrinsèques : elles réservent la
 * place avant le chargement et donnent son rapport à la figure, ce qui évite
 * le saut de mise en page. La légende est visible, et c'est elle qui porte le
 * sens — les `<img>` sont posées en `alt=""` pour ne pas la répéter au lecteur
 * d'écran.
 */
export interface ProjectImage {
  src: string;
  caption: string;
  width: number;
  height: number;
}

/** Capture d'écran d'application mobile, et capture de site. */
const PHONE: [number, number] = [900, 1600];
const BANNER: [number, number] = [1600, 900];
/** Capture de navigateur en 1440×800, prise au double du rapport de pixels. */
const CAPTURE: [number, number] = [1920, 1067];

/**
 * Visuel d'un projet, servi depuis `public/work/`.
 *
 * Le premier argument est le nom du fichier, **extension comprise** : les
 * captures livrées sont en PNG, les photos de remplacement en JPEG, et rien
 * n'oblige les prochaines à choisir l'un ou l'autre. Les projets qui n'ont pas
 * encore leurs captures portent une photo quelconque, mais leur légende décrit
 * déjà ce que l'image devra montrer.
 *
 * Les dimensions sont celles du fichier, pas un format imposé : elles
 * réservent la place avant le chargement et donnent son rapport à la figure,
 * qui épouse donc l'image au lieu de la recadrer. Déposer une capture d'un
 * autre format ne casse rien — il faut seulement reporter ses dimensions ici,
 * sans quoi elle serait rognée. `tests/project-images.test.ts` compare les deux
 * et échoue si elles divergent.
 */
function shot(
  file: string,
  [width, height]: [number, number],
  caption: string,
): ProjectImage {
  return { src: `/work/${file}`, caption, width, height };
}

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  date: string;
  year: string;
  role: string;
  status?: string;
  summary: string;
  stack: string[];
  /** Graine du visuel génératif, en secours quand un projet n'a pas d'image. */
  seed: number;
  /** Bandeau du cas d'étude, repris en vignette sur les cartes. */
  cover: ProjectImage;
  /** Ce que le projet donne à voir. Une galerie, après le récit. */
  shots: ProjectImage[];
  sections: CaseSection[];
}

export const projects: Project[] = [
  {
    slug: "noxus",
    title: "Noxus",
    tagline: "La cartographie du savoir mathématique",
    date: "Décembre 2024",
    year: "2024",
    role: "Conception, contenu & développement mobile",
    summary:
      "Une plateforme d’apprentissage systémique qui visualise les mathématiques comme un graphe de connaissances interconnectées, du CP à l’université.",
    stack: ["React Native", "Expo", "TypeScript", "SQLite", "Jest"],
    seed: 1187,
    cover: shot("noxus-cover.jpg", BANNER, "Le graphe complet, du primaire au supérieur."),
    shots: [
      shot("noxus-1.jpg", PHONE, "Le graphe filtré sur un cycle : chaque niveau a sa couleur."),
      shot("noxus-2.jpg", PHONE, "Un nœud ouvert — cours, formules rendues en LaTeX, exercices."),
      shot("noxus-3.jpg", PHONE, "Un chemin de remédiation, remonté depuis une notion non acquise."),
      shot("noxus-4.jpg", PHONE, "La progression, branche par branche du curriculum."),
    ],
    sections: [
      {
        title: "Contexte",
        blocks: [
          {
            type: "prose",
            text: "Les applications éducatives traitent les mathématiques de manière linéaire, comme si chaque chapitre était indépendant. Or les mathématiques sont par essence interconnectées : comprendre les dérivées suppose de maîtriser les limites, qui dépendent elles-mêmes de la notion de fonction, laquelle suppose celle de relation.",
          },
          {
            type: "prose",
            text: "Noxus part d’un principe simple : une lacune est presque toujours une dépendance manquante. On ne peut pas comprendre les puissances sans maîtriser la multiplication. L’enjeu n’est donc pas d’ajouter du contenu — il en existe déjà énormément — mais de rendre visible la structure qui le relie.",
          },
        ],
      },
      {
        title: "Le problème",
        blocks: [
          {
            type: "prose",
            text: "L’enseignement traditionnel souffre de quatre défauts qui se renforcent les uns les autres, et l’élève finit par confondre « je n’y arrive pas » avec « je ne suis pas fait pour ça ».",
          },
          {
            type: "list",
            items: [
              "La linéarité forcée : un parcours imposé, identique pour tous, qui ignore le niveau réel de chacun.",
              "L’accumulation de lacunes : chaque trou non comblé fragilise silencieusement tout ce qui vient après.",
              "L’absence de vision globale : impossible de situer une notion dans l’ensemble, donc de comprendre à quoi elle sert.",
              "La démotivation : on échoue sans jamais savoir où se situe la cause réelle de l’échec.",
            ],
          },
        ],
      },
      {
        title: "Le graphe",
        blocks: [
          {
            type: "prose",
            text: "La réponse est une cartographie complète du savoir mathématique sous forme de graphe. Chaque notion est un nœud portant son propre contenu pédagogique ; chaque lien représente un pré-requis ou un débouché. L’apprenant visualise son chemin de progression et peut, à tout moment, remonter la source d’une incompréhension jusqu’à la notion qui manque réellement.",
          },
          {
            type: "list",
            items: [
              "Plus de 400 nœuds couvrant l’intégralité du curriculum français, du primaire au supérieur.",
              "Navigation par zoom et déplacement dans le graphe, avec recherche instantanée sur l’ensemble.",
              "Filtrage par niveau — primaire, collège, lycée, licence — chaque niveau ayant sa couleur, ce qui permet de se repérer visuellement sans lire.",
              "Chemins de remédiation : depuis un nœud non acquis, l’application remonte automatiquement la chaîne des pré-requis manquants.",
            ],
          },
        ],
      },
      {
        title: "Les modules",
        blocks: [
          {
            type: "prose",
            text: "Un cours n’est pas un bloc de texte. Le moteur de rendu a été écrit sur mesure pour supporter les formats dont les mathématiques ont besoin, sans quoi la moitié du contenu serait des captures d’image illisibles.",
          },
          {
            type: "list",
            items: [
              "Markdown et LaTeX pour les formules, rendues nativement plutôt qu’en images.",
              "Médias intégrés, tableaux et références croisées entre nœuds.",
              "Exercices interactifs et exemples commentés pas à pas.",
            ],
          },
          {
            type: "prose",
            text: "Chaque module suit la même structure progressive — introduction, définitions, explications, exemples, exercices, pour aller plus loin. Cette régularité compte autant que le contenu : l’apprenant sait toujours où il est dans le module, et où trouver ce qu’il cherche.",
          },
        ],
      },
      {
        title: "Adapter le ton, pas l’interface",
        blocks: [
          {
            type: "prose",
            text: "Un module « Addition » destiné au CP et un module « Statistiques inférentielles » destiné à la licence partagent exactement la même interface. Ce qui change, c’est le contenu : le vocabulaire, les exemples, le calibrage des exercices.",
          },
          {
            type: "prose",
            text: "C’est ce qui permet à Noxus de servir un enfant de sept ans comme un étudiant en prépa sans maintenir deux applications. Et cela évite l’écueil habituel des applications éducatives : infantiliser l’adolescent parce que l’enfant a besoin d’images.",
          },
        ],
      },
      {
        title: "Progression",
        blocks: [
          {
            type: "prose",
            text: "Un système de progression complet — expérience, niveaux, badges, statistiques détaillées, objectifs personnalisés — mais volontairement sobre et non intrusif. Pas de notification culpabilisante, pas de série à ne pas briser : la motivation vient de voir le graphe se remplir, pas d’une pression extérieure.",
          },
        ],
      },
      {
        title: "Interface",
        blocks: [
          {
            type: "prose",
            text: "L’interface est délibérément sobre et professionnelle, inspirée d’outils de productivité comme Obsidian, pour installer une posture d’apprentissage sérieuse quel que soit l’âge de l’utilisateur.",
          },
          {
            type: "list",
            items: [
              "Minimalisme fonctionnel : chaque élément visuel doit justifier sa présence.",
              "Contraste optimal et hiérarchie typographique claire, y compris sur les formules.",
              "Animations subtiles, uniquement pour signaler un changement d’état — jamais décoratives.",
            ],
          },
        ],
      },
      {
        title: "Confidentialité",
        blocks: [
          {
            type: "prose",
            text: "Privacy by design, ce qui n’est pas négociable pour une application éducative destinée à des enfants : aucune collecte de données personnelles, stockage local par défaut, synchronisation strictement optionnelle, aucun compte obligatoire pour utiliser l’application.",
          },
          {
            type: "prose",
            text: "Cette contrainte a orienté toute l’architecture. Une base SQLite locale plutôt qu’un backend, un contenu versionné et livré avec l’application plutôt que servi à la demande. Elle a aussi un effet secondaire appréciable : l’application fonctionne intégralement hors ligne.",
          },
        ],
      },
      {
        title: "Stack",
        blocks: [
          {
            type: "list",
            items: [
              "React Native et Expo, avec un moteur de rendu custom pour les modules.",
              "Graphe interactif, animations, gestion d’état et navigation.",
              "SQLite en local, architecture modulaire, système de progression et versioning du contenu.",
              "TypeScript, ESLint et Prettier, Jest, EAS Build, Sentry.",
            ],
          },
        ],
      },
      {
        title: "Ce que j’en retiens",
        blocks: [
          {
            type: "prose",
            text: "Apprendre en comprenant plutôt qu’en mémorisant suppose trois choses : pouvoir identifier ses lacunes, personnaliser son parcours, et faire des connexions entre des notions qu’on croyait séparées.",
          },
          {
            type: "prose",
            text: "L’objectif final n’est pas le contenu, c’est l’autonomie : l’habitude d’aller chercher les fondations quand quelque chose ne tient pas. Techniquement, le projet m’a surtout appris qu’un moteur de rendu écrit sur mesure coûte cher au départ et se rentabilise dès le vingtième module.",
          },
        ],
      },
    ],
  },
  {
    slug: "plum",
    title: "Plum",
    tagline: "L’assistant mémoire qui rassure",
    date: "Novembre 2024",
    year: "2024",
    role: "Conception, accessibilité & développement mobile",
    summary:
      "Une application mobile double-interface conçue pour l’autonomie des personnes ayant des troubles de la mémoire, sécurisée par un mode aidant.",
    stack: ["React Native", "Expo", "TypeScript", "Zustand", "Supabase"],
    seed: 5023,
    cover: shot("plum-cover.jpg", BANNER, "L'écran d'accueil, en mode aidé."),
    shots: [
      shot("plum-1.jpg", PHONE, "La preuve par l'image : la photo qui confirme que c'est fait."),
      shot("plum-2.jpg", PHONE, "Le mode aidant, côté famille."),
      shot("plum-3.jpg", PHONE, "Une routine du matin, étape par étape."),
      shot("plum-4.jpg", PHONE, "Les réglages d'accessibilité — corps du texte et contraste."),
    ],
    sections: [
      {
        title: "Contexte",
        blocks: [
          {
            type: "prose",
            text: "Le projet est né d’une observation personnelle : accompagner un proche atteint de troubles cognitifs légers m’a confronté aux limites des solutions existantes. La plupart des applications mémoire traitent leurs utilisateurs comme des patients, pas comme des personnes autonomes qui souhaitent le rester.",
          },
        ],
      },
      {
        title: "Le problème",
        blocks: [
          {
            type: "prose",
            text: "Pour beaucoup de personnes — troubles cognitifs légers, stress chronique, ou simplement vieillissement — l’oubli des actions quotidiennes génère une anxiété permanente. Le mécanisme est toujours le même : la boucle de doute, les vérifications répétées, la perte de confiance, puis l’isolement, parce qu’on n’ose plus sortir sans avoir tout revérifié trois fois.",
          },
          {
            type: "prose",
            text: "Les applications existantes échouent sur quatre points, et chacun est un motif d’abandon en soi.",
          },
          {
            type: "list",
            items: [
              "Design infantilisant, qui stigmatise au lieu d’accompagner — gros pictogrammes colorés, ton de maternelle.",
              "Complexité inutile pour une tâche qui devrait tenir en un geste.",
              "Absence de preuve : cocher un rappel ne lève pas le doute, puisqu’on peut cocher machinalement.",
              "Manque de flexibilité face à des quotidiens qui ne se ressemblent pas d’un jour à l’autre.",
            ],
          },
        ],
      },
      {
        title: "La preuve par l’image",
        blocks: [
          {
            type: "prose",
            text: "La fonctionnalité cœur est la validation visuelle : chaque routine se termine par une photo horodatée. Le doute ne se discute pas, il se regarde. « Ai-je bien fermé le gaz ? » cesse d’être une question dès lors qu’on peut voir la cuisinière éteinte, avec l’heure.",
          },
          {
            type: "list",
            items: [
              "Élimination du doute par une preuve datée, consultable à tout moment.",
              "Rassurance instantanée, sans devoir rentrer chez soi vérifier.",
              "Simplicité d’usage : ouvrir, photographier, c’est validé.",
            ],
          },
        ],
      },
      {
        title: "Deux modes, une application",
        blocks: [
          {
            type: "prose",
            text: "L’application s’adapte au degré d’autonomie de la personne. Le mode standard est conçu pour l’usage seul ; le mode aidant ouvre un accès encadré à un proche ou à un professionnel. Le passage de l’un à l’autre est progressif et réversible, parce que l’autonomie n’est pas une ligne droite.",
          },
          {
            type: "list",
            items: [
              "Espace aidant : tableau de bord, consultation des preuves, alertes configurables, historique.",
              "Respect de l’intimité : l’aidant voit ce qui a été convenu, pas tout. Les périmètres sont explicites et modifiables.",
            ],
          },
        ],
      },
      {
        title: "Les routines",
        blocks: [
          {
            type: "prose",
            text: "Les routines de Plum ne sont pas de simples rappels : elles structurent la journée sans la contraindre.",
          },
          {
            type: "list",
            items: [
              "Quatre types : quotidiennes, hebdomadaires, ponctuelles et conditionnelles — « avant de sortir », « en rentrant ».",
              "Fenêtre de validation plutôt qu’une heure fixe : une routine se valide dans un créneau, pas à la minute près.",
              "Rappels progressifs, catégorisation, notes vocales pour ce qui ne se photographie pas.",
            ],
          },
          {
            type: "prose",
            text: "Les notifications sont conçues pour guider sans stresser : ton positif, fréquence adaptative selon les habitudes réelles, mode silencieux automatique la nuit, validation possible directement depuis la notification.",
          },
        ],
      },
      {
        title: "Accessibilité",
        blocks: [
          {
            type: "prose",
            text: "L’accessibilité était une contrainte de départ, pas une passe de finition : conformité WCAG AAA et grille Opquast, support complet de VoiceOver et TalkBack, navigation possible par contrôle vocal.",
          },
          {
            type: "list",
            items: [
              "Tailles de texte généreuses et ajustables, cibles tactiles larges, hiérarchie visuelle claire.",
              "Feedback explicite à chaque action : on sait toujours ce qui vient d’être enregistré.",
              "Thèmes clair, sombre et contraste élevé ; police OpenDyslexic disponible.",
              "Animations réduites ou entièrement désactivables.",
              "Navigation simplifiée : jamais plus de deux niveaux de profondeur.",
            ],
          },
        ],
      },
      {
        title: "Sécurité",
        blocks: [
          {
            type: "prose",
            text: "Partager des photos de l’intérieur d’un domicile et des routines de santé impose une sécurité maximale. Les données sont stockées localement et chiffrées avant tout départ vers le serveur : architecture zero-knowledge, le serveur ne stocke que du chiffré et ne peut rien lire.",
          },
          {
            type: "list",
            items: [
              "Chiffrement AES-256, chiffrement de bout en bout entre l’utilisateur et son aidant.",
              "Supabase pour la synchronisation, sans jamais détenir les clés.",
              "Photos supprimées automatiquement à l’expiration de leur fenêtre d’utilité.",
            ],
          },
        ],
      },
      {
        title: "Défis techniques",
        blocks: [
          {
            type: "prose",
            text: "La capture devait être instantanée. Une seconde de latence à l’ouverture de la caméra suffit à casser l’usage : la personne pense que ça n’a pas marché et recommence.",
          },
          {
            type: "list",
            items: [
              "Préchargement du module caméra dès l’ouverture de l’application.",
              "Compression intelligente : assez pour la preuve, pas assez pour saturer le stockage.",
              "Écriture asynchrone et gestion mémoire stricte pour tenir sur des appareils anciens.",
            ],
          },
          {
            type: "prose",
            text: "L’autre défi était de tenir la règle « un écran, une tâche ». L’application se résume à trois écrans — accueil, validation, historique — et chaque fonctionnalité proposée devait démontrer qu’elle n’en ajoutait pas un quatrième.",
          },
        ],
      },
      {
        title: "Stack",
        blocks: [
          {
            type: "list",
            items: [
              "React Native et Expo, Expo Camera, Reanimated, Zustand, date-fns.",
              "Expo SQLite en local, chiffrement AES-256, Supabase pour la synchronisation.",
              "TypeScript, ESLint et Prettier, Jest et React Native Testing Library, Detox, EAS Build, Sentry.",
            ],
          },
        ],
      },
      {
        title: "Ce que j’en retiens",
        blocks: [
          {
            type: "prose",
            text: "Concevoir pour une personne compétente et digne change tout : respecter l’intelligence, préserver l’autonomie, éviter la stigmatisation, valoriser la progression plutôt que pointer l’échec.",
          },
          {
            type: "prose",
            text: "L’inclusive design ne vise pas la moyenne des utilisateurs, il vise le plus grand nombre — et il finit par mieux servir tout le monde. Les gros boutons, le feedback explicite et le ton bienveillant ne sont pas des concessions faites à une minorité : ce sont de meilleures interfaces, point.",
          },
        ],
      },
    ],
  },
  {
    slug: "finalytics",
    title: "Finalytics",
    tagline: "Générer des rapports financiers automatiquement",
    date: "Octobre 2024",
    year: "2024 — présent",
    role: "Fondateur & développeur front-end",
    status: "Beta fermée — ouverture publique après stabilisation du pipeline.",
    summary:
      "Un SaaS qui transforme des données financières brutes en rapports lisibles, structurés et prêts à être partagés. Automatiser un processus long, répétitif et source d’erreurs.",
    stack: ["Next.js", "TypeScript", "Tailwind", "Docker", "GitHub Actions"],
    seed: 8801,
    cover: shot("finalytics-cover.png", [1900, 990], "La page d'accueil, et l'aperçu d'un rapport."),
    shots: [
      shot("finalytics-1.png", [1900, 990], "L'historique : statut, coût en crédits, filtres par type d'actif et de rapport."),
      shot("finalytics-2.png", [1900, 990], "Le tableau de bord — crédits, plan en cours, rapports récents."),
      shot("finalytics-3.png", [3734, 2634], "Deux pages d'un rapport généré : résumé exécutif et valorisation."),
    ],
    sections: [
      {
        title: "Contexte",
        blocks: [
          {
            type: "prose",
            text: "Créer des rapports financiers complets est un processus lent, manuel et fragile. Entre l’extraction des données, les calculs, l’uniformisation des mises en page et les vérifications, chaque livraison peut prendre des heures — voire des jours. Et chaque étape manuelle est une occasion d’introduire une erreur que personne ne verra avant le client.",
          },
          {
            type: "prose",
            text: "L’objectif : centraliser les données, automatiser leur traitement et produire des rapports professionnels de manière fiable et reproductible. Réduire le travail répétitif pour laisser l’utilisateur sur l’analyse et la décision, pas sur la mise en forme.",
          },
        ],
      },
      {
        title: "Fonctionnalités",
        blocks: [
          {
            type: "list",
            items: [
              "Import de données hétérogènes : exports comptables, bilans, journaux, feuilles Excel, normalisés en une base structurée.",
              "Génération automatique de rapports : mises en page cohérentes, graphiques, tableaux comparatifs et synthèses.",
              "Templates adaptables : tonalité, style visuel et structure ajustables aux usages internes de chaque entreprise.",
              "Suivi des versions et piste d’audit : chaque rapport documenté, horodaté, reproductible à l’identique.",
              "Interface pensée pour être lisible et rapide, sans surcharge visuelle.",
            ],
          },
        ],
      },
      {
        title: "Approche front-end",
        blocks: [
          {
            type: "prose",
            text: "L’interface est construite en atomic design, ce qui donne trois choses concrètes : une cohérence sur toutes les pages, une facilité d’évolution — ajouter une vue, un tableau, un type de graphique ne demande pas de réécrire l’existant — et des composants réellement accessibles au clavier, avec des contrastes tenus et une structure sémantique correcte.",
          },
          {
            type: "prose",
            text: "Le fil conducteur est de minimiser le bruit visuel : laisser la donnée respirer, supprimer tout décoratif, guider l’attention vers les indicateurs qui portent la décision. Sur un produit financier, la sobriété n’est pas un parti pris esthétique — c’est ce qui évite de faire lire le mauvais chiffre.",
          },
        ],
      },
      {
        title: "Défis",
        blocks: [
          {
            type: "list",
            items: [
              "Normalisation des sources : les formats financiers ne sont jamais vraiment standards, et deux exports du même logiciel peuvent différer.",
              "Performance : la génération de rapports lourds a imposé d’optimiser le pipeline et d’introduire des pré-calculs.",
              "UX pour profils non techniques : simplifier l’interface sans masquer la complexité réelle des calculs, pour que l’utilisateur garde confiance dans ce qu’il signe.",
            ],
          },
          {
            type: "prose",
            text: "Ce projet a confirmé une conviction que j’applique depuis à tout le reste : simplifier n’est pas enlever, c’est réduire l’interface à ce qui porte la décision.",
          },
        ],
      },
      {
        title: "Résultats",
        blocks: [
          {
            type: "list",
            items: [
              "Jusqu’à 70 % de temps gagné sur la préparation des rapports chez les utilisateurs pilotes.",
              "Moins d’erreurs humaines, et surtout des erreurs traçables lorsqu’elles surviennent.",
              "Plus de cohérence entre les livrables, y compris entre personnes différentes.",
              "Un workflow front-end propre et durable autour de l’atomic design, du clean code et de l’accessibilité.",
            ],
          },
        ],
      },
      {
        title: "Stack",
        blocks: [
          {
            type: "list",
            items: [
              "Next.js et React pour la structure applicative et l’interface.",
              "TypeScript pour la robustesse et la maintenabilité sur la durée.",
              "Tailwind et atomic design pour une hiérarchie visuelle cohérente.",
              "Docker pour un environnement reproductible, GitHub Actions pour le déploiement continu.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "corpus-delta",
    title: "Corpus Delta",
    tagline: "L’annuaire de la recherche climatique",
    date: "Juin 2024",
    year: "2024",
    role: "Conception éditoriale & développement",
    summary:
      "Un annuaire de publications scientifiques sur le climat et les risques naturels : cent une études référencées avec leurs métadonnées d’origine, un glossaire de cinquante et un termes, et des parcours de lecture pour entrer dans la littérature sans s’y perdre.",
    stack: ["Next.js", "TypeScript", "Tailwind", "MDX"],
    seed: 3319,
    cover: shot("corpus-delta-cover.jpg", CAPTURE, "La page d’accueil, et l’entrée dans l’annuaire."),
    shots: [
      shot("corpus-delta-1.jpg", CAPTURE, "L’annuaire : cent une études, filtrées par thème et par accès."),
      shot("corpus-delta-2.jpg", CAPTURE, "Une fiche d’étude — métadonnées d’origine, DOI, citation prête à copier."),
      shot("corpus-delta-3.jpg", CAPTURE, "Un parcours en six étapes, du vocabulaire aux publications de référence."),
      shot("corpus-delta-4.jpg", CAPTURE, "Les indicateurs, relevés chez l’organisme qui les publie."),
    ],
    sections: [
      {
        title: "Contexte",
        blocks: [
          {
            type: "prose",
            text: "Corpus Delta est né de l’envie de rendre les enjeux climatiques compréhensibles, sans sensationnalisme ni surcharge d’informations. Le sujet souffre d’un paradoxe : l’information existe en abondance, mais elle est soit trop technique pour être lue, soit trop alarmiste pour être supportée.",
          },
          {
            type: "prose",
            text: "Plutôt qu’inonder le lecteur de chiffres ou d’alertes anxiogènes, l’objectif était de créer un espace calme, pensé pour la lecture longue, la réflexion et la nuance. Trois axes ont guidé toutes les décisions : la lisibilité avant tout, une navigation simple et non agressive, et une tonalité pédagogique plutôt que militante.",
          },
        ],
      },
      {
        title: "Parti pris de design",
        blocks: [
          {
            type: "prose",
            text: "L’interface est volontairement silencieuse : pas d’animation inutile, pas de surcharge graphique, aucun élément qui réclame l’attention pour lui-même. Espaces généreux, grille stable, couleurs neutres, accent minimal.",
          },
          {
            type: "prose",
            text: "Cela va à l’encontre de la plupart des sites de contenu, qui multiplient les incitations, les encarts et les recommandations. Le pari était inverse : une page qui ne demande rien au lecteur est une page qu’il finit.",
          },
        ],
      },
      {
        title: "Lecture longue",
        blocks: [
          {
            type: "list",
            items: [
              "Typographie calibrée pour la lecture longue : mesure d’environ 70 signes, interlignage large, contraste tenu.",
              "Articles structurés et narratifs, avec une hiérarchie d’informations explicite.",
              "Mode sombre lisible et réellement accessible, pas une simple inversion.",
              "Système de tags pour explorer les sujets sans passer par un moteur de recherche.",
            ],
          },
        ],
      },
      {
        title: "Édition",
        blocks: [
          {
            type: "prose",
            text: "Le contenu est écrit en MDX. Ce choix permet d’intégrer des composants au fil du texte — un graphique, un encart de définition, une comparaison — sans quitter le format markdown ni passer par un CMS.",
          },
          {
            type: "prose",
            text: "L’intérêt est autant éditorial que technique : l’auteur écrit du texte, et n’insère un composant que lorsque le texte ne suffit pas. La contrainte pousse à expliquer d’abord, illustrer ensuite.",
          },
        ],
      },
      {
        title: "Résultats",
        blocks: [
          {
            type: "prose",
            text: "Le site sert aujourd’hui de base pour publier des articles, organiser la connaissance et structurer des analyses. Il est conçu comme un outil d’apprentissage autant que comme un média.",
          },
          {
            type: "prose",
            text: "C’est aussi la démonstration qui m’intéressait : une interface lente, pensée pour l’attention plutôt que pour l’engagement, a sa place — et elle se construit avec exactement les mêmes outils que les autres.",
          },
        ],
      },
      {
        title: "Stack",
        blocks: [
          {
            type: "list",
            items: [
              "Next.js et React, TypeScript.",
              "TailwindCSS dans une approche atomic design.",
              "Markdown et MDX pour l’édition des articles.",
            ],
          },
        ],
      },
    ],
  },
];

export const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

// --- Points de vue ----------------------------------------------------------

export interface Statement {
  eyebrow: string;
  headline: string;
  body: string[];
}

export const statements: Statement[] = [
  {
    eyebrow: "01 — Réduction",
    headline: "Une interface propre n’est pas une interface vide.",
    body: [
      "Retirer des éléments jusqu’à ce qu’il ne reste rien est facile. Retirer jusqu’à ce qu’il ne reste que ce qui compte demande de comprendre la tâche de l’utilisateur avant de dessiner quoi que ce soit.",
      "Simplifier n’est pas enlever : c’est réduire l’interface à ce qui porte la décision. Sur Finalytics, cela voulait dire laisser la donnée respirer et guider l’attention vers les indicateurs clés. Sur Plum, cela voulait dire un écran, une tâche.",
    ],
  },
  {
    eyebrow: "02 — Structure",
    headline: "Le framework n’est pas l’architecture.",
    body: [
      "Next.js décide de la manière dont les pages sont rendues. Il ne décide pas de la manière dont un système d’interface tient sur trois ans, ni de ce qui se passe quand quatre personnes ajoutent des vues en parallèle.",
      "L’atomic design et une séparation nette entre composants, logique et données ne coûtent rien au démarrage et évitent le dossier « components » qui déborde six mois plus tard. C’est la différence entre un projet qui évolue et un projet qu’on réécrit.",
    ],
  },
  {
    eyebrow: "03 — Accessibilité",
    headline: "L’accessibilité est une contrainte de départ, pas une option.",
    body: [
      "Ajoutée à la fin, elle devient une liste de correctifs. Posée au départ, elle oriente la structure sémantique, les contrastes, les tailles de cible et le parcours clavier — et elle produit de meilleures interfaces pour tout le monde.",
      "Sur Plum, viser WCAG AAA et la grille Opquast n’a pas alourdi le produit : cela a imposé de choisir. Gros boutons, feedback explicite, hiérarchie lisible, animations désactivables.",
    ],
  },
];

// --- Méthode ----------------------------------------------------------------

export const method = {
  title: ["Clarifier.", "Structurer.", "Construire.", "Tenir."],
  lead: "Quatre temps, dans cet ordre. Le dernier est celui qu’on saute le plus souvent — c’est aussi celui qui décide de la durée de vie du projet.",
  steps: [
    {
      index: "01",
      name: "Clarifier",
      text: "Comprendre la tâche réelle, pas la fonctionnalité demandée. Identifier ce qui fait perdre du temps et ce qui produit des erreurs.",
    },
    {
      index: "02",
      name: "Structurer",
      text: "Poser la grille, les composants atomiques, les états et la hiérarchie typographique avant d’écrire une page.",
    },
    {
      index: "03",
      name: "Construire",
      text: "Implémenter en TypeScript, avec des composants accessibles au clavier et testés. Environnement reproductible, déploiement continu.",
    },
    {
      index: "04",
      name: "Tenir",
      text: "Documenter, mesurer les Core Web Vitals, transmettre. Un projet livré mais intransmissible n’est pas terminé.",
    },
  ],
} as const;

// --- Parcours ---------------------------------------------------------------

export interface TimelineEntry {
  period: string;
  organisation: string;
  role: string;
  points: string[];
}

export const experience: TimelineEntry[] = [
  {
    period: "2024 — présent",
    organisation: "Finalytics",
    role: "Fondateur & développeur front-end",
    points: [
      "Développement d’un SaaS de génération automatique de rapports financiers.",
      "Architecture modulaire : atomic design et clean architecture front.",
      "Travail continu sur l’UX, l’optimisation, l’accessibilité et la cohérence visuelle.",
    ],
  },
  {
    period: "2024",
    organisation: "Veoneer France Safety Systems",
    role: "Développeur fullstack — stage",
    points: [
      "Développement complet d’une application interne en SvelteKit, de la conception à la mise en production.",
      "Création et intégration d’API backend, authentification, flux de données et permissions utilisateurs.",
      "Architecture propre, documentation et transfert de compétences auprès des équipes.",
    ],
  },
];

export const education: TimelineEntry[] = [
  {
    period: "Formation",
    organisation: "École 42",
    role: "Développement logiciel",
    points: [
      "Programme intensif axé sur la pratique et la collaboration, sans cours magistraux.",
    ],
  },
  {
    period: "Formation",
    organisation: "BUT MMI",
    role: "Métiers du multimédia et de l’internet",
    points: ["Développement et design, de la conception à l’intégration."],
  },
];

// --- Compétences ------------------------------------------------------------

export const skills = [
  {
    title: "Front-end",
    text: "Interfaces propres, cohérentes et maintenables.",
    items: ["Next.js", "React", "TypeScript", "Tailwind", "React Native"],
  },
  {
    title: "Méthode",
    text: "Ce qui fait qu’un projet survit à sa première année.",
    items: [
      "Atomic design",
      "Accessibilité",
      "Clean architecture",
      "Core Web Vitals",
      "i18n",
    ],
  },
  {
    title: "Workflow",
    text: "Automatisation et environnements reproductibles.",
    items: ["Docker", "Linux", "Git", "GitHub Actions", "Sentry"],
  },
] as const;

// --- Écrits -----------------------------------------------------------------
// Les articles vivent en markdown dans content/articles/ et sont chargés par
// src/lib/articles.ts — leur frontmatter fait foi.

export const writingSection = {
  headline: "Ce que j’écris quand je ne code pas.",
  lead: "Des notes longues sur l’architecture front, l’internationalisation et la performance — écrites pour être utiles six mois plus tard.",
} as const;

// --- Contact ----------------------------------------------------------------

export const contact = {
  marquee: "Oui, c’est faisable.",
  headline: "Un projet, une refonte, un système d’interface à poser ?",
  body: "Je travaille depuis Paris, en français comme en anglais, sur des produits où la lisibilité et la durabilité comptent autant que la date de livraison.",
  cta: "Prendre contact",
} as const;

// --- CV ---------------------------------------------------------------------

export interface CvEntry {
  period: string;
  organisation: string;
  role: string;
  points: string[];
}

export const cv = {
  role: "Développeur front-end",
  specialities: ["Accessibilité (A11Y)", "SEO technique", "Next.js"],
  summary:
    "Développeur front-end issu d’un double parcours : la vision produit du BUT MMI et l’exigence algorithmique de l’École 42. Je conçois des applications de bout en bout, avec une spécialité en accessibilité numérique et en SEO technique. Ce qui m’intéresse : des interfaces qui restent lisibles, maintenables et rapides une fois le projet livré.",

  facts: [
    { label: "E-mail", value: site.email, href: `mailto:${site.email}` },
    { label: "Téléphone", value: "+33 6 52 68 28 62", href: "tel:+33652682862" },
    { label: "Site", value: "hugodelacour.com", href: site.url },
    // Adresses complètes plutôt que pseudonymes : à l'impression le lien
    // disparaît, et un ATS comme un lecteur n'ont plus que ce texte.
    { label: "GitHub", value: "github.com/M-U-C-K-A", href: site.links.github },
    {
      label: "LinkedIn",
      value: "linkedin.com/in/hugo-delacour",
      href: site.links.linkedin,
    },
    { label: "Basé à", value: `${site.location} — permis B`, href: null },
  ],

  experience: [
    {
      period: "2024 — présent",
      organisation: "Finalytics",
      role: "Fondateur & développeur front-end",
      points: [
        "SaaS de génération automatique de rapports financiers, en beta fermée.",
        "Architecture front en atomic design : séparation nette entre composants, logique et données.",
        "Jusqu’à 70 % de temps gagné sur la préparation des rapports chez les utilisateurs pilotes.",
      ],
    },
    {
      period: "Mars — juin 2024",
      organisation: "Veoneer France Safety Systems",
      role: "Développeur fullstack — stage",
      points: [
        "Interface interne de monitoring et de traitement de documents techniques (PDF), développée de bout en bout en SvelteKit.",
        "Édition dynamique, annotation et manipulation de fichiers côté client comme serveur.",
        "API backend, authentification, flux de données et permissions utilisateurs.",
        "Documentation et transfert de compétences aux équipes en fin de mission.",
      ],
    },
  ] satisfies CvEntry[],

  education: [
    {
      period: "Août 2024 — janvier 2026",
      organisation: "École 42",
      role: "Développement logiciel",
      points: [
        "Pédagogie par projets, sans cours ni professeurs : shell écrit de zéro, serveur IRC, algorithmique bas niveau en C et C++. Correction entre pairs.",
      ],
    },
    {
      period: "Septembre 2021 — juin 2024",
      organisation: "BUT MMI",
      role: "Métiers du multimédia et de l’internet",
      points: [
        "Développement web et communication digitale, avec un accent sur l’accessibilité numérique, l’expérience utilisateur et les stratégies de diffusion.",
      ],
    },
  ] satisfies CvEntry[],

  /** Projets détaillés ailleurs sur le site ; ici en une ligne chacun. */
  selectedWork: [
    {
      name: "Noxus",
      text: "Plateforme d’apprentissage des mathématiques sous forme de graphe de connaissances. React Native, plus de 400 nœuds, fonctionnement hors ligne.",
      slug: "noxus",
    },
    {
      name: "Plum",
      text: "Assistant mémoire mobile à double interface. WCAG AAA et grille Opquast, chiffrement de bout en bout, architecture zero-knowledge.",
      slug: "plum",
    },
    {
      name: "Corpus Delta",
      text: "Annuaire de la recherche climatique : cent une études référencées, un glossaire et des parcours de lecture. Next.js et MDX.",
      slug: "corpus-delta",
    },
  ],

  competencies: [
    {
      title: "Ingénierie & architecture",
      text: "Conception d’applications de bout en bout, analyse des besoins, rédaction de cahiers des charges techniques.",
    },
    {
      title: "Accessibilité & UX",
      text: "Normes WCAG et grille Opquast, parcours clavier, contrastes, structure sémantique — posés dès la conception.",
    },
    {
      title: "Organisation",
      text: "Planification de projets complexes en Kanban, autonomie, respect des délais et documentation transmissible.",
    },
  ],

  stack: [
    {
      title: "Langages",
      items: ["TypeScript", "JavaScript", "C", "C++", "Python", "R"],
    },
    {
      title: "Front-end",
      items: ["Next.js", "React", "SvelteKit", "React Native", "Tailwind"],
    },
    {
      title: "Back-end & données",
      items: ["Node.js", "Django", "PostgreSQL", "MySQL", "SQLite"],
    },
    {
      title: "Outils",
      items: ["Git", "Docker", "Linux", "GitHub Actions", "Figma"],
    },
  ],
} as const;
