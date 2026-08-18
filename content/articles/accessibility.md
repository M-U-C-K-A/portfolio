---
title: "L'accessibilité ne tue pas le design : les composants complexes"
description: "Modales, glisser-déposer, menus imbriqués. Comment tenir les exigences WCAG sur les composants difficiles sans renoncer à l'esthétique — et pourquoi la contrainte améliore le design plutôt que l'appauvrir."
date: "2026-04-08"
tags: ["Accessibilité", "React", "Design", "UX"]
---

Une idée reçue résiste à tout : un site accessible serait forcément dépouillé,
gris, un peu triste. Elle vient d'une confusion entre *accessible* et *sobre par
défaut* — et elle coûte cher, parce qu'elle sert d'excuse pour repousser
l'accessibilité à la fin, c'est-à-dire à jamais.

La réalité est moins romantique et plus encourageante : les composants
difficiles — modale, glisser-déposer, menu imbriqué — ont tous une solution
connue, documentée, et qui ne touche pas à leur apparence. Ce qui coûte, ce
n'est pas de les rendre accessibles ; c'est de le faire après coup.

## La modale : tout se joue sur le focus

Une modale mal construite est un mur pour qui navigue au clavier : le focus
continue de circuler dans la page *derrière* l'overlay, et l'utilisateur tabule
à l'aveugle dans du contenu qu'il ne voit pas.

Trois règles, et le composant est conforme.

**Le piège à focus.** Tant que la modale est ouverte, `Tab` ne doit jamais en
sortir. Arrivé au dernier élément focusable, le focus revient au premier.

**Le focus initial et sa restitution.** À l'ouverture, le focus va sur le
premier élément utile — pas forcément le bouton de fermeture : sur une modale
de confirmation, l'action principale est un meilleur choix. À la fermeture, il
retourne **exactement** sur l'élément qui a ouvert la modale. Sans ça,
l'utilisateur est renvoyé en haut du document et doit tout retabuler.

**`Échap` ferme.** Sans exception, y compris quand un champ a le focus.

```tsx title="components/modal.tsx"
"use client";

import { useEffect, useRef } from "react";

export function Modal({ open, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      // On mémorise le déclencheur avant de bouger le focus.
      openerRef.current = document.activeElement;
      // showModal() apporte gratuitement le piège à focus, l'inertie de
      // l'arrière-plan et la fermeture par Échap.
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
      (openerRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby="modal-title">
      {children}
    </dialog>
  );
}
```

L'élément `<dialog>` et sa méthode `showModal()` font aujourd'hui la moitié du
travail : piège à focus natif, arrière-plan rendu inerte, `Échap` géré. Il
reste à toi le focus initial, la restitution et le titre accessible.

### Le focus visible n'est pas négociable

C'est le point où design et accessibilité se heurtent le plus souvent, et où le
compromis est le plus facile.

```css
/* ❌ Le raccourci qui exclut tout utilisateur clavier. */
button:focus {
  outline: none;
}

/* ✅ Un anneau qui n'apparaît qu'au clavier, et qu'on peut dessiner. */
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}
```

`:focus-visible` n'active l'anneau que lorsque le navigateur estime que
l'utilisateur navigue au clavier. Le clic à la souris ne l'affiche pas. Tu
gardes ton design **et** ton accessibilité — il n'y a plus d'arbitrage à faire,
juste une pseudo-classe à connaître.

## Le glisser-déposer : offrir un second chemin

Le glisser-déposer est, par nature, une interaction motrice et visuelle. On ne
peut pas la rendre accessible en la décorant d'attributs ARIA : il faut lui
adjoindre un **chemin alternatif complet** au clavier.

Le modèle qui fonctionne :

1. L'élément est focusable et annonce sa fonction : « Élément 2 sur 5,
   réorganisable. Appuyez sur Espace pour saisir. »
2. `Espace` saisit. L'annonce change : « Saisi. Utilisez les flèches pour
   déplacer, Espace pour déposer, Échap pour annuler. »
