import { Outlet } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import styles from "./RootLayout.module.css";
import { useTheme } from "../theme/useTheme";

export default function RootLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
