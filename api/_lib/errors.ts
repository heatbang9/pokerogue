/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import type { VercelResponse } from "@vercel/node";

/**
 * Standard API error codes
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  VALIDATION_ERROR = "VALIDATION_ERROR",

  // Server errors (5xx)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
}

/**
 * Standard API error response format
 */
export interface ApiError {
  error: string;
  code: ErrorCode;
  statusCode: number;
  details?: string | undefined;
  timestamp: string;
}

/**
 * Send standardized error response
 */
export function sendError(
  res: VercelResponse,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: string,
): void {
  const errorResponse: ApiError = {
    error: message,
    code,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Predefined error responses
 */
export const Errors = {
  badRequest: (res: VercelResponse, message = "Invalid request", details?: string) =>
    sendError(res, 400, ErrorCode.BAD_REQUEST, message, details),

  unauthorized: (res: VercelResponse, message = "Unauthorized", details?: string) =>
    sendError(res, 401, ErrorCode.UNAUTHORIZED, message, details),

  forbidden: (res: VercelResponse, message = "Forbidden", details?: string) =>
    sendError(res, 403, ErrorCode.FORBIDDEN, message, details),

  notFound: (res: VercelResponse, message = "Resource not found", details?: string) =>
    sendError(res, 404, ErrorCode.NOT_FOUND, message, details),

  conflict: (res: VercelResponse, message = "Resource already exists", details?: string) =>
    sendError(res, 409, ErrorCode.CONFLICT, message, details),

  validationError: (res: VercelResponse, message: string, details?: string) =>
    sendError(res, 422, ErrorCode.VALIDATION_ERROR, message, details),

  internalError: (res: VercelResponse, message = "Internal server error", details?: string) =>
    sendError(res, 500, ErrorCode.INTERNAL_ERROR, message, details),

  databaseError: (res: VercelResponse, message = "Database error", details?: string) =>
    sendError(res, 503, ErrorCode.DATABASE_ERROR, message, details),
};

/**
 * Standard success response format
 */
export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Send standardized success response
 */
export function sendSuccess<T>(res: VercelResponse, data: T, statusCode = 200): void {
  const successResponse: ApiSuccess<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(successResponse);
}
