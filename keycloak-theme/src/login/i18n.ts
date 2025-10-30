import { i18nBuilder } from "keycloakify/login";
import type { ThemeName } from "../kc.gen";

const { useI18n, ofTypeI18n } = i18nBuilder.withThemeName<ThemeName>().build();

export { useI18n };
export type I18n = typeof ofTypeI18n;
