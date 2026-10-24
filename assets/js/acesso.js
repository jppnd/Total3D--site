/* ==========================================================================
   TOTAL3D · acesso.js  (login e cadastro: acesso.html)
   Depende de config.js e common.js.
   Rotas por hash: #login, #registro, #registro-construtora, #registro-corretor.
   ========================================================================== */
(function () {
  'use strict';

  const CONFIG = {
    DEMO: T3.config.DEMO,
    API_BASE: T3.config.API_BASE,
    PORTAL_URL: T3.config.PAGES.portal,   // para onde ir depois do login
    ENDPOINTS: T3.config.ENDPOINTS
  };
  const { $, $$, digits, wait, maskPhone, validPhone, NAME_RE, EMAIL_RE, setUrl } = T3;

  /* ---------- API ---------- */
  // Respostas simuladas (só com DEMO = true). Para testar a consulta de CRECI:
  // número terminado em 0 → não encontrado; terminado em 9 → inativo; qualquer outro → ativo.
  async function demoApi(path, body) {
    await wait(900);
    if (path === CONFIG.ENDPOINTS.creci) {
      const last = (body.numero || '').slice(-1);
      if (last === '0') return { status: 'nao_encontrado' };
      if (last === '9') return { status: 'inativo' };
      return { status: 'ativo' };
    }
    return { ok: true, demo: true };
  }

  async function api(path, body) {
    if (CONFIG.DEMO) return demoApi(path, body);
    return T3.http(path, 'POST', body);
  }

  /* ---------- Máscaras ---------- */
  function maskCPF(v) {
    const d = digits(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // CNPJ aceita o formato numérico e o alfanumérico (12 primeiras posições letras/números, 2 últimas só números)
  function cleanCNPJ(v) {
    const raw = (v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    let r = '';
    for (const ch of raw) {
      if (r.length < 12) r += ch;
      else if (r.length < 14 && /\d/.test(ch)) r += ch;
    }
    return r;
  }
  function maskCNPJ(v) {
    const f = cleanCNPJ(v);
    let out = f.slice(0, 2);
    if (f.length > 2)  out += '.' + f.slice(2, 5);
    if (f.length > 5)  out += '.' + f.slice(5, 8);
    if (f.length > 8)  out += '/' + f.slice(8, 12);
    if (f.length > 12) out += '-' + f.slice(12, 14);
    return out;
  }

  /* ---------- Validadores ---------- */
  function validCPF(v) {
    const d = digits(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let sum = 0;
      for (let i = 0; i < t; i++) sum += +d[i] * (t + 1 - i);
      const dv = ((sum * 10) % 11) % 10;
      if (dv !== +d[t]) return false;
    }
    return true;
  }

  function validCNPJ(v) {
    const c = cleanCNPJ(v);
    if (c.length !== 14 || !/^\d{2}$/.test(c.slice(12)) || /^(.)\1+$/.test(c)) return false;
    const val = ch => ch.charCodeAt(0) - 48;
    const calc = (len) => {
      const w = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
      let sum = 0;
      for (let i = 0; i < len; i++) sum += val(c[i]) * w[i];
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }

  const emailLocal = () => (($('#f-email') || {}).value || '').split('@')[0].toLowerCase();

  const RULES = [
    { label: 'Mínimo de 10 caracteres',        test: p => p.length >= 10 },
    { label: 'Uma letra minúscula',            test: p => /[a-z]/.test(p) },
    { label: 'Uma letra maiúscula',            test: p => /[A-Z]/.test(p) },
    { label: 'Um número',                      test: p => /\d/.test(p) },
    { label: 'Um símbolo (! @ # $ %…)',        test: p => /[^A-Za-z0-9\s]/.test(p) },
    { label: 'Sem espaços nem o seu e-mail',   test: p => {
        if (/\s/.test(p)) return false;
        const loc = emailLocal();
        return !(loc.length >= 3 && p.toLowerCase().includes(loc));
      } }
  ];


  const VALIDATE = {
    email:    v => EMAIL_RE.test(v.trim()) ? '' : 'Informe um e-mail válido.',
    razao:    v => v.trim().length >= 3 ? '' : 'Informe a razão social da empresa.',
    nome:     v => NAME_RE.test(v.trim()) ? '' : 'Informe o nome completo (nome e sobrenome).',
    cnpj:     v => validCNPJ(v) ? '' : 'CNPJ inválido. Confira os números.',
    cpf:      v => validCPF(v) ? '' : 'CPF inválido. Confira os números.',
    telefone: v => validPhone(v) ? '' : 'Informe um telefone válido com DDD.',
    senha:    v => RULES.every(r => r.test(v)) ? '' : 'A senha ainda não atende a todos os requisitos.'
  };

  /* ---------- Utilitários de formulário ---------- */
  function setErr(form, name, msg) {
    const input = form.elements[name];
    const out = $('#' + (form.id === 'loginForm' ? 'le-' : 'e-') + name);
    if (input) {
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    if (out) out.textContent = msg || '';
  }

  function showAlert(el, msg, info) {
    el.textContent = msg;
    el.classList.toggle('info', !!info);
    el.hidden = !msg;
  }

  function setBusy(btn, busy, text) {
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = text || 'Aguarde…'; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
    btn.disabled = busy;
  }

  /* =====================================================================
     LOGIN
     ===================================================================== */
  const loginForm = $('#loginForm');
  const loginAlert = $('#loginAlert');

  const onLogin = async (e) => {
    if (e) e.preventDefault();
    showAlert(loginAlert, '');
    const email = loginForm.elements.email.value.trim();
    const senha = loginForm.elements.senha.value;

    const eMsg = EMAIL_RE.test(email) ? '' : 'Informe um e-mail válido.';
    const sMsg = senha ? '' : 'Informe sua senha.';
    setErr(loginForm, 'email', eMsg);
    setErr(loginForm, 'senha', sMsg);
    if (eMsg || sMsg) { (eMsg ? loginForm.elements.email : loginForm.elements.senha).focus(); return; }

    const btn = $('#loginBtn');
    setBusy(btn, true, 'Entrando…');
    try {
      await api(CONFIG.ENDPOINTS.login, { email, senha });
      // Em DEMO, grava a "sessão" simulada; o portal exige essa marca (ver common.js).
      if (CONFIG.DEMO) T3.demoSession.start();
      window.location.href = CONFIG.PORTAL_URL;
    } catch (err) {
      showAlert(loginAlert, err.status === 401 ? 'E-mail ou senha incorretos.' : err.message);
    } finally {
      setBusy(btn, false);
    }
  };
  // Não depende do envio nativo do formulário (bloqueado em visualizadores isolados)
  loginForm.addEventListener('submit', onLogin);
  $('#loginBtn').addEventListener('click', () => onLogin());
  loginForm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); onLogin(); }
  });

  loginForm.addEventListener('input', (e) => {
    if (e.target.name) setErr(loginForm, e.target.name, '');
  });

  $('#forgot').addEventListener('click', () => {
    showAlert(loginAlert, 'A recuperação de senha será ativada quando o servidor estiver conectado.', true);
  });

  /* =====================================================================
     REGISTRO
     ===================================================================== */
  const regForm = $('#registerForm');
  const regAlert = $('#registerAlert');
  const state = { profile: null, creci: { status: null, key: '' } };

  // UFs
  const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  $('#f-uf').insertAdjacentHTML('beforeend', UFS.map(u => `<option value="${u}">${u}</option>`).join(''));

  // Checklist da senha
  const rulesEl = $('#rules');
  rulesEl.innerHTML = RULES.map(r => `<li>${r.label}</li>`).join('');
  function updatePasswordUI() {
    const p = regForm.elements.senha.value;
    let ok = 0;
    $$('li', rulesEl).forEach((li, i) => {
      const pass = p.length > 0 && RULES[i].test(p);
      li.classList.toggle('ok', pass);
      if (pass) ok++;
    });
    $('#meter').dataset.level = p ? Math.max(1, Math.min(5, ok)) : 0;
  }

  // Perfil
  function activeNames() {
    return $$('.field[data-profiles]:not([hidden])', regForm)
      .flatMap(f => $$('input, select', f).map(i => i.name));
  }

  function applyProfile(profile) {
    state.profile = profile;
    $$('.field[data-profiles]', regForm).forEach(f => {
      const on = f.dataset.profiles.split(' ').includes(profile);
      f.hidden = !on;
      $$('input, select', f).forEach(i => { i.disabled = !on; });
    });
    $('#profileChip').textContent = profile === 'construtora' ? 'Construtora' : 'Corretor de imóveis';
    $('#nomeLabel').textContent = profile === 'construtora' ? 'Nome completo do responsável' : 'Nome completo';
    resetCreci();
  }

  function showStep(step) {
    $('#step-profile').hidden = step !== 'profile';
    $('#step-form').hidden = step !== 'form';
    $('#step-done').hidden = step !== 'done';
  }

  function chooseProfile(profile, focus) {
    applyProfile(profile);
    showAlert(regAlert, '');
    showStep('form');
    if (focus) setTimeout(() => $('#f-email').focus(), 50);
  }

  $$('.profile').forEach(b => b.addEventListener('click', () => {
    setUrl('#registro-' + b.dataset.profile);
    chooseProfile(b.dataset.profile, true);
  }));

  $('#changeProfile').addEventListener('click', () => {
    setUrl('#registro');
    state.profile = null;
    showStep('profile');
  });

  // Máscaras + validação ao digitar / sair do campo
  regForm.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name === 'cpf') t.value = maskCPF(t.value);
    if (t.name === 'cnpj') t.value = maskCNPJ(t.value);
    if (t.name === 'telefone') t.value = maskPhone(t.value);
    if (t.name === 'creci') t.value = digits(t.value).slice(0, 7);

    if (t.getAttribute('aria-invalid') === 'true') validateField(t.name);
    if (t.name === 'senha' || t.name === 'email') updatePasswordUI();
    if (['uf', 'creci', 'cpf', 'nome'].includes(t.name)) syncCreci();
    showAlert(regAlert, '');
  });
  regForm.addEventListener('change', (e) => { if (e.target.name === 'uf') syncCreci(); });
  regForm.addEventListener('focusout', (e) => {
    const n = e.target.name;
    if (n && !e.target.disabled && e.target.value) validateField(n);
  });

  function validateField(name) {
    const el = regForm.elements[name];
    if (!el || el.disabled) return '';
    let msg = '';
    if (name === 'creci' || name === 'uf') {
      msg = validateCreciFields();
      setErr(regForm, 'creci', msg);
      return msg;
    }
    msg = VALIDATE[name] ? VALIDATE[name](el.value) : '';
    setErr(regForm, name, msg);
    return msg;
  }

  /* ---------- CRECI ---------- */
  function validateCreciFields() {
    const uf = regForm.elements.uf.value;
    const num = regForm.elements.creci.value;
    if (!uf) return 'Selecione o estado (UF) do seu CRECI.';
    if (num.length < 3) return 'Informe o número do CRECI.';
    return '';
  }

  const creciKey = () => [
    regForm.elements.uf.value,
    regForm.elements.creci.value,
    digits(regForm.elements.cpf.value),
    regForm.elements.nome.value.trim().toLowerCase()
  ].join('|');

  function setCreciStatus(kind, text) {
    const el = $('#creciStatus');
    el.className = 'hint creci-status' + (kind ? ' ' + kind : '');
    el.innerHTML = '';
    if (kind === 'busy') el.insertAdjacentHTML('beforeend', '<span class="spin"></span>');
    if (text) el.appendChild(document.createTextNode(text));
  }

  function resetCreci() {
    state.creci = { status: null, key: '' };
    setCreciStatus('', '');
  }

  function syncCreci() {
    if (state.creci.status && state.creci.key !== creciKey()) resetCreci();
  }

  async function verifyCreci() {
    // precisa de UF, número, nome e CPF válidos
    const problems = [];
    const m1 = validateCreciFields(); if (m1) { setErr(regForm, 'creci', m1); problems.push('creci'); }
    const m2 = VALIDATE.nome(regForm.elements.nome.value); if (m2) { setErr(regForm, 'nome', m2); problems.push('nome'); }
    const m3 = VALIDATE.cpf(regForm.elements.cpf.value); if (m3) { setErr(regForm, 'cpf', m3); problems.push('cpf'); }
    if (problems.length) {
      setCreciStatus('bad', 'Preencha nome, CPF, UF e número corretamente para verificar o CRECI.');
      return null;
    }
    setErr(regForm, 'creci', '');

    const key = creciKey();
    setCreciStatus('busy', 'Consultando o CRECI…');
    $('#verifyCreci').disabled = true;
    try {
      const res = await api(CONFIG.ENDPOINTS.creci, {
        uf: regForm.elements.uf.value,
        numero: regForm.elements.creci.value,
        cpf: digits(regForm.elements.cpf.value),
        nome: regForm.elements.nome.value.trim()
      });
      state.creci = { status: res.status, key };
      if (res.status === 'ativo') {
        setCreciStatus('ok', '✓ Registro ativo no CRECI-' + regForm.elements.uf.value + '.');
      } else if (res.status === 'inativo') {
        setCreciStatus('bad', 'Registro encontrado, mas não está ativo. Regularize junto ao seu CRECI para se cadastrar.');
      } else {
        setCreciStatus('bad', 'Não encontramos esse número no CRECI-' + regForm.elements.uf.value + '. Confira a UF e o número.');
      }
      return res.status;
    } catch (err) {
      state.creci = { status: null, key: '' };
      setCreciStatus('bad', 'Não foi possível consultar o CRECI agora. Tente novamente em instantes.');
      return null;
    } finally {
      $('#verifyCreci').disabled = false;
    }
  }
  $('#verifyCreci').addEventListener('click', verifyCreci);

  /* ---------- Envio do cadastro ---------- */
  const onRegister = async (e) => {
    if (e) e.preventDefault();
    showAlert(regAlert, '');

    // valida todos os campos visíveis
    let first = null;
    const seen = new Set();
    activeNames().forEach(n => {
      const key = (n === 'uf') ? 'creci' : n;
      if (seen.has(key)) return;
      seen.add(key);
      const msg = validateField(key);
      if (msg && !first) first = key === 'creci' && !regForm.elements.uf.value ? 'uf' : key;
    });
    if (first) { regForm.elements[first].focus(); return; }

    const btn = $('#registerBtn');
    setBusy(btn, true, 'Enviando…');
    try {
      // corretor: exige CRECI ativo (verifica agora se ainda não foi verificado)
      if (state.profile === 'corretor' && !(state.creci.status === 'ativo' && state.creci.key === creciKey())) {
        const st = await verifyCreci();
        if (st !== 'ativo') {
          if (st === null) showAlert(regAlert, 'Não foi possível confirmar o CRECI. Revise os dados e tente de novo.');
          else showAlert(regAlert, 'Só é possível criar a conta com um registro ativo no CRECI.');
          return;
        }
      }

      const f = regForm.elements;
      const payload = { perfil: state.profile, email: f.email.value.trim(), nome: f.nome.value.trim(), telefone: digits(f.telefone.value), senha: f.senha.value };
      if (state.profile === 'construtora') {
        payload.razaoSocial = f.razao.value.trim();
        payload.cnpj = cleanCNPJ(f.cnpj.value);
      } else {
        payload.cpf = digits(f.cpf.value);
        payload.creci = { uf: f.uf.value, numero: f.creci.value, tipo: 'F' };
      }

      await api(CONFIG.ENDPOINTS.register, payload);

      $('#doneText').textContent = CONFIG.DEMO
        ? 'Modo demonstração: nenhum dado foi enviado. Com o servidor conectado, enviaremos um e-mail de confirmação para ' + payload.email + '.'
        : 'Enviamos um e-mail de confirmação para ' + payload.email + '. Confirme para ativar seu acesso.';
      regForm.reset();
      updatePasswordUI();
      resetCreci();
      setUrl('#registro');
      state.profile = null;
      showStep('done');
    } catch (err) {
      showAlert(regAlert, err.status === 409 ? 'Já existe uma conta com esses dados. Tente entrar ou recuperar a senha.' : err.message);
    } finally {
      setBusy(btn, false);
    }
  };
  regForm.addEventListener('submit', onRegister);
  $('#registerBtn').addEventListener('click', () => onRegister());
  regForm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); onRegister(); }
  });

  /* =====================================================================
     ABAS / ROTAS (#login, #registro, #registro-construtora, #registro-corretor)
     ===================================================================== */
  function setTab(name) {
    const isLogin = name === 'login';
    $('#tab-login').setAttribute('aria-selected', String(isLogin));
    $('#tab-registro').setAttribute('aria-selected', String(!isLogin));
    $('#view-login').hidden = !isLogin;
    $('#view-registro').hidden = isLogin;
  }

  function route(target) {
    const h = (typeof target === 'string' ? target : location.hash).replace('#', '');
    if (h.startsWith('registro')) {
      setTab('registro');
      const p = h.split('-')[1];
      if (p === 'construtora' || p === 'corretor') chooseProfile(p, false);
      else if ($('#step-done').hidden) showStep(state.profile ? 'form' : 'profile');
    } else {
      setTab('login');
      // ao sair da tela de sucesso, o cadastro volta ao início
      if (!$('#step-done').hidden) { state.profile = null; showStep('profile'); }
    }
  }

  // Troca de tela direta (sem depender da URL); a URL é atualizada só se o navegador permitir
  function go(name) {
    setUrl('#' + name);
    route('#' + name);
  }

  $('#tab-login').addEventListener('click', () => go('login'));
  $('#tab-registro').addEventListener('click', () => {
    if ($('#view-registro').hidden) go('registro');
  });
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (!g) return;
    go(g.dataset.go);
  });
  // Botão "voltar" do navegador e links externos como acesso.html#registro
  window.addEventListener('hashchange', () => route());

  // Estado inicial
  applyProfile('construtora');
  showStep('profile');
  state.profile = null;
  updatePasswordUI();
  $('#demoBanner').hidden = !CONFIG.DEMO;
  route();
})();
