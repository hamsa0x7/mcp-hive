<p align="center">
  <img src="assets/logo.png" alt="MCP Hive" width="200" />
</p>

<h1 align="center">🐝 MCP Hive</h1>

<p align="center">
  <strong>Parallel subagent orchestration via MCP.</strong><br/>
  One request. Multiple specialists. Merged intelligence.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#roles">Roles</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#releases">Releases</a>
</p>

---

## ⚡ Why?

Antigravity doesn't have a native `Task()` tool for spawning parallel, headless subagents within a conversation. MCP Hive fills that gap — it's an external MCP server that handles multi-agent code analysis in parallel and returns merged results.

```
1 request → Hive → 5 bees in parallel → merged findings
                   ├─ 🔒 Security
                   ├─ 🏗️ Architecture
                   ├─ ⚡ Performance
                   ├─ 🧹 Linting
                   └─ 🔗 API Contracts
```

> Sequential: **18s** → Hive: **6s** → **~3x faster**

Compatible with any MCP client.

---

## 🚀 Quick Start

```bash
git clone https://github.com/hamsa0x7/mcp-hive.git
cd mcp-hive
npm install
cp .env.example .env   # add your API keys
npm run build
npm test               # 85 tests ✅
```

### 🔌 MCP Config

```json
{
  "mcpServers": {
    "mcp_hive": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/mcp-hive"
    }
  }
}
```

---

## 🐝 Roles

| Role | Focus |
|---|---|
| 🔒 `security_specialist` | Vulnerabilities, injection, auth |
| 🏗️ `architecture_reviewer` | Coupling, SOLID, dependencies |
| ⚡ `performance_analyst` | Bottlenecks, complexity, memory |
| 🔄 `concurrency_auditor` | Race conditions, deadlocks |
| 📜 `api_contract_checker` | Breaking changes, contracts |
| 🚨 `error_handling_auditor` | Unhandled exceptions |
| 🧹 `lint_conformance_agent` | Style, naming, formatting |
| 📊 `complexity_analyzer` | Cyclomatic complexity |
| 🗑️ `dead_code_detector` | Unreachable code, unused vars |
| 💥 `breaking_change_detector` | Public API modifications |
| 🔗 `dependency_impact_analyzer` | Transitive breaks |
| 🧪 `test_coverage_auditor` | Missing tests, edge cases |

---

## 🔧 Configuration

All config in `.env` — see [`.env.example`](.env.example):

| Variable | Default | Description |
|---|---|---|
| `*_API_KEY` | — | 🔐 Provider keys (BYOK) |
| `MAX_AGENTS` | `15` | 🐝 Max agents per batch |
| `CONCURRENCY` | `5` | ⚙️ Parallel model calls |
| `MAX_OUTPUT_TOKENS` | `800` | 🧮 Per-agent token cap |
| `MAX_BATCH_TOKENS` | `100000` | 💰 Global batch cap |
| `HIVE_REPORT_STYLE` | `clinical` | 🎨 Theme: `clinical` / `hive` |

**Supported providers:** OpenAI · Anthropic · Google · Groq · OpenRouter · Together · Mistral · Fireworks

---

## 🏗️ Architecture

```
src/
├── index.ts           → Entry point
├── server.ts          → MCP server + tool registration
├── orchestrator.ts    → Pipeline orchestration
├── execute_agent.ts   → Agent lifecycle (retries, escalation)
├── resolver.ts        → Role → model resolution
├── proxy.ts           → Multi-provider LLM proxy
├── context.ts         → File content injection
├── aggregate.ts       → Result merging
├── concurrency.ts     → Parallel execution control
├── budget.ts          → Token budget enforcement
├── report.ts          → Structured acceleration metrics
├── telemetry.ts       → Swarm timing computation
└── db.ts              → SQLite persistence
```

---

## 📦 Releases

### v1.0.0
- Initial public release.
- Parallel orchestration of 12+ specialized roles.
- Multi-provider support with dynamic escalation (OpenAI, Anthropic, Google, Groq, etc.).
- Headless architecture for CLI/Assistant integration.
- Bounded concurrency and token budget enforcement.
- Performance telemetry with speedup reporting.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).
