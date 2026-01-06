"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Language = "fr" | "en";

interface LanguageContextType {
	language: Language;
	setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "data-language";
const DEFAULT_LANGUAGE: Language = "fr";

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
		if (stored && (stored === "fr" || stored === "en")) {
			setLanguageState(stored);
		}
	}, []);

	const setLanguage = (lang: Language) => {
		setLanguageState(lang);
		localStorage.setItem(STORAGE_KEY, lang);
		document.documentElement.setAttribute("data-language", lang);
		// Set cookie for server components
		document.cookie = `${STORAGE_KEY}=${lang};path=/;max-age=31536000`;
	};

	useEffect(() => {
		if (mounted) {
			document.documentElement.setAttribute("data-language", language);
		}
	}, [language, mounted]);

	return (
		<LanguageContext.Provider value={{ language, setLanguage }}>
			{children}
		</LanguageContext.Provider>
	);
};

export const useLanguage = (): LanguageContextType => {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error("useLanguage must be used within a LanguageProvider");
	}
	return context;
};
