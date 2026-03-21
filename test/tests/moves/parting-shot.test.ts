import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { Stat } from "#enums/stat";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Moves - Parting Shot", () => {
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
      .criticalHits(false)
      .startingLevel(100)
      .enemyLevel(100)
      .enemySpecies(SpeciesId.SHUCKLE)
      .enemyMoveset(MoveId.SPLASH)
      .enemyAbility(AbilityId.STURDY);
  });

  it("should lower target's ATK and SPATK and switch out user", async () => {
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    const enemyPokemon = game.field.getEnemyPokemon();
    const initialEnemyAtk = enemyPokemon.getStatStage(Stat.ATK);
    const initialEnemySpAtk = enemyPokemon.getStatStage(Stat.SPATK);

    game.move.use(MoveId.PARTING_SHOT);
    await game.toEndOfTurn();

    // Check stat drops
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(initialEnemyAtk - 1);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(initialEnemySpAtk - 1);

    // Check switch out - should have switched to Charmander
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.CHARMANDER);
  });

  it("should not switch out if stat drop is blocked by Clear Body", async () => {
    game.override.enemyAbility(AbilityId.CLEAR_BODY);
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    const enemyPokemon = game.field.getEnemyPokemon();
    const initialEnemyAtk = enemyPokemon.getStatStage(Stat.ATK);
    const initialEnemySpAtk = enemyPokemon.getStatStage(Stat.SPATK);

    game.move.use(MoveId.PARTING_SHOT);
    await game.toEndOfTurn();

    // Stat drops should be blocked
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(initialEnemyAtk);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(initialEnemySpAtk);

    // User should NOT switch out - should still be Bulbasaur
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.BULBASAUR);
  });

  it("should not switch out if stat drop is blocked by White Smoke", async () => {
    game.override.enemyAbility(AbilityId.WHITE_SMOKE);
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    game.move.use(MoveId.PARTING_SHOT);
    await game.toEndOfTurn();

    // User should NOT switch out
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.BULBASAUR);
  });

  it("should not switch out if stat drop is blocked by Good as Gold", async () => {
    game.override.enemyAbility(AbilityId.GOOD_AS_GOLD);
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    game.move.use(MoveId.PARTING_SHOT);
    await game.toEndOfTurn();

    // User should NOT switch out
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.BULBASAUR);
  });

  it("should lower stats but not switch out if no eligible Pokemon to switch to", async () => {
    // Only one Pokemon in party
    await game.classicMode.startBattle([SpeciesId.BULBASAUR]);

    const enemyPokemon = game.field.getEnemyPokemon();
    const initialEnemyAtk = enemyPokemon.getStatStage(Stat.ATK);
    const initialEnemySpAtk = enemyPokemon.getStatStage(Stat.SPATK);

    game.move.use(MoveId.PARTING_SHOT);
    await game.toEndOfTurn();

    // Stat drops should still occur
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(initialEnemyAtk - 1);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(initialEnemySpAtk - 1);

    // User should NOT switch out (no Pokemon to switch to)
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.BULBASAUR);
  });
});
