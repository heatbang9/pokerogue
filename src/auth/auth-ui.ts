// Auth UI Component for PokeRogue

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  discordId?: string | null;
  googleId?: string | null;
  createdAt?: number;
  lastLogin?: number;
  stats?: {
    gamesPlayed: number;
    wins: number;
    highestWave: number;
    totalPokemonCaught?: number;
    totalTrainersDefeated?: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
}

export class AuthUI {
  private container: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private currentUser: AuthUser | null = null;
  private onAuthChange: ((user: AuthUser | null) => void) | null = null;

  constructor() {
    this.checkSession();
  }

  setOnAuthChange(callback: (user: AuthUser | null) => void) {
    this.onAuthChange = callback;
  }

  async checkSession(): Promise<AuthUser | null> {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        return this.currentUser;
      }
    } catch (error) {
      console.error("Session check failed:", error);
    }
    return null;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  showLoginModal() {
    this.createModal("login");
  }

  showRegisterModal() {
    this.createModal("register");
  }

  hideModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  private createModal(type: "login" | "register") {
    this.hideModal();

    const overlay = document.createElement("div");
    overlay.id = "auth-modal-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #e94560;
      border-radius: 16px;
      padding: 32px;
      width: 90%;
      max-width: 400px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const isLogin = type === "login";
    modal.innerHTML = `
      <h2 style="margin: 0 0 24px; text-align: center; font-size: 24px; color: #e94560;">
        ${isLogin ? "🎮 Login" : "📝 Register"}
      </h2>
      <form id="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
        <input
          type="text"
          id="auth-username"
          placeholder="Username"
          autocomplete="username"
          style="
            padding: 12px 16px;
            border: 2px solid #4a90a4;
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 16px;
            outline: none;
          "
        />
        ${
          isLogin
            ? ""
            : `
          <input
            type="email"
            id="auth-email"
            placeholder="Email (optional)"
            autocomplete="email"
            style="
              padding: 12px 16px;
              border: 2px solid #4a90a4;
              border-radius: 8px;
              background: rgba(255,255,255,0.1);
              color: white;
              font-size: 16px;
              outline: none;
            "
          />
        `
        }
        <input
          type="password"
          id="auth-password"
          placeholder="Password"
          autocomplete="${isLogin ? "current-password" : "new-password"}"
          style="
            padding: 12px 16px;
            border: 2px solid #4a90a4;
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 16px;
            outline: none;
          "
        />
        ${
          isLogin
            ? ""
            : `
          <input
            type="password"
            id="auth-password-confirm"
            placeholder="Confirm Password"
            autocomplete="new-password"
            style="
              padding: 12px 16px;
              border: 2px solid #4a90a4;
              border-radius: 8px;
              background: rgba(255,255,255,0.1);
              color: white;
              font-size: 16px;
              outline: none;
            "
          />
        `
        }
        <div id="auth-error" style="color: #ff6b6b; font-size: 14px; text-align: center; display: none;"></div>
        <button
          type="submit"
          style="
            padding: 14px;
            background: linear-gradient(90deg, #e94560, #f39c12);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
          "
        >
          ${isLogin ? "Login" : "Create Account"}
        </button>
      </form>
      <p style="text-align: center; margin-top: 16px; color: #aaa;">
        ${isLogin ? "Don't have an account? " : "Already have an account? "}
        <a href="#" id="auth-switch" style="color: #e94560; text-decoration: none;">
          ${isLogin ? "Register" : "Login"}
        </a>
      </p>
      <button
        id="auth-close"
        style="
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: #aaa;
          font-size: 24px;
          cursor: pointer;
        "
      >×</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modal = overlay;

    // Event listeners
    const form = modal.querySelector("#auth-form") as HTMLFormElement;
    const switchLink = modal.querySelector("#auth-switch") as HTMLAnchorElement;
    const closeBtn = modal.querySelector("#auth-close") as HTMLButtonElement;
    const errorDiv = modal.querySelector("#auth-error") as HTMLDivElement;

    form.addEventListener("submit", async e => {
      e.preventDefault();
      errorDiv.style.display = "none";

      const username = (modal.querySelector("#auth-username") as HTMLInputElement).value;
      const password = (modal.querySelector("#auth-password") as HTMLInputElement).value;

      if (!username || !password) {
        errorDiv.textContent = "Please fill in all fields";
        errorDiv.style.display = "block";
        return;
      }

      if (!isLogin) {
        const passwordConfirm = (modal.querySelector("#auth-password-confirm") as HTMLInputElement).value;
        if (password !== passwordConfirm) {
          errorDiv.textContent = "Passwords do not match";
          errorDiv.style.display = "block";
          return;
        }
      }

      try {
        const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
        const body: any = { username, password };

        if (!isLogin) {
          const email = (modal.querySelector("#auth-email") as HTMLInputElement).value;
          if (email) {
            body.email = email;
          }
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok) {
          this.currentUser = data.user;
          this.hideModal();
          if (this.onAuthChange) {
            this.onAuthChange(this.currentUser);
          }
        } else {
          errorDiv.textContent = data.error || "An error occurred";
          errorDiv.style.display = "block";
        }
      } catch (_error) {
        errorDiv.textContent = "Network error. Please try again.";
        errorDiv.style.display = "block";
      }
    });

    switchLink.addEventListener("click", e => {
      e.preventDefault();
      this.createModal(isLogin ? "register" : "login");
    });

    closeBtn.addEventListener("click", () => this.hideModal());
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        this.hideModal();
      }
    });
  }

  async logout(): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        this.currentUser = null;
        if (this.onAuthChange) {
          this.onAuthChange(null);
        }
        return true;
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
    return false;
  }

  createAuthButton(container: HTMLElement) {
    this.container = container;
    this.updateAuthButton();
  }

  updateAuthButton() {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = "";

    if (this.currentUser) {
      // User info + logout
      const userInfo = document.createElement("div");
      userInfo.style.cssText = "display: flex; align-items: center; gap: 12px;";
      userInfo.innerHTML = `
        <span style="color: white; cursor: pointer;" id="username-display">👤 ${this.currentUser.username}</span>
        <button id="logout-btn" style="
          padding: 8px 16px;
          background: #4a90a4;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        ">Logout</button>
      `;
      this.container.appendChild(userInfo);

      userInfo.querySelector("#logout-btn")?.addEventListener("click", () => this.logout());
      userInfo.querySelector("#username-display")?.addEventListener("click", () => this.showProfileModal());
    } else {
      // Login/Register buttons
      const buttons = document.createElement("div");
      buttons.style.cssText = "display: flex; gap: 8px;";
      buttons.innerHTML = `
        <button id="login-btn" style="
          padding: 8px 16px;
          background: #4a90a4;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        ">Login</button>
        <button id="register-btn" style="
          padding: 8px 16px;
          background: linear-gradient(90deg, #e94560, #f39c12);
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        ">Register</button>
      `;
      this.container.appendChild(buttons);

      buttons.querySelector("#login-btn")?.addEventListener("click", () => this.showLoginModal());
      buttons.querySelector("#register-btn")?.addEventListener("click", () => this.showRegisterModal());
    }
  }

  async getProfile(): Promise<AuthUser | null> {
    try {
      const response = await fetch("/api/auth/profile", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        return this.currentUser;
      }
    } catch (error) {
      console.error("Profile fetch failed:", error);
    }
    return null;
  }

  async updateProfile(updates: { username?: string; email?: string }): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        this.updateAuthButton();
        return true;
      }
    } catch (error) {
      console.error("Profile update failed:", error);
    }
    return false;
  }

  async updateStats(stats: {
    wave?: number;
    win?: boolean;
    pokemonCaught?: number;
    trainersDefeated?: number;
  }): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(stats),
      });

      if (response.ok) {
        const data = await response.json();
        if (this.currentUser) {
          this.currentUser.stats = data.stats;
        }
        return true;
      }
    } catch (error) {
      console.error("Stats update failed:", error);
    }
    return false;
  }

  async getLeaderboard(type: "alltime" | "daily" | "wins" = "alltime", limit = 10): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(`/api/auth/leaderboard?type=${type}&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        return data.leaderboard;
      }
    } catch (error) {
      console.error("Leaderboard fetch failed:", error);
    }
    return [];
  }

  showProfileModal() {
    if (!this.currentUser) {
      return;
    }

    this.hideModal();

    const overlay = document.createElement("div");
    overlay.id = "auth-modal-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #e94560;
      border-radius: 16px;
      padding: 32px;
      width: 90%;
      max-width: 500px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const stats = this.currentUser.stats || { gamesPlayed: 0, wins: 0, highestWave: 0 };
    const winRate = stats.gamesPlayed > 0 ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) : "0.0";

    modal.innerHTML = `
      <h2 style="margin: 0 0 24px; text-align: center; font-size: 24px; color: #e94560;">
        🎮 ${this.currentUser.username}'s Profile
      </h2>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #4a90a4;">${stats.gamesPlayed}</div>
          <div style="font-size: 12px; color: #aaa;">Games Played</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #4a90a4;">${stats.wins}</div>
          <div style="font-size: 12px; color: #aaa;">Wins</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #f39c12;">${stats.highestWave}</div>
          <div style="font-size: 12px; color: #aaa;">Highest Wave</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #f39c12;">${winRate}%</div>
          <div style="font-size: 12px; color: #aaa;">Win Rate</div>
        </div>
      </div>

      ${
        stats.totalPokemonCaught
          ? `
      <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
        <div style="font-size: 20px; color: #4a90a4;">🐟 ${stats.totalPokemonCaught} Pokemon Caught</div>
        <div style="font-size: 20px; color: #4a90a4; margin-top: 8px;">⚔️ ${stats.totalTrainersDefeated || 0} Trainers Defeated</div>
      </div>
      `
          : ""
      }

      <div style="text-align: center;">
        <button id="leaderboard-btn" style="
          padding: 12px 24px;
          background: #4a90a4;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 16px;
          cursor: pointer;
          margin-right: 8px;
        ">🏆 Leaderboard</button>
        <button id="close-profile" style="
          padding: 12px 24px;
          background: #555;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 16px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modal = overlay;

    modal.querySelector("#close-profile")?.addEventListener("click", () => this.hideModal());
    modal.querySelector("#leaderboard-btn")?.addEventListener("click", () => {
      this.hideModal();
      this.showLeaderboardModal();
    });
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        this.hideModal();
      }
    });
  }

  async showLeaderboardModal() {
    this.hideModal();

    const overlay = document.createElement("div");
    overlay.id = "auth-modal-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #e94560;
      border-radius: 16px;
      padding: 32px;
      width: 90%;
      max-width: 500px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-height: 80vh;
      overflow-y: auto;
    `;

    modal.innerHTML = `
      <h2 style="margin: 0 0 24px; text-align: center; font-size: 24px; color: #e94560;">
        🏆 Leaderboard
      </h2>
      
      <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 24px;">
        <button class="lb-tab" data-type="alltime" style="
          padding: 8px 16px;
          background: #4a90a4;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        ">All Time</button>
        <button class="lb-tab" data-type="daily" style="
          padding: 8px 16px;
          background: #555;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        ">Daily</button>
        <button class="lb-tab" data-type="wins" style="
          padding: 8px 16px;
          background: #555;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        ">Wins</button>
      </div>

      <div id="leaderboard-content" style="min-height: 200px;">
        <div style="text-align: center; color: #aaa;">Loading...</div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <button id="close-leaderboard" style="
          padding: 12px 24px;
          background: #555;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 16px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modal = overlay;

    const loadLeaderboard = async (type: "alltime" | "daily" | "wins") => {
      const content = modal.querySelector("#leaderboard-content") as HTMLDivElement;
      const entries = await this.getLeaderboard(type, 10);

      if (entries.length === 0) {
        content.innerHTML = `<div style="text-align: center; color: #aaa;">No entries yet. Be the first!</div>`;
        return;
      }

      content.innerHTML = entries
        .map((entry, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${entry.rank}.`;
          const isCurrentUser = this.currentUser && entry.username === this.currentUser.username;
          return `
          <div style="
            display: flex;
            justify-content: space-between;
            padding: 12px;
            background: ${isCurrentUser ? "rgba(233, 69, 96, 0.2)" : "rgba(255,255,255,0.05)"};
            border-radius: 8px;
            margin-bottom: 8px;
          ">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 30px;">${medal}</span>
              <span style="${isCurrentUser ? "color: #e94560; font-weight: bold;" : ""}">${entry.username}</span>
            </span>
            <span style="color: #f39c12; font-weight: bold;">${entry.score}</span>
          </div>
        `;
        })
        .join("");
    };

    // Load initial leaderboard
    loadLeaderboard("alltime");

    // Tab switching
    modal.querySelectorAll(".lb-tab").forEach(btn => {
      btn.addEventListener("click", e => {
        const target = e.target as HTMLButtonElement;
        const type = target.dataset.type as "alltime" | "daily" | "wins";

        // Update tab styles
        modal.querySelectorAll(".lb-tab").forEach(b => {
          (b as HTMLButtonElement).style.background = "#555";
        });
        target.style.background = "#4a90a4";

        loadLeaderboard(type);
      });
    });

    modal.querySelector("#close-leaderboard")?.addEventListener("click", () => this.hideModal());
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        this.hideModal();
      }
    });
  }
}

// Singleton instance
let authInstance: AuthUI | null = null;

export function getAuth(): AuthUI {
  if (!authInstance) {
    authInstance = new AuthUI();
  }
  return authInstance;
}
