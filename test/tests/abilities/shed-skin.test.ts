/*
 * SPDX-FileCopyrightText: 2024-2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { StatusEffect } from "#enums/status-effect";
import { GameManager } from "#test/framework/game-manager";
import Phaser from "phaser";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("Abilities - Shed Skin", () => {
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
      .ability(AbilityId.SHED_SKIN)
      .moveset([MoveId.SPLASH])
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyAbility(AbilityId.BALL_FETCH)
      .enemyMoveset([MoveId.SPLASH]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should trigger before burn damage is dealt", async () => {
    await game.classicMode.startBattle(SpeciesId.DRATINI);

    const player = game.field.getPlayerPokemon();

    // Apply burn status
    player.doSetStatus(StatusEffect.BURN);
    expect(player.status?.effect).toBe(StatusEffect.BURN);

    // Mock Phaser's RNG to guarantee Shed Skin triggers (returns 0)
    vi.spyOn(Phaser.Math.RND, "integerInRange").mockReturnValue(0);

    // End turn - Shed Skin should cure before burn damage
    game.move.use(MoveId.SPLASH);
    await game.toEndOfTurn();

    // Status should be cured by Shed Skin before burn damage
    expect(player.status?.effect).toBeUndefined();

    // Player should NOT have taken burn damage (since it was cured first)
    // Burn deals 1/16 max HP damage, so if cured first, HP should be full
    const maxHp = player.getMaxHp();
    const expectedHpIfNoBurnDamage = maxHp;
    expect(player.hp).toBe(expectedHpIfNoBurnDamage);
  });

  it("should trigger before poison damage is dealt", async () => {
    await game.classicMode.startBattle(SpeciesId.DRATINI);

    const player = game.field.getPlayerPokemon();

    // Apply poison status
    player.doSetStatus(StatusEffect.POISON);
    expect(player.status?.effect).toBe(StatusEffect.POISON);

    // Mock Phaser's RNG to guarantee Shed Skin triggers (returns 0)
    vi.spyOn(Phaser.Math.RND, "integerInRange").mockReturnValue(0);

    // End turn - Shed Skin should cure before poison damage
    game.move.use(MoveId.SPLASH);
    await game.toEndOfTurn();

    // Status should be cured by Shed Skin before poison damage
    expect(player.status?.effect).toBeUndefined();

    // Player should NOT have taken poison damage (since it was cured first)
    // Poison deals 1/8 max HP damage, so if cured first, HP should be full
    const maxHp = player.getMaxHp();
    const expectedHpIfNoPoisonDamage = maxHp;
    expect(player.hp).toBe(expectedHpIfNoPoisonDamage);
  });

  it("should NOT cure status when Shed Skin does not trigger", async () => {
    await game.classicMode.startBattle(SpeciesId.DRATINI);

    const player = game.field.getPlayerPokemon();

    // Apply burn status
    player.doSetStatus(StatusEffect.BURN);
    expect(player.status?.effect).toBe(StatusEffect.BURN);

    // Mock Phaser's RNG to NOT trigger Shed Skin (returns value >= 1)
    // Use mockImplementation to only affect Shed Skin check (range 0-2)
    vi.spyOn(Phaser.Math.RND, "integerInRange").mockImplementation((min: number, max: number) => {
      // For Shed Skin check (0-2 range), return 2 to NOT trigger
      if (min === 0 && max === 2) {
        return 2;
      }
      // For other RNG calls, return min to avoid breaking speed order
      return min;
    });

    // End turn
    game.move.use(MoveId.SPLASH);
    await game.toEndOfTurn();

    // Status should NOT be cured
    expect(player.status?.effect).toBe(StatusEffect.BURN);

    // Player should have taken burn damage
    const maxHp = player.getMaxHp();
    const expectedHpAfterBurn = maxHp - Math.floor(maxHp / 16);
    expect(player.hp).toBe(expectedHpAfterBurn);
  });
});
