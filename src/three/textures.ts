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
