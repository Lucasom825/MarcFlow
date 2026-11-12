# NEXUS 078 — ponte experimental de leitura com Memora 2

Data: 12/11/2026. Autorização recebida do usuário: **desenvolvimento autenticado de leitura exclusivamente em branches experimentais; sem credenciais, consultas reais, merge ou deploy**.

## Status de implementação
- Origem Memora 2: repositório PRIVADO `Lucasom825/memora-2-cloudflare`, branch `nexus/readiness-bridge-078-20261112`.
- Destino NEXUS: repositório `Lucasom825/MarcFlow`, branch `nexus/memora2-read-bridge-078-20261112`.
- Ambos permanecem desativados por padrão, **não conectados** e sem segredos instalados.
- O NEXUS de demonstração continua exibindo apenas dados fictícios e não recebe reuniões reais.

## Contrato de autenticação (somente server-to-server)
- Memora 2 exige `MEMORA_NEXUS_BRIDGE_ENABLED=true`, `MEMORA_NEXUS_OWNER_ID` (UUID do proprietário) e `MEMORA_NEXUS_BRIDGE_SECRET` (segredo aleatório de alta entropia, guardado apenas no servidor).
- NEXUS exige `NEXUS_MEMORA2_BRIDGE_ENABLED=true`, `NEXUS_MEMORA2_BRIDGE_SECRET` (mesmo valor da origem), `NEXUS_MEMORA2_OWNER_EMAIL` (correspondência exata com usuário autenticado NEXUS), `NEXUS_MEMORA2_ORIGIN` (somente HTTPS na raiz de um domínio fixado) e `NEXUS_MEMORA2_ALLOWED_HOST` (hostname exato).
- HMAC-SHA256 assina GET + rota fixa + timestamp UTC em segundos + nonce aleatório + client ID fixo. Janela de tolerância de 30 segundos; nonce não é persistido.
- Os cabeçalhos HMAC ficam somente no servidor. A chamada remota omite cookies, proíbe redirecionamentos, tem timeout de 5 s, JSON de até 16 KiB e nunca aceita URL fornecida pelo navegador.
- A API NEXUS verifica sessão de usuário, email permitido e NÃO admite `demo@nexus.invalid` nem `NEXUS_DEMO_ONLY=true`. POST é rejeitado.
- O endpoint Memora usa lista resumida do índice filtrado pelo UUID configurado, com 8 reuniões no máximo. Não usa GET de detalhe que pode disparar recuperação automática. Resposta retorna apenas ID opaco por HMAC, origem, estado, data, versão PDF e existência de PDF.
- O NEXUS valida contrato e exibe somente estados e referências opacas, sem títulos, áudios, transcrições, atas e diagnósticos.

## Testes antes de ativar
1. CI nos dois repositórios (assinatura HMAC compatível, expiração, URL permitida, recusa de demo, descartar campos privados e nenhum método de escrita).
2. Auditoria humana da identificação do proprietário no ambiente real, especialmente se a autenticação do Memora for Supabase em vez de local.
3. Rate limit, controle de replay dentro da janela, revogação e logging sem identificadores pessoais devem ser validados antes de qualquer publicação pública.
4. Testar em ambiente isolado, usando registros sintéticos, sem chaves reais e sem consumo do Memora de produção.
5. Solicitar autorização SEPARADA para instalar credenciais, alterar configurações produtivas e publicar cada serviço.
6. O acesso real só é compatível com autenticação individual no NEXUS (não com a conta de demonstração atual). É necessário provar esse fluxo antes de qualquer leitura de reunião real.

## Riscos/limites
- Esta arquitetura vincula a ponte a **um** proprietário configurado. Não é controle multi-tenant para múltiplos usuários.
- A janela de 30 segundos é proteção contra solicitações antigas, mas não bloqueia replay dentro da janela sem armazenamento de nonces. Não afirmar proteção completa contra replay.
- `PROCESSED` e `hasSavedPdf` não atestam qualidade de conteúdo da ata.
- Sem custo adicional contratado, desde que não sejam ultrapassadas franquias de CI, hospedagem e runtime. Não ativar serviços pagos.
- Não existem chamadas realizadas ao Memora 2 real nesta etapa; a conexão ainda não está operando.

## Fontes e verificações
- NEXUS 076 aprovado no navegador em dados sintéticos: PR #20 (https://github.com/Lucasom825/MarcFlow/pull/20).
- RFC NEXUS 077, PR #21 (https://github.com/Lucasom825/MarcFlow/pull/21).
- Código Memora 2: https://github.com/Lucasom825/memora-2-cloudflare/tree/nexus/readiness-bridge-078-20261112 .
