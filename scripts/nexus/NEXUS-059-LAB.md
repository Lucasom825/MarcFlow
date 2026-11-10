# NEXUS 059 — Laboratório visual supervisionado (não produtivo)

## Objetivo
Validar em navegador real a interface de leitura e os bloqueios de uma prévia Drawflow → MarcFlow, reaproveitando o conversor 057 e o `validateGraph`/`outputsOf` verdadeiros usados no 058.

**Não instala nem substitui o editor React Flow do MarcFlow**. É apenas um laboratório de inspeção do fluxo antes de considerar uma integração real.

## Como executar localmente
Necessário Node.js 22.16+; sem npm install e sem serviços pagos.

```sh
node --experimental-strip-types scripts/nexus/lab-server.mjs
```

Abra `http://127.0.0.1:48959` no navegador do próprio computador. A interface permite:
- Carregar a fixture pública e explicitamente anotada `nexus.marcflow.v1`;
- Analisar e desenhar um mapa somente leitura, mostrando erros e avisos;
- Exportar somente a prévia validada, para análise humana posterior;
- Recusar mapeamento desconhecido, conexões inválidas, HTML/script como código executável e dados excessivos.

Não se usa dados reais de clientes ou produção nesta fase. O servidor **escuta exclusivamente 127.0.0.1**; recusa POST cross-origin, só oferece rotas previamente permitidas, não grava arquivos nem faz conexões com outras redes. O navegador não executa código do repositório Drawflow — somente renderiza texto extraído de JSON.

## Prova automatizada no GitHub
A CI de `.github/workflows/nexus-059-browser.yml` realiza:
1. Testes existentes do conversor 057 e contrato do validador MarcFlow 058;
2. Inicialização de servidor local efêmero e verificação de rejeição de POST não autorizado;
3. Chrome headless real: clicar Carregar exemplo → Analisar; confirmar dois blocos/uma conexão; inserir texto com tentativa de HTML malicioso e confirmar que é texto, não elemento ativo; inserir mapeamento não permitido e confirmar bloqueio e desativação da exportação; limpar e verificar retorno ao estado inicial;
4. Capturar DOM/screenshot/logs como evidência por 3 dias;
5. Rejeitar alterações fora de scripts/nexus e do workflow isolado.

O browser automatizado **não é o editor de produção React Flow**, não usa o banco de dados, não publica fluxos nem envia WhatsApp. O clique é um evento DOM automatizado no Chrome, não uma homologação de usuário humano.

## Decisão
As únicas ações autorizadas são desenvolvimento, leitura e testes em branch isolada. **Nenhum merge/deploy, configuração de segurança, pagamento ou publicação**. Passar no CI não equivale a aprovação de produção.

## Próximo gate após CI
Testar integração assistida no editor MarcFlow sob autenticação de staging com amostras anonimizadas e verificação de persistência, UX e rollback. Somente então discutir merge/deploy com aprovação explícita.

Fontes: [Drawflow MIT fixado](https://github.com/jerosoler/Drawflow/tree/ef8a88cdfbf2010cc0b641b94278be6db413938b), [REA Toolkit Drawflow #11](https://github.com/Lucasom825/rea/actions/runs/42871873437), [MarcFlow PR #2](https://github.com/Lucasom825/MarcFlow/pull/2) e [PR #3](https://github.com/Lucasom825/MarcFlow/pull/3).
