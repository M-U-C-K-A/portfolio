"use client";

import { useLanguage, Language } from "@/components/i18n";
import { contentByLanguage } from "@/resources";

export const useContent = () => {
	const { language } = useLanguage();
	return contentByLanguage[language];
};

export const useLocalizedContent = <T,>(
	frContent: T,
	enContent: T
): T => {
	const { language } = useLanguage();
	return language === "fr" ? frContent : enContent;
};
