---
title: "Atomic Design : structurer un projet Next.js qui tienne trois ans"
description: "Le dossier components finit toujours par déborder. Voici comment l'atomic design pose une frontière nette entre les niveaux d'interface, comment le faire cohabiter avec shadcn/ui et les Server Components, et comment migrer un projet qui a déjà dérivé."
date: "2026-08-05"
tags: ["Architecture", "Design System", "React", "Next.js"]
---

Tous les projets front commencent pareil. Un dossier `components`, quelques
fichiers, tout va bien. Six mois plus tard il contient quatre-vingts fichiers,
trois boutons différents, deux modales qui font la même chose, et personne
n'ose supprimer `Card2.tsx` parce que personne ne sait qui l'importe.

Le problème n'est pas le désordre. Le désordre est un symptôme. Le problème est
qu'aucune règle ne dit **où va un composant** ni **ce qu'il a le droit de
savoir**. Sans ces deux règles, chaque développeur invente les siennes, et
elles ne sont jamais les mêmes.

L'atomic design, formulé par Brad Frost, répond exactement à ces deux
questions. Ce n'est pas une arborescence de dossiers — c'est une discipline
dont les dossiers ne sont que la trace visible.

## Les cinq niveaux

L'idée : partir du plus petit élément indivisible et composer vers le haut.
Chaque niveau a une règle d'admission stricte, et c'est cette rigueur qui fait
tout le travail. Un niveau sans règle d'admission est juste un dossier.

### Atomes

Les briques indivisibles. Les décomposer leur ferait perdre leur fonction :
`Button`, `Input`, `Label`, `Badge`, `Icon`, `Spinner`.

Un atome ne connaît ni ton API, ni ton store, ni ta logique métier. Il reçoit
des `props`, il rend du HTML. C'est tout — et c'est précisément ce qui le rend
réutilisable partout sans conditions.

> **Règle d'admission** — un atome n'a aucune logique métier et ne connaît
> aucune donnée de l'application. S'il appelle une API ou lit un store, ce n'est
> pas un atome.

Le piège classique à ce niveau est le bouton qui « sait » qu'il sert à
soumettre un formulaire de connexion. Il ne doit pas le savoir : il reçoit un
`onClick`, un libellé et un état `disabled`.

### Molécules

Un groupe d'atomes soudés pour accomplir **une** tâche précise. Un champ de
recherche, c'est un `Label` + un `Input` + un `Button` : trois atomes, une
intention.

Une molécule peut avoir un état local — la valeur du champ, l'ouverture d'un
menu — mais cet état ne concerne qu'elle. Elle ne sait toujours pas d'où
viennent les données.

> **Règle d'admission** — une molécule fait une seule chose. Si tu as besoin
> de « et » pour la décrire, c'est un organisme.

### Organismes

Des sections complètes et autonomes de l'interface : un en-tête de site, une
grille de produits, un formulaire d'inscription. Un organisme peut aller
chercher ses données, gérer des effets, connaître le contexte applicatif.

> **Règle d'admission** — un organisme est identifiable par un
> non-technicien : « le header », « le panier », « la liste des factures ».

C'est le niveau le plus difficile à cadrer, parce que c'est celui où la
tentation de tout mettre est la plus forte. Un organisme de 400 lignes n'est
pas un organisme, c'est une page mal rangée.

### Templates

On abandonne ici la métaphore chimique. Un template est une mise en page : il
place les organismes, définit les zones, les espacements et le comportement
responsive, **sans contenu réel**. C'est le squelette.

Un template ne devrait recevoir que des `children` et des slots. S'il reçoit un
objet `user`, c'est qu'il fait déjà le travail d'une page.

### Pages

L'instance finale. On injecte les vraies données — API, CMS, base — dans le
template. C'est le seul niveau où l'on découvre que le titre de trois mots du
maquettage fait en réalité 140 caractères, et que la liste « quelques
éléments » en compte 2 000.

C'est aussi le niveau où l'on teste les cas limites : liste vide, erreur
réseau, chargement, permissions insuffisantes. Ces états font partie du design,
pas des finitions.

