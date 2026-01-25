"use client";

import Image, { ImageProps } from "next/image";

interface ThemeImageProps extends Omit<ImageProps, "src" | "className" | "fill" | "width" | "height"> {
	src: string; // Base path without extension or suffix
	className?: string;
	alt: string;
	aspectRatio?: "16/9" | "21/9" | "4/3" | "1/1";
	sizes?: string;
}

export const ThemeImage = ({
	src,
	alt,
	className,
	aspectRatio = "21/9",
	sizes = "100vw",
	...props
}: ThemeImageProps) => {
	// We render both images and hide one with CSS based on the theme
	// This avoids hydration mismatch issues and flickers

	// Calculate dimensions based on aspect ratio
	// Using the full original resolution (3440x1440) to preserve quality
	const baseWidth = 3440;
	const [w, h] = aspectRatio.split("/").map(Number);
	const calcHeight = Math.round(baseWidth / (w / h));

	return (
		<div className={className} style={{ position: "relative", width: "100%", overflow: "hidden" }}>
			<Image
				src={`${src}-light.png`}
				alt={alt}
				className="light-only"
				width={baseWidth}
				height={calcHeight}
				quality={100}
				sizes={sizes}
				unoptimized
				style={{
					width: "100%",
					height: "auto",
					objectFit: "cover"
				}}
				{...props}
			/>
			<Image
				src={`${src}-dark.png`}
				alt={alt}
				className="dark-only"
				width={baseWidth}
				height={calcHeight}
				quality={100}
				sizes={sizes}
				unoptimized
				style={{
					width: "100%",
					height: "auto",
					objectFit: "cover"
				}}
				{...props}
			/>
		</div>
	);
};
