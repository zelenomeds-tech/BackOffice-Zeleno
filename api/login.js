// POST /api/login   { email, senha }  ->  cria a sessão e devolve os painéis da pessoa
import { CFG, acharUsuario, conferirSenha, gravarSessao, json, erro, lerCorpo, normalizarEmail, paineisDe } from './_lib.js';

// Atraso fixo em toda tentativa: torna inviável testar senha atrás de senha.
const esperar = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return erro(res, 405, 'Método não permitido.');

  if (!CFG.segredo) {
    return erro(res, 500, 'Falta configurar SSO_SECRET nas variáveis de ambiente da Vercel.');
  }

  const corpo = await lerCorpo(req);
  await esperar(400);

  const usuario = acharUsuario(corpo.email);
  const senhaOk = usuario ? conferirSenha(corpo.senha, usuario.hash) : false;

  // Mensagem única de propósito: não revela se o email existe ou não.
  if (!usuario || !senhaOk) return erro(res, 401, 'Email ou senha incorretos.');

  gravarSessao(res, usuario.email);
  return json(res, 200, {
    ok: true,
    nome: usuario.nome,
    email: usuario.email,
    paineis: paineisDe(usuario)
  });
}
