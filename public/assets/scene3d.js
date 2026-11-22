/* Cena 3D do portfólio: forma orgânica com shader, serviços orbitando, partículas e câmera por seção.
   API: Scene3D.init(canvas) -> { section(id), colors(hue), pulse() } */
window.Scene3D = (function () {
'use strict';

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = NOISE + `
uniform float uTime,uAmp,uFreq,uPulse,uHover;
uniform vec3 uMouse;
varying float vNoise;varying vec3 vN;varying vec3 vV;
void main(){
  vec3 p=position;
  float n=snoise(p*uFreq+vec3(uTime*.32));
  float n2=snoise(p*uFreq*2.3-vec3(uTime*.21))*.35;
  float m=smoothstep(1.1,0.,distance(normalize(p),uMouse))*uHover;
  float d=(n+n2)*uAmp+m*.32+uPulse*.18*sin(uTime*9.+p.y*6.);
  vNoise=n+m;
  vec3 np=p+normal*d;
  vec4 mv=modelViewMatrix*vec4(np,1.);
  vN=normalize(normalMatrix*normal);vV=-mv.xyz;
  gl_Position=projectionMatrix*mv;
}`;

const FRAG = `
uniform vec3 uA,uB;uniform float uWire,uAlpha;
varying float vNoise;varying vec3 vN;varying vec3 vV;
void main(){
  float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.3);
  vec3 c=mix(uA,uB,smoothstep(-.55,.85,vNoise));
  if(uWire>.5){gl_FragColor=vec4(c*1.25,(.10+f*.55)*uAlpha);return;}
  vec3 col=c*.12+vec3(.02,.015,.05)+c*f*1.35+pow(f,7.)*.55;
  gl_FragColor=vec4(col,uAlpha);
}`;

function dot(size, inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function init(canvas, opts = {}) {
  if (!window.THREE || !canvas) return null;
  const vel0 = opts.calm ? 0.55 : 1; // quem pede menos animação recebe movimento mais suave, mas nunca parado
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { return null; }
  if (!renderer.getContext()) return null;
  const mobile = innerWidth < 860 || matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  document.documentElement.classList.add('tem-3d');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07060d, 0.035);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  camera.position.set(0, 0, 7);
  const group = new THREE.Group(); scene.add(group);

  const colA = new THREE.Color('#8b6bff'), colB = new THREE.Color('#4fe3ff');
  const U = {
    uTime: { value: 0 }, uAmp: { value: 0.22 }, uFreq: { value: 0.9 }, uPulse: { value: 0 }, uHover: { value: 0 },
    uMouse: { value: new THREE.Vector3(0, 0, 1) }, uA: { value: colA }, uB: { value: colB }, uWire: { value: 0 }, uAlpha: { value: 1 },
  };
  const geo = new THREE.IcosahedronGeometry(1.55, mobile ? 20 : 40);
  const blob = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, fog: false }));
  group.add(blob);
  const wireU = Object.assign({}, U, { uWire: { value: 1 }, uAlpha: { value: 1 } });
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, mobile ? 6 : 10),
    new THREE.ShaderMaterial({ uniforms: wireU, vertexShader: VERT, fragmentShader: FRAG, wireframe: true, transparent: true, depthWrite: false, fog: false }));
  group.add(wire);

  const glow = dot(256, 'rgba(255,255,255,.55)', 'rgba(255,255,255,0)');
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: colA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false }));
  halo.scale.setScalar(7); halo.position.z = -1.5; group.add(halo);

  const ringM = new THREE.MeshBasicMaterial({ color: colA, transparent: true, opacity: 0.5, fog: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.008, 6, 200), ringM);
  ring.rotation.x = Math.PI / 2.3; group.add(ring);
  const ring2M = new THREE.MeshBasicMaterial({ color: colB, transparent: true, opacity: 0.25, fog: false });
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.005, 6, 200), ring2M);
  ring2.rotation.set(Math.PI / 1.8, 0.4, 0); group.add(ring2);

  const GEOS = [
    () => new THREE.TorusKnotGeometry(0.16, 0.05, 64, 8), () => new THREE.BoxGeometry(0.3, 0.3, 0.3), () => new THREE.OctahedronGeometry(0.24),
    () => new THREE.TorusGeometry(0.18, 0.06, 10, 28), () => new THREE.DodecahedronGeometry(0.22), () => new THREE.TetrahedronGeometry(0.26), () => new THREE.IcosahedronGeometry(0.22, 0),
  ];
  function forma(i, escala, fog) {
    const g = GEOS[i % GEOS.length]();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: i % 2 ? colB : colA, wireframe: true, transparent: true, opacity: 0.95, fog }));
    const core = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x0b0918, fog }));
    core.scale.setScalar(0.92); m.add(core); m.scale.setScalar(escala);
    return m;
  }
  // serviços orbitando a forma principal
  const orbiters = [0, 1, 2, 3, 4].map((i) => {
    const m = forma(i, 1.15, false);
    m.userData = { r: 2.45 + (i % 3) * 0.42, sp: 0.22 + i * 0.045, ph: (i / 5) * Math.PI * 2, tilt: (i - 2) * 0.28, rs: 0.6 + i * 0.25 };
    group.add(m); return m;
  });

  // formas 3D espalhadas pela página: passam pela câmera enquanto você rola
  const RANGE = 26;
  const flutuantes = Array.from({ length: mobile ? 9 : 18 }, (_, i) => {
    const prof = Math.random();
    const lado = i % 2 ? 1 : -1;
    const m = forma(i + 2, 1.4 + prof * 2.2, true);
    m.userData = {
      x: lado * (mobile ? 1.4 + Math.random() * 1.6 : 3.2 + Math.random() * 4.5), z: -1 - prof * 12, base: (i / (mobile ? 9 : 18)) * RANGE,
      k: 0.006 + (1 - prof) * 0.01, rx: (Math.random() - 0.5) * 1.6, ry: (Math.random() - 0.5) * 1.6, ph: Math.random() * 6,
    };
    m.material.opacity = 0.55 + (1 - prof) * 0.4;
    scene.add(m); return m;
  });

  // ---------- formas clicáveis (caça às formas) ----------
  const alvos = flutuantes.concat(orbiters);
  alvos.forEach((o) => { o.userData.vivo = 1; o.userData.esc = o.scale.x; });
  const hitCbs = [], miraCbs = [];
  const bursts = [];
  function explode(pos, cor) {
    const n = 46, pp = new Float32Array(n * 3), vv = [];
    for (let i = 0; i < n; i++) { pp[i * 3] = pos.x; pp[i * 3 + 1] = pos.y; pp[i * 3 + 2] = pos.z; const a = Math.random() * 6.28, b = Math.acos(2 * Math.random() - 1), sp = 2 + Math.random() * 4; vv.push(Math.sin(b) * Math.cos(a) * sp, Math.sin(b) * Math.sin(a) * sp, Math.cos(b) * sp); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ map: dot(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'), size: 0.35, color: cor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(m); bursts.push({ m, vv, t: 0 });
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flash.position.copy(pos); flash.scale.setScalar(0.5); scene.add(flash); bursts.push({ flash, t: 0 });
  }
  const BLOQ = 'a,button,input,textarea,select,label,summary,.card,.plan,.panel,dialog,.chat,.drawer,.picker,.extra,.post,.cf-nav,.hud,.review,.order-card,.cri-frame,header,.consent,.remind';
  const nd2 = new THREE.Vector2(), ray2 = new THREE.Raycaster(), wp = new THREE.Vector3();
  function acerta(cx, cy) {
    nd2.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray2.setFromCamera(nd2, camera);
    const hits = ray2.intersectObjects(alvos.filter((o) => o.userData.vivo), true);
    if (!hits.length) return null;
    let o = hits[0].object; while (o && !alvos.includes(o)) o = o.parent;
    return o;
  }
  addEventListener('pointerdown', (e) => {
    if (e.button > 0 || (e.target.closest && e.target.closest(BLOQ))) return;
    const o = acerta(e.clientX, e.clientY); if (!o) return;
    o.userData.vivo = 0; o.userData.morre = 0;
    o.getWorldPosition(wp); explode(wp.clone(), o.material.color.clone());
    pulse = 1.2;
    hitCbs.forEach((cb) => cb({ x: e.clientX, y: e.clientY, orbita: orbiters.includes(o) }));
  });
  let miraOn = false, fr = 0;
  let warpExtra = 0;

  // túnel de luz: riscos que esticam com a velocidade da rolagem (efeito "dobra espacial")
  const NS = mobile ? 260 : 700, TZ0 = -70, TZ1 = 8;
  const sPos = new Float32Array(NS * 6), sData = [];
  for (let i = 0; i < NS; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 9;
    sData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: TZ0 + Math.random() * (TZ1 - TZ0) });
  }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const streakM = new THREE.LineBasicMaterial({ color: 0xc9bcff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const streaks = new THREE.LineSegments(sGeo, streakM); scene.add(streaks);

  // estrelas ao fundo
  const spr = dot(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const fpos = new Float32Array((mobile ? 500 : 1200) * 3);
  for (let i = 0; i < fpos.length; i += 3) {
    const r = 18 + Math.random() * 30, a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
    fpos[i] = r * Math.sin(b) * Math.cos(a); fpos[i + 1] = r * Math.sin(b) * Math.sin(a); fpos[i + 2] = r * Math.cos(b) - 10;
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const far = new THREE.Points(fg, new THREE.PointsMaterial({ map: spr, size: 0.18, color: 0xc9bcff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(far);

  // alvo por seção: x, y, escala, amplitude, opacidade, frequência, abertura das órbitas
  const T = {
    topo: [2.5, 0, 1, 0.26, 1, 0.9, 1], sobre: [-4, 0, 0.85, 0.18, 0.75, 1.4, 0.8], projetos: [5.4, 1.9, 0.6, 0.14, 0.6, 0.7, 1.15],
    criar: [-5, 1.6, 0.6, 0.32, 0.5, 1.3, 1.25], loja: [-4.8, 0.8, 0.8, 0.3, 0.6, 1.1, 1.35], quiz: [4.6, 0.3, 0.85, 0.36, 0.7, 1.7, 0.9], encomenda: [4.8, -0.4, 0.8, 0.28, 0.65, 1.2, 1.2],
    processo: [0, 2.8, 0.55, 0.2, 0.7, 0.8, 1.6], faq: [-4.4, 0, 0.8, 0.14, 0.65, 0.8, 0.9], avaliacoes: [4.4, 0, 0.8, 0.2, 0.65, 1, 1.1],
    blog: [-4.6, 0, 0.75, 0.16, 0.65, 1, 1], ajuda: [4.8, 0.6, 0.75, 0.22, 0.75, 1.1, 1.1], cliente: [5, 1.2, 0.6, 0.18, 0.6, 1, 1.2], contato: [0, 0, 1.25, 0.34, 0.85, 1.1, 1.3],
  };
  let tgt = T[opts.start] || T.topo; const cur = [...tgt];
  let mx = 0, my = 0, sy = scrollY, lastSy = scrollY, vel = 0, giro = 0, w = 0, h = 0, pulse = 0, hover = 0, spin = 0;
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), sph = new THREE.Sphere(), hit = new THREE.Vector3();

  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; } }, { passive: true });
  addEventListener('pointerdown', () => { pulse = 1; });
  addEventListener('scroll', () => { sy = scrollY; }, { passive: true });
  // celular: inclinar o aparelho mexe a cena
  function giroscopio(e) {
    if (e.gamma == null) return;
    giro = 1;
    mx = Math.max(-1, Math.min(1, e.gamma / 30));
    my = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  }
  if (mobile && window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      addEventListener('touchend', function pede() { removeEventListener('touchend', pede); DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') addEventListener('deviceorientation', giroscopio); }).catch(() => {}); }, { once: true });
    } else addEventListener('deviceorientation', giroscopio);
  }
  function resize() { w = innerWidth; h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  let vivo = true, tAcc = 0, last = performance.now();
  document.addEventListener('visibilitychange', () => { vivo = !document.hidden; if (vivo) { last = performance.now(); requestAnimationFrame(tick); } });
  function tick(now = performance.now()) {
    if (!vivo) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tAcc += dt * vel0; const t = tAcc;
    const desk = w > 860;
    // velocidade da rolagem (suavizada)
    const dy = sy - lastSy; lastSy = sy;
    vel += (Math.min(Math.abs(dy), 120) - vel) * 0.12;
    warpExtra *= 0.965;
    const boost = vel * 0.012 + warpExtra;

    for (let i = 0; i < cur.length; i++) cur[i] += (tgt[i] - cur[i]) * 0.05;
    group.position.x = desk ? cur[0] : 0;
    group.position.y = desk ? cur[1] : 0.9;
    group.scale.setScalar(cur[2] * (desk ? 1 : 0.68));
    canvas.style.opacity = desk ? cur[4] : Math.min(1, cur[4] * 0.6 + 0.12);

    // câmera: paralaxe, leve inclinação e "zoom de velocidade"
    camera.position.x += (mx * 0.7 - camera.position.x) * 0.05;
    camera.position.y += (-my * 0.5 - camera.position.y) * 0.05;
    camera.rotation.z += (-mx * 0.04 - camera.rotation.z) * 0.05;
    const fov = 50 + Math.min(boost * 6, 14);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.12; camera.updateProjectionMatrix(); }
    camera.lookAt(0, 0, 0);

    spin += (0.12 + boost * 2.2) * dt * vel0;
    group.rotation.y = spin + sy * 0.0006;
    group.rotation.x = Math.sin(t * 0.25) * 0.25 + sy * 0.0003;

    if (desk) {
      ndc.set(mx, -my); ray.setFromCamera(ndc, camera);
      blob.getWorldPosition(sph.center); sph.radius = 1.75 * group.scale.x;
      const on = ray.ray.intersectSphere(sph, hit);
      hover += ((on ? 1 : 0) - hover) * 0.08;
      if (on) { blob.worldToLocal(hit); U.uMouse.value.lerp(hit.normalize(), 0.2); }
    } else if (giro) { hover = 0.6; U.uMouse.value.set(mx, -my, 1).normalize(); }
    U.uTime.value = t; U.uAmp.value = cur[3] + Math.min(boost * 0.12, 0.18); U.uFreq.value = cur[5]; U.uPulse.value = pulse; U.uHover.value = hover;
    pulse *= 0.93;
    wire.rotation.y = -t * 0.08;
    ring.rotation.z = t * 0.2 + spin * 0.3; ring2.rotation.z = -t * 0.14;
    halo.material.opacity = 0.42 + hover * 0.25 + pulse * 0.3 + Math.min(boost * 0.1, 0.2);

    const spread = cur[6] + Math.min(boost * 0.08, 0.35);
    orbiters.forEach((o) => {
      const d = o.userData, a = t * d.sp * 1.4 + d.ph + spin * 0.4, r = d.r * spread;
      o.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.6 + d.tilt, Math.sin(a) * r);
      o.rotation.x = t * d.rs; o.rotation.y = t * d.rs * 0.8;
    });

    // formas que sobem pela tela conforme a rolagem
    flutuantes.forEach((o) => {
      const d = o.userData;
      let y = ((d.base + sy * d.k + t * 0.15) % RANGE + RANGE) % RANGE - RANGE / 2;
      o.position.set(d.x + Math.sin(t * 0.4 + d.ph) * 0.4 - mx * (1 - d.z / 14) * 0.6, -y, d.z);
      o.rotation.x = t * d.rx + sy * 0.002 * d.rx; o.rotation.y = t * d.ry + sy * 0.002 * d.ry;
    });

    // túnel: riscos vêm na direção da câmera, mais rápidos e longos ao rolar
    const sp = (2.2 + boost * 26) * dt * vel0, len = 0.08 + boost * 1.6;
    for (let i = 0; i < NS; i++) {
      const d = sData[i];
      d.z += sp * (0.6 + (i % 5) * 0.12);
      if (d.z > TZ1) d.z = TZ0 + Math.random() * 6;
      const j = i * 6;
      sPos[j] = d.x; sPos[j + 1] = d.y; sPos[j + 2] = d.z;
      sPos[j + 3] = d.x; sPos[j + 4] = d.y; sPos[j + 5] = d.z - len;
    }
    sGeo.attributes.position.needsUpdate = true;
    streakM.opacity = 0.35 + Math.min(boost * 0.25, 0.5);
    streaks.rotation.z = t * 0.03 + mx * 0.1;
    far.rotation.y = t * 0.01 + sy * 0.0002;

    // formas atingidas: crescem, somam e voltam depois
    alvos.forEach((o) => {
      const d = o.userData;
      if (d.vivo) { if (o.visible === false) o.visible = true; return; }
      d.morre += dt;
      if (d.morre < 0.35) { o.scale.setScalar(d.esc * (1 + d.morre * 4)); o.material.opacity = Math.max(0, 0.95 - d.morre * 3); }
      else { o.visible = false; if (d.morre > (orbiters.includes(o) ? 5 : 8)) { d.vivo = 1; o.scale.setScalar(d.esc); o.material.opacity = 0.9; } }
    });
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt;
      if (b.flash) { b.flash.scale.setScalar(0.5 + b.t * 9); b.flash.material.opacity = Math.max(0, 1 - b.t * 3); if (b.t > 0.4) { scene.remove(b.flash); bursts.splice(i, 1); } continue; }
      const a = b.m.geometry.attributes.position.array;
      for (let k = 0; k < a.length; k += 3) { a[k] += b.vv[k] * dt; a[k + 1] += b.vv[k + 1] * dt; a[k + 2] += b.vv[k + 2] * dt; b.vv[k] *= 0.96; b.vv[k + 1] *= 0.96; b.vv[k + 2] *= 0.96; }
      b.m.geometry.attributes.position.needsUpdate = true;
      b.m.material.opacity = Math.max(0, 1 - b.t * 1.1);
      if (b.t > 0.95) { scene.remove(b.m); b.m.geometry.dispose(); bursts.splice(i, 1); }
    }
    // mira: avisa quando o mouse passa sobre uma forma clicável
    if (desk && ++fr % 4 === 0) {
      const on = !!acerta((mx + 1) / 2 * innerWidth, (my + 1) / 2 * innerHeight);
      if (on !== miraOn) { miraOn = on; miraCbs.forEach((cb) => cb(on)); }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    section(id) { if (T[id]) tgt = T[id]; },
    colors(hue) {
      colA.setHSL(hue / 360, 1, 0.71); colB.setHSL(((hue + 294) % 360) / 360, 1, 0.64);
      ring2M.color.copy(colB); ringM.color.copy(colA); halo.material.color.copy(colA);
      orbiters.concat(flutuantes).forEach((o, i) => o.material.color.copy(o.userData.x !== undefined ? (i % 2 ? colA : colB) : (i % 2 ? colB : colA)));
      far.material.color.setHSL(hue / 360, 0.9, 0.85); streakM.color.setHSL(hue / 360, 0.9, 0.82);
    },
    pulse() { pulse = 1.4; },
    warp(f = 1) { warpExtra = 1.6 * f; },
    onHit(cb) { hitCbs.push(cb); },
    onMira(cb) { miraCbs.push(cb); },
    // posições na tela das formas clicáveis (útil para testes e dicas)
    alvosNaTela() { return alvos.filter((o) => o.userData.vivo && o.visible !== false).map((o) => { o.getWorldPosition(wp); const v = wp.clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; }).filter((p) => p.z < 1 && p.x > 0 && p.y > 70 && p.x < innerWidth && p.y < innerHeight); },
  };
}
return { init };
})();
