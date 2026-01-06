"use client";

import {
	Avatar,
	Button,
	Column,
	Heading,
	Icon,
	IconButton,
	Media,
	Tag,
	Text,
	Row,
} from "@once-ui-system/core";
import { useLanguage } from "@/components/i18n";
import { contentByLanguage, social } from "@/resources";
import styles from "@/components/about/about.module.scss";
import React from "react";

interface AboutContentProps {
	structure: Array<{
		title: string;
		display: boolean;
		items: string[];
	}>;
}

export function AboutContent() {
	const { language } = useLanguage();
	const content = contentByLanguage[language];
	const { about, person } = content;

	return (
		<Row fillWidth s={{ direction: "column" }} horizontal="center">
			{about.avatar.display && (
				<Column
					className={styles.avatar}
					top="64"
					fitHeight
					position="sticky"
					s={{ position: "relative", style: { top: "auto" } }}
					xs={{ style: { top: "auto" } }}
					minWidth="160"
					paddingX="l"
					paddingBottom="xl"
					gap="m"
					flex={3}
					horizontal="center"
				>
					<Avatar src={person.avatar} size="xl" />
					<Row gap="8" vertical="center">
						<Icon onBackground="accent-weak" name="globe" />
						{person.location}
					</Row>
					{person.languages && person.languages.length > 0 && (
						<Row wrap gap="8">
							{person.languages.map((lang, index) => (
								<Tag key={index} size="l">
									{lang}
								</Tag>
							))}
						</Row>
					)}
				</Column>
			)}
			<Column className={styles.blockAlign} flex={9} maxWidth={40}>
				<Column
					id={about.intro.title}
					fillWidth
					minHeight="160"
					vertical="center"
					marginBottom="32"
				>
					{about.calendar.display && (
						<Row
							fitWidth
							border="brand-alpha-medium"
							background="brand-alpha-weak"
							radius="full"
							padding="4"
							gap="8"
							marginBottom="m"
							vertical="center"
							className={styles.blockAlign}
							style={{
								backdropFilter: "blur(var(--static-space-1))",
							}}
						>
							<Icon paddingLeft="12" name="calendar" onBackground="brand-weak" />
							<Row paddingX="8">
								{language === "fr" ? "Planifier un appel" : "Schedule a call"}
							</Row>
							<IconButton
								href={about.calendar.link}
								data-border="rounded"
								variant="secondary"
								icon="chevronRight"
							/>
						</Row>
					)}
					<Heading className={styles.textAlign} variant="display-strong-xl">
						{person.name}
					</Heading>
					<Text
						className={styles.textAlign}
						variant="display-default-xs"
						onBackground="neutral-weak"
					>
						{person.role}
					</Text>
					{social.length > 0 && (
						<Row
							className={styles.blockAlign}
							paddingTop="20"
							paddingBottom="8"
							gap="8"
							wrap
							horizontal="center"
							fitWidth
							data-border="rounded"
						>
							{social.map(
								(item) =>
									item.link && (
										<React.Fragment key={item.name}>
											<Row s={{ hide: true }}>
												<Button
													key={item.name}
													href={item.link}
													prefixIcon={item.icon}
													label={item.name}
													size="s"
													weight="default"
													variant="secondary"
												/>
											</Row>
											<Row hide s={{ hide: false }}>
												<IconButton
													size="l"
													key={`${item.name}-icon`}
													href={item.link}
													icon={item.icon}
													variant="secondary"
												/>
											</Row>
										</React.Fragment>
									)
							)}
						</Row>
					)}
				</Column>

				{about.intro.display && (
					<Column textVariant="body-default-l" fillWidth gap="m" marginBottom="xl">
						{about.intro.description}
					</Column>
				)}

				{about.work.display && (
					<>
						<Heading as="h2" id={about.work.title} variant="display-strong-s" marginBottom="m">
							{about.work.title}
						</Heading>
						<Column fillWidth gap="l" marginBottom="40">
							{about.work.experiences.map((experience, index) => (
								<Column key={`${experience.company}-${experience.role}-${index}`} fillWidth>
									<Row fillWidth horizontal="between" vertical="end" marginBottom="4">
										<Text id={experience.company} variant="heading-strong-l">
											{experience.company}
										</Text>
										<Text variant="heading-default-xs" onBackground="neutral-weak">
											{experience.timeframe}
										</Text>
									</Row>
									<Text variant="body-default-s" onBackground="brand-weak" marginBottom="m">
										{experience.role}
									</Text>
									<Column as="ul" gap="16">
										{experience.achievements.map((achievement: React.ReactNode, index: number) => (
											<Text as="li" variant="body-default-m" key={`${experience.company}-${index}`}>
												{achievement}
											</Text>
										))}
									</Column>
									{experience.images && experience.images.length > 0 && (
										<Row fillWidth paddingTop="m" paddingLeft="40" gap="12" wrap>
											{experience.images.map((image, index) => (
												<Row
													key={index}
													border="neutral-medium"
													radius="m"
													minWidth={image.width}
													height={image.height}
												>
													<Media
														enlarge
														radius="m"
														sizes={image.width.toString()}
														alt={image.alt}
														src={image.src}
													/>
												</Row>
											))}
										</Row>
									)}
								</Column>
							))}
						</Column>
					</>
				)}

				{about.studies.display && (
					<>
						<Heading as="h2" id={about.studies.title} variant="display-strong-s" marginBottom="m">
							{about.studies.title}
						</Heading>
						<Column fillWidth gap="l" marginBottom="40">
							{about.studies.institutions.map((institution, index) => (
								<Column key={`${institution.name}-${index}`} fillWidth gap="4">
									<Text id={institution.name} variant="heading-strong-l">
										{institution.name}
									</Text>
									<Text variant="heading-default-xs" onBackground="neutral-weak">
										{institution.description}
									</Text>
								</Column>
							))}
						</Column>
					</>
				)}

				{about.technical.display && (
					<>
						<Heading
							as="h2"
							id={about.technical.title}
							variant="display-strong-s"
							marginBottom="40"
						>
							{about.technical.title}
						</Heading>
						<Column fillWidth gap="l">
							{about.technical.skills.map((skill, index) => (
								<Column key={`${skill.title}-${index}`} fillWidth gap="4">
									<Text id={skill.title} variant="heading-strong-l">
										{skill.title}
									</Text>
									<Text variant="body-default-m" onBackground="neutral-weak">
										{skill.description}
									</Text>
									{skill.tags && skill.tags.length > 0 && (
										<Row wrap gap="8" paddingTop="8">
											{skill.tags.map((tag, tagIndex) => (
												<Tag key={`${skill.title}-${tagIndex}`} size="l" prefixIcon={tag.icon}>
													{tag.name}
												</Tag>
											))}
										</Row>
									)}
									{skill.images && skill.images.length > 0 && (
										<Row fillWidth paddingTop="m" gap="12" wrap>
											{skill.images.map((image, imgIndex) => (
												<Row
													key={imgIndex}
													border="neutral-medium"
													radius="m"
													minWidth={image.width}
													height={image.height}
												>
													<Media
														enlarge
														radius="m"
														sizes={image.width.toString()}
														alt={image.alt}
														src={image.src}
													/>
												</Row>
											))}
										</Row>
									)}
								</Column>
							))}
						</Column>
					</>
				)}
			</Column>
		</Row>
	);
}
