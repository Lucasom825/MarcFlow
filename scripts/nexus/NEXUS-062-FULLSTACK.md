# NEXUS 062 — E2E no editor original + HTTP autenticado + MySQL efêmero

**Data:** 10/11/2026. **Escopo:** teste reprodutível somente em GitHub Actions, sem merge/deploy nem conexões com produção.

## Evidência real

GitHub Actions [#42887521884](https://github.com/Lucasom825/MarcFlow/actions/runs/42887521884) — SUCCESS, HEAD `7b0d7bf5ed3bc82b5c3674be406484839e5ab11e`.

- 18/18 testes do conversor Drawflow → MarcFlow (NEXUS 057);
- 17/17 testes de contrato com validador do MarcFlow (NEXUS 058);
- 8/8 verificações HTTP *antes* da edição (autorização por API key real e dados sintéticos, 401/403/400 e preservação do banco);
- Chrome headless abriu o **FlowEditor original** com `ReactFlowProvider`, buscou o fluxo via `GET /api/flows/...` real do Next, adicionou um bloco com o botão original, o editor enviou `PUT /draft` real via HTTP e salvou no **MySQL 8 descartável**; recarregou e confirmou 3 blocos, 1 aresta, `draftRevision=1`, `publishedGraph=null` e `status=DRAFT`;
- 6/6 verificações HTTP *depois* do navegador (ler estado via Prisma e GET, recusar revisão obsoleta com 409, restaurar o snapshot conhecido como nova revisão com PUT e conferir isolamento de outra sessão);
- `NEXUS062_MAIN_AND_APP_TRACKED_SOURCES_UNCHANGED=true` após restaurar alterações temporárias do runner.

Artifact `nexus-062-fullstack-evidence` ID `13796018167` — SHA256 ZIP `53f09f2507c6d89cbbd7bf97c1a59c9dceb5ab9f436a48125873f19b616cb529` — evidências em screenshot, DOM e logs. O DOM foi inspecionado com atributos `data-nexus062=pass`, `nodes=3`, `edges=1`, `revision=1`, `realhttp=yes`, `published=false`. Artefato expira em 13/11/2026 (regerar pelo workflow se necessário).

## Arquitetura e isolamento

- A branch acrescenta apenas `scripts/nexus/seed-http-062.ts`, `fullstack-client-062.tsx`, `http-contract-062.ts`, esta documentação e `.github/workflows/nexus-062-fullstack.yml`.
- CI usa `services.mysql` local `127.0.0.1`, nome `nexus062`, credenciais **fictícias fixas para o runner**, duas contas fictícias com sessões `DISCONNECTED` e rascunhos separados. Não acessa WhatsApp ou contas do usuário.
- Durante o CI somente, layout/ícone são substituídos e o `src/proxy.ts` recebe exceção **exata** da rota pública de laboratório `/nexus-062-sandbox`, para abrir a página sintética. As rotas **reais** de API mantêm o `proxy`, `getAuthenticatedUser`, `resolveFlow`, Prisma e as permissões originais.
- O módulo de teste do navegador apenas injeta uma chave **de usuário fictício** na requisição `GET` / `PUT` do editor. **Não simula respostas**. Todas as demais rotas `/api/` e chamadas de `fetch` para outras origens são recusadas pela bancada.
- No final, todos os arquivos modificados apenas no runner são restaurados, e a guarda de integridade confirma que a branch não altera o código de produção.

## Limites e próximos gates

Esta é uma prova end-to-end real do **subfluxo de rascunho** na aplicação temporária: editor ↔ HTTP ↔ autenticação por chave ↔ MySQL. Não prova autenticação humana via cookies, o dashboard completo com contexto de sessão, execução de automações/WhatsApp, banco permanente, staging ou produção. A prévia foi gerada a partir de exemplo sintético anotado; não demonstra reengenharia semântica universal.

**Próxima fase NEXUS 063:** testar login real por cookie e controle de sessão com contas fictícias em staging temporário; revisar a importação no editor e cenários de falha/reconciliação; gerar relatório de rollback e obter autorização específica antes de qualquer merge/deploy. A correção da rota `draft/route.ts` é do PR #6 antecedente e também não foi integrada à main.
