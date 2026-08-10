// ---------------------------------------------------------------------------
// MÓDULO: DESCONTOS  (era o repositório `codigo-descontos`)
//
// ⚠️ UNIFICAÇÃO (10/08): este arquivo é o server.js ORIGINAL do backoffice de
// descontos, recortado em módulo. Os blocos abaixo foram copiados VERBATIM
// (sem reindentar de propósito — assim o `diff` contra o original fica limpo).
//
// O QUE MUDOU em relação ao original — e SÓ isto:
//   1. `const app = express()` saiu daqui (o app agora nasce no server.js raiz).
//   2. `app.use(cors())` global virou cors SÓ nas rotas /api/* deste módulo.
//   3. `app.use(express.json())` global saiu (fica no server.js raiz).
//   4. A guarda de sessão deixou de ser `app.use()` cega em TUDO e virou
//      middleware aplicado NAS ROTAS DESTE MÓDULO (senão bloquearia o /design,
//      que tem login próprio e usuários que não existem na lista daqui).
//   5. `app.get('/')` virou `app.get('/descontos')`.
//   6. `express.static('public')` saiu — o HTML é servido por sendFile explícito
//      (se ficasse estático, /descontos.html abriria SEM passar pela sessão).
//   7. O `app.listen()` saiu (fica no server.js raiz).
//
// NADA de lógica de desconto/cupom/produto foi tocado.
// ---------------------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();

// Página do painel (antes: public/index.html deste repo).
const PAGINA = path.join(__dirname, '..', 'public', 'descontos.html');

// ===== VERBATIM: server.js original, linhas 17-157 (login/sessão) =====
// ====== LOGIN DO BACKOFFICE (5 usuários nomeados) ======
// Substitui o Basic Auth de usuário único por uma TELA DE LOGIN com sessão em cookie
// assinado (HttpOnly). As senhas ficam HASHEADAS (scrypt) — o texto puro nunca aparece
// no código. A geração de descontos (rotas abaixo) NÃO é tocada.

// Compat: se BACKOFFICE_USER/PASS existirem no .env, continuam valendo como um login.
const BACKOFFICE_USER = String(process.env.BACKOFFICE_USER || '').trim().toLowerCase();
const BACKOFFICE_PASS = String(process.env.BACKOFFICE_PASS || '');

// Usuários do painel. Senha em scrypt (salt + hash). NUNCA guardar senha em texto puro.
const BACKOFFICE_USERS = [
  { email: "luana.ereio@zelenomeds.com", salt: "87c27f198695c90eee1159fba9ccc900", hash: "d99ca52345e981457dd6f5b0df03f316cf2440eb087905bcbaf76494d332e5c4c2aa2fac8ab3e23f181ac509182387c89a595a5b9945cf77d35e84c192585bd3" },
  { email: "laysla@zelenomeds.com", salt: "6262c4909ff9a51a6b195e19f4ac7cd4", hash: "dd132fa28154d72db2a07c6d1557dac6e13aa7cd9bab3f316503a85a4ea37681b502ae61b91bd5b76d35da339f9e8e86496492fc17868b9df32b47bda68e6c5f" },
  { email: "roberta.pinheiro@zelenomeds.com", salt: "9d627a8f5f87c80b416fee5d92072f55", hash: "08613c5e57446facc5942802c79beb6376baaf0175f079d5274417020af7074dbe6c4f2f94ee0ddfcfdad971f175fa4168d59414d9d368af0557bfa46c31ea6d" },
  { email: "guilherme.gil@zelenomeds.com", salt: "35a84c871494a15b8f2fb144510ef71e", hash: "5b1f4581a67c5114d0033dd42dced0a62439d1b753d0d765c7082a2f9b2ca17a2d6df6dbc25cf2380ae3d5946234267aded6bec02282c58baaec1685c0ade052" },
  { email: "carlos.jeronymo@zelenomeds.com", salt: "7491fe6b977571d61b5d310413bc9ab0", hash: "9a0906c0417723eac491b1a1f6e1d1ec67d326953bc6e580535c4f1448bceb78f706652383481cde09ca8c0f91e5ecb8b4bb0d96adb1dd89b078cd0e29cae5bb" }
];

