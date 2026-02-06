## Project switching & MCP Host: two approaches (draft, <1 page)

### Background / observed issue
- The app supports multiple local projects (e.g. `~/.attacktrace/projects/{projectId}/mcp_config.json`).
- After switching project in the UI, the tool list can still show tools from the previous project until the whole app is restarted.
- Root cause (high-level): the “tools” UI is ultimately constrained by the MCP Host **runtime state** (which MCP servers are currently loaded/running), and that state does not automatically switch when the project changes.

---

### Approach C: Restart MCP Host on project switch (UI-driven)
**Idea**: when the user switches project, restart the MCP Host process (only the host), then re-fetch `/api/config/mcpserver` + `/api/tools`.

**Why it works**
- A fresh host startup loads configuration cleanly for the new project context, so the runtime state matches the selected project.

**Pros**
- Very reliable and simple to reason about.
- Clears all in-memory state and avoids subtle cross-project contamination.
- Implementation is mostly in Electron main process (it already owns the host child process lifecycle).

**Cons / risks**
- Interrupts ongoing chats, tool calls, and running MCP server processes.
- Slower UX (host startup latency).
- Requires a robust “host ready” handshake and error handling.

**Recommended UX**
- Either: auto-restart on switch (fastest consistency)
- Or: prompt “Switching projects requires restarting tool runtime” with one-click restart

---

### Approach Reload: Hot-reload MCP config when project changes (Host-driven)
**Idea**: keep the host process alive and implement an explicit mechanism to:
- switch the host’s active project context, and
- reload MCP servers to match that project’s `mcp_config.json` (stop removed servers, start new ones)

**Variants**
- Event/API-driven: `POST /api/.../project/switch` (or similar) with `projectId`, then host performs `reload(...)`.
- File-watch driven: host watches `current_project.json` and/or `{projectId}/mcp_config.json`, debounces changes, then reloads.

**Pros**
- Best UX (no process restart) when done right.
- Can be incremental: only restart changed MCP servers.

**Cons / risks**
- Harder correctness: debouncing, duplicate file events, partial writes, race with ongoing tool calls.
- Must define behavior during in-flight requests (queue/wait/cancel).
- Needs clear separation of per-project runtime state vs global state.

---

### Decision guide (pragmatic)
- If priority is correctness + speed to ship: **Approach C** (restart host) is the safest first step.
- If priority is seamless UX + long-term scalability: implement **project-aware reload** in host (API-driven preferred over file-watch).

