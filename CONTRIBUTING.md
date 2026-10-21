# Contributing

Thanks for taking a look. This is a demo and workshop project rather than a
product, so the bar is "does it still teach the thing clearly" more than
"is it enterprise-ready".

## Getting it running

The fastest loop needs no cluster — just Podman or Docker:

```bash
cp .env.example .env          # then pick a model backend
podman compose up --build
```

Open <http://localhost:8080>. See the README for the model options (a local
model via RamaLama, or a MaaS gateway). The assistant drives everything
through tool calls, so whichever model you pick **must support tool calling**.

## Dependencies and lockfiles

Container builds are pinned and the pins are checked in. If you change a
dependency, regenerate the lock in the same commit. The workshop notebook
requirements are the exception — they install into a workbench interactively
and keep loose ranges on purpose.

The garak lock must be regenerated with `uv`, not `pip-compile`: see the
header of `packages/mlflow-proxy/requirements-garak.in` for why.

The JS workspaces share one lockfile at the repo root. You do not need Node
installed locally:

```bash
podman run --rm -v "$PWD":/w -w /w -e npm_config_cache=/tmp/.npm \
  node:20-alpine npm install --package-lock-only --workspaces --include-workspace-root
```

Python pins are compiled from `.in` files with `pip-compile`, inside the same
base image the Dockerfile uses:

```bash
cd packages/mlflow-proxy
podman run --rm -v "$PWD":/w -w /w python:3.11-slim \
  sh -c "pip install -q pip-tools && pip-compile --strip-extras -o requirements.txt requirements.in"
```

Note that `garak` resolves slowly — it pulls in a large tree and pip spends a
long time backtracking. That is why it lives in its own requirements file and
behind the `INCLUDE_GARAK` build arg.

## Before you open a PR

- `helm lint charts/tableschnappi` passes, and `helm template` renders with
  every feature flag on.
- The Compose stack still comes up from a clean clone.
- **No cluster hostnames, tokens, or passwords.** Real values belong in your
  own untracked `.env` or `my-values.yaml`, both of which are gitignored. CI
  runs a secret scan and will fail the PR.
- New third-party code or assets get a row in [THIRD_PARTY.md](THIRD_PARTY.md).

## Things worth knowing

- `packages/mlflow-proxy` hosts the assistant: the system prompt, the
  tool-calling loop, and the guardrail shields. The name is historical — it
  does considerably more than proxy MLflow.
- The MCP server is a protocol wrapper over the same REST API the browser
  uses, so tool calls loop back through the backend.
- The reservation rules are enforced in code, not in the prompt. The gates are
  `tool_auth` and `_has_user_confirmation` in `packages/mlflow-proxy/app.py`,
  and `TOOL_ROLES` / `roleMayCall` in `packages/mcp-server/src/index.ts`.
- **There is no test suite.** No runner, no config, no `test` script — this
  asked for "a test case" for a long time against nothing to add one to. The
  only automated checks are the greps in `.github/workflows/ci.yml` and the
  post-install smoke hook, which curls health endpoints. If you change one of
  the gates above, say in the PR how you convinced yourself the bypass is
  closed; adding the first real test harness would be a welcome PR in itself.
