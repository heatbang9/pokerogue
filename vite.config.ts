/*
 * SPDX-FileCopyrightText: 2024-2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { resolve } from "path";
import { defineConfig, loadEnv, type UserConfig, type UserConfigFnPromise } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Default config object used for both Vitest and local dev runs.
 */
export const sharedConfig: UserConfigFnPromise = async ({ mode }) =>
  ({
    // Avoid importing any plugins when merging reports (as they will not exist at runtime)
    plugins: process.env.MERGE_REPORTS
      ? []
      : [
          tsconfigPaths(),
          (await import("./src/plugins/vite/vite-minify-json-plugin")).minifyPublicJsonFiles(),
          (await import("./src/plugins/vite/namespaces-i18n-plugin")).LocaleNamespace(),
        ],
    clearScreen: false,
    appType: "mpa",
    build: {
      chunkSizeWarningLimit: 10000,
      minify: "esbuild",
      sourcemap: mode !== "production",
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          // Suppress "Module level directives cause errors when bundled" warnings
          if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
    esbuild: {
      pure: mode === "production" ? ["console.log"] : [],
      keepNames: true,
    },
  }) satisfies UserConfig;

// biome-ignore lint/style/noDefaultExport: required for Vite
export default defineConfig(async config => {
  const { mode, command } = config;
  const envPort = Number(loadEnv(mode, process.cwd()).VITE_PORT);

  return {
    ...(await sharedConfig(config)),
    base: "",
    publicDir: command === "serve" ? "assets" : false,
    server: {
      port: Number.isNaN(envPort) ? 8000 : envPort,
    },
    resolve: {
      alias: [
        // CRITICAL: Explicit mapping must come BEFORE regex patterns!
        // This import resolves to pokemon-forms, not data directly
        {
          find: "#data/form-change-triggers",
          replacement: resolve(__dirname, "src/data/pokemon-forms/form-change-triggers"),
        },
        // Regex patterns for path aliases
        { find: /^#app\//, replacement: resolve(__dirname, "src") + "/" },
        { find: /^#abilities\//, replacement: resolve(__dirname, "src/data/abilities") + "/" },
        { find: /^#api\//, replacement: resolve(__dirname, "src/plugins/api") + "/" },
        { find: /^#biomes\//, replacement: resolve(__dirname, "src/data/balance/biomes") + "/" },
        { find: /^#balance\//, replacement: resolve(__dirname, "src/data/balance") + "/" },
        { find: /^#constants\//, replacement: resolve(__dirname, "src/constants") + "/" },
        { find: /^#enums\//, replacement: resolve(__dirname, "src/enums") + "/" },
        { find: /^#events\//, replacement: resolve(__dirname, "src/events") + "/" },
        { find: /^#field\//, replacement: resolve(__dirname, "src/field") + "/" },
        { find: /^#init\//, replacement: resolve(__dirname, "src/init") + "/" },
        { find: /^#inputs\//, replacement: resolve(__dirname, "src/configs/inputs") + "/" },
        { find: /^#modifiers\//, replacement: resolve(__dirname, "src/modifier") + "/" },
        { find: /^#moves\//, replacement: resolve(__dirname, "src/data/moves") + "/" },
        { find: /^#mystery-encounters\//, replacement: resolve(__dirname, "src/data/mystery-encounters") + "/" },
        { find: /^#phases\//, replacement: resolve(__dirname, "src/phases") + "/" },
        { find: /^#plugins\//, replacement: resolve(__dirname, "src/plugins") + "/" },
        { find: /^#sprites\//, replacement: resolve(__dirname, "src/sprites") + "/" },
        { find: /^#system\//, replacement: resolve(__dirname, "src/system") + "/" },
        { find: /^#trainers\//, replacement: resolve(__dirname, "src/data/trainers") + "/" },
        { find: /^#types\//, replacement: resolve(__dirname, "src/@types") + "/" },
        { find: /^#ui\//, replacement: resolve(__dirname, "src/ui") + "/" },
        { find: /^#utils\//, replacement: resolve(__dirname, "src/utils") + "/" },
        { find: /^#data\//, replacement: resolve(__dirname, "src/data") + "/" },
        { find: "#package.json", replacement: resolve(__dirname, "package.json") },
      ],
    },
  } satisfies UserConfig;
});
