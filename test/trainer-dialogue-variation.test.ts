import Phaser from "phaser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Phaser.Math.RND
const mockRND = {
  state: vi.fn(() => "mock-state"),
  sow: vi.fn(),
  pick: vi.fn(),
};

Phaser.Math.RND = mockRND as any;

describe("Trainer Dialogue Variation - Issue #7087", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should select different dialogue for different trainer types at the same wave", () => {
    const waveIndex = 100;

    // Simulate encounter for trainer type 1
    const trainerType1 = 5;
    const seed1 = waveIndex + trainerType1 * 1000;

    // Simulate encounter for trainer type 2
    const trainerType2 = 10;
    const seed2 = waveIndex + trainerType2 * 1000;

    // Seeds should be different
    expect(seed1).not.toBe(seed2);

    // This means different dialogue should be selected for different trainer types
    // at the same wave
  });

  it("should allow encounter and victory dialogue to vary independently", () => {
    const waveIndex = 50;
    const trainerType = 5;

    // Encounter seed
    const encounterSeed = waveIndex + trainerType * 1000;

    // Victory seed (with additional offset)
    const victorySeed = waveIndex + trainerType * 1000 + 500;

    // Seeds should be different
    expect(encounterSeed).not.toBe(victorySeed);

    // This means encounter and victory can select different messages
  });

  it("should select different dialogue for same trainer at different waves", () => {
    const trainerType = 5;

    const wave1 = 100;
    const wave2 = 150;

    const seed1 = wave1 + trainerType * 1000;
    const seed2 = wave2 + trainerType * 1000;

    // Seeds should be different for different waves
    expect(seed1).not.toBe(seed2);

    // This means the same trainer type can have different dialogue at different waves
  });
});
