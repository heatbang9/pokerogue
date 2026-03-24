/*
 * SPDX-FileCopyrightText: 2024-2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { existsSync, readdirSync, readFileSync } from "fs";
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

// Generate explicit aliases for multi-path imports
function generateAliases() {
  const aliases: Array<{ find: string | RegExp; replacement: string }> = [];

  // Find all #ui/*, #data/*, #system/*, #mystery-encounters/* imports
  const uiImports = new Set<string>();
  const dataImports = new Set<string>();
  const systemImports = new Set<string>();
  const mysteryEncountersImports = new Set<string>();

  function scanDir(dir: string) {
    try {
      const files = readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = `${dir}/${file.name}`;
        if (file.isDirectory()) {
          scanDir(fullPath);
        } else if (file.name.endsWith(".ts")) {
          const content = readFileSync(fullPath, "utf-8");
          const uiMatches = content.matchAll(/from\s+["']#ui\/([a-zA-Z0-9_-]+)["']/g);
          for (const match of uiMatches) {
            uiImports.add(match[1]);
          }
          const dataMatches = content.matchAll(/from\s+["']#data\/([a-zA-Z0-9_-]+)["']/g);
          for (const match of dataMatches) {
            dataImports.add(match[1]);
          }
          const systemMatches = content.matchAll(/from\s+["']#system\/([a-zA-Z0-9_-]+)["']/g);
          for (const match of systemMatches) {
            systemImports.add(match[1]);
          }
          const mysteryMatches = content.matchAll(/from\s+["']#mystery-encounters\/([a-zA-Z0-9_-]+)["']/g);
          for (const match of mysteryMatches) {
            mysteryEncountersImports.add(match[1]);
          }
        }
      }
    } catch {}
  }

  scanDir("src");

  // Find actual file locations for #ui/* imports
  for (const imp of uiImports) {
    const locations = [
      `src/ui/containers/${imp}`,
      `src/ui/handlers/${imp}`,
      `src/ui/settings/${imp}`,
      `src/ui/utils/${imp}`,
      `src/ui/battle-info/${imp}`,
      `src/ui/${imp}`,
      `src/@types/${imp}`,
    ];
    for (const loc of locations) {
      if (existsSync(`${loc}.ts`)) {
        aliases.push({ find: `#ui/${imp}`, replacement: resolve(__dirname, loc) });
        break;
      }
    }
  }

  // Find actual file locations for #data/* imports
  for (const imp of dataImports) {
    const locations = [
      `src/data/pokemon-forms/${imp}`,
      `src/data/pokemon/${imp}`,
      `src/data/${imp}`,
      `src/enums/${imp}`,
      `src/system/${imp}`,
    ];
    for (const loc of locations) {
      if (existsSync(`${loc}.ts`)) {
        aliases.push({ find: `#data/${imp}`, replacement: resolve(__dirname, loc) });
        break;
      }
    }
  }

  // Find actual file locations for #system/* imports
  for (const imp of systemImports) {
    const locations = [
      `src/system/settings/${imp}`,
      `src/system/version-migration/versions/${imp}`,
      `src/system/version-migration/${imp}`,
      `src/system/${imp}`,
    ];
    for (const loc of locations) {
      if (existsSync(`${loc}.ts`)) {
        aliases.push({ find: `#system/${imp}`, replacement: resolve(__dirname, loc) });
        break;
      }
    }
  }

  // Find actual file locations for #mystery-encounters/* imports
  for (const imp of mysteryEncountersImports) {
    const locations = [
      `src/data/mystery-encounters/encounters/${imp}`,
      `src/data/mystery-encounters/utils/${imp}`,
      `src/data/mystery-encounters/requirements/${imp}`,
      `src/data/mystery-encounters/${imp}`,
    ];
    for (const loc of locations) {
      if (existsSync(`${loc}.ts`)) {
        aliases.push({ find: `#mystery-encounters/${imp}`, replacement: resolve(__dirname, loc) });
        break;
      }
    }
  }

  // Regex aliases for standard paths (must come AFTER explicit mappings)
  aliases.push(
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
    { find: /^#trainers\//, replacement: resolve(__dirname, "src/data/trainers") + "/" },
    { find: /^#types\//, replacement: resolve(__dirname, "src/@types") + "/" },
    { find: /^#utils\//, replacement: resolve(__dirname, "src/utils") + "/" },
    { find: /^#system\//, replacement: resolve(__dirname, "src/system") + "/" },
    { find: /^#data\//, replacement: resolve(__dirname, "src/data") + "/" },
    { find: /^#ui\//, replacement: resolve(__dirname, "src/ui") + "/" },
    { find: "#package.json", replacement: resolve(__dirname, "package.json") },
  );

  return aliases;
}

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
      alias: generateAliases(),
    },
  } satisfies UserConfig;
});
