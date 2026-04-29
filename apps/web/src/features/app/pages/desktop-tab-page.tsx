import {
  RiDownloadCloud2Line,
  RiFlashlightLine,
  RiLinksLine,
  RiShieldCheckLine,
} from "@remixicon/react"

export function DesktopTabPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Desktop Tracker
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          The ultimate companion app for your Delta Force stash tracking.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xl font-semibold">Showcase</h2>
          <img
            src="https://raw.githubusercontent.com/siyamhosan/DeltaForcePorfitTracker/main/imgs/desktop.png"
            alt="Desktop Tracker"
            className="rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-800"
          />
          <img
            src="https://raw.githubusercontent.com/siyamhosan/DeltaForcePorfitTracker/main/imgs/deskstop_idel.png"
            alt="Desktop Tracker Idle"
            className="mt-2 rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-800"
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xl font-semibold">Benefits</h2>
            <ul className="flex flex-col gap-3 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
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
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
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
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
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

          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xl font-semibold">Downloads</h2>
            <div className="flex flex-col gap-3">
              <a
                href="https://github.com/siyamhosan/DeltaForceProfitTracker/releases/download/v0.1.0/Delta.Force.Desktop.Tracker_0.1.0_x64-setup.exe"
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90"
                target="_blank"
                rel="noreferrer"
              >
                <RiDownloadCloud2Line className="h-4 w-4" />
                Download Setup (.exe)
              </a>
              <a
                href="https://github.com/siyamhosan/DeltaForceProfitTracker/releases/download/v0.1.0/Delta.Force.Desktop.Tracker_0.1.0_x64_en-US.msi"
                className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
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

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-2xl font-semibold">How to Setup</h2>
        <div className="mt-2 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
              1
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Download
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Download and install the desktop tracker using the links above.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
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
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
              3
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Setup Hotkey
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Configure your preferred hotkey in the settings for quick capture.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
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
