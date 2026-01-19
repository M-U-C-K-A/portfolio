"use client";

import { Column, Heading, Schema } from "@once-ui-system/core";
import { baseURL, contentByLanguage } from "@/resources";
import { ArticlesClient } from "@/components/articles/ArticlesClient";
import { useLanguage } from "@/components/i18n";

export default function Articles() {
	const { language } = useLanguage();
	const content = contentByLanguage[language];
	const { articles, about, person } = content;

	return (
		<Column maxWidth="m" className="bg-red-500" paddingTop="24">
			<Schema
				as="webPage"
				baseURL={baseURL}
				path={articles.path}
				title={articles.title}
				description={articles.description}
				image={`/api/og/generate?title=${encodeURIComponent(articles.title)}`}
				author={{
					name: person.name,
					url: `${baseURL}${about.path}`,
					image: `${baseURL}${person.avatar}`,
				}}
			/>
			<Heading marginBottom="l" variant="heading-strong-xl" align="center">
				{articles.title}
			</Heading>
			<ArticlesClient />
		</Column>
	);
}
