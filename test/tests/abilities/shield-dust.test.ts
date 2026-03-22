import { applyAbAttrs } from "#abilities/apply-ab-attrs";
import { modifierTypes } from "#data/data-lists";
import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { Stat } from "#enums/stat";
import { StatusEffect } from "#enums/status-effect";
import type { EnemyPersistentModifier } from "#modifiers/modifier";
import type { MoveEffectPhase } from "#phases/move-effect-phase";
import { GameManager } from "#test/framework/game-manager";
import { NumberHolder, randSeedFloat } from "#utils/common";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("Abilities - Shield Dust", () => {
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
      .enemySpecies(SpeciesId.ONIX)
      .enemyAbility(AbilityId.SHIELD_DUST)
      .startingLevel(100)
      .moveset(MoveId.AIR_SLASH)
      .enemyMoveset(MoveId.TACKLE);
  });

  it("Shield Dust", async () => {
    await game.classicMode.startBattle(SpeciesId.PIDGEOT);

    game.field.getEnemyPokemon().stats[Stat.SPDEF] = 10000;
    expect(game.field.getPlayerPokemon().formIndex).toBe(0);

    game.move.select(MoveId.AIR_SLASH);

    await game.setTurnOrder([BattlerIndex.PLAYER, BattlerIndex.ENEMY]);
    await game.phaseInterceptor.to("MoveEffectPhase", false);

    // Shield Dust negates secondary effect
    const phase = game.scene.phaseManager.getCurrentPhase() as MoveEffectPhase;
    const move = phase.move;
    expect(move.id).toBe(MoveId.AIR_SLASH);

    const chance = new NumberHolder(move.chance);
    applyAbAttrs("MoveEffectChanceMultiplierAbAttr", {
      pokemon: phase.getUserPokemon()!,
      chance,
      move,
    });
    applyAbAttrs("IgnoreMoveEffectsAbAttr", {
      pokemon: phase.getFirstTarget()!,
      move,
      chance,
    });
    expect(chance.value).toBe(0);
  });

  it("should block status effects from endless tokens", async () => {
    game.override
      .ability(AbilityId.SHIELD_DUST)
      .enemyAbility(AbilityId.BALL_FETCH)
      .moveset(MoveId.SPLASH)
      .enemyMoveset(MoveId.TACKLE);

    await game.classicMode.startBattle(SpeciesId.CATERPIE);

    // Add an EnemyAttackStatusEffectChanceModifier (Paralysis token) to the enemy
    const paralysisToken = modifierTypes.ENEMY_ATTACK_PARALYZE_CHANCE().newModifier() as EnemyPersistentModifier;
    paralysisToken.stackCount = 100; // High stack count to ensure 100% trigger chance
    await game.scene.addEnemyModifier(paralysisToken);

    const playerPokemon = game.field.getPlayerPokemon();

    // Mock randSeedFloat to always return 0 (guaranteeing the token would trigger)
    vi.spyOn({ randSeedFloat }, "randSeedFloat").mockReturnValue(0);

    game.move.select(MoveId.SPLASH);
    await game.setTurnOrder([BattlerIndex.ENEMY, BattlerIndex.PLAYER]);
    await game.phaseInterceptor.to("TurnEndPhase");

    // Shield Dust should block the token status effect
    expect(playerPokemon.status?.effect).not.toBe(StatusEffect.PARALYSIS);

    vi.restoreAllMocks();
  });

  //TODO King's Rock Interaction Unit Test
});
