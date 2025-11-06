import { About, Blog, Gallery, Home, Newsletter, Person, Social, Work } from "@/types";
import { Line, Logo, Row, Text } from "@once-ui-system/core";

const person: Person = {
  firstName: "Hugo",
  lastName: "Delacour",
  name: `Hugo Delacour`,
  role: "Front-End Web Developer",
  avatar: "/images/avatar.jpg",
  email: "hugodelacour.pro@gmail.com",
  location: "Europe/Paris",
  languages: ["Français", "Anglais"],
};

const newsletter: Newsletter = {
  display: false,
  title: <>Subscribe to {person.firstName}'s Newsletter</>,
  description: <>Updates, thoughts, and dev notes</>,
};

const social: Social = [
  {
    name: "GitHub",
    icon: "github",
    link: "https://github.com/M-U-C-K-A",
  },
  {
    name: "LinkedIn",
    icon: "linkedin",
    link: "https://www.linkedin.com/in/hugo-delacour/",
  },
  {
    name: "Email",
    icon: "email",
    link: `mailto:${person.email}`,
  },
];

const home: Home = {
  path: "/",
  image: "/og/og.jpg",
  label: "Home",
  title: `Hugo Delacour – Front-End Web Developer`,
  description: `Portfolio website showcasing my work as a Front-End Web Developer specializing in minimal UX, atomic design, accessibility, and clean interfaces.`,
  headline: <>Hugo Delacour</>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">web Developer</strong>
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          front-end & ux
        </Text>
      </Row>
    ),
    href: "/work/building-once-ui-a-customizable-design-system",
  },
  subline: (
    <>
      Développeur Front spécialisé dans l’UX minimale, l’atomic design, l’accessibilité
      <br /> et la création d’interfaces propres et durables.
    </>
  ),
};

const about: About = {
  path: "/about",
  label: "About",
  title: `À propos – ${person.name}`,
  description: `Découvrez ${person.name}, ${person.role} basé à ${person.location}`,
  tableOfContent: {
    display: true,
    subItems: false,
  },
  avatar: {
    display: true,
  },
  calendar: {
    display: false,
    link: "https://cal.com",
  },
  intro: {
    display: true,
    title: "Introduction",
    description: (
      <>Passionné par le développement web et le design d'interfaces, je me spécialise dans la création
      d'expériences utilisateur minimalistes, accessibles et durables. Mon approche repose sur
      l'atomic design et des pratiques de codage propres pour garantir des projets maintenables et
      évolutifs.
      </>
    ),
  },work: {
  display: true,
  title: "Projets & Expériences",
  experiences: [
    {
      company: "Finalytics",
      timeframe: "2024 - présent",
      role: "Fondateur & Développeur Front-End",
      achievements: [
        <>Développement d'un SaaS permettant de générer automatiquement des rapports financiers.</>,
        <>Mise en place d'une architecture modulaire (atomic design + clean architecture front).</>,
        <>Travail en continu sur UX, optimisation, accessibilité et cohérence visuelle.</>,
      ],
      images: [],
    },
    {
      company: "Veoneer France Safety Systems",
      timeframe: "2024",
      role: "Développeur Fullstack (Stage)",
      achievements: [
        <>Développement complet d’une application interne en <b>SvelteKit</b> (de la conception à la mise en production).</>,
        <>Création et intégration d’API backend, gestion de l’authentification, flux de données et permissions utilisateurs.</>,
        <>Mise en place d’une architecture propre, documentation et transfert de compétences auprès des équipes.</>,
      ],
      images: [],
    },
  ],
},
  studies: {
    display: true,
    title: "Études",
    institutions: [
      {
        name: "École 42",
        description: <>Programme intensif en développement logiciel, axé sur la pratique et la collaboration.</>,
      },
      {
        name: "BUT MMI",
        description: <>Formation en Métiers du Multimédia et de l'Internet, alliant techniques de développement et design.</>,
      },
    ],
  },
  technical: {
    display: true,
    title: "Compétences techniques",
    skills: [
      {
        title: "Front-End",
        description: <>Développement d'interfaces propres, cohérentes et maintenables.</>,
        tags: [
          { name: "Tailwind", icon: "tailwind" },
          { name: "Next.js", icon: "nextjs" },
          { name: "TypeScript", icon: "typescript" },
        ],
      },
      {
        title: "DevOps / Workflow",
        description: <>Automatisation, conteneurisation et environnements de dev reproductibles.</>,
        tags: [
          { name: "Docker", icon: "docker" },
          { name: "Linux", icon: "linux" },
          { name: "Git", icon: "git" },
        ],
      },
    ],
  },
};

const blog: Blog = {
  path: "/blog",
  label: "Blog",
  title: "Écriture, notes & réflexions",
  description: `Articles récents par ${person.name}`,
};

const work: Work = {
  path: "/work",
  label: "Work",
  title: `Projets – ${person.name}`,
  description: `Projets de design & développement réalisés par ${person.name}`,
};

const gallery: Gallery = {
  path: "/gallery",
  label: "Gallery",
  title: `Photo gallery – ${person.name}`,
  description: `A photo collection by ${person.name}`,
  images: [
    {
      src: "/images/gallery/horizontal-1.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-4.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/horizontal-3.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-1.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/vertical-2.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/horizontal-2.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/horizontal-4.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-3.jpg",
      alt: "image",
      orientation: "vertical",
    },
  ],
};

export { person, social, newsletter, home, about, blog, work, gallery };
