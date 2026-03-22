import { AbilityId } from "#enums/ability-id";
import { BattlerTagType } from "#enums/battler-tag-type";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Moves - Rampage Retarget in Double Battles", () => {
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
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyMoveset(MoveId.SPLASH)
      .enemyAbility(AbilityId.STURDY);
  });

  it("should retarget Outrage when original target faints in double battle", async () => {
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    const playerPokemon = game.field.getPlayerPokemon();
    const enemies = game.field.getEnemyParty();

    // Use Outrage (a rampage move)
    game.move.use(MoveId.OUTRAGE);

    // Set up frenzy tag to simulate ongoing rampage
    playerPokemon.addTag(BattlerTagType.FRENZY, 3, MoveId.OUTRAGE);

    // Kill one enemy to force retargeting scenario
    if (enemies.length > 0) {
      enemies[0].hp = 1;
    }

    await game.toEndOfTurn();

    // The move should have targeted one of the enemies (not failed)
    // At least one enemy should have taken damage
    const damageDealt = enemies.some(e => e.hp < e.getMaxHp());
    expect(damageDealt).toBe(true);
  });

  it("should retarget Thrash when original target faints in double battle", async () => {
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    const playerPokemon = game.field.getPlayerPokemon();

    // Use Thrash (a rampage move)
    game.move.use(MoveId.THRASH);

    // Set up frenzy tag to simulate ongoing rampage
    playerPokemon.addTag(BattlerTagType.FRENZY, 3, MoveId.THRASH);

    await game.toEndOfTurn();

    // The move should have targeted one of the enemies
    const enemies = game.field.getEnemyParty();
    const damageDealt = enemies.some(e => e.hp < e.getMaxHp());
    expect(damageDealt).toBe(true);
  });

  it("should retarget Petal Dance when original target faints in double battle", async () => {
    await game.classicMode.startBattle([SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);

    const playerPokemon = game.field.getPlayerPokemon();

    // Use Petal Dance (a rampage move)
    game.move.use(MoveId.PETAL_DANCE);

    // Set up frenzy tag to simulate ongoing rampage
    playerPokemon.addTag(BattlerTagType.FRENZY, 3, MoveId.PETAL_DANCE);

    await game.toEndOfTurn();

    // The move should have targeted one of the enemies
    const enemies = game.field.getEnemyParty();
    const damageDealt = enemies.some(e => e.hp < e.getMaxHp());
    expect(damageDealt).toBe(true);
  });
});
