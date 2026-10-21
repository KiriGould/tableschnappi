# Security Policy

## What this project is

TableSchnappi is a **demo and workshop application**. It exists to show how an
LLM assistant behaves under adversarial pressure, and it is deliberately easy
to poke at. It is not hardened for production and should not be deployed with
real customer data.

Specifically, and by design:

- **The staff dashboard and management API are unauthenticated.** Anyone who
  can reach the app can confirm, seat, or cancel reservations. This keeps the
  workshop frictionless; it is not an oversight.
- **The app ships an attack demo.** The floating pet in the customer view
  (`packages/frontend/src/components/AttackDemo.tsx`) fires prompt-injection
  attempts at the live assistant so attendees can watch the guardrails work.
  The prompts in it are intentional, and original to this project.
- **Reservation data is in memory** and resets whenever the backend restarts.
- **Chat requires an external model.** The assistant will happily tell you it
  is unavailable if you have not pointed it at one.
- **The guardrails shield fails open.** If the guardrails pod is unreachable
  the assistant logs a warning and lets the turn through rather than refusing
  it. That is the right trade for a demo whose job is to keep answering, and
  the wrong one for production. On the Compose and MaaS profiles there is no
  shield at all — the in-code reservation checks still apply, and the attack
  demo says so rather than reporting the model as jailbroken.

## Reporting a vulnerability

If you find a real vulnerability — something beyond the intentional behaviour
above — please report it privately rather than opening a public issue:

Open a [private security advisory](https://github.com/KiriGould/tableschnappi/security/advisories/new).
That channel is private to you and the maintainer, and it is the only one —
there is deliberately no email address here to go stale.

Please include the deployment path you used (Compose, minimal cluster, or full
workshop), the model backend, and the steps to reproduce.

This is a side project, so there is no SLA. Expect a response in days rather
than hours.

## MCP tool access is role-scoped

The MCP server exposes reservation tools, and until recently every caller got
every tool — the tool list *was* the only authorisation boundary, and it was
the same list for everyone. That mattered because the chart can register this
server into the RHOAI GenAI Studio playground cluster-wide, and the playground
talks to MCP directly, bypassing the assistant and therefore bypassing the
confirmation gate, field validation and one-mutation-per-turn rule that live
in `packages/mlflow-proxy/app.py`.

Callers now present a role via the `X-TableSchnappi-Role` header:

| Role | Tools |
|---|---|
| `readonly` (**default**) | the six read tools |
| `guest` | the above plus `make_reservation`, `modify_reservation` |
| `staff` | reserved for future confirm / seat / cancel tools |

A caller that presents no role gets `readonly`, so an unauthenticated
playground user can look but not book. The assistant identifies itself as
`guest`.

Discovery and enforcement are deliberately separate: `tools/list` is filtered
*and* every call is re-checked. Filtering the list only hides a tool — the
September assessment showed the model inventing tool names and invoking them.

The header is trusted because everything in front of this service is
in-cluster. For a real deployment the role should come from an authenticated
identity at the gateway (this cluster runs the MCP gateway and Authorino),
not from a header the client sets.

## Guardrails are not a security boundary

The assistant enforces its reservation rules in application code
(`packages/mlflow-proxy/app.py` — confirmation checks, one mutation per turn,
field validation) rather than relying on the system prompt. NeMo Guardrails
adds a topical filter on top. Neither is a substitute for authentication and
authorisation, and this demo has neither. Treat any deployment as public.
