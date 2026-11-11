# NEXUS 065 — diagnóstico de login da demonstração local (Windows)

**Sintoma:** tela em `http://localhost:39164/auth/login` abre, mas o login não é aceito, ou a instalação reiniciada não conecta ao banco.

## O que foi investigado

O projeto usa o **mesmo volume Docker persistente** `nexus064-demo_demo_mysql_data` em diferentes extrações ZIP, enquanto cada pasta tem o próprio arquivo de senhas `.env.nexus-demo`. Se a pasta for reextraída ou o arquivo for regenerado, as credenciais poderão divergir do usuário bcrypt que já está no MySQL (e até do usuário do próprio MySQL). Essa é uma **hipótese técnica**, não uma confirmação da causa no PC do usuário.

A conta única da demonstração é `demo@nexus.invalid`. A senha está no arquivo local `.env.nexus-demo`, chave `NEXUS_DEMO_PASSWORD`, e não deve ser enviada em chats nem screenshots.

## Recuperação sem excluir rascunhos

Na pasta **mais recente** do pacote `nexus/local-login-recovery-065-20261111`, com Docker Desktop ligado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\nexus\start-demo-064.ps1 -DiagnoseLogin
```

O diagnóstico verifica a identidade do banco local `db/nexus_demo`, usuário único fictício, sessão desconectada, cadastro bloqueado e que todos os fluxos continuam como rascunho, antes de comparar o hash bcrypt sem exibir senha:

- `NEXUS065_LOCAL_LOGIN_CREDENTIALS_MATCH=true`: a senha do arquivo local corresponde à do banco. Se o navegador continuar recusando, abrir **http://localhost:39164/auth/login** em janela anônima, sem trocar para `127.0.0.1`; confirmar que o aplicativo está saudável com `-Status`. Capturar a **mensagem de erro** sem senha/cookie.
- `NEXUS065_LOCAL_LOGIN_CREDENTIALS_MISMATCH=true`: a senha do arquivo local difere da gravada. O diagnóstico NÃO altera dados. Para autorizar somente a sincronização da senha do **usuário fictício**, executar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\nexus\start-demo-064.ps1 -RepairLogin
```

Esse segundo comando, escolhido expressamente pelo usuário, modifica **somente o hash de senha da conta demo** no banco identificado, mediante guarda de sessão desconectada e ausência de publicação. Não apaga, recria ou modifica rascunhos, fluxos ou sessões. Ao concluir, retomar o login com a senha **que já está no arquivo local `.env.nexus-demo`**.

### Se o Docker não iniciar

Se o volume `nexus064-demo_demo_mysql_data` existir mas a pasta atual não tiver `.env.nexus-demo`, o instalador **agora recusa criar segredos diferentes**. A recuperação segura é localizar a pasta da instalação anterior e reutilizar **o arquivo `.env.nexus-demo` que foi usado na criação desse banco**. Não envie o arquivo para o ChatGPT; mantenha-o no seu computador.

Se já houve troca da senha interna do MySQL por engano, o diagnóstico pode ficar inacessível até que o arquivo original seja recuperado. Não executar `docker compose down -v`, `docker volume rm` nem apagar o banco: isso destruiria os rascunhos. Não oferecer reset de volume como primeiro reparo.

## Limites

O teste reproduzido no GitHub usa apenas MySQL descartável e usuários fictícios. **Não temos acesso ao Docker do computador do usuário**, portanto o motivo específico de seu erro permanece incerto até a execução do diagnóstico local.

A recuperação da senha não torna o NEXUS/REA um sistema integrado ou ativo em produção; o código de recuperação permanece em branch experimental, sem merge/deploy. Não vincular WhatsApp nem habilitar publicação.
