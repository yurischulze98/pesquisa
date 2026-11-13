# Central de Serviços

Portal com as consultas e ferramentas do dia a dia da Central de Serviços. As páginas são HTML, CSS e JavaScript puro, e as ferramentas de IA usam funções serverless da Vercel na pasta `api/`.

## Páginas

| Página | Arquivo | O que faz |
| --- | --- | --- |
| Chamados | `index.html` | Abre chamados do Seven Suite pelo ID e guarda o histórico recente |
| Mapa funcional | `funcional.html` | Responsáveis por módulo e atribuições dos atendentes |
| Nomes para Teams | `nomes.html` | Sugestões de nomes para copiar |
| Informações | `informacoes.html` | Guias com botão para copiar a mensagem pronta para o Teams |
| Acessos | `acessos.html` → `api/acessos.js` | Acessos dos analistas aos clientes e contatos de cada cliente, lidos da planilha do Google Sheets (protegido por senha) |
| Análise de dossiê | `dossie.html` → `api/analisar-dossie.js` | Classificação, CRM, continuidade, SLA e cobrança a partir do histórico com prints |
| CRM e SLA | `crm-sla.html` → `api/crm-sla.js` | Atualização de CRM e justificativa de SLA a partir da anotação do analista |
| Título de chamado | `titulo.html` → `api/gerar-titulo.js` | Título do chamado externo Renner-ServiceNow, com o RITM detectado |

## Variáveis de ambiente (Vercel)

| Variável | Obrigatória | Padrão |
| --- | --- | --- |
| `OPENAI_API_KEY` | Sim | — |
| `OPENAI_MODEL_DOSSIE` | Não | `gpt-5-mini` |
| `OPENAI_MODEL_CRM` | Não | `gpt-4o-mini` |
| `OPENAI_MODEL_TITULO` | Não | `gpt-4.1-mini` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Sim, para Acessos | Conteúdo inteiro do JSON da conta de serviço |
| `ACESSOS_SENHA` | Sim, para Acessos | Senha pedida na página Acessos |
| `ACESSOS_SHEET_ID` | Não | ID da planilha Acesso_Geral |

A chave fica só no servidor; nunca coloque a chave no HTML ou no JavaScript das páginas.

## Planilha de acessos

A página Acessos lê as abas **Base de Acessos** (Nome, Email, Depto, Cliente, Acesso) e **Contatos Clientes** (Cliente, Responsavel Criação, Responsavel Exclusão, Contato, Observação, Tem Teams?). As colunas são localizadas pelo nome do cabeçalho, então a ordem pode mudar. A matriz de analistas por cliente é calculada na página.

A planilha precisa estar compartilhada como **Leitor** com o e-mail da conta de serviço (`client_email` do JSON). A função guarda a leitura por 60 segundos; o botão Atualizar força uma nova leitura, e a página se atualiza sozinha a cada 2 minutos.

## Rodar localmente

```bash
npm i -g vercel
vercel dev
```
