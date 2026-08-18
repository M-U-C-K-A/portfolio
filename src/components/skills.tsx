import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { skills } from "@/lib/content";

export function Skills() {
  return (
    <Section eyebrow="L’outillage">
      <div className="grid gap-x-6 gap-y-10 md:grid-cols-3">
        {skills.map((group) => (
          <div key={group.title} className="flex flex-col gap-4 border-t border-rule pt-5">
            <h3 className="display display-m">{group.title}</h3>
            <p className="body-text max-w-xs text-muted-foreground">{group.text}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <li key={item}>
                  <Badge
                    variant="outline"
                    className="label h-auto border-rule px-2 py-1 text-muted-foreground"
                  >
                    {item}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
