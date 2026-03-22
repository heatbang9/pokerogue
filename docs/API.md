<!--
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
-->

# PokéRogue API Documentation

## Overview

This document describes the REST API endpoints available for PokéRogue. The API is built on Vercel serverless functions and uses Upstash Redis for data persistence.

**Base URL:** `https://your-domain.vercel.app/api`

## Authentication

Most endpoints require authentication via a session token. Include the token in the `Authorization` header:

```
Authorization: <your-session-token>
```

Session tokens are obtained through the `/account/login` endpoint.

---

## Account Endpoints

### Register New Account

**POST** `/account/register`

Create a new user account.

**Request Body:**
```json
{
  "username": "string (3-20 chars, alphanumeric + underscore)",
  "password": "string (6-100 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Account created successfully",
    "username": "string"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Invalid request body
- 422: Validation error (username/password format)
- 409: Username already exists
- 500: Internal server error

---

### Login

**POST** `/account/login`

Authenticate and obtain a session token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "string (64 hex chars)",
    "username": "string",
    "message": "Login successful"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Missing username or password
- 401: Invalid credentials
- 500: Internal server error

---

### Get Profile

**GET** `/account/profile`

Get current user's profile information.

**Headers:**
```
Authorization: <session-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "username": "string",
    "createdAt": "number (timestamp)",
    "lastSessionSlot": "number",
    "hasAdminRole": "boolean"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 401: Unauthorized
- 404: User not found
- 500: Internal server error

---

### Change Password

**POST** `/account/changepw`

Change user's password.

**Headers:**
```
Authorization: <session-token>
```

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (6-100 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Missing passwords
- 401: Invalid current password
- 422: New password validation failed
- 500: Internal server error

---

### Logout

**POST** `/account/logout`

Invalidate current session.

**Headers:**
```
Authorization: <session-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 401: Unauthorized
- 500: Internal server error

---

### Delete Account

**POST** `/account/delete`

Delete user account and all associated data.

**Headers:**
```
Authorization: <session-token>
```

**Request Body:**
```json
{
  "password": "string (confirmation)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Account deleted successfully",
    "username": "string"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Missing password confirmation
- 401: Invalid password
- 404: User not found
- 500: Internal server error

---

## Save Data Endpoints

### Get System Save Data

**GET** `/savedata/system/get`

Retrieve system save data.

**Headers:**
```
Authorization: <session-token>
```

**Response:**
Raw save data string (format depends on game implementation)

**Error Codes:**
- 401: Unauthorized
- 404: No save data found
- 500: Internal server error

---

### Update System Save Data

**POST** `/savedata/system/update`

Update system save data.

**Headers:**
```
Authorization: <session-token>
```

**Request Body:**
Raw save data string

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Save data updated successfully"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 401: Unauthorized
- 500: Internal server error

---

### Get Session Save Data

**GET** `/savedata/session/get?slotId=<number>`

Retrieve session save data for specific slot.

**Headers:**
```
Authorization: <session-token>
```

**Query Parameters:**
- `slotId`: Save slot number (0-4)

**Response:**
Raw save data string

**Error Codes:**
- 400: Invalid slot ID
- 401: Unauthorized
- 404: No save data found
- 500: Internal server error

---

### Update Session Save Data

**POST** `/savedata/session/update?slotId=<number>`

Update session save data for specific slot.

**Headers:**
```
Authorization: <session-token>
```

**Query Parameters:**
- `slotId`: Save slot number (0-4)

**Request Body:**
Raw save data string

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Session data updated successfully"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Invalid slot ID
- 401: Unauthorized
- 500: Internal server error

---

### Delete Session Save Data

**DELETE** `/savedata/session/delete?slotId=<number>`

Delete session save data for specific slot.

**Headers:**
```
Authorization: <session-token>
```

**Query Parameters:**
- `slotId`: Save slot number (0-4)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Session data deleted successfully"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Invalid slot ID
- 401: Unauthorized
- 500: Internal server error

---

## Game Endpoints

### Get Game Statistics

**GET** `/game/stats`

Get overall game statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPlayers": "number",
    "totalBattles": "number",
    "totalPlayTime": "number",
    "lastUpdated": "number (timestamp)"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 500: Internal server error

---

### Get Leaderboard

**GET** `/game/leaderboard?type=<string>&limit=<number>`

Get leaderboard entries.

**Query Parameters:**
- `type`: Leaderboard type (`wins`, `streak`, `time`)
- `limit`: Number of entries to return (1-100, default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "string",
    "entries": [
      {
        "rank": "number",
        "username": "string",
        "value": "number",
        "timestamp": "number"
      }
    ],
    "total": "number",
    "lastUpdated": "number (timestamp)"
  },
  "timestamp": "ISO 8601 date"
}
```

**Error Codes:**
- 400: Invalid type or limit
- 500: Internal server error

---

## Utility Endpoints

### Health Check

**GET** `/ping`

Simple health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "PokeRogue API is working!",
    "timestamp": "ISO 8601 date"
  }
}
```

---

## Error Response Format

All errors follow a standard format:

```json
{
  "error": "string (human-readable message)",
  "code": "string (error code enum)",
  "statusCode": "number (HTTP status code)",
  "details": "string? (optional additional info)",
  "timestamp": "ISO 8601 date"
}
```

### Error Codes

- `BAD_REQUEST`: Invalid request (400)
- `UNAUTHORIZED`: Authentication required (401)
- `FORBIDDEN`: Permission denied (403)
- `NOT_FOUND`: Resource not found (404)
- `CONFLICT`: Resource already exists (409)
- `VALIDATION_ERROR`: Input validation failed (422)
- `INTERNAL_ERROR`: Server error (500)
- `DATABASE_ERROR`: Database operation failed (503)

---

## Rate Limiting

Currently not implemented. Consider adding rate limiting for production use.

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Authorization, Content-Type`

## Security Considerations

1. **Passwords**: Hashed with SHA-256 + salt
2. **Session Tokens**: 64-character hex tokens (32 random bytes)
3. **Session Expiry**: 30 days default TTL
4. **Input Validation**: All inputs are validated and sanitized
5. **Sensitive Data**: Passwords and salts are never returned in API responses

---

## Development

### Running Locally

```bash
pnpm install
pnpm start:dev
```

API will be available at `http://localhost:8000/api`

### Testing

```bash
pnpm test
```

### Environment Variables

Required for production:
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis authentication token

---

## License

AGPL-3.0-only - See LICENSE file for details.
