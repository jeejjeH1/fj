// Three.js layer: extruded 3D logos, particle field, animated backdrop, bloom.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H, rng } from './lib.js';

const FOV = 35, CAMZ = 10;
export const UNIT = (2 * CAMZ * Math.tan((FOV / 2) * Math.PI / 180)) / H; // world units per px at z=0

function shapeFrom(p) {
  const s = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of p.holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export async function initWorld(canvas, logos) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, W / H, .1, 300);
  camera.position.set(0, 0, CAMZ);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  // lights
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 8); scene.add(key);
  const rimO = new THREE.DirectionalLight(0xff6a1a, 3.2); rimO.position.set(-7, 2, -3); scene.add(rimO);
  const rimV = new THREE.DirectionalLight(0x7d6bff, 3.6); rimV.position.set(7, -1, -3); scene.add(rimV);
  scene.add(new THREE.AmbientLight(0xffffff, .25));

  // backdrop
  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { uT: { value: 0 }, uMix: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uT, uMix, uPulse;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 p = vUv*vec2(1.7778,1.);
        vec3 c = vec3(.010,.010,.016);
        float b1 = smoothstep(1.1,0.,length(p-vec2(.25+.08*sin(uT*.21),.18+.05*cos(uT*.17))));
        float b2 = smoothstep(1.1,0.,length(p-vec2(1.55+.08*cos(uT*.19),.85+.05*sin(uT*.23))));
        float b3 = smoothstep(.9,0.,length(p-vec2(.89,.5)));
        c += vec3(1.,.32,.04)*b1*b1*(.16-.08*uMix);
        c += vec3(.42,.34,1.)*b2*b2*(.10+.10*uMix);
        c += vec3(.5,.45,1.)*b3*b3*uPulse*.15;
        vec2 gp = p*16. + vec2(0., uT*.06);
        vec2 g = abs(fract(gp)-.5);
        float line = smoothstep(.47,.5,max(g.x,g.y));
        float fadeV = smoothstep(0.,.6,vUv.y)*smoothstep(1.,.5,vUv.y);
        c += line*.018*fadeV;
        c += (h(vUv*vec2(1920.,1080.)+uT)-.5)/255.;
        gl_FragColor = vec4(c,1.);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), bgMat);
  bg.position.z = -40; bg.scale.setScalar(2.05); scene.add(bg);

  // particles
  const N = 1400, r = rng(42), pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
  const pal = [[1, .45, .12], [.55, .48, 1], [1, 1, 1]];
  for (let i = 0; i < N; i++) {
    pos.set([(r() - .5) * 40, (r() - .5) * 24, -30 + r() * 34], i * 3);
    vel.set([(r() - .5) * .25, .08 + r() * .25, (r() - .2) * .4], i * 3);
    col.set(pal[i % 7 === 0 ? 2 : i % 2], i * 3);
    siz[i] = .5 + r() ** 3 * 4;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('vel', new THREE.BufferAttribute(vel, 3));
  pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pg.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uWarp: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: `
      attribute vec3 vel; attribute vec3 color; attribute float size; uniform float uT, uWarp; varying vec3 vC; varying float vA;
      void main(){
        vec3 p = position + vel*uT + vec3(0.,0.,uWarp);
        p.y = mod(p.y+12.,24.)-12.; p.x = mod(p.x+20.,40.)-20.; p.z = mod(p.z+30.,34.)-30.;
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_PointSize = size*(110./-mv.z)*(1.+uWarp*.02);
        gl_Position = projectionMatrix*mv;
        vC = color; vA = smoothstep(-30.,-20.,p.z)*smoothstep(4.,0.,p.z)*(.55+.45*sin(uT*1.7+position.x*3.));
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA; uniform float uAlpha;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vC*a*a*vA*uAlpha*.9,1.); }`,
  });
  scene.add(new THREE.Points(pg, pMat));

  const glowTex = glowTexture();
  function makeGlow(color, size) {
    const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 });
    const s = new THREE.Sprite(m); s.scale.setScalar(size); s.position.z = -1.2; return s;
  }

  // ---- MetaMask fox: layered colour facets
  const fox = new THREE.Group(), foxInner = new THREE.Group(), foxMats = [];
  fox.add(foxInner);
  for (const L of logos.fox) {
    const base = L.name === 'base';
    const c = new THREE.Color(L.color);
    const cap = new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, metalness: .05, clearcoat: .35, clearcoatRoughness: .3, flatShading: true, envMapIntensity: .45 });
    const side = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(.5), roughness: .5, metalness: .3, emissive: base ? new THREE.Color(0xff5a10) : c.clone(), emissiveIntensity: base ? .55 : .12 });
    foxMats.push(cap, side);
    const depth = base ? .36 : .14 + L.z;
    for (const p of L.polys) {
      const geo = new THREE.ExtrudeGeometry(shapeFrom(p), { depth, bevelEnabled: true, bevelThickness: .014, bevelSize: base ? .02 : .009, bevelSegments: 2, curveSegments: 1 });
      geo.translate(0, 0, base ? -.38 : -.12);
      foxInner.add(new THREE.Mesh(geo, [cap, side]));
    }
  }
  foxInner.position.y = -.02;
  const foxGlow = makeGlow(0xff6a1a, 6.5); fox.add(foxGlow);
  scene.add(fox);

  // ---- GenLayer mark: chrome caps, neon violet sides
  const gen = new THREE.Group(), genInner = new THREE.Group();
  gen.add(genInner);
  const gCap = new THREE.MeshPhysicalMaterial({ color: 0xf4f4fb, metalness: .92, roughness: .2, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.5 });
  const gSide = new THREE.MeshStandardMaterial({ color: 0x241c55, roughness: .35, metalness: .4, emissive: 0x7461ff, emissiveIntensity: 1.25 });
  const genMats = [gCap, gSide];
  const box = new THREE.Box2();
  for (const p of logos.genlayer[0].polys) for (const [x, y] of p.outer) box.expandByPoint(new THREE.Vector2(x, y));
  const ctr = box.getCenter(new THREE.Vector2()), span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
  for (const p of logos.genlayer[0].polys) {
    const geo = new THREE.ExtrudeGeometry(shapeFrom(p), { depth: .3, bevelEnabled: true, bevelThickness: .03, bevelSize: .018, bevelSegments: 3, curveSegments: 1 });
    geo.translate(-ctr.x, -ctr.y, -.15);
    geo.scale(2 / span, 2 / span, 1);
    genInner.add(new THREE.Mesh(geo, [gCap, gSide]));
  }
  const genGlow = makeGlow(0x7461ff, 6.5); gen.add(genGlow);
  scene.add(gen);

  // ---- Internet Court mark: white caps, red glowing sides
  const court = new THREE.Group(), courtInner = new THREE.Group();
  court.add(courtInner);
  const cCap = new THREE.MeshPhysicalMaterial({ color: 0xf6f3f3, metalness: .35, roughness: .3, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: .8 });
  const cSide = new THREE.MeshStandardMaterial({ color: 0x5a0d10, roughness: .35, metalness: .3, emissive: 0xe0262c, emissiveIntensity: 1.3 });
  const courtMats = [cCap, cSide];
  const cbox = new THREE.Box2();
  for (const p of logos.court[0].polys) for (const [x, y] of p.outer) cbox.expandByPoint(new THREE.Vector2(x, y));
  const cc = cbox.getCenter(new THREE.Vector2()), cspan = Math.max(cbox.max.x - cbox.min.x, cbox.max.y - cbox.min.y);
  for (const p of logos.court[0].polys) {
    const geo = new THREE.ExtrudeGeometry(shapeFrom(p), { depth: .3, bevelEnabled: true, bevelThickness: .03, bevelSize: .014, bevelSegments: 3, curveSegments: 1 });
    geo.translate(-cc.x, -cc.y, -.15);
    geo.scale(2 / cspan, 2 / cspan, 1);
    courtInner.add(new THREE.Mesh(geo, [cCap, cSide]));
  }
  const courtGlow = makeGlow(0xe0262c, 6.5); court.add(courtGlow);
  scene.add(court);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .7, .55, .86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function place(obj, mats, glow, st, t) {
    if (!st || st.o <= .001 || st.size <= 1) { obj.visible = false; return; }
    obj.visible = true;
    obj.position.set((st.x - W / 2) * UNIT, -(st.y - H / 2) * UNIT, st.z || 0);
    obj.rotation.set(st.rx || 0, st.ry || 0, st.rz || 0);
    obj.scale.setScalar((st.size * UNIT) / 2);
    const o = st.o ?? 1;
    for (const m of mats) { m.transparent = o < .999; m.opacity = o; }
    glow.material.opacity = (st.glow ?? .45) * o;
  }

  return {
    render(t, st) {
      bgMat.uniforms.uT.value = t;
      bgMat.uniforms.uMix.value = st.mix ?? 0;
      bgMat.uniforms.uPulse.value = st.pulse ?? 0;
      pMat.uniforms.uT.value = t;
      pMat.uniforms.uWarp.value = st.warp ?? 0;
      pMat.uniforms.uAlpha.value = st.particles ?? 1;
      place(fox, foxMats, foxGlow, st.fox && { ...st.fox, size: st.fox.size * 1.1 }, t);
      place(gen, genMats, genGlow, st.gen, t);
      place(court, courtMats, courtGlow, st.court, t);
      bloom.strength = st.bloom ?? .7;
      camera.position.x = Math.sin(t * .13) * .12;
      camera.position.y = Math.cos(t * .11) * .08;
      camera.lookAt(0, 0, 0);
      composer.render();
    },
  };
}
