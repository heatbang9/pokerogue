import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { BattlerTagType } from "#enums/battler-tag-type";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Moves - Life Dew", () => {
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
      .battleStyle("double")
      .moveset([MoveId.LIFE_DEW, MoveId.SUBSTITUTE, MoveId.SPLASH])
      .enemySpecies(SpeciesId.SNORLAX)
      .enemyAbility(AbilityId.INSOMNIA)
      .enemyMoveset(MoveId.SPLASH)
      .startingLevel(100)
      .enemyLevel(100);
  });

  it("should heal allies with substitute", async () => {
    await game.classicMode.startBattle(SpeciesId.BLASTOISE, SpeciesId.CHARIZARD);

    const [, allyPokemon] = game.scene.getPlayerField();

    // Set up substitute on ally (Charizard)
    game.move.select(MoveId.SPLASH, BattlerIndex.PLAYER);
    game.move.select(MoveId.SUBSTITUTE, BattlerIndex.PLAYER_2);

    await game.toNextTurn();

    expect(allyPokemon.getTag(BattlerTagType.SUBSTITUTE)).toBeDefined();

    // Damage the ally pokemon
    const allyMaxHp = allyPokemon.getMaxHp();
    const damageAmount = Math.floor(allyMaxHp * 0.25);
    allyPokemon.hp = Math.max(1, allyPokemon.hp - damageAmount);

    const hpBeforeHeal = allyPokemon.hp;

    // Use Life Dew
    game.move.select(MoveId.LIFE_DEW, BattlerIndex.PLAYER);
    game.move.select(MoveId.SPLASH, BattlerIndex.PLAYER_2);

    await game.toNextTurn();

    // Life Dew should heal 25% of max HP
    const expectedHealAmount = Math.floor(allyPokemon.getMaxHp() * 0.25);
    const actualHealAmount = allyPokemon.hp - hpBeforeHeal;

    // Allow for rounding
    expect(actualHealAmount).toBeGreaterThanOrEqual(expectedHealAmount - 1);
    expect(actualHealAmount).toBeLessThanOrEqual(expectedHealAmount + 1);
  });

  it("should heal the user even if user has substitute", async () => {
    await game.classicMode.startBattle(SpeciesId.BLASTOISE, SpeciesId.CHARIZARD);

    const leadPokemon = game.field.getPlayerPokemon();

    // Set up substitute on user (Blastoise)
    game.move.select(MoveId.SUBSTITUTE, BattlerIndex.PLAYER);
    game.move.select(MoveId.SPLASH, BattlerIndex.PLAYER_2);

    await game.toNextTurn();

    expect(leadPokemon.getTag(BattlerTagType.SUBSTITUTE)).toBeDefined();

    // Damage the user pokemon (substitute took damage)
    const userMaxHp = leadPokemon.getMaxHp();
    const damageAmount = Math.floor(userMaxHp * 0.25);
    leadPokemon.hp = Math.max(1, leadPokemon.hp - damageAmount);

    const hpBeforeHeal = leadPokemon.hp;

    // Use Life Dew
    game.move.select(MoveId.LIFE_DEW, BattlerIndex.PLAYER);
    game.move.select(MoveId.SPLASH, BattlerIndex.PLAYER_2);

    await game.toNextTurn();

    // Life Dew should heal 25% of max HP
    const expectedHealAmount = Math.floor(leadPokemon.getMaxHp() * 0.25);
    const actualHealAmount = leadPokemon.hp - hpBeforeHeal;

    // Allow for rounding
    expect(actualHealAmount).toBeGreaterThanOrEqual(expectedHealAmount - 1);
    expect(actualHealAmount).toBeLessThanOrEqual(expectedHealAmount + 1);
  });
});
