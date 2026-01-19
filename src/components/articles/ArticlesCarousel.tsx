"use client";

import { Column, Flex, Heading, Text, Row, SmartLink, Tag, Media, RevealFx } from "@once-ui-system/core";
import { useLanguage } from "@/components/i18n";
import { useEffect, useState } from "react";
import { formatDate } from "@/utils/formatDate";

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

interface ArticlesCarouselProps {
	limit?: number;
}

export function ArticlesCarousel({ limit = 3 }: ArticlesCarouselProps) {
	const { language } = useLanguage();
	const [articles, setArticles] = useState<ArticleData[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchArticles = async () => {
			setLoading(true);
			try {
				const res = await fetch(`/api/articles?lang=${language}`);
				const data = await res.json();
				let allArticles = data.articles || [];

				// Sort by date
				allArticles.sort((a: ArticleData, b: ArticleData) => {
					return new Date(b.metadata.publishedAt).getTime() - new Date(a.metadata.publishedAt).getTime();
				});

				// Limit articles
				setArticles(allArticles.slice(0, limit));
			} catch (error) {
				console.error("Error fetching articles:", error);
			}
			setLoading(false);
		};

		fetchArticles();
	}, [language, limit]);

	const labels = {
		title: language === "fr" ? "Articles récents" : "Recent Articles",
		readMore: language === "fr" ? "Voir tous les articles" : "View all articles",
		readArticle: language === "fr" ? "Lire" : "Read",
	};

	if (loading) {
		return null;
	}

	if (articles.length === 0) {
		return null;
	}

	return (
		<Column fillWidth gap="l" paddingX="l">
			<Row fillWidth horizontal="between" vertical="center">
				<Heading as="h2" variant="heading-strong-l">
					{labels.title}
				</Heading>
				<SmartLink href="/articles">
					<Text variant="label-default-s" onBackground="brand-medium">
						{labels.readMore} →
					</Text>
				</SmartLink>
			</Row>
			<Row
				fillWidth
				gap="m"
				style={{
					overflowX: "auto",
					scrollSnapType: "x mandatory",
					paddingBottom: "8px"
				}}
			>
				{articles.map((article, index) => {
					const coverImage = article.metadata.image || (article.metadata.images && article.metadata.images[0]);

					return (
						<RevealFx key={article.slug} translateY="8" delay={0.1 * index}>
							<SmartLink href={`/articles/${article.slug}`} style={{ textDecoration: "none" }}>
								<Column
									gap="s"
									padding="m"
									background="surface"
									border="neutral-alpha-weak"
									radius="l"
									style={{
										minWidth: "280px",
										maxWidth: "320px",
										scrollSnapAlign: "start",
										transition: "all 0.2s ease"
									}}
								>
									{coverImage && (
										<Media
											aspectRatio="16 / 9"
											radius="s"
											alt={article.metadata.title}
											src={coverImage}
										/>
									)}
									<Column gap="4">
										<Row gap="8" vertical="center">
											<Text variant="body-default-xs" onBackground="neutral-weak">
												{formatDate(article.metadata.publishedAt)}
											</Text>
											{article.metadata.tags && article.metadata.tags.length > 0 ? (
												<Tag size="s" variant="neutral">{article.metadata.tags[0]}</Tag>
											) : (
												article.metadata.tag && <Tag size="s" variant="neutral">{article.metadata.tag}</Tag>
											)}
										</Row>
										<Heading as="h3" variant="heading-strong-s">
											{article.metadata.title}
										</Heading>
										{article.metadata.summary && (
											<Text
												variant="body-default-xs"
												onBackground="neutral-weak"
												style={{
													display: "-webkit-box",
													WebkitLineClamp: 2,
													WebkitBoxOrient: "vertical",
													overflow: "hidden"
												}}
											>
												{article.metadata.summary}
											</Text>
										)}
									</Column>
								</Column>
							</SmartLink>
						</RevealFx>
					);
				})}
			</Row>
		</Column>
	);
}
