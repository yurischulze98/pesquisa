// Utilidades compartilhadas pelas funções em /api.
// Arquivos em pastas iniciadas por "_" não viram rotas na Vercel.

export const OPENAI_URL = 'https://api.openai.com/v1';

export function getApiKey() {
    return process.env.OPENAI_API_KEY || '';
}

/** Lê o corpo JSON independentemente de a plataforma já tê-lo convertido. */
export async function readJson(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') return JSON.parse(req.body);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
}

export function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}

/** Garante POST e corpo JSON válido. Retorna o corpo ou null se já respondeu. */
export async function requirePostJson(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, { error: 'Método não permitido.' });
        return null;
    }
    try {
        return await readJson(req);
    } catch {
        sendJson(res, 400, { error: 'Corpo da requisição inválido.' });
        return null;
    }
}

const STATUS_MESSAGES = {
    401: 'Chave OPENAI_API_KEY inválida. Confira a variável na Vercel.',
    403: 'A conta não tem permissão para usar o modelo configurado.',
    429: 'Limite de uso ou saldo da API OpenAI atingido. Confira faturamento e limites.'
};

/** Mensagem segura para o navegador, sem repassar o corpo bruto da OpenAI. */
export function openAiErrorMessage(status) {
    return STATUS_MESSAGES[status] || `Erro na API da OpenAI (HTTP ${status}). Tente novamente.`;
}

/** Extrai o texto de saída de uma resposta da Responses API. */
export function outputText(data) {
    if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
    for (const item of data?.output || []) {
        for (const content of item?.content || []) {
            if (content?.type === 'output_text' && content.text) return content.text;
        }
    }
    return '';
}
