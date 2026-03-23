import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { UiMode } from "#enums/ui-mode";
import { fixedInt } from "#utils/common";

export class ReloadSessionPhase extends Phase {
  public readonly phaseName = "ReloadSessionPhase";
  private readonly systemDataStr?: string | undefined;

  constructor(systemDataStr?: string) {
    super();

    this.systemDataStr = systemDataStr;
  }

  start(): void {
    globalScene.ui.setMode(UiMode.SESSION_RELOAD);

    // Show a brief message before reloading
    console.log("[ReloadSession] Session out of date detected. Reloading data from server...");

    let delayElapsed = false;
    let loaded = false;

    globalScene.time.delayedCall(fixedInt(1500), () => {
      if (loaded) {
        this.end();
      } else {
        delayElapsed = true;
      }
    });

    globalScene.gameData.clearLocalData();

    (this.systemDataStr ? globalScene.gameData.initSystem(this.systemDataStr) : globalScene.gameData.loadSystem()).then(
      () => {
        console.log("[ReloadSession] Session data reloaded successfully");
        // Restart periodic session check after reload
        globalScene.gameData.startPeriodicSessionCheck();

        if (delayElapsed) {
          this.end();
        } else {
          loaded = true;
        }
      },
    );
  }
}
