import { createGetKcContextMock } from "keycloakify/login/KcContext";
import type { KcContextExtension, KcContextExtensionPerPage } from "../KcContext";

export const { getKcContextMock } = createGetKcContextMock<KcContextExtension, KcContextExtensionPerPage>({
  kcContextExtension: {
    themeName: "tfm-theme",
    properties: {}
  },
  kcContextExtensionPerPage: {}
});
