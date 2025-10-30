import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { keycloakify } from "keycloakify/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName: "tfm-theme",
      accountThemeImplementation: "none",
      keycloakifyBuildDirPath: "build_keycloak",
      keycloakVersionTargets: {
        "22-to-25": false,
        "all-other-versions": "keycloakify-tfm-theme-26.0.2.jar"
      }
    })
  ],
  build: {
    outDir: "build",
    emptyOutDir: true,
    sourcemap: false
  }
});
