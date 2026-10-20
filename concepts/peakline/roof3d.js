/* Peakline Roofing — 3D roof build, time-lapse style (concept demonstration by Cromega Agents).
 * Real-time WebGL scene (three.js r128). One value, p (0–1), drives the illustrative sequence:
 *   0.00–0.22 framing & deck · 0.22–0.40 underlayment · 0.40–0.70 standing-seam panels
 *   0.70–0.84 ridge cap, flashing, trim & gutters · 0.84–1.00 cleanup, landscaping, camera settles
 * Time-lapse cues: the sun crosses the sky (morning → golden hour), clouds race, material stacks
 * shrink as they are installed. All textures are generated in code — no photos or video.
 * Visual demonstration only; not an installation guide.
 */
(function () {
  "use strict";
  const T = window.THREE;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const eout = (t) => 1 - Math.pow(1 - t, 3);
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  // ---- house dimensions (metres) ----
  const L = 12, W = 8, H = 2.9, R = 2.4, O = 0.5, OG = 0.42;
  const SLOPE = R / (W / 2), ALPHA = Math.atan(SLOPE), CA = Math.cos(ALPHA), SA = Math.sin(ALPHA);
  const S = (W / 2 + O) / CA;               // rafter length, ridge → eave
  const EAVE_Y = H + R - S * SA, EAVE_Z = W / 2 + O, RIDGE_Y = H + R, XL = L + 2 * OG;
  const CH = { x: 3.3, z: 1.55, w: 0.95, d: 0.95, top: RIDGE_Y + 0.75 };

  const PALETTE = {
    charcoal: { name: "Charcoal", c: 0x464c53, trim: 0x33373c },
    galvalume: { name: "Galvalume", c: 0xb4babf, trim: 0x9fa6ab, metal: 0.95, rough: 0.3 },
    forest: { name: "Forest", c: 0x3d6150, trim: 0x2f4d3f },
    barn: { name: "Barn Red", c: 0x7c2b23, trim: 0x65231d },
    slate: { name: "Slate Blue", c: 0x4b6683, trim: 0x3d5470 },
    copper: { name: "Copper Penny", c: 0xa45d38, trim: 0x8a4e2f, metal: 0.9, rough: 0.32 },
  };
  const STAGES = [
    { id: "frame", label: "Framing & deck", from: 0, to: 0.22 },
    { id: "under", label: "Underlayment", from: 0.22, to: 0.40 },
    { id: "panels", label: "Standing-seam panels", from: 0.40, to: 0.70 },
    { id: "trim", label: "Ridge, flashing & gutters", from: 0.70, to: 0.84 },
    { id: "done", label: "Finished home", from: 0.84, to: 1 },
  ];

  // ---------------- procedural textures ----------------
  function canvas(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; }
  function tex(c, rep = [1, 1], srgb = true, aniso = 8) {
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
    if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso; return t;
  }
  const noise = (g, w, h, n, colors, size = [1, 3]) => { for (let i = 0; i < n; i++) { g.fillStyle = colors[(rnd() * colors.length) | 0]; const s = lerp(size[0], size[1], rnd()); g.fillRect(rnd() * w, rnd() * h, s, s); } };
  const TX = {
    siding: () => canvas(512, 512, (g, w, h) => { // 1 m tall, 6 boards
      g.fillStyle = "#e3dccf"; g.fillRect(0, 0, w, h);
      const n = 6, bh = h / n;
      for (let i = 0; i < n; i++) { const y = i * bh; const gr = g.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, "#efe9de"); gr.addColorStop(0.82, "#e0d8ca"); gr.addColorStop(0.9, "#bdb3a3"); gr.addColorStop(1, "#8f8576"); g.fillStyle = gr; g.fillRect(0, y, w, bh); }
      g.globalAlpha = 0.05; noise(g, w, h, 5000, ["#000", "#fff"], [1, 2]); g.globalAlpha = 1;
    }),
    wood: () => canvas(128, 512, (g, w, h) => {
      g.fillStyle = "#b98a56"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(${90 + rnd() * 40},${55 + rnd() * 30},${25 + rnd() * 20},${0.15 + rnd() * 0.25})`; g.lineWidth = 0.5 + rnd() * 2; g.beginPath(); let x = rnd() * w; g.moveTo(x, 0); for (let y = 0; y <= h; y += 16) { x += (rnd() - 0.5) * 2.2; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 4; i++) { g.fillStyle = "rgba(90,55,25,.45)"; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 4, 6 + rnd() * 8, 0, 0, 7); g.fill(); }
    }),
    osb: () => canvas(512, 512, (g, w, h) => {
      g.fillStyle = "#c39a5e"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { g.save(); g.translate(rnd() * w, rnd() * h); g.rotate(rnd() * Math.PI); const c = 150 + rnd() * 70; g.fillStyle = `rgba(${c},${c * 0.74},${c * 0.43},${0.55 + rnd() * 0.35})`; g.fillRect(-12 - rnd() * 14, -2.5, 24 + rnd() * 26, 4 + rnd() * 4); g.restore(); }
      g.globalAlpha = 0.18; noise(g, w, h, 4000, ["#5a3d1c", "#e8cc98"]); g.globalAlpha = 1;
    }),
    under: () => canvas(512, 512, (g, w, h) => {
      g.fillStyle = "#2c3036"; g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.08; noise(g, w, h, 6000, ["#fff", "#000"], [1, 2]); g.globalAlpha = 1;
      g.strokeStyle = "rgba(225,232,240,.38)"; g.lineWidth = 2; for (const y of [0.22, 0.5, 0.78]) { g.beginPath(); g.moveTo(0, y * h); g.lineTo(w, y * h); g.stroke(); }
      g.setLineDash([10, 12]); g.strokeStyle = "rgba(225,232,240,.25)"; g.beginPath(); g.moveTo(0, 0.08 * h); g.lineTo(w, 0.08 * h); g.stroke();
    }),
    grass: () => canvas(512, 512, (g, w, h) => { g.fillStyle = "#6f7f45"; g.fillRect(0, 0, w, h); noise(g, w, h, 26000, ["#5f7139", "#7f8d4f", "#8a9656", "#66773e", "#93995a", "#56662f"], [1, 3]); }),
    dirt: () => canvas(512, 512, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5); gr.addColorStop(0, "rgba(122,98,72,1)"); gr.addColorStop(0.75, "rgba(122,98,72,.92)"); gr.addColorStop(1, "rgba(122,98,72,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-atop"; noise(g, w, h, 16000, ["#6a5238", "#8c7254", "#9a8668", "#5a4630", "#a39b8c"], [1, 3.5]); g.globalCompositeOperation = "source-over";
    }),
    stone: () => canvas(512, 512, (g, w, h) => {
      g.fillStyle = "#6b655e"; g.fillRect(0, 0, w, h);
      let y = 0; while (y < h) { const rh = 34 + rnd() * 28; let x = -rnd() * 60; while (x < w) { const rw = 50 + rnd() * 70, c = 110 + rnd() * 55; g.fillStyle = `rgb(${c},${c * 0.95},${c * 0.88})`; g.fillRect(x + 3, y + 3, rw - 6, rh - 6); x += rw; } y += rh; }
      g.globalAlpha = 0.12; noise(g, w, h, 9000, ["#000", "#fff"], [1, 2.5]); g.globalAlpha = 1;
    }),
    concrete: () => canvas(256, 256, (g, w, h) => { g.fillStyle = "#bdb8ae"; g.fillRect(0, 0, w, h); g.globalAlpha = 0.25; noise(g, w, h, 9000, ["#9d988e", "#d4cfc5", "#aaa59b"], [1, 2]); g.globalAlpha = 1; }),
    mountains: () => canvas(2048, 512, (g, w, h) => {
      const ridge = (base, amp, rough, seed) => { const pts = []; let y = base; for (let x = 0; x <= w; x += 8) { y += (Math.sin(x * 0.004 + seed) * 0.9 + (rnd() - 0.5) * rough); pts.push([x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.0021 + seed * 2.1)) * (0.65 + 0.35 * Math.sin(x * 0.009 + seed)) + y - base]); } return pts; };
      const draw = (pts, fill) => { g.beginPath(); g.moveTo(0, h); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(w, h); g.closePath(); g.fillStyle = fill; g.fill(); };
      const far = ridge(330, 230, 2.2, 1.2); draw(far, "#8a99ad");
      g.save(); g.beginPath(); g.moveTo(0, h); far.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(w, h); g.clip();
      g.fillStyle = "rgba(244,246,250,.85)"; far.forEach(([x, y]) => { if (y < 190) { g.beginPath(); g.moveTo(x - 14, y + 26 + rnd() * 18); g.lineTo(x, y - 1); g.lineTo(x + 14, y + 26 + rnd() * 18); g.fill(); } }); g.restore();
      draw(ridge(420, 120, 1.6, 4.4), "#6f7f78"); draw(ridge(470, 50, 1, 2.7), "#5d6b55");
    }),
  };

  // ---------------- sky shader (gradient, sun, moving clouds) ----------------
  const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
  const SKY_FS = `
    uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTime; uniform float uCover;
    varying vec3 vDir;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
    float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }
    void main(){
      vec3 d = normalize(vDir); float y = clamp(d.y, -0.2, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(clamp(y,0.0,1.0), 0.55));
      col = mix(col, uHorizon*0.92, smoothstep(0.02,-0.2,y));
      float sd = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSunCol * (pow(sd, 900.0)*6.0 + pow(sd, 18.0)*0.35 + pow(sd,4.0)*0.12);
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime*1.2, uTime*0.35);
        float c = fbm(uv) * 0.75 + fbm(uv*2.7 - uTime*0.6) * 0.35;
        float m = smoothstep(1.0-uCover, 1.0-uCover+0.32, c) * smoothstep(0.0, 0.22, d.y);
        vec3 cc = mix(vec3(0.78,0.8,0.84), vec3(1.0), clamp(c-0.4,0.0,1.0)) * (0.65 + 0.5*uSunCol);
        col = mix(col, cc, m*0.85);
      }
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`;

  // time-of-day keys for the time-lapse (morning → midday → golden hour)
  const DAY = [
    { t: 0, sun: [0.55, 0.62, -0.56], sunCol: 0xffe4c4, sunI: 1.75, zen: 0x5d8fc6, hor: 0xc9d8e6, hemiS: 0xaec6df, hemiG: 0x5e5a46, hemiI: 0.42, exp: 0.95 },
    { t: 0.5, sun: [0.12, 0.95, 0.28], sunCol: 0xfff3e2, sunI: 1.72, zen: 0x4f84c2, hor: 0xc8d9e8, hemiS: 0xb4cbe3, hemiG: 0x605e46, hemiI: 0.45, exp: 0.95 },
    { t: 1, sun: [-0.78, 0.26, 0.58], sunCol: 0xffa65c, sunI: 1.62, zen: 0x557caf, hor: 0xeab98a, hemiS: 0xd4b79a, hemiG: 0x4e4434, hemiI: 0.36, exp: 1.0 },
  ];

  function create(container, opts = {}) {
    if (!T || !window.WebGLRenderingContext) throw new Error("WebGL unavailable");
    const mobile = matchMedia("(max-width: 900px)").matches || /Mobi|Android/i.test(navigator.userAgent);
    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: !!opts.preserve });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    container.appendChild(renderer.domElement);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new T.Scene();
    scene.fog = new T.Fog(0xc9d8e6, 110, 560);
    const camera = new T.PerspectiveCamera(30, 1, 0.5, 900);

    // ---- sky + env ----
    const skyU = { uZenith: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uSunDir: { value: new T.Vector3() }, uSunCol: { value: new T.Color() }, uTime: { value: 0 }, uCover: { value: 0.42 } };
    const skyMat = new T.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, fog: false });
    const sky = new T.Mesh(new T.SphereGeometry(600, 48, 24), skyMat); sky.renderOrder = -1; scene.add(sky);
    const envScene = new T.Scene(); const envSky = new T.Mesh(sky.geometry, skyMat); envScene.add(envSky);
    const pmrem = new T.PMREMGenerator(renderer); let envRT = null, envKey = -1;

    // ---- lights ----
    const hemi = new T.HemisphereLight(0xffffff, 0x666655, 0.7); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 2.5); sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 80 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    // ---- materials ----
    const M = (o) => new T.MeshStandardMaterial(o);
    const sidingTex = tex(TX.siding(), [1, 1], true, aniso), woodTex = tex(TX.wood(), [1, 1], true, aniso), osbTex = tex(TX.osb(), [1, 1], true, aniso);
    const underTex = tex(TX.under(), [1, 1], true, aniso), stoneTex = tex(TX.stone(), [1, 1], true, aniso), concTex = tex(TX.concrete(), [1, 1], true, aniso);
    const grassTex = tex(TX.grass(), [90, 90], true, aniso), dirtTex = tex(TX.dirt(), [1, 1], true, aniso);
    const withRep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; };
    const mat = {
      siding: M({ map: sidingTex, roughness: 0.82 }),
      trim: M({ color: 0xf2efe8, roughness: 0.6 }),
      wood: M({ map: woodTex, roughness: 0.78 }),
      osb: M({ map: osbTex, roughness: 0.9 }),
      under: M({ map: underTex, roughness: 0.72, metalness: 0.05 }),
      roll: M({ color: 0x3a3f46, roughness: 0.6 }),
      panel: M({ color: PALETTE.charcoal.c, metalness: 0.28, roughness: 0.4, envMapIntensity: 0.9 }),
      seam: M({ color: PALETTE.charcoal.c, metalness: 0.28, roughness: 0.34, envMapIntensity: 1.0 }),
      metalTrim: M({ color: PALETTE.charcoal.trim, metalness: 0.7, roughness: 0.36, envMapIntensity: 1.1 }),
      stone: M({ map: stoneTex, roughness: 0.92 }),
      cap: M({ color: 0x55524e, roughness: 0.8 }),
      found: M({ map: concTex, color: 0x9a958c, roughness: 0.95 }),
      conc: M({ map: withRep(concTex, 6, 6), roughness: 0.95 }),
      glass: new T.MeshPhysicalMaterial({ color: 0x1b2631, metalness: 0.1, roughness: 0.05, envMapIntensity: 1.6, emissive: 0xffb15e, emissiveIntensity: 0, clearcoat: 1 }),
      door: M({ color: 0x2c3c46, roughness: 0.55 }),
      grass: M({ map: grassTex, roughness: 1 }),
      dirt: M({ map: dirtTex, roughness: 1, transparent: true, depthWrite: false }),
      pine: M({ color: 0x2f4a36, roughness: 0.9, flatShading: true }),
      pine2: M({ color: 0x3b5a40, roughness: 0.9, flatShading: true }),
      aspen: M({ color: 0xd8a62b, roughness: 0.85, flatShading: true }),
      bark: M({ color: 0x5a4433, roughness: 1 }), birch: M({ color: 0xe7e2d6, roughness: 0.9 }),
      shrub: M({ color: 0x4f6a3b, roughness: 0.9, flatShading: true }), mulch: M({ color: 0x4a3426, roughness: 1 }),
      dumpster: M({ color: 0x2f4f45, roughness: 0.6, metalness: 0.3 }), pallet: M({ map: woodTex, color: 0xd8c4a0, roughness: 0.9 }),
      ladder: M({ color: 0xc2c6ca, metalness: 0.6, roughness: 0.4 }), lamp: M({ color: 0x222222, emissive: 0xffc77a, emissiveIntensity: 0 }),
      mtn: new T.MeshBasicMaterial({ map: tex(TX.mountains(), [1, 1], true, aniso), transparent: true, depthWrite: false, fog: true }),
    };

    // geometry helpers
    const mesh = (geo, m, cast = true, recv = true) => { const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; };
    const box = (w, h, d, m, cast, recv) => mesh(new T.BoxGeometry(w, h, d), m, cast, recv);
    const boxUV = (w, h, d, m, scale = 1) => { // box with UVs in metres (texture repeats by size)
      const g = new T.BoxGeometry(w, h, d); const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
        if (nx > 0.5) uv.setXY(i, z * scale, y * scale); else if (ny > 0.5) uv.setXY(i, x * scale, z * scale); else uv.setXY(i, x * scale, y * scale); }
      return mesh(g, m);
    };
    const root = new T.Group(); scene.add(root);

    // ---------------- site ----------------
    const ground = mesh(new T.PlaneGeometry(700, 700), mat.grass, false, true); ground.rotation.x = -Math.PI / 2; root.add(ground);
    const dirt = mesh(new T.PlaneGeometry(30, 26), mat.dirt, false, true); dirt.rotation.x = -Math.PI / 2; dirt.position.set(0.5, 0.012, 1.4); root.add(dirt);
    const drive = boxUV(4, 0.04, 22, mat.conc, 0.5); drive.position.set(9.4, 0.02, 13.5); drive.castShadow = false; root.add(drive);
    const walk = boxUV(1.3, 0.035, 9, mat.conc, 0.5); walk.position.set(-1.2, 0.018, W / 2 + 5); walk.castShadow = false; root.add(walk);
    mat.mtn.map.wrapS = T.MirroredRepeatWrapping; mat.mtn.map.repeat.set(3, 1); mat.mtn.side = T.BackSide; const mtn = new T.Mesh(new T.CylinderGeometry(430, 430, 300, 64, 1, true, Math.PI * 0.3, Math.PI * 1.4), mat.mtn); mtn.position.set(0, 62, 0); root.add(mtn);

    // ---------------- house shell ----------------
    const house = new T.Group(); root.add(house);
    const found = boxUV(L + 0.3, 0.5, W + 0.3, mat.found, 1); found.position.y = 0.25; house.add(found);
    const wallF = boxUV(L, H, 0.2, mat.siding); wallF.position.set(0, H / 2 + 0.5 - 0.5, W / 2 - 0.1); house.add(wallF);
    const wallB = wallF.clone(); wallB.position.z = -W / 2 + 0.1; house.add(wallB);
    const gshape = new T.Shape([new T.Vector2(-W / 2, 0), new T.Vector2(W / 2, 0), new T.Vector2(W / 2, H), new T.Vector2(0, H + R - 0.02), new T.Vector2(-W / 2, H)]);
    const gGeo = new T.ExtrudeGeometry(gshape, { depth: 0.2, bevelEnabled: false });
    [-1, 1].forEach((sgn) => { const g = mesh(gGeo, mat.siding); g.rotation.y = Math.PI / 2; g.position.set(sgn * (L / 2) - (sgn > 0 ? 0.2 : 0), 0, 0); house.add(g); });
    // corner boards
    [[-L / 2, W / 2], [L / 2, W / 2], [-L / 2, -W / 2], [L / 2, -W / 2]].forEach(([x, z]) => { const c = box(0.14, H - 0.45, 0.14, mat.trim); c.position.set(x, H / 2 + 0.22, z); house.add(c); });
    // ceiling joists + top plates (exposed structure at the start)
    const joists = new T.InstancedMesh(new T.BoxGeometry(0.05, 0.2, W - 1.4), mat.wood, 21); joists.castShadow = joists.receiveShadow = true;
    { const m4 = new T.Matrix4(); for (let i = 0; i < 21; i++) { m4.makeTranslation(-L / 2 + 0.1 + i * ((L - 0.2) / 20), H + 0.1, 0); joists.setMatrixAt(i, m4); } } house.add(joists);
    [W / 2 - 0.1, -W / 2 + 0.1].forEach((z) => { const tp = box(L, 0.1, 0.2, mat.wood); tp.position.set(0, H - 0.05, z); house.add(tp); });
    // windows, door, porch light
    const glow = [];
    function windowAt(x, y, z, w, h, rotY = 0) {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
      const fr = box(w + 0.18, h + 0.18, 0.08, mat.trim); fr.position.z = 0.03; g.add(fr);
      const gl = box(w, h, 0.03, mat.glass, false, true); gl.position.z = 0.075; g.add(gl);
      const mv = box(0.05, h, 0.04, mat.trim, false); mv.position.z = 0.095; g.add(mv);
      const mh = box(w, 0.05, 0.04, mat.trim, false); mh.position.z = 0.095; g.add(mh);
      const sill = box(w + 0.32, 0.06, 0.16, mat.trim); sill.position.set(0, -h / 2 - 0.1, 0.07); g.add(sill);
      house.add(g);
    }
    [[-4.1, 1.6, 1.5, 1.35], [1.7, 1.6, 1.5, 1.35], [4.2, 1.6, 1.2, 1.35]].forEach(([x, y, w, h]) => windowAt(x, y, W / 2, w, h));
    [[-2.6, 1.6, 1.4, 1.3], [2.2, 1.6, 1.4, 1.3]].forEach(([x, y, w, h]) => windowAt(x, y, -W / 2, w, h, Math.PI));
    windowAt(-L / 2, 1.6, -0.9, 1.3, 1.3, -Math.PI / 2); windowAt(-L / 2, 1.6, 1.9, 1.0, 1.3, -Math.PI / 2); windowAt(-L / 2, H + 0.9, 0, 0.7, 0.55, -Math.PI / 2);
    windowAt(L / 2, 1.6, 0.5, 1.3, 1.3, Math.PI / 2);
    { const df = box(1.15, 2.3, 0.08, mat.trim); df.position.set(-1.2, 0.5 + 1.1, W / 2 + 0.03); house.add(df);
      const dr = box(0.95, 2.15, 0.06, mat.door); dr.position.set(-1.2, 0.5 + 1.05, W / 2 + 0.07); house.add(dr);
      const lamp = box(0.12, 0.22, 0.1, mat.lamp, false); lamp.position.set(-0.45, 2.25, W / 2 + 0.1); house.add(lamp);
      const step = boxUV(1.6, 0.25, 0.8, mat.conc, 1); step.position.set(-1.2, 0.125, W / 2 + 0.4); house.add(step); }
    const porchLight = new T.PointLight(0xffb86b, 0, 6, 2); porchLight.position.set(-0.45, 2.1, W / 2 + 0.5); house.add(porchLight);

    // ---------------- roof planes (local frame: x along ridge, y outward normal, z down-slope) ----------------
    const planes = [0, 1].map((back) => { const g = new T.Group(); g.position.set(0, RIDGE_Y, 0); g.rotation.order = "YXZ"; g.rotation.set(ALPHA, back ? Math.PI : 0, 0); house.add(g); return g; });
    const m4 = new T.Matrix4(), q0 = new T.Quaternion(), v3 = new T.Vector3(), s3 = new T.Vector3();
    const setI = (im, i, x, y, z, sx = 1, sy = 1, sz = 1) => { v3.set(x, y, z); s3.set(sx, sy, sz); m4.compose(v3, q0, s3); im.setMatrixAt(i, m4); };
    const inst = (geo, m, n, parent) => { const im = new T.InstancedMesh(geo, m, n); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; parent.add(im); return im; };
    const RAF_X = []; for (let i = 0; i <= 20; i++) RAF_X.push(-L / 2 + 0.05 + i * ((L - 0.1) / 20));
    const DC = 6, DR = 5, NP = 26, PW = XL / NP;
    const P = planes.map((g, back) => {
      const raf = inst(new T.BoxGeometry(0.05, 0.24, S), mat.wood, RAF_X.length, g);
      const deck = inst(new T.BoxGeometry(XL / DC - 0.006, 0.018, S / DR - 0.006), mat.osb, DC * DR, g);
      const col = new T.Color(); for (let i = 0; i < DC * DR; i++) { col.setHSL(0.09, 0.42, 0.52 + (rnd() - 0.5) * 0.08); deck.setColorAt(i, col); }
      const deckCols = deck.instanceColor.array.slice();
      const rows = [0, 1, 2].map((k) => { const rh = S / 3 + 0.12; const geo = new T.PlaneGeometry(XL, rh); geo.rotateX(-Math.PI / 2); geo.translate(XL / 2, 0, 0);
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * XL / 1.0, uv.getY(i) * rh / 1.0);
        const m = mesh(geo, mat.under, false, true); m.position.set(-XL / 2, 0.026 + k * 0.002, S - (k + 0.5) * (S / 3)); g.add(m);
        const roll = mesh(new T.CylinderGeometry(0.11, 0.11, rh - 0.05, 20), mat.roll); roll.geometry.rotateX(Math.PI / 2); roll.position.set(0, 0.14, m.position.z); g.add(roll);
        return { m, roll }; });
      const panels = inst(new T.BoxGeometry(PW - 0.01, 0.014, S + 0.06), mat.panel, NP, g);
      const seams = inst(new T.BoxGeometry(0.024, 0.05, S + 0.06), mat.seam, NP + 1, g);
      const capGeo = new T.BoxGeometry(XL + 0.04, 0.012, 0.24); capGeo.translate((XL + 0.04) / 2, 0, 0);
      const cap = mesh(capGeo, mat.metalTrim); cap.position.set(-XL / 2 - 0.02, 0.07, 0.1); g.add(cap);
      const rakes = [-1, 1].map((sgn) => { const r = box(0.035, 0.22, S + 0.02, mat.wood); r.position.set(sgn * (XL / 2), -0.09, S / 2); g.add(r);
        const rt = box(0.03, 0.12, S + 0.06, mat.metalTrim); rt.position.set(sgn * (XL / 2 + 0.03), 0.01, S / 2 + 0.01); g.add(rt); return { r, rt }; });
      const fascia = box(XL + 0.07, 0.22, 0.035, mat.wood); fascia.position.set(0, -0.09, S); fascia.rotation.x = -ALPHA; g.add(fascia);
      const drip = box(XL + 0.08, 0.1, 0.03, mat.metalTrim); drip.position.set(0, 0.0, S + 0.03); g.add(drip);
      return { raf, deck, deckCols, fin: false, rows, panels, seams, cap, rakes, fascia, drip, back };
    });
    // ridge board
    const ridge = box(L + 0.3, 0.3, 0.05, mat.wood); ridge.position.set(0, RIDGE_Y - 0.16, 0); house.add(ridge);
    // chimney
    const chimH = CH.top - H;
    const chim = boxUV(CH.w, chimH, CH.d, mat.stone, 0.9); chim.position.set(CH.x, H + chimH / 2, CH.z); house.add(chim);
    const chimCap = box(CH.w + 0.16, 0.12, CH.d + 0.16, mat.cap); chimCap.position.set(CH.x, CH.top + 0.06, CH.z); house.add(chimCap);
    // chimney flashing (front plane local coords)
    const zl = (zw) => zw / CA, flash = new T.Group(); planes[0].add(flash);
    { const z0 = zl(CH.z - CH.d / 2), z1 = zl(CH.z + CH.d / 2);
      const apron = box(CH.w + 0.3, 0.02, 0.32, mat.metalTrim); apron.position.set(CH.x, 0.07, z1 + 0.12); flash.add(apron);
      const crick = box(CH.w + 0.3, 0.02, 0.32, mat.metalTrim); crick.position.set(CH.x, 0.07, z0 - 0.12); flash.add(crick);
      [-1, 1].forEach((s) => { const st = box(0.16, 0.02, z1 - z0 + 0.3, mat.metalTrim); st.position.set(CH.x + s * (CH.w / 2 + 0.07), 0.07, (z0 + z1) / 2); flash.add(st); }); }
    const counter = box(CH.w + 0.04, 0.22, CH.d + 0.04, mat.metalTrim); counter.position.set(CH.x, RIDGE_Y - CH.z * SLOPE + 0.12, CH.z); house.add(counter);
    // gutters + downspouts (world)
    const gutGeo = new T.CylinderGeometry(0.085, 0.085, XL, 14, 1, true, Math.PI / 2, Math.PI); gutGeo.rotateZ(Math.PI / 2); gutGeo.translate(XL / 2, 0, 0);
    const gutMat = mat.metalTrim.clone(); gutMat.side = T.DoubleSide;
    const gutters = [1, -1].map((sz) => { const gg = mesh(gutGeo, gutMat); gg.position.set(-XL / 2, EAVE_Y - 0.17, sz * (EAVE_Z + 0.07)); house.add(gg); return gg; });
    const spouts = [[-L / 2 + 0.25, 1], [L / 2 - 0.25, 1], [L / 2 - 0.25, -1]].map(([x, sz]) => { const geo = new T.BoxGeometry(0.1, 1, 0.08); geo.translate(0, -0.5, 0); const d = mesh(geo, mat.metalTrim); d.position.set(x, EAVE_Y - 0.2, sz * (W / 2 + 0.07)); house.add(d); return d; });

    // ---------------- landscaping + construction props ----------------
    const conifer = (x, z, h, m = mat.pine) => { const g = new T.Group(); const tiers = 5; for (let i = 0; i < tiers; i++) { const r = (1 - i / tiers) * h * 0.24 + 0.15, ch = h * 0.34; const geo = new T.ConeGeometry(r, ch, 9, 2); const pos = geo.attributes.position; for (let k = 0; k < pos.count; k++) { pos.setX(k, pos.getX(k) * (0.88 + rnd() * 0.24)); pos.setZ(k, pos.getZ(k) * (0.88 + rnd() * 0.24)); } geo.computeVertexNormals(); const c = mesh(geo, m); c.position.y = h * 0.18 + i * h * 0.16 + ch / 2; c.rotation.y = rnd() * 6; g.add(c); } const tr = mesh(new T.CylinderGeometry(0.12, 0.16, h * 0.25, 6), mat.bark); tr.position.y = h * 0.12; g.add(tr); g.position.set(x, 0, z); root.add(g); return g; };
    const aspen = (x, z, h) => { const g = new T.Group(); const tr = mesh(new T.CylinderGeometry(0.08, 0.12, h, 7), mat.birch); tr.position.y = h / 2; g.add(tr); for (let i = 0; i < 5; i++) { const geo = new T.IcosahedronGeometry(0.9 + rnd() * 0.6, 1); const pos = geo.attributes.position; for (let k = 0; k < pos.count; k++) pos.setXYZ(k, pos.getX(k) * (0.85 + rnd() * 0.3), pos.getY(k) * (0.85 + rnd() * 0.3), pos.getZ(k) * (0.85 + rnd() * 0.3)); geo.computeVertexNormals(); const c = mesh(geo, mat.aspen); c.position.set((rnd() - 0.5) * 1.4, h * 0.72 + (rnd() - 0.2) * 1.2, (rnd() - 0.5) * 1.4); g.add(c); } g.position.set(x, 0, z); root.add(g); return g; };
    conifer(-11, -7, 10); conifer(-14.5, -1, 8, mat.pine2); conifer(10.5, -9, 12); conifer(15, -3.5, 9, mat.pine2); conifer(-7, -13, 11); conifer(4, -14, 9.5, mat.pine2); conifer(19, -12, 11);
    aspen(-15.5, -3.5, 5.6); aspen(-17.5, 0.5, 5); aspen(15.5, 0.5, 5.2);
    const shrubs = []; const shrub = (x, z, r) => { const geo = new T.IcosahedronGeometry(r, 1); const pos = geo.attributes.position; for (let k = 0; k < pos.count; k++) pos.setXYZ(k, pos.getX(k) * (0.85 + rnd() * 0.3), pos.getY(k) * 0.75, pos.getZ(k) * (0.85 + rnd() * 0.3)); geo.computeVertexNormals(); const s = mesh(geo, mat.shrub); s.position.set(x, r * 0.5, z); root.add(s); shrubs.push(s); };
    [[-5.2, W / 2 + 0.9, 0.6], [-3.4, W / 2 + 0.85, 0.5], [0.5, W / 2 + 0.9, 0.55], [2.6, W / 2 + 0.85, 0.6], [4.6, W / 2 + 0.9, 0.5], [-L / 2 - 1, 2.6, 0.65], [-L / 2 - 0.9, -1.4, 0.55], [-L / 2 - 1, -3.2, 0.5]].forEach(([x, z, r]) => shrub(x, z, r));
    const beds = [[0, W / 2 + 0.95, L - 0.6, 1.1], [-L / 2 - 0.95, 0, 1.1, W - 0.6]].map(([x, z, w, d]) => { const b = box(w, 0.04, d, mat.mulch, false, true); b.position.set(x, 0.02, z); root.add(b); return b; });
    // props
    const props = new T.Group(); root.add(props);
    const lumber = new T.Group(); lumber.position.set(7.8, 0, 6.6); props.add(lumber);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { const b = box(4.2, 0.24, 0.06, mat.wood); b.position.set(0, 0.16 + i * 0.25, -0.2 + j * 0.08); lumber.add(b); }
    const pal1 = box(1.3, 0.14, 1.1, mat.pallet); pal1.position.set(7.8, 0.07, 9.1); props.add(pal1);
    const rolls = []; for (let i = 0; i < 6; i++) { const r = mesh(new T.CylinderGeometry(0.13, 0.13, 1.0, 16), mat.roll); r.rotation.z = Math.PI / 2; r.position.set(7.8, 0.27 + (i % 2) * 0.24, 8.75 + ((i / 2) | 0) * 0.28); props.add(r); rolls.push(r); }
    const pal2 = box(6.8, 0.14, 1.2, mat.pallet); pal2.position.set(1.6, 0.07, 9.6); props.add(pal2);
    const stack = box(6.6, 1, 0.55, mat.panel); stack.geometry.translate(0, 0.5, 0); stack.position.set(1.6, 0.14, 9.6); props.add(stack);
    const dumpster = box(2.4, 1.3, 4.4, mat.dumpster); dumpster.position.set(9.6, 0.65, 4.2); props.add(dumpster);
    const ladder = new T.Group(); [-0.22, 0.22].forEach((x) => { const r = box(0.06, 4.2, 0.06, mat.ladder); r.position.set(x, 2.1, 0); ladder.add(r); }); for (let i = 0; i < 12; i++) { const r = box(0.44, 0.04, 0.04, mat.ladder); r.position.set(0, 0.3 + i * 0.32, 0); ladder.add(r); }
    ladder.position.set(-4.1 + 1.6, 0, W / 2 + 0.95); ladder.rotation.x = -0.22; props.add(ladder);

    // ---------------- state & animation ----------------
    const st = { p: opts.progress ?? 1, color: opts.color || "charcoal", finish: opts.finish || "satin", look: opts.look || null, camOverride: opts.cam || null };
    const cA = new T.Color(), cB = new T.Color();
    const lerpCol = (a, b, t) => cA.set(a).lerp(cB.set(b), t).clone();
    function dayAt(t) { const k = t < 0.5 ? 0 : 1, A = DAY[k], B = DAY[k + 1], u = (t - A.t) / (B.t - A.t);
      return { sun: new T.Vector3().fromArray(A.sun).lerp(new T.Vector3().fromArray(B.sun), u).normalize(), sunCol: lerpCol(A.sunCol, B.sunCol, u), sunI: lerp(A.sunI, B.sunI, u), zen: lerpCol(A.zen, B.zen, u), hor: lerpCol(A.hor, B.hor, u), hemiS: lerpCol(A.hemiS, B.hemiS, u), hemiG: lerpCol(A.hemiG, B.hemiG, u), hemiI: lerp(A.hemiI, B.hemiI, u), exp: lerp(A.exp, B.exp, u) }; }
    const CAM = [{ pos: [-16.1, 8.8, 18.6], tgt: [0, 2.5, 0], fov: 30 }, { pos: [-13.3, 4.5, 15.8], tgt: [0.2, 2.25, 0.6], fov: 31 }];
    let aspect = 1;

    function applyMaterialChoice() {
      const pal = PALETTE[st.color] || PALETTE.charcoal, satin = st.finish === "satin";
      const metal = pal.metal ?? 0.3, rough = (pal.rough ?? 0.48) + (satin ? 0 : 0.16);
      for (const m of [mat.panel, mat.seam]) { m.color.setHex(pal.c).convertSRGBToLinear(); m.metalness = metal; m.roughness = m === mat.seam ? rough - 0.08 : rough; m.envMapIntensity = pal.metal ? 0.8 : 0.42; }
      stack.material = mat.panel;
      mat.metalTrim.color.setHex(pal.trim).convertSRGBToLinear(); mat.metalTrim.metalness = metal; mat.metalTrim.roughness = rough; gutMat.color.setHex(pal.trim).convertSRGBToLinear(); gutMat.metalness = metal; gutMat.roughness = rough;
    }

    function update() {
      const p = clamp(st.p);
      // time of day: the time-lapse runs morning → golden hour across the whole build
      const day = dayAt(st.look === "golden" ? 1 : st.look === "midday" ? 0.5 : st.look === "morning" ? 0 : p);
      sun.position.copy(day.sun).multiplyScalar(40); sun.target.position.set(0, 0, 0); sun.color.copy(day.sunCol); sun.intensity = day.sunI;
      hemi.color.copy(day.hemiS); hemi.groundColor.copy(day.hemiG); hemi.intensity = day.hemiI;
      skyU.uZenith.value.copy(day.zen); skyU.uHorizon.value.copy(day.hor); skyU.uSunDir.value.copy(day.sun); skyU.uSunCol.value.copy(day.sunCol); skyU.uTime.value = (st.look ? 0.4 : p) * 3.2;
      scene.fog.color.copy(day.hor).multiplyScalar(0.92); renderer.toneMappingExposure = day.exp;
      const key = Math.round((st.look ? 7 : p) * 14); if (key !== envKey) { envKey = key; if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0.04); for (const m of [mat.panel, mat.seam, mat.metalTrim, gutMat, mat.glass, mat.ladder, mat.dumpster, stack.material]) { m.envMap = envRT.texture; m.needsUpdate = true; } }
      const golden = st.look === "golden" ? 1 : st.look ? 0 : seg(p, 0.86, 1);
      mat.glass.emissiveIntensity = golden * 0.55; mat.lamp.emissiveIntensity = golden * 2.2; porchLight.intensity = golden * 1.4;

      // camera: locked tripod, settles closer at the end
      const c = st.camOverride || (() => { const t = eio(seg(p, 0.84, 1)); return { pos: new T.Vector3().fromArray(CAM[0].pos).lerp(new T.Vector3().fromArray(CAM[1].pos), t), tgt: new T.Vector3().fromArray(CAM[0].tgt).lerp(new T.Vector3().fromArray(CAM[1].tgt), t), fov: lerp(CAM[0].fov, CAM[1].fov, t) }; })();
      // keep the whole house in frame on narrow or square stages: dolly back along the view line
      const fit = st.camOverride ? 1 : Math.pow(Math.max(1, 1.8 / aspect), 0.8), tall = aspect < 0.8 ? (0.8 - aspect) * 10 : 0;
      camera.position.copy(c.pos).sub(c.tgt).multiplyScalar(fit).add(c.tgt); camera.fov = c.fov + tall; camera.updateProjectionMatrix(); camera.lookAt(c.tgt);

      // ---- framing & deck ----
      const fr = seg(p, 0, 0.16), dk = seg(p, 0.13, 0.22);
      { const e = eout(seg(fr, 0, 0.18)); ridge.visible = e > 0; ridge.scale.x = Math.max(e, 0.001); }
      P.forEach((pl) => {
        RAF_X.forEach((x, i) => { const e = eout(seg(fr, 0.08 + i * 0.03 + pl.back * 0.012, 0.2 + i * 0.03 + pl.back * 0.012)); setI(pl.raf, i, x, -0.13 + (1 - e) * 0.6, S / 2, 1, e > 0 ? 1 : 1e-4, 1); });
        pl.raf.instanceMatrix.needsUpdate = true;
        let k = 0; for (let r = DR - 1; r >= 0; r--) for (let cc = 0; cc < DC; cc++, k++) { const e = eout(seg(dk, (k / (DC * DR)) * 0.75, (k / (DC * DR)) * 0.75 + 0.18)); setI(pl.deck, k, -XL / 2 + (cc + 0.5) * (XL / DC), 0.009 + (1 - e) * 0.35, (r + 0.5) * (S / DR), 1, 1, e > 0 ? 1 : 1e-4); }
        pl.deck.instanceMatrix.needsUpdate = true;
        // once the roof is finished, the deck underside under the overhangs reads as painted soffit, not raw OSB
        { const fin = p > 0.9; if (pl.fin !== fin) { pl.fin = fin; pl.deck.material = fin ? mat.trim : mat.osb; if (fin) pl.deck.instanceColor.array.fill(1); else pl.deck.instanceColor.array.set(pl.deckCols); pl.deck.instanceColor.needsUpdate = true; } }
        const bi = eout(seg(fr, 0.75, 1)); pl.fascia.visible = bi > 0; pl.rakes.forEach((r) => (r.r.visible = bi > 0));
        // underlayment rolls out in three courses, eave first
        const ul = seg(p, 0.22, 0.40);
        pl.rows.forEach((row, kk) => { const e = eio(seg(ul, kk * 0.3 + pl.back * 0.04, kk * 0.3 + 0.36 + pl.back * 0.04)); row.m.visible = e > 0.002; row.m.scale.x = Math.max(e, 0.002); row.roll.visible = e > 0 && e < 1; row.roll.position.x = -XL / 2 + e * XL; row.roll.rotation.y = 0; });
        // panels slide down from the ridge, one by one
        const ps = seg(p, 0.40, 0.70), dur = 0.12, step = (1 - dur) / (NP - 1);
        for (let i = 0; i < NP; i++) { const e = eout(seg(ps, i * step + pl.back * 0.015, i * step + dur + pl.back * 0.015)), x = -XL / 2 + (i + 0.5) * PW, on = e > 0 ? 1 : 1e-4;
          setI(pl.panels, i, x, 0.042 + (1 - e) * 0.25, S / 2 + 0.01 - (1 - e) * 1.4, on, on, on); setI(pl.seams, i, x - PW / 2, 0.06 + (1 - e) * 0.25, S / 2 + 0.01 - (1 - e) * 1.4, on, on, on); }
        { const e = seg(ps, 1 - 0.05, 1); setI(pl.seams, NP, XL / 2 - 0.01, 0.06, S / 2 + 0.01, e > 0 ? 1 : 1e-4, e > 0 ? 1 : 1e-4, 1); }
        pl.panels.instanceMatrix.needsUpdate = true; pl.seams.instanceMatrix.needsUpdate = true;
        // trim stage
        const rc = eio(seg(p, 0.70, 0.765)); pl.cap.visible = rc > 0; pl.cap.scale.x = Math.max(rc, 0.001);
        const tr = seg(p, 0.72, 0.78); pl.rakes.forEach((r) => (r.rt.visible = tr > 0)); pl.drip.visible = tr > 0;
        pl.fascia.material = tr > 0.5 ? mat.metalTrim : mat.wood; pl.rakes.forEach((r) => (r.r.material = tr > 0.5 ? mat.metalTrim : mat.wood));
      });
      flash.visible = counter.visible = p > 0.745;
      const gu = eio(seg(p, 0.77, 0.83)); gutters.forEach((g) => { g.visible = gu > 0; g.scale.x = Math.max(gu, 0.001); });
      const sp = eio(seg(p, 0.80, 0.845)); spouts.forEach((d) => { d.visible = sp > 0; d.scale.y = Math.max(sp, 0.001) * (EAVE_Y - 0.2); });
      // site: material stacks shrink as they are installed; cleanup and landscaping at the end
      const clean = seg(p, 0.85, 0.93);
      lumber.visible = clean < 0.35; lumber.children.forEach((b, i) => (b.visible = i / lumber.children.length >= seg(p, 0.0, 0.16) * 0.92));
      rolls.forEach((r, i) => (r.visible = i >= Math.round(seg(p, 0.22, 0.4) * 6) && clean < 0.5));
      stack.scale.y = Math.max(0.02, 0.62 * (1 - seg(p, 0.40, 0.70))); stack.visible = p < 0.705;
      pal1.visible = clean < 0.65; pal2.visible = clean < 0.8; dumpster.visible = clean < 0.6; ladder.visible = clean < 0.3;
      mat.dirt.opacity = 1 - seg(p, 0.86, 0.95);
      const gr = eout(seg(p, 0.88, 0.97)); shrubs.forEach((s) => s.scale.setScalar(Math.max(gr, 0.001))); beds.forEach((b) => (b.visible = gr > 0));
    }

    let raf = 0;
    const render = () => { update(); renderer.render(scene, camera); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
    function resize() { const w = container.clientWidth || 800, h = container.clientHeight || 600; aspect = w / h; renderer.setSize(w, h, false); camera.aspect = aspect; camera.updateProjectionMatrix(); render(); }
    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null; if (ro) ro.observe(container); else addEventListener("resize", resize);
    applyMaterialChoice(); resize();

    return {
      set(p) { st.p = p; schedule(); }, renderNow(p) { if (p !== undefined) st.p = p; render(); },
      setColor(c) { st.color = c; applyMaterialChoice(); schedule(); }, setFinish(f) { st.finish = f; applyMaterialChoice(); schedule(); },
      setView(v = {}) { st.look = v.look || null; st.camOverride = v.cam ? { pos: new T.Vector3().fromArray(v.cam.pos), tgt: new T.Vector3().fromArray(v.cam.tgt), fov: v.cam.fov || 30 } : null; envKey = -1; schedule(); },
      resize,
      get p() { return st.p; }, canvas: renderer.domElement,
      snapshot(type = "image/jpeg", q = 0.86) { render(); return renderer.domElement.toDataURL(type, q); },
    };
  }

  window.PeaklineRoof3D = { create, PALETTE, STAGES };
})();
