# Agent Harness Studio

Agent Harness Studio is a GitHub Copilot App canvas for designing and assessing a gated agent-team workflow. It maps seven delivery stages from design through human approval, tracks repository readiness, and saves each harness blueprint in the active workspace.

## Install

Project scope is the canonical in-repository setup: keep the extension at `.github/extensions/agent-harness-studio/` and open this repository in the Copilot App. The app discovers `extension.mjs` directly and supplies `@github/copilot-sdk/extension`; no local package installation is required.

The same extension can also be installed from a shared extension URL with one of the Copilot App's install scopes:

- **Session**: available only in the current session.
- **User**: available across the user's projects.
- **Project**: stored in the repository and shared with collaborators; use this repository-owned setup for ongoing development.

After installing or changing scope, reload extensions in the Copilot App (or start a new session). Ask Copilot to open the `agent-harness-studio` canvas, optionally providing a repository name and stable document ID. Harness state is written under `.agent-harness-studio/` in the active workspace.
