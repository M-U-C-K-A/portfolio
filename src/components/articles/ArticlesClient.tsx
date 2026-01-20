"use client";

import { Column, Flex, Heading, Text, Row, SmartLink, Tag, Media } from "@once-ui-system/core";
import { useLanguage } from "@/components/i18n";
import { useEffect, useState, useRef } from "react";
import { formatDate } from "@/utils/formatDate";
import { ThemeImage } from "@/components/ThemeImage";

interface ArticleData {
	slug: string;
	metadata: {
		title: string;
		summary: string;
		publishedAt: string;
		image?: string;
		images?: string[];
		tag?: string;
		tags?: string[];
	};
	content: string;
}

interface ArticlesClientProps {
	range?: [number, number?];
	exclude?: string[];
}

export function ArticlesClient({ range, exclude }: ArticlesClientProps) {
	const { language } = useLanguage();
	const [articles, setArticles] = useState<ArticleData[]>([]);
	const [loading, setLoading] = useState(true);
	const [initialLoad, setInitialLoad] = useState(true);
	const scrollPosRef = useRef<number>(0);

	useEffect(() => {
		const fetchArticles = async () => {
			scrollPosRef.current = window.scrollY;

			if (!initialLoad) {
				// Don't show loading state on language change to avoid flicker
			} else {
				setLoading(true);
			}

			try {
				const res = await fetch(`/api/articles?lang=${language}`);
				const data = await res.json();
				let allArticles = data.articles || [];

				// Exclude by slug
				if (exclude && exclude.length > 0) {
					allArticles = allArticles.filter((post: ArticleData) => !exclude.includes(post.slug));
				}

				// Sort by date
				allArticles.sort((a: ArticleData, b: ArticleData) => {
					return new Date(b.metadata.publishedAt).getTime() - new Date(a.metadata.publishedAt).getTime();
				});

				// Apply range
				const displayedArticles = range
					? allArticles.slice(range[0] - 1, range[1] ?? allArticles.length)
					: allArticles;

				setArticles(displayedArticles);

				if (!initialLoad) {
					requestAnimationFrame(() => {
						window.scrollTo(0, scrollPosRef.current);
					});
				}
				setInitialLoad(false);
			} catch (error) {
				console.error("Error fetching articles:", error);
			}
			setLoading(false);
		};

		fetchArticles();
	}, [language, range, exclude, initialLoad]);

	const labels = {
		readArticle: language === "fr" ? "Lire l'article" : "Read article",
	};

	if (loading) {
		return (
			<Column fillWidth gap="xl" marginBottom="40" paddingX="l">
				<Text onBackground="neutral-weak">...</Text>
			</Column>
		);
	}

	if (articles.length === 0) {
		return (
			<Column fillWidth gap="xl" marginBottom="40" paddingX="l" horizontal="center">
				<Text onBackground="neutral-weak">
					{language === "fr" ? "Aucun article pour le moment." : "No articles yet."}
				</Text>
			</Column>
		);
	}

	return (
		<Column fillWidth gap="xl" marginBottom="40" paddingX="l" horizontal="center">
			{articles.map((article, index) => {
				const coverImage = article.metadata.image || (article.metadata.images && article.metadata.images[0]);

				return (
					<SmartLink key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none", width: "100%", maxWidth: "48rem" }}>
						<Column
							fillWidth
							background="surface"
							border="neutral-alpha-weak"
							radius="l"
							style={{
								transition: "all 0.25s ease",
								overflow: "hidden"
							}}
						>
							{coverImage && (
								<ThemeImage
									src={coverImage}
									alt={article.metadata.title}
									aspectRatio="21/9"
									sizes="(max-width: 960px) 100vw, 960px"
									priority={index === 0}
								/>
							)}
							<Column gap="s" padding="l">
								<Row gap="8" vertical="center" wrap>
									<Text variant="body-default-xs" onBackground="neutral-weak">
										{formatDate(article.metadata.publishedAt)}
									</Text>
									{article.metadata.tags && article.metadata.tags.length > 0 ? (
										<>
											<Text variant="body-default-xs" onBackground="neutral-weak">•</Text>
											{article.metadata.tags.map((tag) => (
												<Tag key={tag} size="s" variant="neutral">
													{tag}
												</Tag>
											))}
										</>
									) : (
										article.metadata.tag && (
											<>
												<Text variant="body-default-xs" onBackground="neutral-weak">•</Text>
												<Tag size="s" variant="neutral">{article.metadata.tag}</Tag>
											</>
										)
									)}
								</Row>
								<Heading as="h2" variant="heading-strong-l">
									{article.metadata.title}
								</Heading>
								{article.metadata.summary && (
									<Text
										variant="body-default-s"
										onBackground="neutral-weak"
										style={{
											display: "-webkit-box",
											WebkitLineClamp: 3,
											WebkitBoxOrient: "vertical",
											overflow: "hidden"
										}}
									>
										{article.metadata.summary}
									</Text>
								)}
								<Text variant="label-default-s" onBackground="brand-medium" marginTop="8">
									{labels.readArticle} →
								</Text>
							</Column>
						</Column>
					</SmartLink>
				);
			})}
		</Column>
	);
}
