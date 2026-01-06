"use client"

import * as React from "react"
import Image from "next/image"
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel"

interface ImageCarouselItem {
	src: string
	alt: string
}

interface ImageCarouselProps {
	images: ImageCarouselItem[]
	maxHeight?: number
}

export function ImageCarousel({ images, maxHeight = 500 }: ImageCarouselProps) {
	return (
		<div className="w-full my-8" style={{ maxWidth: "100%" }}>
			<Carousel
				opts={{
					align: "start",
					loop: true,
					slidesToScroll: 1,
				}}
				className="w-full"
			>
				<CarouselContent style={{ marginLeft: "-8px" }}>
					{images.map((image, index) => (
						<CarouselItem
							key={index}
							style={{
								paddingLeft: "8px",
								flexBasis: "33.333%",
								minWidth: 0,
								flexShrink: 0,
								flexGrow: 0,
							}}
						>
							<div
								style={{
									position: "relative",
									overflow: "hidden",
									borderRadius: "12px",
									border: "1px solid rgba(255,255,255,0.1)",
									height: maxHeight,
								}}
							>
								<Image
									src={image.src}
									alt={image.alt}
									fill
									style={{ objectFit: "cover" }}
									sizes="33vw"
								/>
							</div>
						</CarouselItem>
					))}
				</CarouselContent>
				<CarouselPrevious
					style={{
						position: "absolute",
						left: "-40px",
						top: "50%",
						transform: "translateY(-50%)",
					}}
				/>
				<CarouselNext
					style={{
						position: "absolute",
						right: "-40px",
						top: "50%",
						transform: "translateY(-50%)",
					}}
				/>
			</Carousel>
		</div>
	)
}
