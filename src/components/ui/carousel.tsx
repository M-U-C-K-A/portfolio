"use client"

import * as React from "react"
import useEmblaCarousel, {
	type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
	opts?: CarouselOptions
	plugins?: CarouselPlugin
	orientation?: "horizontal" | "vertical"
	setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0]
	api: ReturnType<typeof useEmblaCarousel>[1]
	scrollPrev: () => void
	scrollNext: () => void
	canScrollPrev: boolean
	canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
	const context = React.useContext(CarouselContext)

	if (!context) {
		throw new Error("useCarousel must be used within a <Carousel />")
	}

	return context
}

const Carousel = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
	(
		{
			orientation = "horizontal",
			opts,
			setApi,
			plugins,
			className,
			children,
			style,
			...props
		},
		ref
	) => {
		const [carouselRef, api] = useEmblaCarousel(
			{
				...opts,
				axis: orientation === "horizontal" ? "x" : "y",
			},
			plugins
		)
		const [canScrollPrev, setCanScrollPrev] = React.useState(false)
		const [canScrollNext, setCanScrollNext] = React.useState(false)

		const onSelect = React.useCallback((api: CarouselApi) => {
			if (!api) {
				return
			}

			setCanScrollPrev(api.canScrollPrev())
			setCanScrollNext(api.canScrollNext())
		}, [])

		const scrollPrev = React.useCallback(() => {
			api?.scrollPrev()
		}, [api])

		const scrollNext = React.useCallback(() => {
			api?.scrollNext()
		}, [api])

		const handleKeyDown = React.useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>) => {
				if (event.key === "ArrowLeft") {
					event.preventDefault()
					scrollPrev()
				} else if (event.key === "ArrowRight") {
					event.preventDefault()
					scrollNext()
				}
			},
			[scrollPrev, scrollNext]
		)

		React.useEffect(() => {
			if (!api || !setApi) {
				return
			}

			setApi(api)
		}, [api, setApi])

		React.useEffect(() => {
			if (!api) {
				return
			}

			onSelect(api)
			api.on("reInit", onSelect)
			api.on("select", onSelect)

			return () => {
				api?.off("select", onSelect)
			}
		}, [api, onSelect])

		return (
			<CarouselContext.Provider
				value={{
					carouselRef,
					api: api,
					opts,
					orientation:
						orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
					scrollPrev,
					scrollNext,
					canScrollPrev,
					canScrollNext,
				}}
			>
				<div
					ref={ref}
					onKeyDownCapture={handleKeyDown}
					style={{ position: "relative", ...style }}
					role="region"
					aria-roledescription="carousel"
					{...props}
				>
					{children}
				</div>
			</CarouselContext.Provider>
		)
	}
)
Carousel.displayName = "Carousel"

const CarouselContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => {
	const { carouselRef, orientation } = useCarousel()

	return (
		<div ref={carouselRef} style={{ overflow: "hidden" }}>
			<div
				ref={ref}
				style={{
					display: "flex",
					flexDirection: orientation === "horizontal" ? "row" : "column",
					...style,
				}}
				{...props}
			/>
		</div>
	)
})
CarouselContent.displayName = "CarouselContent"

const CarouselItem = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => {
	const { orientation } = useCarousel()

	return (
		<div
			ref={ref}
			role="group"
			aria-roledescription="slide"
			style={{
				minWidth: 0,
				flexShrink: 0,
				flexGrow: 0,
				...style,
			}}
			{...props}
		/>
	)
})
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, style, ...props }, ref) => {
	const { orientation, scrollPrev, canScrollPrev } = useCarousel()

	return (
		<button
			ref={ref}
			style={{
				position: "absolute",
				height: "32px",
				width: "32px",
				borderRadius: "50%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(255,255,255,0.9)",
				border: "1px solid rgba(0,0,0,0.1)",
				cursor: canScrollPrev ? "pointer" : "not-allowed",
				opacity: canScrollPrev ? 1 : 0.5,
				transition: "all 0.2s",
				left: orientation === "horizontal" ? "-48px" : "50%",
				top: orientation === "horizontal" ? "50%" : "-48px",
				transform: orientation === "horizontal" ? "translateY(-50%)" : "translateX(-50%)",
				...style,
			}}
			disabled={!canScrollPrev}
			onClick={scrollPrev}
			{...props}
		>
			<ArrowLeft style={{ height: "16px", width: "16px", color: "#000" }} />
			<span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)" }}>
				Previous slide
			</span>
		</button>
	)
})
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, style, ...props }, ref) => {
	const { orientation, scrollNext, canScrollNext } = useCarousel()

	return (
		<button
			ref={ref}
			style={{
				position: "absolute",
				height: "32px",
				width: "32px",
				borderRadius: "50%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(255,255,255,0.9)",
				border: "1px solid rgba(0,0,0,0.1)",
				cursor: canScrollNext ? "pointer" : "not-allowed",
				opacity: canScrollNext ? 1 : 0.5,
				transition: "all 0.2s",
				right: orientation === "horizontal" ? "-48px" : undefined,
				left: orientation === "vertical" ? "50%" : undefined,
				top: orientation === "horizontal" ? "50%" : undefined,
				bottom: orientation === "vertical" ? "-48px" : undefined,
				transform: orientation === "horizontal" ? "translateY(-50%)" : "translateX(-50%)",
				...style,
			}}
			disabled={!canScrollNext}
			onClick={scrollNext}
			{...props}
		>
			<ArrowRight style={{ height: "16px", width: "16px", color: "#000" }} />
			<span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)" }}>
				Next slide
			</span>
		</button>
	)
})
CarouselNext.displayName = "CarouselNext"

export {
	type CarouselApi,
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselPrevious,
	CarouselNext,
}
