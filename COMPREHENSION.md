# 🎓 OpenCode Comprehension Check

Use this document to verify your understanding of the OpenCode architecture. The answers are based on the implementation created during the roadmap walkthrough.

---

## 🟢 Beginner

### 1. What is the difference between running `bun dev` and `bun dev serve`?
- **`bun dev`**: Runs the interactive TUI (Terminal UI) entry point (`packages/opencode/src/index.ts`). It allows direct interaction with the agent.
- **`bun dev serve`**: Runs the headless Hono HTTP server (`packages/opencode/src/server/server.ts`). This is used when connecting external clients like the Web or Desktop apps.

### 2. How many built-in agents are there? Name them and their purpose.
In our current implementation, we have the core **Agentic Loop** handled by the `SessionProcessor`. The roadmap mentions several specialized agents:
- **`build`**: The default agent with full permissions.
- **`plan`**: A read-only agent for architectural design.
- **`explore`**: Specialized for codebase discovery.
- **`general`**: For parallel sub-tasks.

### 3. What is a "Part" in the message data model? Give 3 examples of part types.
A **Part** is the smallest unit of content within a Message.
- **`text`**: Streaming text content from the LLM.
- **`tool`**: A tool call request or the result of a tool execution.
- **`reasoning`**: Internal chain-of-thought (e.g., Gemini's "thinking").

### 4. What tool would the LLM use to run a shell command? To read a file? To search code?
- **Shell command**: `bash` tool.
- **Read a file**: `read` tool.
- **Search code**: `glob` or `grep` tools.

---

## 🟡 Intermediate

### 5. If a user sends a message and the LLM wants to run `rm -rf /`, which system decides whether to allow or deny it?
The **Permission Engine** (`packages/opencode/src/permission/next.ts`). The `SessionProcessor` calls `PermissionNext.ask()` before executing any tool. It detects destructive patterns and returns `status: 'ask'` or `'deny'`.

### 6. What happens when the agent calls the same tool with the same input 3 times in a row?
The `SessionProcessor` (as described in the roadmap's Concept 4) detects a **doom loop**. It pauses execution and asks the user for explicit permission or a path correction to prevent wasted tokens and infinite loops.

### 7. How does the web app know when a new Part was created without polling?
Through the **Bus (Event System)** and **SSE (Server-Sent Events)**.
- `SessionManager.updatePart()` publishes a `PartEvent.Updated` to the `Bus`.
- The Server's `/event` endpoint subscribes to the `Bus` and pipes these events into an SSE stream to the client.

### 8. What is "compaction" and when does it trigger?
Compaction is the process of summarizing the conversation history to save context window space. It triggers when the session's token count nears the model's limit. A specialized `compaction` agent creates a summary, and old messages are archived.

---

## 🔴 Advanced

### 9. How does the `Instance` module isolate state between two simultaneous requests?
It uses **`AsyncLocalStorage`** (`packages/opencode/src/project/instance.ts`). Each request is wrapped in `Instance.provide({ directory }, fn)`. When modules call `Instance.state()`, they retrieve a `Map` that is uniquely keyed to the current working directory, ensuring data from Project A never leaks into Project B.

### 10. How would you add a new tool called `screenshot`?
1. Create `packages/opencode/src/tool/screenshot.ts`.
2. Define `ToolInfo` with `id: 'screenshot'`, parameters (URL), and an `execute` function using a library like Puppeteer.
3. Call `ToolRegistry.register(ScreenshotTool)`.

### 11. How is a subagent (like `general`) spawned?
Through the **`task` tool**. When the LLM calls `task`, the `ToolRegistry` executes logic that creates a **child Session** with a different `Agent.Info`. This child session has its own `SessionProcessor` and can run in parallel.

### 12. Why does `provider.ts` need a `transform.ts` file?
`ProviderTransform` acts as an adapter. It converts OpenCode's internal **Message/Part** data model into the specific schema required by the **Vercel AI SDK** (and subsequently different LLM providers like Anthropic or Google), ensuring consistent handling of text, tool calls, and media.
