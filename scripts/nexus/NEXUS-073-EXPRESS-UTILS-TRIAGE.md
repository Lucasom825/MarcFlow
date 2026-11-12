# NEXUS 073 — triagem concreta do primeiro módulo: Express `lib/utils.js`

Data do exame: 12/11/2026 (Brasília). Escopo: leitura de código em fonte pública, **sem execução**.

## Identificação reproduzível

- Repositório: https://github.com/expressjs/express
- Arquivo analisado: https://github.com/expressjs/express/blob/43fca52d28a422c8be48fd489cbd4f2d6152bab6/lib/utils.js
- SHA da origem: `43fca52d28a422c8be48fd489cbd4f2d6152bab6`.
- Licença do projeto nesse SHA: MIT, com obrigação de manter aviso de copyright e permissão quando aplicável. https://github.com/expressjs/express/blob/43fca52d28a422c8be48fd489cbd4f2d6152bab6/LICENSE
- REA run com resumo publicado: https://github.com/Lucasom825/rea/actions/runs/43274412800
- Relatório da REA: 6/6 JS, 57/57 locais de importação reconciliados, **5** ocorrências adicionais e **2.518** incógnitas semânticas. A REA classificou o arquivo como módulo estrutural; essas métricas não são qualidade nem teste funcional.

## Fatos documentados pela leitura do arquivo original

| Símbolo no módulo | Função indicada pelo código | Dependências/observação |
|---|---|---|
| `methods` | lista nomes de métodos HTTP Node.js em minúsculas | `node:http` |
| `etag` / `wetag` | gera identificadores HTTP fortes/fracos | biblioteca `etag` + `Buffer` |
| `normalizeType` / `normalizeTypes` | normaliza um tipo MIME e seus parâmetros | `mime-types` e parsing local |
| `compileETag` | seleciona gerador de ETag ou desativa | funções de ETag do módulo |
| `compileQueryParser` | escolhe parser de query simple/extended ou função definida | `node:querystring` e `qs` |
| `compileTrust` | seleciona política de confiança em proxies | `proxy-addr`; **requer revisão de segurança** |
| `setCharset` | altera charset numa string Content-Type | pacote `content-type` |

Apenas o nome `utils.js` não seria suficiente para sustentar essas conclusões; elas foram conferidas no arquivo original fixado.

### Riscos que impedem importar o módulo todo

- O arquivo importa várias bibliotecas e APIs Node.js; não é um componente autônomo de interface.
- `compileTrust` depende da arquitetura de proxy e pode impactar a interpretação de IPs de clientes. Não é seguro copiar a política de confiança sem conhecer a infraestrutura.
- `parseExtendedQueryString` usa `qs.parse` com `allowPrototypes: true`; a escolha de parser e políticas de objeto exigiria avaliação própria antes do uso em aplicações NEXUS.
- `etag`, `mime-types`, `content-type`, `proxy-addr` e `qs` têm dependências, licenças e versões próprias a verificar; MIT do Express não atesta as demais automaticamente.
- Next.js já possui mecanismos de requisição/resposta no NEXUS; reutilização do Express pode ser redundante e acrescentar complexidade.

## Hipótese selecionada para um possível microprotótipo

**Normalização segura de Content-Type/charset**, inspirada no problema tratado por `setCharset`: entrada (Content-Type, charset), saída (Content-Type formatado) e erros de valores inválidos. É uma operação pequena que permitiria testes de comportamento com valores normais e malformados, *se* houver requisito concreto numa API do NEXUS.

**Importante:** o protótipo ainda não foi criado. Não copiar o módulo inteiro. Primeiro provar necessidade da funcionalidade em uma API real, verificar recursos nativos já presentes e estabelecer critérios de aceitação. Se não houver necessidade comprovada, **rejeitar a integração e escolher um projeto mais útil**.

## Decisão registrada

- **Análise estrutural**: concluída no REA run #43274412800.
- **Inspeção do código original**: realizada nesta revisão.
- **Teste comportamental**: não realizado.
- **Aproveitamento para NEXUS**: **NÃO APROVADO**.
- **Instalação, merge produtivo, mudança de segredo ou banco**: não realizada.
- **Próximo gate**: vincular o objetivo a um problema concreto de um dos projetos do usuário; conferir necessidade, dependências/licenças e construir microteste isolado antes de propor integração.
