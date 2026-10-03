# Auditoria técnica — ligueospontos — 02/10/2026

## Escopo e conclusão

Revisão do frontend React/Vite, API .NET 10, persistência PostgreSQL e imagens Docker. Foram executadas correções reversíveis de baixo risco e testes de navegador contra um banco de auditoria isolado. A aplicação melhorou em carregamento inicial, segurança de links/anexos e confiabilidade de sincronização. **Ainda não há base para declarar liberação de produção**: faltam decisões sobre credenciais de provedores, controles de concorrência entre dispositivos, backup/limites de anexos e teste de HTTPS no proxy real.

## Indicadores

| Indicador | Antes | Depois |
|---|---:|---:|
| Vulnerabilidades conhecidas em dependências | npm: 0; NuGet: 0 | npm: 0; NuGet: 0 |
| Falhas de segurança verificadas no código | URL de link sem restrição de protocolo; MIME de anexo aceito do cliente | Protocolo HTTP(S) exigido na navegação; MIME definido pelo servidor |
| Bugs técnicos identificados neste escopo | 9 achados descritos abaixo | 9 tratados; pendências de produto separadas |
| Dependências comprovadamente desnecessárias | 0 | 0; nenhuma removida |
| Código morto identificado | 3 blocos (exemplo inicial, catálogos antigos, ramo inacessível), 1 import | Removidos; verificação de símbolos não usados passou |
| JavaScript inicial da build | 873,07 kB / 296,86 kB gzip | 405,78 kB / 128,18 kB gzip |
| JavaScript AWS carregado sob demanda | Incluído no inicial | 462,79 kB / 167,19 kB gzip, somente ao abrir card AWS legado |
| CSS da build | 81,84 kB / 16,69 kB gzip | 81,84 kB / 16,69 kB gzip |
| Performance de fluxos críticos (tempo de resposta) | N/A: sem medição inicial comparável | N/A: sem par de medições comparável |
| Testes automatizados permanentes no repositório | Nenhum identificado | Nenhum adicionado; testes integrados de auditoria passaram |
| Complexidade observável do arquivo principal | `src/App.tsx`: 3.188 linhas | 2.664 linhas; sem alterar o formato salvo dos boards |

O ganho medido é de **168,68 kB gzip (56,8%) no JavaScript inicial**. O código AWS continua disponível quando necessário; o tamanho total dos dois chunks de JavaScript não caiu na mesma proporção. A transferência do contexto Docker após a limpeza foi de 372,70 kB; não havia baseline confiável para comparação.

## Achados, causa-raiz e correção

| Criticidade | Problema e causa-raiz | Correção e validação |
|---|---|---|
| Alta | Build de produção usava base `/api` e o código acrescentava `/api`, gerando `/api/api/...` | Base de produção alterada para `/`; requisição real da build foi para `/api/auth/csrf`; fluxo completo passou pelo Nginx |
| Alta | PUTs de autosave e botão Salvar podiam terminar fora de ordem; o botão mostrava sucesso mesmo quando a API falhava | Gravações remotas serializadas por fila; revisão do estado só confirma a gravação mais recente; “Salvo!” depende de resposta bem-sucedida |
| Média | Falha no logout limpava a interface local sem encerrar a sessão no servidor | Estado local só é encerrado após resposta positiva; teste com falha HTTP simulada e logout real passou |
| Média | Backend usava `file.ContentType`, informado pelo cliente | MIME normalizado pela extensão permitida; teste enviou `.png` com `text/html` e recebeu `image/png` |
| Média | Limite anunciado de 50 MB não correspondia ao limite padrão do servidor | Limites explícitos no Kestrel, multipart e Nginx; upload real de 31 MiB passou e arquivo acima de 50 MiB recebeu erro 400 |
| Média | URL de card podia usar protocolo executável ou não HTTP | Link clicável apenas para HTTP(S); teste de `javascript:` bloqueado e HTTPS permitido |
| Média | Anexo salvo com URL absoluta do ambiente de desenvolvimento deixava de funcionar em outro host | Novos documentos guardam caminho relativo; URLs antigas de `/api/attachments/{id}/content` são resolvidas na origem/API atual |
| Alta | Healthcheck Docker chamava `wget`, ausente da imagem final da API | Verificação HTTP com ferramentas presentes na imagem; executada dentro do contêiner e retornou sucesso |
| Baixa | Exemplos iniciais e catálogos antigos permaneciam no código apesar de inacessíveis; ícones AWS antigos pesavam no bundle inicial | Dados/ramo mortos removidos; ícones AWS importados sob demanda, mantendo cards antigos legíveis |

