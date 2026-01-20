"use client";

import Image, { ImageProps } from "next/image";

interface ThemeImageProps extends Omit<ImageProps, "src" | "className" | "fill" | "width" | "height"> {
	src: string; // Base path without extension or suffix
	className?: string;
	alt: string;
	aspectRatio?: "16/9" | "21/9" | "4/3" | "1/1";
}

export const ThemeImage = ({ src, alt, className, aspectRatio = "21/9", ...props }: ThemeImageProps) => {
	// We render both images and hide one with CSS based on the theme
	// This avoids hydration mismatch issues and flickers

	// Calculate dimensions based on aspect ratio
	// Using a base width and calculating height from aspect ratio
	const baseWidth = 960;
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
