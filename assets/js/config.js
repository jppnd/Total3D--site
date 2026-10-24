/* ==========================================================================
   TOTAL3D · config.js
   ÚNICO lugar para configurar o front-end. Carregado antes dos outros scripts.

   DEMO: true  → nada é enviado a servidor; as respostas são simuladas no
                 navegador (serve para testar o visual e o fluxo entre telas).
   DEMO: false → os formulários chamam API_BASE + ENDPOINTS (cookie de sessão, HTTPS).

   Endpoints esperados (JSON):
     POST   /auth/login         { email, senha }                       → 200 | 401
     POST   /auth/register      { perfil, email, nome, ..., senha }    → 200 | 409 (já existe) | 422
     POST   /auth/logout                                               → 204
     POST   /creci/verificar    { uf, numero, cpf, nome }              → { status: "ativo" | "inativo" | "nao_encontrado" }
     GET    /me                                                        → { nome, email, telefone, perfil: "construtora"|"corretor",
                                                                          documento, razaoSocial?, creci?, prefs:{projetos,novidades}, ultimoAcesso }
     PATCH  /me                 { nome, telefone, prefs? }             → 200
     DELETE /me                                                        → 204
     POST   /me/senha           { atual, nova }                        → 200 | 403
     POST   /me/exportar                                               → 202
     GET    /projetos                                                  → { projetos: [Projeto] }
     POST   /projetos/liberar   { codigo }                             → { projeto } | 404 inválido | 409 já liberado | 429 muitas tentativas
     Projeto = { id, nome, construtora, cidade, tipo, status, liberadoEm, modeloUrl? }

   SEGURANÇA (para quando o servidor existir):
     - A consulta do CRECI e a validação do código de projeto rodam SEMPRE no servidor.
     - O servidor repete todas as validações do formulário (o navegador pode ser burlado).
     - Senhas somente com hash (argon2/bcrypt), sempre sobre HTTPS.
     - Limite de tentativas por conta/IP em /auth/login e /projetos/liberar.
   ========================================================================== */
window.TOTAL3D = {
  DEMO: true,
  API_BASE: '',                      // ex.: 'https://api.total3d.com.br'

  // Mapa de páginas: se renomear um arquivo, ajuste só aqui (e os <a href> do HTML).
  PAGES: {
    home:     'index.html',
    login:    'acesso.html#login',
    register: 'acesso.html#registro',
    portal:   'portal.html'
  },

  ENDPOINTS: {
    login:     '/auth/login',
    register:  '/auth/register',
    logout:    '/auth/logout',
    creci:     '/creci/verificar',
    me:        '/me',
    senha:     '/me/senha',
    exportar:  '/me/exportar',
    projetos:  '/projetos',
    liberar:   '/projetos/liberar'
  }
};
