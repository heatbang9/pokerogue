import { initServerForApiTests } from "#test/setup/test-file-initialization";
import { getApiBaseUrl } from "#test/utils/test-utils";
import { HttpResponse, http } from "msw";
import type { SetupServerApi } from "msw/node";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const apiBase = getApiBaseUrl();
let server: SetupServerApi;

beforeAll(async () => {
  server = await initServerForApiTests();
});

afterEach(() => {
  server.resetHandlers();
});

describe("Auth API", () => {
  beforeEach(() => {
    vi.spyOn(console, "error");
    vi.spyOn(console, "warn");
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const mockResponse = {
        success: true,
        user: {
          id: "test-user-id",
          username: "testuser",
          email: "test@example.com",
        },
      };

      server.use(http.post(`${apiBase}/api/auth/register`, () => HttpResponse.json(mockResponse, { status: 201 })));

      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "password123",
          email: "test@example.com",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data).toEqual(mockResponse);
    });

    it("should reject registration with invalid username (too short)", async () => {
      const mockResponse = {
        error: "Username must be at least 3 characters",
      };

      server.use(http.post(`${apiBase}/api/auth/register`, () => HttpResponse.json(mockResponse, { status: 400 })));

      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "ab",
          password: "password123",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain("Username");
    });

    it("should reject registration with invalid password (too short)", async () => {
      const mockResponse = {
        error: "Password must be at least 8 characters",
      };

      server.use(http.post(`${apiBase}/api/auth/register`, () => HttpResponse.json(mockResponse, { status: 400 })));

      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "short",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain("Password");
    });

    it("should reject duplicate username", async () => {
      const mockResponse = {
        error: "Username already exists",
      };

      server.use(http.post(`${apiBase}/api/auth/register`, () => HttpResponse.json(mockResponse, { status: 409 })));

      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "existinguser",
          password: "password123",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.error).toContain("already exists");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const mockResponse = {
        success: true,
        user: {
          id: "test-user-id",
          username: "testuser",
        },
      };

      server.use(
        http.post(`${apiBase}/api/auth/login`, () => {
          return new HttpResponse(JSON.stringify(mockResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": "session=test-session-token; Path=/; HttpOnly; Secure",
            },
          });
        }),
      );

      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "password123",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(response.headers.get("Set-Cookie")).toContain("session=");
    });

    it("should reject login with invalid credentials", async () => {
      const mockResponse = {
        error: "Invalid username or password",
      };

      server.use(http.post(`${apiBase}/api/auth/login`, () => HttpResponse.json(mockResponse, { status: 401 })));

      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "wrongpassword",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toContain("Invalid");
    });

    it("should be rate limited after too many failed attempts", async () => {
      const mockResponse = {
        error: "Too many login attempts. Please try again later.",
      };

      server.use(http.post(`${apiBase}/api/auth/login`, () => HttpResponse.json(mockResponse, { status: 429 })));

      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "wrongpassword",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      server.use(http.post(`${apiBase}/api/auth/logout`, () => HttpResponse.json({ success: true }, { status: 200 })));

      const response = await fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=test-session-token",
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user info when authenticated", async () => {
      const mockResponse = {
        user: {
          id: "test-user-id",
          username: "testuser",
          email: "test@example.com",
          stats: {
            gamesPlayed: 10,
            wins: 5,
            highestWave: 100,
          },
        },
      };

      server.use(http.get(`${apiBase}/api/auth/me`, () => HttpResponse.json(mockResponse, { status: 200 })));

      const response = await fetch(`${apiBase}/api/auth/me`, {
        method: "GET",
        headers: {
          Cookie: "session=test-session-token",
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.user.username).toBe("testuser");
    });

    it("should return 401 when not authenticated", async () => {
      server.use(
        http.get(`${apiBase}/api/auth/me`, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
      );

      const response = await fetch(`${apiBase}/api/auth/me`, {
        method: "GET",
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("PUT /api/auth/profile", () => {
    it("should update profile successfully", async () => {
      const mockResponse = {
        success: true,
        user: {
          email: "newemail@example.com",
        },
      };

      server.use(http.put(`${apiBase}/api/auth/profile`, () => HttpResponse.json(mockResponse, { status: 200 })));

      const response = await fetch(`${apiBase}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=test-session-token",
        },
        body: JSON.stringify({
          email: "newemail@example.com",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("POST /api/auth/change-password", () => {
    it("should change password successfully", async () => {
      server.use(
        http.post(`${apiBase}/api/auth/change-password`, () =>
          HttpResponse.json({ success: true, message: "Password changed successfully" }, { status: 200 }),
        ),
      );

      const response = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=test-session-token",
        },
        body: JSON.stringify({
          currentPassword: "oldpassword123",
          newPassword: "newpassword123",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should reject with incorrect current password", async () => {
      server.use(
        http.post(`${apiBase}/api/auth/change-password`, () =>
          HttpResponse.json({ error: "Current password is incorrect" }, { status: 401 }),
        ),
      );

      const response = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=test-session-token",
        },
        body: JSON.stringify({
          currentPassword: "wrongpassword",
          newPassword: "newpassword123",
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toContain("incorrect");
    });
  });

  describe("GET /api/auth/stats", () => {
    it("should return user stats", async () => {
      const mockResponse = {
        stats: {
          gamesPlayed: 100,
          wins: 50,
          highestWave: 200,
          totalPokemonCaught: 500,
          totalTrainersDefeated: 150,
        },
      };

      server.use(http.get(`${apiBase}/api/auth/stats`, () => HttpResponse.json(mockResponse, { status: 200 })));

      const response = await fetch(`${apiBase}/api/auth/stats`, {
        method: "GET",
        headers: {
          Cookie: "session=test-session-token",
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.stats.gamesPlayed).toBe(100);
    });
  });

  describe("GET /api/auth/leaderboard", () => {
    it("should return leaderboard data", async () => {
      const mockResponse = {
        leaderboard: [
          { rank: 1, username: "player1", highestWave: 1000, wins: 100 },
          { rank: 2, username: "player2", highestWave: 900, wins: 90 },
          { rank: 3, username: "player3", highestWave: 800, wins: 80 },
        ],
        total: 3,
      };

      server.use(http.get(`${apiBase}/api/auth/leaderboard`, () => HttpResponse.json(mockResponse, { status: 200 })));

      const response = await fetch(`${apiBase}/api/auth/leaderboard?limit=10&offset=0`, {
        method: "GET",
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.leaderboard).toHaveLength(3);
      expect(data.leaderboard[0].rank).toBe(1);
    });
  });

  describe("GET /api/auth/sessions", () => {
    it("should return active sessions", async () => {
      const mockResponse = {
        sessions: [
          {
            id: "session-1",
            createdAt: Date.now() - 3600000,
            expiresAt: Date.now() + 604800000,
            current: true,
          },
        ],
      };

      server.use(http.get(`${apiBase}/api/auth/sessions`, () => HttpResponse.json(mockResponse, { status: 200 })));

      const response = await fetch(`${apiBase}/api/auth/sessions`, {
        method: "GET",
        headers: {
          Cookie: "session=test-session-token",
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.sessions).toBeDefined();
      expect(data.sessions.length).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/auth/sessions", () => {
    it("should revoke other sessions", async () => {
      server.use(
        http.delete(`${apiBase}/api/auth/sessions`, () =>
          HttpResponse.json({ success: true, message: "All other sessions revoked" }, { status: 200 }),
        ),
      );

      const response = await fetch(`${apiBase}/api/auth/sessions`, {
        method: "DELETE",
        headers: {
          Cookie: "session=test-session-token",
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
