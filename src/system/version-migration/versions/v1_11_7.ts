/*
 * SPDX-FileCopyrightText: 2025-2026 Pagefault Games
 * SPDX-FileContributor: heatbang9
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SessionSaveData } from "#types/save-data";
import type { SessionSaveMigrator } from "#types/save-migrators";

/**
 * Mapping of old TrainerType enum values to new values after the trainer type additions in v1.11.7.
 * This accounts for insertions that shifted enum values.
 * @see https://github.com/pagefaultgames/pokerogue/commit/3ac60145eade625caa4ac2dec7fa148663b72bac
 * @see https://github.com/pagefaultgames/pokerogue/commit/fac106196fd07586570dacf583cc21c3df182600
 */
const TRAINER_TYPE_MIGRATION_V1_11_7: Record<number, number> = {
  // ACE_TRAINER (1) stays the same
  // AROMA_LADY (2) is new
  2: 3, // ARTIST
  3: 4, // BACKERS
  4: 5, // BACKPACKER
  5: 6, // BAKER
  6: 7, // BEAUTY
  7: 8, // BIKER
  // BIRD_KEEPER (9) is new
  8: 10, // BLACK_BELT
  9: 11, // BREEDER
  // BUG_CATCHER (12) is new
  // CAMPER (13) is new
  10: 14, // CLERK
  // COLLECTOR (15) is new
  11: 16, // CYCLIST
  12: 17, // DANCER
  13: 18, // DEPOT_AGENT
  14: 19, // DOCTOR
  // DRAGON_TAMER (20) is new
  // FAIRY_TALE_GIRL (21) is new
  15: 22, // FIREBREATHER
  16: 23, // FISHERMAN
  17: 24, // GUITARIST
  18: 25, // HARLEQUIN
  19: 27, // HIKER
  20: 28, // HOOLIGANS
  21: 29, // HOOPSTER
  22: 30, // INFIELDER
  // INTERVIEWERS (31) is new
  23: 32, // JANITOR
  24: 33, // LINEBACKER
  25: 34, // MAID
  26: 35, // MUSICIAN
  27: 26, // HEX_MANIAC (moved before MUSICIAN in new enum)
  // MYSTERIOUS_SISTERS (36) is new
  28: 37, // NURSERY_AIDE
  29: 38, // OFFICER
  30: 39, // PARASOL_LADY
  31: 40, // PILOT
  32: 41, // POKEFAN
  33: 42, // PRESCHOOLER
  34: 43, // PSYCHIC
  35: 44, // RANGER
  36: 45, // RICH
  37: 46, // RICH_KID
  38: 47, // ROUGHNECK
  // RUIN_MANIAC (48) is new
  39: 49, // SAILOR
  40: 50, // SCIENTIST
  // SCUBA_DIVER (51) is new
  41: 52, // SMASHER
  // SNOW_ACE_TRAINER (53) is new
  42: 54, // SNOW_WORKER
  43: 55, // STRIKER
  44: 56, // SCHOOL_KID
  45: 57, // SWIMMER
  46: 58, // TWINS
  47: 59, // VETERAN
  48: 60, // WAITER
  49: 61, // WORKER
  // YOUNG_COUPLE (62) is new
  50: 63, // YOUNGSTER
  // Evil teams start here - values also shifted
  51: 64, // ROCKET_GRUNT
  52: 65, // ARCHER
  53: 66, // ARIANA
  54: 67, // PROTON
  55: 68, // PETREL
  56: 69, // MAGMA_GRUNT
  57: 70, // TABITHA
  58: 71, // COURTNEY
  59: 72, // AQUA_GRUNT
  60: 73, // MATT
  61: 74, // SHELLY
  62: 75, // GALACTIC_GRUNT
  63: 76, // JUPITER
  64: 77, // MARS
  65: 78, // SATURN
  66: 79, // PLASMA_GRUNT
  67: 80, // ZINZOLIN
  68: 81, // COLRESS
  69: 82, // FLARE_GRUNT
  70: 83, // BRYONY
  71: 84, // XEROSIC
  72: 88, // AETHER_GRUNT (shifted by 3 due to ALIANA, CELOSIA, MABLE in 1.11.10)
  73: 89, // FABA
  74: 90, // SKULL_GRUNT
  75: 91, // PLUMERIA
  76: 92, // MACRO_GRUNT
  77: 93, // OLEANA
  // Note: Values >= 200 (Gym Leaders, Elite Four, Champions, Rivals) have explicit values
  // and were not affected by these insertions, except for BEDE_ELITE which was added.
};

/**
 * Migrate trainer types in session save data to account for enum value shifts.
 * This handles the trainer type additions in v1.11.7 (commit 3ac60145, fac10619)
 * and v1.11.10 (commit 8d44608).
 * @param data - {@linkcode SessionSaveData}
 */
const migrateTrainerTypes: SessionSaveMigrator = {
  version: "1.11.7",
  migrate: (data: SessionSaveData): void => {
    if (data.trainer?.trainerType !== undefined && data.trainer.trainerType !== null) {
      const oldType = data.trainer.trainerType;
      const newType = TRAINER_TYPE_MIGRATION_V1_11_7[oldType];
      if (newType !== undefined) {
        data.trainer.trainerType = newType;
      }
    }
  },
};

export const sessionMigrators: readonly SessionSaveMigrator[] = [migrateTrainerTypes] as const;

// No system or settings migrators needed for this version
export const systemMigrators: readonly never[] = [] as const;
export const settingsMigrators: readonly never[] = [] as const;
