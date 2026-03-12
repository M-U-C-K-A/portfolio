import styles from "../styles/presentation.module.css";
import { Link } from "react-router-dom";
import Timeline from "../components/Timeline/Timeline";
import { timeline } from "../data/timeline";

/* ─── Skills data ─── */
const SKILLS = [
  {
    code: "UNIT-LANG",
    title: "Langages",
    items: ["Java", "TypeScript", "Python", "C / C++"],
  },
  {
    code: "UNIT-FRONT",
    title: "Frontend",
    items: ["React", "Vite", "CSS Modules", "HTML5"],
  },
  {
    code: "UNIT-SYS",
    title: "Systèmes / Backend",
    items: ["Node.js", "Spigot API", "Linux", "Git", "Docker"],
  },
] as const;

const INTERESTS = [
  { to: "/interests/chess", label: "Échecs", code: "INT-01" },
  { to: "/interests/f1", label: "Formule 1", code: "INT-02" },
  { to: "/interests/table-tennis", label: "Tennis de table", code: "INT-03" },
  { to: "/interests/gaming", label: "Jeux vidéos", code: "INT-04" },
  { to: "/interests/travel", label: "Voyages", code: "INT-05" },
] as const;

function calculateAge(birth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default function Presentation() {
  const age = calculateAge(new Date("2004-04-23"));

  return (
    <section className={styles.page}>
      {/* ─── HEADER ─── */}
      <div className={styles.header}>
        <span className={styles.headerCode}>FICHIER — AGENT ANTOINE</span>
        <span className={styles.headerClassif}>CLASSIFICATION: INTERNE</span>
      </div>

      {/* ─── DOSSIER AGENT ─── */}
      <div className={styles.dossier}>
        <div className={styles.dossierTop}>
          <span className={styles.stamp}>PERSONNEL</span>
          <span className={styles.dossierRef}>REF: AGT-042-PRES</span>
        </div>

        <div className={styles.dossierBody}>
          <img
            src="/profilPicture.jpg"
            alt="Photo d'identification — Antoine"
            className={styles.avatar}
            width={140}
            height={140}
          />

          <div className={styles.intelGrid}>
            <div className={styles.intelRow}>
              <span className={styles.intelLabel}>IDENTITÉ</span>
              <span className={styles.intelValue}>Antoine</span>
            </div>
            <div className={styles.intelRow}>
              <span className={styles.intelLabel}>ÂGE</span>
              <span className={styles.intelValue}>{age} ans</span>
            </div>
            <div className={styles.intelRow}>
              <span className={styles.intelLabel}>ZONE</span>
              <span className={styles.intelValue}>Picardie / Normandie</span>
            </div>
            <div className={styles.intelRow}>
              <span className={styles.intelLabel}>PERMIS</span>
              <span className={styles.intelValue}>B — en cours</span>
            </div>
            <div className={styles.intelRow}>
              <span className={styles.intelLabel}>AFFILIATION</span>
              <span className={styles.intelValue}>École 42 — Le Havre</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BRIEFING ─── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionCode}>SECTION-01</span>
          <span className={styles.sectionTitle}>BRIEFING</span>
          <span className={styles.sectionLine} />
        </div>

        <div className={styles.sectionBody}>
          <p>
            Je développe depuis mes 15–16 ans, en commençant par Java en
            autodidacte. Très tôt, j'ai été attiré par la logique, la
            structuration du code et la construction de systèmes modulaires.
          </p>
          <p>
            Mon parcours m'a amené à travailler sur des projets variés :
            plugins Spigot, applications web modernes, projets systèmes et
            architectures orientées composants.
          </p>
        </div>
      </div>

      {/* ─── HISTORIQUE DES OPÉRATIONS ─── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionCode}>SECTION-02</span>
          <span className={styles.sectionTitle}>HISTORIQUE DES OPÉRATIONS</span>
          <span className={styles.sectionLine} />
        </div>

        <div className={styles.sectionBody}>
          <p className={styles.sectionHint}>
            Chronologie des missions, formations et déploiements de l'agent.
          </p>
          <Timeline items={timeline} />
        </div>
      </div>

      {/* ─── ARSENAL TECHNIQUE ─── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionCode}>SECTION-03</span>
          <span className={styles.sectionTitle}>ARSENAL TECHNIQUE</span>
          <span className={styles.sectionLine} />
        </div>

        <div className={styles.skillsGrid}>
          {SKILLS.map(({ code, title, items }) => (
            <div key={code} className={styles.skillCard}>
              <div className={styles.skillCardHeader}>
                <span className={styles.skillCode}>{code}</span>
                <h3 className={styles.skillTitle}>{title}</h3>
              </div>
              <ul className={styles.skillList}>
                {items.map((item) => (
                  <li key={item} className={styles.skillItem}>
                    <span className={styles.skillBullet}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ─── ZONES D'INTÉRÊT ─── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionCode}>SECTION-04</span>
          <span className={styles.sectionTitle}>ZONES D'INTÉRÊT</span>
          <span className={styles.sectionLine} />
        </div>

        <div className={styles.interestGrid}>
          {INTERESTS.map(({ to, label, code }) => (
            <Link key={to} to={to} className={styles.interestLink}>
              <span className={styles.interestCode}>{code}</span>
              <span className={styles.interestLabel}>{label}</span>
              <span className={styles.interestArrow}>→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <div className={styles.pageFooter}>
        FIN DU DOSSIER — DOCUMENT INTERNE
      </div>
    </section>
  );
}