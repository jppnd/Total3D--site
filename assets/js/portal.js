/* ==========================================================================
   TOTAL3D · portal.js  (área logada: portal.html)
   Depende de config.js e common.js.
   Abas: geral, projetos, conta, privacidade, ajuda (#geral, #projetos, ...).
   Códigos de teste em DEMO: DEMO-2026 e DEMO-TORRES.
   ========================================================================== */
(function () {
'use strict';

const CONFIG = {
  DEMO: T3.config.DEMO,
  API_BASE: T3.config.API_BASE,
  LOGIN_URL: T3.config.PAGES.login,
  EP: T3.config.ENDPOINTS
};
const { $, $$, digits, esc, wait, maskPhone, validPhone, NAME_RE, setUrl } = T3;
const fmtDate = d => { try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) { return '—'; } };
const fmtDateTime = d => { try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return '—'; } };

/* ---------- Máscaras / formatação ---------- */
function fmtCPF(v) { const d = digits(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v; }
function fmtCNPJ(v) {
  const f = (v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return f.length === 14 ? f.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5') : v;
}

/* ---------- Dados de demonstração ---------- */
const DEMO_CODES = {
  'DEMO-2026':   { id: 'p1', nome: 'Residencial Exemplo', construtora: 'Construtora Exemplo', cidade: 'Cidade · UF', tipo: 'Residencial', status: 'Modelo 3D disponível',
                   boxes: [{x:0,y:0,w:2,d:2,h:9},{x:3,y:0,w:2,d:2,h:6},{x:0,y:3,w:2,d:2,h:4},{x:3,y:3,w:2,d:2,h:7}] },
  'DEMO-TORRES': { id: 'p2', nome: 'Torres Exemplo', construtora: 'Incorporadora Exemplo', cidade: 'Cidade · UF', tipo: 'Residencial', status: 'Modelo 3D disponível',
                   boxes: [{x:0,y:0,w:2,d:2,h:12},{x:3,y:1,w:2,d:2,h:10},{x:6,y:2,w:2,d:2,h:8}] }
};
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
const demoDb = store.get('total3d-demo-portal') || { perfil: 'corretor', projetos: [], prefs: { projetos: true, novidades: false } };
const saveDemo = () => store.set('total3d-demo-portal', demoDb);

function demoUser() {
  const c = demoDb.perfil === 'construtora';
  return {
    nome: c ? 'Marina Alves' : 'Carlos Lima', email: c ? 'marina@exemplo.com.br' : 'carlos@exemplo.com.br',
    telefone: c ? '11987654321' : '48999991234', perfil: demoDb.perfil,
    documento: c ? '11222333000181' : '52998224725',
    razaoSocial: c ? 'Construtora Exemplo Ltda' : undefined, creci: c ? undefined : { uf: 'SP', numero: '123456', tipo: 'F' },
    prefs: demoDb.prefs, ultimoAcesso: new Date().toISOString()
  };
}

async function demoApi(path, method, body) {
  await wait(500);
  const E = CONFIG.EP;
  if (path === E.me && method === 'GET') return demoUser();
  if (path === E.me && method === 'PATCH') { if (body.prefs) Object.assign(demoDb.prefs, body.prefs); saveDemo(); return { ok: true }; }
  if (path === E.senha) { if (body.atual !== 'demo') { const e = new Error('Senha atual incorreta.'); e.status = 403; throw e; } return { ok: true }; }
  if (path === E.projetos && method === 'GET') return { projetos: demoDb.projetos };
  if (path === E.liberar) {
    const p = DEMO_CODES[body.codigo];
    if (!p) { const e = new Error('Código inválido'); e.status = 404; throw e; }
    if (demoDb.projetos.some(x => x.id === p.id)) { const e = new Error('Já liberado'); e.status = 409; throw e; }
    const proj = Object.assign({}, p, { liberadoEm: new Date().toISOString() });
    demoDb.projetos.push(proj); saveDemo();
    return { projeto: proj };
  }
  return { ok: true };
}

async function api(path, method, body) {
  if (CONFIG.DEMO) return demoApi(path, method || 'GET', body || {});
  try {
    return await T3.http(path, method, body);
  } catch (err) {
    if (err.status === 401) { goLogin(); err.message = 'Sessão expirada.'; }
    throw err;
  }
}
function goLogin() { try { window.location.href = CONFIG.LOGIN_URL; } catch (_) {} }

/* ---------- Estado ---------- */
const state = { user: null, projects: [], openProject: null, tab: 'geral' };

/* ---------- Utilidades de interface ---------- */
function setBusy(btn, busy, text) {
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.classList.add('busy'); }
  else if (btn.dataset.label) { btn.textContent = btn.dataset.label; btn.classList.remove('busy'); }
  btn.disabled = busy;
}
function msg(el, text, kind) {
  el.hidden = !text; el.className = 'alert' + (kind === 'ok' ? ' ok' : ''); el.textContent = text || '';
}
function setErr(id, text, inputId) {
  const e = document.getElementById(id); if (e) e.textContent = text || '';
  const i = document.getElementById(inputId);
  if (i) { if (text) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); }
}
/* ---------- Miniatura isométrica (modelo ilustrativo) ---------- */
function isoSVG(boxes) {
  boxes = boxes && boxes.length ? boxes : [{x:0,y:0,w:2,d:2,h:6}];
  const W = 320, H = 220, k = 0.866;
  const proj = (x, y, z, s) => [(x - y) * k * s, (x + y) * 0.5 * s - z * s * 0.55];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  boxes.forEach(b => [[b.x,b.y,0],[b.x+b.w,b.y,0],[b.x,b.y+b.d,0],[b.x+b.w,b.y+b.d,0],[b.x,b.y,b.h],[b.x+b.w,b.y+b.d,b.h],[b.x+b.w,b.y,b.h],[b.x,b.y+b.d,b.h]].forEach(p => {
    const [px, py] = proj(p[0], p[1], p[2], 1);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }));
  const s = Math.min(W * 0.7 / (maxX - minX), H * 0.7 / (maxY - minY));
  const ox = W / 2 - ((minX + maxX) / 2) * s, oy = H / 2 - ((minY + maxY) / 2) * s;
  const P = (x, y, z) => { const [px, py] = proj(x, y, z, s); return (px + ox).toFixed(1) + ',' + (py + oy).toFixed(1); };
  let out = '';
  boxes.slice().sort((a, b) => (a.x + a.y + a.w + a.d) - (b.x + b.y + b.w + b.d)).forEach(b => {
    const { x, y, w, d, h } = b;
    const left = [P(x,y+d,0),P(x+w,y+d,0),P(x+w,y+d,h),P(x,y+d,h)].join(' ');
    const right = [P(x+w,y,0),P(x+w,y+d,0),P(x+w,y+d,h),P(x+w,y,h)].join(' ');
    const top = [P(x,y,h),P(x+w,y,h),P(x+w,y+d,h),P(x,y+d,h)].join(' ');
    out += '<polygon class="l" points="' + left + '"/><polygon class="r" points="' + right + '"/><polygon class="t" points="' + top + '"/>';
    for (let f = 1; f < h; f++) out += '<polyline class="f" points="' + P(x,y+d,f) + ' ' + P(x+w,y+d,f) + ' ' + P(x+w,y,f) + '"/>';
    out += '<polygon class="o" points="' + left + '"/><polygon class="o" points="' + right + '"/><polygon class="o" points="' + top + '"/>';
  });
  return '<svg class="iso" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pré-visualização ilustrativa do modelo">' + out + '</svg>';
}

