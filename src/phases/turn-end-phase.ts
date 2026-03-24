import { applyAbAttrs } from "#abilities/apply-ab-attrs";
import { globalScene } from "#app/global-scene";
import { getPokemonNameWithAffix } from "#app/messages";
import { TerrainType } from "#data/terrain";
import { BattlerTagLapseType } from "#enums/battler-tag-lapse-type";
import { WeatherType } from "#enums/weather-type";
import { TurnEndEvent } from "#events/battle-scene";
import type { Pokemon } from "#field/pokemon";
import {
  EnemyStatusEffectHealChanceModifier,
  EnemyTurnHealModifier,
  TurnHealModifier,
  TurnHeldItemTransferModifier,
  TurnStatusEffectModifier,
} from "#modifiers/modifier";
import { FieldPhase } from "#phases/field-phase";
import i18next from "i18next";

export class TurnEndPhase extends FieldPhase {
  public readonly phaseName = "TurnEndPhase";
  public upcomingInterlude = false;

  start() {
    super.start();

    globalScene.currentBattle.incrementTurn();
    globalScene.eventTarget.dispatchEvent(new TurnEndEvent(globalScene.currentBattle.turn));
    globalScene.phaseManager.dynamicQueueManager.clearLastTurnOrder();

    globalScene.phaseManager.hideAbilityBar();

    const handlePokemon = (pokemon: Pokemon) => {
      if (!pokemon.switchOutStatus) {
        // Grassy Terrain healing (mainline step 7)
        if (globalScene.arena.terrain?.terrainType === TerrainType.GRASSY && pokemon.isGrounded()) {
          globalScene.phaseManager.unshiftNew(
            "PokemonHealPhase",
            pokemon.getBattlerIndex(),
            Math.max(pokemon.getMaxHp() >> 4, 1),
            i18next.t("battle:turnEndHpRestore", {
              pokemonName: getPokemonNameWithAffix(pokemon),
            }),
            true,
          );
        }

        // Status healing abilities (mainline step 8 - Healer, Hydration, Shed Skin)
        // These are handled via PostTurnStatusHealAbAttr which is applied in PostTurnAbAttr
        // Note: Status healing abilities should trigger before status damage

        // Leftovers / Black Sludge healing (mainline step 9)
        globalScene.applyModifiers(TurnHealModifier, pokemon.isPlayer(), pokemon);

        // Enemy-specific healing
        if (!pokemon.isPlayer()) {
          globalScene.applyModifiers(EnemyTurnHealModifier, false, pokemon);
          globalScene.applyModifier(EnemyStatusEffectHealChanceModifier, false, pokemon);
        }

        // Curse, Binding moves, Octolock, etc. (mainline steps 16-18)
        pokemon.lapseTags(BattlerTagLapseType.TURN_END);

        // Post-turn abilities (mainline step 29 - Harvest, Moody, Speed Boost, etc.)
        applyAbAttrs("PostTurnAbAttr", { pokemon });
      }

      // Flame Orb / Toxic Orb (mainline step 30)
      globalScene.applyModifiers(TurnStatusEffectModifier, pokemon.isPlayer(), pokemon);
      globalScene.applyModifiers(TurnHeldItemTransferModifier, pokemon.isPlayer(), pokemon);

      pokemon.tempSummonData.turnCount++;
      pokemon.tempSummonData.waveTurnCount++;
    };

    if (!this.upcomingInterlude) {
      this.executeForAll(handlePokemon);

      globalScene.arena.lapseTags();
    }

    if (globalScene.arena.weather && !globalScene.arena.weather.lapse()) {
      globalScene.arena.trySetWeather(WeatherType.NONE);
      globalScene.arena.triggerWeatherBasedFormChangesToNormal();
    }

    if (globalScene.arena.terrain && !globalScene.arena.terrain.lapse()) {
      globalScene.arena.trySetTerrain(TerrainType.NONE);
    }

    this.end();
  }
}
