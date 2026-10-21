# Codex Studio development

This is the user's native macOS terminal app. The main pane runs the actual Codex CLI; the toggleable sidebar is an independent zsh PTY.

For visual changes, edit `ui/style.css`: the running app watches it and applies it immediately while preserving both terminal sessions. Theme and font controls are in `ui/app.js`. Explain when a requested change requires a restart: HTML, JavaScript, Swift, and Python currently do. Never promise all code hot reloads.

The source lives here and the installed app is `~/Applications/Codex Studio.app`. Run `bash build.sh` with the app closed to rebuild. Do not terminate an active user session just to apply an update. Preserve existing Codex authentication, approvals, and sandbox configuration.

Validate native changes by compiling, and terminal changes with real PTY input/output/resize tests. Use the UI to verify visual changes. Do not replace the terminal with a fake chat UI. Keep all renderer resources local and retain third-party licenses.
