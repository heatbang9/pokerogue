/*
 * SPDX-FileCopyrightText: 2025 Pagefault Games
 * SPDX-FileContributor: Fabske0
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * Interactive CLI to create a custom daily run seed.
 * Usage: `pnpm dailySeed:create`
 */

import { existsSync } from "fs";
import { join } from "path";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { program } from "commander";
import { toTitleCase } from "../helpers/casing.js";
import { promptOverwrite, writeFileSafe } from "../helpers/file.js";
import { EDIT_OPTIONS } from "./constants.js";
import { promptBoss } from "./prompts/boss.js";
import { promptBiome, promptEdit, promptForcedWaves, promptLuck, promptMoney, promptSeed } from "./prompts/general.js";
import { promptStarters } from "./prompts/starter.js";

/**
 * The version of this script
 * @type {string}
 */
const SCRIPT_VERSION = "1.1.0";

const rootDir = join(import.meta.dirname, "..", "..");

/**
 * @import {BossConfig} from "./prompts/boss.js"
 * @import {StarterConfig} from "./prompts/starter.js"
 * @import {ForcedWaveConfig} from "./prompts/general.js"
 */

/**
 * @typedef {Object} CustomSeedConfig
 */

/**
 * The config for the custom daily run seed.
 * @type {{
 *   starters?: StarterConfig[],
 *   boss?: BossConfig,
 *   biome?: number,
 *   luck?: number,
 *   forcedWaves?: ForcedWaveConfig[],
 *   startingMoney?: number,
 *   seed: string
 * }}
 */
const customSeedConfig = {
  starters: undefined,
  boss: undefined,
  biome: undefined,
  luck: undefined,
  forcedWaves: undefined,
  startingMoney: undefined,
  seed: "",
};

/**
 * All valid options for editing the config.
 */
const editOptions = [...EDIT_OPTIONS];

/** @typedef {typeof editOptions[number]} EditOption */

program
  .name("dailySeed:create")
  .description("Interactive CLI to create a custom daily run seed")
  .version(SCRIPT_VERSION)
  .option("-e, --edit", "Start with editing an existing config")
  .option("-o, --outfile <path>", "Output file path for the generated config (adds .json extension if not present)")
  .action(async options => {
    console.group(chalk.grey(`🌱 Daily Seed Generator - v${SCRIPT_VERSION}\n`));

    if (options.edit) {
      const config = await promptEdit();
      Object.assign(customSeedConfig, config);
      editOptions.splice(editOptions.indexOf("edit"), 1);
    }

    try {
      // `seed` is required
      customSeedConfig.seed = await promptSeed();
      await promptOptions();
      if (process.exitCode != null) {
        return;
      }

      await finish(options.outfile);
    } catch (err) {
      console.error(chalk.red.bold("✗ Error: ", err));
    }
  });

async function promptOptions() {
  const option = await select({
    message: "Please select the option you would like to configure.",
    choices: [...editOptions].map(toTitleCase),
  });
  await handleAnswer(/** @type {EditOption} */ (option.toLowerCase()));
}

/**
 * Handle the selected option from the main menu.
 * @param {EditOption} answer - The selected answer.
 * @returns {Promise<void>}
 */
async function handleAnswer(answer) {
  switch (answer) {
    case "finish":
      return;
    case "edit": {
      const config = await promptEdit();
      Object.assign(customSeedConfig, config);
      break;
    }
    case "starters":
      customSeedConfig.starters = await promptStarters();
      break;
    case "boss":
      customSeedConfig.boss = await promptBoss();
      break;
    case "biome":
      customSeedConfig.biome = await promptBiome();
      break;
    case "luck":
      customSeedConfig.luck = await promptLuck();
      break;
    case "forced waves":
      customSeedConfig.forcedWaves = await promptForcedWaves();
      break;
    case "starting money":
      customSeedConfig.startingMoney = await promptMoney();
      break;
    case "seed":
      customSeedConfig.seed = await promptSeed();
      break;
    case "exit":
      console.log(chalk.gray("Exiting..."));
      process.exitCode = 0;
      return;
  }

  if (answer !== "edit") {
    editOptions.splice(editOptions.indexOf(answer), 1);
  }
  if (editOptions.includes("edit")) {
    // always remove "edit" option after first action
    editOptions.splice(editOptions.indexOf("edit"), 1);
  }
  await promptOptions();
}

/**
 * @param {string | undefined} outFile
 * @returns {Promise<void>}
 */
async function finish(outFile) {
  console.groupEnd();
  // TODO: do we also need to validate here?

  if (outFile) {
    console.log(chalk.hex("#ffa500")(`Using outfile: ${chalk.blue(outFile)}`));
    await createOutputFile(outFile);
  } else {
    console.log(
      chalk.hex("#ffa500")("No outfile detected, logging to stdout...")
        + chalk.cyan("\n🌱 Your custom daily seed config is:")
        + chalk.green(`\n${JSON.stringify(customSeedConfig)}`),
    );
  }
}

/**
 * Write the seed config to a file.
 * @param {string} outFile
 */
async function createOutputFile(outFile) {
  if (!outFile.endsWith(".json")) {
    outFile = `${outFile}.json`;
  }
  try {
    if (existsSync(outFile) && !(await promptOverwrite(outFile))) {
      console.log(chalk.gray("Cancelled."));
      return;
    }
    const fullPath = join(rootDir, outFile);

    writeFileSafe(fullPath, JSON.stringify(customSeedConfig));
    console.log(chalk.green(`✔ Output written to ${chalk.blue(outFile)} successfully!`));
  } catch (err) {
    console.error(chalk.red(`✗ Error while writing output file: ${err}`));
    process.exitCode = 1;
  }
}

program.parse();
