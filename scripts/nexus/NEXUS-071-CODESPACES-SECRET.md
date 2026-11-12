# NEXUS 071 — Ligação opcional de autorização GitHub Codespaces -> REA

Data: 11/11/2026. **Somente branch experimental** NEXUS071, baseada em NEXUS070. Nenhuma alteração aplicada ao Codespaces existente sem ação explícita do usuário. Nenhum token foi criado, lido ou configurado nesta entrega.

## Falha identificada na prova de navegador

O NEXUS070 corretamente indica "integração de envio ainda não foi autorizada no servidor". Mas mesmo que um Codespaces Secret fosse criado, o `compose.demo-064.yml` original não o transmitia ao contêiner `app`; assim, o botão seguiria desabilitado. Não solicitar token antes de resolver esse encadeamento.

## Implementação NEXUS071

- Criado `scripts/nexus/compose.rea-071.secrets.yml`, arquivo de override **opcional** com Docker Compose Secret cuja fonte é a variável host `NEXUS_REA_DISPATCH_TOKEN` originada de GitHub Codespaces Secrets. O arquivo do token aparece **somente no contêiner** como `/run/secrets/nexus_rea_dispatch_token`, evitando token em `.env.nexus-demo`, Dockerfile, código, dump de ambiente do app ou UI.
- `start-codespace-066.sh` recebe o segredo do Codespaces quando a sessão for reiniciada e acrescenta o override apenas quando a variável existe e não está vazia. Sem segredo, continua usando apenas o Compose da demonstração, preservando o modo anterior.
- `src/lib/nexus-rea-general-070.ts` lê exclusivamente o caminho fixo do segredo montado pelo Docker. **Não aceita o segredo em variável direta do contêiner**, e falha fechado quando o arquivo está ausente ou é inválido. Testes usam função injetada, nunca credenciais reais.
- O envio continuará exigindo token granular do GitHub **Actions:write somente no fork Lucasom825/rea**, repositório público + SHA fixado + pasta validada, autorização Auth.js, origem correta, rate limit e workflow branch fixa. Nenhum dos controles anteriores foi retirado.
- Não toca na base MySQL, sessão WhatsApp, rascunhos de fluxo, publicação, importação, automações externas ou `main`.

## Configuração segura, somente após aprovação do usuário

1. Criar no GitHub um *fine-grained personal access token*, apenas para `Lucasom825/rea`, permissão de repositório Actions: **Read and write**, com expiração curta. Não habilitar `All repositories`. Se GitHub pedir outra permissão, verificar antes de ampliar.
2. No GitHub, em **Settings -> Codespaces -> Codespaces secrets -> New secret**, nomear `NEXUS_REA_DISPATCH_TOKEN`, colocar valor somente no formulário GitHub e permitir acesso **apenas** ao repositório `Lucasom825/MarcFlow` (onde o Codespaces está hospedado). Nunca enviar o token ao chat, Terminal, print, PR ou arquivo de projeto.
3. Parar e reiniciar o Codespaces (NÃO deletar), para injetar o segredo, conforme as regras do GitHub. O Codespaces recebe a variável host apenas após reiniciar.
4. Migrar à branch NEXUS071 por troca segura no Codespaces sem sobrescrever arquivos locais; executar o script habitual `bash scripts/nexus/start-codespace-066.sh`. Ele detecta a presença da variável sem imprimir seu valor, usa Compose Secret e deixa a porta **39164 PRIVADA**.
5. Testar no painel `/dashboard/nexus/rea` uma análise de repositório público pequeno e com licença validada. Verificar GitHub Actions real e relatório por run ID. Não interpretar "botão ativado" como prova de token válido ou trabalho concluído.
6. Revogar o token após a prova se não for necessário manter a integração; o fluxo sem segredo deve continuar funcionando em modo leitura.

## Cuidado e evidências

- Os segredos Codespaces só ficam disponíveis quando o Codespaces reinicia; eles não são passados automaticamente para contêineres Docker Compose.
- O GitHub Actions pode consumir minutos da conta. A interface precisa continuar privada e a autorização do token deve ser de escopo mínimo.
- O usuário mostrou anteriormente credenciais da demonstração numa captura; não reproduzir valores e não colocar o novo token no mesmo arquivo. Rotação das senhas anteriores exige plano/backup e autorização separada.
- GitHub Docs: https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces
- GitHub Actions dispatch permissions: https://docs.github.com/en/rest/actions/workflows?apiVersion=2026-03-10
- Docker Compose Secrets por environment: https://docs.docker.com/reference/compose-file/secrets/

Status: alterações de código + testes sintéticos; **autorização real, Codespaces 071 e despacho externo ainda não comprovados**.
