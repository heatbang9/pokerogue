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
      alias: {
        "#app": resolve(__dirname, "src"),
        "#abilities": resolve(__dirname, "src/data/abilities"),
        "#api": resolve(__dirname, "src/plugins/api"),
        "#biomes": resolve(__dirname, "src/data/balance/biomes"),
        "#balance": resolve(__dirname, "src/data/balance"),
        "#constants": resolve(__dirname, "src/constants"),
        "#enums": resolve(__dirname, "src/enums"),
        "#events": resolve(__dirname, "src/events"),
        "#field": resolve(__dirname, "src/field"),
        "#init": resolve(__dirname, "src/init"),
        "#inputs": resolve(__dirname, "src/configs/inputs"),
        "#modifiers": resolve(__dirname, "src/modifier"),
        "#moves": resolve(__dirname, "src/data/moves"),
        "#phases": resolve(__dirname, "src/phases"),
        "#plugins": resolve(__dirname, "src/plugins"),
        "#sprites": resolve(__dirname, "src/sprites"),
        "#trainers": resolve(__dirname, "src/data/trainers"),
        "#types": resolve(__dirname, "src/@types"),
        "#ui": resolve(__dirname, "src/ui"),
        "#utils": resolve(__dirname, "src/utils"),
        "#data": resolve(__dirname, "src/data"),
        "#package.json": resolve(__dirname, "package.json"),
      },
    },
  } satisfies UserConfig;
});
