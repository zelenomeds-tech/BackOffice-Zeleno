// GET /api/ir?p=descontos  ->  manda a pessoa pro painel
//
//  Painel com sso:false  -> redireciona pro endereço normal (a pessoa loga lá).
//  Painel com sso:true   -> gera um código assinado, válido por 60 segundos,
//                           e redireciona pra {url}/sso?t=CODIGO. O painel confere
//                           a assinatura com o MESMO SSO_SECRET e já cria a sessão
//                           dele. Funciona mesmo entre domínios diferentes, porque
//                           o código viaja na URL e não como cookie.
import { PAINEIS, lerSessao, criarCodigoSSO, erro } from './_lib.js';

export default async function handler(req, res) {
  const usuario = lerSessao(req);
  if (!usuario) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  const id = String((req.query && req.query.p) || '').trim();
  const painel = PAINEIS[id];

  if (!painel) return erro(res, 404, 'Painel desconhecido.');
  if (!usuario.paineis.includes(id)) return erro(res, 403, 'Você não tem acesso a este painel.');

  let destino = painel.url;
  if (painel.sso) {
    destino = painel.url.replace(/\/$/, '') + '/sso?t=' + encodeURIComponent(criarCodigoSSO(usuario.email, id));
  }

  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', destino);
  return res.end();
}
