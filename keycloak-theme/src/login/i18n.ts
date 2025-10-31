import { i18nBuilder } from "keycloakify/login";
import type { ThemeName } from "../kc.gen";

const { useI18n, ofTypeI18n } = i18nBuilder
  .withThemeName<ThemeName>()
  .withCustomTranslations({
    en: {
      "identity-provider-login-empty": "No external identity providers are currently available for this realm.",
      "identity-provider-login-load-failed":
        "We couldn't load external identity providers. Please refresh the page or reach out to an administrator.",
      "identity-provider-register-title": "Or sign up with",
      "alreadyHaveAccount": "Already have an account?"
    }
  })
  .build();

export { useI18n };
export type I18n = typeof ofTypeI18n;
