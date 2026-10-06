/* =========================================================
   TORNOARIA ZICO — visualizador 3D (Three.js + GLB)
   Carrega .glb de assets/modelos/manifest.json
   Também aceita arrastar e soltar um .glb direto no visor
   ========================================================= */
(function (global) {
  'use strict';

  const SOURCES = [
    { three: 'three', loader: 'three/addons/loaders/GLTFLoader.js', ctrl: 'three/addons/controls/OrbitControls.js', draco: 'three/addons/loaders/DRACOLoader.js' },
    { three: 'three-cdn', loader: 'three/addons-cdn/loaders/GLTFLoader.js', ctrl: 'three/addons-cdn/controls/OrbitControls.js', draco: 'three/addons-cdn/loaders/DRACOLoader.js' }
  ];

  const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

  const state = {
    ready: false,
    loading: null,
    three: null,
    GLTFLoader: null,
    OrbitControls: null,
    manifest: {},
    viewers: [],
    pool: 3,          // maximo de renderizadores WebGL simultaneos
    active: 0,
    webglFailed: false
  };

  /* ---------------- carga dinamica do Three.js ---------------- */
  async function trySource(src) {
    const mods = await Promise.all([
      import(/* webpackIgnore: true */ src.three),
      import(/* webpackIgnore: true */ src.loader),
      import(/* webpackIgnore: true */ src.ctrl)
    ]);
    const [three, loader, controls] = mods;

    let DRACOLoader = null;
    try {
      const d = await import(/* webpackIgnore: true */ src.draco);
      DRACOLoader = d.DRACOLoader;
    } catch (e) { /* draco opcional */ }

    if (!three || !loader || !controls) throw new Error('modulos incompletos');
    return { three, GLTFLoader: loader.GLTFLoader, OrbitControls: controls.OrbitControls, DRACOLoader };
  }

  async function initLibs() {
    if (state.ready) return state.three;
    if (state.loading) return state.loading;

    state.loading = (async () => {
      let lastErr;
      for (const src of SOURCES) {
        try {
          const mod = await trySource(src);
          state.three = mod.three;
          state.GLTFLoader = mod.GLTFLoader;
          state.OrbitControls = mod.OrbitControls;
          state.DRACOLoader = mod.DRACOLoader;
          state.ready = true;
          state.loading = null;
          return state.three;
        } catch (e) { lastErr = e; }
      }
      state.loading = null;
      throw lastErr || new Error('Three.js indisponivel');
    })();

    return state.loading;
  }

  function makeLoader() {
    const l = new state.GLTFLoader();
    if (state.DRACOLoader) {
      try {
        const d = new state.DRACOLoader();
        d.setDecoderPath(DRACO_PATH);
        l.setDRACOLoader(d);
      } catch (e) { /* segue sem draco */ }
    }
    return l;
  }

  function webglOK() {
    if (state.webglFailed) return false;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) { state.webglFailed = true; return false; }
      return true;
    } catch (e) { state.webglFailed = true; return false; }
  }

  /* ---------------- manifest ---------------- */
  async function loadManifest() {
    try {
      const r = await fetch('assets/modelos/manifest.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      state.manifest = await r.json();
    } catch (e) {
      state.manifest = {};
    }
  }

  /* ---------------- classe do visor ---------------- */
  function Viewer(el) {
    const self = this;
    this.el = el;
    this.id = el.dataset.model;
    this.autoRotate = true;
    this.hasModel = false;
    this.raf = null;
    this.renderer = null;
    this.built = false;
    this.disposed = false;
    this.object = null;
    this._mouse = { down: false, x: 0, y: 0 };

    this.buildChrome();
    this.bindEvents();
    this.observe();
    state.viewers.push(this);
  }

  Viewer.prototype.buildChrome = function () {
    this.el.classList.add('v3d');
    this.el.innerHTML =
      '<div class="v3d-stage"></div>' +
      '<div class="v3d-grid" aria-hidden="true"></div>' +
      '<div class="v3d-scan" aria-hidden="true"></div>' +
      '<div class="v3d-hud">' +
        '<span class="v3d-name"></span>' +
        '<span class="v3d-stat"><i class="v3d-dot"></i><span class="v3d-fps">--</span></span>' +
      '</div>' +
      '<div class="v3d-tools">' +
        '<button type="button" class="v3d-btn" data-act="spin" title="Girar automaticamente" aria-label="Girar automaticamente">◐</button>' +
        '<button type="button" class="v3d-btn" data-act="reset" title="Recentralizar" aria-label="Recentralizar">⌖</button>' +
        '<button type="button" class="v3d-btn" data-act="full" title="Tela cheia" aria-label="Tela cheia">⛶</button>' +
      '</div>' +
      '<div class="v3d-empty">' +
        '<div class="v3d-empty-in">' +
          '<span class="v3d-cube">⬡</span>' +
          '<strong>Modelo 3D</strong>' +
          '<p>Arraste um arquivo <b>.glb</b> aqui<br>ou coloque em <code>assets/modelos/</code></p>' +
          '<label class="v3d-pick">Escolher arquivo<input type="file" accept=".glb,.gltf" hidden></label>' +
        '</div>' +
      '</div>' +
      '<div class="v3d-load"><span class="v3d-spinner"></span><em>Carregando modelo…</em></div>' +
      '<div class="v3d-drop">Solte o modelo aqui</div>';

    this.stage = this.el.querySelector('.v3d-stage');
    this.emptyEl = this.el.querySelector('.v3d-empty');
    this.loadEl = this.el.querySelector('.v3d-load');
    this.fpsEl = this.el.querySelector('.v3d-fps');
    this.nameEl = this.el.querySelector('.v3d-name');
    this.spinBtn = this.el.querySelector('[data-act="spin"]');

    const cfg = state.manifest[this.id];
    if (cfg && typeof cfg.autoRotate === 'boolean') this.autoRotate = cfg.autoRotate;
    this.baseName = (cfg && cfg.nome) || (this.el.dataset.label || 'Visualizador 3D');
    this.nameEl.textContent = this.baseName;
    this.hiName = null;
  };

  /* ---------------- eventos ---------------- */
  Viewer.prototype.bindEvents = function () {
    const self = this;

    this.el.querySelector('.v3d-tools').addEventListener('click', function (e) {
      const b = e.target.closest('.v3d-btn');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'spin') { self.autoRotate = !self.autoRotate; self.syncSpin(); }
      if (act === 'reset') self.resetView();
      if (act === 'full') self.toggleFull();
    });

    const fileInput = this.el.querySelector('input[type=file]');
    const pick = this.el.querySelector('.v3d-pick');
    pick.addEventListener('click', (e) => { e.preventDefault(); fileInput.click(); });
    fileInput.addEventListener('change', function () {
      if (this.files && this.files[0]) self.loadFromFile(this.files[0]);
    });

    // arrastar e soltar
    ['dragenter', 'dragover'].forEach((t) =>
      this.el.addEventListener(t, (e) => { e.preventDefault(); self.el.classList.add('drop'); })
    );
    ['dragleave', 'drop'].forEach((t) =>
      this.el.addEventListener(t, (e) => {
        e.preventDefault();
        if (t === 'drop') {
          self.el.classList.remove('drop');
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) self.loadFromFile(f);
        } else if (!self.el.contains(e.relatedTarget)) {
          self.el.classList.remove('drop');
        }
      })
    );

    // duplo clique recentraliza
    this.stage.addEventListener('dblclick', () => this.resetView());
  };

  Viewer.prototype.observe = function () {
    const self = this;
    if (!('IntersectionObserver' in window)) { this.visible = true; return; }
    this.io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        self.visible = en.isIntersecting;
        if (self.visible) { self.acquire(); self.play(); }
        else { self.pause(); self.release(); }
      });
    }, { threshold: 0.02, rootMargin: '150px' });
    this.io.observe(this.el);
  };

  /* ---------------- construcao do renderer ---------------- */
  Viewer.prototype.acquire = async function () {
    if (this.built || this.disposed) return;
    if (!webglOK()) { this.fail('Seu navegador não suporta WebGL'); return; }
    if (!state.ready) {
      this.loadEl.classList.add('show');
      this.loadEl.querySelector('em').textContent = 'Preparando visualizador 3D…';
      try { await initLibs(); }
      catch (e) { this.fail('Não foi possível carregar o visualizador 3D'); return; }
    }
    if (state.active >= state.pool) { this.pending = true; return; }
    this.pending = false;
    state.active++;
    try {
      this.build();
    } catch (e) {
      state.active--;
      this.fail('Falha ao iniciar o WebGL');
    }
  };

  // enquanto nao houver vaga no pool, tenta de novo
  Viewer.prototype.poll = function () {
    if (this.disposed || this.built || !this.pending) return;
    if (!this.visible) return;
    this.acquire();
  };

  /* libera o slot do pool quando sai da tela */
  Viewer.prototype.release = function () {
    if (!this.built) return;
    this.pause();
    const THREE = state.three;
    if (this.object) { disposeObject(this.object); this.object = null; }
    if (this.grid) { if (this.grid.geometry) this.grid.geometry.dispose(); if (this.grid.material) this.grid.material.dispose(); }
    if (this.floor) { if (this.floor.geometry) this.floor.geometry.dispose(); if (this.floor.material) this.floor.material.dispose(); }
    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }
    this.built = false;
    this.hasModel = false;
    this.parts = [];
    this.hiName = null;
    this.el.classList.remove('live', 'has-model', 'picked');
    state.active = Math.max(0, state.active - 1);
    state.viewers.forEach((v) => { if (v !== this && v.pending) v.poll(); });
  };

  Viewer.prototype.build = function () {
    const THREE = state.three;
    if (!THREE) return;

    const w = this.stage.clientWidth || 320;
    const h = this.stage.clientHeight || 200;
    const isBig = this.el.classList.contains('v3d-lg');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, isBig ? 2 : 1.5));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.renderer.domElement.setAttribute('aria-label', 'Visualizador 3D interativo');
    this.stage.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 5000);
    this.camera.position.set(3.2, 2.2, 4.2);

    this.controls = new state.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 400;
    this.controls.target.set(0, 0.4, 0);

    // luzes
    this.scene.add(new THREE.HemisphereLight(0xdceaff, 0x0b2545, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xf5c542, 1.5);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0x6ea8e0, 0.9);
    fill.position.set(-3, -2, 6);
    this.scene.add(fill);

    // grid e chão refletivo (ambiente "renderizado")
    const grid = new THREE.GridHelper(20, 40, 0x21579c, 0x17417a);
    grid.position.y = -0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.34;
    this.scene.add(grid);
    this.grid = grid;

    const floorGeo = new THREE.CircleGeometry(14, 48);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0b2545, transparent: true, opacity: 0.55 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    this.scene.add(floor);
    this.floor = floor;

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.built = true;
    this.el.classList.add('live');
    this.syncSpin();
    this.resize();
    this.renderOnce();

    // tenta carregar o modelo configurado
    const cfg = state.manifest[this.id];
    if (cfg && cfg.url) this.loadURL(cfg.url);
    else this.tryConventional();
  };

  /* desenha um quadro mesmo sem modelo, para o cenario aparecer */
  Viewer.prototype.renderOnce = function () {
    if (!this.renderer) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /* resolve o caminho do .glb para dentro de assets/modelos/ */
  Viewer.prototype.resolveURL = function (url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return 'assets/modelos/' + u.replace(/^\.\//, '').replace(/^modelos\//, '');
  };

  /* verifica se o arquivo existe antes de chamar o loader (evita erro no console) */
  Viewer.prototype.fileExists = function (url) {
    return fetch(url, { method: 'HEAD', cache: 'no-cache' })
      .then((r) => r.ok)
      .catch(() => false);
  };

  Viewer.prototype.tryConventional = async function () {
    if (!state.GLTFLoader) return;
    const url = 'assets/modelos/' + this.id + '.glb';
    const self = this;
    const ok = await this.fileExists(url);
    if (!ok) {
      if (!self.hasModel) self.emptyEl.classList.add('show');
      return;
    }
    const loader = makeLoader();
    loader.load(url, (gltf) => self.addModel(gltf), undefined, () => {
      if (!self.hasModel) self.emptyEl.classList.add('show');
    });
  };

  /* ---------------- carregar modelos ---------------- */
  Viewer.prototype.loadURL = function (raw) {
    const self = this;
    const url = this.resolveURL(raw);
    if (!url) { this.emptyEl.classList.add('show'); return; }
    if (!state.GLTFLoader) { this.fail('3D indisponível'); return; }

    this.loadEl.classList.add('show');
    this.loadEl.querySelector('em').textContent = 'Carregando modelo…';
    this.emptyEl.classList.remove('show');

    const loader = makeLoader();
    loader.load(url,
      (gltf) => self.addModel(gltf),
      (ev) => {
        if (!ev || !ev.total) return;
        const pct = Math.round((ev.loaded / ev.total) * 100);
        self._prog = pct;
        self.loadEl.querySelector('em').textContent =
          ev.loaded >= ev.total ? 'Preparando cena…' : 'Carregando modelo… ' + pct + '%';
      },
      () => self.fail('Modelo não encontrado')
    );
  };

  Viewer.prototype.loadFromFile = function (file) {
    const self = this;
    if (!/\.(glb|gltf)$/i.test(file.name)) { this.fail('Use um arquivo .glb'); return; }
    if (!state.ready || !state.GLTFLoader) {
      this.loadEl.classList.add('show');
      this.loadEl.querySelector('em').textContent = 'Preparando leitor 3D…';
      initLibs().then(() => self.parseArrayBuffer(file)).catch(() => self.fail('3D indisponível'));
      return;
    }
    this.parseArrayBuffer(file);
  };

  Viewer.prototype.parseArrayBuffer = function (file) {
    const self = this;
    const reader = new FileReader();
    reader.onload = function () {
      const loader = makeLoader();
      loader.parse(
        reader.result,
        '',
        (gltf) => self.addModel(gltf),
        () => self.fail('Não foi possível ler o modelo')
      );
    };
    reader.onerror = () => self.fail('Erro ao ler o arquivo');
    reader.readAsArrayBuffer(file);
  };

  Viewer.prototype.addModel = function (gltf) {
    const THREE = state.three;
    const self = this;

    if (this.object) {
      this.pivot.remove(this.object);
      disposeObject(this.object);
    }

    const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!root) { this.fail('Modelo vazio'); return; }

    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          if ('envMapIntensity' in m) m.envMapIntensity = 1;
          if ('roughness' in m && m.roughness === 1) m.roughness = 0.72;
          if ('metalness' in m && m.metalness === 1) m.metalness = 0.55;
          m.needsUpdate = true;
        });
      }
    });

    this.object = root;
    this.pivot.add(root);
    this.hasModel = true;

    // centraliza e enquadra
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // normaliza a escala para o modelo ficar sempre com ~4 unidades,
    // independente de ter vindo em mm, cm ou m
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const TARGET = 4;
    this.autoScale = TARGET / maxDim;

    // centraliza na origem, apoiado no chao (Y = 0)
    root.scale.setScalar(this.autoScale);
    root.position.set(-center.x * this.autoScale, -box.min.y * this.autoScale, -center.z * this.autoScale);
    root.updateMatrixWorld(true);

    this.baseScale = this.autoScale;
    this.pivot.position.set(0, 0, 0);

    this.fitView();
    this.grid.scale.setScalar(Math.max(0.5, TARGET / 5));
    this.floor.scale.setScalar(Math.max(1, TARGET / 3));

    this.controls.update();

    this.emptyEl.classList.remove('show');
    this.loadEl.classList.remove('show');
    this.el.classList.add('has-model');
    this.buildPartList(root);
    if (this.built) this.renderOnce();
    else this.play();
  };

  /* enquadra a camera usando a esfera envolvente do modelo */
  Viewer.prototype.fitView = function () {
    const THREE = state.three;
    if (!this.object) return;

    const box = new THREE.Box3().setFromObject(this.object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 0.001);

    // distancia necessaria para a esfera caber no angulo da camera
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(this.camera.aspect, 0.4));
    const dist = (r / Math.sin(Math.min(vFov, hFov) / 2)) * 0.86;   // folga de 14% em volta

    this.controls.minDistance = r * 0.12;
    this.controls.maxDistance = dist * 8;
    this.controls.target.set(sphere.center.x, sphere.center.y, sphere.center.z);

    // vista isometrica padrao
    const dir = new THREE.Vector3(1, 0.72, 1).normalize();
    this.camera.position.copy(sphere.center).add(dir.multiplyScalar(dist));
    this.camera.near = Math.max(0.01, dist / 500);
    this.camera.far = dist * 40;
    this.camera.updateProjectionMatrix();

    this._radius = r;
    this._center = sphere.center.clone();
  };

  /* =============== DESTAQUE DE PEÇAS (clique/toque) =============== */
  Viewer.prototype.buildPartList = function (root) {
    const self = this;
    this.parts = [];

    const label = (n) => (n && n.name && n.name.trim()) ? n.name.trim() : 'Peça';

    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        if (m.emissive && !m.userData.baseEmissive) {
          m.userData.baseEmissive = m.emissive.clone();
          m.userData.baseEmissiveIntensity = (m.emissiveIntensity !== undefined ? m.emissiveIntensity : 1);
        }
      });
      self.parts.push({ mesh: o, name: label(o) });
    });

    if (!this.parts.length) return;
    this.raycaster = new (state.three.Raycaster)();
    this.ndc = new (state.three.Vector2)(0, 0);

    const canvas = this.renderer && this.renderer.domElement;
    if (!canvas) return;

    let downPt = null;
    canvas.addEventListener('pointerdown', (e) => {
      downPt = { x: e.clientX, y: e.clientY, t: Date.now() };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!downPt) return;
      const dx = e.clientX - downPt.x, dy = e.clientY - downPt.y;
      const dist = Math.hypot(dx, dy);
      const dt = Date.now() - downPt.t;
      downPt = null;
      if (dist > 8 || dt > 700) return;   // foi arrastar, nao clicar
      self.pickAt(e.clientX, e.clientY);
    });
  };

  Viewer.prototype.pickAt = function (cx, cy) {
    if (!this.parts || !this.parts.length || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const meshes = this.parts.map((p) => p.mesh);
    let hits = this.raycaster.intersectObjects(meshes, false);

    // tolerancia para toque em tela pequena
    if (!hits.length) {
      const rings = [10, 22, 36];
      const pts = [];
      rings.forEach((d) => {
        pts.push([cx - d, cy], [cx + d, cy], [cx, cy - d], [cx, cy + d]);
      });
      outer:
      for (const p of pts) {
        this.ndc.x = ((p[0] - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -((p[1] - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        hits = this.raycaster.intersectObjects(meshes, false);
        if (hits.length) break outer;
      }
    }

    if (!hits.length) { this.highlight(null); return; }
    const found = this.parts.find((p) => p.mesh === hits[0].object);
    this.highlight(found ? found.name : null);
  };

  Viewer.prototype.highlight = function (name) {
    if (this.hiName === name) name = null;   // clica de novo = desmarca
    this.hiName = name;

    this.parts.forEach((p) => {
      const mats = Array.isArray(p.mesh.material) ? p.mesh.material : [p.mesh.material];
      const on = name && p.name === name;
      mats.forEach((m) => {
        if (!m || !m.emissive) return;
        if (on) { m.emissive.setHex(0xf5c542); m.emissiveIntensity = 0.85; }
        else {
          if (m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
          if (m.userData.baseEmissiveIntensity !== undefined) m.emissiveIntensity = m.userData.baseEmissiveIntensity;
        }
      });
    });

    this.nameEl.textContent = name ? name : (this.baseName || 'Visualizador 3D');
    this.el.classList.toggle('picked', !!name);
  };

  Viewer.prototype.fail = function (msg) {
    this.loadEl.classList.remove('show');
    this.el.classList.add('error');
    this.el.querySelector('.v3d-empty-in strong').textContent = 'Sem modelo 3D';
    this.el.querySelector('.v3d-empty-in p').innerHTML =
      (msg ? '<b>' + msg + '</b><br>' : '') + 'Arraste um <b>.glb</b> aqui<br>ou use <code>assets/modelos/</code>';
  };

  /* ---------------- controle ---------------- */
  Viewer.prototype.syncSpin = function () {
    if (this.spinBtn) this.spinBtn.classList.toggle('on', this.autoRotate);
  };

  Viewer.prototype.resetView = function () {
    if (!this.built) return;
    if (this.object) {
      this.object.scale.setScalar(this.baseScale);
      this.pivot.rotation.set(0, 0, 0);
    }
    this.fitView();
    this.controls.update();
    this.renderOnce();
  };

  Viewer.prototype.toggleFull = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (this.el.requestFullscreen) this.el.requestFullscreen();
  };

  Viewer.prototype.play = function () {
    if (this.raf || !this.built) return;
    let last = performance.now();
    let acc = 0, frames = 0;

    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (this.autoRotate && this.object) this.pivot.rotation.y += dt * 0.42;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      frames++; acc += dt;
      if (acc >= 1) { this.fpsEl.textContent = Math.round(frames / acc) + ' fps'; frames = 0; acc = 0; }
    };
    this.raf = requestAnimationFrame(loop);
  };

  Viewer.prototype.pause = function () {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  };

  Viewer.prototype.resize = function () {
    if (!this.built) return;
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  /* ---------------- bootstrap ---------------- */
  function disposeObject(o) {
    o.traverse((c) => {
      if (c.isMesh) {
        if (c.geometry) c.geometry.dispose();
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (!m) return;
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        });
      }
    });
  }

  async function boot() {
    if (!document.querySelector('.v3d')) return;
    await loadManifest();
    document.querySelectorAll('.v3d').forEach((el) => new Viewer(el));

    // retentativa periodica para visores que ficaram sem vaga no pool
    setInterval(() => {
      state.viewers.forEach((v) => v.poll());
    }, 1200);

    let rt;
    global.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => state.viewers.forEach((v) => v.resize()), 160);
    });

    // a aba das fotos precisa forcar a releitura do tamanho do canvas
    setInterval(() => {
      state.viewers.forEach((v) => { if (v.visible && v.built) v.resize(); });
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.TZ3D = { state: state, boot: boot };

})(window);
