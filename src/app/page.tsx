import { Contact } from "@/components/contact";
import { Hero } from "@/components/hero";
import { Method } from "@/components/method";
import { PixelBand } from "@/components/pixel-band";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Skills } from "@/components/skills";
import { Statements } from "@/components/statements";
import { Timeline } from "@/components/timeline";
import { WorkGrid } from "@/components/work-grid";
import { Writing } from "@/components/writing";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="contenu">
        <Hero />
        <WorkGrid />
        <PixelBand seed={23} caption="La grille réagit aussi ici" />
        <Statements />
        <Method />
        <PixelBand seed={57} className="h-[30vh] min-h-[180px]" />
        <Timeline />
        <Skills />
        <Writing />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
