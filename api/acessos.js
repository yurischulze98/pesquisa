// Acessos dos analistas aos clientes, lidos da planilha do Google Sheets.
// Abas usadas: "Base de Acessos" e "Contatos Clientes". A matriz de analistas é montada na página.
import { createHash, timingSafeEqual } from 'node:crypto';
import { sendJson } from './_lib/openai.js';
import { SheetsError, normalize, readTabs } from './_lib/google-sheets.js';

const SHEET_ID = process.env.ACESSOS_SHEET_ID || '100xPRUPQEdwjn-MeagK9Luvp0wqiu5XOibYv4whw1Js';
const CACHE_MS = 60_000;
const MIN_REFRESH_MS = 10_000;

let cache = null;

const STATUS = {
    'ativo': 'Ativo',
    'inativo': 'Inativo',
    'aguardando reset de senha': 'Aguardando reset de senha',
    'aguardando cliente': 'Aguardando cliente',
    'nao devem ter acesso': 'Não deve ter acesso',
    'nao deve ter acesso': 'Não deve ter acesso'
};

const clean = value => String(value ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const blank = value => ['', '-', '—'].includes(clean(value));

/** Localiza a linha de cabeçalho e devolve o índice de cada coluna pedida. */
function mapColumns(rows, columns) {
    for (let index = 0; index < Math.min(rows.length, 10); index++) {
        const header = rows[index].map(normalize);
        const found = Object.fromEntries(Object.entries(columns).map(([key, names]) => [key, header.findIndex(cell => names.includes(cell))]));
        if (Object.values(found).filter(position => position >= 0).length >= 2) return { start: index + 1, found };
    }
    return null;
}

function parseAccesses(rows) {
    const map = mapColumns(rows, {
        nome: ['nome', 'analista'],
        email: ['email', 'e-mail'],
        depto: ['depto', 'departamento'],
        cliente: ['cliente'],
        acesso: ['acesso', 'status']
    });
    if (!map) throw new SheetsError('Cabeçalho da aba "Base de Acessos" não reconhecido (esperado: Nome, Email, Depto, Cliente, Acesso).');
    const get = (row, key) => (map.found[key] >= 0 ? clean(row[map.found[key]]) : '');

    return rows.slice(map.start)
        .map(row => {
            const status = get(row, 'acesso');
            return {
                nome: get(row, 'nome'),
                email: get(row, 'email').toLowerCase(),
                depto: get(row, 'depto'),
                cliente: get(row, 'cliente'),
                status: STATUS[normalize(status)] || status || 'Sem status'
            };
        })
        .filter(item => item.nome || item.email);
}

function parseContacts(rows) {
    const map = mapColumns(rows, {
        cliente: ['cliente'],
        criacao: ['responsavel criacao', 'responsavel pela criacao'],
        exclusao: ['responsavel exclusao', 'responsavel pela exclusao'],
        contato: ['contato', 'contatos'],
        observacao: ['observacao', 'observacoes'],
        teams: ['tem teams?', 'tem teams', 'teams']
    });
    if (!map) throw new SheetsError('Cabeçalho da aba "Contatos Clientes" não reconhecido.');
    const get = (row, key) => (map.found[key] >= 0 && !blank(row[map.found[key]]) ? clean(row[map.found[key]]) : '');

    return rows.slice(map.start)
        .map(row => ({
            cliente: get(row, 'cliente'),
            criacao: get(row, 'criacao'),
            exclusao: get(row, 'exclusao'),
            contato: get(row, 'contato'),
            observacao: get(row, 'observacao'),
            teams: get(row, 'teams')
        }))
        .filter(item => item.cliente);
}

function passwordMatches(sent) {
    const expected = process.env.ACESSOS_SENHA || '';
    const hash = value => createHash('sha256').update(String(value)).digest();
    return Boolean(expected) && timingSafeEqual(hash(sent || ''), hash(expected));
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return sendJson(res, 405, { error: 'Método não permitido.' });
    }
    if (!process.env.ACESSOS_SENHA) return sendJson(res, 500, { error: 'ACESSOS_SENHA não configurada no servidor.' });
    if (!passwordMatches(req.headers['x-acessos-senha'])) return sendJson(res, 401, { error: 'Senha incorreta.' });

    const wantsRefresh = new URL(req.url, 'http://localhost').searchParams.get('atualizar') === '1';
    const age = cache ? Date.now() - cache.at : Infinity;
    if (cache && (age < (wantsRefresh ? MIN_REFRESH_MS : CACHE_MS))) return sendJson(res, 200, cache.payload);

    try {
        const tabs = await readTabs(SHEET_ID, { acessos: 'Base de Acessos', contatos: 'Contatos Clientes' });
        const payload = {
            atualizadoEm: new Date().toISOString(),
            acessos: parseAccesses(tabs.acessos),
            contatos: parseContacts(tabs.contatos)
        };
        cache = { at: Date.now(), payload };
        return sendJson(res, 200, payload);
    } catch (error) {
        const message = error instanceof SheetsError ? error.message : 'Não foi possível ler a planilha. Tente novamente.';
        return sendJson(res, 502, { error: message });
    }
}
