#!/usr/bin/env bash
set -euo pipefail

# Cloud Agent dependency setup for the Echo monorepo.
#
# Installs the offline JS/TS projects that need no external credentials:
#   - extension/                     Plasmo Chrome MV3 product (primary)
#   - evals/recall-benchmark/        Offline BM25/vector recall benchmark
#   - experiments/echo-rag-evaluation/  Retrieval + grounded-generation eval lab
#
# experiments/vector-recall-tidb/ is intentionally skipped: it is a throwaway
# experiment that requires external TiDB Cloud credentials to run.
#
# npm install (not npm ci) is used on purpose: the committed lockfiles are
# slightly out of sync with package.json (transitive esbuild drift), and the
# repo conventions forbid rewriting lockfiles during setup.

install_dir() {
  local dir="$1"
  echo "[install] npm install in ${dir}"
  ( cd "${dir}" && npm install --no-audit --no-fund )
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

install_dir extension
install_dir evals/recall-benchmark
install_dir experiments/echo-rag-evaluation

echo "[install] done"
