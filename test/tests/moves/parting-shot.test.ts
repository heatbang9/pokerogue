import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { Stat } from "#enums/stat";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it, test } from "vitest";

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
      .moveset([MoveId.PARTING_SHOT, MoveId.SPLASH])
      .enemyMoveset(MoveId.SPLASH)
      .startingLevel(5)
      .enemyLevel(5);
  });

  test("Parting Shot when buffed by prankster should fail against dark types", async () => {
    game.override.enemySpecies(SpeciesId.POOCHYENA).ability(AbilityId.PRANKSTER);
    await game.classicMode.startBattle(SpeciesId.MURKROW, SpeciesId.MEOWTH);

    const enemyPokemon = game.field.getEnemyPokemon();
    expect(enemyPokemon).toBeDefined();

    game.move.select(MoveId.PARTING_SHOT);

    await game.phaseInterceptor.to("BerryPhase", false);
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(0);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(0);
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.MURKROW);
  });

  test("Parting shot should fail against good as gold ability", async () => {
    game.override.enemySpecies(SpeciesId.GHOLDENGO).enemyAbility(AbilityId.GOOD_AS_GOLD);
    await game.classicMode.startBattle(SpeciesId.MURKROW, SpeciesId.MEOWTH);

    const enemyPokemon = game.field.getEnemyPokemon();
    expect(enemyPokemon).toBeDefined();

    game.move.select(MoveId.PARTING_SHOT);

    await game.phaseInterceptor.to("BerryPhase", false);
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(0);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(0);
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.MURKROW);
  });

  test("Parting shot shouldn't allow switch out against clear body ability", async () => {
    game.override.enemySpecies(SpeciesId.TENTACOOL).enemyAbility(AbilityId.CLEAR_BODY);
    await game.classicMode.startBattle(SpeciesId.SNORLAX, SpeciesId.MEOWTH);

    const enemyPokemon = game.field.getEnemyPokemon();
    expect(enemyPokemon).toBeDefined();

    game.move.select(MoveId.PARTING_SHOT);

    await game.phaseInterceptor.to("BerryPhase", false);
    // Clear Body blocks stat drops, so Parting Shot should not switch out
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(0);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(0);
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.SNORLAX);
  });

  test("Parting shot shouldn't allow switch out when mist is active", async () => {
    game.override.enemySpecies(SpeciesId.ALTARIA).enemyAbility(AbilityId.NONE).enemyMoveset([MoveId.MIST]);
    await game.classicMode.startBattle(SpeciesId.SNORLAX, SpeciesId.MEOWTH);

    const enemyPokemon = game.field.getEnemyPokemon();
    expect(enemyPokemon).toBeDefined();

    game.move.select(MoveId.PARTING_SHOT);

    await game.phaseInterceptor.to("BerryPhase", false);
    // Mist blocks stat drops, so Parting Shot should not switch out
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(0);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(0);
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.SNORLAX);
  });

  test("should lower stats and switch out when successful", async () => {
    await game.classicMode.startBattle(SpeciesId.SNORLAX, SpeciesId.MEOWTH);

    const enemyPokemon = game.field.getEnemyPokemon();
    expect(enemyPokemon).toBeDefined();

    game.move.select(MoveId.PARTING_SHOT);
    // Handle the switch selection prompt
    game.doSelectPartyPokemon(1);

    await game.phaseInterceptor.to("BerryPhase", false);
    // Stat drops should apply and switch should occur
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(-1);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(-1);
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.MEOWTH);
  });

  // This test documents the current behavior where Parting Shot fails when stats can't go lower
  // This matches the behavior of moves like Growl failing when stats are at minimum
  it.todo("Parting shot should fail if target is -6/-6 de-buffed", async () => {
    game.override.moveset([MoveId.PARTING_SHOT, MoveId.MEMENTO, MoveId.SPLASH]);
    await game.classicMode.startBattle(
      SpeciesId.MEOWTH,
      SpeciesId.MEOWTH,
      SpeciesId.MEOWTH,
      SpeciesId.MURKROW,
      SpeciesId.ABRA,
    );

    // use Memento 3 times to debuff enemy
    game.move.select(MoveId.MEMENTO);
    await game.phaseInterceptor.to("FaintPhase");
    expect(game.field.getPlayerPokemon().isFainted()).toBe(true);
    game.doSelectPartyPokemon(1);

    await game.phaseInterceptor.to("TurnInitPhase", false);
    game.move.select(MoveId.MEMENTO);
    await game.phaseInterceptor.to("FaintPhase");
    expect(game.field.getPlayerPokemon().isFainted()).toBe(true);
    game.doSelectPartyPokemon(2);

    await game.phaseInterceptor.to("TurnInitPhase", false);
    game.move.select(MoveId.MEMENTO);
    await game.phaseInterceptor.to("FaintPhase");
    expect(game.field.getPlayerPokemon().isFainted()).toBe(true);
    game.doSelectPartyPokemon(3);

    // set up done
    await game.phaseInterceptor.to("TurnInitPhase", false);
    const enemyPokemon = game.field.getEnemyPokemon();
    expect(enemyPokemon).toBeDefined();

    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(-6);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(-6);

    // now parting shot should fail (stats can't go lower)
    game.move.select(MoveId.PARTING_SHOT);

    await game.phaseInterceptor.to("BerryPhase", false);
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(-6);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(-6);
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.MURKROW);
  });

  // This test documents edge case behavior
  it.todo("should lower stats without switching if no alive party members available to switch", async () => {
    await game.classicMode.startBattle(SpeciesId.MURKROW, SpeciesId.MEOWTH);

    const meowth = game.scene.getPlayerParty()[1];
    meowth.hp = 0;

    game.move.select(MoveId.SPLASH);
    await game.toNextTurn();

    game.move.select(MoveId.PARTING_SHOT);
    game.doSelectPartyPokemon(1);
    await game.toEndOfTurn();

    const enemyPokemon = game.field.getEnemyPokemon();
    // Stat drops should still apply even when no switch is possible
    expect(enemyPokemon.getStatStage(Stat.ATK)).toBe(-1);
    expect(enemyPokemon.getStatStage(Stat.SPATK)).toBe(-1);
    // User should still be Murkrow since Meowth is fainted
    expect(game.field.getPlayerPokemon().species.speciesId).toBe(SpeciesId.MURKROW);
  });
});