3. Les flèches déplacent, avec une annonce à chaque pas.
4. `Espace` dépose, `Échap` annule et remet l'élément à sa place initiale.

L'annonce passe par une région live, seule façon de faire parler un lecteur
d'écran sur un changement qui n'a pas déplacé le focus.

```tsx
// La région est toujours présente dans le DOM ; seul son contenu change.
// Un élément inséré au moment de l'annonce ne serait souvent pas lu.
<div aria-live="assertive" aria-atomic="true" className="sr-only">
  {announcement}
</div>
```

```tsx
function onKeyDown(event: React.KeyboardEvent, index: number) {
  if (event.key === " ") {
    event.preventDefault();
    if (grabbed === null) {
      setGrabbed(index);
      announce(`${items[index].label} saisi. Flèches pour déplacer.`);
    } else {
      setGrabbed(null);
      announce(`Déposé en position ${index + 1} sur ${items.length}.`);
    }
    return;
  }

  if (grabbed !== null && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    const next = move(grabbed, event.key === "ArrowUp" ? -1 : 1);
    announce(`Position ${next + 1} sur ${items.length}.`);
  }
}
```

Rien de tout cela ne change l'apparence. L'animation reste la même, l'ombre
portée reste la même. On a simplement ajouté une seconde porte d'entrée.

Le détail qui trahit une implémentation bâclée : oublier `Échap`. Un
utilisateur qui a saisi un élément par erreur doit pouvoir annuler sans le
déposer n'importe où.

## Ce qu'il faut par composant

| Composant        | Rôle ARIA                     | Clavier attendu                     | Piège fréquent                          |
| ---------------- | ----------------------------- | ----------------------------------- | --------------------------------------- |
| Modale           | `dialog` + `aria-modal`       | `Tab` piégé, `Échap`                | Focus non restitué à la fermeture       |
| Menu déroulant   | `menu` / `menuitem`           | Flèches, `Entrée`, `Échap`          | Navigation au `Tab` au lieu des flèches |
| Onglets          | `tablist` / `tab` / `tabpanel` | Flèches, `Home`, `End`             | Tous les onglets dans l'ordre de tabulation |
| Infobulle        | `tooltip` + `aria-describedby` | Apparaît au focus, pas au survol seul | Contenu inaccessible au clavier       |
| Glisser-déposer  | `aria-grabbed` + région live   | `Espace`, flèches, `Échap`         | Aucune alternative clavier              |
| Accordéon        | `button` + `aria-expanded`     | `Entrée` / `Espace`                | `div` cliquable au lieu d'un `button`   |

Une règle traverse ce tableau : **les flèches naviguent à l'intérieur d'un
composant, `Tab` navigue entre les composants**. Un menu de douze entrées ne
doit pas coûter douze `Tab` pour être franchi.

## Les briques : ne pas réécrire ce qui existe

Écrire soi-même un menu conforme prend deux jours et se casse au premier cas
limite. Les bibliothèques *headless* règlent la logique et te laissent tout le
CSS — c'est exactement le partage qu'on veut.

| Outil        | Nature                    | Le mieux pour                              |
| ------------ | ------------------------- | ------------------------------------------ |
| Radix UI     | Primitives sans style     | Construire son propre design system        |
| shadcn/ui    | Composants copiés chez toi | Démarrer vite en gardant la main sur le code |
| React Aria   | Hooks bas niveau          | Cas complexes : grilles, glisser-déposer   |
| Headless UI  | Primitives simples        | Projets Tailwind sans grande complexité    |

Ces bibliothèques ne dessinent rien. Elles gèrent le focus, les rôles, les
touches et les annonces. Tout le rendu reste à toi — ce qui veut dire que
l'argument « ça va uniformiser mon design » ne tient pas : elles n'ont aucune
opinion sur ton apparence.

## Le HTML sémantique fait la moitié du travail

Avant les composants complexes, il y a un gain immédiat et gratuit : arrêter de
tout écrire en `<div>`.

