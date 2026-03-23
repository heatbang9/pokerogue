/*
 * SPDX-FileCopyrightText: 2025 Pagefault Games
 * SPDX-FileContributor: Bertie690
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * This script accepts a CSV value or file path as input, parses the egg moves,
 * and writes the output to a TypeScript file.
 * It can be run interactively or with command line arguments.
 * Usage: `pnpm eggMoves:parse`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import { runInteractive } from "./interactive.js";
import { parseEggMoves } from "./parse.js";

const version = "1.0.1";
const program = new Command()
  .name("eggMoves:parse")
  .description("Parse egg moves from CSV and generate TypeScript file")
  .version(version)
  .option("-f, --file <path>", "Input CSV file path")
  .option("-t, --text <csv>", "CSV text input")
  .option("-c, --console <csv>", "CSV text input (alias for --text)")
  .option("-i, --interactive", "Run in interactive mode");

// Get the directory name of the current module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..");
const templatePath = path.join(__dirname, "egg-move-template.boilerplate.ts");
// TODO: Do we want this to be configurable?
const eggMoveTargetPath = path.join(projectRoot, "src/data/balance/egg-moves.ts");

/**
 * @typedef {{type: "Console" | "File", value: string} | {type: "Exit"}}
 * Option
 * An option selected by the user.
 */

/**
 * Runs the interactive eggMoves:parse CLI.
 * @returns {Promise<void>}
 */
async function start() {
  program.parse(process.argv);

  console.log(chalk.yellow(`🥚 Egg Move Parser - v${version}`));

  const options = program.opts();

  let csv = "";
  const inputType = await handleInput(options);
  // If exit code was set, return to allow it to propagate it up the chain.
  if (process.exitCode != null) {
    return;
  }
  switch (inputType.type) {
    case "Console":
      csv = inputType.value;
      break;
    case "File":
      csv = await fs.promises.readFile(inputType.value, "utf-8");
      break;
    case "Exit":
      return;
  }

  await writeToFile(parseEggMoves(csv));
}

/**
 * Handle the input method based on command options.
 * @param {{file?: string, text?: string, console?: string, interactive?: boolean}} options - The parsed command options
 * @returns {Promise<{type: "Console" | "File", value: string} | {type: "Exit"}>} The input method selected by the user
 */
async function handleInput(options) {
  if (options.file) {
    return { type: "File", value: options.file };
  }
  if (options.text) {
    return { type: "Console", value: options.text };
  }
  if (options.console) {
    return { type: "Console", value: options.console };
  }
  // Default to interactive mode
  return await runInteractive();
}

/**
 * Write out the parsed CSV to a file.
 * @param {string} moves - The parsed CSV
 * @returns {Promise<void>}
 */
export async function writeToFile(moves) {
  try {
    // Read the template file, replacing the placeholder with the move table.
    const content = fs.readFileSync(templatePath, "utf8").replace(`"{{table}}"`, moves);

    if (fs.existsSync(eggMoveTargetPath)) {
      console.warn(chalk.hex("#ffa500")("\nEgg moves file already exists, overwriting...\n"));
    }

    // Write the template content to the file
    fs.writeFileSync(eggMoveTargetPath, content, "utf8");

    console.log(chalk.green.bold(`\n✔ Egg Moves written to ${eggMoveTargetPath}`));
    console.groupEnd();
  } catch (err) {
    console.error(chalk.red(`✗ Error while writing egg moves: ${err}`));
    process.exitCode = 1;
  }
}

await start();
