const {
  getTableUrl,
  sendJson,
  requirePost,
  requireAdminAccess,
  safeReadBody,
  supabaseFetch
} = require('./_supabase');

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireAdminAccess(req, res)) return;

  try {
    const body = await safeReadBody(req);
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'ID invalido.' });
    }

    const url = getTableUrl(`?id=eq.${id}`);
    const { response, data } = await supabaseFetch(url, {
      method: 'DELETE',
      headers: {
        Prefer: 'return=representation'
      }
    });

    if (!response.ok) {
      return sendJson(res, response.status, {
        sucesso: false,
        mensagem: data?.message || 'Falha ao remover o analista.',
        erro: data
      });
    }

    const removido = Array.isArray(data) ? data[0] : null;

    if (!removido) {
      return sendJson(res, 404, { sucesso: false, mensagem: 'Analista nao encontrado.' });
    }

    return sendJson(res, 200, {
      sucesso: true,
      mensagem: 'Analista removido com sucesso.',
      analista: removido
    });
  } catch (error) {
    return sendJson(res, 500, {
      sucesso: false,
      mensagem: error.message || 'Erro interno ao remover analista.'
    });
  }
};
