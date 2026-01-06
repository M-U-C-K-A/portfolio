import { NextRequest, NextResponse } from "next/server";
import { getPosts, Language } from "@/utils/utils";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const lang = (searchParams.get("lang") || "fr") as Language;

	try {
		const posts = getPosts(["src", "app", "work", "projects"], lang);

		// Sort by date
		const sortedPosts = posts.sort((a, b) => {
			return new Date(b.metadata.publishedAt).getTime() - new Date(a.metadata.publishedAt).getTime();
		});

		// Return only necessary data
		const projectsData = sortedPosts.map((post) => ({
			slug: post.slug,
			metadata: {
				title: post.metadata.title,
				summary: post.metadata.summary,
				publishedAt: post.metadata.publishedAt,
				images: post.metadata.images,
				team: post.metadata.team,
				link: post.metadata.link,
			},
			content: post.content,
		}));

		return NextResponse.json({ projects: projectsData });
	} catch (error) {
		console.error("Error fetching projects:", error);
		return NextResponse.json({ projects: [] }, { status: 500 });
	}
}
