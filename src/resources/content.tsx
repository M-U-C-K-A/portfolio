import { About, Blog, Gallery, Home, Newsletter, Person, Social, Work, IANATimeZone } from "@/types";
import { Line, Logo, Row, Text } from "@once-ui-system/core";
import { Language } from "@/components/i18n";

// Base person info (language-independent)
const personBase = {
  firstName: "Hugo",
  lastName: "Delacour",
  name: "Hugo Delacour",
  avatar: "/images/avatar.png",
  email: "hugodelacour.pro@gmail.com",
  location: "Europe/Paris" as IANATimeZone,
};

// Social links (language-independent)
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
    link: `mailto:${personBase.email}`,
  },
];

// Newsletter (language-independent for now)
const newsletter: Newsletter = {
  display: false,
  title: <>Subscribe to {personBase.firstName}'s Newsletter</>,
  description: <>Updates, thoughts, and dev notes</>,
};


// Gallery images (shared)
const galleryImages = [
  {
    src: "/images/gallery/NOXUS1/1.png",
    alt: "Noxus App",
    orientation: "horizontal",
  },
  {
    src: "/images/gallery/PLUM1/1.png",
    alt: "Plum App",
    orientation: "vertical",
  },
  {
    src: "/images/gallery/NOXUS2/1.png",
    alt: "Noxus Interface",
    orientation: "horizontal",
  },
  {
    src: "/images/gallery/PLUM2/1.png",
    alt: "Plum Features",
    orientation: "vertical",
  },
];

// Gallery FR
const galleryFr: Gallery = {
  path: "/gallery",
  label: "Galerie",
  title: `Galerie photo – ${personBase.name}`,
  description: `Une collection de photos par ${personBase.name}`,
  images: galleryImages,
};

// Gallery EN
const galleryEn: Gallery = {
  path: "/gallery",
  label: "Gallery",
  title: `Photo gallery – ${personBase.name}`,
  description: `A photo collection by ${personBase.name}`,
  images: galleryImages,
};

// Default gallery for SSR
const gallery = galleryFr;

// ===========================================
// FRENCH CONTENT
// ===========================================

const personFr: Person = {
  ...personBase,
  role: "Développeur Front-End Web",
  languages: ["Français", "Anglais"],
};

const homeFr: Home = {
  path: "/",
  image: "/images/og/og-image-2.png",
  label: "Accueil",
  title: `Hugo Delacour – Développeur Front-End Web`,
  description: `Portfolio présentant mon travail en tant que Développeur Front-End Web spécialisé dans l'UX minimale, l'atomic design, l'accessibilité et les interfaces épurées.`,
  headline: <>Hugo Delacour</>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">Développeur Web</strong>
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          UI & UX
        </Text>
      </Row>
    ),
    href: "/work/finalytics",
  },
  subline: (
    <>
      Développeur Front spécialisé dans l'UX minimale, l'atomic design, l'accessibilité
      <br /> et la création d'interfaces propres et durables.
    </>
  ),
};

const aboutFr: About = {
  path: "/about",
  label: "À propos",
  title: `À propos – ${personBase.name}`,
  description: `Découvrez ${personBase.name}, Développeur Front-End Web basé à Paris`,
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
  },
  work: {
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
          <>Développement complet d'une application interne en <b>SvelteKit</b> (de la conception à la mise en production).</>,
          <>Création et intégration d'API backend, gestion de l'authentification, flux de données et permissions utilisateurs.</>,
          <>Mise en place d'une architecture propre, documentation et transfert de compétences auprès des équipes.</>,
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

const blogFr: Blog = {
  path: "/blog",
  label: "Blog",
  title: "Écriture, notes & réflexions",
  description: `Articles récents par ${personBase.name}`,
};

const workFr: Work = {
  path: "/work",
  label: "Projets",
  title: `Projets – ${personBase.name}`,
  description: `Projets de design & développement réalisés par ${personBase.name}`,
};

// ===========================================
// ENGLISH CONTENT
// ===========================================

const personEn: Person = {
  ...personBase,
  role: "Front-End Web Developer",
  languages: ["French", "English"],
};

const homeEn: Home = {
  path: "/",
  image: "/images/og/og-image-2.png",
  label: "Home",
  title: `Hugo Delacour – Front-End Web Developer`,
  description: `Portfolio showcasing my work as a Front-End Web Developer specializing in minimal UX, atomic design, accessibility, and clean interfaces.`,
  headline: <>Hugo Delacour</>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">Web Developer</strong>
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          UI & UX
        </Text>
      </Row>
    ),
    href: "/work/finalytics",
  },
  subline: (
    <>
      Front-End Developer specialized in minimal UX, atomic design, accessibility
      <br /> and building clean, sustainable interfaces.
    </>
  ),
};

