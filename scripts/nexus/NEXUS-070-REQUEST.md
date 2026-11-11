# NEXUS 070 — Solicitação supervisionada de REA para projetos públicos

**Data:** 11/11/2026. **Status:** branch experimental NEXUS 070, acima do NEXUS 069, sem merge nem deploy. O Codespaces atual do usuário continua no NEXUS 069 até uma troca explícita de branch.

## Entrega nesta fase

- A UI `/dashboard/nexus/rea` preserva a pré-análise, a publicação automática validada do Axios (069) e acrescenta cartão **Solicitar análise estática** do projeto selecionado e da pasta JavaScript previamente inventariada.
- A API do demonstrador cria a solicitação somente depois de **nova validação de repositório público, licença compatível, SHA de 40 caracteres idêntico ao commit atual, diretório JavaScript existente e escopo de edição**.
- Antes de encaminhar, exige sessão demo Auth.js e origem da requisição estritamente igual à do NEXUS; bloqueia requisições cruzadas, não permite URLs ou workflows arbitrários, aplica intervalo mínimo de 120 segundos por conta em memória.
- Para enviar de verdade, servidor precisa da variável de ambiente **NEXUS_REA_DISPATCH_TOKEN** (GitHub App ou token granular com **Actions:write exclusivamente no fork Lucasom825/rea**). **Não existe token configurado ou gravado nesta branch**. Nunca colocar credencial em `.env.nexus-demo`, código, GitHub pull request, browser, imagem ou chat. Usar recurso **Codespaces Secrets** se autorizado.
- O backend envia via GitHub API oficial apenas `ref=nexus/rea-public-jobs-070-20261111`, workflow `.github/workflows/nexus-rea-toolkit.yml`, inputs `target=public`, `repository`, `commit`, `directory`. Sem execução de código-alvo no aplicativo NEXUS.
- Quando a API do GitHub retorna `workflow_run_id`, UI acompanha a execução em `GET /api/nexus/rea/jobs/<run_id>` e retoma pelo parâmetro URL `rea_run` no navegador. Não depende de servidor persistente ou WebSockets. Para API antiga que retorna 204, interface mostra **enviado sem rastreabilidade automática**, nunca inventa run ID.
- A rota GET verifica estado real do workflow na branch correta. Somente com run **workflow_dispatch + completed/success** e resumo JSON publicado pela REA em `nexus-pilot/public-reports/by-run/<run_id>.json` exibe métricas, execução, alvo, commit e ressalvas.
- API read-only de status não usa o segredo de envio. Fuso do demo foi corrigido para `America/Sao_Paulo` e cabeçalho de página para NEXUS 070; comportamento do produto original MarcFlow fora do modo demo não muda.

## Integração necessária no fork REA

Branch **Lucasom825/rea:nexus/rea-public-jobs-070-20261111** altera somente o workflow já registrado na branch default `.github/workflows/nexus-rea-toolkit.yml` e adiciona o publicador `nexus-pilot/toolkit/publish-run-summary-070.mjs`.

- Análise real: segue `contents:read`, token GitHub temporário do job para metadados de repositório público, commit fixado e análise REA sem executar código externo.
- Etapa separada **publish-evidence-summary**: tem `contents:write` somente dentro do job, só quando `inputs.target=public`, evento `workflow_dispatch` e ref experimental exata; lê artifact gerado pela análise e publica APENAS resumo público, controlado e rastreável por run ID no próprio fork.
- Não importa secrets, WhatsApp, dados do usuário, nem executa o projeto selecionado.
- O GitHub Actions workflow `workflow_dispatch` existe no `main` da REA; sua execução numa branch alternativa por API segue regra oficial do GitHub quando configurado e autorizado. A versão experimental ainda **não foi disparada de ponta a ponta por um clique no NEXUS**, pois falta a credencial GitHub autorizada no Codespaces.
- Atenção: uso do GitHub Actions e Codespaces pode consumir cotas/minutos; não garantir custo zero ilimitado.

## Verificações de qualidade e estado

1. MarcFlow `.github/workflows/nexus-070-gate.yml`: testes mock do dispatch (host fixo, ref e inputs, ausência de credenciais), firewall demo GET/POST específico, status do run, falhas e resposta 204, TypeScript app, regressões NEXUS069/067/064, testes do editor e consulta real do relatório Axios.
2. REA `.github/workflows/nexus-070-publisher-tests.yml`: testes sem segredos com relatório sintético, recusando outra branch, alvo divergente, caminhos suspeitos e alegações de execução de código de terceiros.
3. Somente após sucesso das duas CIs, realizar prova no navegador da nova branch; a interface deve mostrar **integração ainda não autorizada** quando o segredo estiver ausente, e NÃO enviar requisições.
4. Para validar o clique automático real, o usuário deve autorizar a integração GitHub Actions e configurar segredo de maneira apropriada. Somente então solicitar um projeto não-Axios, confirmar run real e publicação individual. Nunca afirmar que essa etapa foi validada antes de comprová-la.
5. Ainda não temos reconstrução automática de apps, teste de comportamento, aprovação jurídica de licenças, multiusuário, histórico servidor persistente, nem execução assíncrona fora dos serviços Google/GitHub existentes.

## Instalação experimental, sem afetar volumes

Codespaces atual do usuário NEXUS069, porta 39164 privada. Para validar NEXUS070, depois da conclusão dos testes:
```bash
git fetch origin && git switch --track origin/nexus/rea-general-070-20261111 && bash scripts/nexus/start-codespace-066.sh
```
Trocar somente se o Git aceitar sem sobrescrever arquivos locais. Preservar `.env.nexus-demo` e volume MySQL; **não recriar Codespaces, não apagar banco, não fazer merge/produção**. Abrir `/dashboard/nexus/rea` no URL privado atual e confirmar UI, fuso e relatório Axios. Sem token seguro a solicitação deve permanecer desativada.

## Próximos passos

- Princípio: permissão mínima, isolamento e custo previsível; não aceitar senhas no chat.
- Testar primeiro com repositório público pequeno e licenciado, em branch isolada, após autorização explícita do segredo.
- Evoluir geração de relatórios e histórico de vários projetos com atenção a rate limiting, concurrência e licenças. Ainda não portar código de terceiros.
