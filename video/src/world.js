// Three.js layer: extruded 3D logos, particle field, animated backdrop, bloom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H } from './lib.js';

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, W / H, .1, 300);
  camera.position.set(0, 0, CAMZ);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  // lights
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 8); scene.add(key);
  const rimO = new THREE.DirectionalLight(0xffc4d6, 2.0); rimO.position.set(-7, 2, -3); scene.add(rimO);
  const rimV = new THREE.DirectionalLight(0xffffff, 1.6); rimV.position.set(7, -1, -3); scene.add(rimV);
  scene.add(new THREE.AmbientLight(0xffffff, .55));

  const glowTex = glowTexture();
  function makeGlow() {
    const m = new THREE.SpriteMaterial({ map: glowTex, color: 0x5a2a3c, transparent: true, depthWrite: false, opacity: .2 });
    const s = new THREE.Sprite(m); s.scale.set(2.6, .42, 1); s.position.set(0, -1.32, -.4); return s;
  }

  // ---- MetaMask fox: layered colour facets
  const fox = new THREE.Group(), foxInner = new THREE.Group(), foxMats = [];
  fox.add(foxInner);
  for (const L of logos.fox) {
    const base = L.name === 'base';
    const c = new THREE.Color(L.color);
    const cap = new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, metalness: .05, clearcoat: .35, clearcoatRoughness: .3, flatShading: true, envMapIntensity: .45 });
    const side = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(.5), roughness: .5, metalness: .3, emissive: c.clone(), emissiveIntensity: .05 });
    foxMats.push(cap, side);
    const depth = base ? .36 : .14 + L.z;
    for (const p of L.polys) {
      const geo = new THREE.ExtrudeGeometry(shapeFrom(p), { depth, bevelEnabled: true, bevelThickness: .014, bevelSize: base ? .02 : .009, bevelSegments: 2, curveSegments: 1 });
      geo.translate(0, 0, base ? -.38 : -.12);
      foxInner.add(new THREE.Mesh(geo, [cap, side]));
    }
  }
  foxInner.position.y = -.02;
  const foxGlow = makeGlow(); fox.add(foxGlow);
  scene.add(fox);

  // ---- GenLayer mark: chrome caps, neon violet sides
  const gen = new THREE.Group(), genInner = new THREE.Group();
  gen.add(genInner);
  const gCap = new THREE.MeshPhysicalMaterial({ color: 0x1a1619, metalness: .2, roughness: .28, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.1 });
  const gSide = new THREE.MeshStandardMaterial({ color: 0xf0a9c2, roughness: .4, metalness: .05, emissive: 0xe0628e, emissiveIntensity: .25 });
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
  const genGlow = makeGlow(); gen.add(genGlow);
  scene.add(gen);

  // ---- Internet Court mark: white caps, red glowing sides
  const court = new THREE.Group(), courtInner = new THREE.Group();
  court.add(courtInner);
  const cCap = new THREE.MeshPhysicalMaterial({ color: 0x1a1619, metalness: .2, roughness: .28, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.1 });
  const cSide = new THREE.MeshStandardMaterial({ color: 0xf0a9c2, roughness: .4, metalness: .05, emissive: 0xe0628e, emissiveIntensity: .25 });
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
  const courtGlow = makeGlow(); court.add(courtGlow);
  scene.add(court);

  function place(obj, mats, glow, st, t) {
    const inner = obj.children[0];
    if (!st || st.o <= .001 || st.size <= 1) { obj.visible = false; return; }
    obj.visible = true;
    obj.position.set((st.x - W / 2) * UNIT, -(st.y - H / 2) * UNIT, st.z || 0);
    inner.rotation.set(st.rx || 0, st.ry || 0, st.rz || 0);
    obj.scale.setScalar((st.size * UNIT) / 2);
    const o = st.o ?? 1;
    for (const m of mats) { m.transparent = o < .999; m.opacity = o; }
    glow.material.opacity = .2 * o;
  }

  return {
    render(t, st) {
      place(fox, foxMats, foxGlow, st.fox && { ...st.fox, size: st.fox.size * 1.1 }, t);
      place(gen, genMats, genGlow, st.gen, t);
      place(court, courtMats, courtGlow, st.court, t);
      camera.position.x = Math.sin(t * .13) * .12;
      camera.position.y = Math.cos(t * .11) * .08;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
  };
}
