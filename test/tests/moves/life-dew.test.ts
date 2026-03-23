import { AbilityId } from "#enums/ability-id";
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
      .moveset([MoveId.LIFE_DEW, MoveId.SUBSTITUTE, MoveId.SPLASH])
      .ability(AbilityId.BALL_FETCH)
      .battleStyle("double")
      .criticalHits(false)
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyAbility(AbilityId.BALL_FETCH)
      .enemyMoveset(MoveId.SPLASH);
  });

  it("should heal allies with substitute", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER);

    const [leftPokemon, rightPokemon] = game.scene.getPlayerField();

    // Damage both pokemon
    leftPokemon.damageAndUpdate(leftPokemon.hp - 10);
    rightPokemon.damageAndUpdate(rightPokemon.hp - 10);

    // Set up substitute on right pokemon
    rightPokemon.addTag(BattlerTagType.SUBSTITUTE, 0, MoveId.SUBSTITUTE, rightPokemon.id);

    const leftHpBeforeHeal = leftPokemon.hp;
    const rightHpBeforeHeal = rightPokemon.hp;

    // Verify right pokemon has substitute
    expect(rightPokemon.getTag(BattlerTagType.SUBSTITUTE)).toBeDefined();

    // Use Life Dew from left pokemon
    game.move.select(MoveId.LIFE_DEW, 0);
    game.move.select(MoveId.SPLASH, 1);

    await game.phaseInterceptor.to("BerryPhase");

    // Both pokemon should be healed (Life Dew heals 25% of max HP)
    expect(leftPokemon.hp).toBeGreaterThan(leftHpBeforeHeal);
    expect(rightPokemon.hp).toBeGreaterThan(rightHpBeforeHeal);
  });

  it("should heal the user even when user has substitute", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER);

    const [leftPokemon, rightPokemon] = game.scene.getPlayerField();

    // Damage both pokemon
    leftPokemon.damageAndUpdate(leftPokemon.hp - 10);
    rightPokemon.damageAndUpdate(rightPokemon.hp - 10);

    // Set up substitute on left pokemon (the user)
    leftPokemon.addTag(BattlerTagType.SUBSTITUTE, 0, MoveId.SUBSTITUTE, leftPokemon.id);

    const leftHpBeforeHeal = leftPokemon.hp;
    const rightHpBeforeHeal = rightPokemon.hp;

    // Verify left pokemon has substitute
    expect(leftPokemon.getTag(BattlerTagType.SUBSTITUTE)).toBeDefined();

    // Use Life Dew from left pokemon
    game.move.select(MoveId.LIFE_DEW, 0);
    game.move.select(MoveId.SPLASH, 1);

    await game.phaseInterceptor.to("BerryPhase");

    // Both pokemon should be healed
    expect(leftPokemon.hp).toBeGreaterThan(leftHpBeforeHeal);
    expect(rightPokemon.hp).toBeGreaterThan(rightHpBeforeHeal);
  });
});