const aboutEn: About = {
  path: "/about",
  label: "About",
  title: `About – ${personBase.name}`,
  description: `Learn about ${personBase.name}, Front-End Web Developer based in Paris`,
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
      <>Passionate about web development and interface design, I specialize in creating
        minimalist, accessible, and sustainable user experiences. My approach relies on
        atomic design and clean coding practices to ensure maintainable and scalable projects.
      </>
    ),
  },
  work: {
    display: true,
    title: "Projects & Experience",
    experiences: [
      {
        company: "Finalytics",
        timeframe: "2024 - present",
        role: "Founder & Front-End Developer",
        achievements: [
          <>Development of a SaaS to automatically generate financial reports.</>,
          <>Implementation of a modular architecture (atomic design + clean front-end architecture).</>,
          <>Continuous work on UX, optimization, accessibility, and visual consistency.</>,
        ],
        images: [],
      },
      {
        company: "Veoneer France Safety Systems",
        timeframe: "2024",
        role: "Fullstack Developer (Internship)",
        achievements: [
          <>Complete development of an internal application in <b>SvelteKit</b> (from design to production).</>,
          <>Creation and integration of backend APIs, authentication management, data flows, and user permissions.</>,
          <>Implementation of clean architecture, documentation, and knowledge transfer to teams.</>,
        ],
        images: [],
      },
    ],
  },
  studies: {
    display: true,
    title: "Education",
    institutions: [
      {
        name: "École 42",
        description: <>Intensive software development program, focused on practice and collaboration.</>,
      },
      {
        name: "BUT MMI",
        description: <>Multimedia and Internet Professions degree, combining development techniques and design.</>,
      },
    ],
  },
  technical: {
    display: true,
    title: "Technical Skills",
    skills: [
      {
        title: "Front-End",
        description: <>Building clean, consistent, and maintainable interfaces.</>,
        tags: [
          { name: "Tailwind", icon: "tailwind" },
          { name: "Next.js", icon: "nextjs" },
          { name: "TypeScript", icon: "typescript" },
        ],
      },
      {
        title: "DevOps / Workflow",
        description: <>Automation, containerization, and reproducible dev environments.</>,
        tags: [
          { name: "Docker", icon: "docker" },
          { name: "Linux", icon: "linux" },
          { name: "Git", icon: "git" },
        ],
      },
    ],
  },
};

const blogEn: Blog = {
  path: "/blog",
  label: "Blog",
  title: "Writing, notes & thoughts",
  description: `Recent articles by ${personBase.name}`,
};

const workEn: Work = {
  path: "/work",
  label: "Projects",
  title: `Projects – ${personBase.name}`,
  description: `Design & development projects by ${personBase.name}`,
};

// ===========================================
// CONTENT BY LANGUAGE
// ===========================================

const contentByLanguage = {
  fr: {
    person: personFr,
    home: homeFr,
    about: aboutFr,
    blog: blogFr,
    work: workFr,
    gallery: galleryFr,
  },
  en: {
    person: personEn,
    home: homeEn,
    about: aboutEn,
    blog: blogEn,
    work: workEn,
    gallery: galleryEn,
  },
};

// Helper function to get content by language
export const getContent = (lang: Language) => contentByLanguage[lang];

// Default exports (French for SSR/static generation)
const person = personFr;
const home = homeFr;
const about = aboutFr;
const blog = blogFr;
const work = workFr;

export { person, social, newsletter, home, about, blog, work, gallery, contentByLanguage };