/* =====================================================================
   RENDERIZAÇÃO
   ===================================================================== */
const ROLE = { construtora: 'Construtora', corretor: 'Corretor de imóveis' };

function renderUser() {
  const u = state.user; if (!u) return;
  const first = (u.nome || '').trim().split(/\s+/)[0] || 'cliente';
  const ini = (u.nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  $('#avatar').textContent = ini; $('#meName').textContent = u.nome; $('#meRole').textContent = ROLE[u.perfil] || '';
  $('#hello').textContent = 'Olá, ' + first;
  $('#kRole').textContent = ROLE[u.perfil] || '—';
  $('#kRoleSub').textContent = u.perfil === 'construtora' ? (u.razaoSocial || '') : (u.creci ? 'CRECI-' + u.creci.uf + ' ' + u.creci.numero + '-' + (u.creci.tipo || 'F') : '');
  $('#kLast').textContent = fmtDateTime(u.ultimoAcesso);

  // conta
  $('#a-nome').value = u.nome || ''; $('#a-tel').value = maskPhone(u.telefone); $('#a-email').value = u.email || '';
  const c = u.perfil === 'construtora';
  $('#docLabel').textContent = c ? 'CNPJ' : 'CPF';
  $('#a-doc').value = c ? fmtCNPJ(u.documento) : fmtCPF(u.documento);
  $('#rowConstrutora').hidden = !c; $('#rowCorretor').hidden = c;
  $('#a-razao').value = u.razaoSocial || '';
  $('#a-creci').value = u.creci ? 'CRECI-' + u.creci.uf + ' ' + u.creci.numero + '-' + (u.creci.tipo || 'F') : '';

  // privacidade
  $('#pref-projetos').checked = !!(u.prefs && u.prefs.projetos);
  $('#pref-novidades').checked = !!(u.prefs && u.prefs.novidades);
  const rows = [['Nome', u.nome], ['E-mail', u.email], ['Telefone', maskPhone(u.telefone)], [c ? 'CNPJ' : 'CPF', c ? fmtCNPJ(u.documento) : fmtCPF(u.documento)]];
  if (c) rows.push(['Razão social', u.razaoSocial]); else if (u.creci) rows.push(['CRECI', 'CRECI-' + u.creci.uf + ' ' + u.creci.numero + '-' + (u.creci.tipo || 'F')]);
  rows.push(['Projetos liberados', String(state.projects.length)]);
  $('#dataList').innerHTML = rows.map(r => '<li>' + esc(r[0]) + '<span>' + esc(r[1] || '—') + '</span></li>').join('');
}

function projectCard(p) {
  return '<button class="pcard" type="button" data-open="' + esc(p.id) + '" aria-label="Abrir ' + esc(p.nome) + '">' +
    '<div class="art">' + isoSVG(p.boxes) + '</div>' +
    '<div class="body"><h3>' + esc(p.nome) + '</h3><p class="meta">' + esc(p.construtora || '') + (p.cidade ? ' · ' + esc(p.cidade) : '') + '</p>' +
    '<span class="tag">' + esc(p.tipo || 'Projeto') + '</span></div></button>';
}
const EMPTY_SVG = '<svg viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 1 L21 5.5 L12 10 L3 5.5 Z"/><path d="M3 5.5 V22.5 L12 27 V10"/><path d="M12 27 L21 22.5 V5.5"/></svg>';

function renderProjects() {
  const n = state.projects.length;
  const navCount = $('#navCount'); navCount.hidden = n === 0; navCount.textContent = n;
  $('#kProjects').textContent = n;
  $('#kProjectsSub').textContent = n === 0 ? 'Nenhum ainda' : (n === 1 ? '1 empreendimento' : n + ' empreendimentos');

  const empty = '<div class="empty">' + EMPTY_SVG + '<b>Nenhum projeto liberado ainda</b><p>Quando você inserir o código de um empreendimento, o modelo 3D aparece aqui.</p></div>';
  $('#projectsGrid').innerHTML = n ? '<div class="projects">' + state.projects.map(projectCard).join('') + '</div>' : empty;

  // visão geral
  if (!n) {
    $('#overviewProjects').innerHTML = '<div class="empty">' + EMPTY_SVG + '<b>Você ainda não tem projetos</b><p>Veja como liberar o seu primeiro empreendimento:</p></div>' +
      '<div class="steps"><div class="step"><div class="n">01</div><b>Receba o código</b><span>A construtora ou a TOTAL3D envia o código do empreendimento.</span></div>' +
      '<div class="step"><div class="n">02</div><b>Insira em Projetos</b><span>Digite o código no campo “Liberar um projeto”.</span></div>' +
      '<div class="step"><div class="n">03</div><b>Visualize em 3D</b><span>O modelo aparece na sua lista, pronto para abrir.</span></div></div>';
  } else {
    $('#overviewProjects').innerHTML = '<div class="projects">' + state.projects.slice().reverse().slice(0, 3).map(projectCard).join('') + '</div>' +
      (n > 3 ? '<p style="margin-top:16px"><button class="link" type="button" data-go="projetos">Ver todos os projetos</button></p>' : '');
  }
  if (state.openProject) openProject(state.openProject, true);
}

function openProject(id, silent) {
  const p = state.projects.find(x => x.id === id);
  if (!p) { closeProject(); return; }
  state.openProject = id;
  const viewer = p.boxes ? isoSVG(p.boxes) : '';
  $('#projectDetail').innerHTML =
    '<div class="eyebrow" style="margin-top:26px">Projeto</div>' +
    '<h1 class="page-title">' + esc(p.nome) + '</h1>' +
    '<p class="page-sub">' + esc(p.construtora || '') + (p.cidade ? ' · ' + esc(p.cidade) : '') + '</p>' +
    '<p style="margin-top:16px"><button class="link back" type="button" data-action="close-project">← Voltar para Projetos</button></p>' +
    '<div class="detail-grid"><div class="viewer">' + viewer +
    '<div class="note">Visualizador 3D interativo: será conectado aqui quando o modelo for adicionado.</div></div>' +
    '<div class="card"><h2 class="sec">Informações</h2><div class="kv" style="margin-top:16px">' +
    '<div><span>Tipo</span><b>' + esc(p.tipo || '—') + '</b></div>' +
    '<div><span>Situação</span><b>' + esc(p.status || '—') + '</b></div>' +
    '<div><span>Liberado em</span><b>' + esc(p.liberadoEm ? fmtDate(p.liberadoEm) : '—') + '</b></div></div></div></div>';
  $('#projectsList').hidden = true; $('#projectDetail').hidden = false;
  if (!silent) go('projetos', { keepProject: true });
}
function closeProject() {
  state.openProject = null; $('#projectDetail').hidden = true; $('#projectsList').hidden = false;
}
document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open]'); if (o) { openProject(o.dataset.open); return; }
  const a = e.target.closest('[data-action]'); if (!a) return;
  if (a.dataset.action === 'close-project') closeProject();
  if (a.dataset.action === 'logout') logout();
});

