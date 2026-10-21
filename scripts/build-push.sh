#!/usr/bin/env bash
# Build and push the TableSchnappi images.
#
# CI does this automatically on pushes to main (.github/workflows/build-push.yml).
# Use this script when you want to publish images from your own machine to your
# own registry — for example after forking.
#
# Usage:
#   QUAY_ORG=myorg ./scripts/build-push.sh
#   QUAY_ORG=myorg TAG=v1.2.3 ./scripts/build-push.sh
#   QUAY_ORG=myorg IMAGES="backend frontend" ./scripts/build-push.sh
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
: "${QUAY_ORG:?Please set QUAY_ORG (your Quay.io org or username)}"
TAG="${TAG:-latest}"
REGISTRY="quay.io/${QUAY_ORG}"

# Build context differs per image: mlflow-proxy and garak have Dockerfiles that
# COPY with no path prefix, so their context is their own directory. The three
# JS images COPY from the repo root because they share the npm workspace
# lockfile. This mirrors the matrix in .github/workflows/build-push.yml.
#   name|image-suffix|dockerfile|context
ALL_IMAGES=(
  "backend|tableschnappi-backend|packages/backend/Dockerfile|."
  "frontend|tableschnappi-frontend|packages/frontend/Dockerfile|."
  "mcp|tableschnappi-mcp|packages/mcp-server/Dockerfile|."
  "mlflow-proxy|tableschnappi-mlflow-proxy|packages/mlflow-proxy/Dockerfile|packages/mlflow-proxy"
  "garak|tableschnappi-garak|packages/garak/Dockerfile|packages/garak"
)

# ── Detect container runtime ─────────────────────────────────────────────────
if command -v podman &>/dev/null; then
  RUNTIME=podman
elif command -v docker &>/dev/null; then
  RUNTIME=docker
else
  echo "Neither podman nor docker found." >&2
  exit 1
fi

# ── Guard: run from project root ─────────────────────────────────────────────
if [[ ! -f package.json ]]; then
  echo "Run this script from the project root (where package.json lives)." >&2
  exit 1
fi

# garak is NOT in the default set. It pins torch from the PyTorch CPU index
# for amd64 only (see packages/garak/requirements.in), and building it under
# emulation takes hours. Build it on the cluster instead — see the README —
# or ask for it explicitly with IMAGES="garak".
SELECTED="${IMAGES:-backend frontend mcp mlflow-proxy}"

# OpenShift nodes are linux/amd64. Without this an Apple Silicon laptop
# silently builds arm64 images that push fine and then never schedule.
PLATFORM="${PLATFORM:-linux/amd64}"

echo "Runtime : ${RUNTIME}"
echo "Registry: ${REGISTRY}"
echo "Tag     : ${TAG}"
echo "Images  : ${SELECTED}"
echo "Platform: ${PLATFORM}"
echo ""

built=()
for entry in "${ALL_IMAGES[@]}"; do
  IFS='|' read -r name suffix dockerfile context <<< "$entry"
  [[ " ${SELECTED} " == *" ${name} "* ]] || continue

  image="${REGISTRY}/${suffix}:${TAG}"
  echo "Building ${name} -> ${image}"
  ${RUNTIME} build --platform "${PLATFORM}" \
    --file "${dockerfile}" --tag "${image}" "${context}"
  built+=("${image}")
  echo ""
done

for image in "${built[@]}"; do
  echo "Pushing ${image}"
  ${RUNTIME} push "${image}"
done

# ── Post-push instructions ───────────────────────────────────────────────────
cat <<EOF

Done. To deploy with your images, set the registry and tag:

  helm upgrade --install tableschnappi charts/tableschnappi \\
    --set image.registry=${REGISTRY} \\
    --set image.tag=${TAG} \\
    -f charts/tableschnappi/values-maas.yaml \\
    --set rhoai.appsDomain=<your-apps-domain>

To update a running deployment in place:

  oc rollout restart deployment -l app.kubernetes.io/name=tableschnappi

Get the public URL:

  oc get route tableschnappi-frontend -o jsonpath='{.spec.host}'
EOF
