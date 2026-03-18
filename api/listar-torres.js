const { getTorresUrl, sendJson, supabaseFetch } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { sucesso: false, mensagem: 'Metodo nao permitido.' });
  }

  try {
    const url = getTorresUrl('?select=id,nome&order=nome.asc');
    const { response, data } = await supabaseFetch(url, { method: 'GET' });

    if (!response.ok) {
      return sendJson(res, response.status, {
        sucesso: false,
        mensagem: data?.message || 'Falha ao listar as torres.',
        erro: data
      });
    }

    return sendJson(res, 200, {
      sucesso: true,
      torres: Array.isArray(data) ? data : []
    });
  } catch (error) {
    return sendJson(res, 500, {
      sucesso: false,
      mensagem: error.message || 'Erro interno ao listar torres.'
    });
  }
};
