/*
 * SPDX-FileCopyrightText: 2024-2025 Pagefault Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getFusedSpeciesName } from "#utils/pokemon-utils";
import { describe, expect, it } from "vitest";

describe("getFusedSpeciesName", () => {
  it("should handle non-English characters at the start of fusion names (Issue #6979)", () => {
    // Élekable (Electivire) - É should NOT be trimmed
    const result = getFusedSpeciesName("Élekable", "Electivire");
    expect(result).toMatch(/^Élec/i); // Should start with Élec (not lec)
    expect(result).not.toMatch(/^leka/i); // Should NOT start with trimmed version
  });

  it("should handle accentuated characters in names", () => {
    // Flabébé - the 'é' should be recognized as a vowel by the pattern
    // The fusion takes "Fla" from Flabébé (up to first vowel 'a') and "ssom" from Bellossom
    const result = getFusedSpeciesName("Flabébé", "Bellossom");
    expect(result).toBe("Flassom"); // Fla + ssom
  });

  it("should handle normal fusion names correctly", () => {
    const result = getFusedSpeciesName("Bulbasaur", "Ivysaur");
    expect(result).toMatch(/Bulba/i);
    expect(result).toMatch(/saur/i);
  });

  it("should handle names with hyphens and apostrophes", () => {
    const result = getFusedSpeciesName("Farfetch'd", "Spearow");
    expect(result).toMatch(/Far/i);
  });
});
