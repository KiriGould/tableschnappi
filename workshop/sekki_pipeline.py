"""
Sekki Knowledge Ingestion -- Kubeflow Pipeline (KFP v2)
Follows opendatahub-io/data-processing patterns exactly.

REPO_URL is public, so stage 1 clones it anonymously and no credentials are
needed. If you fork into a private repository, set GITHUB_TOKEN on the
clone step yourself.

Run from a RHOAI workbench to compile and submit:

  pip install kfp==2.14.6        # add kfp-kubernetes only if you fork privately
  python3 workshop/sekki_pipeline.py                     # compile only -> sekki_pipeline.yaml
  python3 workshop/sekki_pipeline.py --submit             # compile + submit a one-off run
  python3 workshop/sekki_pipeline.py --submit-recurring   # compile + create a weekly recurring run
                                                           # (default: every Sunday 03:00 -- override
                                                           # with --cron="<expr>")

Pipeline stages:
  1. clone_repo      -- git clone tableschnappi from GitHub
  2. generate_pdfs   -- fpdf2: produce 24 sekki PDFs
  3. download_models -- docling model artifacts (cached)
  4. convert_docling -- Docling PDF -> markdown + JSONL chunks
  5. ingest_milvus   -- LlamaStack vector_io: chunks -> Milvus
  6. verify_and_log  -- test query + MLflow metrics


Keep this file ASCII-only. The compiled spec is stored in the Data Science
Pipelines MariaDB, whose PipelineSpec column rejects multi-byte characters --
an arrow or a kanji anywhere in here fails the upload with
"Error 1366 (22007): Incorrect string value". The Japanese content is not
affected: it lives in the PDFs and chunks this pipeline produces, not in the
pipeline definition.
"""

import os
from kfp import dsl, compiler

# -- Base images (matching opendatahub-io/data-processing) ---------------------
PYTHON_BASE_IMAGE  = os.getenv(
    "PYTHON_BASE_IMAGE",
    "registry.access.redhat.com/ubi9/python-311:9.6-1755074620",
)
DOCLING_BASE_IMAGE = os.getenv(
    "DOCLING_BASE_IMAGE",
    "quay.io/fabianofranz/docling-ubi9:2.54.0",
)

# -- Defaults -------------------------------------------------------------------
REPO_URL      = "https://github.com/KiriGould/tableschnappi"
LLAMASTACK    = os.environ.get("LLAMASTACK_BASE", "")
# Set MLFLOW_URI for your cluster (e.g. https://rh-ai.apps.<CLUSTER_DOMAIN>/mlflow)
MLFLOW_URI    = os.getenv("MLFLOW_URI", "")
MLFLOW_EXP    = "restaurant-chatbot-traces"
VS_NAME       = "sakura-sekki-knowledge"
EMBED_MODEL   = "ibm-granite/granite-embedding-125m-english"


# -- Stage 1: Clone repo --------------------------------------------------------

@dsl.component(
    base_image=PYTHON_BASE_IMAGE,
    packages_to_install=["gitpython"],
)
def clone_repo(
    repo_url: str,
    repo_dir: dsl.Output[dsl.Artifact],
):
    import os
    import subprocess
    from pathlib import Path

    dest = "/tmp/tableschnappi"

    # The repo is public, so this clones anonymously. If you fork privately,
    # set GITHUB_TOKEN on this step and the URL is rewritten to use it.
    token = os.environ.get("GITHUB_TOKEN", "")
    clone_url = repo_url
    if token and clone_url.startswith("https://"):
        clone_url = clone_url.replace("https://", f"https://{token}@", 1)

    subprocess.run(["git", "clone", "--depth=1", clone_url, dest], check=True)

    out = Path(repo_dir.path)
    out.mkdir(parents=True, exist_ok=True)
    (out / "repo_path.txt").write_text(dest)
    print(f"Cloned {repo_url} -> {dest}")  # never print clone_url -- it may embed a token


# -- Stage 2: Generate PDFs -----------------------------------------------------

