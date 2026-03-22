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
import chalk from "chalk";
import { program } from "commander";
import { toKebabCase, toTitleCase } from "../helpers/casing.js";
import { writeFileSafe } from "../helpers/file.js";
import { cliAliases, validTestTypes } from "./constants.js";
import { getBoilerplatePath, getTestFileFullPath } from "./dirs.js";
import { promptFileName, promptTestType } from "./interactive.js";

/**
 * @import {testType} from "./constants.js"
 */

//#region Constants
const version = "2.2.0";
const __dirname = import.meta.dirname;
const projectRoot = join(__dirname, "..", "..");
//#endregion

//#region Commander Setup

/**
 * Flatten CLI aliases for help text
 * @type {Record<string, string[]>}
 */
const typeAliases = {};
for (const [type, aliases] of Object.entries(cliAliases)) {
  typeAliases[type] = [...aliases];
}

program
  .name("test:create")
  .description("Create a test boilerplate file in the appropriate directory based on the type selected")
  .version(version)
  .argument("[testType]", "The type/category of test file to create. Valid types: " + validTestTypes.join(", "))
  .argument("[fileName]", "The name of the test file to create")
  .option("-i, --interactive", "Force interactive mode, prompting for all inputs")
  .action(async (testTypeArg, fileNameArg, options) => {
    console.group(chalk.grey(`🧪 Create Test - v${version}\n`));

    try {
      let testType = testTypeArg;
      let fileName = fileNameArg;

      // If interactive mode or no args provided, use interactive prompts
      if (options.interactive || !testType) {
        testType = await promptTestType();
        if (process.exitCode || !testType) {
          return;
        }
      } else {
        // Validate test type from CLI arg
        testType = validateTestType(testType);
        if (!testType) {
          console.error(
            chalk.red.bold(
              `✗ Invalid type of test file specified: ${testTypeArg}!\nValid types: ${chalk.blue(validTestTypes.join(", "))}`,
            ),
          );
          process.exitCode = 1;
          return;
        }
        console.log(chalk.blue(`Using ${testType} as test type from CLI...`));
      }

      // If interactive mode or no filename provided, prompt for it
      if (options.interactive || !fileName) {
        fileName = await promptFileName(testType);
        if (process.exitCode || !fileName) {
          return;
        }
      } else {
        fileName = validateFileName(fileName);
        if (!fileName) {
          console.error(chalk.red.bold("✗ Cannot use an empty string as a file name!"));
          process.exitCode = 1;
          return;
        }
        console.log(chalk.blue(`Using ${fileName} as file name from CLI...`));
      }

      doCreateFile(testType, fileName);
    } catch (err) {
      console.error(chalk.red("✗ Error: ", err));
    }

    console.groupEnd();
  });

//#endregion

//#region Helper Functions

/**
 * Validate and resolve a test type from CLI argument.
 * @param {string} arg - The test type argument
 * @returns {testType | undefined} The resolved test type, or undefined if invalid
 */
function validateTestType(arg) {
  // Check for a direct match (case-insensitive)
  const testTypeName = validTestTypes.find(c => c.toLowerCase() === arg.toLowerCase());
  if (testTypeName) {
    return testTypeName;
  }

  // Check aliases
  const alias = /** @type {(keyof typeof cliAliases)[]} */ (Object.keys(cliAliases)).find(aliasKey =>
    cliAliases[aliasKey].some(alias => alias.toLowerCase() === arg.toLowerCase()),
  );
  return alias;
}

/**
 * Validate and clean a file name.
 * @param {string} name - The file name to validate
 * @returns {string | undefined} The cleaned file name, or undefined if invalid
 */
function validateFileName(name) {
  const nameTrimmed = name.trim().replace(".test.ts", "");
  return nameTrimmed.length > 0 ? nameTrimmed : undefined;
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

program.parse();
