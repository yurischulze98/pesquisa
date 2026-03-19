const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'analistas';
const SUPABASE_TORRES_TABLE = process.env.SUPABASE_TORRES_TABLE || 'torres';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || '';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'gestao_session';
const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS || 60 * 60 * 12);

function getBaseHeaders() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.');
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function getResourceUrl(resource, query = '') {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
  return `${cleanUrl}/rest/v1/${resource}${query}`;
}

function getTableUrl(query = '') {
  return getResourceUrl(SUPABASE_TABLE, query);
}

function getTorresUrl(query = '') {
  return getResourceUrl(SUPABASE_TORRES_TABLE, query);
}

function getRpcUrl(functionName) {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
  return `${cleanUrl}/rest/v1/rpc/${functionName}`;
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(payload));
}

function requirePost(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { sucesso: false, mensagem: 'Metodo nao permitido.' });
    return false;
  }

  return true;
}

function requireGet(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { sucesso: false, mensagem: 'Metodo nao permitido.' });
    return false;
  }

  return true;
}

function requireAdminToken(req, res) {
  if (!ADMIN_TOKEN) {
    return false;
  }

  const token = req.headers['x-admin-token'];

  if (!token || token !== ADMIN_TOKEN) {
    return false;
  }

  return true;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};

  header.split(';').forEach(parte => {
    const item = parte.trim();
    if (!item) return;

    const idx = item.indexOf('=');
    if (idx === -1) return;

    const chave = item.slice(0, idx).trim();
    const valor = item.slice(idx + 1).trim();

    if (chave) {
      cookies[chave] = decodeURIComponent(valor);
    }
  });

  return cookies;
}

function assinarToken(payloadBase64) {
  if (!SESSION_SECRET) {
    throw new Error('Configure SESSION_SECRET na Vercel para usar login por usuario e senha.');
  }

  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');
}

function criarSessionToken(usuario) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: Number(usuario.id),
    usuario: String(usuario.usuario || ''),
    nome: String(usuario.nome || ''),
    role: String(usuario.role || 'admin').toLowerCase(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const assinatura = assinarToken(payloadBase64);

  return `${payloadBase64}.${assinatura}`;
}

function lerSessionToken(token) {
  if (!SESSION_SECRET || !token || typeof token !== 'string') {
    return null;
  }

  const [payloadBase64, assinaturaRecebida] = token.split('.');

  if (!payloadBase64 || !assinaturaRecebida) {
    return null;
  }

  const assinaturaEsperada = assinarToken(payloadBase64);
  const a = Buffer.from(assinaturaRecebida, 'utf8');
  const b = Buffer.from(assinaturaEsperada, 'utf8');

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!payload || !payload.exp || payload.exp < agora) {
    return null;
  }

  return payload;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  return lerSessionToken(token);
}

function isAdminRole(role) {
  const roleNormalizada = String(role || '').toLowerCase();
  return ['admin', 'gestor', 'editor'].includes(roleNormalizada);
}

function setSessionCookie(res, token) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const partes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (secure) {
    partes.push('Secure');
  }

  res.setHeader('Set-Cookie', partes.join('; '));
}

function clearSessionCookie(res) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const partes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (secure) {
    partes.push('Secure');
  }

  res.setHeader('Set-Cookie', partes.join('; '));
}

function requireAdminAccess(req, res) {
  const sessionUser = getSessionUser(req);

  if (sessionUser && isAdminRole(sessionUser.role)) {
    req.authUser = sessionUser;
    return true;
  }

  if (requireAdminToken(req, res)) {
    req.authUser = {
      sub: 0,
      usuario: 'token-admin',
      nome: 'Token Admin',
      role: 'admin'
    };
    return true;
  }

  sendJson(res, 401, {
    sucesso: false,
    mensagem: 'Acesso nao autorizado. Faca login para continuar.'
  });
  return false;
}

async function safeReadBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (!req.body || typeof req.body !== 'string') {
    return {};
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

async function supabaseFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getBaseHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return { response, data: json };
}

module.exports = {
  SUPABASE_TABLE,
  SUPABASE_TORRES_TABLE,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getResourceUrl,
  getTableUrl,
  getTorresUrl,
  getRpcUrl,
  sendJson,
  requirePost,
  requireGet,
  requireAdminToken,
  requireAdminAccess,
  safeReadBody,
  supabaseFetch,
  criarSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  isAdminRole
};