@dsl.component(
    base_image=PYTHON_BASE_IMAGE,
    packages_to_install=["fpdf2>=2.7.9", "requests"],
)
def generate_pdfs(
    repo_dir: dsl.Input[dsl.Artifact],
    pdf_dir:  dsl.Output[dsl.Artifact],
):
    import subprocess, sys, os, urllib.request
    from pathlib import Path

    repo = Path(repo_dir.path, "repo_path.txt").read_text().strip()
    sys.path.insert(0, str(Path(repo) / "workshop"))

    out = Path(pdf_dir.path)
    out.mkdir(parents=True, exist_ok=True)

    # Download Noto Sans JP font (Unicode CJK support)
    font_path = "/tmp/NotoSansJP.ttf"
    if not Path(font_path).exists():
        print("Downloading NotoSansJP font...")
        urllib.request.urlretrieve(
            "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf",
            font_path,
        )

    env = {**os.environ, "SEKKI_PDF_OUT": str(out), "NOTO_FONT_PATH": font_path}
    result = subprocess.run(
        [sys.executable, str(Path(repo) / "workshop" / "generate_sekki_pdfs.py")],
        cwd=repo, env=env, capture_output=True, text=True,
    )
    print(result.stdout)
    if result.returncode != 0:
        print("STDERR:", result.stderr[-2000:])
        raise RuntimeError("PDF generation failed")

    pdfs = list(out.glob("*.pdf"))
    print(f"Generated {len(pdfs)} PDFs -> {out}")


# -- Stage 3: Download Docling models ------------------------------------------

@dsl.component(base_image=DOCLING_BASE_IMAGE)
def download_docling_models(
    artifacts_dir: dsl.Output[dsl.Artifact],
):
    # All imports inside component body -- KFP v2 requirement
    from pathlib import Path
    from docling.utils.model_downloader import download_models

    out = Path(artifacts_dir.path)
    out.mkdir(parents=True, exist_ok=True)
    download_models(output_dir=out, progress=True, with_layout=True, with_tableformer=True)
    print(f"Docling models downloaded -> {out}")


# -- Stage 4: Convert PDFs with Docling ----------------------------------------

@dsl.component(base_image=DOCLING_BASE_IMAGE)
def convert_with_docling(
    pdf_dir:        dsl.Input[dsl.Artifact],
    artifacts_dir:  dsl.Input[dsl.Artifact],
    chunks_dir:     dsl.Output[dsl.Artifact],
    embedding_model: str = "ibm-granite/granite-embedding-125m-english",
    max_tokens:     int = 400,
):
    import json
    from pathlib import Path
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.chunking import HybridChunker
    from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
    from transformers import AutoTokenizer

    pdf_path   = Path(pdf_dir.path)
    art_path   = Path(artifacts_dir.path)
    out_path   = Path(chunks_dir.path)
    out_path.mkdir(parents=True, exist_ok=True)

    # Configure Docling pipeline (CPU-safe)
    pipeline_options = PdfPipelineOptions()
    pipeline_options.artifacts_path = art_path

    converter = DocumentConverter(
        format_options={
            "pdf": PdfFormatOption(
                pipeline_cls=StandardPdfPipeline,
                pipeline_options=pipeline_options,
            )
        }
    )

    # HuggingFace tokenizer for semantic chunking -- must match the embedding
    # model's own tokenizer so token-count estimates are accurate (Docling's
    # own chunking guidance).
    hf_tokenizer = AutoTokenizer.from_pretrained(embedding_model)
    chunker = HybridChunker(
        tokenizer=HuggingFaceTokenizer(tokenizer=hf_tokenizer, max_tokens=max_tokens),
        merge_peers=True,
    )

    all_chunks = []
    pdfs = sorted(pdf_path.glob("*.pdf"))
    print(f"Converting {len(pdfs)} PDFs...")

    for pdf in pdfs:
        sekki_id = pdf.stem
        print(f"  {pdf.name}")
        result = converter.convert(str(pdf))

        # Save markdown alongside chunks
        md_path = out_path / f"{sekki_id}.md"
        result.document.save_as_markdown(md_path)

        for i, chunk in enumerate(chunker.chunk(result.document)):
            text = chunk.text.strip()
            if len(text) < 30:
                continue
            all_chunks.append({
                "id":       f"{sekki_id}__chunk_{i:03d}",
                "text":     text,
                "sekki_id": sekki_id,
                "source":   pdf.name,
            })

    # Write chunks JSONL (same pattern as opendatahub reference)
    jsonl_path = out_path / "sekki_chunks.jsonl"
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"Extracted {len(all_chunks)} chunks -> {jsonl_path}")


# -- Stage 5: Ingest into LlamaStack Milvus ------------------------------------