## Classificação de código e dependências

1. **Necessário ao produto atual:** ReactFlow, quatro blocos universais, grupos, conexões, autenticação, boards e anexos. Mantidos.
2. **Infraestrutura necessária:** ASP.NET Identity, EF Core/Npgsql, PostgreSQL, antiforgery, rate limiting, Vite e contêineres. Mantidos.
3. **Legado ainda utilizado:** mapeamento de tipos/ícones de cards AWS e outros cards já persistidos. Mantido com carregamento sob demanda; não há criação desses tipos na interface atual.
4. **Obsoleto com remoção demonstrada:** estrutura inicial padrão sem uso, catálogos de criação antigos e código após retorno antecipado, import não utilizado. Removidos.
5. **Suspeito, exige investigação:** arquivos gerados `vite.config.js`, `vite.config.d.ts` e caches TypeScript; regras CSS acumuladas. Não removidos sem verificar fluxos de build/edição externos.
6. **Funcionalidade de produto incompleta, preservada:** modal de credenciais, botões Importar/Exportar e mapa da solução. A decisão de implementar, desabilitar ou retirar a exposição desses recursos é de produto.

Não foi encontrada dependência claramente inútil: `@aws-icons/react` permanece necessária para cards AWS salvos anteriormente. A busca de vulnerabilidades conhecidas resultou em zero nos manifestos npm e NuGet; isso não equivale a auditoria de segurança completa.

## Testes executados

- `npm run build`: passou, incluindo TypeScript estrito e verificação de símbolos não utilizados.
- `dotnet build`: passou sem avisos ou erros.
- Build Docker de web e API e validação do Compose: passaram.
- `npm audit` e verificação NuGet transitiva: 0 alertas conhecidos.
- Playwright em banco separado: cadastro, criação de board, autosave, recarga, modo visitante, isolamento de board/anexo entre duas contas, links seguros e logout com falha simulada passaram; nenhum erro de página detectado no fluxo principal. Com a primeira gravação atrasada artificialmente, duas edições permaneceram em ordem e o documento remoto terminou com os dois cards.
- Imagens de produção com Nginx + API: cadastro, criação, sincronização e recarga passaram por `/api` na mesma origem. O teste local usou HTTP com `Security:RequireHttps=false`; TLS de borda real não foi testado.
- Upload de 31 MiB e MIME normalizado passou; arquivo acima de 50 MiB foi rejeitado com erro 400.

Não havia suíte unitária ou de integração permanente para executar nem cobertura configurada. Os roteiros de auditoria estão em `.artifact-work/` e usam ferramentas locais; ainda é recomendável incorporá-los a uma suíte reproduzível de CI. Não foram feitas alterações de índice/migration sem plano de execução nem uma afirmação de melhora de latência sem baseline.

Os testes criaram exclusivamente o banco temporário `graphflow_audit_20261002` (5 contas, 6 boards e 2 anexos fictícios) e dois arquivos correspondentes em `backend/GraphFlow.Api/storage/`. Sua exclusão está aguardando aprovação, conforme a diretriz do solicitante para operações destrutivas. Os serviços de teste foram encerrados; as portas locais habituais continuam ativas.

## Riscos residuais e decisões necessárias

