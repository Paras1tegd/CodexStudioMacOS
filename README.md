# Codex Studio

A local macOS app with a real Codex CLI terminal, independent zsh sidebar, four color themes, text sizing, multiple Codex sessions, and a workspace folder picker.

Open `~/Applications/Codex Studio.app`. Your existing Codex CLI installation and login are used. This is a separate Codex conversation, not a continuation of the ChatGPT window.

## Install

There is currently no published binary release. Follow the source installation steps below. If you already received a `CodexStudioMacOS.zip` app bundle, install the dependencies first, then follow **Install from an app ZIP**.

### Dependencies

| Dependency | Needed for | Installation |
| --- | --- | --- |
| macOS | Running the native app | The app declares macOS 13 or later; the Homebrew route below is supported on macOS 15 or later. Dependency and compiler requirements may be higher than the app's declared minimum. |
| Apple Command Line Tools | Swift compiler, Git, and the `/usr/bin/python3` interpreter used by the app | Step 1 below. Full Xcode is not required. |
| Homebrew | Installing the CLI tools in this guide | Step 2 below. Optional if you install those tools another way. |
| Codex CLI and your own sign-in | The main Codex terminal | Step 3 below. |
| GitHub CLI (`gh`) and your own GitHub sign-in | Optional GitHub account controls and contribution widget | Step 4 below. |

The terminal renderer and its licenses are bundled. No separate Node.js, npm, pip packages, Playwright, or xterm.js installation is needed for this Homebrew setup. An internet connection is needed to install dependencies and use online Codex/GitHub features.

### 1. Install Apple's Command Line Tools

Open **Terminal** (Applications → Utilities) and run:

```sh
xcode-select --install
```

Complete the installer before continuing. If the tools are already installed, skip the installation. Check them with:

```sh
xcrun swiftc --version
git --version
/usr/bin/python3 --version
```

