import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Pollen Puff", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
  });

  it("should heal ally when targeting them", async () => {
    game.override.battleStyle("double").moveset([MoveId.POLLEN_PUFF, MoveId.SPLASH]).enemyMoveset(MoveId.SPLASH);

    await game.classicMode.startBattle(SpeciesId.ORANGURU, SpeciesId.GARDEVOIR);

    const ally = game.scene.getPlayerField()[1];

    // Damage ally first
    ally.hp = Math.floor(ally.getMaxHp() / 2);

    game.move.select(MoveId.POLLEN_PUFF, 0, 1); // Target ally
    game.move.select(MoveId.SPLASH, 1);

    await game.phaseInterceptor.to("BerryPhase", false);

    // Ally should be healed
    expect(ally.hp).toBeGreaterThan(Math.floor(ally.getMaxHp() / 2));
  });

  it("should be blocked by Telepathy when targeting ally", async () => {
    game.override
      .battleStyle("double")
      .moveset([MoveId.POLLEN_PUFF, MoveId.SPLASH])
      .enemyMoveset(MoveId.SPLASH)
      .enemyAbility(AbilityId.TELEPATHY);

    await game.classicMode.startBattle(SpeciesId.ORANGURU, SpeciesId.GARDEVOIR);

    const ally = game.scene.getPlayerField()[1];
    const initialAllyHp = ally.hp;

    game.move.select(MoveId.POLLEN_PUFF, 0, 1); // Target ally
    game.move.select(MoveId.SPLASH, 1);

    await game.phaseInterceptor.to("BerryPhase", false);

    // Ally with Telepathy should NOT be healed (move should be blocked)
    expect(ally.hp).toBe(initialAllyHp);
  });

  it("should deal damage to enemy regardless of Telepathy", async () => {
    game.override
      .battleStyle("double")
      .moveset([MoveId.POLLEN_PUFF, MoveId.SPLASH])
      .enemyMoveset(MoveId.SPLASH)
      .enemyAbility(AbilityId.TELEPATHY);

    await game.classicMode.startBattle(SpeciesId.ORANGURU, SpeciesId.GARDEVOIR);

    const enemy = game.scene.getEnemyField()[0];
    const initialEnemyHp = enemy.hp;

    game.move.select(MoveId.POLLEN_PUFF, 0); // Target enemy
    game.move.select(MoveId.SPLASH, 1);

    await game.phaseInterceptor.to("BerryPhase", false);

    // Enemy should take damage (Telepathy only blocks ally moves)
    expect(enemy.hp).toBeLessThan(initialEnemyHp);
  });
});