/* ---------- Liberar projeto por código ---------- */
const codeInput = $('#codeInput'), codeMsg = $('#codeMsg'), redeemBtn = $('#redeemBtn');
const normCode = v => (v || '').toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 40);
codeInput.addEventListener('input', () => { const p = codeInput.selectionStart; codeInput.value = normCode(codeInput.value); msg(codeMsg, ''); try { codeInput.setSelectionRange(p, p); } catch (_) {} });
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); redeem(); } });
redeemBtn.addEventListener('click', redeem);

async function redeem() {
  const code = normCode(codeInput.value);
  if (code.length < 4) { msg(codeMsg, 'Digite o código completo do empreendimento.'); codeInput.setAttribute('aria-invalid', 'true'); codeInput.focus(); return; }
  codeInput.removeAttribute('aria-invalid'); msg(codeMsg, '');
  setBusy(redeemBtn, true, 'Verificando…');
  try {
    const res = await api(CONFIG.EP.liberar, 'POST', { codigo: code });
    const p = res.projeto;
    if (p && !state.projects.some(x => x.id === p.id)) state.projects.push(p);
    codeInput.value = '';
    renderProjects(); renderUser();
    msg(codeMsg, 'Projeto liberado: ' + (p ? p.nome : 'novo empreendimento') + '.', 'ok');
  } catch (err) {
    const map = { 404: 'Código não encontrado. Confira os caracteres e tente de novo.', 409: 'Este projeto já está liberado na sua conta.', 429: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.' };
    msg(codeMsg, map[err.status] || err.message);
  } finally { setBusy(redeemBtn, false); }
}

/* ---------- Conta ---------- */
$('#a-tel').addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
$('#saveProfile').addEventListener('click', async () => {
  const nome = $('#a-nome').value.trim(), tel = $('#a-tel').value;
  const en = NAME_RE.test(nome) ? '' : 'Informe o nome completo (nome e sobrenome).';
  const et = validPhone(tel) ? '' : 'Informe um telefone válido com DDD.';
  setErr('ae-nome', en, 'a-nome'); setErr('ae-tel', et, 'a-tel');
  if (en || et) return;
  const btn = $('#saveProfile'); setBusy(btn, true, 'Salvando…'); msg($('#profileAlert'), '');
  try {
    await api(CONFIG.EP.me, 'PATCH', { nome, telefone: digits(tel) });
    state.user.nome = nome; state.user.telefone = digits(tel);
    if (CONFIG.DEMO) { /* demo: nomes fixos por perfil */ }
    renderUser(); msg($('#profileAlert'), 'Dados atualizados.', 'ok');
  } catch (err) { msg($('#profileAlert'), err.message); }
  finally { setBusy(btn, false); }
});

const RULES = [
  { label: 'Mínimo de 10 caracteres', test: p => p.length >= 10 },
  { label: 'Uma letra minúscula', test: p => /[a-z]/.test(p) },
  { label: 'Uma letra maiúscula', test: p => /[A-Z]/.test(p) },
  { label: 'Um número', test: p => /\d/.test(p) },
  { label: 'Um símbolo (! @ # $ %…)', test: p => /[^A-Za-z0-9\s]/.test(p) },
  { label: 'Sem espaços', test: p => !/\s/.test(p) }
];
$('#rules').innerHTML = RULES.map(r => '<li>' + r.label + '</li>').join('');
$('#p-nova').addEventListener('input', () => {
  const p = $('#p-nova').value; let ok = 0;
  $$('#rules li').forEach((li, i) => { const pass = p.length > 0 && RULES[i].test(p); li.classList.toggle('ok', pass); if (pass) ok++; });
  $('#meter').dataset.level = p ? Math.max(1, Math.min(5, ok)) : 0;
  setErr('pe-nova', '', 'p-nova');
});
$('#savePass').addEventListener('click', async () => {
  const atual = $('#p-atual').value, nova = $('#p-nova').value;
  const ea = atual ? '' : 'Informe sua senha atual.';
  const en = RULES.every(r => r.test(nova)) ? (nova === atual ? 'A nova senha deve ser diferente da atual.' : '') : 'A senha ainda não atende a todos os requisitos.';
  setErr('pe-atual', ea, 'p-atual'); setErr('pe-nova', en, 'p-nova');
  if (ea || en) return;
  const btn = $('#savePass'); setBusy(btn, true, 'Atualizando…'); msg($('#passAlert'), '');
  try {
    await api(CONFIG.EP.senha, 'POST', { atual, nova });
    $('#p-atual').value = ''; $('#p-nova').value = ''; $('#p-nova').dispatchEvent(new Event('input'));
    msg($('#passAlert'), 'Senha atualizada.', 'ok');
  } catch (err) { msg($('#passAlert'), err.status === 403 ? 'A senha atual está incorreta.' + (CONFIG.DEMO ? ' (Na demonstração, a senha atual é: demo)' : '') : err.message); }
  finally { setBusy(btn, false); }
});

/* ---------- Privacidade ---------- */
async function savePrefs() {
  const el = $('#prefMsg');
  try {
    await api(CONFIG.EP.me, 'PATCH', { prefs: { projetos: $('#pref-projetos').checked, novidades: $('#pref-novidades').checked } });
    msg(el, 'Preferências salvas.', 'ok'); setTimeout(() => { if (el.textContent === 'Preferências salvas.') msg(el, ''); }, 2500);
  } catch (err) { msg(el, err.message); }
}
$('#pref-projetos').addEventListener('change', savePrefs);
$('#pref-novidades').addEventListener('change', savePrefs);

$('#exportBtn').addEventListener('click', async () => {
  const btn = $('#exportBtn'), el = $('#exportMsg'); setBusy(btn, true, 'Enviando pedido…'); msg(el, '');
  try { await api(CONFIG.EP.exportar, 'POST', {}); msg(el, CONFIG.DEMO ? 'Demonstração: nenhum pedido foi registrado. Com o servidor conectado, enviaremos o link por e-mail.' : 'Pedido registrado. Enviaremos o link por e-mail quando estiver pronto.', 'ok'); }
  catch (err) { msg(el, err.message); } finally { setBusy(btn, false); }
});

$('#delConfirm').addEventListener('input', () => { $('#deleteBtn').disabled = $('#delConfirm').value.trim() !== 'EXCLUIR'; });
$('#deleteBtn').addEventListener('click', async () => {
  const btn = $('#deleteBtn'), el = $('#delMsg'); setBusy(btn, true, 'Excluindo…'); msg(el, '');
  try {
    if (CONFIG.DEMO) { await wait(500); msg(el, 'Demonstração: nenhuma conta foi excluída. Com o servidor conectado, a conta e os acessos seriam removidos.', 'ok'); btn.disabled = true; $('#delConfirm').value = ''; }
    else { await api(CONFIG.EP.me, 'DELETE'); goLogin(); }
  } catch (err) { msg(el, err.message); setBusy(btn, false); return; }
  btn.textContent = btn.dataset.label || 'Excluir minha conta'; btn.classList.remove('busy');
});

async function logout() {
  T3.demoSession.end();
  try { if (!CONFIG.DEMO) await api(CONFIG.EP.logout, 'POST', {}); } catch (_) {}
  goLogin();
}

/* =====================================================================
   NAVEGAÇÃO ENTRE ABAS (não depende da URL)
   ===================================================================== */
const TABS = ['geral', 'projetos', 'conta', 'privacidade', 'ajuda'];
function go(tab, opts) {
  if (!TABS.includes(tab)) tab = 'geral';
  state.tab = tab;
  TABS.forEach(t => { $('#tab-' + t).hidden = t !== tab; });
  $$('[data-tab]').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.title = $('#tab-' + tab).dataset.title + ' · TOTAL3D';
  setUrl('#' + tab);
  // clicar em "Projetos" no menu volta para a lista; abrir um projeto mantém o detalhe
  if (tab === 'projetos' && state.openProject && !(opts && opts.keepProject)) closeProject();
  if (!(opts && opts.noScroll)) window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]'); if (t) { go(t.dataset.tab); return; }
  const g = e.target.closest('[data-go]'); if (!g) return;
  go(g.dataset.go);
  if (g.dataset.focus) setTimeout(() => { const f = document.getElementById(g.dataset.focus); if (f) f.focus(); }, 60);
});
window.addEventListener('hashchange', () => go(location.hash.replace('#', ''), { noScroll: true }));

/* ---------- Início ---------- */
async function init() {
  // Em DEMO, o portal só abre depois do login simulado (acesso.html).
  if (CONFIG.DEMO && !T3.demoSession.active()) { goLogin(); return; }
  if (CONFIG.DEMO) {
    $('#demoBanner').hidden = false;
    $('#demoProfile').value = demoDb.perfil;
    $('#demoProfile').addEventListener('change', async (e) => { demoDb.perfil = e.target.value; saveDemo(); state.user = await api(CONFIG.EP.me, 'GET'); renderUser(); });
  }
  try {
    const [user, pr] = await Promise.all([api(CONFIG.EP.me, 'GET'), api(CONFIG.EP.projetos, 'GET')]);
    state.user = user; state.projects = pr.projetos || [];
  } catch (err) {
    if (err.status !== 401) { document.querySelector('.page').insertAdjacentHTML('afterbegin', '<div class="alert" style="margin-top:22px">' + esc(err.message) + '</div>'); }
    return;
  }
  renderUser(); renderProjects();
  go(location.hash.replace('#', '') || 'geral', { noScroll: true });
}
init();
})();
