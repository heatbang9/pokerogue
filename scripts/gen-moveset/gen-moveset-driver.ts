/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 * SPDX-FileContributor: SirzBenjie
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { EGG_MOVE_LEVEL_REQUIREMENT } from "#balance/moves/moveset-generation";
import { SpeciesId } from "#enums/species-id";
import { spawn } from "node:child_process";
import net from "node:net";
import { Command } from "@commander-js/extra-typings";
import { confirm, input, number as promptNumber } from "@inquirer/prompts";
import chalk from "chalk";
import { defaultCommanderHelpArgs } from "../helpers/arguments.js";
import type { SamplerPayload } from "./types";

/**
 * Starts a TCP server and returns a Promise that resolves with the dataPromise and port.
 */
function spawnServer(payload: SamplerPayload): Promise<{ dataPromise: Promise<string>; port: number }> {
  const { promise: dataPromise, resolve: dataResolver } = Promise.withResolvers<string>();

  const server = net.createServer(socket => {
    socket.write(JSON.stringify(payload));
    let data = "";
    socket.on("data", chunk => {
      data += chunk.toString();
    });
    socket.on("end", () => {
      server.close();
      dataResolver(data);
    });
  });

  const { promise, resolve } = Promise.withResolvers<{ dataPromise: Promise<string>; port: number }>();
  server.listen(0, () => {
    const port = (server.address() as net.AddressInfo).port;
    resolve({ dataPromise, port });
  });

  return promise;
}

async function getDataFromChildProcess(payload: SamplerPayload): Promise<void> {
  const { dataPromise, port } = await spawnServer(payload);

  const child = spawn("pnpm", ["vitest", "-c", "scripts/gen-moveset/gen-moveset.config.ts"], {
    env: {
      ...process.env,
      COMMUNICATION_PORT: port.toString(),
    },
    stdio: ["inherit", "ignore", "ignore"],
  });

  child.on("exit", async () => {
    const data = await dataPromise;
    if (!data) {
      console.error("No data received from child process.");
      process.exit(1);
    }

    process.stdout.write(data + "\n");
  });
}

async function promptInputs(): Promise<SamplerPayload> {
  const speciesInput = await input({
    message: "Enter the species ID or name of the Pokémon to generate movesets for:",
    validate: value => {
      return SpeciesId[value.toUpperCase()] != null;
    },
  });

  let speciesName: string;
  let speciesId = Number(speciesInput) as SpeciesId;
  let wasNum = false;
  if (Number.isNaN(speciesId)) {
    speciesName = speciesInput;
    speciesId = SpeciesId[speciesInput.toUpperCase()] as SpeciesId;
  } else {
    speciesName = SpeciesId[speciesId];
    wasNum = true;
  }
  speciesName = speciesName[0].toUpperCase() + speciesName.slice(1).toLowerCase();
  if (wasNum) {
    console.log(chalk.bold(`  Selected species: ${speciesName}`));
  }

  const boss = await confirm({
    message: "Generate as boss (default yes)?",
    default: true,
  });

  const forTrainer = await confirm({
    message: "Generate as for a trainer (default yes)?",
    default: true,
  });
  let forRival = false;
  if (forTrainer) {
    forRival = await confirm({
      message: "Generate as a Rival's Pokémon (default no)?",
      default: false,
    });
  }

  const level = await promptNumber({
    message: "Enter the level of the Pokémon (default 100):",
    default: 100,
    max: 200,
    min: 3,
    required: true,
  });

  let allowEggMoves: boolean | undefined;
  if (forTrainer && level >= EGG_MOVE_LEVEL_REQUIREMENT) {
    allowEggMoves = await confirm({
      message: "Allow egg moves? (default no)?",
      default: false,
    });
  }
  const formIndex = await promptNumber({
    message: "Enter the form index to generate (if empty or invalid, will default to the base form):",
    default: 0,
    min: 0,
    required: false,
  });

  const abilityIndex = await promptNumber({
    message: "Enter an ability index to force (leave blank to not force any):",
    min: 0,
    max: 2,
    required: false,
  });

  const trials = await promptNumber({
    message: "Enter the number of movesets to generate (default 100):",
    default: 100,
    min: 1,
    required: true,
  });

  const printWeights = await confirm({
    message: "Print move weight details (default no)?",
    default: false,
  });

  return {
    speciesId,
    boss,
    level,
    trials,
    printWeights,
    forTrainer,
    abilityIndex,
    allowEggMoves,
    formIndex,
    forRival,
  };
}

