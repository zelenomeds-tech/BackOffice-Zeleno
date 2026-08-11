// ---------------------------------------------------------------------------
//  Backoffice Zeleno — hub de acesso
//  Biblioteca compartilhada: usuários, painéis, sessão em cookie e token de SSO.
//
//  ⚠️ ESTE ARQUIVO NUNCA CHEGA AO NAVEGADOR. Ele só roda como função serverless
//     na Vercel. A lista de emails e os hashes de senha ficam aqui e apenas aqui.
// ---------------------------------------------------------------------------
import crypto from 'node:crypto';

// ===========================================================================
//  1) PAINÉIS
// ===========================================================================
//  sso:false  -> o hub manda a pessoa pro endereço normal e ela loga lá de novo.
//  sso:true   -> o hub gera um código de uso único e o painel já abre logado.
//                Só ligue depois que o painel tiver recebido o trecho de SSO.
export const PAINEIS = {
  descontos: {
    nome: 'Painel de Desconto',
    desc: 'Cria e acompanha os cupons da loja.',
    slug: 'codigo-descontos',
    url: 'https://codigo-descontos.vercel.app',
    sso: false
  },
  vendedores: {
    nome: 'Vendedores',
    desc: 'Carteira, contatos e pedidos de cada vendedor.',
    slug: 'espiao',
    url: 'https://espiao.zelenostore.com',
    sso: false
  },
  design: {
    nome: 'Back Design',
    desc: 'Banners e destaques visuais da loja.',
    slug: 'backdesign',
    url: 'https://backdesign.zelenostore.com',
    sso: false
  },
  ti: {
    nome: 'T.I',
    desc: 'Ferramentas e suporte técnico interno.',
    slug: 'painel-ti',
    url: 'https://painel-ti.zelenostore.com',
    sso: false
  },
  cs: {
    nome: 'Backoffice CS',
    desc: 'Clientes e pedidos de todos os vendedores.',
    slug: 'back-office-cs',
    url: 'https://back-office-cs.vercel.app',
    sso: false
  }
};

