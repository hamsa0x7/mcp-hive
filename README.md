<p align="center">
  <img src="assets/banner.png" alt="MCP Hive Banner" width="800" />
</p>

<h1 align="center">🐝 MCP Hive</h1>

<p align="center">
  <strong>The Swarm Orchestration Layer for Agentic Environments.</strong><br/>
  One request. Multiple specialists. Merged intelligence.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#swarm-commander">Swarm Commander</a> •
  <a href="#software-defined-parallelism">Software-Defined Parallelism</a> •
  <a href="#configuration">Configuration</a>
</p>

---

## ⚡ The Problem: The Capability Gap

Many agentic environments (like AntiGravity) are single-threaded by nature. They lack a native mechanism (like the `Task()` function in other systems) to spawn parallel, headless sub-agents within a conversation.

When an agent hits this **Environmental Dead End**, it often reverts to "Covert Recovery"—simulating research or lying about tool availability to satisfy a workflow. This creates a "hallucination loop" that compromises project integrity.

## 🛡️ The Solution: MCP Hive

**MCP Hive is the direct architectural solution to this problem.**

It provides a legitimate, high-force pathway for agentic work by acting as an external **Orchestration Layer**. By exposing real tools to the environment, it ensures that **environmental reality finally matches the workflow's demands.**

### 🐝 Legitimate Tooling
Instead of hallucinating functions, Hive exposes a production-grade master command:
- `hive_swarm`: Execute a polymorphic batch of specialists. Supporting both preset roles and on-the-fly `custom_prompt` injection per-agent.
- `hive_list_agents`: Keep track of your swarm's registry.

### ⚔️ Swarm Commander
Antigravity itself is a single-threaded environment. MCP Hive handles the "Swarm" logic outside of your main context. It uses your API keys to spawn "worker agents" via raw LLM calls, gathers their findings, and returns a single, structured response. It turns a "solo agent" into a **Swarm Commander**.

---

## 🚀 Software-Defined Parallelism

Traditional agents do research sequentially. Hive does it in a swarm.

```
1 request → Hive → 5 bees in parallel → merged findings
                   ├─ 🔍 Discovery
                   ├─ 🗺️ Context Mapping
                   ├─ ⚡ Tactical Planning
                   ├─ 🧪 Verification
                   └─ 🔒 Security
```

> Sequential: **18s** → Hive: **6s** → **~3x faster**

Compatible with any MCP client. Optimized for **AntiGravity**.

---

## 🚀 Quick Start

```bash
git clone https://github.com/hamsa0x7/mcp-hive.git
cd mcp-hive
npm install
# Open .env and add your API keys
npm run build
npm run register       # auto-configure your environment 🐝
npm test               # verify swarm integrity ✅
```

---

## 🔧 Configuration

All config in `.env`:

| Variable | Default | Description |
|---|---|---|
| `*_API_KEY` | — | 🔐 Provider keys (OpenAI, Anthropic, Google, etc.) |
| `MAX_AGENTS` | `15` | 🐝 Max agents per batch |
| `CONCURRENCY` | `5` | ⚙️ Parallel model calls |
| `HIVE_REPORT_STYLE` | `clinical` | 🎨 Theme: `clinical` / `hive` |

---

## 📄 License

MIT — see [LICENSE](./LICENSE).