// Segredo para assinar a sessão. Em produção, defina BACKOFFICE_SESSION_SECRET na Vercel.
// Fallback determinístico (estável entre instâncias serverless) derivado dos hashes.
const SESSION_SECRET = String(process.env.BACKOFFICE_SESSION_SECRET || '').trim()
  || crypto.createHash('sha256').update(BACKOFFICE_USERS.map(function (u) { return u.hash; }).join('|') + '|zeleno-bo').digest('hex');
const SESSION_COOKIE = 'bo_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function senhaConfere(user, senha) {
  try {
    const calc = crypto.scryptSync(String(senha == null ? '' : senha), user.salt, 64);
    const stored = Buffer.from(user.hash, 'hex');
    return calc.length === stored.length && crypto.timingSafeEqual(calc, stored);
  } catch (e) { return false; }
}

function validarLogin(email, senha) {
  const e = String(email == null ? '' : email).trim().toLowerCase();
  if (!e) return null;
  const u = BACKOFFICE_USERS.find(function (x) { return x.email === e; });
  if (u && senhaConfere(u, senha)) return e;
  if (BACKOFFICE_USER && BACKOFFICE_PASS && e === BACKOFFICE_USER && String(senha) === BACKOFFICE_PASS) return e;
  return null;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function assinarSessao(email) {
  const payload = b64url(JSON.stringify({ e: email, exp: Date.now() + SESSION_TTL_MS }));
  const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  return payload + '.' + sig;
}
function lerSessao(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const partes = token.split('.');
  const payload = partes[0];
  const sig = partes[1] || '';
  const esperado = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (!dados || !dados.e || !dados.exp || Date.now() > dados.exp) return null;
    return dados.e;
  } catch (e) { return null; }
}
function lerCookie(req, nome) {
  const raw = String(req.headers.cookie || '');
  const itens = raw.split(';');
  for (let k = 0; k < itens.length; k++) {
    const parte = itens[k];
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return '';
}

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Entrar — Backoffice Zeleno</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family:'Poppins',sans-serif; background:linear-gradient(135deg,#013A2A,#00543D); padding:20px; }
  .card { background:#FDFAF2; width:100%; max-width:380px; border-radius:18px; padding:34px 30px;
    box-shadow:0 24px 60px rgba(0,0,0,.28); }
  .logo { text-align:center; font-weight:900; font-size:24px; color:#00543D; letter-spacing:.5px; }
  .sub { text-align:center; color:#5b6b63; font-size:13px; margin:4px 0 24px; }
  label { display:block; font-size:12px; font-weight:600; color:#013A2A; margin:14px 0 6px; }
  input { width:100%; padding:12px 14px; border:1px solid #d7ddd9; border-radius:10px; font-size:14px;
    font-family:inherit; outline:none; }
  input:focus { border-color:#00543D; box-shadow:0 0 0 3px rgba(0,84,61,.12); }
  button { width:100%; margin-top:22px; padding:13px; border:none; border-radius:10px; cursor:pointer;
    background:#00543D; color:#fff; font-weight:700; font-size:15px; font-family:inherit; }
  button:hover { background:#013A2A; }
  button:disabled { opacity:.6; cursor:default; }
  .erro { display:none; margin-top:14px; background:#fdecec; color:#b91c1c; border:1px solid #f6caca;
    padding:10px 12px; border-radius:10px; font-size:13px; text-align:center; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">ZELENO</div>
    <div class="sub">Backoffice de Descontos</div>
    <label for="email">Email</label>
    <input id="email" type="email" autocomplete="username" placeholder="seuemail@zelenomeds.com" />
    <label for="senha">Senha</label>
    <input id="senha" type="password" autocomplete="current-password" placeholder="Sua senha" />
    <div class="erro" id="erro"></div>
    <button id="btn" type="button">Entrar</button>
  </div>
<script>
  var btn = document.getElementById('btn');
  var erro = document.getElementById('erro');
  function mostrarErro(msg){ erro.textContent = msg; erro.style.display = 'block'; }
  async function entrar(){
    erro.style.display = 'none';
    var email = document.getElementById('email').value.trim();
    var senha = document.getElementById('senha').value;
    if(!email || !senha){ mostrarErro('Preencha email e senha.'); return; }
    btn.disabled = true; btn.textContent = 'Entrando...';
    try{
      var r = await fetch('/api/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: email, senha: senha })
      });
      var d = await r.json().catch(function(){ return {}; });
      if(r.ok && d && d.success){ window.location.href = '/descontos'; return; } // ⚠️ era '/' (agora '/' é o menu)
      mostrarErro((d && d.message) || 'Email ou senha inválidos.');
    }catch(e){ mostrarErro('Erro ao entrar. Tente de novo.'); }
    btn.disabled = false; btn.textContent = 'Entrar';
  }
  btn.addEventListener('click', entrar);
  document.getElementById('senha').addEventListener('keydown', function(ev){ if(ev.key === 'Enter') entrar(); });
</script>
</body>
</html>`;

// ===== VERBATIM: server.js original, linhas 188-233 (ponte com a LOJA) =====
// ⚠️ MIGRAÇÃO (10/07): fim do Apps Script neste backoffice. TODAS as leituras/gravações
// (produtos, descontos por produto, desconto global e cupom de frete grátis) vão direto
// pra LOJA, autenticadas pelo header x-sync-secret — SERVER-SIDE apenas, o segredo
// nunca chega ao navegador.
const LOJA_SYNC_URL = String(process.env.LOJA_SYNC_URL || '').trim();
const LOJA_SYNC_SECRET = String(process.env.LOJA_SYNC_SECRET || '').trim();

// === DESCONTO GLOBAL ("TODOS os produtos") — repassa pra LOJA (banco) ========
// A planilha (Apps Script) não aceita regra "TODOS"; a loja guarda no Supabase.
// Reusa LOJA_SYNC_URL + LOJA_SYNC_SECRET (header x-sync-secret) — os mesmos do sync.
async function lojaGlobal(method, sufixo, corpo) {
  if (!LOJA_SYNC_URL || !LOJA_SYNC_SECRET) {
    throw new Error('LOJA_SYNC_URL/SECRET não configurados (necessários p/ desconto global)');
  }
  const resp = await fetch(`${LOJA_SYNC_URL.replace(/\/$/, '')}/api/admin/desconto-global${sufixo || ''}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-sync-secret': LOJA_SYNC_SECRET },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    throw new Error((data && data.message) || `Loja respondeu HTTP ${resp.status}`);
  }
  return data;
}

// === DESCONTO POR PRODUTO — repassa pra LOJA (banco) =========================
// ⚠️ MIGRAÇÃO (07/07): o Apps Script foi TRANCADO ("Somente eu") pós-incidente e
// devolve HTML de login, não JSON -> saveCoupon/deleteCoupon/getCoupons quebravam
// ("Apps Script não retornou JSON"). Agora grava/lê direto no espelho da LOJA
// (/api/admin/descontos), reusando LOJA_SYNC_URL + LOJA_SYNC_SECRET (server-side).
async function lojaDesconto(method, sufixo, corpo) {
  if (!LOJA_SYNC_URL || !LOJA_SYNC_SECRET) {
    throw new Error('LOJA_SYNC_URL/SECRET não configurados (necessários p/ desconto por produto)');
  }
  const resp = await fetch(`${LOJA_SYNC_URL.replace(/\/$/, '')}/api/admin/descontos${sufixo || ''}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-sync-secret': LOJA_SYNC_SECRET },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    throw new Error((data && data.message) || `Loja respondeu HTTP ${resp.status}`);
  }
  return data;
}

// ===== VERBATIM: server.js original, linhas 301-350 (helpers de normalização) =====
function parseMoney(value) {
  if (typeof value === 'number') return value;

  const raw = String(value || '').trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const number = Number(cleaned);
  return Number.isNaN(number) ? 0 : number;
}

function normalizarTipo(tipo) {
  const value = String(tipo || '').trim().toLowerCase();

  if (value === 'grama') return 'gramas';

  return value;
}

function normalizarProduto(row) {
  return {
    id: String(row.produtoId || row.id || '').trim(),
    nome: row.produto || '',
    preco: parseMoney(row.preco_base || row.preco_final || row.valor_unitario),
    preco_base: parseMoney(row.preco_base),
    fornecedor: row.fornecedor || '',
    categoria: row.categoria || '',
    status: row.status || '',
    tipo_desconto: row.tipo_desconto || '',
    min_gramas: row.min_gramas || '',
    valor_unitario: row.valor_unitario || '',
    percentual: row.percentual || '',
    cupom: row.cupom || '',
    ativo: row.ativo || '',
    limite_uso_por_cliente: row.limite_uso_por_cliente || row.limiteUsoPorCliente || row.limite_uso || '',
    limiteUsoPorCliente: row.limiteUsoPorCliente || row.limite_uso_por_cliente || row.limite_uso || '',
    desconto_pessoal_vendedor: row.desconto_pessoal_vendedor || row.descontoPessoalVendedor || '',
    descontoPessoalVendedor: row.descontoPessoalVendedor || row.desconto_pessoal_vendedor || '',
    // (07/08) sem devolver isto, o painel não teria como marcar o checkbox ao EDITAR
    // nem exibir o selo na lista — e salvar apagaria a regra sem ninguém perceber.
    somente_primeira_compra: row.somente_primeira_compra || row.somentePrimeiraCompra || '',
    somentePrimeiraCompra: row.somentePrimeiraCompra || row.somente_primeira_compra || '',
    validade: row.validade || row.valido_ate || '' // 'yyyy-mm-dd' ou '' (sem validade)
  };
}

// ---------------------------------------------------------------------------
// Guardas de sessão. Antes era UM `app.use()` que barrava o app inteiro; agora
// são dois middlewares aplicados só nas rotas deste módulo (a lógica de checar
// o cookie é a MESMA — lerSessao + lerCookie).
// Dois em vez de um porque, montado com `app.use('/api/x', mw)`, o `req.path`
// vira relativo ao mount ('/'), então não dá pra decidir com startsWith('/api/').
// ---------------------------------------------------------------------------
function exigirSessaoApi(req, res, next) {
  if (lerSessao(lerCookie(req, SESSION_COOKIE))) return next();
  return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
}
function exigirSessaoPagina(req, res, next) {
  if (lerSessao(lerCookie(req, SESSION_COOKIE))) return next();
  return res.redirect('/login');
}

const corsMw = cors();

// Prefixos de API que pertencem a ESTE módulo (usados pra aplicar cors + sessão).
// `app.use('/api/descontos', mw)` também pega '/api/descontos/:id'.
const PREFIXOS_API = [
  '/api/produtos',
  '/api/descontos',
  '/api/desconto-global',
  '/api/cupom-frete-gratis'
];

function montar(app) {
  // cors nas rotas de login (o original tinha cors global).
  app.use('/api/login', corsMw);
  app.use('/api/logout', corsMw);

// ===== VERBATIM: server.js original, linhas 159-175 (rotas de login) =====
// Rotas de login (liberadas SEM sessão).
app.get('/login', (req, res) => {
  if (lerSessao(lerCookie(req, SESSION_COOKIE))) return res.redirect('/descontos'); // ⚠️ era '/'
  return res.set('Content-Type', 'text/html; charset=utf-8').send(LOGIN_PAGE);
});
app.post('/api/login', (req, res) => {
  const email = validarLogin(req.body && req.body.email, req.body && req.body.senha);
  if (!email) return res.status(401).json({ success: false, message: 'Email ou senha inválidos.' });
  const token = assinarSessao(email);
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.set('Set-Cookie', SESSION_COOKIE + '=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + Math.floor(SESSION_TTL_MS / 1000) + secure);
  return res.json({ success: true });
});
app.post('/api/logout', (req, res) => {
  res.set('Set-Cookie', SESSION_COOKIE + '=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  return res.json({ success: true });
});

  // cors + exigência de sessão nas rotas de API deste módulo.
  PREFIXOS_API.forEach(function (p) { app.use(p, corsMw, exigirSessaoApi); });

  // Painel de descontos (antes: app.get('/') servindo public/index.html).
  app.get('/descontos', exigirSessaoPagina, (req, res) => {
    res.sendFile(PAGINA);
  });

// ===== VERBATIM: server.js original, linhas 235-295 (desconto global + cupom frete) =====
app.get('/api/desconto-global', async (req, res) => {
  try { return res.json(await lojaGlobal('GET')); }
  catch (e) { return res.status(502).json({ success: false, message: String(e.message || e) }); }
});

app.post('/api/desconto-global', async (req, res) => {
  try { return res.json(await lojaGlobal('POST', '', req.body || {})); }
  catch (e) { return res.status(502).json({ success: false, message: String(e.message || e) }); }
});

app.delete('/api/desconto-global/:id', async (req, res) => {
  try { return res.json(await lojaGlobal('DELETE', `/${encodeURIComponent(req.params.id)}`)); }
  catch (e) { return res.status(502).json({ success: false, message: String(e.message || e) }); }
});

// Cupom pessoal de frete grátis para SP capital. Vive como desconto GLOBAL
// `cupom_frete_sp` na mesma tabela das demais regras do painel.
app.get('/api/cupom-frete-gratis', async (req, res) => {
  try {
    const data = await lojaGlobal('GET');
    const cupons = (Array.isArray(data.globais) ? data.globais : [])
      .filter((r) => String(r.tipo_desconto || '').trim().toLowerCase() === 'cupom_frete_sp')
      .map((r) => ({
        id: r.id,
        codigo: r.cupom || '',
        limite_uso_por_cliente: r.limite_uso_por_cliente || '',
        validade: r.validade || '',
        desconto_pessoal_vendedor: 'sim'
      }));
    return res.json({ success: true, cupons });
  }
  catch (e) { return res.status(502).json({ success: false, message: String(e.message || e) }); }
});

app.post('/api/cupom-frete-gratis', async (req, res) => {
  try {
    const body = req.body || {};
    return res.json(await lojaGlobal('POST', '', {
      tipo_desconto: 'cupom_frete_sp',
      cupom: body.codigo || body.cupom || '',
      limite_uso_por_cliente: body.limiteUsoPorCliente || body.limite_uso_por_cliente || '',
      desconto_pessoal_vendedor: 'sim',
      validade: body.validade || '',
      ativo: 'sim'
    }));
  } catch (e) { return res.status(502).json({ success: false, message: String(e.message || e) }); }
});

app.delete('/api/cupom-frete-gratis/:codigo', async (req, res) => {
  try {
    const codigo = String(req.params.codigo || '').trim().toUpperCase();
    const data = await lojaGlobal('GET');
    const regra = (Array.isArray(data.globais) ? data.globais : []).find((r) =>
      String(r.tipo_desconto || '').trim().toLowerCase() === 'cupom_frete_sp'
      && String(r.cupom || '').trim().toUpperCase() === codigo
    );
    if (!regra) return res.status(404).json({ success: false, message: 'Cupom não encontrado.' });
    return res.json(await lojaGlobal('DELETE', `/${encodeURIComponent(regra.id)}`));
  }
  catch (e) { return res.status(502).json({ success: false, message: String(e.message || e) }); }
});

// ===== VERBATIM: server.js original, linhas 352-608 (produtos + CRUD de descontos) =====
app.get('/api/produtos', async (req, res) => {
  try {
    // ⚠️ MIGRAÇÃO (07/07): o Apps Script foi TRANCADO ("Somente eu") pós-incidente e devolvia HTML de
    // login -> a lista de produtos vinha VAZIA. Agora busca a lista da LOJA (Node/Supabase, fonte da
    // vitrine) por /api/admin/produtos-lista, reusando LOJA_SYNC_URL + LOJA_SYNC_SECRET (server-side, o
    // segredo NÃO vai pro navegador). Mantém o MESMO shape que o front espera (results + normalizarProduto).
    if (!LOJA_SYNC_URL || !LOJA_SYNC_SECRET) {
      throw new Error('LOJA_SYNC_URL/SECRET não configurados (necessários p/ listar produtos)');
    }
    const resp = await fetch(`${LOJA_SYNC_URL.replace(/\/$/, '')}/api/admin/produtos-lista`, {
      headers: { 'x-sync-secret': LOJA_SYNC_SECRET }
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.success === false) {
      throw new Error((data && data.message) || `Loja respondeu HTTP ${resp.status}`);
    }

    const produtos = (data.produtos || []).map((p) => ({
      id: String(p.id || '').trim(),
      nome: p.nome || '',
      preco: Number(p.preco) || 0,
      preco_base: Number(p.preco) || 0,
      fornecedor: p.fornecedor || '',
      categoria: p.categoria || '',
      status: p.status || '',
      // campos de desconto ficam vazios aqui (o backoffice os preenche ao APLICAR); mantém o shape.
      tipo_desconto: '', min_gramas: '', valor_unitario: '', percentual: '', cupom: '', ativo: '',
      limite_uso_por_cliente: '', limiteUsoPorCliente: '',
      desconto_pessoal_vendedor: '', descontoPessoalVendedor: ''
    })).filter((produto) => produto.id && produto.nome);

    return res.json({
      success: true,
      total: produtos.length,
      results: produtos
    });
  } catch (error) {
    console.error('Erro ao buscar produtos da loja:', error.message || error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao buscar produtos'
    });
  }
});

app.get('/api/descontos', async (req, res) => {
  try {
    const data = await lojaDesconto('GET'); // ⚠️ era getCoupons no Apps Script (trancado)

    const descontos = (data.results || [])
      .map((row) => {
        const produto = normalizarProduto(row);
        const tipo = normalizarTipo(produto.tipo_desconto);

        let valor = 0;

        if (tipo === 'gramas') {
          valor = parseMoney(produto.valor_unitario);
        }

        if (tipo === 'percentual' || tipo === 'cupom') {
          valor = parseMoney(produto.percentual);
        }

        return {
          id: produto.id,
          produtoId: produto.id,
          produtoNome: produto.nome,
          tipo,
          valor,
          minGramas: parseMoney(produto.min_gramas),
          cupom: String(produto.cupom || '').trim().toUpperCase(),
          ativo: String(produto.ativo || '').trim().toLowerCase(),
          limite_uso_por_cliente: produto.limite_uso_por_cliente || '',
          limiteUsoPorCliente: produto.limiteUsoPorCliente || produto.limite_uso_por_cliente || '',
          desconto_pessoal_vendedor: produto.desconto_pessoal_vendedor || '',
          descontoPessoalVendedor: produto.descontoPessoalVendedor || produto.desconto_pessoal_vendedor || '',
          validade: produto.validade || '' // painel mostra 'Válido até' e badge 'Expirado'
        };
      })
      .filter((item) => {
        return item.produtoId &&
          item.tipo &&
          item.ativo === 'sim' &&
          (
            item.tipo === 'gramas' ||
            item.tipo === 'percentual' ||
            item.tipo === 'cupom'
          );
      });

    return res.json({
      success: true,
      descontos
    });
  } catch (error) {
    console.error('Erro ao listar descontos:', error.message || error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao listar descontos'
    });
  }
});

app.post('/api/descontos', async (req, res) => {
  try {
    const {
      produtoId,
      produtoNome,
      tipo,
      valor,
      minGramas,
      cupom,
      limiteUsoPorCliente,
      limite_uso_por_cliente,
      limiteUso,
      limite_uso,
      descontoPessoalVendedor,
      desconto_pessoal_vendedor,
      descontoPessoal,
      desconto_pessoal,
      // (07/08) Cupom SOMENTE PRIMEIRA COMPRA — ver o PUT abaixo e o comentário no repasse.
      somentePrimeiraCompra,
      somente_primeira_compra,
      validade
    } = req.body;

    if (!produtoId || !tipo) {
      return res.status(400).json({
        success: false,
        message: 'produtoId e tipo são obrigatórios'
      });
    }

    const result = await lojaDesconto('POST', '', {
      produtoId: String(produtoId),
      produtoNome: produtoNome || '',
      tipo,
      valor,
      minGramas,
      cupom,
      limiteUsoPorCliente: limiteUsoPorCliente || limite_uso_por_cliente || limiteUso || limite_uso || '',
      descontoPessoalVendedor: descontoPessoalVendedor || desconto_pessoal_vendedor || descontoPessoal || desconto_pessoal || '',
      // ATENCAO (07/08): SEMPRE repassado, inclusive vazio — a loja faz upsert reescrevendo a linha
      // inteira, então um campo omitido aqui APAGA a marcação do cupom na próxima edição.
      somentePrimeiraCompra: somentePrimeiraCompra || somente_primeira_compra || '',
      validade: validade || '' // 'yyyy-mm-dd' ou '' (sem validade)
    });
    // ⚠️ grava DIRETO no espelho da loja — não precisa mais do sync planilha->loja.

    return res.json({
      success: true,
      desconto: result.desconto || null,
      message: result.message || 'Desconto salvo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar desconto:', error.message || error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao salvar desconto'
    });
  }
});

app.put('/api/descontos/:produtoId', async (req, res) => {
  try {
    const produtoIdParam = req.params.produtoId;

    const {
      produtoId,
      produtoNome,
      tipo,
      valor,
      minGramas,
      cupom,
      limiteUsoPorCliente,
      limite_uso_por_cliente,
      limiteUso,
      limite_uso,
      descontoPessoalVendedor,
      desconto_pessoal_vendedor,
      descontoPessoal,
      desconto_pessoal,
      somentePrimeiraCompra,
      somente_primeira_compra,
      validade
    } = req.body;

    const finalProdutoId = String(produtoId || produtoIdParam || '').trim();

    if (!finalProdutoId || !tipo) {
      return res.status(400).json({
        success: false,
        message: 'produtoId e tipo são obrigatórios'
      });
    }

    const result = await lojaDesconto('POST', '', {
      produtoId: finalProdutoId,
      produtoNome: produtoNome || '',
      tipo,
      valor,
      minGramas,
      cupom,
      limiteUsoPorCliente: limiteUsoPorCliente || limite_uso_por_cliente || limiteUso || limite_uso || '',
      descontoPessoalVendedor: descontoPessoalVendedor || desconto_pessoal_vendedor || descontoPessoal || desconto_pessoal || '',
      // ATENCAO (07/08): ver o POST — campo omitido aqui = marcação apagada, porque isto é upsert.
      somentePrimeiraCompra: somentePrimeiraCompra || somente_primeira_compra || '',
      validade: validade || '' // 'yyyy-mm-dd' ou '' (sem validade)
    });
    // ⚠️ upsert por id do produto no espelho — editar é re-salvar (sobrescreve).

    return res.json({
      success: true,
      desconto: result.desconto || null,
      message: result.message || 'Desconto atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao editar desconto:', error.message || error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao editar desconto'
    });
  }
});

app.delete('/api/descontos/:produtoId', async (req, res) => {
  try {
    const produtoId = String(req.params.produtoId || '').trim();

    if (!produtoId) {
      return res.status(400).json({
        success: false,
        message: 'produtoId é obrigatório'
      });
    }

    const result = await lojaDesconto('DELETE', `/${encodeURIComponent(produtoId)}`);
    // ⚠️ remove a linha do produto direto no espelho da loja.

    return res.json({
      success: true,
      message: result.message || 'Desconto excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir desconto:', error.message || error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao excluir desconto'
    });
  }
});
}

module.exports = { montar };