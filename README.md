# TOTAL3D · Portal de Projetos

Site estático (HTML + CSS + JavaScript puro, sem build) com três telas ligadas entre si:

| Página | Arquivo | O que faz |
|---|---|---|
| Tela inicial | `index.html` | Apresentação com cena 3D (Three.js), pitch de vendas e botões **Entrar** / **Registrar** |
| Acesso | `acesso.html` | Abas **Entrar** e **Criar conta** (construtora com CNPJ, corretor com CPF + CRECI) |
| Portal | `portal.html` | Área logada: visão geral, projetos (liberar por código), minha conta, privacidade e ajuda |

## Fluxo entre as telas

```
index.html ──Entrar────────► acesso.html#login ──login OK──► portal.html
           └─Registrar─────► acesso.html#registro                │
                                                                 └─Sair──► acesso.html#login
```

- Os links usam hash: `acesso.html#login`, `acesso.html#registro`, `acesso.html#registro-construtora`, `acesso.html#registro-corretor`.
- No portal, as abas também: `portal.html#projetos`, `#conta`, `#privacidade`, `#ajuda`.

## Como rodar

Abra `index.html` no navegador (duplo clique) **ou** sirva a pasta:

```bash
python3 -m http.server 8000     # depois abra http://localhost:8000
```

Precisa de internet para carregar a fonte (Google Fonts) e o Three.js (CDN).

## Estrutura

```
total3d/
├── index.html            # tela inicial
├── acesso.html           # login + cadastro
├── portal.html           # área logada
└── assets/
    ├── css/
    │   ├── base.css      # variáveis de cor (claro/escuro), reset, botão de tema  ← compartilhado
    │   ├── home.css      # só da tela inicial
    │   ├── acesso.css    # só do login/cadastro
    │   └── portal.css    # só do portal
    └── js/
        ├── config.js     # ★ ÚNICO lugar de configuração (DEMO, API_BASE, endpoints, nomes das páginas)
        ├── theme.js      # tema claro/escuro, compartilhado pelas 3 páginas
        ├── common.js     # utilidades compartilhadas (T3): máscaras, validação, requisição, sessão demo
        ├── home-scene.js # cena 3D da tela inicial
        ├── home.js       # cabeçalho ao rolar + animações de entrada
        ├── acesso.js     # lógica do login e do cadastro (validações, CRECI)
        └── portal.js     # lógica do portal (abas, projetos, conta, privacidade)
```

Ordem de carregamento dos scripts nas páginas de formulário: `config.js` → `common.js` → `<página>.js`.

## Modo demonstração (padrão)

Em `assets/js/config.js`, `DEMO: true` simula o servidor no navegador:

- **Login**: qualquer e-mail válido + qualquer senha entra e abre o portal.
- **Portal sem login** volta para `acesso.html#login` (a "sessão" demo fica no `localStorage`; **Sair** apaga).
- **Códigos de projeto**: `DEMO-2026` e `DEMO-TORRES`.
- **Trocar senha**: a senha atual na demo é `demo`.
- **CRECI**: número terminado em `0` → não encontrado; terminado em `9` → inativo; outro → ativo.
- CPF e CNPJ precisam ser válidos (dígito verificador), então use geradores de CPF/CNPJ de teste.

## Ligando a um servidor de verdade

1. Em `config.js`: `DEMO: false` e `API_BASE: 'https://sua-api'`.
2. Implemente os endpoints descritos no topo de `config.js`.
3. Regras que o **servidor** precisa cumprir (o navegador não é confiável): repetir todas as validações; consultar o CRECI no servidor; guardar senha só com hash (argon2/bcrypt); HTTPS; limitar tentativas em login e liberação de código; entregar o modelo 3D só a quem liberou o código.

## Para editar sem se perder

- Mudou uma cor ou o tema? → `base.css`.
- Mudou o visual de uma tela? → o `.css` com o nome dela.
- Renomeou uma página? → `PAGES` em `config.js` **e** os `href` nos HTMLs.
- Mudou um endpoint? → `ENDPOINTS` em `config.js`.

## Pendências conhecidas

- [ ] Páginas de **Termos de Uso** e **Política de Privacidade** (os links `#termos` e `#privacidade` ainda não levam a lugar nenhum).
- [ ] Dados fictícios no rodapé de `index.html` (CNPJ, telefone, endereço): trocar pelos reais.
- [ ] Recuperação de senha ("Esqueci minha senha") depende do servidor.
- [ ] Visualizador 3D do projeto em `portal.html` (hoje mostra uma miniatura ilustrativa; ligar ao `modeloUrl`).
- [ ] O símbolo SVG da logo está repetido nos 3 HTMLs (funciona, mas poderia virar um arquivo único).
