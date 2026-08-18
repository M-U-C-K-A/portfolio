import Link from "next/link";
import { ErrorScreen } from "@/components/error-screen";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="contenu" className="flex grow flex-col">
        <ErrorScreen
          code="404"
          title="Cette page n’existe pas."
          description="Le lien est peut-être périmé, ou l’adresse comporte une faute. Le reste du site, lui, est toujours là."
          motif="scan"
          seed={404}
        >
          <Link
            href="/"
            className="label border border-ink px-4 py-3 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Retour à l’accueil
          </Link>
          <Link
            href="/#projets"
            className="label border border-rule px-4 py-3 text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Voir les projets
          </Link>
          <Link
            href="/articles"
            className="label border border-rule px-4 py-3 text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Lire les articles
          </Link>
        </ErrorScreen>
      </main>
      <SiteFooter />
    </>
  );
}
