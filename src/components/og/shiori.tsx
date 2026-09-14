/**
 * Shiori — ogimagecn.
 * https://www.ogimagecn.com/docs/components/brand/shiori
 *
 * Copyright (c) 2026 Shadcn Labs. Distribué sous licence MIT :
 * https://github.com/shadcn-labs/ogimagecn/blob/main/LICENSE
 *
 * Deux retouches, toutes deux de mise en page.
 *
 * - Le corps du titre diminue avec sa longueur. L'original le tient à 64 px
 *   quelle qu'elle soit, ce qui va à une accroche de produit et pas à un titre
 *   d'article de soixante-quatorze signes — il montait jusqu'au logo. La règle
 *   est celle que le même registre applique déjà dans Shadcn Registry 6.
 *
 * - La colonne de la marque est élargie et séparée du titre par une gouttière.
 *   L'original lui donne 245 px sans aucun jour : « Finalytics » en mesure 256
 *   à 64 px et venait se coller au titre, « Delacour » en mesure 245 et le
 *   touchait. La colonne fait maintenant 272 px, plus 36 de gouttière. Un nom
 *   de projet d'un seul mot plus long que « Finalytics » demanderait de revoir
 *   ces valeurs.
 */
/* eslint-disable @next/next/no-img-element -- rendu par Satori, pas par le navigateur */

export interface ShioriProps {
  background: string;
  brand: string;
  brandColor: string;
  logo: string;
  title: string;
  titleColor: string;
}
export const Shiori = ({
  title,
  background,
  titleColor,
  logo,
  brand,
  brandColor,
}: ShioriProps) => (
  <div
    style={{
      backgroundColor: background,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "60px",
      position: "relative",
      width: "100%",
    }}
  >
    <img
      alt=""
      height={96}
      src={logo}
      width={96}
      style={{
        borderRadius: "50%",
        objectFit: "contain",
      }}
    />
    <div
      style={{
        bottom: "60px",
        display: "flex",
        gap: "36px",
        justifyContent: "space-between",
        left: "60px",
        position: "absolute",
        right: "60px",
      }}
    >
      <div
        style={{
          color: brandColor,
          flex: 0.27,
          fontSize: "64px",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1.3,
        }}
      >
        {brand}
      </div>
      <div
        style={{
          color: titleColor,
          flex: 0.63,
          fontSize: title.length > 60 ? "48px" : title.length > 40 ? "56px" : "64px",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 0.1 }} />
    </div>
  </div>
);
