# CANDIDATO DE PILOTO — NEXUS ⇄ Memora 2, somente leitura de estados

13/11/2026 (BRT). **Não publicado, não conectado a reuniões reais, sem merge.**

## Objetivo operacional

Um usuário autenticado e explicitamente autorizado no NEXUS consulta manualmente o estado das últimas oito reuniões do mesmo proprietário no Memora 2. A resposta apresenta apenas referência opaca, origem, estado e presença de PDF não validado. Não movimenta tarefas, não importa áudio, não cria ata, não exporta conteúdo nem recupera reuniões automaticamente.

Página prevista: /dashboard/nexus/rea/memora2-live. Permanece fechada por padrão (404) até existir configuração segura e identidade aprovada, inclusive em login de demonstração. Não afirmar que está disponível nos sites publicados.

## Seleção mínima — sem replicar experimentos anteriores

NEXUS: branch pilot/memora2-readonly-20261113, derivada diretamente da main no SHA aa105ccd21a5adb8b5db342e884f8219fc7d1bc7. Contém apenas 8 módulos/páginas e 5 testes de leitura segura; sem REA/Codespaces, editor, migrações, ou protótipo SQLite 086.

Memora 2: branch privada correlata pilot/nexus-readonly-20261113, derivada diretamente da main no SHA 21f4f92bb2d827ce571d46abc27af8edad86965b, contendo rota de leitura, HMAC v2, grants, serviço privado DO e testes. Nenhum código privado Memora é publicado no repositório NEXUS.

A pilha experimental anterior tinha 230 commits e 142 arquivos de diferenças no NEXUS e 54 commits/33 arquivos no Memora. Não mesclar cegamente todos.

## Fluxo previsto após homologação e autorização separadas

1. Sessão NEXUS não-demo e grant válido por ID de conta, e-mail e papel.
2. Nova leitura de User no Prisma por ID e campos mínimos. Banco indisponível: 503 sem chamada remota.
3. HMAC-SHA256 v2 sobre método, caminho, timestamp, nonce, cliente, UUID do dono Memora e grant ID.
4. Memora valida owner/grant, HMAC, janela temporal e nonce único por binding privado com Durable Object SQLite. Binding ausente: 503.
5. Memora usa somente o índice de reuniões recentes e remove nomes, mensagens internas e caminhos de PDF. Não usa GET de detalhe com efeitos de recuperação.
6. NEXUS valida o JSON e mostra estados. PDF presente não significa ata correta.

## Aceite / bloqueadores

| Gate | Evidência necessária | Estado |
|---|---|---|
| Curadoria contra main | Diff e hashes mínimos | Preparado; validar CI |
| Ambos repositórios | CI no HEAD exato dos dois | Pendente |
| HMAC, replay, rate limit | Testes sintéticos completos | Pendente da CI curada |
| Titularidade das contas | Verificação humana e consentimento | NÃO VALIDADO |
| Revogação administrativa persistente | Modelo e migração MySQL/Prisma em staging | NÃO IMPLEMENTADO |
| Binding real OpenNext/DO | Runtime em staging isolado | NÃO VALIDADO |
| Login e UX publicados | Teste autorizado de ponta a ponta | NÃO VALIDADO |
| Cotas/custos da conta Cloudflare | Consulta da conta e alertas | NÃO AUDITADO |
| Fidelidade das atas | Comparação com áudio mediante consentimento | FORA DO PILOTO |

## Decisão

**NO-GO para produção**, até que identidade, revogação persistente, binding, custos, logs e rollback estejam validados no ambiente de implantação. O protótipo SQLite 086 não foi instalado no MySQL; não confundir prova de laboratório com uso real.

A autorização atual cobre somente desenvolvimento/revisão de branches e testes fictícios. Não altera main, credenciais, Cloudflare produtivo, banco real ou reuniões. Rollback futuro: desligar ambos os lados e revogar segredo; não reabilitar HMAC v1.

Histórico de fontes: https://github.com/Lucasom825/MarcFlow/pull/29 e https://github.com/Lucasom825/memora-2-cloudflare/pull/194 .

## Pré-homologação 087 — autorização de staging isolado (13/11/2026)
Esta etapa **prepara** a homologação, mas não significa que a integração esteja publicada. O Memora 2 tem modelos de configuração independentes para Web e guard Durable Object, com testes automatizados de separação de KV, identidades e Worker. Ver `docs/NEXUS-STAGING-PREFLIGHT-087.md` no repositório **privado** Memora 2, branch `pilot/nexus-readonly-20261113`. Não copiar conteúdo privado para este repositório público.

### Pré-condições de staging NEXUS
- Instância separada da aplicação e banco MySQL/Prisma **inteiramente fictício**; nenhum usuário, token, sessão ou conexão ao MySQL real. Não usar `prisma db push` contra banco real.
- Criar usuário de teste não-demo, com ID, e-mail e papel OWNER ou SUPERADMIN, cadastrados no banco *de staging*. O gate 085 fará uma leitura mínima desse usuário a cada consulta.
- `NEXUS_DEMO_ONLY=true`, `NEXUS_MEMORA2_BRIDGE_ENABLED=false`, `NEXUS_MEMORA2_IDENTITY_APPROVED=false`, `NEXUS_MEMORA2_IDENTITY_REVOKED=true` até todos os controles serem verificados. Com os flags bloqueados, a rota deve negar sem acessar o Memora.
- Separar a futura URL HTTPS de staging, `NEXUS_MEMORA2_ALLOWED_HOST`, grant ID, UUID fictício do dono Memora, e credencial HMAC v2 **exclusiva do staging**. Não commitar valores sensíveis e nunca reutilizar segredos produtivos.
- Revogação persistente no banco MySQL **não está implementada**; a prova SQLite 086 é apenas laboratório. Falta autorização humana cruzada e teste de acesso/rollback em runtime.
- Sem revisão de quota/consumo da conta Cloudflare e isolamento remoto, não acionar deploy nem ativar o vínculo.

### Sequência de aceite sem atalhos
1. Testes locais/CI de cada piloto com HEAD conferido, sem acesso externo.
2. Confirmar isolamento do banco, KV, Durable Object, domínio, Worker, registro de auditoria e limites de gasto.
3. No ambiente isolado, conferir negação (demo/flag off, usuário revogado, JWT desatualizado, serviço indisponível), assinatura HMAC v2 e replay/rate limit com dados fictícios.
4. Com concessão sintética expirada em até 30 dias e *apenas depois* de aprovado acesso técnico ao staging, confirmar leitura manual de no máximo oito estados e zero campos confidenciais.
5. Desabilitar flags, revogar a chave sintética e comprovar negação após rollback; registrar screenshots sem tokens e logs sem conteúdo.
6. **Decisão NO-GO para produção** até homologação MySQL/Prisma persistente, identidade real/consentimento e autorização específica para alterações produtivas.

O ambiente de Cloudflare não é configurado por este documento. Não trocar dados simulados por reuniões reais para acelerar o teste.
