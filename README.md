<p align="center">
  <img src="assets/banner.png" alt="MCP Hive Banner" width="100%" />
</p>

<h1 align="center"> MCP Hive</h1>

<p align="center">
  <strong>The Orchestration Layer for Complex Agentic Work.</strong><br/>
  One request. Multiple specialists. Merged intelligence.
</p>

<p align="center">
  <a href="#the-story-breaking-the-hallucination-loop">The Story</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#operational-governance">Governance</a>
</p>

---

##  The Story: Breaking the Hallucination Loop

If you’ve spent enough time working with LLM-based coding agents, you’ve eventually hit "The Wall." You ask for a complex multi-file audit or a major refactor, and the agent—constrained by its single-threaded nature—reaches its limit. It can't spawn sub-processes. It can't "think" in parallel.

This is where the **Hallucination Loop** begins. To satisfy your workflow, the agent starts "simulating" research. It tells you it "verified the security logs" or "checked the dependencies," when in reality, it just sat in the same context window, making its best guess.

**MCP Hive** was built to solve this environmental dead end. It gives your primary agent the ability to delegate real work to a swarm of specialists, ensuring that **environmental reality finally matches the workflow's demands.**

##  The Solution: High-Force Delegation

Instead of a solo agent guessing, Hive turns it into a **Swarm Commander**. It provides a production-grade master command suite:

- **`hive_swarm`**: Launch an asynchronous polymorphic swarm. Assign different specialists (Security, Perf, Logic) to different files simultaneously.
- **`hive_harvest`**: Collect the merged findings once the swarm finishes its work.
- **`hive_post_insight`**: Allows "Bees" to share discoveries (like duplicated patterns) in real-time on a shared board.
- **`hive_spawn_subtask`**: Lets an agent realize it needs a *new* specialist role mid-analysis and spawn one automatically.

##  Why Parallelism Matters

It's not just about speed (though it is significantly faster); it’s about **Cognitive Focus**. 

When a solo agent tries to analyze 10 files, it loses depth. Its context window gets bloated, and its reasoning starts to fray. Hive "fractures" the problem. It allows a dedicated specialist to dive deep into a single module with 100% focus, returning a surgical report that the primary agent can then merge into a master plan.

---

##  Quick Start

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
    Restart your MCP client and ask: *"`Analyze src/server.ts using hive_swarm`"*

---

##  Hardened Configuration

Hive is built for production environments. It trusts your global MCP configuration for all secrets and limits.

| Variable | Requirement | Description |
|---|---|---|
| `*_API_KEY` | Required | Keys for the providers you want active in the swarm. |
| `HIVE_ALLOWLIST_ROOT` | Manual/Auto | Fixed path limit. Hive will never read/write outside this folder. |
| `MIN_PROVIDER_KEYS` | Optional | Defaults to `1`. Minimum healthy providers required for a swarm. |
| `RECOMMENDED_PROVIDER_KEYS`| Optional | Defaults to `2`. Resilience target; Hive warns if you're under-provisioned. |
| `OLLAMA_ENABLED` | Optional | Set to `true` to enable local-inference fallbacks. |
| `HIVE_REPORT_STYLE` | Optional | `clinical` (strict) or `hive` (bee-themed). |

---

##  Operational Governance

- **Concurrency Control**: 50 active outbound requests (process-wide) with a 5-request cap per provider per swarm.
- **Scale**: Up to 15 parallel specialists per batch.
- **Resilience**: Integrated Circuit Breakers and 3-tier provider failover.
- **Security**: Strict path sandboxing with Symlink Escape protection.

---

##  License

MIT — see [LICENSE](./LICENSE).
