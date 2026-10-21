/* Ember & Oak — live 3D wood-fired oven (concept demonstration by Cromega Agents).
 * Real-time three.js scene, not a video: a plastered dome oven with a brick arch, burning oak
 * logs, shader flames, glowing coals, rising embers, smoke and flickering firelight, with bloom.
 *
 * API: EmberOak3D.create(container, { progress, still, quality }) →
 *   { set(p), play(), pause(), renderNow(p, t), resize(), snapshot(type, q), canvas, p }
 *   p ∈ [0,1] drives the camera from the dining room (0) to the mouth of the oven (1).
 */
(function () {
  "use strict";
  const T = window.THREE;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- procedural textures ----------
  function canvas(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; }
  function noise(g, w, h, n, cols, size = [1, 2], alpha = 1) { g.globalAlpha = alpha; for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; const s = size[0] + rnd() * (size[1] - size[0]); g.fillRect(rnd() * w, rnd() * h, s, s); } g.globalAlpha = 1; }
  function tex(c, rep = [1, 1], srgb = true, aniso = 8) { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso; return t; }
  function bricks(g, w, h, o) {
    g.fillStyle = o.mortar; g.fillRect(0, 0, w, h);
    const rows = o.rows, bh = h / rows, bw = w / o.cols;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let c = -1; c <= o.cols; c++) {
        const x = c * bw + off, y = r * bh, col = o.cols3[(rnd() * o.cols3.length) | 0];
        g.fillStyle = col; g.fillRect(x + o.gap, y + o.gap, bw - o.gap * 2, bh - o.gap * 2);
        g.globalAlpha = 0.18 + rnd() * 0.2; g.fillStyle = rnd() < 0.5 ? "#000" : "#fff"; g.fillRect(x + o.gap, y + o.gap, bw - o.gap * 2, (bh - o.gap * 2) * (0.2 + rnd() * 0.5)); g.globalAlpha = 1;
      }
    }
    noise(g, w, h, w * h / 40, ["#000", "#2a1a12", "#fff"], [1, 2.5], 0.12);
  }
  const TX = {
    brickWall: () => canvas(1024, 1024, (g, w, h) => bricks(g, w, h, { rows: 16, cols: 4, gap: 4, mortar: "#4a4038", cols3: ["#6e3a28", "#7a4230", "#5e3022", "#83493a", "#6a3a2c", "#58302a"] })),
    fireBrick: () => canvas(512, 512, (g, w, h) => { bricks(g, w, h, { rows: 8, cols: 4, gap: 3, mortar: "#3a3029", cols3: ["#b98a5c", "#a97b50", "#c49668", "#9c7048"] }); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(8,6,5,.92)"); gr.addColorStop(0.55, "rgba(10,7,5,.55)"); gr.addColorStop(1, "rgba(10,7,5,.2)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
    plaster: () => canvas(1024, 512, (g, w, h) => {
      g.fillStyle = "#cdbfae"; g.fillRect(0, 0, w, h);
      noise(g, w, h, 60000, ["#bfb09e", "#d9ccbc", "#c4b4a1", "#b3a390"], [1, 3], 0.6);
      g.strokeStyle = "rgba(90,74,60,.22)"; g.lineWidth = 1;
      for (let i = 0; i < 22; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 40; y += rnd() * 22; g.lineTo(x, y); } g.stroke(); }
    }),
    floor: () => canvas(1024, 1024, (g, w, h) => {
      g.fillStyle = "#2a201b"; g.fillRect(0, 0, w, h); const n = 8, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 34 + rnd() * 14; g.fillStyle = `rgb(${v + 22},${v + 8},${v})`; g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6); g.globalAlpha = 0.25; noise(g, s, s, 400, ["#000", "#5a4234"], [1, 3]); g.globalAlpha = 1; }
      noise(g, w, h, 40000, ["#000", "#3b2c24", "#4a382e"], [1, 2], 0.25);
    }),
    bark: () => canvas(256, 512, (g, w, h) => {
      g.fillStyle = "#2b1d14"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { const x = rnd() * w, ww = 2 + rnd() * 7; const v = 30 + rnd() * 40; g.fillStyle = `rgb(${v + 14},${v + 4},${v - 6})`; g.fillRect(x, 0, ww, h); }
      for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,.5)" : "rgba(120,95,70,.35)"; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 6, 6 + rnd() * 30); }
    }),
    endGrain: () => canvas(256, 256, (g, w, h) => {
      g.fillStyle = "#b08250"; g.fillRect(0, 0, w, h);
      for (let r = 120; r > 4; r -= 5 + rnd() * 4) { g.strokeStyle = `rgba(${90 + rnd() * 30},${55 + rnd() * 20},30,.55)`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.ellipse(w / 2 + (rnd() - 0.5) * 6, h / 2 + (rnd() - 0.5) * 6, r, r * (0.92 + rnd() * 0.1), 0, 0, 7); g.stroke(); }
      g.strokeStyle = "rgba(40,24,12,.6)"; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(w / 2, h / 2); const a = rnd() * 6.28; g.lineTo(w / 2 + Math.cos(a) * 120, h / 2 + Math.sin(a) * 120); g.stroke(); }
      g.strokeStyle = "#2b1d14"; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, 122, 0, 7); g.stroke();
    }),
    charcoal: () => canvas(256, 512, (g, w, h) => { // emissive cracks on burning logs
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(255,${120 + rnd() * 80},40,${0.4 + rnd() * 0.6})`; g.lineWidth = 0.6 + rnd() * 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 14, y + 8 + rnd() * 30); g.stroke(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,${100 + rnd() * 90},30,${0.3 + rnd() * 0.5})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 10, 2 + rnd() * 3); }
    }),
    wood: () => canvas(1024, 256, (g, w, h) => {
      g.fillStyle = "#6b4a32"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) { const v = 92 + Math.sin(y * 0.08 + rnd()) * 12 + rnd() * 10; g.fillStyle = `rgba(${v + 30},${v},${v - 30},.35)`; g.fillRect(0, y, w, 1 + rnd() * 2); }
      for (let i = 0; i < 9; i++) { g.strokeStyle = "rgba(40,24,14,.4)"; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 40, 4 + rnd() * 6, 0, 0, 7); g.stroke(); }
    }),
    soft: () => canvas(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  };

  // ---------- shaders ----------
  const NOISE = `
    vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
    float noise3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.0-2.0*f);
      return mix(mix(mix(dot(hash3(i+vec3(0,0,0)),f-vec3(0,0,0)), dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                     mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
                 mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                     mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z); }
    float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*noise3(p); p*=2.03; a*=0.5; } return s; }`;
  const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const FLAME_FS = `
    uniform float uTime; uniform float uSeed; uniform float uGain; varying vec2 vUv; ${NOISE}
    void main(){
      vec2 uv = vUv; float y = uv.y; float x = (uv.x - 0.5) * 2.0;
      float t = uTime * 1.6 + uSeed * 10.0;
      float n = fbm(vec3(uv.x * 4.0, y * 3.0 - t * 1.2, uSeed * 3.0 + t * 0.3));
      float n2 = fbm(vec3(uv.x * 8.0 + 4.0, y * 6.0 - t * 2.1, uSeed + 1.7));
      float width = mix(0.95, 0.12, pow(y, 0.85)) + n * 0.45;
      float body = smoothstep(width, width * 0.45, abs(x + n2 * 0.42 * y));
      float h = smoothstep(1.0, 0.55 + n * 0.25, y) * smoothstep(0.0, 0.12, y);
      float f = clamp(body * h * (0.55 + n2 * 0.9 + n * 0.4), 0.0, 1.0);
      // blackbody-ish ramp: deep red → orange → yellow → near white core
      vec3 c = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.35, 0.05), smoothstep(0.05, 0.35, f));
      c = mix(c, vec3(1.0, 0.72, 0.28), smoothstep(0.35, 0.7, f));
      c = mix(c, vec3(1.0, 0.9, 0.7), smoothstep(0.8, 1.0, f) * (1.0 - y) * 0.8);
      float a = smoothstep(0.08, 0.45, f);
      gl_FragColor = vec4(c * pow(f, 1.25) * uGain * 1.9, a);
    }`;
  const COALS_FS = `
    uniform float uTime; varying vec2 vUv; ${NOISE}
    void main(){
      vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
      float n = fbm(vec3(vUv * 9.0, uTime * 0.35));
      float cracks = smoothstep(0.08, -0.02, abs(fbm(vec3(vUv * 14.0, 3.0 + uTime * 0.1))));
      float glow = smoothstep(1.0, 0.1, r) * (0.55 + 0.45 * n);
      vec3 base = vec3(0.025, 0.018, 0.015);
      vec3 hot = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.55, 0.12), clamp(n * 1.5, 0.0, 1.0));
      vec3 col = base + hot * (glow * 1.2 + cracks * glow * 4.0);
      float a = smoothstep(1.0, 0.75, r);
      gl_FragColor = vec4(col, a);
    }`;
  const EMBER_VS = `attribute float aSize; attribute float aLife; varying float vLife; uniform float uScale;
    void main(){ vLife = aLife; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
  const EMBER_FS = `varying float vLife; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
    float core = smoothstep(0.5, 0.0, r); vec3 c = mix(vec3(1.0,0.25,0.03), vec3(1.0,0.75,0.35), vLife);
    gl_FragColor = vec4(c * core * (0.6 + 2.4 * vLife), core * vLife); }`;
  const FINAL = {
    uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.0 }, uTime: { value: 0 }, uVignette: { value: 0.9 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uExposure; uniform float uTime; uniform float uVignette; varying vec2 vUv;
      vec3 aces(vec3 x){ x *= uExposure; mat3 m1 = mat3(0.59719,0.07600,0.02840,0.35458,0.90834,0.13383,0.04823,0.01566,0.83777);
        mat3 m2 = mat3(1.60475,-0.10208,-0.00327,-0.53108,1.10813,-0.07276,-0.07367,-0.00605,1.07602);
        vec3 v = m1 * x; vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return clamp(m2 * (a/b), 0.0, 1.0); }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; c = toSRGB(aces(c));
        vec2 q = vUv - 0.5; c *= mix(1.0, smoothstep(0.85, 0.2, length(q * vec2(1.1, 1.0))), uVignette);
        c += (h(vUv * 913.0 + uTime) - 0.5) * 0.025; gl_FragColor = vec4(c, 1.0); }`,
  };

  function create(container, opts = {}) {
    const mobile = Math.min(innerWidth, innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
    const quality = opts.quality || (mobile ? "low" : "high");
    const renderer = new T.WebGLRenderer({ antialias: quality !== "low", alpha: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "low" ? 1.25 : 1.75));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = quality !== "low"; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    container.appendChild(renderer.domElement);

    const scene = new T.Scene();
    scene.background = new T.Color(0x070504);
    scene.fog = new T.FogExp2(0x0a0705, 0.075);
    const camera = new T.PerspectiveCamera(38, 1, 0.05, 60);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // materials
    const M = (o) => new T.MeshStandardMaterial(o);
    const brickTex = tex(TX.brickWall(), [11, 5], true, aniso);
    const brickBump = tex(TX.brickWall(), [11, 5], false, aniso);
    const plasterTex = tex(TX.plaster(), [2, 1], true, aniso);
    const fireBrickTex = tex(TX.fireBrick(), [3, 2], true, aniso);
    const floorTex = tex(TX.floor(), [5, 5], true, aniso);
    const barkTex = tex(TX.bark(), [1, 1], true, aniso);
    const endTex = tex(TX.endGrain(), [1, 1], true, aniso);
    const charTex = tex(TX.charcoal(), [1, 1], true, aniso);
    const woodTex = tex(TX.wood(), [1, 1], true, aniso);
    const softTex = tex(TX.soft(), [1, 1], false, 1);
    const mat = {
      wall: M({ map: brickTex, bumpMap: brickBump, bumpScale: 0.03, roughness: 0.92 }),
      plaster: M({ map: plasterTex, roughness: 0.88, vertexColors: true }),
      inner: M({ map: fireBrickTex, roughness: 0.95, side: T.BackSide, vertexColors: true, color: 0x7d6c5e }),
      arch: M({ map: fireBrickTex, roughness: 0.9 }),
      archFace: M({ map: plasterTex, roughness: 0.88 }),
      hearth: M({ map: fireBrickTex, roughness: 0.9, color: 0x8c7462 }),
      floor: M({ map: floorTex, roughness: 0.55, metalness: 0.0 }),
      base: M({ map: plasterTex, roughness: 0.9, color: 0x9a8c7c }),
      niche: M({ color: 0x0b0806, roughness: 1 }),
      bark: M({ map: barkTex, roughness: 0.95 }),
      end: M({ map: endTex, roughness: 0.9 }),
      charEnd: M({ color: 0x1a120d, roughness: 1, emissive: 0xff5a18, emissiveMap: charTex, emissiveIntensity: 1.6 }),
      burning: M({ map: barkTex, color: 0x241a15, roughness: 1, emissive: 0xff6a20, emissiveMap: charTex, emissiveIntensity: 2.2 }),
      steel: M({ color: 0x1b1a19, roughness: 0.45, metalness: 0.85 }),
      copper: M({ color: 0xb06a3f, roughness: 0.35, metalness: 1.0 }),
      wood: M({ map: woodTex, roughness: 0.7 }),
      ceiling: M({ color: 0x0c0908, roughness: 1 }),
    };
    const mesh = (geo, m, cast = true, recv = true) => { const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; };

    // ---------- room ----------
    const floor = mesh(new T.PlaneGeometry(40, 40), mat.floor, false, true); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const wall = mesh(new T.PlaneGeometry(14, 6), mat.wall, false, true); wall.position.set(0, 3, -1.75); scene.add(wall);
    const wallL = mesh(new T.PlaneGeometry(10, 6), mat.wall, false, true); wallL.rotation.y = Math.PI / 2; wallL.position.set(-4.2, 3, 2.5); scene.add(wallL);
    const ceil = mesh(new T.PlaneGeometry(14, 14), mat.ceiling, false, false); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.2, 2); scene.add(ceil);

    // ---------- oven ----------
    const H0 = 1.05, R = 1.02, SY = 0.78; // hearth height, dome radius, dome vertical squash
    const oven = new T.Group(); scene.add(oven);
    // base / plinth with a wood-storage niche
    const base = mesh(new T.BoxGeometry(2.7, H0, 2.5), mat.base); base.position.set(0, H0 / 2, -0.15); oven.add(base);
    const niche = mesh(new T.BoxGeometry(1.7, 0.62, 0.06), mat.niche, false, true); niche.position.set(0, 0.42, 1.105); oven.add(niche);
    const slab = mesh(new T.BoxGeometry(2.9, 0.09, 2.7), mat.base); slab.position.set(0, H0 + 0.0, -0.15); oven.add(slab);
    // dome (outer) — upper hemisphere with the mouth cut out of the front
    const domeGeo = new T.SphereGeometry(R, 72, 28, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.scale(1, SY, 1); domeGeo.translate(0, H0, 0);
    { // soot: darken the plaster above the mouth and near the base
      const pos = domeGeo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const mouth = Math.exp(-((x * x) / 0.25 + Math.pow((y - (H0 + 0.62)) / 0.32, 2))) * clamp(z / R, 0, 1);
        const d = clamp(0.94 - mouth * 0.78 - (y < H0 + 0.08 ? 0.12 : 0), 0.08, 1);
        col[i * 3] = d; col[i * 3 + 1] = d * 0.97; col[i * 3 + 2] = d * 0.94; }
      domeGeo.setAttribute("color", new T.BufferAttribute(col, 3));
    }
    const MW = 0.43, MH = 0.56; // mouth half-width, mouth top height above hearth
    const cutGeo = (g, pad) => { // drop triangles touching the mouth tunnel footprint (the brick portal hides the edge)
      const idx = g.index.array, pos = g.attributes.position, keep = [], hw = MW + pad, top = MH + pad + 0.05, sh = top - hw * 0.55;
      const inArch = (x, y, z) => z > R * 0.5 && Math.abs(x) < hw && (y < sh || (x * x) / (hw * hw) + Math.pow((y - sh) / (hw * 0.55), 2) < 1);
      for (let i = 0; i < idx.length; i += 3) { let hit = false;
        for (let k = 0; k < 3; k++) { const v = idx[i + k]; if (inArch(pos.getX(v), pos.getY(v) - H0, pos.getZ(v))) hit = true; }
        if (!hit) keep.push(idx[i], idx[i + 1], idx[i + 2]); }
      g.setIndex(keep); g.computeVertexNormals(); return g; };
    const dome = mesh(cutGeo(domeGeo, 0.1), mat.plaster); oven.add(dome);
    const innerGeo = new T.SphereGeometry(R * 0.9, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2); innerGeo.scale(1, SY, 1); innerGeo.translate(0, H0, 0);
    { const pos = innerGeo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const h = clamp((pos.getY(i) - H0) / (R * SY * 0.9)); const d = lerp(0.6, 0.04, Math.pow(h, 0.6)) * (0.8 + 0.2 * Math.sin(pos.getX(i) * 9.0 + pos.getZ(i) * 7.0)); col[i * 3] = d; col[i * 3 + 1] = d * 0.92; col[i * 3 + 2] = d * 0.86; }
      innerGeo.setAttribute("color", new T.BufferAttribute(col, 3)); }
    const inner = mesh(cutGeo(innerGeo, 0.02), mat.inner, false, true); oven.add(inner);
    // cooking floor
    const hearth = mesh(new T.CircleGeometry(R * 0.9, 48), mat.hearth, false, true); hearth.rotation.x = -Math.PI / 2; hearth.position.y = H0 + 0.051; oven.add(hearth);
    // vestibule: arched tunnel through the dome front
    const archShape = (hw, top) => { const s = new T.Path(); const sh = top - hw * 0.55; s.moveTo(-hw, 0); s.lineTo(-hw, sh); s.absellipse(0, sh, hw, hw * 0.55, Math.PI, 0, true); s.lineTo(hw, 0); s.lineTo(-hw, 0); return s; };
    const ring = new T.Shape(); { const hw = MW + 0.16, top = MH + 0.14, sh = top - hw * 0.62; ring.moveTo(-hw, -0.02); ring.lineTo(-hw, sh); ring.absellipse(0, sh, hw, hw * 0.62, Math.PI, 0, true); ring.lineTo(hw, -0.02); ring.lineTo(-hw, -0.02); }
    ring.holes.push(archShape(MW, MH));
    const vestGeo = new T.ExtrudeGeometry(ring, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 32 });
    const ringMat = mat.arch.clone(); ringMat.side = T.DoubleSide; ringMat.color.set(0x9a8070);
    const vest = new T.Mesh(vestGeo, [mat.arch, ringMat]); vest.castShadow = vest.receiveShadow = true; vest.position.set(0, H0 + 0.05, R * 0.6); oven.add(vest);
    // voussoir bricks around the arch
    { const n = 17, g = new T.BoxGeometry(0.095, 0.16, 0.05), im = new T.InstancedMesh(g, mat.arch, n + 4), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(1, 1, 1);
      const cy = H0 + 0.05 + (MH - MW * 0.55); let k = 0;
      for (let i = 0; i < n; i++) { const a = Math.PI - (i + 0.5) * (Math.PI / n), rx = (MW + 0.085) * Math.cos(a), ry = (MW * 0.55 + 0.085) * Math.sin(a);
        e.set(0, 0, a - Math.PI / 2); q.setFromEuler(e); m4.compose(new T.Vector3(rx, cy + ry, R * 0.6 + 0.515), q, sc); im.setMatrixAt(k++, m4); }
      for (const sx of [-1, 1]) for (let j = 0; j < 2; j++) { e.set(0, 0, 0); q.setFromEuler(e); m4.compose(new T.Vector3(sx * (MW + 0.085), H0 + 0.05 + 0.09 + j * 0.18, R * 0.6 + 0.515), q, new T.Vector3(1.35, 0.95, 1)); im.setMatrixAt(k++, m4); }
      im.castShadow = true; im.receiveShadow = true; oven.add(im); }
    const tunnelFloor = mesh(new T.BoxGeometry(MW * 2 + 0.02, 0.012, 0.62), mat.hearth, false, true); tunnelFloor.position.set(0, H0 + 0.051, R * 0.6 + 0.26); oven.add(tunnelFloor);
    // landing ledge + flue
    const ledge = mesh(new T.BoxGeometry(1.3, 0.07, 0.42), mat.hearth); ledge.position.set(0, H0 + 0.02, R * 0.6 + 0.62); oven.add(ledge);
    const hood = mesh(new T.BoxGeometry(0.62, 0.2, 0.3), mat.steel); hood.position.set(0, H0 + 0.86, R * 0.6 + 0.3); oven.add(hood);
    const pipe = mesh(new T.CylinderGeometry(0.11, 0.11, 3.2, 28), mat.steel); pipe.position.set(0, H0 + 2.65, R * 0.6 + 0.3); oven.add(pipe);
    const collar = mesh(new T.CylinderGeometry(0.135, 0.135, 0.08, 28), mat.copper); collar.position.set(0, H0 + 1.1, R * 0.6 + 0.3); oven.add(collar);

    // ---------- logs ----------
    const logGeo = new T.CylinderGeometry(0.07, 0.075, 0.62, 14, 1);
    function log(parent, m, x, y, z, ry, rz, s = 1) { const g = new T.Group(); const body = mesh(logGeo, m === mat.burning ? [m, mat.charEnd, mat.charEnd] : [m, mat.end, mat.end]); g.add(body); g.rotation.set(0, ry, rz); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g); return g; }
    // burning logs at the back-left of the chamber
    const burning = [
      log(oven, mat.burning, -0.36, H0 + 0.13, -0.18, 0.7, Math.PI / 2),
      log(oven, mat.burning, -0.25, H0 + 0.13, -0.42, -0.25, Math.PI / 2),
      log(oven, mat.burning, -0.32, H0 + 0.25, -0.3, 0.2, Math.PI / 2 - 0.25, 0.92),
    ];
    // wood stack in the niche and beside the oven
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9 - r; c++) log(oven, mat.bark, -0.68 + c * 0.16 + r * 0.08, 0.17 + r * 0.135, 1.05, Math.PI / 2, Math.PI / 2, 1.0 + rnd() * 0.12 - 0.06).rotation.set(Math.PI / 2, 0, rnd() * 0.3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4 - (r >> 1); c++) { const g = log(scene, mat.bark, 1.9 + c * 0.17 + (r % 2) * 0.08, 0.08 + r * 0.14, 0.9 + (rnd() - 0.5) * 0.06, 0, 0, 1.15); g.rotation.set(Math.PI / 2, 0, rnd() * 0.25); }
    // ---------- fire: coals, flames, embers, smoke ----------
    const fireCenter = new T.Vector3(-0.3, H0 + 0.12, -0.28);
    const coalU = { uTime: { value: 0 } };
    const coals = new T.Mesh(new T.PlaneGeometry(0.95, 0.75), new T.ShaderMaterial({ uniforms: coalU, vertexShader: FLAME_VS, fragmentShader: COALS_FS, transparent: true, depthWrite: false }));
    coals.rotation.x = -Math.PI / 2; coals.position.set(fireCenter.x, H0 + 0.056, fireCenter.z); oven.add(coals);
    const flames = []; const flameGeo = new T.PlaneGeometry(1, 1, 1, 1); flameGeo.translate(0, 0.5, 0);
    const FL = [[-0.36, -0.2, 0.26, 0.58, 0.0], [-0.22, -0.34, 0.22, 0.5, 1.3], [-0.44, -0.33, 0.22, 0.46, 2.1], [-0.3, -0.25, 0.3, 0.66, 3.7], [-0.14, -0.2, 0.18, 0.38, 4.4], [-0.5, -0.14, 0.2, 0.4, 5.2],
      [-0.32, -0.42, 0.26, 0.52, 6.6], [-0.26, -0.12, 0.16, 0.34, 7.3], [-0.4, -0.24, 0.14, 0.62, 8.8], [-0.18, -0.3, 0.14, 0.54, 9.9]];
    for (const [x, z, w, h, s] of FL) { const u = { uTime: { value: 0 }, uSeed: { value: s }, uGain: { value: 1 } };
      const m = new T.Mesh(flameGeo, new T.ShaderMaterial({ uniforms: u, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      m.position.set(x, H0 + 0.1, z); m.scale.set(w, h, 1); m.userData = { u, w, h, s }; oven.add(m); flames.push(m); }
    // flame tongues licking along the dome ceiling toward the mouth
    for (const [y, z, s] of [[0.45, -0.05, 8.1], [0.5, 0.12, 9.4]]) { const u = { uTime: { value: 0 }, uSeed: { value: s }, uGain: { value: 0.55 } };
      const m = new T.Mesh(flameGeo, new T.ShaderMaterial({ uniforms: u, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      m.position.set(-0.2, H0 + y, z); m.rotation.set(-1.15, 0, 0); m.scale.set(0.45, 0.62, 1); m.userData = { u, w: 0.45, h: 0.62, s, tongue: true }; oven.add(m); flames.push(m); }
    // embers
    const EN = quality === "low" ? 90 : 180, eGeo = new T.BufferGeometry(), ePos = new Float32Array(EN * 3), eSize = new Float32Array(EN), eLife = new Float32Array(EN), eVel = [];
    const spawn = (i, warm) => { ePos[i * 3] = fireCenter.x + (rnd() - 0.5) * 0.4; ePos[i * 3 + 1] = fireCenter.y + rnd() * 0.15 + (warm ? rnd() * 0.5 : 0); ePos[i * 3 + 2] = fireCenter.z + (rnd() - 0.5) * 0.35;
      eVel[i] = { x: (rnd() - 0.5) * 0.08, y: 0.18 + rnd() * 0.32, z: 0.06 + rnd() * 0.22, ph: rnd() * 6.28, max: 1.6 + rnd() * 2.2, age: warm ? rnd() * 2 : 0 }; eSize[i] = 1.1 + rnd() * 2.2; eLife[i] = 1; };
    for (let i = 0; i < EN; i++) spawn(i, true);
    eGeo.setAttribute("position", new T.BufferAttribute(ePos, 3)); eGeo.setAttribute("aSize", new T.BufferAttribute(eSize, 1)); eGeo.setAttribute("aLife", new T.BufferAttribute(eLife, 1));
    const eU = { uScale: { value: 1 } };
    const embers = new T.Points(eGeo, new T.ShaderMaterial({ uniforms: eU, vertexShader: EMBER_VS, fragmentShader: EMBER_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    embers.frustumCulled = false; oven.add(embers);
    // smoke: soft sprites rolling out of the mouth top into the hood
    const smoke = []; for (let i = 0; i < 14; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: softTex, color: 0x3a3430, transparent: true, opacity: 0, depthWrite: false, fog: true })); s.userData = { ph: i / 14, sp: 0.18 + rnd() * 0.1, dx: (rnd() - 0.5) * 0.25 }; oven.add(s); smoke.push(s); }
    // glow sprite at the mouth (fakes light scattering in the air)
    const glow = new T.Sprite(new T.SpriteMaterial({ map: softTex, color: 0xff7a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending })); glow.position.set(-0.1, H0 + 0.3, R * 0.6 + 0.7); glow.scale.set(1.3, 0.8, 1); oven.add(glow);

    // ---------- lights ----------
    const hemi = new T.HemisphereLight(0x2a3242, 0x120a06, 0.22); scene.add(hemi);
    const fire = new T.PointLight(0xff7a2a, 6, 2.6, 2); fire.position.copy(fireCenter).add(new T.Vector3(0.1, 0.25, 0.1)); oven.add(fire);
    const spill = new T.PointLight(0xff8a3a, 6, 9, 2); spill.position.set(-0.05, H0 + 0.3, R * 0.6 + 0.7); spill.castShadow = renderer.shadowMap.enabled; spill.shadow.mapSize.set(512, 512); spill.shadow.bias = -0.004; spill.shadow.radius = 4; oven.add(spill);
    const rim = new T.SpotLight(0x8aa0c8, 0.9, 14, 0.5, 0.8, 1.5); rim.position.set(-3.5, 3.6, 4.5); rim.target.position.set(0, 1.2, 0); scene.add(rim, rim.target); // cool window light for contrast
    const pendant = new T.PointLight(0xffc48a, 0.8, 6, 2); pendant.position.set(2.4, 2.6, 2.6); scene.add(pendant);
    const bulb = mesh(new T.SphereGeometry(0.05, 16, 12), new T.MeshBasicMaterial({ color: 0xffd9a8 }), false, false); bulb.position.copy(pendant.position); scene.add(bulb);
    const cord = mesh(new T.CylinderGeometry(0.005, 0.005, 1.6, 6), mat.steel, false, false); cord.position.set(2.4, 3.42, 2.6); scene.add(cord);
    const shade = mesh(new T.ConeGeometry(0.2, 0.18, 32, 1, true), mat.copper); shade.position.set(2.4, 2.72, 2.6); scene.add(shade);

    // ---------- post-processing (bloom) ----------
    let composer = null, bloom = null, finalPass = null;
    try {
      if (T.EffectComposer && T.UnrealBloomPass && quality !== "off") {
        const rt = new T.WebGLRenderTarget(2, 2, { type: renderer.capabilities.isWebGL2 ? T.HalfFloatType : T.UnsignedByteType, format: T.RGBAFormat, encoding: T.LinearEncoding });
        composer = new T.EffectComposer(renderer, rt);
        composer.addPass(new T.RenderPass(scene, camera));
        bloom = new T.UnrealBloomPass(new T.Vector2(2, 2), 0.6, 0.35, renderer.capabilities.isWebGL2 ? 1.0 : 0.7); composer.addPass(bloom);
        finalPass = new T.ShaderPass(FINAL); composer.addPass(finalPass);
        renderer.toneMapping = T.NoToneMapping; renderer.outputEncoding = T.LinearEncoding;
        for (const m of Object.values(mat)) m.needsUpdate = true;
      }
    } catch (e) { composer = null; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.outputEncoding = T.sRGBEncoding; }

    // ---------- camera path ----------
    const CAM = [
      { p: 0.0, pos: [3.1, 1.85, 5.6], tgt: [-0.15, 1.3, 0.2], fov: 40 },
      { p: 0.5, pos: [1.35, 1.6, 3.7], tgt: [-0.15, 1.32, 0.1], fov: 34 },
      { p: 1.0, pos: [0.32, 1.42, 2.35], tgt: [-0.2, 1.22, -0.2], fov: 30 },
    ];
    const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
    function camAt(p) { let i = 0; while (i < CAM.length - 2 && p > CAM[i + 1].p) i++; const A = CAM[i], B = CAM[i + 1], t = eio(clamp((p - A.p) / (B.p - A.p))); return { pos: v3(A.pos).lerp(v3(B.pos), t), tgt: v3(A.tgt).lerp(v3(B.tgt), t), fov: lerp(A.fov, B.fov, t) }; }

    // ---------- state + frame ----------
    const st = { p: opts.progress ?? 0, t: 0, playing: false, last: 0, aspect: 1 };
    let raf = 0;
    function update(dt) {
      const t = st.t;
      // flicker: layered sines + jitter, shared by lights and emissives
      const fl = 0.78 + 0.12 * Math.sin(t * 7.3) + 0.07 * Math.sin(t * 13.1 + 1.3) + 0.05 * Math.sin(t * 23.7 + 0.4) + (rnd() - 0.5) * 0.05;
      fire.intensity = 6 * fl; spill.intensity = 6 * (0.88 + (fl - 0.78) * 0.9); glow.material.opacity = 0.28 + (fl - 0.78) * 0.6;
      mat.burning.emissiveIntensity = 1.6 + fl * 1.1;
      coalU.uTime.value = t;
      // flames: animate + face the camera around their vertical axis
      const cw = new T.Vector3(); camera.getWorldPosition(cw);
      for (const f of flames) { f.userData.u.uTime.value = t; if (!f.userData.tongue) { f.rotation.y = Math.atan2(cw.x - f.position.x, cw.z - f.position.z); const s = 1 + 0.12 * Math.sin(t * 3.1 + f.userData.s * 2); f.scale.set(f.userData.w * (0.95 + 0.08 * Math.sin(t * 5 + f.userData.s)), f.userData.h * s, 1); } }
      // embers
      for (let i = 0; i < EN; i++) { const v = eVel[i]; v.age += dt; const k = i * 3;
        ePos[k] += (v.x + Math.sin(t * 2.2 + v.ph) * 0.06) * dt; ePos[k + 1] += v.y * dt; ePos[k + 2] += v.z * dt * (ePos[k + 1] > H0 + 0.4 ? 1.6 : 0.6);
        // once above the mouth they get pulled up the flue
        if (ePos[k + 2] > R * 0.5 && ePos[k + 1] > H0 + 0.45) { ePos[k] *= 0.98; ePos[k + 1] += 0.35 * dt; }
        const inside = ePos[k + 2] < R * 0.6 && ePos[k + 1] > H0 + R * SY * 0.82;
        eLife[i] = clamp(1 - v.age / v.max) * (0.7 + 0.3 * Math.sin(t * 9 + v.ph));
        if (v.age > v.max || inside) spawn(i, false); }
      eGeo.attributes.position.needsUpdate = true; eGeo.attributes.aLife.needsUpdate = true;
      // smoke
      for (const s of smoke) { const a = (s.userData.ph + t * s.userData.sp * 0.25) % 1; s.position.set(s.userData.dx * a, H0 + 0.6 + a * 0.6, R * 0.6 + 0.62 - a * 0.25); const sc = 0.25 + a * 0.7; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(a * Math.PI) * 0.16; }
      // camera: scroll path + a gentle handheld drift
      const c = camAt(clamp(st.p));
      // on wide screens the copy sits on the left, so frame the oven on the right
      const side = opts.centered ? 0 : (st.aspect > 1.05 ? Math.min(1, (st.aspect - 1.05) / 0.7) : 0), sh = side * lerp(2.1, 0.3, clamp(st.p));
      c.tgt.x -= sh; c.pos.x -= sh * 0.35;
      // on tall phone screens the copy sits at the bottom, so lift the oven into the top half
      if (!opts.centered && st.aspect < 0.95) { const port = Math.min(1, (0.95 - st.aspect) / 0.5); c.tgt.y -= port * lerp(0.75, 0.12, clamp(st.p)); }
      c.pos.x += Math.sin(t * 0.21) * 0.035; c.pos.y += Math.sin(t * 0.17 + 1) * 0.02;
      camera.position.copy(c.pos); camera.fov = c.fov + (st.aspect < 1 ? (1 - st.aspect) * 22 : 0); camera.updateProjectionMatrix(); camera.lookAt(c.tgt);
      eU.uScale.value = renderer.domElement.height * 0.5 / Math.tan(camera.fov * Math.PI / 360) * 0.012;
      if (finalPass) { finalPass.uniforms.uTime.value = t % 10; finalPass.uniforms.uExposure.value = 1.05; }
    }
    function render() { if (composer) composer.render(); else renderer.render(scene, camera); }
    function frame(ts) { raf = 0; if (!st.playing) return; const dt = st.last ? Math.min(0.05, (ts - st.last) / 1000) : 0.016; st.last = ts; st.t += dt; update(dt); render(); raf = requestAnimationFrame(frame); }
    function resize() { const w = container.clientWidth || 800, h = container.clientHeight || 600; st.aspect = w / h; renderer.setSize(w, h, false); camera.aspect = st.aspect; camera.updateProjectionMatrix();
      if (composer) { const pr = renderer.getPixelRatio(); composer.setSize(w, h); composer.setPixelRatio && composer.setPixelRatio(pr); if (bloom) bloom.setSize(Math.round(w * pr / 2), Math.round(h * pr / 2)); }
      if (!st.playing) { update(0); render(); } }
    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null; if (ro) ro.observe(container); else addEventListener("resize", resize);
    resize();
    // warm up the particle simulation so the first frame already looks alive
    for (let i = 0; i < 90; i++) { st.t += 1 / 30; update(1 / 30); }
    render();

    const api = {
      set(p) { st.p = clamp(p); if (!st.playing) { update(0); render(); } },
      play() { if (st.playing || opts.still) return; st.playing = true; st.last = 0; raf = requestAnimationFrame(frame); },
      pause() { st.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
      renderNow(p, t) { if (p !== undefined) st.p = clamp(p); if (t !== undefined) { const steps = Math.max(1, Math.round((t - st.t) * 30)); for (let i = 0; i < Math.min(steps, 300); i++) { st.t += 1 / 30; update(1 / 30); } } update(0); render(); },
      resize,
      get p() { return st.p; }, canvas: renderer.domElement,
      snapshot(type = "image/jpeg", q = 0.88) { update(0); render(); return renderer.domElement.toDataURL(type, q); },
      dispose() { api.pause(); ro && ro.disconnect(); renderer.dispose(); },
    };
    if (!opts.still) api.play();
    return api;
  }

  window.EmberOak3D = { create };
})();
