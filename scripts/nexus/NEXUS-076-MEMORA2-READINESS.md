# NEXUS 076 — contrato de leitura do Memora 2

Data: 12/11/2026 (Brasília)
Estado: experimental, sem merge ou deploy produtivo.

## Sistema escolhido
O usuário confirmou que usa o Memora 2, representado pelo repositório privado `Lucasom825/memora-2-cloudflare`. Contrato consultado na main, SHA `21f4f92bb2d827ce571d46abc27af8edad86965b`.

Fonte do formato analisado: `app/api/meetings/recent/route.ts` e `lib/meetings.ts`. O endpoint requer autenticação, filtra reuniões pelo usuário e devolve no máximo 3 itens padrão ou 8 com `includeProcessing=1`. Campos observados: `id`, `source`, `status`, `originalName`, `createdAt`, `pdfVersion`, `hasSavedPdf`, `error`. Não é um inventário completo de histórico.

## Descobertas que alteram o plano anterior
1. O projeto Memora 2 inspecionado documenta modelo de reuniões e estados de pipeline. A interface de tarefas do plugin `Memora ia` existente no ChatGPT não foi demonstrada como pertencente à mesma implantação do Memora 2. Não usar o plugin como substituto de leitura comprovada do Memora 2 sem verificar conta, base e esquema.
2. `GET /api/meetings/recent` usa leitura de índice autenticado; é a referência para um futuro conector de metadados. **Não há ligação implementada nesta fase**.
3. `GET /api/meetings/[meetingId]` pode chamar `autoRecoverStalePdf` e `autoRecoverStaleAnalysis`. Portanto, essa leitura pode produzir mudanças e despachar workfows. Não tratá-la como consulta livre de efeitos colaterais.
4. `PROCESSED` e `hasSavedPdf=true` significam apenas registro e artefato presentes, **não** qualidade, fidelidade nem revisão humana aprovada.
5. Nomes originais, erros internos e outros metadados privados são removidos pelo adaptador antes de formar o resultado.

## O que foi criado
- Adaptador puro de entrada JSON limitada a oito resumos com estados já enumerados no Memora 2.
- Classificação limitada: PDF presente (não verificado), processamento em andamento, concluído sem PDF confirmado e erro sob investigação.
- Interface demonstrativa, com quatro reuniões **fictícias**, sem leitura de dados reais.
- Testes de formato, rejeição de dados inválidos, descarte de nome/erro e zero chamadas de rede.
- Sem alteração no Memora 2, endpoints de escrita, banco, arquivos de áudio, token, credenciais, Cloudflare, WhatsApp ou produção.

## Condições para acesso real, ainda não satisfeitas
- Confirmar o método legítimo de autenticação entre o Codespaces e o Memora 2; não reutilizar automaticamente credenciais da conta ChatGPT, nem publicar tokens ou abrir a porta privada.
- Começar apenas com os metadados estritamente necessários; não puxar áudio, transcrição, atas, nomes ou detalhes sensíveis.
- Conferir limites, paginação, proprietário de cada reunião e origem dos registros, e evitar GET de detalhe com recuperação implícita.
- Teste de ponta a ponta autorizado e verificado antes de qualquer sincronização; integrar tarefas somente após contrato de dados verdadeiro, sem pressupor equivalência do plugin `Memora ia`.
- Aprovação específica antes de modificar produção, contas, segurança ou dados reais.

## Aceitação
CI verde em branch 076 + teste visual supervisionado da página:
`/dashboard/nexus/rea/memora2-readiness`.
Contagens esperadas nos dados fictícios: 1 PDF presente, 1 em andamento, 1 concluído sem PDF e 1 erro. A página deve informar **não conectada** e **0 escritas**.

Nenhum resultado positivo aqui comprova qualidade da ata nem serviço real integrado. Próxima decisão: como autenticar de forma segura uma leitura real do Memora 2, sem expandir escopo ou custo.
