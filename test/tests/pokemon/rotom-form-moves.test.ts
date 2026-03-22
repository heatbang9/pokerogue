import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Spec - Rotom Form Moves", () => {
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

  describe("Enemy Rotom form-specific moves", () => {
    it("should have Overheat for Heat Rotom (form 1)", async () => {
      game.override
        .enemySpecies(SpeciesId.ROTOM)
        .enemyForms({ [SpeciesId.ROTOM]: 1 })
        .startingLevel(100);
      await game.classicMode.startBattle([SpeciesId.FEEBAS]);

      const rotom = game.field.getEnemyPokemon();
      const moveset = rotom.moveset.map(m => m.moveId);

      expect(moveset).toContain(MoveId.OVERHEAT);
      expect(moveset).not.toContain(MoveId.BLIZZARD);
      expect(moveset).not.toContain(MoveId.HYDRO_PUMP);
      expect(moveset).not.toContain(MoveId.AIR_SLASH);
      expect(moveset).not.toContain(MoveId.LEAF_STORM);
    });

    it("should have Air Slash for Fan Rotom (form 2)", async () => {
      game.override
        .enemySpecies(SpeciesId.ROTOM)
        .enemyForms({ [SpeciesId.ROTOM]: 2 })
        .startingLevel(100);
      await game.classicMode.startBattle([SpeciesId.FEEBAS]);

      const rotom = game.field.getEnemyPokemon();
      const moveset = rotom.moveset.map(m => m.moveId);

      expect(moveset).toContain(MoveId.AIR_SLASH);
      expect(moveset).not.toContain(MoveId.OVERHEAT);
      expect(moveset).not.toContain(MoveId.BLIZZARD);
      expect(moveset).not.toContain(MoveId.HYDRO_PUMP);
      expect(moveset).not.toContain(MoveId.LEAF_STORM);
    });

    it("should have Blizzard for Frost Rotom (form 3)", async () => {
      game.override
        .enemySpecies(SpeciesId.ROTOM)
        .enemyForms({ [SpeciesId.ROTOM]: 3 })
        .startingLevel(100);
      await game.classicMode.startBattle([SpeciesId.FEEBAS]);

      const rotom = game.field.getEnemyPokemon();
      const moveset = rotom.moveset.map(m => m.moveId);

      expect(moveset).toContain(MoveId.BLIZZARD);
      expect(moveset).not.toContain(MoveId.OVERHEAT);
      expect(moveset).not.toContain(MoveId.HYDRO_PUMP);
      expect(moveset).not.toContain(MoveId.AIR_SLASH);
      expect(moveset).not.toContain(MoveId.LEAF_STORM);
    });

    it("should have Hydro Pump for Wash Rotom (form 4)", async () => {
      game.override
        .enemySpecies(SpeciesId.ROTOM)
        .enemyForms({ [SpeciesId.ROTOM]: 4 })
        .startingLevel(100);
      await game.classicMode.startBattle([SpeciesId.FEEBAS]);

      const rotom = game.field.getEnemyPokemon();
      const moveset = rotom.moveset.map(m => m.moveId);

      expect(moveset).toContain(MoveId.HYDRO_PUMP);
      expect(moveset).not.toContain(MoveId.OVERHEAT);
      expect(moveset).not.toContain(MoveId.BLIZZARD);
      expect(moveset).not.toContain(MoveId.AIR_SLASH);
      expect(moveset).not.toContain(MoveId.LEAF_STORM);
    });

    it("should have Leaf Storm for Mow Rotom (form 5)", async () => {
      game.override
        .enemySpecies(SpeciesId.ROTOM)
        .enemyForms({ [SpeciesId.ROTOM]: 5 })
        .startingLevel(100);
      await game.classicMode.startBattle([SpeciesId.FEEBAS]);

      const rotom = game.field.getEnemyPokemon();
      const moveset = rotom.moveset.map(m => m.moveId);

      expect(moveset).toContain(MoveId.LEAF_STORM);
      expect(moveset).not.toContain(MoveId.OVERHEAT);
      expect(moveset).not.toContain(MoveId.BLIZZARD);
      expect(moveset).not.toContain(MoveId.HYDRO_PUMP);
      expect(moveset).not.toContain(MoveId.AIR_SLASH);
    });
  });
});
