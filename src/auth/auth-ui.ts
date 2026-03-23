// Auth UI Component for PokeRogue

export interface AuthUser {
  id: string;
  username: string;
  stats?: {
    gamesPlayed: number;
    wins: number;
    highestWave: number;
  };
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
        <span style="color: white;">👤 ${this.currentUser.username}</span>
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
}

// Singleton instance
let authInstance: AuthUI | null = null;

export function getAuth(): AuthUI {
  if (!authInstance) {
    authInstance = new AuthUI();
  }
  return authInstance;
}