## Le traduire dans l'App Router

L'App Router ajoute une dimension que Brad Frost n'avait pas : la frontière
serveur / client. Elle se superpose remarquablement bien aux niveaux.

| Niveau     | Rendu             | Pourquoi                                                    |
| ---------- | ----------------- | ----------------------------------------------------------- |
| Atomes     | Serveur ou client | Pas d'état : `"use client"` seulement s'ils ont un `onClick` |
| Molécules  | Souvent client    | Elles portent l'interaction locale                           |
| Organismes | Mixte             | Coque serveur, îlots clients à l'intérieur                   |
| Templates  | Serveur           | Pure mise en page                                            |
| Pages      | Serveur           | Le `page.tsx` récupère les données                           |

La règle pratique tient en une phrase : **`"use client"` se pose le plus bas
possible dans l'arbre**. Un `"use client"` sur un template fait basculer tous
ses descendants côté client et annule l'intérêt des Server Components.

### La coque serveur et l'îlot client

Le motif le plus utile en pratique : un organisme rendu côté serveur, qui
délègue la seule partie interactive à un composant client.

```tsx title="components/organisms/invoice-table.tsx"
// Server Component : il récupère et met en forme. Zéro JavaScript envoyé.
import { getInvoices } from "@/lib/invoices";
import { InvoiceRowActions } from "./invoice-row-actions";

export async function InvoiceTable({ clientId }: { clientId: string }) {
  const invoices = await getInvoices(clientId);

  return (
    <table>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>{invoice.reference}</td>
            <td>{invoice.formattedTotal}</td>
            {/* Seule cette cellule embarque du JavaScript. */}
            <td>
              <InvoiceRowActions id={invoice.id} status={invoice.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx title="components/organisms/invoice-row-actions.tsx"
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InvoiceRowActions({ id, status }: Props) {
  const [busy, setBusy] = useState(false);
  // ...
  return <Button disabled={busy}>Relancer</Button>;
}
```

Le tableau peut compter 500 lignes : le HTML est généré côté serveur, et seul
le composant d'actions est hydraté. La différence sur l'INP est massive, et
elle ne coûte qu'un fichier de plus.

### Le piège du contexte

Un `Context` React est forcément client. Si tu enveloppes ton application dans
quatre providers, tout devient client, quelle que soit ta discipline sur
`"use client"`.

Le contournement : un composant `Providers` client, monté dans le layout
racine, qui reçoit `children` **en props**. React rend les enfants côté serveur
et les passe au provider client sans les faire basculer.

```tsx title="app/layout.tsx"
import { Providers } from "@/components/providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* children reste rendu côté serveur : le provider ne le contamine pas. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Le cas shadcn/ui

C'est là que la théorie rencontre la réalité, parce que shadcn installe tout
dans `components/ui` et ne s'intéresse pas à ta taxonomie.

Deux camps s'affrontent : garder `atoms/`, `molecules/`, `organisms/` en
strict, ou tout aplatir. Les deux ont tort à leur manière — le strict noie les
imports sous les dossiers et provoque des débats d'une heure pour savoir si un
`Dropdown` est une molécule ou un organisme ; le plat reproduit le problème
initial.

### L'approche hybride

Traite `components/ui` comme **ta bibliothèque d'atomes**. C'est exactement ce
qu'elle est : des primitives sans logique métier, que tu possèdes et peux
modifier puisque le code est chez toi.

```txt
src/components/
├── ui/            # atomes — shadcn, non métier, jamais de fetch
│   ├── button.tsx
│   ├── input.tsx
│   └── badge.tsx
├── molecules/     # compositions réutilisables, une intention chacune
│   ├── search-field.tsx
│   └── stat-card.tsx
├── organisms/     # sections identifiables du produit
│   ├── site-header.tsx
│   └── invoice-table.tsx
└── templates/     # mises en page sans données
    └── dashboard.tsx