| Prioridade | Risco / decisão | Impacto |
|---|---|---|
| Alta | O modal “Salvar credencial” não persiste nem conecta a chave a provedor algum; a interface pode induzir uso incorreto. Decidir entre implementação com cofre de segredos ou retirada/indicação explícita de indisponibilidade. | Confiança e segurança operacional |
| Alta | O `Version` do board não é aplicado como controle otimista. Dois dispositivos podem sobrescrever alterações; fallback local pode competir com estado remoto. Definir política de conflito e contrato de API antes de mudar. | Integridade dos dados |
| Alta | Produção exige teste de HTTPS real, cabeçalhos de proxy, cookies, backup/restauração do PostgreSQL e do volume de anexos. | Segurança e recuperação |
| Média | Uploads não têm cota por conta, varredura de arquivos nem política de retenção. | Abuso, custo e operação |
| Média | Importar/Exportar aparecem sem ação associada. Decidir entrega ou ocultação. | Fluxo de produto incompleto |
| Média | Lista de boards não é paginada; não houve volume para justificar mudança de consulta/índice. | Escalabilidade futura |
| Média | Não há testes automatizados permanentes nem medição de LCP/INP/CLS ou latência A/B. | Regressão e observabilidade |

## Arquivos alterados

`src/App.tsx`, `backend/GraphFlow.Api/Program.cs`, `.env.production`, `nginx.conf`, `docker-compose.production.yml`, `.dockerignore`, `tsconfig.json` e `README.md`. Nenhum manifesto de dependências, migration ou dado de produção foi alterado.

## Atualização de pivot — produto de mapas visuais

Revisão complementar feita após a mudança de posicionamento do produto. A versão atual é um mapa visual de ideias, referências, arquivos e links; **não oferece recursos de AWS, LLM, agentes ou credenciais de provedores**.

### Ajustes aplicados

- Removidos do fluxo visível o “Mapa da solução” AWS/IA e o modal de credenciais que não persistia nem conectava provedor algum.
- Removidos os controles Importar/Exportar, pois não havia implementação associada. Um botão sem efeito não é exposto como recurso de produto.
- Revisada a linguagem do dashboard para “bloco”, “grupo”, “conexão” e “mapa”; removidos termos de arquitetura e módulo do fluxo atual.
- Mantido somente o catálogo de quatro blocos: texto livre, imagem, arquivo e link.
- Os tipos e ícones AWS permanecem internamente apenas para renderizar boards antigos já salvos; eles não são criados, listados nem anunciados pela versão atual.
- O cálculo de conexões de saída no canvas passou de filtros repetidos por card para uma única passagem pelos links (`O(n + e)`), reduzindo trabalho a cada atualização visual.
- A API deixou de criar um board implícito em `PUT /api/boards/{id}`. A criação é exclusiva do `POST /api/boards`; uma gravação em ID ausente agora retorna 404. Isso evita registros acidentais e deixa o ciclo de vida do dado explícito.
- Renomear um board agora também incrementa sua versão, mantendo o metadado coerente com alterações persistidas.

### Validação executada nesta atualização

- `npm run build`: passou.
- `dotnet build`: passou com 0 avisos e 0 erros.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades conhecidas.
- Verificação NuGet transitiva: 0 pacotes vulneráveis conhecidos.
- Compose de produção validado por `docker compose config --quiet`.
- Navegador (Playwright): landing → modo visitante → criação de bloco; sem erros de página. Os termos AWS, Bedrock, OpenAI, mapa da solução e credenciais não aparecem no fluxo atual. Os controles sem implementação também não estão presentes.
- Serviços locais no momento da verificação: frontend 200 e API 200.

### Banco e desempenho de listagem

A listagem atual usa `AsNoTracking`, filtra por `OwnerId`, projeta somente `Id`, `Title`, `Version` e `UpdatedAt`, e ordena pela data. O índice `IX_boards_OwnerId_UpdatedAt` existe no PostgreSQL.

