# Codex Studio

A local macOS app with a real Codex CLI terminal, independent zsh sidebar, four color themes, text sizing, multiple Codex sessions, and a workspace folder picker.

Open `~/Applications/Codex Studio.app`. Your existing Codex CLI installation and login are used. This is a separate Codex conversation, not a continuation of the ChatGPT window.

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

Swift AppKit + WKWebView host the local interface; the Python helper provides real PTYs. No listening server and no CDN or online dependency at startup. Terminal output is rendered as terminal data, never HTML. The webview cannot navigate outside its local UI folder. Codex retains its own approval and sandbox settings.

Terminal renderer: xterm.js and FitAddon from the locally installed open-source Playwright distribution. See `ui/vendor/` for notices. The adapter replaces only the bundler's CommonJS loader helper.

## Settings

Open **Settings** or press **Command comma**. Appearance includes the four built-in themes, saved custom themes with eight editable colors, text size, and independent panel, highlight, and settings-background opacity. Opacity blends with the app background and leaves text opaque.

**Model & thinking** reads the installed Codex model catalog and offers the supported effort levels. You can also enter a custom model ID. Choices apply to new sessions via Codex CLI arguments; existing sessions remain unchanged (use `/model` in Codex for those). Leaving both controls at default preserves the CLI configuration, authentication, approvals, and sandbox settings. Configuration reference: https://learn.chatgpt.com/docs/config-file/config-reference.

**GitHub** shows the local workspace repository and lets you change its `origin` remote. Choose a local checkout to work on a different repository. It does not clone or push files. GitHub CLI account sign-in and switching require `gh` (https://cli.github.com). Sign-in opens its own PTY tab; return to Settings and refresh after completing it. GitHub CLI account changes apply across this Mac, not just one chat; SSH credentials and Codex MCP connections are separate.

Rebuild with the app closed to install these changes; reopening alone does not update the Swift executable or bundled Python helpers. Run `python3 -m unittest discover -s tests -v` for settings and real PTY input/output/resize checks.

The terminal sidebar's **GitHub** toggle opens a compact contribution widget at the bottom right. Its visibility is saved. Refresh loads the signed-in GitHub CLI user's contribution calendar (the last 26 weeks, plus a yearly total). Activity covers all repositories. **Change → Set origin** edits the current workspace's Git remote; **choose a local folder** switches the checkout for new sessions. Existing terminals remain in their original directories. Missing sign-in and network failures appear in the widget. The widget uses GitHub's documented [contribution calendar API](https://docs.github.com/en/graphql/reference/users#contributioncalendar) through the local GitHub CLI.

After widget code changes, close the app when finished with your sessions, run `bash build.sh`, and reopen Codex Studio. CSS alone continues to reload live.
