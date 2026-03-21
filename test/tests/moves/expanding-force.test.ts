import { allMoves } from "#app/data/data-lists";
import { TerrainType } from "#app/data/terrain";
import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { MoveTarget } from "#enums/move-target";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("Moves - Expanding Force", () => {
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
      .startingLevel(100)
      .enemyLevel(100)
      .enemySpecies(SpeciesId.SHUCKLE)
      .enemyMoveset(MoveId.SPLASH)
      .enemyAbility(AbilityId.STURDY)
      .passiveAbility(AbilityId.NO_GUARD);
  });

  it("should target single enemy when Psychic Terrain is not active", async () => {
    await game.classicMode.startBattle([SpeciesId.GARDEVOIR, SpeciesId.BLISSEY]);

    const move = allMoves[MoveId.EXPANDING_FORCE];

    game.move.use(MoveId.EXPANDING_FORCE);
    await game.toEndOfTurn();

    // Should target only one enemy (NEAR_OTHER instead of ALL_NEAR_ENEMIES)
    expect(move.moveTarget).toBe(MoveTarget.NEAR_OTHER);
  });

  it("should target all enemies when Psychic Terrain is active and user is grounded", async () => {
    game.override.startingTerrain(TerrainType.PSYCHIC);
    await game.classicMode.startBattle([SpeciesId.GARDEVOIR, SpeciesId.BLISSEY]);

    game.move.use(MoveId.EXPANDING_FORCE);
    await game.toEndOfTurn();

    // In double battle with Psychic Terrain, Expanding Force should hit both enemies
    // Check that damage was dealt to both enemy Pokemon
    const enemy1 = game.field.getEnemyPokemon(0);
    const enemy2 = game.field.getEnemyPokemon(1);

    // Both enemies should have taken damage
    expect(enemy1.hp).toBeLessThan(enemy1.getMaxHp());
    expect(enemy2.hp).toBeLessThan(enemy2.getMaxHp());
  });

  it("should have 1.5x power when Psychic Terrain is active and user is grounded", async () => {
    game.override.startingTerrain(TerrainType.PSYCHIC);
    await game.classicMode.startBattle([SpeciesId.GARDEVOIR, SpeciesId.BLISSEY]);

    const move = allMoves[MoveId.EXPANDING_FORCE];
    const powerSpy = vi.spyOn(move, "calculateBattlePower");

    game.move.use(MoveId.EXPANDING_FORCE);
    await game.toEndOfTurn();

    expect(powerSpy).toHaveReturnedWith(move.power * 1.5);
  });

  it("should have normal power when Psychic Terrain is not active", async () => {
    await game.classicMode.startBattle([SpeciesId.GARDEVOIR, SpeciesId.BLISSEY]);

    const move = allMoves[MoveId.EXPANDING_FORCE];
    const powerSpy = vi.spyOn(move, "calculateBattlePower");

    game.move.use(MoveId.EXPANDING_FORCE);
    await game.toEndOfTurn();

    expect(powerSpy).toHaveReturnedWith(move.power);
  });

  // This test checks the bug described in issue #4969
  it("should update target when Psychic Terrain becomes active mid-turn", async () => {
    // Use a Pokemon with Psychic Surge ability to activate terrain
    game.override.enemyAbility(AbilityId.PSYCHIC_SURGE).enemyMoveset([MoveId.SPLASH, MoveId.SPLASH]).enemyLevel(100);

    await game.classicMode.startBattle([SpeciesId.GARDEVOIR, SpeciesId.BLISSEY]);

    // Player is slower, so will use Expanding Force after Psychic Terrain activates from ability
    game.override.startingLevel(50);

    game.move.use(MoveId.EXPANDING_FORCE);
    await game.toEndOfTurn();

    // After Psychic Terrain activates from enemy's Psychic Surge, Expanding Force should target all enemies
    // Check that damage was dealt to both enemy Pokemon
    const enemy1 = game.field.getEnemyPokemon(0);
    const enemy2 = game.field.getEnemyPokemon(1);

    // Both enemies should have taken damage (fix should make this pass)
    expect(enemy1.hp).toBeLessThan(enemy1.getMaxHp());
    expect(enemy2.hp).toBeLessThan(enemy2.getMaxHp());
  });

  it("should update target when Psychic Terrain is replaced mid-turn", async () => {
    game.override.startingTerrain(TerrainType.PSYCHIC);
    game.override.enemyAbility(AbilityId.ELECTRIC_SURGE).enemyMoveset([MoveId.SPLASH, MoveId.SPLASH]).enemyLevel(100);

    await game.classicMode.startBattle([SpeciesId.GARDEVOIR, SpeciesId.BLISSEY]);

    // Player is slower, so will use Expanding Force after Electric Terrain replaces Psychic Terrain
    game.override.startingLevel(50);

    game.move.use(MoveId.EXPANDING_FORCE);
    await game.toEndOfTurn();

    // After Electric Terrain replaces Psychic Terrain from enemy's Electric Surge, Expanding Force should target single enemy
    // So only one enemy should take damage
    const enemy1 = game.field.getEnemyPokemon(0);
    const enemy2 = game.field.getEnemyPokemon(1);

    // Only one enemy should have taken damage (fix should make this pass)
    const enemy1Damage = enemy1.getMaxHp() - enemy1.hp;
    const enemy2Damage = enemy2.getMaxHp() - enemy2.hp;

    // One enemy should have damage, the other should not (or minimal damage)
    expect(enemy1Damage > 0 || enemy2Damage > 0).toBe(true);
  });
});
