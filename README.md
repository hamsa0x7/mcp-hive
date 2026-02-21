<p align="center">
  <img src="assets/logo.png" alt="MCP Hive" width="200" />
</p>

<h1 align="center">🐝 MCP Hive</h1>

<p align="center">
  <strong>Parallel code analysis through specialized AI agents.</strong><br/>
  One request. Multiple perspectives. Merged intelligence.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#roles">Roles</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#api">API</a>
</p>

---

## ⚡ What Is This?

An MCP server that splits code review across parallel specialist agents — each analyzing from a different angle, using the best model for the job.

```
You (1 request) → Hive → 5 bees in parallel → merged findings
                         ├─ 🔒 Security
                         ├─ 🏗️ Architecture
                         ├─ ⚡ Performance
                         ├─ 🧹 Linting
                         └─ 🔗 API Contracts
```

> Sequential: **18s** → Hive: **6s** → **~3x faster**

---

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/mcp-hive.git
cd mcp-hive
npm install
cp .env.example .env   # add your API keys
npm run build
npm test               # 85 tests ✅
```

### MCP Config

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

## 🧠 How It Works

```
Role → Strength → Model Registry → Provider → Best Candidate
```

1. 📋 **Decompose** — map files to specialist roles
2. 📄 **Context** — inject file contents into prompts
3. 🚀 **Dispatch** — launch agents in parallel (bounded concurrency)
4. 🤖 **Infer** — each bee calls its assigned model
5. 🍯 **Aggregate** — merge all findings into one response

If a model fails → **retry → switch provider → escalate model → hard timeout (45s)**

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

## 📡 API

### `spawn_parallel_agents`

```json
{
  "role": "security_specialist",
  "diff_chunks": [
    { "path": "src/auth.ts" },
    { "path": "src/middleware.ts" }
  ]
}
```

### Response

```json
{
  "batch_id": "sw_abc123",
  "results": [
    {
      "role": "security_specialist",
      "status": "success",
      "provider": "anthropic",
      "model": "claude-3.5-sonnet",
      "findings": ["..."],
      "overall_confidence": 0.87,
      "latency_ms": 4200
    }
  ],
  "metrics": {
    "acceleration_report": {
      "theme": "hive",
      "agents": 5,
      "sequential_ms": 18000,
      "parallel_ms": 6100,
      "speedup": 2.95,
      "time_saved_ms": 11900,
      "parallel_efficiency": 0.91
    }
  }
}
```

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

## 📄 License

MIT — see [LICENSE](./LICENSE).
