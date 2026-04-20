import {
  RiDownloadCloud2Line,
  RiFlashlightLine,
  RiLinksLine,
  RiShieldCheckLine,
} from "@remixicon/react"

export function DesktopTabPage() {
  return (
    <div className="max-w-4xl gap-8 p-4 md:p-6 lg:p-8 mx-auto flex w-full flex-col">
      <div className="gap-2 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Desktop Tracker
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          The ultimate companion app for your Delta Force stash tracking.
        </p>
      </div>

      <div className="gap-6 md:grid-cols-2 grid">
        <div className="gap-4 border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col overflow-hidden rounded-xl border">
          <h2 className="text-xl font-semibold">Showcase</h2>
          <img
            src="https://raw.githubusercontent.com/siyamhosan/DeltaForcePorfitTracker/main/imgs/desktop.png"
            alt="Desktop Tracker"
            className="border-zinc-200 shadow-sm dark:border-zinc-800 rounded-lg border"
          />
          <img
            src="https://raw.githubusercontent.com/siyamhosan/DeltaForcePorfitTracker/main/imgs/deskstop_idel.png"
            alt="Desktop Tracker Idle"
            className="mt-2 border-zinc-200 shadow-sm dark:border-zinc-800 rounded-lg border"
          />
        </div>

        <div className="gap-6 flex flex-col">
          <div className="gap-4 border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col rounded-xl border">
            <h2 className="text-xl font-semibold">Benefits</h2>
            <ul className="gap-3 text-zinc-600 dark:text-zinc-300 flex flex-col">
              <li className="gap-3 flex items-start">
                <span className="h-8 w-8 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex shrink-0 items-center justify-center rounded-full">
                  <RiShieldCheckLine className="h-4 w-4" />
                </span>
                <span className="mt-1 text-sm">
                  <strong className="text-zinc-900 dark:text-zinc-50">
                    Lightweight & Non-Invasive:
                  </strong>{" "}
                  Runs quietly in the background without reading game memory. No
                  ban risk.
                </span>
              </li>
              <li className="gap-3 flex items-start">
                <span className="h-8 w-8 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex shrink-0 items-center justify-center rounded-full">
                  <RiFlashlightLine className="h-4 w-4" />
                </span>
                <span className="mt-1 text-sm">
                  <strong className="text-zinc-900 dark:text-zinc-50">
                    Hotkey Capture:
                  </strong>{" "}
                  Instantly capture and upload your stash screenshots without
                  alt-tabbing out of the game.
                </span>
              </li>
              <li className="gap-3 flex items-start">
                <span className="h-8 w-8 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex shrink-0 items-center justify-center rounded-full">
                  <RiLinksLine className="h-4 w-4" />
                </span>
                <span className="mt-1 text-sm">
                  <strong className="text-zinc-900 dark:text-zinc-50">
                    Seamless Sync:
                  </strong>{" "}
                  Automatically links with your web dashboard account to sync
                  your stash history and profits.
                </span>
              </li>
            </ul>
          </div>

          <div className="gap-4 border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col rounded-xl border">
            <h2 className="text-xl font-semibold">Downloads</h2>
            <div className="gap-3 flex flex-col">
              <a
                href="https://github.com/siyamhosan/DeltaForcePorfitTracker/releases/download/v0.1.0/Delta.Force.Desktop.Tracker_0.1.0_x64-setup.exe"
                className="gap-2 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 flex items-center rounded-lg"
                target="_blank"
                rel="noreferrer"
              >
                <RiDownloadCloud2Line className="h-4 w-4" />
                Download Setup (.exe)
              </a>
              <a
                href="https://github.com/siyamhosan/DeltaForcePorfitTracker/releases/download/v0.1.0/Delta.Force.Desktop.Tracker_0.1.0_x64_en-US.msi"
                className="gap-2 border-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 flex items-center justify-center rounded-lg border"
                target="_blank"
                rel="noreferrer"
              >
                <RiDownloadCloud2Line className="h-4 w-4" />
                Download Installer (.msi)
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 gap-4 border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col rounded-xl border">
        <h2 className="text-2xl font-semibold">How to Setup</h2>
        <div className="mt-2 gap-6 sm:grid-cols-2 md:grid-cols-4 grid">
          <div className="gap-2 flex flex-col">
            <div className="h-10 w-10 bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 flex items-center justify-center rounded-full">
              1
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Download
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Download and install the desktop tracker using the links above.
            </p>
          </div>
          <div className="gap-2 flex flex-col">
            <div className="h-10 w-10 bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 flex items-center justify-center rounded-full">
              2
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Link Account
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Open the app and click 'Connect' to securely link it with your web
              dashboard.
            </p>
          </div>
          <div className="gap-2 flex flex-col">
            <div className="h-10 w-10 bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 flex items-center justify-center rounded-full">
              3
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Setup Hotkey
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Configure your preferred hotkey in the settings for quick capture.
            </p>
          </div>
          <div className="gap-2 flex flex-col">
            <div className="h-10 w-10 bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 flex items-center justify-center rounded-full">
              4
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Capture & Track
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Press the hotkey in-game to instantly grab your stash value and
              start tracking!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
