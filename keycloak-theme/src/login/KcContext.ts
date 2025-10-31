/* eslint-disable @typescript-eslint/ban-types */
import type { ExtendKcContext } from "keycloakify/login";
import type { KcContext as KcContextBase } from "keycloakify/login/KcContext";
import type { KcEnvName, ThemeName } from "../kc.gen";

export type KcContextExtension = {
  themeName: ThemeName;
  properties: Record<KcEnvName, string> & {};
  // NOTE: Here you can declare more properties to extend the KcContext
  // See: https://docs.keycloakify.dev/faq-and-help/some-values-you-need-are-missing-from-in-kccontext
};

type RegisterContextShape = Extract<KcContextBase, { pageId: "register.ftl" }>;

type RegisterSocial = {
  displayInfo?: boolean;
  providers?: { alias: string; displayName: string; loginUrl: string }[];
};

export type KcContextExtensionPerPage = {
  "register.ftl": {
    profile: RegisterContextShape["profile"];
    social?: RegisterSocial;
  };
  "register-user-profile.ftl": {
    profile: RegisterContextShape["profile"];
    social?: RegisterSocial;
  };
};

export type KcContext = ExtendKcContext<KcContextExtension, KcContextExtensionPerPage>;
