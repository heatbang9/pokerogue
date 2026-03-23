import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { BattlerTagType } from "#enums/battler-tag-type";
import { MoveId } from "#enums/move-id";
import { MoveResult } from "#enums/move-result";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Frenzy Move - Double Battle Target KO", () => {
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
      .moveset([MoveId.THRASH, MoveId.SPLASH])
      .startingLevel(1000)
      .enemyMoveset([MoveId.SPLASH, MoveId.SPLASH])
      .enemyLevel(1)
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyAbility(AbilityId.BALL_FETCH);
  });

  /*
   * In Doubles, when the initial recipient of Outrage/Thrash is knocked out,
   * and the slot is no longer filled with another 'mon, the move should still
   * continue to hit the remaining enemy.
   *
   * This test verifies that the frenzy move doesn't fail when the original target is gone.
   */
  it("should continue frenzy and hit remaining enemy when original target is KO'd", async () => {
    await game.classicMode.startBattle(SpeciesId.REGIELEKI, SpeciesId.SHUCKLE);

    const playerPokemon = game.field.getPlayerPokemon();
    const [enemy1, enemy2] = game.scene.getEnemyField();

    // First turn: Use Thrash (random target) and KO one enemy, player 2 uses Splash
    game.move.select(MoveId.THRASH, 0);
    game.move.select(MoveId.SPLASH, 1);
    await game.setTurnOrder([BattlerIndex.PLAYER, BattlerIndex.ENEMY, BattlerIndex.ENEMY_2, BattlerIndex.PLAYER_2]);
    await game.toNextTurn();

    // One enemy should be KO'd
    const koEnemy = enemy1.isFainted() ? enemy1 : enemy2;
    const remainingEnemy = enemy1.isFainted() ? enemy2 : enemy1;
    expect(koEnemy.isFainted()).toBe(true);
    expect(remainingEnemy.isFainted()).toBe(false);

    // Player should have frenzy tag and move queue
    expect(playerPokemon.summonData.tags.some(tag => tag.tagType === BattlerTagType.FRENZY)).toBe(true);
    expect(playerPokemon.summonData.moveQueue.length).toBeGreaterThan(0);

    // Second turn: Thrash should continue against remaining enemy (not fail)
    await game.toNextTurn();

    // The move should have succeeded (not failed)
    const lastMove = playerPokemon.getLastXMoves(1)[0];
    expect(lastMove.result).not.toBe(MoveResult.FAIL);

    // Remaining enemy should have taken damage
    expect(remainingEnemy.hp).toBeLessThan(remainingEnemy.getMaxHp());
  });
});