No banco local atual (volume muito pequeno), `EXPLAIN ANALYZE` retornou a listagem em **0,089 ms**. O otimizador escolheu `Seq Scan`, que é a decisão esperada para poucas linhas; o índice passa a ser relevante conforme o volume cresce. Não há evidência honesta para declarar uma latência de produção sem carga representativa.

### Pendências que exigem decisão antes de escalar

1. A lista de boards ainda não é paginada. Para centenas ou milhares de boards por conta, definir paginação por cursor e limite de interface.
2. Cada autosave grava o documento JSON completo (até 10 MB). O debounce e a fila serializada limitam o volume para a primeira versão, mas colaboração intensa ou boards grandes exigirão estratégia de atualizações incrementais ou snapshots.
3. `Version` ainda não é enviada pelo cliente como pré-condição de gravação. Dois dispositivos podem sobrescrever mudanças entre si. Implementar controle otimista exige decidir a experiência de conflito.
4. Anexos não têm cota por conta, política de retenção, varredura antimalware nem coleta segura de anexos órfãos. Não removi arquivos automaticamente porque um anexo pode ser referenciado por cards duplicados.
5. Backup/restauração de PostgreSQL e volume de anexos, HTTPS real e observabilidade continuam pré-requisitos operacionais para produção.

## Atualização — gestão de boards por conta

Foi adicionada uma listagem paginada de boards com busca por título, intervalo de atualização, renomeação e exclusão com confirmação. A API devolve metadados de página, total filtrado, total pertencente à conta e o limite configurado da conta; a interface usa esses dados para mostrar consumo e desabilitar a criação ao atingir o limite.

- `GET /api/boards` exige sessão, filtra por `OwnerId` antes de aplicar `ILIKE`, data, ordenação e paginação. A projeção permanece enxuta e `AsNoTracking` é mantido.
- `PATCH /api/boards/{id}/title` e `DELETE /api/boards/{id}` filtram simultaneamente por ID e `OwnerId`. Um ID de outra conta responde 404 e não confirma a existência do recurso.
- A busca é limitada a 120 caracteres; página fica entre 1 e o último resultado; `pageSize` fica entre 1 e 50. O limite inicial configurável é 100 boards por conta.
- O intervalo de datas usa `UpdatedAt`, pois o esquema existente não registra `CreatedAt`. O cliente envia seu deslocamento de fuso para que um dia escolhido represente o dia local do usuário, enquanto o banco continua comparando instantes UTC.

### Validação desta atualização

- `npm run build`: passou.
- `./.dotnet/dotnet build backend/GraphFlow.Api/GraphFlow.Api.csproj`: passou com 0 erros e 0 avisos. O `dotnet` global do terminal é SDK 8 e não compila `net10.0`; a validação usou o SDK 10 versionado no workspace, que é o mesmo usado pelo serviço local.
- Teste HTTP com duas contas locais de teste: 13 boards retornaram em 2 páginas (12 + 1); busca `ILIKE` encontrou o título esperado; renomeação retornou o título normalizado; exclusão retornou 204; acesso cruzado a um ID conhecido retornou 404.
- O filtro de data foi testado no fuso UTC-03: um board atualizado às 22h41 locais de 02/10 apareceu no intervalo de 02/10, embora esteja armazenado como 03/10 em UTC.
- Teste de navegador: login, busca por título e a listagem filtrada renderizaram sem erros de página. A proteção de taxa de autenticação interrompeu uma execução adicional de login automatizado, comportamento esperado para requisições repetidas no mesmo IP.

### Decisão de esquema ainda necessária

O requisito literal de filtrar pela **data de criação** exige acrescentar `CreatedAt` à tabela `boards`, preencher registros existentes com uma regra explícita e criar uma migration. Isso altera dados persistidos e precisa de aprovação de plano de migração; a implementação atual nomeia a funcionalidade de modo preciso como “Atualizado de/até”.
