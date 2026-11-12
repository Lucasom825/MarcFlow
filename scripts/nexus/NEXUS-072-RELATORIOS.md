# NEXUS 072 — RESULTADOS REA POR EXECUÇÃO

Data de referência: 12/11/2026 (Brasília)
Estado: **implementado somente em branch experimental**. Ainda sem merge, sem deploy e sem homologação no Codespaces do usuário.

## Problema abordado
A execução real #43270659086 foi iniciada pelo botão NEXUS 071 e aprovada pelo GitHub Actions. O resumo público da execução foi publicado, mas a interface anterior mostrava apenas números agregados e uma recarga da página exigia refazer a pré-análise para voltar a acompanhar o run.

## Solução proposta
- Um novo painel único, de leitura apenas, consulta /api/nexus/rea/jobs/{id}, cujo backend valida origem GitHub, workflow, branch, event, ID e conteúdo publicado por run.
- Após recarregar, o parâmetro já existente `rea_run` recupera a execução sem nova solicitação ou novo consumo de processamento.
- A visualização expõe apenas evidências limitadas: arquivos, importações, dependências, módulos de maior centralidade estrutural, incógnitas semânticas, ressalvas, hash do resumo e ID de evidência.
- Nenhuma inferência sobre equivalência funcional, segurança, licença, execução ou reconstrução é apresentada como verificada.

## Piloto conhecido
REA workflow #43270659086; commit alvo Axios 4ee8d46fc463770b8f5da718d5449a5b027b2c08; pasta lib. Execução e publicação no GitHub: **SUCCESS**, resumo 72/72 JS, 200/200 locais de importação, 178 dependências internas, 7 ocorrências adicionais não reconciliadas. Isso NÃO mede funcionalidade do aplicativo.

## Barreiras mantidas
Não altera token, Auth.js, rate limit, endpoint de disparo, banco MySQL, editor, WhatsApp, serviços produtivos ou main. Lê resultados publicados apenas da branch REA 070 de forma delimitada. Porta Codespaces 39164 deve permanecer privada.

## Aceitação e próxima etapa
1. CI da branch deve passar com testes do novo painel, segurança existente e TypeScript.
2. Atualizar Codespaces de forma supervisionada na branch 072, preservando credenciais e volume.
3. Abrir /dashboard/nexus/rea?rea_run=43270659086; observar resultado recuperado antes de executar pré-análise.
4. Validar visualmente a lista de módulos com o JSON público e somente então fazer o segundo piloto em outro repositório público, licenciado e com escopo JS pequeno.
5. Qualquer merge/deploy produtivo depende de aprovação específica.

**Limite:** CI aprovada não equivale à prova de interface no navegador ou à execução de novo projeto.
