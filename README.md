<p align="center">
  <img src="assets/banner.png" alt="MCP Hive Banner" width="100%" />
</p>

<h1 align="center"> MCP Hive</h1>

<p align="center">
  <strong>The Swarm Orchestration Layer for Agentic Environments.</strong><br/>
  One request. Multiple specialists. Merged intelligence.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> 
  <a href="#swarm-commander">Swarm Commander</a> 
  <a href="#software-defined-parallelism">Software-Defined Parallelism</a> 
  <a href="#configuration">Configuration</a>
</p>

---

##  The Problem: The Capability Gap

Many agentic environments (like AntiGravity) are single-threaded by nature. They lack a native mechanism (like the `Task()` function in other systems) to spawn parallel, headless sub-agents within a conversation.

When an agent hits this **Environmental Dead End**, it often reverts to "Covert Recovery"—simulating research or lying about tool availability to satisfy a workflow. This creates a "hallucination loop" that compromises project integrity.

##  The Solution: MCP Hive

**MCP Hive is the direct architectural solution to this problem.**

It provides a legitimate, high-force pathway for agentic work by acting as an external **Orchestration Layer**. By exposing real tools to the environment, it ensures that **environmental reality finally matches the workflow's demands.**

###  Legitimate Tooling
Instead of hallucinating functions, Hive exposes a production-grade master command suite:
- `hive_swarm`: Launch an asynchronous polymorphic swarm batch (`path`, optional `role`, optional `custom_prompt`, optional `requested_strength`, optional `workspace_root`).
- `hive_harvest`: Collect results for a previously launched swarm by `swarm_id`.
- `hive_post_insight`: Post cross-bee discoveries/blockers to the shared board.
- `hive_spawn_subtask`: Spawn specialized follow-up work from an in-flight swarm task.

###  Swarm Commander
Antigravity itself is a single-threaded environment. MCP Hive handles the "Swarm" logic outside of your main context. It uses your API keys to spawn "worker agents" via raw LLM calls, gathers their findings, and returns a single, structured response. It turns a "solo agent" into a **Swarm Commander**.

---

##  Software-Defined Parallelism

Traditional agents do research sequentially. Hive does it in a swarm.

```
1 request  Hive  5 bees in parallel  merged findings
                     Discovery
                     Context Mapping
                     Tactical Planning
                     Verification
                     Security
```

> Sequential: **18s**  Hive: **6s**  **~3x faster**

Compatible with any MCP client. Optimized for **AntiGravity**.

---

##  Quick Start

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/hamsa0x7/mcp-hive.git
    cd mcp-hive
    npm install
    npm run build
    ```

2.  **Register (installer-managed paths)**:
    ```bash
    npm run register
    ```
    This auto-writes `command`, `args`, `cwd`, and `HIVE_ALLOWLIST_ROOT` in your global `mcp_config.json`.
    If you prefer, ask your agent to run the install/register step for you.

3.  **Add keys only**:
    Update only the `*_API_KEY` values under `mcpServers.hive.env` (placeholders are created for you).

4.  **Verify**:
    Restart your MCP client. Launch a test swarm directly from the chat:
    *"`Analyze src/health.ts using hive_swarm`"*

---

##  Hardened Configuration

The Hive uses a "No-Local-Env" priority system for production registry sync. It trusts your global MCP configuration for all secrets and limits.

| Variable | Requirement | Description |
|---|---|---|
| `*_API_KEY` | Required | Input keys for providers you want active. Users should only edit these. |
| `HIVE_ALLOWLIST_ROOT` | Installer-managed | Defaults to `cwd` at registration. If missing at runtime, Hive falls back to process `cwd`. |
| `MIN_PROVIDER_KEYS` | Optional | Defaults to `1`. Number of healthy providers required to launch. |
| `RECOMMENDED_PROVIDER_KEYS` | Optional | Defaults to `2`. Soft resilience target; Hive warns if below this. |
| `OLLAMA_ENABLED` | Optional | Set to `true` to enable local-inference fallbacks. |
| `HIVE_REPORT_STYLE` | Optional | `clinical` (strict) or `hive` (bee-themed). |
| `DB_PATH` | Optional | Path to the persistent SQLite registry for long-running swarms. |

For future multi-project sessions, the Queen can pass a per-request `workspace_root` to `hive_swarm` so users do not manually edit path settings.

---

##  Operational Governance

- **Global Concurrency Cap**: 50 active outbound requests (process-wide).
- **Swarm Concurrency Cap**: 5 active requests per provider (per batch).
- **Max Agents**: 15 specialists per swarm.
- **Failover**: Automatic 3-tier escalation and Circuit Breaker protection.

---

##  License

MIT — see [LICENSE](./LICENSE).