const version = "1.0.0";

console.log(chalk.hex("#ffa500")(`🎮 Moveset Generator - v${version}\n`));

const program = new Command("pnpm sample-movesets")
  .description("Generate movesets for Pokémon using weighted sampling.")
  .helpOption("-h, --help", "Show this help message.")
  .version(version, "-v, --version", "Show the version number.")
  .option("-s, --species <species>", "Species ID or name of the Pokémon")
  .option("-b, --boss", "Generate as boss (default: true)", true)
  .option("--no-boss", "Generate as non-boss")
  .option("-t, --for-trainer", "Generate for a trainer (default: true)", true)
  .option("--no-for-trainer", "Generate for wild Pokémon")
  .option("-r, --for-rival", "Generate as a Rival's Pokémon (default: false)")
  .option("-l, --level <number>", "Level of the Pokémon (default: 100)", Number.parseInt)
  .option("-e, --allow-egg-moves", "Allow egg moves (default: false)")
  .option("--no-allow-egg-moves", "Disallow egg moves")
  .option("-f, --form-index <number>", "Form index to generate (default: 0)", Number.parseInt)
  .option("-a, --ability-index <number>", "Ability index to force (0-2)", Number.parseInt)
  .option("-n, --trials <number>", "Number of movesets to generate (default: 100)", Number.parseInt)
  .option("-w, --print-weights", "Print move weight details (default: false)")
  .option("-i, --interactive", "Force interactive mode even when CLI args are provided")
  .configureHelp(defaultCommanderHelpArgs)
  .showHelpAfterError(true)
  .parse();

const options = program.opts();

async function main() {
  let payload: SamplerPayload;

  // Use interactive mode if no species provided or --interactive flag is set
  if (!options.species || options.interactive) {
    try {
      payload = await promptInputs();
    } catch (err: any) {
      // Suppress annoying stack trace on SIGINT
      if (err?.message.includes("User force closed the prompt with SIGINT")) {
        process.exit(130);
      }
      throw err;
    }
  } else {
    // Parse species from CLI argument
    let speciesName: string;
    let speciesId = Number(options.species) as SpeciesId;
    let wasNum = false;
    if (Number.isNaN(speciesId)) {
      speciesName = options.species;
      speciesId = SpeciesId[options.species.toUpperCase()] as SpeciesId;
    } else {
      speciesName = SpeciesId[speciesId];
      wasNum = true;
    }
    speciesName = speciesName[0].toUpperCase() + speciesName.slice(1).toLowerCase();
    if (wasNum) {
      console.log(chalk.bold(`Selected species: ${speciesName}`));
    }

    payload = {
      speciesId,
      boss: options.boss,
      level: options.level ?? 100,
      trials: options.trials ?? 100,
      printWeights: options.printWeights ?? false,
      forTrainer: options.forTrainer,
      abilityIndex: options.abilityIndex,
      allowEggMoves: options.allowEggMoves,
      formIndex: options.formIndex ?? 0,
      forRival: options.forRival ?? false,
    };

    console.log(chalk.grey("Configuration:"));
    console.log(chalk.grey(`  Species: ${speciesName} (ID: ${payload.speciesId})`));
    console.log(chalk.grey(`  Boss: ${payload.boss}`));
    console.log(chalk.grey(`  For Trainer: ${payload.forTrainer}`));
    console.log(chalk.grey(`  For Rival: ${payload.forRival}`));
    console.log(chalk.grey(`  Level: ${payload.level}`));
    console.log(chalk.grey(`  Allow Egg Moves: ${payload.allowEggMoves}`));
    console.log(chalk.grey(`  Form Index: ${payload.formIndex}`));
    console.log(chalk.grey(`  Ability Index: ${payload.abilityIndex ?? "none"}`));
    console.log(chalk.grey(`  Trials: ${payload.trials}`));
    console.log(chalk.grey(`  Print Weights: ${payload.printWeights}`));
    console.log();
  }

  await getDataFromChildProcess(payload);
}

await main();
