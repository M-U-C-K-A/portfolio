import { ImageResponse } from "next/og";
import { site } from "@/lib/content";

export const alt = `${site.name} — ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Rampe du canvas, reprise ici pour la ligne de pixels d'accent. */
const RAMP = ["#0f0f11", "#3a3a40", "#6b6b73", "#9c9ca3", "#cdcdd2", "#1d3fff"];

/**
 * Image de partage. L'ancien site en générait une à la volée ; sans elle, les
 * liens partagés arrivent sans vignette. Rendue au build, une seule fois.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafaf8",
          color: "#0f0f11",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#6e6e72",
          }}
        >
          {site.location}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 600,
              letterSpacing: -4,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            Propre,
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 600,
              letterSpacing: -4,
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            par défaut.
          </div>

          {/* Une ligne de pixels : la signature du site, en statique. */}
          <div style={{ display: "flex", gap: 8, marginTop: 40 }}>
            {[0, 1, 2, 3, 4, 5, 3, 5, 1, 4, 5, 2].map((tone, index) => (
              <div
                key={index}
                style={{ width: 26, height: 26, background: RAMP[tone] }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(15,15,17,0.16)",
            paddingTop: 28,
            fontSize: 26,
          }}
        >
          <div style={{ display: "flex", fontWeight: 600 }}>{site.name}</div>
          <div style={{ display: "flex", color: "#6e6e72" }}>{site.role}</div>
        </div>
      </div>
    ),
    size,
  );
}