```tsx
// ❌ Structurellement muet : un lecteur d'écran n'y trouve aucun repère.
<div className="header">
  <div className="nav">…</div>
</div>
<div className="content">…</div>

// ✅ Chaque zone devient un point de repère navigable.
<header>
  <nav aria-label="Navigation principale">…</nav>
</header>
<main id="contenu">…</main>
<aside aria-label="Sommaire">…</aside>
```

Les lecteurs d'écran proposent une navigation par **repères** : sauter au
contenu principal, à la navigation, au pied de page. Avec des `div`, cette
liste est vide et l'utilisateur doit parcourir la page linéairement.

Deux compléments qui coûtent cinq minutes :

```tsx
// Un lien d'évitement, premier élément focusable de la page.
<a href="#contenu" className="sr-only focus-visible:not-sr-only">
  Aller au contenu
</a>
```

Et un seul `<h1>` par page, avec une hiérarchie qui ne saute pas de niveau —
`h2` puis `h4` désoriente autant qu'un sommaire mal numéroté.

## Le cas des applications à navigation client

Dans une application React, cliquer sur un lien ne recharge pas la page. Le
navigateur ne remet donc **pas** le focus au début du document : il reste sur
le lien cliqué, qui n'existe peut-être plus.

Concrètement, un utilisateur clavier change de page et se retrouve au milieu de
nulle part. Le lecteur d'écran, lui, n'annonce rien du tout : pour lui, rien
n'a changé.

```tsx title="components/route-announcer.tsx"
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [label, setLabel] = useState("");
  const first = useRef(true);

  useEffect(() => {
    // Le premier rendu n'est pas une navigation : on ne l'annonce pas.
    if (first.current) {
      first.current = false;
      return;
    }
    setLabel(document.title);
    // On renvoie le focus en tête de contenu, pas sur le body.
    document.getElementById("contenu")?.focus();
  }, [pathname]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {label}
    </p>
  );
}
```

Avec `tabIndex={-1}` sur `<main id="contenu">`, l'élément devient focusable par
programme sans entrer dans l'ordre de tabulation. C'est une vingtaine de lignes
pour un problème qui rend une application inutilisable au clavier.

## Ce que l'accessibilité apporte au design

Le point que l'idée reçue rate complètement : les contraintes d'accessibilité
sont des contraintes de **clarté**, et la clarté est un objectif de design.

- **Le contraste minimal de 4,5:1** interdit le gris clair sur blanc. Ce texte
  était déjà illisible au soleil, sur un écran d'entrée de gamme, ou pour
  n'importe qui de plus de quarante-cinq ans.
- **Les cibles de 44 pixels** interdisent les boutons minuscules. Ils étaient
  déjà pénibles au pouce dans le métro.
- **Un état visible autrement que par la couleur** interdit le champ en erreur
  signalé par un seul liseré rouge. Il était déjà invisible pour 8 % des hommes,
  et discret pour tout le monde.
- **Un texte alternatif obligatoire** oblige à se demander ce que l'image
  apporte. Souvent : rien, et on la retire.

Aucune de ces contraintes n'appauvrit un design. Elles éliminent des choix
paresseux — ce qui est le contraire.

## En résumé

1. **La modale** se joue entièrement sur le focus : piégé, initialisé,
   restitué. `<dialog>` en fait déjà la moitié.
2. **Le glisser-déposer** a besoin d'un chemin clavier complet et d'une région
   live pour l'annoncer. L'apparence n'y change rien.
3. **`:focus-visible`** met fin à l'arbitrage entre anneau de focus et design.
4. **Le HTML sémantique** offre le meilleur rapport effort/gain de toute la
   discipline.
5. **Les navigations client** doivent replacer le focus et annoncer la page.

Et la conclusion qui compte : l'accessibilité n'est pas une taxe sur le design,
c'est une exigence de précision. Les interfaces qui la respectent sont
généralement les plus claires — pas par hasard.
