import { applyAbAttrs } from "#abilities/apply-ab-attrs";
import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { ArenaTagSide } from "#enums/arena-tag-side";
import { StatusEffect } from "#enums/status-effect";
import { inSpeedOrder } from "#utils/speed-order-generator";

export class CheckStatusEffectPhase extends Phase {
  public readonly phaseName = "CheckStatusEffectPhase";

  start() {
    // Abilities that cure status before status damage (Shed Skin, etc.)
    // must trigger before PostTurnStatusEffectPhase deals damage.
    // See: https://github.com/pagefaultgames/pokerogue/issues/6785
    for (const p of inSpeedOrder(ArenaTagSide.BOTH)) {
      if (p.status?.effect && p.status.effect !== StatusEffect.FAINT) {
        applyAbAttrs("PostTurnResetStatusAbAttr", { pokemon: p });
      }
    }

    for (const p of inSpeedOrder(ArenaTagSide.BOTH)) {
      if (p.status?.isPostTurn()) {
        globalScene.phaseManager.unshiftNew("PostTurnStatusEffectPhase", p.getBattlerIndex());
      }
    }
    this.end();
  }
}
