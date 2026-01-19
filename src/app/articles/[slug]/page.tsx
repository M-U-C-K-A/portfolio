import { notFound } from "next/navigation";
import { getPosts, getLanguageFromCookies, Language } from "@/utils/utils";
import {
	Meta,
	Schema,
	Button,
	Column,
	Flex,
	Heading,
	Media,
	Text,
	SmartLink,
	Row,
	Line,
	Tag,
} from "@once-ui-system/core";
import { baseURL, about, person, contentByLanguage } from "@/resources";
import { formatDate } from "@/utils/formatDate";
import { ScrollToHash, CustomMDX } from "@/components";
import { Metadata } from "next";

export async function generateStaticParams(): Promise<{ slug: string }[]> {
	// Generate params for all unique base slugs
	const posts = getPosts(["src", "app", "articles", "articles"], "fr");
	return posts.map((post) => ({
		slug: post.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string | string[] }>;
}): Promise<Metadata> {
	const routeParams = await params;
	const slugPath = Array.isArray(routeParams.slug)
		? routeParams.slug.join("/")
		: routeParams.slug || "";

	const language = await getLanguageFromCookies();
	const posts = getPosts(["src", "app", "articles", "articles"], language);
	let post = posts.find((post) => post.slug === slugPath);

	if (!post) return {};

	const localizedArticles = contentByLanguage[language].articles;

	return Meta.generate({
		title: post.metadata.title,
		description: post.metadata.summary,
		baseURL: baseURL,
		image: post.metadata.image || `/api/og/generate?title=${post.metadata.title}`,
		path: `${localizedArticles.path}/${post.slug}`,
	});
}

export default async function Article({
	params,
}: {
	params: Promise<{ slug: string | string[] }>;
}) {
	const routeParams = await params;
	const slugPath = Array.isArray(routeParams.slug)
		? routeParams.slug.join("/")
		: routeParams.slug || "";

	const language = await getLanguageFromCookies();
	const localizedContent = contentByLanguage[language];

	let post = getPosts(["src", "app", "articles", "articles"], language).find(
		(post) => post.slug === slugPath
	);

	if (!post) {
		notFound();
	}

	const articlesLabel = language === "fr" ? "Articles" : "Articles";
	const readTimeLabel = language === "fr" ? "min de lecture" : "min read";

	// Estimate reading time (assuming 200 words per minute)
	const wordCount = post.content.split(/\s+/).length;
	const readingTime = Math.ceil(wordCount / 200);

	return (
		<Column as="section" maxWidth="m" horizontal="center" gap="l">
			<Schema
				as="blogPosting"
				baseURL={baseURL}
				path={`${localizedContent.articles.path}/${post.slug}`}
				title={post.metadata.title}
				description={post.metadata.summary}
				datePublished={post.metadata.publishedAt}
				dateModified={post.metadata.publishedAt}
				image={
					post.metadata.image || `/api/og/generate?title=${encodeURIComponent(post.metadata.title)}`
				}
				author={{
					name: localizedContent.person.name,
					url: `${baseURL}${localizedContent.about.path}`,
					image: `${baseURL}${localizedContent.person.avatar}`,
				}}
			/>
			<Column maxWidth="s" gap="16" horizontal="center" align="center">
				<SmartLink href="/articles">
					<Text variant="label-strong-m">{articlesLabel}</Text>
				</SmartLink>
				<Row gap="8" vertical="center">
					<Text variant="body-default-xs" onBackground="neutral-weak">
						{post.metadata.publishedAt && formatDate(post.metadata.publishedAt)}
					</Text>
					<Text variant="body-default-xs" onBackground="neutral-weak">•</Text>
					<Text variant="body-default-xs" onBackground="neutral-weak">
						{readingTime} {readTimeLabel}
					</Text>
				</Row>
				{post.metadata.tags && post.metadata.tags.length > 0 ? (
					<Row gap="8">
						{post.metadata.tags.map((tag) => (
							<Tag key={tag} size="m" variant="neutral">
								{tag}
							</Tag>
						))}
					</Row>
				) : (
					post.metadata.tag && <Tag size="m" variant="neutral">{post.metadata.tag}</Tag>
				)}
				<Heading variant="display-strong-m" marginTop="8">{post.metadata.title}</Heading>
				{post.metadata.summary && (
					<Text variant="body-default-l" onBackground="neutral-weak" align="center">
						{post.metadata.summary}
					</Text>
				)}
			</Column>
			{post.metadata.images && post.metadata.images.length > 0 && (
				<Media priority aspectRatio="16 / 9" radius="m" alt="image" src={post.metadata.images[0]} />
			)}
			<Column style={{ margin: "auto" }} as="article" maxWidth="xs">
				<CustomMDX source={post.content} />
			</Column>
			<ScrollToHash />
		</Column>
	);
}
