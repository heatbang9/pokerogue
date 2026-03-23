/*
 * SPDX-FileCopyrightText: 2024-2025 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * This script creates a test boilerplate file in the appropriate
 * directory based on the type selected.
 * Usage: `pnpm test:create`
 */

import fs from "node:fs";
import { join } from "node:path";
import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import { toKebabCase, toTitleCase } from "../helpers/casing.js";
import { writeFileSafe } from "../helpers/file.js";
import { getFileName, getTestType } from "./cli.js";
import { validTestTypes } from "./constants.js";
import { getBoilerplatePath, getTestFileFullPath } from "./dirs.js";

/**
 * @import {testType} from "./constants.js"
 */

//#region Constants
const version = "2.1.0";
const __dirname = import.meta.dirname;
const projectRoot = join(__dirname, "..", "..");
//#endregion

//#region CLI Setup
const program = new Command()
  .name("pnpm test:create")
  .description("Create a test boilerplate file in the appropriate directory based on the type selected")
  .version(version)
  .argument("[testType]", `The type/category of test file to create. Valid types: ${validTestTypes.join(", ")}`)
  .argument("[fileName]", "The name of the test file to create")
  .allowExcessArguments(false);
//#endregion

//#region Main

/**
 * Run the interactive `test:create` CLI.
 * @returns {Promise<void>}
 */
async function runInteractive() {
  console.group(chalk.grey(`🧪 Create Test - v${version}\n`));

  program.parse();
  const [testTypeArg, fileNameArg] = program.processedArgs;

  const testType = await getTestType(testTypeArg);
  if (process.exitCode || !testType) {
    return;
  }

  const fileNameAnswer = await getFileName(testType, fileNameArg);
  if (process.exitCode || !fileNameAnswer) {
    return;
  }

  try {
    doCreateFile(testType, fileNameAnswer);
  } catch (err) {
    console.error(chalk.red("✗ Error: ", err));
  }
  console.groupEnd();
}

/**
 * Helper function to create the test file.
 * @param {testType} testType - The type of test to create
 * @param {string} fileNameAnswer - The name of the file to create
 * @returns {void}
 */
function doCreateFile(testType, fileNameAnswer) {
  // Convert file name to kebab-case, formatting the description in Title Case
  const fileName = toKebabCase(fileNameAnswer);
  const formattedName = toTitleCase(fileNameAnswer);
  const description = `${testType} - ${formattedName}`;

  const content = fs.readFileSync(getBoilerplatePath(testType), "utf8").replace("{{description}}", description);
  const filePath = getTestFileFullPath(testType, fileName);
  writeFileSafe(filePath, content, "utf8");

  console.log(chalk.green.bold(`✔ File created at: ${filePath.replace(`${projectRoot}/`, "")}\n`));
}

//#endregion

await runInteractive();
