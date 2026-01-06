"use client";

import {
	Heading,
	Text,
	Button,
	Avatar,
	RevealFx,
	Column,
	Badge,
	Row,
	Line,
} from "@once-ui-system/core";
import { useLanguage } from "@/components/i18n";
import { contentByLanguage } from "@/resources";

export function HomeContent() {
	const { language } = useLanguage();
	const content = contentByLanguage[language];
	const { home, about, person } = content;

	return (
		<Column fillWidth horizontal="center" gap="m">
			<Column maxWidth="s" horizontal="center" align="center">
				{home.featured.display && (
					<RevealFx
						fillWidth
						horizontal="center"
						paddingTop="16"
						paddingBottom="32"
						paddingLeft="12"
					>
						<Badge
							background="brand-alpha-weak"
							paddingX="12"
							paddingY="4"
							onBackground="neutral-strong"
							textVariant="label-default-s"
							arrow={false}
							href={home.featured.href}
						>
							<Row paddingY="2">{home.featured.title}</Row>
						</Badge>
					</RevealFx>
				)}
				<RevealFx translateY="4" fillWidth horizontal="center" paddingBottom="16">
					<Heading wrap="balance" variant="display-strong-l">
						{home.headline}
					</Heading>
				</RevealFx>
				<RevealFx translateY="8" delay={0.2} fillWidth horizontal="center" paddingBottom="32">
					<Text wrap="balance" onBackground="neutral-weak" variant="heading-default-xl">
						{home.subline}
					</Text>
				</RevealFx>
				<RevealFx paddingTop="12" delay={0.4} horizontal="center" paddingLeft="12">
					<Button
						id="about"
						data-border="rounded"
						href={about.path}
						variant="secondary"
						size="m"
						weight="default"
						arrowIcon
					>
						<Row gap="8" vertical="center" paddingRight="4">
							{about.avatar.display && (
								<Avatar
									marginRight="8"
									style={{ marginLeft: "-0.75rem" }}
									src={person.avatar}
									size="m"
								/>
							)}
							{about.title}
						</Row>
					</Button>
				</RevealFx>
			</Column>
		</Column>
	);
}
