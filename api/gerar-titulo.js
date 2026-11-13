// Gera o título do chamado externo (Renner-ServiceNow) a partir da descrição.
// Portado do projeto Alterar-Titulo.
import { OPENAI_URL, getApiKey, openAiErrorMessage, requirePostJson, sendJson } from './_lib/openai.js';

const MODEL = process.env.OPENAI_MODEL_TITULO || 'gpt-4.1-mini';
const MAX_CHARS = 4000;

const SYSTEM_INSTRUCTION = `Você é um assistente que gera títulos curtos e objetivos para chamados de TI/infraestrutura de rede (redes, access points, switches, roteadores, firewalls, links de operadora, etc.), a partir da descrição do chamado.

Regras:
- Responda em português do Brasil.
- Gere APENAS o título, sem numeração de chamado, sem prefixos, sem aspas e sem explicações.
- O título deve ser uma frase curta (ideal entre 6 e 14 palavras), objetiva, no tom técnico usado em catálogos de solicitação de TI (ex.: "Implantação de nova rede FORTINET com validação do link CLARO").
- Comece preferencialmente com um substantivo de ação (Implantação de..., Configuração de..., Solicitação de..., Manutenção em..., Troca de..., Ativação de...).
- Não repita datas, horários ou números de chamado no título.
- Não use ponto final no fim da frase.`;

export default async function handler(req, res) {
    const body = await requirePostJson(req, res);
    if (!body) return;

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) return sendJson(res, 400, { error: 'Informe a descrição do chamado.' });
    if (description.length > MAX_CHARS) {
        return sendJson(res, 400, { error: `Descrição muito longa (máximo ${MAX_CHARS} caracteres).` });
    }

    const apiKey = getApiKey();
    if (!apiKey) return sendJson(res, 500, { error: 'OPENAI_API_KEY não configurada no servidor.' });

    try {
        const response = await fetch(`${OPENAI_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_INSTRUCTION },
                    { role: 'user', content: `Descrição do chamado:\n"""${description}"""` }
                ],
                max_completion_tokens: 256
            })
        });

        if (!response.ok) return sendJson(res, 502, { error: openAiErrorMessage(response.status) });

        const data = await response.json();
        let title = data?.choices?.[0]?.message?.content?.trim() || '';
        if (!title) return sendJson(res, 502, { error: 'A OpenAI não retornou um título. Tente novamente.' });

        title = title.split(/\r?\n/)[0].replace(/^["'“”]+|["'“”]+$/g, '').trim().replace(/\.$/, '').trim();
        return sendJson(res, 200, { title });
    } catch {
        return sendJson(res, 502, { error: 'Não foi possível conectar à API da OpenAI. Tente novamente.' });
    }
}
