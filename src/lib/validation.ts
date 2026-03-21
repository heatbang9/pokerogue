/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

/**
 * Validation utilities for API endpoints
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate username format and length
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== "string") {
    return { valid: false, error: "Username is required" };
  }

  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }

  if (username.length > 20) {
    return { valid: false, error: "Username must be at most 20 characters" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required" };
  }

  if (password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" };
  }

  if (password.length > 100) {
    return { valid: false, error: "Password must be at most 100 characters" };
  }

  return { valid: true };
}

/**
 * Validate save data slot ID
 */
export function validateSlotId(slotId: number): ValidationResult {
  if (typeof slotId !== "number" || !Number.isInteger(slotId)) {
    return { valid: false, error: "Slot ID must be an integer" };
  }

  if (slotId < 0 || slotId > 4) {
    return { valid: false, error: "Slot ID must be between 0 and 4" };
  }

  return { valid: true };
}

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove any potential script tags or HTML
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Validate session token format
 */
export function validateSessionToken(token: string): ValidationResult {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Session token is required" };
  }

  if (token.length !== 64) {
    return { valid: false, error: "Invalid session token format" };
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return { valid: false, error: "Invalid session token format" };
  }

  return { valid: true };
}
