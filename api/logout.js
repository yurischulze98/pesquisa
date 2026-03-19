const {
  sendJson,
  clearSessionCookie
} = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      sucesso: false,
      mensagem: 'Metodo nao permitido.'
    });
  }

  clearSessionCookie(res);
  return sendJson(res, 200, {
    sucesso: true,
    mensagem: 'Sessao encerrada com sucesso.'
  });
};
