# NEXUS 077 — proposta de integração de leitura com Memora 2 (RFC, NÃO IMPLEMENTADA)

Data: 12/11/2026 (Brasília).
Estado: **somente desenho técnico**. Nenhuma alteração de API, autenticação, rede, segredo, banco, Cloudflare, política de segurança, NEXUS produtivo ou Memora 2.

## Evidência do marco anterior

- O usuário enviou captura do NEXUS 076 no Codespaces. A interface mostrou os quatro cenários esperados: 1 PDF presente não validado, 1 análise em andamento, 1 reunião concluída sem PDF, 1 erro para investigar, e 0 operações de escrita.
- Isso comprova **renderização correta dos exemplos**; não comprova acesso ao Memora 2, disponibilidade de PDFs reais nem qualidade de atas.
- NEXUS 076 em PR draft #20: https://github.com/Lucasom825/MarcFlow/pull/20 .
- CI #43288019849 SUCCESS: https://github.com/Lucasom825/MarcFlow/actions/runs/43288019849 .
- A main do Memora 2 foi examinada no SHA `21f4f92bb2d827ce571d46abc27af8edad86965b` (12/11/2026).

## Contrato real analisado

Repositório privado `Lucasom825/memora-2-cloudflare`:
- `app/api/meetings/recent/route.ts` usa `getAuthenticatedUser()` e `listMeetingSummariesForOwner`, com `Cache-Control: private, no-store`.
- Endpoint `GET /api/meetings/recent` devolve até **3** reuniões na consulta padrão ou **8** com `includeProcessing=1`. Lista IDs, status, origem, data, versão e presença de PDF, **mas também inclui** nome do arquivo e diagnóstico de erro, que são metadados privados a evitar numa ponte de mínima exposição.
- `lib/auth.ts` aceita **cookie de sessão local assinado** ou **reivindicações de sessão Supabase** conforme ambiente. Isso é autenticação do próprio Memora 2, não autoriza automaticamente o NEXUS em outro host.
- O endpoint de detalhes `GET /api/meetings/[meetingId]` executa potencialmente `autoRecoverStalePdf` e `autoRecoverStaleAnalysis`, que podem gerar escritas ou disparar um Workflow. **Não usar como leitura passiva nem monitoramento.**
- O conector ChatGPT `Memora ia` apresenta dois links de conta com mesmo nome, sem confirmação de que qualquer um acessa este mesmo backend do Memora 2. Não presumir equivalência e não buscar registros privados arbitrariamente.

## Pergunta arquitetural

Como oferecer ao NEXUS uma visão mínima de estados de reuniões pertencentes ao usuário, **sem compartilhar cookies, senhas, transcrições, atas, nomes, erros internos ou acesso administrativo**?

### Alternativa A: ponte específica de metadados (recomendação condicionada à aprovação)

1. Criar no **Memora 2**, em branch experimental separada, um endpoint NOVO `GET /api/integrations/nexus/readiness`, somente leitura. Nunca adaptar o GET de detalhes auto-recuperável.
2. A autenticação deverá permitir **consentimento do usuário e escopo exclusivo de um proprietário**. Escolher mecanismo de autorização assinado e revogável, com validade curta. Um segredo de serviço amplo, acesso a todo o armazenamento, cookie copiado ou bearer sem vínculo ao proprietário **não são aceitáveis**.
3. A resposta deve conter apenas um conjunto limitado de campos de estado técnico: identificador opaco para exibição, `source`, `status`, `createdAt`, `pdfVersion`, `hasSavedPdf`. Nunca incluir `originalName`, `error`, áudios, transcrições ou documentos.
4. Aplicar `Cache-Control: private, no-store`, autenticação estrita, rate limit, timeout curto, limites de resposta, métodos GET/HEAD conforme contrato e respostas 401/403/429 sem vazamento de dados.
5. O NEXUS deve chamar a API **somente do servidor**, com allowlist de origem exata (sem URL arbitrária do usuário), configuração desligada por padrão e credenciais exclusivamente no ambiente seguro, nunca cliente/browser ou PR.
6. Garantir também que o proxy de leitura do NEXUS **autentique o usuário NEXUS**, não repasse credenciais de terceiros, nunca armazene dados privados em seu banco ou logs e não exponha conteúdo em modo demo.
7. Proteger contra SSRF, replay, confusão entre proprietários, acesso de outras contas, aumento de privilégio, indisponibilidade e recusa de autorização; falhar fechado.
8. **Nenhuma alteração produtiva e nenhuma credencial** até aprovação específica do usuário sobre esse desenho e seus riscos.

### Alternativa B: consulta pelo conector ChatGPT (sem alterar as APIs do Memora 2)

- Validar qual dos dois vínculos `Memora ia` corresponde à instância real; não assumir.
- Uma leitura pelo ChatGPT não torna os dados acessíveis automaticamente ao site NEXUS/Codespaces.
- Sem mecanismo seguro de transferência autorizado, esta alternativa pode servir para auditoria pontual no chat, **não** para dashboard autônomo.

## Gates de desenvolvimento após autorização específica

**Gate 0** — autorização do usuário para **desenvolver apenas em branch**, nunca para deploy ou emissão de credenciais. Validar qual ambiente do Memora 2 está ativo.

**Gate 1** — especificação e testes de segurança do endpoint de metadados com identidades fictícias: sem sessão => 401; sessão de outro proprietário => 403/sem dados; revogado => 401; token expirado => 401; método de escrita => 405; pedido fora do limite => rejeição; resposta inclui apenas campos permitidos; nenhum GET de detalhe e nenhuma operação de gravação.

**Gate 2** — CI Memora 2 + CI NEXUS em branches distintas; revisão do código da autenticação, limites de custo e quotas Cloudflare.

**Gate 3** — teste isolado com reunião **sintética ou expressamente autorizada**, sem nomes e sem upload de áudio. Verificação cruzada da resposta e ausência de gravações.

**Gate 4** — pedir autorização **separada** para instalar credencial de mínimo privilégio, alterar segurança ou publicar em ambiente produtivo, com plano de rollback, revogação e auditoria.

**Gate 5** — após leitura autenticada funcionar, considerar integração de tarefas apenas depois de reconciliar o modelo real de tarefas do Memora 2 e validar idempotência; sem automatizar criação/alteração.

## Decisão atual

**Próxima etapa tecnicamente útil: desenhar e testar a ponte de metadados em ambiente experimental, após autorização explícita para mexer no mecanismo de segurança.**

Até lá, NEXUS 076 continua a demonstrar estados com dados fictícios e serve como contrato de interface. Os resultados de testes e código da REA não justificam afirmar que o Memora 2 está conectado.

## Fontes verificadas

- MarcFlow PR #20: https://github.com/Lucasom825/MarcFlow/pull/20
- CI NEXUS 076: https://github.com/Lucasom825/MarcFlow/actions/runs/43288019849
- Origem privada Memora 2: https://github.com/Lucasom825/memora-2-cloudflare
- `main` do Memora 2 no SHA `21f4f92bb2d827ce571d46abc27af8edad86965b` (consulta na sessão atual).
