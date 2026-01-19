import { NextRequest, NextResponse } from "next/server";
import { getPosts, Language } from "@/utils/utils";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const lang = (searchParams.get("lang") || "fr") as Language;

	try {
		const posts = getPosts(["src", "app", "articles", "articles"], lang);

		// Sort by date
		const sortedPosts = posts.sort((a, b) => {
			return new Date(b.metadata.publishedAt).getTime() - new Date(a.metadata.publishedAt).getTime();
		});

		// Return only necessary data
		const articlesData = sortedPosts.map((post) => ({
			slug: post.slug,
			metadata: {
				title: post.metadata.title,
				summary: post.metadata.summary,
				publishedAt: post.metadata.publishedAt,
				image: post.metadata.image,
				images: post.metadata.images,
				tag: post.metadata.tag,
				tags: post.metadata.tags,
			},
			content: post.content,
		}));

		return NextResponse.json({ articles: articlesData });
	} catch (error) {
		console.error("Error fetching articles:", error);
		return NextResponse.json({ articles: [] }, { status: 500 });
	}
}
