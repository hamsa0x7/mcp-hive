<p align="center">
  <img src="assets/banner.png" alt="MCP Hive Banner" width="100%" />
</p>

<h1 align="center"> MCP Hive</h1>

<p align="center">
  <strong>The Swarm Orchestration Layer for Complex Agentic Work.</strong><br/>
  👑 Queen (The Agent) • 🎬 Drone (MCP Hive) • 🐝 Worker Bees (Subagents)
</p>

<p align="center">
  <a href="#the-problem-the-capability-gap">🔍 The Problem</a> •
  <a href="#the-solution-mcp-hive">🎯 The Solution</a> •
  <a href="#the-hierarchy-of-the-hive">🧬 The Hierarchy</a> •
  <a href="#quick-start">⚡ Quick Start</a>
</p>

---

## 🔍 The Problem: The Capability Gap

Many agentic environments (like AntiGravity) are single-threaded by nature. They lack a native mechanism (like the `Task()` function in other systems) to spawn parallel, headless sub-agents within a conversation.

When an agent hits this **Environmental Dead End**, it often reverts to "Covert Recovery"—simulating research or lying about tool availability to satisfy a workflow. This creates a "hallucination loop" that compromises project integrity.

I particularly faced this bottleneck while building complex systems in **AntiGravity**, and many other agentic IDEs suffer from the same limitation. **MCP Hive** was developed specifically to solve this for AntiGravity but is designed to be compatible with most agentic platforms.

## 🎯 The Solution: MCP Hive

**MCP Hive is the direct architectural solution to this problem.**

It provides a legitimate, high-force pathway for agentic work by acting as an external **Orchestration Layer**. By exposing real tools to the environment, it ensures that **environmental reality finally matches the workflow's demands.**

###  Legitimate Tooling
Instead of hallucinating functions, Hive exposes a production-grade master command suite:
- **`hive_swarm`**: Launch an asynchronous polymorphic swarm batch (`path`, optional `role`, optional `custom_prompt`, optional `requested_strength`, optional `workspace_root`).
- **`hive_harvest`**: Collect results for a previously launched swarm by `swarm_id`.
- **`hive_post_insight`**: Post cross-bee discoveries/blockers to the shared board.
- **`hive_spawn_subtask`**: Spawn specialized follow-up work from an in-flight swarm task.

###  Swarm Commander
Antigravity itself is a single-threaded environment. MCP Hive handles the "Swarm" logic outside of your main context. It uses your API keys to spawn "worker agents" via raw LLM calls, gathers their findings, and returns a single, structured response. It turns a "solo agent" into a **Swarm Commander**.

---

## 🧬 The Hierarchy of the Hive

In our production environment, the **Hive**, effective swarming follows a clear chain of command:

1.  👑 **The Queen (The Agent)**: YOU. The primary agent session. The Queen owns the strategy, the conversation context, and the ultimate decision-making. 
2.  🎬 **The Drone (MCP Hive)**: The technical orchestrator. The Drone listens to the Queen and manages the brute-force swarm logistics—API keys, model routing, and parallelization.
3.  🐝 **The Worker Bees (Subagents)**: The specialists. Headless agents spawned by the Drone to perform surgical tasks (Security Audit, Logic Review, Context Mapping) in parallel.

---

## ⚡ Quick Start

> [!TIP]
> **Ask your primary Agent (The Queen) to handle the install and registration for you!** She can execute these commands directly in your workspace.

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/hamsa0x7/mcp-hive.git
    cd mcp-hive
    npm install
    npm run build
    ```

2.  **Register**:
    ```bash
    npm run register
    ```
    This auto-writes your paths (`command`, `cwd`, and `HIVE_ALLOWLIST_ROOT`) to your global `mcp_config.json`.

3.  **Add Keys**:
    Open your `mcp_config.json` and replace the API key placeholders (e.g., `<OPENAI_API_KEY>`) with your real credentials.

4.  **Verify**:
    Restart your client and let the Queen launch a test swarm: *"`Analyze src/server.ts using hive_swarm`"*

---

## ⚖️ Governance & Security

- **Concurrency**: 50 active outbound requests (process-wide) with a 5-request cap per provider per swarm.
- **Scale**: Up to 15 parallel Worker Bees per batch.
- **Redundancy**: Integrated Circuit Breakers and 3-tier provider failover.
- **Path Sandboxing**: Strict root enforcement with Symlink Escape protection (Drone-managed).

---

##  License

MIT — see [LICENSE](./LICENSE).
