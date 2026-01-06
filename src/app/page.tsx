import {
  Column,
  RevealFx,
  Schema,
  Meta,
} from "@once-ui-system/core";
import { home, about, person, baseURL } from "@/resources";
import { Mailchimp } from "@/components";
import { HomeContent } from "@/components/HomeContent";
import { ProjectsClient } from "@/components/work/ProjectsClient";

export async function generateMetadata() {
  return Meta.generate({
    title: home.title,
    description: home.description,
    baseURL: baseURL,
    path: home.path,
    image: home.image,
  });
}

export default function Home() {
  return (
    <Column maxWidth="m" gap="xl" paddingY="12" horizontal="center">
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={home.path}
        title={home.title}
        description={home.description}
        image={`/api/og/generate?title=${encodeURIComponent(home.title)}`}
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />
      <HomeContent />
      <RevealFx translateY="16" delay={0.6}>
        <ProjectsClient range={[1, 1]} />
      </RevealFx>
      <ProjectsClient range={[2]} />
      <Mailchimp />
    </Column>
  );
}
