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

const version = "1.1.0";

// Get the directory name of the current module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..");
const templatePath = path.join(__dirname, "egg-move-template.boilerplate.ts");
// TODO: Do we want this to be configurable?
const eggMoveTargetPath = path.join(projectRoot, "src/data/balance/egg-moves.ts");

const program = new Command("eggMoves:parse")
  .name("eggMoves:parse")
  .description("Parse egg moves from CSV and write to a TypeScript file")
  .version(version)
  .option("-f, --file <path>", "Path to a CSV file to read")
  .option("-t, --text <csv>", "CSV text to parse directly")
  .option("-c, --console <csv>", "Alias for --text (CSV text to parse directly)")
  .option("-i, --interactive", "Run in interactive mode (default when no other options provided)")
  .addHelpText(
    "after",
    `
Examples:
  $ pnpm eggMoves:parse -f ./egg-moves.csv
  $ pnpm eggMoves:parse --text "Pikachu,Thunderbolt,Quick Attack,Iron Tail,Volt Tackle"
  $ pnpm eggMoves:parse --interactive
`,
  )
  .action(async options => {
    console.log(chalk.yellow(`🥚 Egg Move Parser - v${version}`));

    let csv = "";
    const inputType = await handleOptions(options);

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
  });

/**
 * Handle the options passed to the script and determine the input type.
 * @param {{file?: string, text?: string, console?: string, interactive?: boolean}} options
 * @returns {Promise<{type: "Console" | "File", value: string} | {type: "Exit"}>} The input method selected
 */
async function handleOptions(options) {
  // Check for text/console input
  const csvText = options.text || options.console;
  if (csvText) {
    if (csvText.trim().length === 0) {
      console.error(chalk.red.bold("✗ CSV text cannot be empty!"));
      process.exitCode = 1;
      return { type: "Exit" };
    }
    return { type: "Console", value: csvText };
  }

  // Check for file input
  if (options.file) {
    if (!fs.existsSync(options.file)) {
      console.error(chalk.red.bold(`✗ File not found: ${options.file}`));
      process.exitCode = 1;
      return { type: "Exit" };
    }
    return { type: "File", value: options.file };
  }

  // If no specific option or interactive flag, run interactive mode
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

program.parse();
