# NEXUS 066 — Demonstração no navegador pelo GitHub Codespaces

**Status:** código de preparação em branch experimental, não implantado. Não cria Codespace automaticamente, não executa nenhum serviço pago, nem faz merge ou deploy de produção.

## Objetivo

Demonstrar somente o editor de fluxos do MarcFlow já validado em testes anteriores. Não é integração geral REA/NEXUS, não reconstrói aplicativos e não pode publicar fluxos, ativar WhatsApp ou disparar mensagens.

## Como iniciar (sem instalar programas no Windows)

1. No repositório, selecione a branch `nexus/codespaces-demo-066-20261111`. Escolha **Code → Codespaces → Create codespace on nexus/codespaces-demo-066-20261111**, preferencialmente configuração de **2 núcleos** para reduzir consumo. **Revise a cota e os limites de cobrança antes de criar.**
2. Espere o GitHub abrir o VS Code no navegador; o ambiente configurado traz suporte Docker-in-Docker. O aplicativo **não é iniciado automaticamente**.
3. No terminal do Codespaces, execute exatamente:
   ```bash
   bash scripts/nexus/start-codespace-066.sh
   ```
   O script cria credenciais aleatórias em `.env.nexus-demo` e executa o Docker Compose isolado. Ele exige `CODESPACES=true` e somente um banco de teste local `db/nexus_demo`.
4. Vá à guia **Ports / Portas**, procure **39164** e confirme que a visibilidade é **Private / Privada**. Nunca torne pública a porta. Clique no endereço da porta. Caso precise acessar o login, acrescente `/auth/login`.
5. Entre com e-mail `demo@nexus.invalid`; a senha está no arquivo `.env.nexus-demo`, chave `NEXUS_DEMO_PASSWORD`. Não compartilhe o arquivo, senha ou token. Veja o fluxo fictício `nexus_demo_first_flow`.
6. Salve um rascunho, recarregue a página e verifique a persistência. Ao encerrar, pare o Codespace pelo GitHub (não basta fechar a aba). Para encerrar somente os contêineres preservando o volume enquanto o Codespace existir:
   ```bash
   docker compose --env-file .env.nexus-demo -f scripts/nexus/compose.demo-064.yml down
   ```

## Segurança e limites

- GitHub Codespaces encaminha portas privadas por padrão, com autenticação GitHub. A URL do encaminhamento usa HTTPS e é derivada de `CODESPACE_NAME` e `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`, sem URL inventada. O usuário deve confirmar a visibilidade na guia Ports.
- O script usa somente senhas aleatórias locais e `.env.nexus-demo` ignorado pelo Git; não salva tokens de GitHub no contêiner Docker. O Docker Compose publica web apenas em `127.0.0.1:39164` dentro do Codespace e não publica porta MySQL.
- O proxy NEXUS_DEMO_ONLY bloqueia, em tempo de execução, endpoints de WhatsApp, publicação, registro público, campanhas, updates e integrações.
- O ambiente pode consumir a cota mensal de CPU/armazenamento do Codespaces e gerar cobrança se houver faturamento habilitado e excedente. **Não há garantia de custo zero contínuo.** Contêineres Docker-in-Docker e seus volumes podem desaparecer se você excluir/recriar o Codespace: não trate como armazenamento de produção, nem coloque dados reais no teste.
- `next dev` é ambiente de desenvolvimento, não produção. Não há comprovação de funcionamento com navegador remoto até o primeiro teste real feito pelo usuário em Codespaces; a CI valida somente configuração, sintaxe, redirecionamento de URL no Compose e regressões, não o encaminhamento privado do GitHub.
- Se o Codespace ficar sem recursos para construir Node + MySQL, pare o ambiente e examine o erro sem ativar máquinas maiores automaticamente.
- Nenhum recurso de infraestrutura é criado por este PR; o usuário decide se/como cria seu Codespace.

## Referências oficiais
- [Segurança e portas privadas](https://docs.github.com/en/codespaces/reference/security-in-github-codespaces)
- [Encaminhamento de portas](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)
- [Variáveis de ambiente do Codespaces](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace)
- [Cobrança do Codespaces](https://docs.github.com/pt/billing/concepts/product-billing/github-codespaces)
- [Docker-in-Docker Dev Containers](https://github.com/devcontainers/features/blob/main/src/docker-in-docker/README.md)