// ===========================================================================
//  2) USUÁRIOS
// ===========================================================================
//  Senha padrão: Nome + 2026 + @   (ex.: Carlos2026@)
//  O hash é scrypt — não dá pra voltar dele pra senha.
//  Para trocar a senha de alguém, rode:  node gerar-senha.mjs "NovaSenha"
//  e cole o resultado no campo `hash` da pessoa.
//
//  ⚠️ 'ti' e 'vendedores' estão liberados para todo mundo de propósito:
//     esses dois painéis têm login próprio (planilha do Apps Script e login do
//     vendedor), então quem manda no acesso continua sendo eles. Assim ninguém
//     perde acesso que já tinha. Quando a lista do T.I. chegar, é só apagar
//     'ti' de quem não deve ver.
export const USUARIOS = [
  {
    email: 'carlos.jeronymo@zelenomeds.com',
    nome: 'Carlos',
    hash: 'scrypt$a43a266fce51d14e17dbe54b3d3918fa$a21b68e3e5e112d1dd517f66ee0b7e8c6ace9e117984b1628128c3e36e6aa534f02d47da17b6193ace5757b3c52c4e620e0d6fe2713b6ee7f9e422ba0c37ed3f',
    paineis: ['descontos', 'design', 'ti', 'vendedores']
  },
  {
    email: 'laysla@zelenomeds.com',
    nome: 'Laysla',
    hash: 'scrypt$2d8190fd022c9a1eddbc2343882eb6f0$bf47024af7b97a37856e9e2e0f6cec20ddbf05a5aaa73cdc628b597e4c54c38862c392e6434b4177aa5c56e0c330f2ea4c9ae3e660c8f622fd04a517154fb6cc',
    paineis: ['descontos', 'design', 'ti', 'vendedores']
  },
  {
    email: 'luana.ereio@zelenomeds.com',
    nome: 'Luana',
    hash: 'scrypt$394f0a76dd35fd100e0736f73c35e11c$800a4282aa4b1fbc864bd39e7b6637af80b95ada972a76b6e74af30e3c53188a76ba82be287840edf28cbaccaf0a8295e0ed29cfe920c2ea157b2f4cfe3f851a',
    paineis: ['descontos', 'design', 'ti', 'vendedores']
  },
  {
    email: 'roberta.pinheiro@zelenomeds.com',
    nome: 'Roberta',
    hash: 'scrypt$b0b4762e40252c9a48bb37e0d1e9c674$062f44de9f41c79ce9f8c8892393fab14e57cd5390e8b93bbe07a872f6daf8cec9f2a1dca99300f4091666c99b59818ae88df685ec905a076fe83a6e4f220582',
    paineis: ['descontos', 'design', 'ti', 'vendedores']
  },
  {
    email: 'guilherme.gil@zelenomeds.com',
    nome: 'Guilherme',
    hash: 'scrypt$43801b955b2d60079588229543a23c21$82988a3a15f2367785353cd41f0a15ff4d153a011b10b4fd5e624cbcaf77a3d131a5b0461d2a4e02960d6923e1859fdca5c6d0cb045d0f617b25737b08021ea0',
    paineis: ['descontos', 'ti', 'vendedores']
  },
  {
    email: 'emily.barreto@zelenomeds.com',
    nome: 'Emily',
    hash: 'scrypt$9ec223435ec0ddd0f6c008e36bdca878$92dcb75636a4839b0d77d95ef0a85c505575c69c3d10a0e4435a44327e5b790ecf6a5d937ccd7d2f09644f133cf0821ea41afc800a0916d95b073424df49f4fc',
    paineis: ['design', 'ti', 'vendedores']
  },
  {
    email: 'mauricio.cabral@zelenomeds.com',
    nome: 'Mauricio',
    hash: 'scrypt$06fdc087b0e0b3ba17bc1ba097a60628$7b3545fc046f121b1c1476c3d80efddb7ffb934857a4031869adf03da1c671013490ec19b215d94a00a417d8718e1a253ccf32a62aaf62f80899045554c96c08',
    paineis: ['design', 'ti', 'vendedores']
  },
  {
    email: 'natan.batista@zelenomeds.com',
    nome: 'Natan',
    hash: 'scrypt$8d28b0c5453753567c282a3eb646140a$c47943a71763350f4a92f8755fef331e3f6c7ac2ac18c2bf706d8af23eec72039cc6f13cb6940b3b89602fd6258741191c9710732faa11906f53fb584c8c07b9',
    paineis: ['design', 'ti', 'vendedores']
  },
  {
    email: 'victor.santiago@zelenomeds.com',
    nome: 'Victor',
    hash: 'scrypt$6fdae0654155ed1aa6c9065cf378284a$be14f294a2c949f3d6cf63a584ab3a14ceed2e28b5cf35c9a0b3e1dffc4e8b4e028c6bf358ed465be7bcb1f65083e0e18653c5c969a292d72002a078b4a6c705',
    paineis: ['design', 'ti', 'vendedores']
  },
  {
    email: 'rafaela.oliveira@zelenomeds.com',
    nome: 'Rafaela',
    hash: 'scrypt$d158987731bc191dc15e88ab8e3cc00c$524909e985d5278662dab6a261344ba77ec06717d53753510921a70d3a50d5d05296c7f356ac96350830491518ba8de78938da7484889fdb13667703ab10cbb9',
    paineis: ['cs', 'ti', 'vendedores']
  }
];

// ===========================================================================
//  3) CONFIGURAÇÃO
// ===========================================================================
export const CFG = {
  // Segredo que assina o cookie de sessão E os códigos de SSO.
  // Precisa ser O MESMO nos painéis que forem receber SSO.
  segredo: String(process.env.SSO_SECRET || '').trim(),
  horasSessao: Number(process.env.HORAS_SESSAO || 12)
};

