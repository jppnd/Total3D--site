/* ==========================================================================
   TOTAL3D · common.js
   Funções compartilhadas pelas páginas acesso e portal. Expõe window.T3.
   Depende de config.js (window.TOTAL3D).
   ========================================================================== */
(function () {
  'use strict';

  var config = window.TOTAL3D;

  /* ---------- Atalhos de DOM e utilidades ---------- */
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  var digits = function (v) { return (v || '').replace(/\D/g, ''); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Atualiza o #hash só como cortesia: em visualizadores isolados o navegador bloqueia
  // e a página continua funcionando, pois a navegação entre abas não depende da URL.
  function setUrl(hash) {
    try { history.replaceState(null, '', hash); } catch (_) {}
  }

  /* ---------- Máscara e validação de telefone (usadas em acesso e portal) ---------- */
  function maskPhone(v) {
    var d = digits(v).slice(0, 11);
    var cut = d.length > 10 ? 7 : 6;
    var out = '';
    if (d.length > 0) out = '(' + d.slice(0, 2);
    if (d.length >= 3) out += ') ' + d.slice(2, cut);
    if (d.length > cut) out += '-' + d.slice(cut);
    return out;
  }

  function validPhone(v) {
    var d = digits(v);
    if (d.length !== 10 && d.length !== 11) return false;
    if (+d.slice(0, 2) < 11) return false;
    if (d.length === 11 && d[2] !== '9') return false;
    return true;
  }

  var NAME_RE  = /^\p{L}[\p{L}'’.\-]*(\s+\p{L}[\p{L}'’.\-]*)+$/u;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- Requisição ao servidor (só usada quando DEMO = false) ---------- */
  // Lança Error com .status em caso de resposta fora de 2xx.
  // O tratamento de 401 (sessão expirada) fica a cargo de cada página.
  async function http(path, method, body) {
    var res;
    try {
      res = await fetch(config.API_BASE + path, {
        method: method || 'GET',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (_) {
      var offline = new Error('Sem conexão. Verifique sua internet e tente de novo.');
      offline.status = 0;
      throw offline;
    }
    var data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      var err = new Error(data.message || 'Não foi possível concluir agora. Tente novamente.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- "Sessão" de demonstração ----------
     No modo DEMO não existe servidor, então o login simulado grava uma marca no
     navegador. Assim o fluxo fica igual ao real: sem login, o portal manda de
     volta para a tela de acesso; "Sair" apaga a marca. */
  var SESSION_KEY = 'total3d-demo-session';
  var demoSession = {
    start:  function () { try { localStorage.setItem(SESSION_KEY, '1'); } catch (_) {} },
    end:    function () { try { localStorage.removeItem(SESSION_KEY); } catch (_) {} },
    active: function () { try { return localStorage.getItem(SESSION_KEY) === '1'; } catch (_) { return false; } }
  };

  /* ---------- Botão "Mostrar / Ocultar" de campos de senha ----------
     Qualquer <button data-toggle="id-do-input"> funciona em todas as páginas. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle]');
    if (!t) return;
    var input = document.getElementById(t.dataset.toggle);
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    t.textContent = show ? 'Ocultar' : 'Mostrar';
  });

  window.T3 = {
    config: config,
    $: $, $$: $$, digits: digits, wait: wait, esc: esc, setUrl: setUrl,
    maskPhone: maskPhone, validPhone: validPhone, NAME_RE: NAME_RE, EMAIL_RE: EMAIL_RE,
    http: http, demoSession: demoSession
  };
})();
