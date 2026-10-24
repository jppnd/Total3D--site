/* ==========================================================================
   TOTAL3D · theme.js
   Tema claro/escuro compartilhado por todas as páginas.
   Carregado no <head> (sem defer) para aplicar o tema ANTES da página
   aparecer e evitar o "piscar" de claro para escuro.
   A escolha fica salva no navegador e vale para as 3 páginas.
   Dispara o evento "themechange" (usado pela cena 3D da página inicial).
   ========================================================================== */
(function () {
  'use strict';
  var KEY = 'total3d-theme';
  var root = document.documentElement;

  var theme = 'light';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch (e) { /* navegação privada / bloqueado: segue com o tema claro */ }
  root.setAttribute('data-theme', theme);

  function bindToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    function sync() { btn.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'dark')); }
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      sync();
      window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindToggle);
  else bindToggle();
})();