@dsl.component(
    base_image=PYTHON_BASE_IMAGE,
    packages_to_install=["httpx>=0.27"],
)
def ingest_to_vector_store(
    chunks_dir:          dsl.Input[dsl.Artifact],
    llamastack_base:     str,
    vector_store_name:   str,
    embedding_model:     str,
    vector_store_id_out: dsl.Output[dsl.Artifact],
):
    import json
    from pathlib import Path
    import httpx

    def get(path):
        r = httpx.get(f"{llamastack_base}{path}", timeout=30)
        r.raise_for_status()
        return r.json()

    def post(path, body):
        r = httpx.post(f"{llamastack_base}{path}", json=body, timeout=60)
        r.raise_for_status()
        return r.json()

    # Load chunks from JSONL
    chunks_path = Path(chunks_dir.path) / "sekki_chunks.jsonl"
    chunks = [json.loads(l) for l in chunks_path.read_text().splitlines() if l.strip()]
    print(f"Loaded {len(chunks)} chunks")

    # Get or create vector store (idempotent)
    existing = get("/v1/vector_stores?limit=100").get("data", [])
    vs = next((s for s in existing if s.get("name") == vector_store_name), None)
    if vs:
        vs_id = vs["id"]
        print(f"Using existing vector store: {vs_id}")
    else:
        vs_id = post("/v1/vector_stores", {
            "name":                vector_store_name,
            "embedding_model":     embedding_model,
            "embedding_dimension": 768,  # granite-embedding-125m-english output size
        })["id"]
        print(f"Created vector store: {vs_id}")

    # Skip already-ingested chunks (idempotent re-runs)
    try:
        existing_ids = {f["id"] for f in get(f"/v1/vector_stores/{vs_id}/files?limit=500").get("data", [])}
    except Exception:
        existing_ids = set()

    inserted = 0
    for chunk in chunks:
        if chunk["id"] in existing_ids:
            continue
        file_id = post("/v1/files", {
            "purpose": "assistants",
            "file":    chunk["text"],
            "filename": f"{chunk['id']}.txt",
        })["id"]
        post(f"/v1/vector_stores/{vs_id}/files", {"file_id": file_id})
        inserted += 1

    print(f"Inserted {inserted} new chunks ({len(chunks) - inserted} skipped)")

    out = Path(vector_store_id_out.path)
    out.mkdir(parents=True, exist_ok=True)
    (out / "vs_id.txt").write_text(vs_id)


# -- Stage 6: Verify + log to MLflow -------------------------------------------

@dsl.component(
    base_image=PYTHON_BASE_IMAGE,
    packages_to_install=["httpx>=0.27", "mlflow[kubernetes]>=3.11"],
)
def verify_and_log(
    chunks_dir:          dsl.Input[dsl.Artifact],
    vector_store_id_out: dsl.Input[dsl.Artifact],
    llamastack_base:     str,
    mlflow_uri:          str,
    mlflow_experiment:   str,
    mlflow_secret_path:  str = "/mnt/secrets",
):
    import json, os
    from pathlib import Path
    import httpx, mlflow

    vs_id  = (Path(vector_store_id_out.path) / "vs_id.txt").read_text().strip()
    chunks = [(Path(chunks_dir.path) / "sekki_chunks.jsonl").read_text().splitlines()]
    total  = len([l for l in chunks[0] if l.strip()])

    # Test query -- should return seasonal food knowledge
    r = httpx.post(
        f"{llamastack_base}/v1/vector_stores/{vs_id}/search",
        json={"query": "Major Heat eel unagi summer", "max_results": 3},
        timeout=15,
    )
    results = r.json().get("data", []) if r.status_code == 200 else []
    print(f"Test query returned {len(results)} results")
    if results:
        print(f"  Top hit: {results[0].get('content','')[:120]}")

    # MLflow logging
    os.environ["MLFLOW_TRACKING_AUTH"]         = "kubernetes-namespaced"
    os.environ["MLFLOW_K8S_INTEGRATION"]       = "true"
    os.environ["MLFLOW_TRACKING_INSECURE_TLS"] = "true"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment(mlflow_experiment)

    with mlflow.start_run(run_name="sekki-ingestion-pipeline"):
        mlflow.log_metrics({
            "chunks_total":       total,
            "query_results":      len(results),
            "vector_store_ready": 1 if results else 0,
        })
        mlflow.log_params({
            "vector_store_id":   vs_id,
            "source":            "KiriGould/tableschnappi",
            "pipeline_type":     "kubeflow-kfp-v2",
            "embedding_model":   "granite-embedding-125m-english",
        })

    print(f"\n{'='*50}")
    print(f"Vector store ID: {vs_id}")
    print(f"Set SEKKI_VECTOR_STORE_ID={vs_id} in the mlflow-proxy deployment")
    print("Logged to MLflow OK")


