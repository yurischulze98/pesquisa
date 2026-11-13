// Análise operacional de dossiê (classificação, CRM, continuidade, SLA e cobrança),
// com texto e prints intercalados na ordem em que foram colados.
// Portado do projeto AnalisadorChamados.
import { OPENAI_URL, getApiKey, outputText, requirePostJson, sendJson } from './_lib/openai.js';
import { instructions, visionInstructions } from './_lib/dossie-prompt.js';

const MODEL = process.env.OPENAI_MODEL_DOSSIE || 'gpt-5-mini';
const MAX_IMAGES = 8;
const MAX_TOTAL_IMAGE_CHARS = 3_000_000;
const MAX_TEXT_CHARS = 350_000;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['classificacao', 'resumo', 'continuidade', 'sla', 'cobrar', 'cobranca'],
    properties: {
        classificacao: { type: 'string', enum: ['INC', 'REQ', 'RCA'] },
        resumo: { type: 'string' },
        continuidade: { type: 'string' },
        sla: { type: 'string' },
        cobrar: { type: 'string', enum: ['Sim', 'Talvez', 'Não'] },
        cobranca: { type: 'string' }
    }
};

function validarPartes(partesRaw) {
    const partes = [];
    let totalTexto = 0;
    let totalImagens = 0;
    let numImagens = 0;

    for (const item of partesRaw) {
        if (!item || typeof item !== 'object') return { error: [400, 'Trecho inválido no histórico.'] };

        if (item.tipo === 'texto') {
            if (typeof item.texto !== 'string') return { error: [400, 'Texto do histórico inválido.'] };
            totalTexto += item.texto.length;
            if (totalTexto > MAX_TEXT_CHARS) return { error: [413, 'Histórico extenso demais; copie um período menor.'] };
            partes.push({ tipo: 'texto', texto: item.texto });
            continue;
        }

        if (item.tipo !== 'imagem' || typeof item.dataUrl !== 'string' || !IMAGE_PATTERN.test(item.dataUrl)
            || (item.nome !== undefined && typeof item.nome !== 'string')) {
            return { error: [400, 'Um dos prints contém dados ou formato inválidos (use PNG, JPG ou WebP).'] };
        }
        numImagens++;
        if (numImagens > MAX_IMAGES) return { error: [400, `O limite é de ${MAX_IMAGES} imagens por análise.`] };
        totalImagens += item.dataUrl.length;
        if (totalImagens > MAX_TOTAL_IMAGE_CHARS) {
            return { error: [413, 'As imagens excedem o tamanho permitido. Copie um trecho menor ou reduza os prints.'] };
        }
        partes.push({ tipo: 'imagem', nome: String(item.nome || 'Print do dossiê').slice(0, 150), dataUrl: item.dataUrl });
    }
    return { partes, numImagens };
}

function calcularUso(usage) {
    if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return undefined;
    const entrada = usage.input_tokens;
    const saida = usage.output_tokens;
    const uso = { entrada, saida, total: usage.total_tokens ?? entrada + saida, modelo: MODEL };
    // Preço de referência do gpt-5-mini (US$ 0,25/M entrada, 0,025/M cache, 2,00/M saída).
    if (MODEL === 'gpt-5-mini') {
        const cached = Math.min(entrada, usage.input_tokens_details?.cached_tokens || 0);
        uso.custoEstimadoUSD = ((entrada - cached) * 0.25 + cached * 0.025 + saida * 2) / 1_000_000;
    }
    return uso;
}

export default async function handler(req, res) {
    const body = await requirePostJson(req, res);
    if (!body) return;

    const chamado = typeof body.chamado === 'string' ? body.chamado.slice(0, 150) : '';
    const complemento = typeof body.complemento === 'string' ? body.complemento.slice(0, 50_000) : '';
    const detalheImagem = body.detalheImagem ?? 'high';
    if (detalheImagem !== 'low' && detalheImagem !== 'high') return sendJson(res, 400, { error: 'Qualidade de imagem inválida.' });
    if (!Array.isArray(body.partes) || body.partes.length > 1000) {
        return sendJson(res, 400, { error: 'Histórico inválido ou com excesso de trechos.' });
    }

    const { partes, numImagens, error } = validarPartes(body.partes);
    if (error) return sendJson(res, error[0], { error: error[1] });

    const textoCompleto = partes.filter(p => p.tipo === 'texto').map(p => p.texto).join('');
    if (textoCompleto.trim().length < 20 && numImagens === 0) {
        return sendJson(res, 400, { error: 'Informe uma descrição/apontamento com pelo menos 20 caracteres ou uma imagem.' });
    }

    const apiKey = getApiKey();
    if (!apiKey) return sendJson(res, 503, { error: 'A chave da API ainda não foi configurada neste site.' });

    const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const conteudo = [{
        type: 'input_text',
        text: `Data de referência: ${hoje}\nID do chamado: ${chamado || 'não informado'}\n\nDossiê/descrição/apontamentos (os prints aparecem exatamente na posição em que foram colados; mantenha as associações entre texto e imagem):\n`
    }];
    let indice = 0;
    for (const parte of partes) {
        if (parte.tipo === 'texto') {
            if (parte.texto) conteudo.push({ type: 'input_text', text: parte.texto });
        } else {
            indice++;
            conteudo.push({ type: 'input_text', text: `\n[Print ${indice} de ${numImagens} nesta posição do histórico: ${parte.nome}]\n` });
            conteudo.push({ type: 'input_image', image_url: parte.dataUrl, detail: detalheImagem });
        }
    }
    conteudo.push({ type: 'input_text', text: `\n\n[Fim do histórico]\nInformação complementar: ${complemento || 'não informada'}` });

    try {
        const api = await fetch(`${OPENAI_URL}/responses`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                instructions: instructions + visionInstructions,
                input: [{ role: 'user', content: conteudo }],
                text: { format: { type: 'json_schema', name: 'analise_dossie', strict: true, schema: SCHEMA } }
            })
        });
        const data = await api.json().catch(() => ({}));
        if (!api.ok) return sendJson(res, 502, { error: data?.error?.message || 'Falha ao consultar o agente.' });

        const texto = outputText(data);
        if (!texto) return sendJson(res, 502, { error: 'Resposta vazia do agente. Tente novamente.' });

        const resultado = JSON.parse(texto);
        const uso = calcularUso(data.usage);
        if (uso) resultado.uso = uso;
        return sendJson(res, 200, resultado);
    } catch (erro) {
        return sendJson(res, 500, { error: erro instanceof Error ? erro.message : 'Erro inesperado na análise.' });
    }
}
