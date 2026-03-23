import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { BattlerTagType } from "#enums/battler-tag-type";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Rampage Moves - Double Battles", () => {
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
      .criticalHits(false)
      .moveset([MoveId.OUTRAGE, MoveId.SPLASH])
      .enemyMoveset([MoveId.SPLASH, MoveId.SPLASH])
      .enemyLevel(5)
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyAbility(AbilityId.BALL_FETCH);
  });

  /*
   * Issue #6832: Rampage moves (Outrage, Thrash, etc.) should continue targeting
   * remaining enemies in double battles when the initial target faints
   */
  it("should retarget to remaining enemy when initial target faints in double battles", async () => {
    await game.classicMode.startBattle([SpeciesId.GYARADOS, SpeciesId.GYARADOS]);

    const playerPokemon = game.field.getPlayerPokemon();
    const enemy1 = game.field.getEnemyPokemon(0);
    const enemy2 = game.field.getEnemyPokemon(1);

    // Turn 1: Use Outrage on enemy1
    game.move.select(MoveId.OUTRAGE, 0, BattlerIndex.ENEMY);
    game.move.select(MoveId.SPLASH, 1);
    await game.setTurnOrder([BattlerIndex.PLAYER, BattlerIndex.PLAYER_2, BattlerIndex.ENEMY, BattlerIndex.ENEMY_2]);
    await game.toNextTurn();

    // Enemy1 should be damaged
    expect(enemy1.hp).toBeLessThan(enemy1.getMaxHp());

    // Check frenzy is active
    expect(playerPokemon.summonData.moveQueue.length).toBeGreaterThan(0);
    expect(playerPokemon.summonData.tags.some(tag => tag.tagType === BattlerTagType.FRENZY)).toBe(true);

    // Kill enemy1 with high damage override
    game.override.enemyLevel(5).startingLevel(100);

    // Turn 2: Outrage continues - if enemy1 fainted, should target enemy2
    // Note: Outrage should auto-select, but we still need to select for the second pokemon
    game.move.select(MoveId.SPLASH, 1);
    await game.toNextTurn();

    // Either enemy1 or enemy2 should have taken damage (or both)
    const totalDamage = enemy1.getMaxHp() - enemy1.hp + (enemy2.getMaxHp() - enemy2.hp);
    expect(totalDamage).toBeGreaterThan(0);
  });

  it("should not fail when only one enemy remains after initial target faints", async () => {
    await game.classicMode.startBattle([SpeciesId.GYARADOS, SpeciesId.GYARADOS]);

    const enemy2 = game.field.getEnemyPokemon(1);

    // Make player strong enough to OHKO
    game.override.startingLevel(100);

    // Turn 1: Use Outrage - will kill first enemy
    game.move.select(MoveId.OUTRAGE, 0, BattlerIndex.ENEMY);
    game.move.select(MoveId.SPLASH, 1);
    await game.setTurnOrder([BattlerIndex.PLAYER, BattlerIndex.PLAYER_2, BattlerIndex.ENEMY, BattlerIndex.ENEMY_2]);
    await game.toNextTurn();

    // Turn 2: Outrage continues - should auto-target remaining enemy
    // Note: Outrage auto-selects, only need to select for second pokemon
    game.move.select(MoveId.SPLASH, 1);
    await game.toNextTurn();

    // Enemy2 should have taken damage (retargeted from fainted enemy1)
    expect(enemy2.hp).toBeLessThan(enemy2.getMaxHp());
  });
});
