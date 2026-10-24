/* ==========================================================================
   TOTAL3D · home-scene.js
   Cena 3D de fundo da página inicial (Three.js r128, carregado por CDN).
   Segue o tema claro/escuro pelo evento "themechange" (ver theme.js).
   ========================================================================== */
(function () {
  const container = document.getElementById('scene');

  if (typeof THREE === 'undefined') { showFallback(); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { showFallback(); return; }

  function showFallback() {
    document.getElementById('noWebgl').style.display = 'flex';
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf4f3ef, 40, 90);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const camBase = new THREE.Vector3(26, 20, 30);
  camera.position.copy(camBase);
  camera.lookAt(0, 3, 0);

  // ---------- Luzes ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d6cd, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
  sun.shadow.radius = 4;
  scene.add(sun);

  // ---------- Materiais ----------
  const matBody = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.85, metalness: 0.0 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0xe4e6e8, roughness: 0.35, metalness: 0.1 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x17181a, transparent: true, opacity: 0.55 });
  const floorLineMat = new THREE.LineBasicMaterial({ color: 0x17181a, transparent: true, opacity: 0.14 });
  const ringMats = [];

  // ---------- Gerador pseudoaleatório (resultado sempre igual) ----------
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const city = new THREE.Group();
  scene.add(city);

  // Um bloco com contorno e linhas de andar
  function addBlock(parent, w, h, d, x, y, z, glass) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, glass ? matGlass : matBody);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat);
    edges.position.copy(mesh.position);
    parent.add(edges);

    // linhas horizontais (andares)
    const floorH = 0.55;
    const n = Math.floor(h / floorH);
    const pts = [];
    const hw = w / 2 + 0.002, hd = d / 2 + 0.002;
    for (let i = 1; i < n; i++) {
      const yy = y + i * floorH;
      pts.push(
        -hw + x, yy, -hd + z,  hw + x, yy, -hd + z,
         hw + x, yy, -hd + z,  hw + x, yy,  hd + z,
         hw + x, yy,  hd + z, -hw + x, yy,  hd + z,
        -hw + x, yy,  hd + z, -hw + x, yy, -hd + z
      );
    }
    if (pts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      parent.add(new THREE.LineSegments(g, floorLineMat));
    }
  }

  // Prédio com recuos (estilo "bolo de casamento")
  function addBuilding(x, z, w, d, h) {
    const g = new THREE.Group();
    city.add(g);
    const glass = rnd() > 0.6;
    const tiers = h > 6 ? 1 + Math.floor(rnd() * 3) : 1;
    let curY = 0, curW = w, curD = d, remaining = h;
    for (let t = 0; t < tiers; t++) {
      const th = t === tiers - 1 ? remaining : remaining * (0.45 + rnd() * 0.2);
      addBlock(g, curW, th, curD, x, curY, z, glass);
      curY += th; remaining -= th;
      curW *= 0.72; curD *= 0.72;
    }
  }

  // Grade de prédios dentro de um raio
  const cell = 3.1, N = 6, R = 9.2;
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const x = i * cell + (rnd() - 0.5) * 0.4;
      const z = j * cell + (rnd() - 0.5) * 0.4;
      const dist = Math.hypot(x, z);
      if (dist > R || rnd() < 0.18) continue;
      const falloff = 1 - dist / (R + 2);
      const h = 1.6 + falloff * falloff * 11 * (0.4 + rnd() * 0.9);
      addBuilding(x, z, 1.5 + rnd() * 0.9, 1.5 + rnd() * 0.9, h);
    }
  }
  // Torre central de destaque
  addBuilding(0, 0, 2.2, 2.2, 15);

  // ---------- Base circular ----------
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xefede7, roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.2, R + 2.2, 0.35, 96), baseMat);
  base.position.y = -0.175;
  base.receiveShadow = true;
  city.add(base);

  // Anéis finos
  [R + 2.2, R + 3.2, R + 4.6].forEach((r, i) => {
    const pts = [];
    for (let a = 0; a <= 128; a++) {
      const t = (a / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * r, 0.01 - (i ? 0.35 : 0), Math.sin(t) * r));
    }
    const ringMat = new THREE.LineBasicMaterial({ color: 0x17181a, transparent: true, opacity: i === 0 ? 0.35 : 0.12 });
    ringMats.push(ringMat);
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    city.add(ring);
  });

  // Chão para receber sombra além da base
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.08 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.36;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Tema claro / escuro ----------
  const PALETTES = {
    light: { fog: 0xf4f3ef, body: 0xfbfaf7, glass: 0xe4e6e8, line: 0x17181a, lineOp: 0.55, floorOp: 0.14,
             base: 0xefede7, ring: 0x17181a, ringK: 1, ground: 0.08, hemi: 0.9, hemiSky: 0xffffff, hemiGround: 0xd9d6cd, sun: 0.8 },
    dark:  { fog: 0x0f1011, body: 0x2b2d31, glass: 0x3b4148, line: 0xf1f0ec, lineOp: 0.5,  floorOp: 0.12,
             base: 0x17181a, ring: 0xf1f0ec, ringK: 0.9, ground: 0.45, hemi: 0.75, hemiSky: 0xdfe3ea, hemiGround: 0x1a1b1d, sun: 0.95 }
  };
  function applyTheme(name) {
    const p = PALETTES[name] || PALETTES.light;
    scene.fog.color.setHex(p.fog);
    matBody.color.setHex(p.body);
    matGlass.color.setHex(p.glass);
    lineMat.color.setHex(p.line); lineMat.opacity = p.lineOp;
    floorLineMat.color.setHex(p.line); floorLineMat.opacity = p.floorOp;
    baseMat.color.setHex(p.base);
    ringMats.forEach((m, i) => { m.color.setHex(p.ring); m.opacity = (i === 0 ? 0.35 : 0.12) * p.ringK; });
    groundMat.opacity = p.ground;
    hemi.intensity = p.hemi; hemi.color.setHex(p.hemiSky); hemi.groundColor.setHex(p.hemiGround);
    sun.intensity = p.sun;
  }
  applyTheme(document.documentElement.getAttribute('data-theme'));
  window.addEventListener('themechange', (e) => applyTheme(e.detail));

  // ---------- Responsivo ----------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Afasta a câmera em telas estreitas para o modelo caber
    const k = w < 700 ? 1.55 : (w / h < 1.2 ? 1.25 : 1);
    camBase.set(26 * k, 20 * k, 30 * k);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Parallax suave com o mouse ----------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ---------- Loop ----------
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speed = reduce ? 0.0 : 0.09; // rad/s: rotação em câmera lenta
  const clock = new THREE.Clock();
  const look = new THREE.Vector3(0, 3.2, 0);

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    city.rotation.y += speed * dt;

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    camera.position.set(
      camBase.x + mouse.x * 1.6,
      camBase.y - mouse.y * 1.2,
      camBase.z
    );
    camera.lookAt(look);

    // Só desenha enquanto a tela principal está visível (economiza bateria)
    if (window.scrollY < window.innerHeight * 1.1) {
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  tick();
  requestAnimationFrame(() => container.classList.add('ready'));
})();