The app specifically launches `/usr/bin/python3`; a separate Homebrew Python installation does not replace that requirement. See [Apple's Command Line Tools instructions](https://developer.apple.com/documentation/xcode/installing-the-command-line-tools/).

### 2. Install Homebrew

If `brew --version` already works, skip this step. Otherwise follow the installer at [brew.sh](https://brew.sh/):

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the installer's **Next steps**, including its commands to add Homebrew to your shell environment. Open a new Terminal window and check:

```sh
brew --version
```

Homebrew currently supports macOS 15 and newer. On older macOS versions, use compatible tools from their official distributions; this guide does not establish compatibility for every older system.

### 3. Install Codex CLI and sign in

Install the [Codex Homebrew package](https://formulae.brew.sh/cask/codex):

```sh
brew install --cask codex
codex --version
codex
```

Complete the sign-in prompts using your own account, then exit the CLI with `/quit`. If you already use Codex CLI, keep your existing installation and login. See the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli) for sign-in and alternative installation methods.

The app searches `/opt/homebrew/bin` and `/usr/local/bin` for Codex. Tools installed only through a shell-specific version manager may work in Terminal but be unavailable when the app opens from Finder; the Homebrew installation above avoids that issue.

### 4. Optional: install GitHub CLI

Skip this step if you do not need the GitHub controls or contribution widget. Follow the [GitHub CLI installation guide](https://cli.github.com/):

```sh
brew install gh
gh auth login --hostname github.com --git-protocol https --web
gh auth status --hostname github.com
```

Follow the browser prompts with your own GitHub account. No developer account or credentials are included with Codex Studio.

### 5. Download the source

On this repository's GitHub page, select **Code → Download ZIP**. Open the downloaded ZIP in Finder. With the default Downloads location, open the extracted project in Terminal:

```sh
cd "$HOME/Downloads/CodexStudioMacOS-main"
```

If you extracted it elsewhere or renamed it, use that folder instead. It must contain `build.sh`, `Studio.swift`, and `ui/`. You can also use an existing Git clone of this repository.

### 6. Build and install the app

Run from the source folder:

```sh
bash build.sh --release
```

This builds `.build/release/Codex Studio.app` and `.build/release/CodexStudioMacOS.zip`. The executable is built for the Mac's current build architecture; this script does not produce a universal binary.

If an older Codex Studio is open, finish your work and quit it normally before replacing it. Then install into your personal Applications folder:

```sh
mkdir -p "$HOME/Applications"
ditto ".build/release/Codex Studio.app" "$HOME/Applications/Codex Studio.app"
open "$HOME/Applications/Codex Studio.app"
```

This release build uses bundled resources and does not embed your source-folder path. It does not require the downloaded source folder to remain in place.

### 7. Choose your workspace

In Codex Studio, click the folder button and select the project you want to work on. This starts a new Codex session in that folder. Press **Command J** to open the independent zsh terminal. Your existing Codex configuration and login are used.

### Install from an app ZIP

1. Complete dependency steps 1–3 above, and step 4 if you want GitHub integration.
2. Obtain `CodexStudioMacOS.zip` built for your Mac's architecture from a source you trust. GitHub's **Code → Download ZIP** contains source code, not a compiled app.
3. Double-click the app ZIP in Finder to extract `Codex Studio.app`.
4. Quit any running copy, then move the extracted app into your home folder's `Applications` folder (create it if needed).
5. Double-click the app, then choose your workspace as described in step 7.

The app is ad-hoc signed and not notarized. If macOS blocks a downloaded copy and you trust its source, attempt to open it once, then use **System Settings → Privacy & Security → Open Anyway** and confirm. See [Apple's instructions for opening downloaded apps](https://support.apple.com/en-us/102445).

### Installation troubleshooting

- **`brew: command not found`:** complete Homebrew's printed Next steps and reopen Terminal.
- **`Could not launch codex`:** check `command -v codex` and `codex --version` in Terminal. Use the Homebrew installation above, then reopen the app when your sessions are finished.
- **Missing Python or developer tools:** rerun step 1 and verify `/usr/bin/python3 --version` before launching the app.
- **GitHub widget cannot connect:** run `gh auth status --hostname github.com`, complete sign-in if needed, then refresh the widget.
- **Build fails on an older Mac:** check macOS and toolchain compatibility. The app's declared minimum alone does not guarantee the current dependencies work on that version.

## Controls

- Command J: show/hide the manual terminal. Hiding it preserves the session.
- Command comma: appearance settings. Choices save automatically.
- Command N: new Codex terminal session.
- Command C / V: copy selected terminal text / paste.
- Folder button: choose a workspace and start a new Codex session there. Existing sessions retain their original directories.

## Live editing

Edit `ui/style.css` while the app is open: it refreshes within a second without restarting either terminal. Settings also apply immediately. The installed development app reads this source folder when present, with a bundled fallback.

JavaScript/HTML and native Swift or Python changes currently require reopening the app; native changes also require `bash build.sh`. Close the app normally before rebuilding. Only CSS edits are hot reloaded.

## Build

Requires macOS, Apple command-line developer tools (Swift and `/usr/bin/python3`), and the Codex CLI on PATH or in `/opt/homebrew/bin` / `/usr/local/bin`.

```sh
bash build.sh
```

For a shareable build, run `bash build.sh --release`. This creates
`.build/release/CodexStudioMacOS.zip` without changing the installed app or
interrupting running sessions. The release uses bundled resources and omits the
development source path, local file metadata, and Python caches. It does not
bundle GitHub/Codex credentials, workspace files, or saved app preferences.
GitHub features use the recipient's own local GitHub CLI account. The build is
ad-hoc signed, not notarized. Share this release ZIP rather than the installed
development app. Repository ownership and commit history remain visible on GitHub.

Swift AppKit + WKWebView host the local interface; the Python helper provides real PTYs. No listening server and no CDN or online dependency at startup. Terminal output is rendered as terminal data, never HTML. The webview cannot navigate outside its local UI folder. Codex retains its own approval and sandbox settings.

Terminal renderer: xterm.js and FitAddon from the locally installed open-source Playwright distribution. See `ui/vendor/` for notices. The adapter replaces only the bundler's CommonJS loader helper.

## Settings

Open **Settings** or press **Command comma**. Appearance includes the four built-in themes, saved custom themes with eight editable colors, text size, and independent panel, highlight, and settings-background opacity. Opacity blends with the app background and leaves text opaque.

**Model & thinking** reads the installed Codex model catalog and offers the supported effort levels. You can also enter a custom model ID. Choices apply to new sessions via Codex CLI arguments; existing sessions remain unchanged (use `/model` in Codex for those). Leaving both controls at default preserves the CLI configuration, authentication, approvals, and sandbox settings. Configuration reference: https://learn.chatgpt.com/docs/config-file/config-reference.

**GitHub** shows the local workspace repository and lets you change its `origin` remote. Choose a local checkout to work on a different repository. It does not clone or push files. GitHub CLI account sign-in and switching require `gh` (https://cli.github.com). Sign-in opens its own PTY tab; return to Settings and refresh after completing it. GitHub CLI account changes apply across this Mac, not just one chat; SSH credentials and Codex MCP connections are separate.

Rebuild with the app closed to install these changes; reopening alone does not update the Swift executable or bundled Python helpers. Run `python3 -m unittest discover -s tests -v` for settings and real PTY input/output/resize checks.

The terminal sidebar's **GitHub** toggle opens a compact contribution widget at the bottom right. Its visibility is saved. Refresh loads the signed-in GitHub CLI user's contribution calendar (the last 26 weeks, plus a yearly total). Activity covers all repositories. **Change → Set origin** edits the current workspace's Git remote; **choose a local folder** switches the checkout for new sessions. Existing terminals remain in their original directories. Missing sign-in and network failures appear in the widget. The widget uses GitHub's documented [contribution calendar API](https://docs.github.com/en/graphql/reference/users#contributioncalendar) through the local GitHub CLI.

After widget code changes, close the app when finished with your sessions, run `bash build.sh`, and reopen Codex Studio. CSS alone continues to reload live.
