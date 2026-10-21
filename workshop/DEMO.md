# TableSchnappi — Presenter Demo Script

> **Note**: Replace `<CLUSTER_DOMAIN>` throughout this document with your actual OpenShift cluster domain (e.g. `ocp.example.sandbox1234.opentlc.com`).
>
> **This script is written against one specific cluster.** The model
> `llama-32-3b-instruct` in namespace `my-first-model` is what the author's
> workshop cluster served; nothing in the chart defaults to either any more,
> and yours will differ. Substitute your own `model.name` and the namespace
> your model lives in wherever they appear below. Everything else — the
> order of the demo, the talking points, the timings — transfers as written.

**Audience**: OpenShift AI workshop participants  
**Duration**: ~25 minutes  
**Pre-flight**: all services must be running; open the URLs in separate browser tabs before the session starts.

---

## Step 1 — Open the TableSchnappi app

**What to show**: navigate to `https://<release>-frontend-<namespace>.apps.<CLUSTER_DOMAIN>`

**What to say**: "This is Sakura Japanese Restaurant's table management app, built entirely on Red Hat OpenShift AI. Every component you're about to see — the language model, the guardrails, the MCP tools — runs on this cluster."

**Expected result**: the floor plan renders with coloured table tiles (green = available, red = occupied). Hovering a table shows a QR code and the current status (party size, time seated).

---

## Step 2 — Happy-path reservation via the chat widget

**What to show**: click any available (green) table → the reservation chat widget slides open in the right panel.

**What to say**: "Customers scan the QR code at their table, or staff use this panel. Watch the assistant ask for party size first — that's a hard rule we encoded in the system prompt."

**Expected result**:
1. Type: `I'd like to reserve a table`
2. Assistant replies asking for party size (not time, not name — party size first)
3. Type: `For 3 people at 7pm`
4. Assistant confirms availability, asks for a name
5. Type: `Maria Schmidt`
6. Assistant summarises all details and asks for confirmation

---

## Step 3 — Off-topic question blocked by NeMo Guardrails

**What to show**: in the same chat widget, without refreshing:

**What to say**: "Now watch what happens when someone goes off-script. The guardrails proxy intercepts the message before it ever reaches the LLM."

**Expected result**:
1. Type: `What's the weather like in Zürich today?`
2. Assistant replies with a polite refusal: something like "I'm here to help with restaurant reservations and menu questions. How can I help you with your visit?"
3. **The response is immediate** — because guardrails blocked it before calling the LLM, so there's no generation latency

> **Talking point**: The guardrails proxy sits at `http://tableschnappi-guardrails.tableschnappi.svc.cluster.local:80/v1` and exposes the same OpenAI-compatible API as vLLM. The frontend has no idea it's there.

---

## Step 4 — Inspect the MLflow trace

**What to show**: open the RHOAI Dashboard → `https://rhods-dashboard.apps.<CLUSTER_DOMAIN>` → Data Science Projects → **Experiments** tab → MLflow workspace `tableschnappi`

**What to say**: "Every chat turn is traced automatically. MLflow is the observability backbone — you can drill into every span, see the tool calls, and compare runs."

**Expected result**:
1. The `restaurant-chatbot-traces` experiment appears in the list
2. Click into the most recent run (named something like `chat-session-<timestamp>`)
3. The **Traces** tab shows a waterfall of spans: `system_prompt_load` → `guardrails_check` → `llm_call` → `tool_call: check_availability` → `llm_call` (second turn)
4. Clicking a span shows `inputs`, `outputs`, latency, and token counts
5. Point out the `tool_calls` key in the LLM span — it shows the exact JSON the model sent to `check_availability`

> **Talking point**: The model ID shown is `vllm-inference-1/llama-32-3b-instruct` — the LlamaStack provider prefix plus the model name.

---

## Step 5 — Prompt Registry

**What to show**: in the MLflow UI, click **Prompt Registry** (left sidebar) → click `restaurant-assistant-prompt`

**What to say**: "The system prompt isn't hardcoded. It's version-controlled in MLflow's Prompt Registry. The chatbot loads `@latest` at startup — so you can update the prompt without redeploying the app."

**Expected result**:
1. Version list shows `v1` (and `v2` if workshop participants have already run notebook 02)
2. Click `v1` → the full prompt template appears, including `{date}` and `{time}` template variables
3. The commit message reads: `v1 — initial production prompt from buildSystemPrompt()`
4. Tags show `restaurant: sakura`, `language: multilingual`

---

## Step 6 — Guardrails evaluation run

**What to show**: in MLflow, go back to the `restaurant-chatbot-traces` experiment → find the run named `guardrails-safety-eval`

**What to say**: "We ran a 20-prompt evaluation against the guardrails — 10 off-topic, 10 on-topic. The results are logged as metrics and as a downloadable JSON artifact."

**Expected result**:
1. **Metrics panel** shows:
   - `off_topic_block_rate: 1.000` (100%)
   - `on_topic_pass_rate: 1.000` (100%)
   - `guardrails_accuracy: 1.000`
2. **Artifacts** tab → click `eval_results.json` → the raw JSON shows every prompt, the model's response (truncated to 150 chars), and `"blocked": true/false`
3. Parameters panel: `model: llama-32-3b-instruct`, `guardrails_config: restaurant-rails`

> **Talking point**: participants will re-run this evaluation in notebook `03_guardrails_and_eval.ipynb` and see their own results appear here.

