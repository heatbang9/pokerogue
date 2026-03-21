import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { StatusEffect } from "#enums/status-effect";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Moves - Baneful Bunker", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);

    game.override
      .battleStyle("single")
      .moveset([MoveId.SLASH, MoveId.FLASH_CANNON, MoveId.SPORE])
      .enemySpecies(SpeciesId.TOXAPEX)
      .enemyAbility(AbilityId.INSOMNIA)
      .enemyMoveset(MoveId.BANEFUL_BUNKER)
      .startingLevel(100)
      .enemyLevel(100);
  });

  function expectProtected() {
    expect(game.field.getEnemyPokemon().hp).toBe(game.field.getEnemyPokemon().getMaxHp());
    expect(game.field.getPlayerPokemon().status?.effect).toBe(StatusEffect.POISON);
  }

  it("should protect the user and poison attackers that make contact", async () => {
    await game.classicMode.startBattle(SpeciesId.CHARIZARD);

    game.move.select(MoveId.SLASH);
    await game.setTurnOrder([BattlerIndex.ENEMY, BattlerIndex.PLAYER]);
    await game.phaseInterceptor.to("BerryPhase", false);

    expectProtected();
  });

  it("should ignore accuracy checks", async () => {
    await game.classicMode.startBattle(SpeciesId.CHARIZARD);

    game.move.select(MoveId.SLASH);
    await game.phaseInterceptor.to("MoveEndPhase"); // baneful bunker
    await game.move.forceMiss();

    await game.phaseInterceptor.to("BerryPhase", false);

    expectProtected();
  });

  it("should block non-contact moves without poisoning attackers", async () => {
    await game.classicMode.startBattle(SpeciesId.CHARIZARD);

    const charizard = game.field.getPlayerPokemon();
    const toxapex = game.field.getEnemyPokemon();

    game.move.select(MoveId.FLASH_CANNON);
    await game.phaseInterceptor.to("BerryPhase", false);

    expect(toxapex.hp).toBe(toxapex.getMaxHp());
    expect(charizard.status?.effect).toBeUndefined();
  });

  it("should block status moves without poisoning attackers (issue #7008)", async () => {
    await game.classicMode.startBattle(SpeciesId.CHARIZARD);

    const charizard = game.field.getPlayerPokemon();
    const toxapex = game.field.getEnemyPokemon();

    game.move.select(MoveId.SPORE);
    await game.phaseInterceptor.to("BerryPhase", false);

    // Baneful Bunker should block Spore
    expect(toxapex.hp).toBe(toxapex.getMaxHp());
    // Spore doesn't make contact, so no poison
    expect(charizard.status?.effect).toBeUndefined();
    // Target should not be asleep
    expect(toxapex.status?.effect).toBeUndefined();
  });
});
