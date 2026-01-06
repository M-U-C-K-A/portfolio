"use client";

import React, { useEffect, useState } from "react";
import { ToggleButton } from "@once-ui-system/core";
import { useLanguage, Language } from "./i18n";

export const LanguageToggle: React.FC = () => {
	const { language, setLanguage } = useLanguage();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <ToggleButton label="FR" aria-label="Switch language" />;
	}

	const nextLanguage: Language = language === "fr" ? "en" : "fr";
	const displayLabel = language.toUpperCase();

	return (
		<ToggleButton
			label={displayLabel}
			onClick={() => setLanguage(nextLanguage)}
			aria-label={`Switch to ${nextLanguage === "fr" ? "French" : "English"}`}
		/>
	);
};
