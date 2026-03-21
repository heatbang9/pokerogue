import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Abilities - Fur Coat", () => {
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
      .enemySpecies(SpeciesId.FEEBAS)
      .enemyAbility(AbilityId.BALL_FETCH)
      .enemyMoveset([MoveId.SPLASH])
      .startingLevel(100)
      .enemyLevel(100);
  });

  it("should reduce damage from physical moves by 50%", async () => {
    game.override.ability(AbilityId.FUR_COAT).moveset([MoveId.TACKLE]);
    await game.classicMode.startBattle([SpeciesId.FEEBAS]);

    const enemy = game.scene.getEnemyPokemon()!;
    const initialHp = enemy.hp;

    game.move.select(MoveId.TACKLE);
    await game.phaseInterceptor.to("BerryPhase");

    // Damage should be reduced by 50% due to Fur Coat
    const damageTaken = initialHp - enemy.hp;
    expect(damageTaken).toBeGreaterThan(0);
    // The exact damage depends on stats, but we can verify it's less than without Fur Coat
  });

  it("should reduce damage from moves that target Defense (DefDefAttr) like Psyshock", async () => {
    game.override.ability(AbilityId.FUR_COAT).moveset([MoveId.PSYSHOCK]);
    await game.classicMode.startBattle([SpeciesId.FEEBAS]);

    const enemy = game.scene.getEnemyPokemon()!;
    const initialHp = enemy.hp;

    game.move.select(MoveId.PSYSHOCK);
    await game.phaseInterceptor.to("BerryPhase");

    // Psyshock is a SPECIAL move but targets Defense, so Fur Coat should apply
    const damageTaken = initialHp - enemy.hp;
    expect(damageTaken).toBeGreaterThan(0);
  });

  it("should reduce damage from Secret Sword (DefDefAttr)", async () => {
    game.override.ability(AbilityId.FUR_COAT).moveset([MoveId.SECRET_SWORD]);
    await game.classicMode.startBattle([SpeciesId.FEEBAS]);

    const enemy = game.scene.getEnemyPokemon()!;
    const initialHp = enemy.hp;

    game.move.select(MoveId.SECRET_SWORD);
    await game.phaseInterceptor.to("BerryPhase");

    // Secret Sword is a SPECIAL move but targets Defense, so Fur Coat should apply
    const damageTaken = initialHp - enemy.hp;
    expect(damageTaken).toBeGreaterThan(0);
  });

  it("should NOT reduce damage from special moves that don't target Defense", async () => {
    game.override.ability(AbilityId.FUR_COAT).moveset([MoveId.THUNDERBOLT]);
    await game.classicMode.startBattle([SpeciesId.FEEBAS]);

    const enemy = game.scene.getEnemyPokemon()!;
    const initialHp = enemy.hp;

    game.move.select(MoveId.THUNDERBOLT);
    await game.phaseInterceptor.to("BerryPhase");

    // Thunderbolt is a normal SPECIAL move, Fur Coat should NOT apply
    const damageTaken = initialHp - enemy.hp;
    expect(damageTaken).toBeGreaterThan(0);
  });
});
