# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Commands

OpenCode is designed to be built and run with **Bun**.

- **Dev (TUI)**: `bun dev` (Runs the terminal UI)
- **Dev (Server)**: `bun dev serve` (Runs the Hono HTTP server on port 4096)
- **Build**: `bun build` (Placeholder for build process)
- **Lint**: `bun lint` (Placeholder for linting)
- **Test**: `bun test` (Run all tests)

## 🏗 High-Level Architecture

OpenCode is an open-source AI coding agent with a client-server architecture.

### Core Systems

1.  **The Bus (Event System)**: Internal pub/sub for communication and SSE streaming (`packages/opencode/src/bus/`). Any module can publish/subscribe to `EventDef` types.
2.  **Instance & Project**: Context tracking system (`packages/opencode/src/project/instance.ts`). It uses `AsyncLocalStorage` to isolate directory-scoped state between simultaneous requests.
3.  **Sessions & Messages**: The data model (`packages/opencode/src/session/`). A Session contains Messages, which are made of Parts (text, tool, reasoning, patch).
4.  **Session Processor**: The agentic loop (`packages/opencode/src/session/processor.ts`). Orchestrates LLM streaming, tool execution, and permission checks.
5.  **Tool Registry**: A unified interface for tools (`packages/opencode/src/tool/`). Tools are registered and called by the LLM via the processor.
6.  **Permission Engine**: Ruleset-based tool authorization (`packages/opencode/src/permission/next.ts`). Controls whether tools can execute immediately or require user approval.

### Code Style & Guidelines

- **Naming**: Use single-word names where possible (e.g., `Bus`, `Instance`, `Session`).
- **Functional Style**: Prefer functional patterns over deep class hierarchies.
- **Error Handling**: Follow the project rule of "no try/catch" for expected failures; let the system handle them or return explicit error states.
- **Concurrency**: Use the `Instance` system to ensure thread-safety across concurrent project requests.
- **Environment**: All shell commands must use Unix syntax (forward slashes, `/dev/null`).

## 📁 File Structure (Key Paths)

- `/packages/opencode/src/bus/`: Event bus and definitions.
- `/packages/opencode/src/project/`: Instance and project management.
- `/packages/opencode/src/session/`: Persistence, LLM streaming, and orchestration.
- `/packages/opencode/src/tool/`: Tool registration and implementations.
- `/packages/opencode/src/server/`: Hono HTTP server routes.
- `/packages/opencode/src/permission/`: Tool permission logic.
- `/packages/opencode/src/agent/prompt/`: System prompt templates.
