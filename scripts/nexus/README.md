# NEXUS 057 — Drawflow → MarcFlow: conversão assistida e segura

**Estado:** protótipo experimental isolado, sem integração ao editor ou ao backend de produção.

## Por que existe

O MarcFlow **já usa React Flow**. Substituir seu editor pelo Drawflow seria duplicar uma interface pronta. A utilidade demonstrável aqui é traduzir a estrutura de grafos de uma exportação Drawflow para o `FlowGraph` do MarcFlow, somente quando os blocos têm semântica explicitamente anotada.

O Drawflow [MIT, commit fixado](https://github.com/jerosoler/Drawflow/tree/ef8a88cdfbf2010cc0b641b94278be6db413938b) exporta `drawflow.Home.data`, `inputs`, `outputs`, `pos_x` e `pos_y`. O MarcFlow usa `nodes`, `edges`, `sourceHandle` e semântica própria de WhatsApp. **Nomes, HTML e aparência visual do Drawflow não provam equivalência entre os dois formatos.**

## Funcionamento

1. Exige anotações explícitas `data.nexus_marcflow` por bloco, com `schema:"nexus.marcflow.v1"`, `type`, `payload` e `outputHandles`. Isto é um **contrato adicional do NEXUS**, não parte da biblioteca original nem de arquivos Drawflow comuns.
2. Aceita apenas blocos `start`, `content` (até 20 mensagens de texto válidas), `action` (somente `resumeAutomation`) e handle `next` nesta primeira prova. Outros tipos são recusados, não inferidos.
3. Reconcilia conexões de ida e volta, evita ligações órfãs e múltiplos destinos pela mesma saída e identifica blocos desconectados.
4. Desconsidera HTML arbitrário e classes. Não executa scripts, não chama rede, não acessa DB, não publica fluxos e não envia WhatsApp.
5. Produz **prévia** com `ok`, `graph`, `issues`, `warnings` e provenance; entradas não são autenticadas automaticamente.

## Teste e uso local

```bash
node --test scripts/nexus/test-drawflow-converter.mjs
node scripts/nexus/convert-drawflow.mjs entrada.json saida-preview.json
```

A CLI recusa arquivo maior que 500 kB e não sobrescreve saída existente. A entrada deve ser um JSON Drawflow exportado, com anotações do contrato acima. **Não importe diretamente a saída na produção**, pois a integração real do MarcFlow requer validação completa de esquema, revisão de mensagens, decisão de usuário e testes de banco/editor.

## Limitações, próxima aprovação

- A execução REA Toolkit #11 [42871873437](https://github.com/Lucasom825/rea/actions/runs/42871873437) confirmou análise estática sobre `jerosoler/Drawflow`, não execução real de fluxo Drawflow nem reconstrução universal. O formato foi confirmado por inspeção do `src/drawflow.js` fixado; testes do conversor usam fixtures independentes, **não o navegador original**.
- A migração genérica de flows sem `data.nexus_marcflow` é **INCOMPATÍVEL POR PADRÃO**: exige levantamento de semântica e mapeamento individual.
- Não foram executados testes de integração React Flow no navegador, banco de dados ou WhatsApp.
- Antes de promover código para `src/` ou conectar ao editor, testar mais tipos de bloco, compatibilidade com grafos reais, UI, prevenção de XSS, contrato de validação e autorização específica de merge/deploy.
- PR anterior de integridade do MarcFlow permanece independente: não introduzir migrações silenciosas nem modificar sua branch/PR.
