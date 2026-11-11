#!/usr/bin/env bash
set -euo pipefail
if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "Esta configuração foi criada apenas para GitHub Codespaces."; exit 0
fi
echo "NEXUS Codespaces — preparação de demonstração: ambiente criado."
echo "Nenhum aplicativo é iniciado automaticamente para evitar consumo de recursos."
echo "Próxima etapa após verificar o limite de custo: bash scripts/nexus/start-codespace-066.sh"
