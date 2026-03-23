import { allMoves } from "#data/data-lists";
import { MoveId } from "#enums/move-id";
import { PokemonType } from "#enums/pokemon-type";
import { describe, expect, it } from "vitest";

describe("Fixed damage moves should not benefit from type boosters", () => {
  it("Counter should have FixedDamageAttr", () => {
    const counter = allMoves[MoveId.COUNTER];
    expect(counter).toBeDefined();
    expect(counter.hasAttr("FixedDamageAttr")).toBe(true);
  });

  it("Night Shade should have FixedDamageAttr", () => {
    const nightShade = allMoves[MoveId.NIGHT_SHADE];
    expect(nightShade).toBeDefined();
    expect(nightShade.hasAttr("FixedDamageAttr")).toBe(true);
  });

  it("Seismic Toss should have FixedDamageAttr", () => {
    const seismicToss = allMoves[MoveId.SEISMIC_TOSS];
    expect(seismicToss).toBeDefined();
    expect(seismicToss.hasAttr("FixedDamageAttr")).toBe(true);
  });

  it("Dragon Rage should have FixedDamageAttr", () => {
    const dragonRage = allMoves[MoveId.DRAGON_RAGE];
    expect(dragonRage).toBeDefined();
    expect(dragonRage.hasAttr("FixedDamageAttr")).toBe(true);
  });

  it("Brick Break should NOT have FixedDamageAttr", () => {
    const brickBreak = allMoves[MoveId.BRICK_BREAK];
    expect(brickBreak).toBeDefined();
    expect(brickBreak.hasAttr("FixedDamageAttr")).toBe(false);
  });

  it("Shadow Ball should NOT have FixedDamageAttr", () => {
    const shadowBall = allMoves[MoveId.SHADOW_BALL];
    expect(shadowBall).toBeDefined();
    expect(shadowBall.hasAttr("FixedDamageAttr")).toBe(false);
  });

  it("Counter should be an AttackMove", () => {
    const counter = allMoves[MoveId.COUNTER];
    expect(counter.is("AttackMove")).toBe(true);
  });

  it("Brick Break should be an AttackMove", () => {
    const brickBreak = allMoves[MoveId.BRICK_BREAK];
    expect(brickBreak.is("AttackMove")).toBe(true);
  });

  it("Fixed damage moves should have the correct type", () => {
    const counter = allMoves[MoveId.COUNTER];
    expect(counter.type).toBe(PokemonType.FIGHTING);

    const nightShade = allMoves[MoveId.NIGHT_SHADE];
    expect(nightShade.type).toBe(PokemonType.GHOST);

    const dragonRage = allMoves[MoveId.DRAGON_RAGE];
    expect(dragonRage.type).toBe(PokemonType.DRAGON);
  });
});
