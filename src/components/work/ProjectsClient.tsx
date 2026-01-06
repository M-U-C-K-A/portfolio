"use client";

import { Column, Flex, Heading, Text, Row, AvatarGroup, SmartLink, Carousel } from "@once-ui-system/core";
import { useLanguage } from "@/components/i18n";
import { useEffect, useState, useRef } from "react";

interface ProjectData {
	slug: string;
	metadata: {
		title: string;
		summary: string;
		publishedAt: string;
		images: string[];
		team?: Array<{ avatar: string }>;
		link?: string;
	};
	content: string;
}

interface ProjectsClientProps {
	range?: [number, number?];
	exclude?: string[];
}

export function ProjectsClient({ range, exclude }: ProjectsClientProps) {
	const { language } = useLanguage();
	const [projects, setProjects] = useState<ProjectData[]>([]);
	const [loading, setLoading] = useState(true);
	const [initialLoad, setInitialLoad] = useState(true);
	const scrollPosRef = useRef<number>(0);

	useEffect(() => {
		const fetchProjects = async () => {
			// Save scroll position before loading
			scrollPosRef.current = window.scrollY;

			if (!initialLoad) {
				// Don't show loading state on language change to avoid flicker
			} else {
				setLoading(true);
			}

			try {
				const res = await fetch(`/api/projects?lang=${language}`);
				const data = await res.json();
				let allProjects = data.projects || [];

				// Exclude by slug
				if (exclude && exclude.length > 0) {
					allProjects = allProjects.filter((post: ProjectData) => !exclude.includes(post.slug));
				}

				// Sort by date
				allProjects.sort((a: ProjectData, b: ProjectData) => {
					return new Date(b.metadata.publishedAt).getTime() - new Date(a.metadata.publishedAt).getTime();
				});

				// Apply range
				const displayedProjects = range
					? allProjects.slice(range[0] - 1, range[1] ?? allProjects.length)
					: allProjects;

				setProjects(displayedProjects);

				// Restore scroll position after update (only on language change)
				if (!initialLoad) {
					requestAnimationFrame(() => {
						window.scrollTo(0, scrollPosRef.current);
					});
				}
				setInitialLoad(false);
			} catch (error) {
				console.error("Error fetching projects:", error);
			}
			setLoading(false);
		};

		fetchProjects();
	}, [language, range, exclude, initialLoad]);

	const labels = {
		readCase: language === "fr" ? "Lire le cas d'étude" : "Read case study",
		viewProject: language === "fr" ? "Voir le projet" : "View project",
	};

	if (loading) {
		return (
			<Column fillWidth gap="xl" marginBottom="40" paddingX="l">
				<Text onBackground="neutral-weak">...</Text>
			</Column>
		);
	}

	return (
		<Column fillWidth gap="xl" marginBottom="40" paddingX="l">
			{projects.map((post) => {
				const avatars = post.metadata.team?.map((member) => ({ src: member.avatar })) || [];

				return (
					<Column key={post.slug} fillWidth gap="m">
						{post.metadata.images && post.metadata.images.length > 0 && (
							<Carousel
								sizes="(max-width: 960px) 100vw, 960px"
								items={post.metadata.images.map((image, index) => ({
									slide: image,
									alt: `${post.metadata.title} - ${index + 1}`,
								}))}
							/>
						)}
						<Flex
							s={{ direction: "column" }}
							fillWidth
							paddingX="s"
							paddingTop="12"
							paddingBottom="24"
							gap="l"
						>
							{post.metadata.title && (
								<Flex flex={5}>
									<Heading as="h2" wrap="balance" variant="heading-strong-xl">
										{post.metadata.title}
									</Heading>
								</Flex>
							)}
							{(avatars.length > 0 || post.metadata.summary?.trim() || post.content?.trim()) && (
								<Column flex={7} gap="16">
									{avatars.length > 0 && <AvatarGroup avatars={avatars} size="m" reverse />}
									{post.metadata.summary?.trim() && (
										<Text wrap="balance" variant="body-default-s" onBackground="neutral-weak">
											{post.metadata.summary}
										</Text>
									)}
									<Flex gap="24" wrap>
										{post.content?.trim() && (
											<SmartLink
												suffixIcon="arrowRight"
												style={{ margin: "0", width: "fit-content" }}
												href={`/work/${post.slug}`}
											>
												<Text variant="body-default-s">{labels.readCase}</Text>
											</SmartLink>
										)}
										{post.metadata.link && (
											<SmartLink
												suffixIcon="arrowUpRightFromSquare"
												style={{ margin: "0", width: "fit-content" }}
												href={post.metadata.link}
											>
												<Text variant="body-default-s">{labels.viewProject}</Text>
											</SmartLink>
										)}
									</Flex>
								</Column>
							)}
						</Flex>
					</Column>
				);
			})}
		</Column>
	);
}