---

## Step 7 — GenAI Studio: live MCP tool call

**What to show**: RHOAI Dashboard → **GenAI Studio** → **Playground**

**What to say**: "GenAI Studio is the built-in playground for RHOAI 3.5. It uses the OGX Operator to connect to models deployed as AI asset endpoints, so you get access to all the models and MCP tools on this cluster without writing any code."

**Expected result**:
1. Click **Create playground**, select the Llama model deployed in your project
2. In the **MCP** tab (settings panel), enable **TableSchnappi-MCP-Server** and authorize it
3. In the chat input, type: `What restaurants do you have?`
4. Watch the tool call panel: the model calls `list_restaurants` → receives the JSON response → incorporates it into its answer
5. The final reply names the restaurant (Sakura Japanese Restaurant) with its address
6. If tracing is enabled, the trace for this playground session appears in MLflow

> **Talking point**: The MCP server exposes 7 tools: `list_restaurants`, `get_restaurant_status`, `check_table_availability`, `get_wait_time`, `make_reservation`, `get_menu`, `find_alternative_restaurant`. They're accessible to any MCP-compatible client — the playground, the chatbot, or a notebook.

---

## Step 8 — How to add a second LLM to MaaS

**What to say**: "Adding a second model is two steps: deploy an InferenceService for the new model, then patch one ConfigMap to tell LlamaStack it exists. That's it — no app restarts, no image rebuilds."

**What to show**: open a terminal or the OpenShift web console → Workloads → ConfigMaps → namespace `my-first-model` → ConfigMap `llama-stack-config`

**Expected result**: the YAML includes a `config.yaml` key with an `inference` section. Currently it looks like this:

```yaml
inference:
  providers:
    - provider_id: vllm-inference-1
      provider_type: remote::vllm
      config:
        url: http://llama-32-3b-instruct-predictor.my-first-model.svc.cluster.local:8080
models:
  - model_id: llama-32-3b-instruct
    provider_id: vllm-inference-1
    provider_model_id: llama-32-3b-instruct
    model_type: llm
```

To add Granite 3 8B, deploy its InferenceService (e.g. `granite-3-8b-instruct` in namespace `my-first-model`) then patch the ConfigMap to add:

```yaml
inference:
  providers:
    - provider_id: vllm-inference-1
      provider_type: remote::vllm
      config:
        url: http://llama-32-3b-instruct-predictor.my-first-model.svc.cluster.local:8080
    - provider_id: vllm-inference-2          # <-- new
      provider_type: remote::vllm
      config:
        url: http://granite-3-8b-instruct-predictor.my-first-model.svc.cluster.local:8080
models:
  - model_id: llama-32-3b-instruct
    provider_id: vllm-inference-1
    provider_model_id: llama-32-3b-instruct
    model_type: llm
  - model_id: granite-3-8b-instruct          # <-- new
    provider_id: vllm-inference-2
    provider_model_id: granite-3-8b-instruct
    model_type: llm
```

The LlamaStack pod picks up the ConfigMap change on its next sync (or restart it manually). The new model immediately appears in the GenAI Studio playground model selector.

```bash
# Patch command example:
kubectl patch configmap llama-stack-config \
  -n my-first-model \
  --type merge \
  -p '{"data": {"config.yaml": "<updated yaml here>"}}'
```

---

## Step 9 — Monitoring

**What to say**: "Three observability layers are active on this cluster."

**What to show**: briefly mention each — no need to navigate all three unless time allows.

| Layer | What it covers | How to access |
|-------|---------------|---------------|
| **MLflow** | LLM traces, tool calls, prompt versions, eval runs | RHOAI Dashboard → Experiments → MLflow workspace `tableschnappi` |
| **Prometheus / model serving metrics** | Tokens/sec, request latency, queue depth, GPU utilisation | Each predictor pod exposes `/metrics` on port 8080; query via the OpenShift monitoring stack or `kubectl port-forward` |
| **TrustyAI guardrails metrics** | Guardrails block rate, pass rate, request volume | TrustyAI operator surfaces Prometheus metrics for the guardrails deployment |

> **Known limitation on this cluster**: the RHOAI built-in metrics dashboard shows `supported: false` for the model serving graphs. This is a cluster-tier limitation — direct Prometheus queries work correctly. Use `kubectl port-forward svc/prometheus-operated 9090:9090 -n openshift-monitoring` and query `vllm_*` or `nemo_*` metrics directly.

---

## Quick-reference URLs

| Resource | URL |
|----------|-----|
| TableSchnappi app | https://<release>-frontend-<namespace>.apps.<CLUSTER_DOMAIN> |
| RHOAI Dashboard | https://rhods-dashboard.apps.<CLUSTER_DOMAIN> |
| MLflow | https://rh-ai.apps.<CLUSTER_DOMAIN>/mlflow |
| MLflow workspace | `tableschnappi` |
| vLLM predictor (cluster-internal) | `http://llama-32-3b-instruct-predictor.my-first-model.svc.cluster.local:8080` |
| Guardrails (cluster-internal) | `http://tableschnappi-guardrails.tableschnappi.svc.cluster.local:80/v1` |
| MCP server (cluster-internal) | `http://tableschnappi-mcp.my-first-model.svc.cluster.local:3000/mcp` |
| Notebook image | `image-registry.openshift-image-registry.svc:5000/redhat-ods-applications/s2i-generic-data-science-notebook:2025.2` |
