import { Marquee } from "@/components/marquee";
import { Button } from "@/components/ui/button";
import { contact, site } from "@/lib/content";

const details = [
  { label: "Écrire", value: site.email, href: `mailto:${site.email}` },
  { label: "GitHub", value: "M-U-C-K-A", href: site.links.github },
  { label: "LinkedIn", value: "hugo-delacour", href: site.links.linkedin },
  { label: "Basé à", value: site.location, href: null },
];

export function Contact() {
  return (
    <section id="contact" className="scroll-mt-11 border-t border-rule">
      <Marquee text={contact.marquee} className="border-t-0" />

      <div className="shell py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-6">
            <h2 className="display display-l max-w-lg">{contact.headline}</h2>
            <p className="body-text mt-6 max-w-xl text-muted-foreground">
              {contact.body}
            </p>
            <Button
              asChild
              size="lg"
              className="label mt-8 h-auto px-5 py-3.5 tracking-[0.16em]"
            >
              <a href={`mailto:${site.email}`}>{contact.cta}</a>
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 self-end lg:col-span-5 lg:col-start-8">
            {details.map((detail) => (
              <div key={detail.label} className="border-t border-rule pt-3">
                <dt className="label text-muted-foreground">{detail.label}</dt>
                <dd className="body-text mt-1 break-words">
                  {detail.href ? (
                    <a
                      href={detail.href}
                      target={detail.href.startsWith("http") ? "_blank" : undefined}
                      rel={
                        detail.href.startsWith("http")
                          ? "noreferrer noopener"
                          : undefined
                      }
                      className="underline decoration-rule underline-offset-4 transition-colors hover:decoration-ink"
                    >
                      {detail.value}
                    </a>
                  ) : (
                    detail.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
