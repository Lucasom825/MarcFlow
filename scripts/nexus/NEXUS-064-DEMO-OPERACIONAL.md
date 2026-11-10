# NEXUS 064 — demonstração local persistente, isolada e utilizável

**Estado:** proposta de demonstração em branch experimental, **não integrada à main**, não hospedada na nuvem e não implantada no computador do usuário. Esta documentação não autoriza deploy.

## O que esta versão entrega

O editor **original MarcFlow** com login por e-mail/senha via Auth.js, proteção de sessão real, banco MySQL 8 privado e **persistência de rascunhos entre reinicializações dos contêineres**. Uma conta e uma sessão **fictícias**, offline, são criadas apenas no primeiro início, com exemplo convertido do Drawflow. A senha é gerada aleatoriamente no computador do usuário.

**Não entrega:** interface unificada REA↔GitHub↔MarcFlow, importação universal ou automática de aplicativos, publicação de fluxos, disparo de mensagens, conexão WhatsApp, ambiente permanente na nuvem, versão de produção, automações habilitadas ou custo zero de infraestrutura remota.

O código original pertence ao projeto MarcFlow de Marcos Maia, sob licença MIT. Manter a licença e os avisos de autoria ao reutilizar ou distribuir. Nenhum código proprietário de terceiros deve ser importado com base somente no fato de estar público no GitHub.

## Instalação no Windows, sem deploy externo

Requisitos: PC Windows com Docker Desktop/Compose em funcionamento, espaço em disco para imagem Node 22 + MySQL, acesso à internet no primeiro build e PowerShell. O software pode ser usado localmente sem contratar hospedagem ou API paga; custos de hardware/energia e condições de licença do Docker não foram auditados.

1. No GitHub, acesse o **PR de demonstração NEXUS 064** e abra a branch `nexus/local-demo-064-20261110`. Baixe o ZIP dessa branch ou use Git para cloná-la. Não utilize `main` nem o `docker-compose.yml` da raiz do projeto.
2. Extraia a pasta. Abra um terminal PowerShell **dentro dela**. Execute:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\nexus\start-demo-064.ps1
   ```
3. O script gera `.env.nexus-demo` na pasta do repositório (excluído do Git e da imagem Docker), cria o MySQL **nexus_demo** num volume Docker exclusivo, prepara conta fictícia e inicia a interface apenas em **127.0.0.1:39164**. A senha gerada aparece no terminal; **não a compartilhe**.
4. Abra `http://localhost:39164/auth/login`. Faça login com e-mail **demo@nexus.invalid** e a senha exibida localmente. No painel, selecione a sessão fictícia offline se necessário e abra **Fluxos de conversa** → **Exemplo convertido — somente rascunho**. Link direto após login: `http://localhost:39164/dashboard/flows/nexus_demo_first_flow`.
5. Teste **Adicionar bloco → Conteúdo**, aguarde **Salvo**, recarregue com F5 e confirme se o bloco continua. Você também poderá criar rascunhos de fluxo. O sistema NÃO poderá publicar/ativar nem transmitir mensagens.
6. Para consultar status ou desligar preservando alterações:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\nexus\start-demo-064.ps1 -Status
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\nexus\start-demo-064.ps1 -Stop
   ```
   Execute novamente o comando de início para retornar aos **mesmos** dados. Não execute `docker compose down -v`: essa opção destrói o volume.

Se não tiver o Docker Desktop, esta etapa ainda não está disponível para uso no computador. A versão atual não fornece URL pública hospedada.

## Limites de segurança (implementados)

- Porta web só em `127.0.0.1:39164`, NÃO acessível por outro dispositivo ou internet; MySQL não possui portas publicadas.
- Aplicação inicia com `next dev --webpack` e **não** inicia o `src/server/index.ts` customizado, responsável pelo gerente WhatsApp e scheduler. É **desenvolvimento local**, nunca internet pública.
- Em `NEXUS_DEMO_ONLY=true`, o **proxy original** aplica uma allowlist estrita: Auth.js login/sair, leitura de sessões/notificações, listar/criar rascunhos na sessão sintética, ler metadados, ler rascunhos e salvar alterações de grafos. **Outros endpoints, incluindo registro, publicação, conexão WhatsApp, campanhas, disparos, updates, testes, exclusão e ativação, recebem HTTP 403.**
- O cadastro público também é desabilitado no `SystemConfig`. Os usuários sintéticos não possuem API key.
- Segredos da demonstração são gerados em `.env.nexus-demo`; o `.dockerignore` impede incorporar `.env*`, mídias, dados de sessões, backups e chaves ao build.
- A conta offline e o fluxo de demonstração são gerados por `demo-seed-064.ts`, que **recusa** qualquer banco diferente de `mysql://...@db:3306/nexus_demo`, usuário desconhecido, sessão conectada ou fluxo publicado. Restaurações e reinícios não sobrescrevem edições.
- Todas as alterações são propostas em branch separada `nexus/local-demo-064-20261110`, baseada no PR #8; nenhum merge/deploy produtivo foi executado.

## Verificação, backup e rollback

**Critério de aprovação da CI NEXUS 064:** rodar 18/18 regressões do conversor, 17/17 contratos, testes de política da API, validar e construir Docker Compose, abrir login HTTP, receber HTTP 401 sem sessão e 403 em rotas perigosas, criar rascunho fictício, alterar dado, executar `docker compose down` (sem `-v`), reiniciar, confirmar no Prisma que a revisão e o conteúdo continuam gravados e que o fluxo permanece DRAFT, sem WhatsApp.

**Restauração e reversão:** parar com `-Stop` (preserva volume); o código de produção `main` não mudou. Antes de migrar qualquer dado, criar backup físico e lógico verificado do **banco correspondente**. Neste laboratório não há migração de dados produtivos e nenhuma promessa de recuperação automatizada. O reset de volumes e exclusão de dados **não foram automatizados**. Se a demonstração falhar, pare os contêineres e preserve `.env.nexus-demo` e o volume; não compartilhe segredos ou logs com dados de usuários.

## Revisão de PRs e dependências

- PR **#1** NEXUS 049: validação reforçada independente contra `main`; **não incluído** automaticamente na cadeia abaixo, pode exigir revisão de conflito com `src/modules/flows/types.ts`.
- PR **#2** NEXUS 057: conversor Drawflow → MarcFlow limitado e verificável;
- PR **#3** NEXUS 058: contratos;
- PR **#4** NEXUS 059: laboratório visual;
- PR **#5** NEXUS 060: editor original em bancada;
- PR **#6** NEXUS 061: persistência MySQL e tratamento de revisão;
- PR **#7** NEXUS 062: HTTP de ponta a ponta com chave de teste;
- PR **#8** NEXUS 063: login real via cookie e correção do autosave espúrio;
- PR **#9** NEXUS 064: pacote de demonstração local persistente e sem WhatsApp.

Os PRs #2–#9 são **empilhados** por dependências experimentais; **não fazer merge de #9 diretamente na main sem revisão de todos os patches anteriores e do PR #1**.

## Pendências antes de liberar acesso externo ou ambiente de produção

Revisão de segurança de todas as rotas, bibliotecas e permissões; testes de acesso autenticado no pacote final; backups/recovery testados; atualização do `next dev` para build `next start` produtivo, com certificados HTTPS, monitoramento de vulnerabilidades, política de secrets, staging de longa duração, migração de dados e rollout/rollback. Integração REA/Toolkit de análise estática deve permanecer **leitura apenas, escopo limitado e revisão humana**. **Nenhum PR deve ser publicado em `main` ou implantado fora do ambiente privado sem autorização expressa.**
