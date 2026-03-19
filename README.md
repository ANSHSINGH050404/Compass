# 🧭 OpenCode

OpenCode is an **open-source AI coding agent** — fully provider-agnostic and designed to be the open alternative to tools like Claude Code.

## 🚀 Key Features

- **CLI + TUI**: A powerful terminal interface written in SolidJS via `opentui`.
- **Headless API**: A Hono-based HTTP server (port 4096) that drives the agentic loop.
- **Web/Desktop App**: Cross-platform clients built with SolidJS and Tauri.
- **Provider Agnostic**: Support for Anthropic, OpenAI, Gemini, and local models.
- **Extensible**: A robust plugin system and tool registry (bash, edit, glob, etc.).

## 🏗️ Architecture

OpenCode follows a client-server architecture where the TUI, Web, and Desktop apps are all clients speaking to a local server over HTTP + SSE.

```
┌──────────────────────────────────────────────────────┐
│                   User Interfaces                    │
│   TUI (opentui)  │  Web App (SolidJS)  │  Desktop   │
│                  │     (Tauri)         │  (Tauri)   │
└──────────────────────────────────────────────────────┘
                          │ HTTP + SSE
           ┌──────────────▼──────────────┐
           │     OpenCode Server         │
           │   (Hono on port 4096)       │
           │  + Bus (event system)       │
           │  + SQLite (Drizzle ORM)     │
           └──────────────┬──────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   Session/Agent    Tool Registry      Provider
  (orchestration)   (bash, edit,       (AI SDK →
                    glob, grep…)    Anthropic/OpenAI/
                                     Gemini/etc.)
```

## 🛠️ Getting Started

Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.
