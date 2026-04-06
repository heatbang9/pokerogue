import { AbilityId } from "#enums/ability-id";
import { ArenaTagSide } from "#enums/arena-tag-side";
import { ArenaTagType } from "#enums/arena-tag-type";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { Stat } from "#enums/stat";
import { StatusEffect } from "#enums/status-effect";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Move - Court Change", () => {
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
      .ability(AbilityId.BALL_FETCH)
      .criticalHits(false)
      .enemyAbility(AbilityId.STURDY)
      .startingLevel(100)
      .battleStyle("single")
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyMoveset(MoveId.SPLASH);
  });

  it("should swap combined Pledge effects to the opposite side", async () => {
    game.override.battleStyle("double");
    await game.classicMode.startBattle(SpeciesId.REGIELEKI, SpeciesId.SHUCKLE);

    const regieleki = game.field.getPlayerPokemon();
    const enemyPokemon = game.field.getEnemyPokemon();

    game.move.use(MoveId.WATER_PLEDGE);
    game.move.use(MoveId.GRASS_PLEDGE, 1);
    await game.toNextTurn();

    // enemy team will be in the swamp and slowed
    expect(game.scene.arena.getTagOnSide(ArenaTagType.GRASS_WATER_PLEDGE, ArenaTagSide.ENEMY)).toBeDefined();
    expect(enemyPokemon.getEffectiveStat(Stat.SPD)).toBe(enemyPokemon.getStat(Stat.SPD) / 4);

    game.move.use(MoveId.COURT_CHANGE);
    game.move.use(MoveId.SPLASH, 1);
    await game.toEndOfTurn();

    // own team should now be in the swamp and slowed
    expect(game.scene.arena.getTagOnSide(ArenaTagType.GRASS_WATER_PLEDGE, ArenaTagSide.ENEMY)).toBeUndefined();
    expect(game.scene.arena.getTagOnSide(ArenaTagType.GRASS_WATER_PLEDGE, ArenaTagSide.PLAYER)).toBeDefined();
    expect(regieleki.getEffectiveStat(Stat.SPD)).toBe(regieleki.getStat(Stat.SPD) / 4);
  });

  it("should swap safeguard to the enemy side ", async () => {
    game.override.enemyMoveset(MoveId.TOXIC_THREAD);
    await game.classicMode.startBattle(SpeciesId.NINJASK);

    const ninjask = game.field.getPlayerPokemon();

    game.move.use(MoveId.SAFEGUARD);
    await game.move.forceEnemyMove(MoveId.TOXIC_THREAD);
    await game.toNextTurn();

    // Ninjask will not be poisoned because of Safeguard
    expect(game.scene.arena.getTagOnSide(ArenaTagType.SAFEGUARD, ArenaTagSide.PLAYER)).toBeDefined();
    expect(ninjask.status?.effect).toBeUndefined();

    game.move.use(MoveId.COURT_CHANGE);
    await game.toEndOfTurn();

    // Ninjask should now be poisoned due to lack of Safeguard
    expect(game.scene.arena.getTagOnSide(ArenaTagType.SAFEGUARD, ArenaTagSide.PLAYER)).toBeUndefined();
    expect(game.scene.arena.getTagOnSide(ArenaTagType.SAFEGUARD, ArenaTagSide.ENEMY)).toBeDefined();
    expect(ninjask.status?.effect).toBe(StatusEffect.POISON);
  });

  it("should preserve Spikes layer count when swapping", async () => {
    game.override.enemyMoveset(MoveId.SPIKES);
    await game.classicMode.startBattle(SpeciesId.NINJASK);

    // Enemy uses Spikes 3 times to stack 3 layers
    game.move.use(MoveId.SPLASH);
    await game.move.forceEnemyMove(MoveId.SPIKES);
    await game.toNextTurn();

    game.move.use(MoveId.SPLASH);
    await game.move.forceEnemyMove(MoveId.SPIKES);
    await game.toNextTurn();

    game.move.use(MoveId.SPLASH);
    await game.move.forceEnemyMove(MoveId.SPIKES);
    await game.toNextTurn();

    // Verify 3 layers on player side
    const playerSpikes = game.scene.arena.getTagOnSide(ArenaTagType.SPIKES, ArenaTagSide.PLAYER);
    expect(playerSpikes).toBeDefined();
    expect(playerSpikes?.layers).toBe(3);

    // Use Court Change to swap, enemy uses SPLASH so they don't add more spikes
    game.move.use(MoveId.COURT_CHANGE);
    await game.move.forceEnemyMove(MoveId.SPLASH);
    await game.toEndOfTurn();

    // Spikes should now be on enemy side with 3 layers preserved
    const enemySpikes = game.scene.arena.getTagOnSide(ArenaTagType.SPIKES, ArenaTagSide.ENEMY);
    expect(enemySpikes).toBeDefined();
    expect(enemySpikes?.layers).toBe(3);

    // No spikes on player side
    expect(game.scene.arena.getTagOnSide(ArenaTagType.SPIKES, ArenaTagSide.PLAYER)).toBeUndefined();
  });

  it("should preserve Toxic Spikes layer count when swapping", async () => {
    game.override.enemyMoveset(MoveId.TOXIC_SPIKES);
    await game.classicMode.startBattle(SpeciesId.NINJASK);

    // Enemy uses Toxic Spikes 2 times to stack 2 layers (poison -> badly poisoned)
    game.move.use(MoveId.SPLASH);
    await game.move.forceEnemyMove(MoveId.TOXIC_SPIKES);
    await game.toNextTurn();

    game.move.use(MoveId.SPLASH);
    await game.move.forceEnemyMove(MoveId.TOXIC_SPIKES);
    await game.toNextTurn();

    // Verify 2 layers on player side
    const playerToxicSpikes = game.scene.arena.getTagOnSide(ArenaTagType.TOXIC_SPIKES, ArenaTagSide.PLAYER);
    expect(playerToxicSpikes).toBeDefined();
    expect(playerToxicSpikes?.layers).toBe(2);

    // Use Court Change to swap, enemy uses SPLASH so they don't add more toxic spikes
    game.move.use(MoveId.COURT_CHANGE);
    await game.move.forceEnemyMove(MoveId.SPLASH);
    await game.toEndOfTurn();

    // Toxic Spikes should now be on enemy side with 2 layers preserved
    const enemyToxicSpikes = game.scene.arena.getTagOnSide(ArenaTagType.TOXIC_SPIKES, ArenaTagSide.ENEMY);
    expect(enemyToxicSpikes).toBeDefined();
    expect(enemyToxicSpikes?.layers).toBe(2);

    // No toxic spikes on player side
    expect(game.scene.arena.getTagOnSide(ArenaTagType.TOXIC_SPIKES, ArenaTagSide.PLAYER)).toBeUndefined();
  });
});
