"use client";

import { Column, Heading, Schema } from "@once-ui-system/core";
import { baseURL, contentByLanguage } from "@/resources";
import { ProjectsClient } from "@/components/work/ProjectsClient";
import { useLanguage } from "@/components/i18n";

export default function Work() {
  const { language } = useLanguage();
  const content = contentByLanguage[language];
  const { work, about, person } = content;

  return (
    <Column maxWidth="m" paddingTop="24">
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={work.path}
        title={work.title}
        description={work.description}
        image={`/api/og/generate?title=${encodeURIComponent(work.title)}`}
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />
      <Heading marginBottom="l" variant="heading-strong-xl" align="center">
        {work.title}
      </Heading>
      <ProjectsClient />
    </Column>
  );
}