# -- Pipeline -------------------------------------------------------------------

@dsl.pipeline(
    name="sekki-knowledge-ingestion",
    description=(
        "One-time ingestion of 24 Japanese sekki (sekki) seasonal PDFs into "
        "LlamaStack Milvus via Docling. Enables seasonal RAG in the Sakura AI assistant."
    ),
)
def sekki_ingestion_pipeline(
    repo_url:           str = REPO_URL,
    llamastack_base:    str = LLAMASTACK,
    vector_store_name:  str = VS_NAME,
    embedding_model:    str = EMBED_MODEL,
    mlflow_uri:         str = MLFLOW_URI,
    mlflow_experiment:  str = MLFLOW_EXP,
):
    # Stage 1 -- public repo, cloned anonymously. If you fork privately, attach
    # your own Secret here with kfp.kubernetes.use_secret_as_env, mapping it to
    # GITHUB_TOKEN.
    clone = clone_repo(repo_url=repo_url)
    clone.set_caching_options(False)

    # Stage 2
    pdfs = generate_pdfs(repo_dir=clone.outputs["repo_dir"])
    pdfs.set_caching_options(False)
    pdfs.set_memory_request("512M").set_memory_limit("1G")
    pdfs.set_cpu_request("250m").set_cpu_limit("1")

    # Stage 3 -- model download (allow caching -- expensive and static)
    models = download_docling_models()
    models.set_memory_request("1G").set_memory_limit("4G")
    models.set_cpu_request("500m").set_cpu_limit("2")

    # Stage 4 -- Docling conversion (most expensive step)
    chunks = convert_with_docling(
        pdf_dir=pdfs.outputs["pdf_dir"],
        artifacts_dir=models.outputs["artifacts_dir"],
        embedding_model=embedding_model,
    )
    chunks.set_caching_options(False)
    chunks.set_memory_request("2G").set_memory_limit("6G")
    chunks.set_cpu_request("500m").set_cpu_limit("4")

    # Stage 5
    ingest = ingest_to_vector_store(
        chunks_dir=chunks.outputs["chunks_dir"],
        llamastack_base=llamastack_base,
        vector_store_name=vector_store_name,
        embedding_model=embedding_model,
    )
    ingest.set_caching_options(False)

    # Stage 6
    verify = verify_and_log(
        chunks_dir=chunks.outputs["chunks_dir"],
        vector_store_id_out=ingest.outputs["vector_store_id_out"],
        llamastack_base=llamastack_base,
        mlflow_uri=mlflow_uri,
        mlflow_experiment=mlflow_experiment,
    )
    verify.set_caching_options(False)


# -- Compile + optional submit --------------------------------------------------

if __name__ == "__main__":
    import sys

    os.makedirs("pipelines_gen", exist_ok=True)
    out_yaml = "pipelines_gen/sekki_pipeline.yaml"
    compiler.Compiler().compile(sekki_ingestion_pipeline, out_yaml)
    print(f"Compiled -> {out_yaml}")
    print("Upload this YAML in: RHOAI Dashboard -> Data Science Pipelines -> Import pipeline")

    if "--submit" in sys.argv or "--submit-recurring" in sys.argv:
        import kfp
        client = kfp.Client()

        if "--submit-recurring" in sys.argv:
            cron = next(
                (a.split("=", 1)[1] for a in sys.argv if a.startswith("--cron=")),
                "0 3 * * 0",  # every Sunday 03:00
            )
            job = client.create_recurring_run(
                experiment_id=client.create_experiment("tableschnappi-ingestion").experiment_id,
                job_name="sekki-ingestion-weekly",
                pipeline_package_path=out_yaml,
                cron_expression=cron,
                enable_caching=True,
            )
            print(f"Created recurring run: {job.recurring_run_id} (cron: {cron})")
        else:
            run = client.create_run_from_pipeline_package(
                out_yaml,
                run_name="sekki-ingestion-run",
                enable_caching=True,
            )
            print(f"Submitted run: {run.run_id}")
