# Claude Code plugins setup

This repo is configured to use the **official Anthropic plugin marketplace**
([`anthropics/claude-plugins-official`](https://github.com/anthropics/claude-plugins-official)).

The marketplace and a set of first-party plugins are declared in
[`.claude/settings.json`](./settings.json). Because that file is committed,
**every Claude Code session on this repo** — web, desktop app, CLI, or IDE —
auto-loads the marketplace and enables the listed plugins. You may get a
one-time workspace-trust prompt the first time on a new machine.

## What is enabled

- **Marketplace:** `claude-plugins-official` (GitHub: `anthropics/claude-plugins-official`)
- **Plugins:** all 35 first-party Anthropic plugins (dev workflows, LSP servers,
  code-review, commit-commands, security-guidance, skill/plugin/MCP dev kits, etc.)

The marketplace also lists ~187 third-party plugins (Adobe, Google, AWS, …).
Those are **not** auto-enabled — many require their own API keys / MCP servers.
Install any of them on demand:

```bash
claude plugin install <name>@claude-plugins-official --scope user
# or, in an interactive session:
/plugin install <name>@claude-plugins-official
```

## Account-level / use it everywhere

Claude Code has **no cloud-synced "account level"** — settings live per machine
(`~/.claude/settings.json`) and are not shared across devices, and the web
runs in ephemeral containers. So "everywhere" is achieved two ways:

1. **Per repo (already done here):** committed `.claude/settings.json` travels
   with the repo and applies on every platform/session for this project.

2. **Per machine (your laptop/desktop/CLI):** add the same block to your global
   user settings once on each machine so it applies to *all* your projects:

   ```bash
   claude plugin marketplace add anthropics/claude-plugins-official
   # then enable what you want, e.g.:
   claude plugin install code-review@claude-plugins-official --scope user
   ```

   Or paste into `~/.claude/settings.json` directly:

   ```json
   {
     "extraKnownMarketplaces": {
       "claude-plugins-official": {
         "source": { "source": "github", "repo": "anthropics/claude-plugins-official" }
       }
     },
     "enabledPlugins": {
       "code-review@claude-plugins-official": true,
       "commit-commands@claude-plugins-official": true,
       "security-guidance@claude-plugins-official": true
     }
   }
   ```

## Useful commands

```bash
claude plugin marketplace list   # show configured marketplaces
claude plugin list               # show installed/enabled plugins
claude plugin update <name>      # update a plugin
claude plugin disable <name>     # disable without uninstalling
```
