"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/error-screen";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En production, le message est masqué côté client : le `digest` est la
    // seule façon de relier l'incident affiché aux journaux du serveur.
    console.error("Erreur de rendu", error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="flex grow flex-col">
        <ErrorScreen
          code="500"
          title="Quelque chose a lâché."
          description="Une erreur est survenue pendant le rendu de cette page. Réessayer suffit souvent ; sinon le reste du site fonctionne."
          detail={error.digest ? `Référence : ${error.digest}` : undefined}
          motif="rain"
          seed={500}
        >
          <button
            type="button"
            onClick={reset}
            className="label border border-ink px-4 py-3 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="label border border-rule px-4 py-3 text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Retour à l’accueil
          </Link>
        </ErrorScreen>
      </main>
      <SiteFooter />
    </>
  );
}
