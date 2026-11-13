# Central de Serviços

Portal com as consultas e ferramentas do dia a dia da Central de Serviços. As páginas são HTML, CSS e JavaScript puro, e as ferramentas de IA usam funções serverless da Vercel na pasta `api/`.

## Páginas

| Página | Arquivo | O que faz |
| --- | --- | --- |
| Chamados | `index.html` | Abre chamados do Seven Suite pelo ID e guarda o histórico recente |
| Mapa funcional | `funcional.html` | Responsáveis por módulo e atribuições dos atendentes |
| Nomes para Teams | `nomes.html` | Sugestões de nomes para copiar |
| Informações | `informacoes.html` | Guias com botão para copiar a mensagem pronta para o Teams |
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

A chave fica só no servidor; nunca coloque a chave no HTML ou no JavaScript das páginas.

## Rodar localmente

```bash
npm i -g vercel
vercel dev
```