```

Certains composants shadcn sont déjà des molécules déguisées — `Card`,
`Accordion`, `Sheet` composent plusieurs primitives. Ne les déplace pas : la
cohérence des chemins d'import vaut mieux qu'une taxonomie parfaite, et tu veux
que `npx shadcn@latest add` continue de fonctionner sans réorganisation
manuelle. Ce qui compte, c'est la règle d'admission, pas le tiroir.

| Critère           | Strict (Brad Frost)                | Hybride                         |
| ----------------- | ---------------------------------- | ------------------------------- |
| Dossiers          | `atoms/` `molecules/` `organisms/` | `ui/` + 3 dossiers métier       |
| Complexité        | Élevée                             | Faible                          |
| Compatible shadcn | Non, il faut tout déplacer         | Oui, `add` fonctionne tel quel  |
| Cible             | Design systems multi-produits      | Applications et SaaS            |

## Composer plutôt qu'accumuler les props

L'atomic design échoue le plus souvent par le bas : un atome qui grossit
jusqu'à devenir ingérable. Le symptôme est toujours le même — une avalanche de
props booléennes.

```tsx
// ❌ Chaque nouveau besoin ajoute un booléen. Combinatoire ingérable :
// que fait `isPrimary` avec `isGhost` ? Personne ne sait, et le composant non plus.
<Button isPrimary isLarge hasIcon isLoading isFullWidth />
```

Deux réflexes corrigent ça.

**Un, des variantes nommées plutôt que des booléens.** `class-variance-authority`
formalise les combinaisons valides et rend les autres impossibles à écrire.

```tsx title="components/ui/button.tsx"
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-colors",
  {
    variants: {
      variant: {
        solid: "bg-ink text-paper hover:bg-ink/85",
        outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
        ghost: "text-ink hover:bg-black/5",
      },
      size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4", lg: "h-12 px-6" },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

**Deux, la composition plutôt que la configuration.** Quand un composant a
besoin d'un en-tête, d'un pied et d'un corps, ne lui passe pas trois props
`ReactNode` : expose des sous-composants.

```tsx
// ❌ Configuration : chaque nouveau besoin est une prop de plus.
<Card title="Factures" footer={<Button />} badge="3" />

// ✅ Composition : l'appelant assemble ce dont il a besoin.
<Card>
  <Card.Header>
    Factures <Badge>3</Badge>
  </Card.Header>
  <Card.Body>…</Card.Body>
  <Card.Footer>
    <Button>Exporter</Button>
  </Card.Footer>
</Card>
```

### Laisser une porte de sortie

Un composant totalement fermé finit toujours par être dupliqué le jour où il
manque un cas. Accepter `className` et le fusionner avec `tailwind-merge`
suffit à éviter la copie sauvage.

```ts title="lib/utils.ts"
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// twMerge résout les conflits : un `px-6` passé par l'appelant
// remplace le `px-4` du composant au lieu de cohabiter avec lui.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## L'erreur numéro un : des composants trop intelligents

Ce n'est pas l'arborescence qui tue un projet, c'est la logique qui descend là
où elle ne devrait pas. La règle est simple, et elle est plus importante que
tout le reste de cet article.

**Atomes et molécules sont bêtes.** Ils reçoivent des `props`, ils émettent des
callbacks. Jamais de `useAuth`, jamais de `fetch`, jamais de lecture de store.

**Organismes et pages sont intelligents.** C'est là que vivent les données, le
store et les requêtes.

```tsx title="components/molecules/user-card.tsx"
// ✅ Bête : testable, réutilisable, sans dépendance au contexte.
export function UserCard({
  name,
  role,
  onSelect,
}: {
  name: string;
  role: string;
  onSelect: () => void;
}) {
  return (
    <button onClick={onSelect} className="...">
      <span>{name}</span>
      <span>{role}</span>
    </button>
  );
}
```

```tsx title="components/organisms/user-list.tsx"
// ✅ Intelligent : il connaît la source de données et les décisions.
"use client";

import { useQuery } from "@tanstack/react-query";
import { UserCard } from "@/components/molecules/user-card";

export function UserList({ onPick }: { onPick: (id: string) => void }) {
  const { data = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  return data.map((user) => (
    <UserCard key={user.id} {...user} onSelect={() => onPick(user.id)} />
  ));
}
```

Le test qui ne trompe pas : **est-ce que je peux rendre ce composant dans un
fichier de test sans monter un provider ?** Si oui, c'est un atome ou une
molécule. Si non, la logique est descendue trop bas.

## Nommer, sinon dupliquer

Le mode d'échec le plus fréquent n'est pas le mauvais rangement : c'est
`SearchBar` créé par quelqu'un qui n'avait pas trouvé `SearchField`.

Trois conventions suffisent à l'éviter :

- **Nommer par le rôle, pas par l'apparence.** `DangerButton` devient faux le
  jour où le rouge change de sens ; `DestructiveAction` reste vrai.
- **Nommer par le domaine au-dessus des molécules.** `InvoiceTable`,
  `InvoiceFilters`, `InvoiceRowActions` se rangent naturellement ensemble et se
  trouvent d'une recherche.
- **Un composant, un fichier, le même nom.** `invoice-table.tsx` exporte
  `InvoiceTable`. Sans exception, pour que la recherche par fichier fonctionne.

## Migrer un projet qui a déjà dérivé

Personne ne réorganise 80 composants un vendredi après-midi. La migration
progressive marche bien mieux, et elle tient en quatre temps :

1. **Créer les dossiers vides et geler l'ancien.** Rien ne bouge, mais tout
   nouveau composant naît au bon endroit. La dérive s'arrête immédiatement.
2. **Remonter les atomes en premier.** Ils n'ont pas de dépendances : les
   déplacer ne casse que des imports, ce qu'un éditeur corrige tout seul.
3. **Déplacer au fil des tickets.** Un composant touché est un composant qu'on
   range. La couverture progresse là où le code vit vraiment.
4. **Supprimer ce que personne n'importe.** `npx knip` ou
   `npx ts-prune` listent le code mort en quelques secondes ; c'est
   généralement 10 à 20 % du dossier.

L'ordre compte : commencer par les organismes oblige à déplacer leurs
dépendances en même temps, et la migration devient un gros commit risqué.

## Documenter, sinon rien

Un système non documenté est un système que personne ne trouve, donc que tout
le monde recode.

Storybook reste l'outil le plus direct : chaque molécule a une story, chaque
état est visible, et les designers disposent d'un catalogue de ce qui existe
**réellement** plutôt que de ce qui a été maquetté. Un `DatePicker` avec ses
états vide / rempli / désactivé / erreur sur une seule page vaut mieux que
n'importe quelle documentation écrite.

Si Storybook est trop lourd pour ton projet, une route `/design-system`
accessible uniquement en développement fait déjà 80 % du travail — et coûte une
après-midi.

## Les signaux qui disent que ça marche

Trois indicateurs simples, à regarder tous les trimestres :

- **Le temps pour ajouter un écran.** S'il diminue, le système paie. S'il
  augmente, la structure est devenue un obstacle plutôt qu'un appui.
- **Le nombre de composants pour une même intention.** Un seul bouton, un seul
  champ de recherche. Deux, c'est un signal ; trois, c'est une dette.
- **La part de code client.** `next build` affiche le poids du JavaScript par
  route. S'il grossit sans nouvelle fonctionnalité, un `"use client"` est
  remonté trop haut quelque part.

## En résumé

L'atomic design n'est pas une arborescence de dossiers, c'est une **discipline
sur ce que chaque niveau a le droit de savoir**. Les dossiers ne sont que la
trace visible de cette discipline.

Cinq règles suffisent à en tirer l'essentiel :

1. Un composant sans logique métier ne descend jamais vers une source de données.
2. `"use client"` se pose le plus bas possible dans l'arbre.
3. On compose avec des sous-composants plutôt qu'on accumule des props booléennes.
4. On nomme par le rôle et le domaine, jamais par l'apparence.
5. Ce qui n'est pas documenté sera recodé.

Le reste — le nom exact des dossiers, la frontière entre molécule et
organisme — est négociable, et le débat ne mérite pas plus de dix minutes. Ces
cinq règles-là, elles, ne sont pas négociables.
