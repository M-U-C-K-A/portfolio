import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layout/RootLayout";
import Home from "../pages/Home";
import Projects from "../pages/Projects";
import DevProjects from "../pages/DevProjects";
import NotFound from "../pages/NotFound";
import RouteError from "../pages/RouteError";
import ProjectDetail from "../pages/ProjectDetail";
import DevProjectDetail from "../pages/DevProjectDetail";
import Chess from "../pages/interests/Chess";
import F1 from "../pages/interests/F1";
import TableTennis from "../pages/interests/TableTennis";
import Gaming from "../pages/interests/Gaming";
import Travel from "../pages/interests/Travel";
import Presentation from "../pages/Presentation";
import About from "../pages/About";
import GameDetail from "../pages/interests/GameDetail";
import ValorantPage from "../pages/interests/gaming/Valorant";
import ValorantMatchDetail from "../pages/interests/gaming/ValorantMatchDetail";
import SectionThemeLayout from "../layouts/SectionThemeLayout";
import ClashRoyale from "../pages/interests/gaming/ClashRoyale";
import DeadByDaylightPage from "../pages/interests/gaming/DeadByDaylight";
import ClashOfClansPage from "../pages/interests/gaming/ClashOfClans";
import Intra42Page from "../pages/Intra42";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: "presentation", element: <Presentation /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/:slug", element: <ProjectDetail /> },
      { path: "dev-projects", element: <DevProjects /> },
      { path: "dev-projects/:slug", element: <DevProjectDetail /> },
      { path: "mon-ecole", element: <Intra42Page /> },
      { path: "interests/chess", element: <Chess /> },
      {
        path: "interests/f1",
        element: <SectionThemeLayout themeClass="theme-f1" />,
        children: [{ index: true, element: <F1 /> }],
      },
      { path: "interests/table-tennis", element: <TableTennis /> },
      { path: "interests/gaming", element: <Gaming /> },
      { path: "interests/travel", element: <Travel /> },
      { path: "about", element: <About /> },
      { path: "interests/gaming/:slug", element: <GameDetail /> },
      {
        path: "interests/gaming/valorant",
        element: <SectionThemeLayout themeClass="theme-valorant" />,
        children: [
          { index: true, element: <ValorantPage /> },
          { path: "match/:matchId", element: <ValorantMatchDetail /> },
        ],
      },
      {
        path: "interests/gaming/clash-royale",
        element: <SectionThemeLayout themeClass="theme-clash" />,
        children: [{ index: true, element: <ClashRoyale /> }],
      },
      {
        path: "interests/gaming/dead-by-daylight",
        element: <SectionThemeLayout themeClass="theme-dbd" />,
        children: [{ index: true, element: <DeadByDaylightPage /> }],
      },
      {
        path: "interests/gaming/clash-of-clans",
        element: <SectionThemeLayout themeClass="theme-coc" />,
        children: [{ index: true, element: <ClashOfClansPage /> }],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