const COOKIE = 'zeleno_hub';
const JANELA_SSO_MS = 60 * 1000; // o código de SSO vale 60 segundos

// ===========================================================================
//  4) SENHA
// ===========================================================================
export function conferirSenha(senha, guardado) {
  const partes = String(guardado || '').split('$');
  if (partes[0] !== 'scrypt' || !partes[1] || !partes[2]) return false;
  try {
    const esperado = Buffer.from(partes[2], 'hex');
    const calc = crypto.scryptSync(String(senha == null ? '' : senha), Buffer.from(partes[1], 'hex'), esperado.length);
    return calc.length === esperado.length && crypto.timingSafeEqual(calc, esperado);
  } catch (e) {
    return false;
  }
}

export const normalizarEmail = v => String(v == null ? '' : v).trim().toLowerCase();

export function acharUsuario(email) {
  const e = normalizarEmail(email);
  if (!e) return null;
  return USUARIOS.find(u => u.email === e) || null;
}

// ===========================================================================
//  5) TOKEN ASSINADO (usado pela sessão e pelo SSO)
// ===========================================================================
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64url(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

export function criarToken(dados, validadeMs) {
  if (!CFG.segredo) throw new Error('SSO_SECRET não configurado.');
  const corpo = b64url(JSON.stringify(Object.assign({}, dados, { exp: Date.now() + validadeMs })));
  const assinatura = b64url(crypto.createHmac('sha256', CFG.segredo).update(corpo).digest());
  return corpo + '.' + assinatura;
}

export function abrirToken(token) {
  if (!CFG.segredo || !token) return null;
  const partes = String(token).split('.');
  if (partes.length !== 2) return null;
  const esperada = b64url(crypto.createHmac('sha256', CFG.segredo).update(partes[0]).digest());
  const a = Buffer.from(partes[1]);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(deB64url(partes[0]));
    if (!dados || !dados.exp || Date.now() > dados.exp) return null;
    return dados;
  } catch (e) {
    return null;
  }
}

// ===========================================================================
//  6) SESSÃO EM COOKIE
// ===========================================================================
export function gravarSessao(res, email) {
  const token = criarToken({ e: email }, CFG.horasSessao * 3600 * 1000);
  res.setHeader('Set-Cookie',
    COOKIE + '=' + token + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + (CFG.horasSessao * 3600));
}

export function apagarSessao(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

export function lerSessao(req) {
  const bruto = String(req.headers.cookie || '');
  let token = '';
  bruto.split(';').forEach(parte => {
    const i = parte.indexOf('=');
    if (i < 0) return;
    if (parte.slice(0, i).trim() === COOKIE) token = decodeURIComponent(parte.slice(i + 1).trim());
  });
  const dados = abrirToken(token);
  if (!dados || !dados.e) return null;
  return acharUsuario(dados.e);
}

// ===========================================================================
//  7) SSO — código de uso único que o painel de destino confere
// ===========================================================================
export function criarCodigoSSO(email, painel) {
  return criarToken({ e: email, p: painel, n: crypto.randomBytes(8).toString('hex') }, JANELA_SSO_MS);
}

// ===========================================================================
//  8) AJUDANTES DE RESPOSTA
// ===========================================================================
export function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

export function erro(res, status, mensagem) {
  return json(res, status, { ok: false, message: mensagem });
}

export async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  try {
    return JSON.parse(Buffer.concat(pedacos).toString() || '{}');
  } catch (e) {
    return {};
  }
}

// Monta a lista que o navegador pode ver: só os painéis DESTA pessoa.
export function paineisDe(usuario) {
  return (usuario.paineis || [])
    .filter(id => PAINEIS[id])
    .map(id => ({
      id,
      nome: PAINEIS[id].nome,
      desc: PAINEIS[id].desc,
      slug: PAINEIS[id].slug
    }));
}
