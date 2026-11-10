# NEXUS 058 — Homologação cruzada do conversor Drawflow → MarcFlow

**Escopo:** somente verificação local da prévia JSON. Não altera editor, API, banco de dados, WhatsApp ou produção. Esta prova é incremental ao PR #2 (NEXUS 057), que continua em rascunho.

## Como usar

```sh
node scripts/nexus/convert-drawflow.mjs scripts/nexus/exemplo-drawflow-anotado.json /tmp/nexus-preview.json
node --experimental-strip-types scripts/nexus/verify-preview.mjs /tmp/nexus-preview.json
node --experimental-strip-types --test scripts/nexus/test-marcflow-contract.mjs
```

O verificador carrega **diretamente** `src/modules/flows/types.ts` e chama `validateGraph` e `outputsOf` reais. A CI executa o mesmo teste também contra o validador da revisão imutável `6ed8c6b9b0ccf56dc3b41f2c618aed933fe7d566` do PR #1, isoladamente, sem fazer merge.

- Recusa nó/tipo/posição/ação/saída não suportado, IDs duplicados, portas inexistentes, conexões para o início e múltiplos destinos por saída.
- Preserva avisos de blocos desconectados; erros de `validateGraph` bloqueiam a prévia.
- Mesmo que o JSON declare origem, a **autenticidade não é verificada**. `graphContractValid=true` **não** significa aprovação para publicação ou equivalência de execução.
- Testes usam um Drawflow sintético anotado `nexus.marcflow.v1`; exportações genéricas sem semântica explícita permanecem **não convertíveis**.
- Nenhum teste de navegador, banco de dados, execução de fluxos reais nem WhatsApp foi feito.

### Próximos gates antes de produção
Concluir CI, verificar o resultado do HEAD exato, testar a UX e fluxos de cliente anonimizados em ambiente isolado, revisar segurança/semântica dos mapeamentos e obter autorização específica para integração, merge e deploy.

Fonte Drawflow (MIT) fixada: https://github.com/jerosoler/Drawflow/tree/ef8a88cdfbf2010cc0b641b94278be6db413938b

REA Toolkit Drawflow: https://github.com/Lucasom825/rea/actions/runs/42871873437
