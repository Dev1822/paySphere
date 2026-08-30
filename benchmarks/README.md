# API performance benchmarks

Issue #748 adds an environment-driven Autocannon benchmark runner.

## Quick start

From the repository root:

```bash
pnpm install
pnpm benchmark:api
```

The default run benchmarks read-only, authenticated endpoints. Provide a token:

```bash
BENCHMARK_TOKEN='<access-token>' pnpm benchmark:api
```

Optional settings:

```bash
BENCHMARK_BASE_URL='http://localhost:5000' \
BENCHMARK_CONNECTIONS=20 \
BENCHMARK_DURATION=30 \
BENCHMARK_PIPELINING=1 \
BENCHMARK_TOKEN='<access-token>' \
pnpm benchmark:api
```

The report is written to `benchmarks/results/latest.md` by default.

## Custom targets

Copy `benchmarks/config.example.json` to `benchmarks/config.json` and set your
local endpoints and payloads. Keep credentials out of the config file; use
`BENCHMARK_TOKEN` instead.

Mutating endpoints such as payroll finalization are **opt-in** and are not part
of the default target list. Only benchmark them against a disposable/test
tenant and a known-safe payload.
