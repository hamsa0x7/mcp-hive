<p align="center">
  <img src="assets/banner.png" alt="MCP Hive Banner" width="100%" />
</p>

<h1 align="center"> MCP Hive</h1>

<p align="center">
  <strong>The Swarm Orchestration Layer for Complex Agentic Work.</strong><br/>
  One request. Multiple specialists. Merged intelligence.
</p>

<p align="center">
  <a href="#the-story-breaking-the-hallucination-loop">The Story</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#the-royal-governance">Governance</a> •
  <a href="#configuration">Configuration</a>
</p>

---

##  The Story: Breaking the Hallucination Loop

If you’ve spent enough time working with LLM-based coding agents, you’ve eventually hit "The Wall." You ask for a complex multi-file audit or a major refactor, and the agent—constrained by its single-threaded nature—reaches its limit. It can't spawn sub-processes. It can't "think" in parallel.

This is where the **Hallucination Loop** begins. To satisfy your workflow, the agent starts "simulating" research. It tells you it "verified the security logs" or "checked the dependencies," when in reality, it just sat in the same context window, making its best guess because it had no other way to satisfy the requirement.

**MCP Hive** was built to solve this environmental dead end. It introduces the **Queen**—a high-force orchestration layer that can delegate real work to a swarm of parallel **Worker Bees**. By exposing these tools to your environment, it ensures that **environmental reality finally matches the workflow's demands.**

##  The Solution: High-Force Delegation

Instead of a solo agent guessing, Hive turns it into a **Swarm Commander**. The Queen handles the logistics, the keys, and the parallelization, while the primary agent remains the master of the conversation.

- **`hive_swarm`**: Launch an asynchronous polymorphic swarm. The Queen handles the decomposition—assigning specific specialists (Security, Perf, Logic) to different file chunks simultaneously.
- **`hive_harvest`**: Collect the merged findings once the swarm finishes. No more bloated context windows; just surgical results.
- **`hive_post_insight`**: Allows Worker Bees to share cross-file discoveries (like duplicated patterns) in real-time.
- **`hive_spawn_subtask`**: Enables the swarm to be recursive. If a Bee finds an unexpected SQL vulnerability, it can request a dedicated SQL specialist mid-flight.

##  The Difference: Parallel Focus

Traditional agents lose focus when they try to audit 10 files at once. Their reasoning starts to fray as the context window fills up with noise. 

The Queen "fractures" the problem. She allows a dedicated specialist to dive deep into a single module with 100% focus, returning a surgical report that is merged back into the Hive's collective intelligence. It's not just about being faster; it's about being **deeper**.

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

##  Royal Governance

- **Concurrency Control**: 50 active outbound requests (process-wide) with a 5-request cap per provider per swarm.
- **Scale**: Up to 15 parallel specialists per batch.
- **Redundancy**: Integrated Circuit Breakers and 3-tier provider failover.
- **Security**: Strict path sandboxing with Symlink Escape protection (managed by the Queen).

---

##  Hardened Configuration

Hive is built for production. It trusts your global MCP configuration for all secrets and limits.

| Variable | Requirement | Description |
|---|---|---|
| `*_API_KEY` | Required | Keys for the providers you want active in the swarm. |
| `HIVE_ALLOWLIST_ROOT` | Manual/Auto | Fixed path limit. The Queen will never read/write outside this folder. |
| `MIN_PROVIDER_KEYS` | Optional | Defaults to `1`. Minimum healthy providers required for a swarm. |
| `OLLAMA_ENABLED` | Optional | Set to `true` to enable local-inference fallbacks. |
| `HIVE_REPORT_STYLE` | Optional | `clinical` (strict) or `hive` (bee-themed). |

---

##  License

MIT — see [LICENSE](./LICENSE).
