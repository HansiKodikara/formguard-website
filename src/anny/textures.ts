/**
 * Real textures, all CC0: the lifters' skin, eyes, brows, lashes, hair and trainers (MakeHuman system
 * assets, fitted by scripts/figure/export_body.py), the gym's materials (ambientCG) and the studio light
 * (Poly Haven), sized by scripts/figure/export_textures.py.
 */
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/** A promise React's use() reads synchronously once it has settled (React checks `status`), so a
 *  scene whose data was preloaded never suspends. */
export type Resource<T> = Promise<T>;
export function resource<T>(p: Promise<T>): Resource<T> {
  const r = p as Promise<T> & { status?: string; value?: T; reason?: unknown };
  r.status = "pending";
  r.then((v) => { r.status = "fulfilled"; r.value = v; }, (e) => { r.status = "rejected"; r.reason = e; });
  return r;
}

const loader = new THREE.TextureLoader();
const images = new Map<string, Promise<THREE.Texture>>();

/** One download per URL. Data maps (normal, roughness…) are linear; colour maps are sRGB. */
export function texture(url: string, { srgb = true, tile = false } = {}) {
  let p = images.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      if (tile) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    });
    images.set(url, p);
  }
  return p;
}

// ── the gym (ambientCG) ─────────────────────────────────────────────────────────────────

export type PBR = { color: THREE.Texture; normal: THREE.Texture; orm: THREE.Texture };
const GYM = ["wood", "rubber", "plate", "steel", "powder", "leather", "fabric"] as const;
export type GymTextures = Record<(typeof GYM)[number], PBR> & { knurl: THREE.Texture };

let gymP: Resource<GymTextures> | null = null;
export function gymTextures() {
  gymP ??= resource(
    Promise.all([
      ...GYM.map(async (n) => {
        const [color, normal, orm] = await Promise.all([
          texture(`/textures/gym/${n}-color.webp`, { tile: true }),
          texture(`/textures/gym/${n}-normal.webp`, { srgb: false, tile: true }),
          texture(`/textures/gym/${n}-orm.webp`, { srgb: false, tile: true }),
        ]);
        return [n, { color, normal, orm }] as const;
      }),
      texture("/textures/gym/knurl-normal.webp", { srgb: false, tile: true }).then((t) => ["knurl", t] as const),
    ]).then((entries) => Object.fromEntries(entries) as GymTextures),
  );
  return gymP;
}

/** The same maps tiled `rx × ry` times across the UV square (the copies share one upload). */
export function tiled(p: PBR, rx: number, ry = rx, rotation = 0): PBR {
  const f = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(rx, ry);
    c.rotation = rotation;
    return c;
  };
  return { color: f(p.color), normal: f(p.normal), orm: f(p.orm) };
}

/** A physically based material from a texture set: colour × tint, normal, AO/roughness/metal packed. */
export function pbr(p: PBR, opts: THREE.MeshPhysicalMaterialParameters & { normalStrength?: number } = {}) {
  const { normalStrength = 1, ...rest } = opts;
  return new THREE.MeshPhysicalMaterial({
    map: p.color, normalMap: p.normal, normalScale: new THREE.Vector2(normalStrength, normalStrength),
    roughnessMap: p.orm, metalnessMap: p.orm, aoMap: p.orm, aoMapIntensity: 0.8,
    roughness: 1, metalness: 1, ...rest,
  });
}

// ── light (Poly Haven) ──────────────────────────────────────────────────────────────────

let envP: Resource<THREE.DataTexture> | null = null;
/** A bright photo studio with big windows: the image-based light every daylight scene shares. */
export function studioEnv() {
  envP ??= resource(new HDRLoader().loadAsync("/env/studio.hdr").then((t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }));
  return envP;
}

// ── skin detail (procedural) ────────────────────────────────────────────────────────────

let skinDetailT: { normal: THREE.DataTexture; rough: THREE.DataTexture } | null = null;

/**
 * Two small tiling maps that break up the skin's single smooth shell, made here rather than downloaded:
 * a micro-normal of pores over fine grain, and a soft roughness field so the shine varies across the skin.
 * Both wrap seamlessly, so they tile at any repeat.
 */
export function skinDetail() {
  if (skinDetailT) return skinDetailT;
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  // height: a fine grain, then ~900 pores as soft pits
  const N = 256, h = new Float32Array(N * N);
  for (let i = 0; i < h.length; i++) h[i] = (rand() - 0.5) * 0.18;
  for (let k = 0; k < 900; k++) {
    const cx = rand() * N, cy = rand() * N, r = 0.9 + rand() * 1.1, depth = 0.6 + rand() * 0.6;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = (Math.floor(cx) + dx + N) % N, y = (Math.floor(cy) + dy + N) % N;
      const d2 = ((Math.floor(cx) + dx - cx) ** 2 + (Math.floor(cy) + dy - cy) ** 2) / (r * r);
      h[y * N + x] -= depth * Math.exp(-d2 * 1.6);
    }
  }
  const nrm = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const at = (xx: number, yy: number) => h[((yy + N) % N) * N + ((xx + N) % N)];
    const sx = (at(x + 1, y) - at(x - 1, y)) * 0.9, sy = (at(x, y + 1) - at(x, y - 1)) * 0.9;
    const l = Math.hypot(sx, sy, 1), o = (y * N + x) * 4;
    nrm[o] = (-sx / l * 0.5 + 0.5) * 255; nrm[o + 1] = (-sy / l * 0.5 + 0.5) * 255; nrm[o + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
  }
  // roughness: smooth value noise (bilinear over an 8×8 lattice, wrapped), 0.4 … 0.62
  const R = 128, G = 8, lat = Array.from({ length: G * G }, rand), rough = new Uint8Array(R * R * 4);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const fx = (x / R) * G, fy = (y / R) * G, ix = Math.floor(fx), iy = Math.floor(fy), tx = s(fx - ix), ty = s(fy - iy);
    const L = (a: number, b: number) => lat[((b % G) * G) + (a % G)];
    const v = (L(ix, iy) * (1 - tx) + L(ix + 1, iy) * tx) * (1 - ty) + (L(ix, iy + 1) * (1 - tx) + L(ix + 1, iy + 1) * tx) * ty;
    const o = (y * R + x) * 4, g = (0.4 + v * 0.22) * 255;
    rough[o] = rough[o + 1] = rough[o + 2] = g; rough[o + 3] = 255;
  }
  const tex = (data: Uint8Array, size: number) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 8; t.needsUpdate = true;
    return t;
  };
  skinDetailT = { normal: tex(nrm, N), rough: tex(rough, R) };
  return skinDetailT;
}
