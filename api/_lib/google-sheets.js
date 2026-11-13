// Leitura do Google Sheets com conta de serviço, sem dependências externas.
// A conta de serviço precisa ter acesso de Leitor à planilha.
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let cachedToken = null;

/** Lê o JSON da conta de serviço da variável GOOGLE_SERVICE_ACCOUNT_JSON. */
export function getServiceAccount() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
    if (!raw.trim()) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed.client_email || !parsed.private_key) return null;
        return { email: parsed.client_email, key: parsed.private_key.replace(/\\n/g, '\n') };
    } catch {
        return null;
    }
}

const base64url = value => Buffer.from(value).toString('base64url');

async function getAccessToken(account) {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.email === account.email && cachedToken.expires - 60 > now) return cachedToken.token;

    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({ iss: account.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.key, 'base64url');

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` })
    });
    if (!response.ok) throw new SheetsError('Não foi possível autenticar a conta de serviço no Google. Confira GOOGLE_SERVICE_ACCOUNT_JSON.');

    const data = await response.json();
    cachedToken = { email: account.email, token: data.access_token, expires: now + (data.expires_in || 3600) };
    return cachedToken.token;
}

export class SheetsError extends Error {}

async function sheetsGet(path, token) {
    const response = await fetch(`${SHEETS_URL}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 403) throw new SheetsError('A conta de serviço não tem acesso à planilha. Compartilhe a planilha com o e-mail dela como Leitor.');
    if (response.status === 404) throw new SheetsError('Planilha não encontrada. Confira ACESSOS_SHEET_ID.');
    if (!response.ok) throw new SheetsError(`Erro ao ler a planilha (HTTP ${response.status}).`);
    return response.json();
}

/** Normaliza nomes de abas e colunas para comparação (sem acento, caixa ou espaços extras). */
export function normalize(value) {
    return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Lê as abas pedidas e devolve { [chave]: linhas[][] }.
 * tabs: { chave: 'Nome da aba' }. Os nomes são comparados sem acento nem caixa.
 */
export async function readTabs(spreadsheetId, tabs) {
    const account = getServiceAccount();
    if (!account) throw new SheetsError('GOOGLE_SERVICE_ACCOUNT_JSON não configurada no servidor.');
    const token = await getAccessToken(account);

    const meta = await sheetsGet(`${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`, token);
    const titles = (meta.sheets || []).map(sheet => sheet.properties.title);

    const wanted = Object.entries(tabs).map(([key, name]) => {
        const title = titles.find(item => normalize(item) === normalize(name));
        if (!title) throw new SheetsError(`Aba "${name}" não encontrada na planilha.`);
        return [key, title];
    });

    const query = wanted.map(([, title]) => `ranges=${encodeURIComponent(`'${title.replace(/'/g, "''")}'`)}`).join('&');
    const data = await sheetsGet(`${encodeURIComponent(spreadsheetId)}/values:batchGet?${query}&valueRenderOption=FORMATTED_VALUE`, token);

    return Object.fromEntries(wanted.map(([key], index) => [key, data.valueRanges?.[index]?.values || []]));
}
