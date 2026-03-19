const {
  getRpcUrl,
  sendJson,
  requirePost,
  safeReadBody,
  supabaseFetch,
  criarSessionToken,
  setSessionCookie,
  clearSessionCookie
} = require('./_supabase');

module.exports = async function handler(req, res) {
  if (!requirePost(req, res)) return;

  try {
    const body = await safeReadBody(req);
    const usuario = String(body.usuario || '').trim();
    const senha = String(body.senha || '');

    if (!usuario || !senha) {
      return sendJson(res, 400, {
        sucesso: false,
        mensagem: 'Preencha usuario e senha.'
      });
    }

    const url = getRpcUrl('verificar_login_gestao');
    const { response, data } = await supabaseFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        p_usuario: usuario,
        p_senha: senha
      })
    });

    if (!response.ok) {
      clearSessionCookie(res);
      return sendJson(res, response.status, {
        sucesso: false,
        mensagem: data?.message || 'Falha ao validar as credenciais.',
        erro: data
      });
    }

    const usuarioEncontrado = Array.isArray(data) ? data[0] : null;

    if (!usuarioEncontrado || usuarioEncontrado.ativo === false) {
      clearSessionCookie(res);
      return sendJson(res, 401, {
        sucesso: false,
        mensagem: 'Usuario ou senha invalidos.'
      });
    }

    const token = criarSessionToken(usuarioEncontrado);
    setSessionCookie(res, token);

    return sendJson(res, 200, {
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      redirect: '/analistas.html',
      usuario: {
        id: usuarioEncontrado.id,
        usuario: usuarioEncontrado.usuario,
        nome: usuarioEncontrado.nome || '',
        role: usuarioEncontrado.role || 'admin'
      }
    });
  } catch (error) {
    clearSessionCookie(res);
    return sendJson(res, 500, {
      sucesso: false,
      mensagem: error.message || 'Erro interno ao realizar login.'
    });
  }
};
