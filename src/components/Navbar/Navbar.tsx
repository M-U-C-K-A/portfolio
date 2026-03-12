import { useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Navbar.module.css";

type Props = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

const NAV_LINKS = [
  { to: "/presentation", label: "Présentation" },
  { to: "/projects", label: "Projets" },
  { to: "/dev-projects", label: "Dev perso" },
  { to: "/mon-ecole", label: "Mon école" },
  { to: "/about", label: "À propos" },
] as const;

export default function Navbar({ theme, onToggleTheme }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/" className={styles.brand} onClick={() => setOpen(false)}>
          Antoine
        </NavLink>

        <div className={styles.right}>
          <nav
            className={`${styles.nav} ${open ? styles.navOpen : ""}`}
            aria-label="Navigation principale"
            id="main-nav"
          >
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  isActive ? styles.active : styles.link
                }
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className={styles.themeBtn}
            onClick={onToggleTheme}
            aria-label="Changer le thème"
            title="Changer le thème"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>

          <button
            type="button"
            className={styles.burger}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="main-nav"
          >
            <span className={`${styles.burgerLine} ${open ? styles.burgerOpen : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
