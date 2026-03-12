import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import styles from "../styles/home.module.css";

/* ---------- helpers ---------- */
function calculateAge(birth: Date) {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function useTyping(text: string, speed = 45) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    setDisplayed("");
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

/* ---------- data ---------- */
const SECTORS = [
  { to: "/presentation", label: "PRÉSENTATION", code: "SECTOR-A" },
  { to: "/projects",     label: "PROJETS",       code: "SECTOR-B" },
  { to: "/dev-projects", label: "DEV PERSO",     code: "SECTOR-C" },
  { to: "/mon-ecole",    label: "42 SCHOOL",     code: "SECTOR-D" },
  { to: "/interests/gaming", label: "GAMING",    code: "SECTOR-E" },
  { to: "/about",        label: "À PROPOS",      code: "SECTOR-F" },
] as const;

const INTEL = [
  { label: "NOM DE CODE",  value: "Antoine" },
  { label: "ÂGE",          value: `${calculateAge(new Date("2004-04-23"))} ans` },
  { label: "ZONE",         value: "Picardie / Normandie" },
  { label: "STATUS",       value: "Étudiant — 42" },
  { label: "CLEARANCE",    value: "LEVEL 5" },
] as const;

const STATS = [
  { label: "ANNÉES DE CODE", value: "8+",  icon: "⌨" },
  { label: "ÉCOLE",          value: "42",  icon: "🎓" },
  { label: "PROJETS ACTIFS", value: "12+", icon: "📡" },
  { label: "CURIOSITÉ",      value: "∞",   icon: "🔬" },
] as const;

/* ---------- component ---------- */
export default function Home() {
  const typed = useTyping("BIENVENUE, COMMANDANT. DOSSIER PRÊT.", 40);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className={`${styles.page} ${ready ? styles.ready : ""}`}>
      {/* ─── TOP BAR ─── */}
      <div className={styles.topBar}>
        <span className={styles.topBarLeft}>
          <span className={styles.pulse} />
          SYSTÈME OPÉRATIONNEL
        </span>
        <span className={styles.topBarRight}>
          PORTFOLIO — DOSSIER CONFIDENTIEL
        </span>
      </div>

      {/* ─── HERO DOSSIER ─── */}
      <div className={styles.dossier}>
        <div className={styles.dossierHeader}>
          <span className={styles.stamp}>CONFIDENTIEL</span>
          <span className={styles.dossierCode}>DOSSIER N° 42-APR-2004</span>
        </div>

        <div className={styles.dossierBody}>
          {/* Photo badge */}
          <div className={styles.badge}>
            <img
              src="/profilPicture.jpg"
              alt="Photo d'identification – Antoine"
              className={styles.avatar}
              width={160}
              height={160}
            />
            <div className={styles.badgeLabel}>AGENT: ANTOINE</div>
          </div>

          {/* Intel grid */}
          <div className={styles.intelGrid}>
            {INTEL.map(({ label, value }) => (
              <div key={label} className={styles.intelRow}>
                <span className={styles.intelLabel}>{label}</span>
                <span className={styles.intelValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal line */}
        <div className={styles.termLine}>
          <span className={styles.termPrompt}>root@portfolio:~$</span>
          <span className={styles.termText}>{typed}</span>
          <span className={styles.cursor}>▊</span>
        </div>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className={styles.statsRow}>
        {STATS.map(({ label, value, icon }) => (
          <div key={label} className={styles.statCard}>
            <span className={styles.statIcon}>{icon}</span>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* ─── SECTOR NAV ─── */}
      <div className={styles.sectorTitle}>
        <span className={styles.sectorTitleLine} />
        <span>ACCÈS AUX SECTEURS</span>
        <span className={styles.sectorTitleLine} />
      </div>

      <div className={styles.sectorGrid}>
        {SECTORS.map(({ to, label, code }) => (
          <Link key={to} to={to} className={styles.sector}>
            <span className={styles.sectorCode}>{code}</span>
            <span className={styles.sectorName}>{label}</span>
            <span className={styles.sectorArrow}>→</span>
          </Link>
        ))}
      </div>

      {/* ─── FOOTER LINE ─── */}
      <div className={styles.footerLine}>
        <span>CLASSIFICATION: PORTFOLIO — USAGE PERSONNEL</span>
        <span>DERNIÈRE MAJ: {new Date().toLocaleDateString("fr-FR")}</span>
      </div>
    </section>
  );
}
