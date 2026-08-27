"use client"

import type { MotionValue } from "framer-motion"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { useShadersEnabled } from "@lib/hooks/use-shaders-enabled"
import * as THREE from "three"

type FAQImageShaderProps = {
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  variant?: "default" | "about" | "hero"
  imageSet?: readonly GlazeImage[]
  layout?: (width: number, height: number, images: readonly GlazeImage[]) => CardRect[]
  classNames?: {
    root: string
    shadows: string
    fallback: string
    fallbackImage: string
  }
}

export type GlazeImage = {
  src: string
  aspect: number
}

const faqImages = [
  { src: "/assets/img/faq/FAQ1.png", aspect: 420 / 265 },
  { src: "/assets/img/faq/FAQ2.png", aspect: 213 / 294 },
  { src: "/assets/img/faq/FAQ3.png", aspect: 420 / 260 },
] as const

/*
 * Elastic sheet, ported from the ElasticMesh reference (ogl) onto the three.js cards that were
 * already here. Every card is a grid of nodes held to its rest position by a spring, coupled to
 * its four neighbours, and pushed around by the pointer inside a grab radius. The simulation runs
 * on the CPU exactly as the reference does — it is stateful across frames and needs its
 * neighbours, which is awkward on the GPU and cheap enough here — and each frame it writes two
 * dynamic attributes: the per-node offset and the normal recomputed from the deformed surface.
 *
 * Those numbers are the reference's defaults; `grabRadius` and the offsets live in a space where
 * the card is 2 units tall and 2*aspect wide, so a radius of 0.6 is a little under a third of the
 * card's height whatever its pixel size.
 */
const ELASTIC = {
  stiffness: 0.05,
  damping: 0.2,
  grabRadius: 0.6,
  pull: 0.4,
  wobble: 5,
}
const ELASTIC_STEP = 1 / 120
const ELASTIC_MAX_SUBSTEPS = 5
/* Below this the sheet is flat to within a fraction of a pixel; with no pointer on it there is
   nothing left to integrate, so the whole simulation and its two buffer uploads are skipped. */
const ELASTIC_REST_EPSILON = 0.00025

/*
 * The brush.
 *
 * A ripple trail, ported from the RippleDistortion reference: as the pointer travels it stamps
 * ring-shaped blobs into a low-resolution displacement field, additively, each one growing and
 * fading on its own clock. The card shaders then read that field and refract the photograph along
 * it. It replaces the procedural fbm-plus-lens smear that used to live in the fragment shader —
 * that one was driven by pointer distance, so it followed the cursor as a blob; this one is a
 * stroke, which is what a brush actually leaves behind.
 *
 * Everything here is tuned far below the reference's defaults (strength 0.2, spacing 15, fade 3).
 * It has to sit *under* the ambient liquid-ether field that the cursor already drags across every
 * page — that one is slow, wide and running at a tenth of full opacity, so a fast, tight, strong
 * ripple on top of it would read as a second, competing cursor. Wide stamps, long spacing and a
 * short fade give a stroke you notice only once you go looking for it.
 */
const RIPPLE_MAX_WAVES = 64
const RIPPLE_START_SCALE = 1.5
/* The reference's decay constant: opacity reaches 1/500 after `fade` seconds. */
const RIPPLE_LIFE_CONSTANT = Math.log(500)
/* The field is a smooth blob mask, so it costs nothing to keep it small — "low" in the reference. */
const RIPPLE_QUALITY = 0.4
const RIPPLE_MAX_FIELD = 1024

type RippleSettings = {
  brushSize: number
  strength: number
  swirl: number
  rings: number
  spread: number
  fade: number
  spacing: number
}

const rippleVertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 position;
  attribute vec2 uv;
  attribute vec2 iOffset;
  attribute vec2 iScale;
  attribute float iOpacity;

  varying vec2 vUv;
  varying float vOpacity;

  void main() {
    vUv = uv;
    vOpacity = iOpacity;
    gl_Position = vec4(iOffset + position.xy * iScale, 0.0, 1.0);
  }
`

const rippleFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying float vOpacity;

  uniform float uRings;

  const float PI = 3.141592653589793;
  const float EDGE = 0.006737947;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0) discard;

    float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);
    brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);

    gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
  }
`

const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aElasticNormal;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uHover;
  uniform vec2 uPointer;
  uniform float uPointerFalloff;
  uniform float uCornerStrength;
  uniform float uCornerMotion;
  uniform float uDepthStrength;
  varying vec2 vUv;
  varying vec3 vElasticNormal;
  varying float vElasticDepth;

  float vertexHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vertexNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(vertexHash(i), vertexHash(i + vec2(1.0, 0.0)), f.x),
      mix(vertexHash(i + vec2(0.0, 1.0)), vertexHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float cornerInfluence(vec2 point, vec2 pointer, vec2 corner) {
    vec2 pointDelta = point - corner;
    vec2 pointerDelta = pointer - corner;
    return exp(-dot(pointDelta, pointDelta) * 26.0)
      * exp(-dot(pointerDelta, pointerDelta) * 13.0);
  }

  void main() {
    vUv = uv;
    vElasticNormal = aElasticNormal;
    vElasticDepth = aOffset.z;

    // The elastic sheet moves the vertex first; the brush then works on top of the deformed card.
    vec3 displaced = position + aOffset;
    float energy = clamp(uEnergy, 0.0, 1.0);
    vec2 pointerDelta = uv - uPointer;
    float pointerDistance = length(pointerDelta);
    float pointerInfluence = exp(-pointerDistance * pointerDistance * uPointerFalloff);
    float glazeInfluence = pointerInfluence * uHover;
    float time = uTime * (0.34 + energy * 0.8);
    float broadNoise = vertexNoise(uv * vec2(3.4, 3.0) + vec2(time * 0.34, -time * 0.27)) - 0.5;
    float corners = cornerInfluence(uv, uPointer, vec2(0.0, 0.0))
      + cornerInfluence(uv, uPointer, vec2(1.0, 0.0))
      + cornerInfluence(uv, uPointer, vec2(0.0, 1.0))
      + cornerInfluence(uv, uPointer, vec2(1.0, 1.0));
    float animatedCornerPulse = 0.72 + sin(uTime * 1.35 + (uv.x + uv.y) * 5.0) * 0.28;
    float cornerPulse = mix(1.0, animatedCornerPulse, uCornerMotion);
    vec2 cornerDirection = normalize(uv - 0.5 + vec2(0.0001));
    /*
     * The card no longer wobbles procedurally. It used to carry an fbm noise field plus a pair of
     * hover waves here, which at rest still ran a permanent micro-shimmer; the elastic lattice is
     * the physical layer now and the ripple field is the optical one, so a third source of
     * movement only muddied both. What stays is the corner lift and the depth bulge — those are
     * the card's own response to being hovered, not brushwork.
     */
    displaced.xy += cornerDirection * corners * uHover * cornerPulse * (0.015 + energy * 0.009) * uCornerStrength;
    displaced.z += pointerInfluence * uHover * uDepthStrength * (0.72 + broadNoise * 0.18);
    displaced.z += corners * uHover * uDepthStrength * 0.22;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uHover;
  uniform float uImageAspect;
  uniform float uPlaneAspect;
  uniform vec2 uPointer;
  uniform vec2 uSize;
  uniform float uPointerFalloff;
  uniform sampler2D uRipple;
  uniform vec4 uRippleRect;
  uniform float uRippleStrength;
  uniform float uRippleSwirl;
  uniform float uRippleDispersion;
  uniform float uElasticShading;
  uniform float uGlazeStrength;
  varying vec2 vUv;
  varying vec3 vElasticNormal;
  varying float vElasticDepth;

  const float TAU = 6.283185307179586;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise21(p);
      p = rotation * p * 2.03 + 9.17;
      amplitude *= 0.5;
    }
    return value;
  }

  float cornerInfluence(vec2 point, vec2 pointer, vec2 corner) {
    vec2 pointDelta = point - corner;
    vec2 pointerDelta = pointer - corner;
    return exp(-dot(pointDelta, pointDelta) * 26.0)
      * exp(-dot(pointerDelta, pointerDelta) * 13.0);
  }

  vec2 coverUv(vec2 uv) {
    if (uImageAspect > uPlaneAspect) {
      uv.x = (uv.x - 0.5) * (uPlaneAspect / uImageAspect) + 0.5;
    } else {
      uv.y = (uv.y - 0.5) * (uImageAspect / uPlaneAspect) + 0.5;
    }
    return uv;
  }

  float roundedMask(vec2 uv, float radius) {
    vec2 point = (uv - 0.5) * uSize;
    vec2 bounds = uSize * 0.5 - vec2(radius);
    float distanceToEdge = length(max(abs(point) - bounds, 0.0)) - radius;
    return 1.0 - smoothstep(-1.25, 1.25, distanceToEdge);
  }

  void main() {
    vec2 pointerDelta = vUv - uPointer;
    float pointerDistance = length(pointerDelta);
    float pointerInfluence = exp(-pointerDistance * pointerDistance * uPointerFalloff);
    float glazeInfluence = pointerInfluence * uHover;
    float corners = cornerInfluence(vUv, uPointer, vec2(0.0, 0.0))
      + cornerInfluence(vUv, uPointer, vec2(1.0, 0.0))
      + cornerInfluence(vUv, uPointer, vec2(0.0, 1.0))
      + cornerInfluence(vUv, uPointer, vec2(1.0, 1.0));

    /*
     * The brush. uRippleRect places this card inside the shared displacement field, so a stroke
     * drawn across two cards bends both halves of it the same way instead of each card running its
     * own private distortion. The push direction turns with the amount, which is what gives the
     * trail its curl rather than a plain radial shove.
     */
    vec2 rippleUv = uRippleRect.xy + vUv * uRippleRect.zw;
    float rippleAmount = texture2D(uRipple, rippleUv).r;
    float theta = rippleAmount * uRippleSwirl * TAU;
    vec2 push = vec2(sin(theta), cos(theta)) * rippleAmount * uRippleStrength;

    vec2 uv = coverUv(vUv) + push;
    vec3 sampled;
    if (uRippleDispersion > 0.001) {
      float split = uRippleDispersion * 0.25;
      sampled.r = texture2D(uTexture, clamp(uv + push * split, 0.001, 0.999)).r;
      sampled.g = texture2D(uTexture, clamp(uv, 0.001, 0.999)).g;
      sampled.b = texture2D(uTexture, clamp(uv - push * split, 0.001, 0.999)).b;
    } else {
      sampled = texture2D(uTexture, clamp(uv, 0.001, 0.999)).rgb;
    }
    float alpha = texture2D(uTexture, clamp(uv, 0.001, 0.999)).a;
    float red = sampled.r;
    float green = sampled.g;
    float blue = sampled.b;

    /*
     * The photograph as it was authored — no vertical gradient, no warm re-tint, no brightness
     * multiplier. Those three lines used to sit right here and were what made every card read
     * darker at the top, warmer than the file, and (on the hero and the about page) 20% hotter
     * than the image actually is.
     */
    vec3 color = vec3(red, green, blue);

    /*
     * Elastic shading, measured against the flat sheet's own response: at rest the normal is
     * (0, 0, 1), so diff cancels diffFlat, spec cancels specFlat and the ambient occlusion
     * term is exactly 1 — the texture comes through untouched. Light only appears where the sheet
     * is genuinely bent, which is the point of it.
     */
    vec3 N = normalize(vElasticNormal);
    vec3 L = normalize(vec3(-0.35, 0.55, 0.78));
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float diffFlat = clamp(L.z, 0.0, 1.0);
    float diff = clamp(dot(N, L), 0.0, 1.0);
    float specFlat = pow(clamp(H.z, 0.0, 1.0), 26.0);
    float specRaw = pow(clamp(dot(N, H), 0.0, 1.0), 26.0);
    float spec = clamp((specRaw - specFlat) / max(1.0 - specFlat, 0.0001), 0.0, 1.0);
    float ao = clamp(1.0 + vElasticDepth * 0.9, 0.72, 1.2);

    color *= ao;
    color += color * (diff - diffFlat) * uElasticShading * 0.55;
    color += vec3(1.0, 0.96, 0.9) * spec * uElasticShading * 0.25;

    float glazeNoise = fbm(vUv * vec2(8.0, 6.0) + vec2(uTime * 0.07, -uTime * 0.05));
    float causticBand = sin((glazeNoise + pointerDistance * 1.8) * 11.0 - uTime * 0.46);
    float caustic = smoothstep(0.7, 0.98, causticBand) * glazeInfluence * 0.062;
    float glazeRingDistance = 0.2 + (glazeNoise - 0.5) * 0.055;
    float glazeRing = (1.0 - smoothstep(0.012, 0.052, abs(pointerDistance - glazeRingDistance))) * uHover;
    float cornerSheen = smoothstep(0.18, 0.82, corners) * uHover;
    color += vec3(1.0, 0.91, 0.8) * caustic * uGlazeStrength;
    color += vec3(1.0, 0.94, 0.86) * glazeRing * 0.027 * uGlazeStrength;
    color += vec3(0.97, 0.88, 0.76) * cornerSheen * 0.018 * uGlazeStrength;
    color = mix(
      color,
      color * vec3(1.025, 1.003, 0.98),
      glazeInfluence * 0.065 * uGlazeStrength
    );

    float grain = hash21(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5;
    color += grain * 0.004;

    float mask = roundedMask(vUv, 15.0);
    gl_FragColor = vec4(color, alpha * mask);
  }
`

export type CardRect = { left: number; top: number; width: number; height: number }

type ElasticSheet = {
  n: number
  count: number
  aspect: number
  baseX: Float32Array
  baseY: Float32Array
  pos: Float32Array
  vel: Float32Array
  accel: Float32Array
  offsets: Float32Array
  normals: Float32Array
  offsetAttribute: THREE.BufferAttribute
  normalAttribute: THREE.BufferAttribute
  accumulator: number
  settled: boolean
}

/*
 * A card is an n x n lattice rather than a PlaneGeometry, because the simulation needs to address
 * nodes by (i, j) and every node needs a neighbour lookup. `position` holds the flat rest sheet in
 * the local +/-0.5 box the meshes are scaled from; `aOffset` and `aElasticNormal` are the two
 * buffers the simulation rewrites each frame.
 */
function createElasticSheet(n: number): {
  geometry: THREE.BufferGeometry
  sheet: ElasticSheet
} {
  const count = n * n
  const position = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const offsets = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const index = j * n + i
      const u = i / (n - 1)
      const v = j / (n - 1)
      position[index * 3] = u - 0.5
      position[index * 3 + 1] = v - 0.5
      uv[index * 2] = u
      uv[index * 2 + 1] = v
      normals[index * 3 + 2] = 1
    }
  }

  const indices = new Uint16Array((n - 1) * (n - 1) * 6)
  let cursor = 0
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i
      const b = a + 1
      const c = a + n
      const d = c + 1
      indices[cursor++] = a
      indices[cursor++] = c
      indices[cursor++] = b
      indices[cursor++] = b
      indices[cursor++] = c
      indices[cursor++] = d
    }
  }

  const offsetAttribute = new THREE.BufferAttribute(offsets, 3)
  const normalAttribute = new THREE.BufferAttribute(normals, 3)
  offsetAttribute.setUsage(THREE.DynamicDrawUsage)
  normalAttribute.setUsage(THREE.DynamicDrawUsage)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute("aOffset", offsetAttribute)
  geometry.setAttribute("aElasticNormal", normalAttribute)
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  const sheet: ElasticSheet = {
    n,
    count,
    aspect: 1,
    baseX: new Float32Array(count),
    baseY: new Float32Array(count),
    pos: new Float32Array(count * 3),
    vel: new Float32Array(count * 3),
    accel: new Float32Array(count * 3),
    offsets,
    normals,
    offsetAttribute,
    normalAttribute,
    accumulator: 0,
    settled: true,
  }

  return { geometry, sheet }
}

/* The lattice lives in a space two units tall and 2*aspect wide, so the grab radius stays a
   circle on screen however the card is proportioned. */
function setSheetAspect(sheet: ElasticSheet, aspect: number) {
  if (sheet.aspect === aspect) return
  sheet.aspect = aspect
  const { n } = sheet
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const index = j * n + i
      sheet.baseX[index] = (i / (n - 1)) * 2 * aspect - aspect
      sheet.baseY[index] = (j / (n - 1)) * 2 - 1
    }
  }
}

function elasticSubstep(
  sheet: ElasticSheet,
  active: boolean,
  pointerX: number,
  pointerY: number
) {
  const { n, count, pos, vel, accel, baseX, baseY } = sheet
  const stiffness = ELASTIC.stiffness
  const retain = 1 - ELASTIC.damping
  const coupling = 0.06 + ELASTIC.wobble * 0.032
  const radius = Math.max(0.08, ELASTIC.grabRadius) * 1.4
  const invRadius = 1 / radius
  const force = ELASTIC.pull * 0.009

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const index = j * n + i
      const o = index * 3
      const ox = pos[o]
      const oy = pos[o + 1]
      const oz = pos[o + 2]

      let ax = -stiffness * ox
      let ay = -stiffness * oy
      let az = -stiffness * oz

      let sumX = 0
      let sumY = 0
      let sumZ = 0
      let neighbours = 0
      if (i > 0) {
        const nb = (index - 1) * 3
        sumX += pos[nb]
        sumY += pos[nb + 1]
        sumZ += pos[nb + 2]
        neighbours++
      }
      if (i < n - 1) {
        const nb = (index + 1) * 3
        sumX += pos[nb]
        sumY += pos[nb + 1]
        sumZ += pos[nb + 2]
        neighbours++
      }
      if (j > 0) {
        const nb = (index - n) * 3
        sumX += pos[nb]
        sumY += pos[nb + 1]
        sumZ += pos[nb + 2]
        neighbours++
      }
      if (j < n - 1) {
        const nb = (index + n) * 3
        sumX += pos[nb]
        sumY += pos[nb + 1]
        sumZ += pos[nb + 2]
        neighbours++
      }
      ax += coupling * (sumX - neighbours * ox)
      ay += coupling * (sumY - neighbours * oy)
      az += coupling * (sumZ - neighbours * oz)

      if (active) {
        const dx = pointerX - (baseX[index] + ox)
        const dy = pointerY - (baseY[index] + oy)
        const distance = Math.sqrt(dx * dx + dy * dy)
        const normalized = distance * invRadius
        if (normalized < 1) {
          const bump = 1 - normalized * normalized
          az += force * bump * bump * 6
          if (distance > 1e-4) {
            const pinch = normalized * (1 - normalized) * (1 - normalized) * 6.75
            const direction = (force * pinch * 1.6) / distance
            ax += dx * direction
            ay += dy * direction
          }
        }
      }

      accel[o] = ax
      accel[o + 1] = ay
      accel[o + 2] = az
    }
  }

  for (let k = 0; k < count; k++) {
    const o = k * 3
    const vx = (vel[o] + accel[o]) * retain
    const vy = (vel[o + 1] + accel[o + 1]) * retain
    const vz = (vel[o + 2] + accel[o + 2]) * retain
    vel[o] = vx
    vel[o + 1] = vy
    vel[o + 2] = vz

    pos[o] = Math.min(1.2, Math.max(-1.2, pos[o] + vx))
    pos[o + 1] = Math.min(1.2, Math.max(-1.2, pos[o + 1] + vy))
    pos[o + 2] = Math.min(1.2, Math.max(-1.2, pos[o + 2] + vz))
  }
}

/* Normals come from the deformed neighbours rather than from the analytic plane — that is what
   makes a pinched card catch the light along the fold. Returns the largest offset+velocity found,
   which is how the caller knows the sheet has come back to rest. */
function commitElasticSheet(sheet: ElasticSheet): number {
  const { n, pos, vel, baseX, baseY, offsets, normals, aspect } = sheet
  const invX = 1 / (2 * aspect)
  let residual = 0

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const index = j * n + i
      const o = index * 3
      const left = i > 0 ? index - 1 : index
      const right = i < n - 1 ? index + 1 : index
      const down = j > 0 ? index - n : index
      const up = j < n - 1 ? index + n : index

      const lx = baseX[left] + pos[left * 3]
      const ly = baseY[left] + pos[left * 3 + 1]
      const lz = pos[left * 3 + 2]
      const rx = baseX[right] + pos[right * 3]
      const ry = baseY[right] + pos[right * 3 + 1]
      const rz = pos[right * 3 + 2]
      const dx = baseX[down] + pos[down * 3]
      const dy = baseY[down] + pos[down * 3 + 1]
      const dz = pos[down * 3 + 2]
      const ux = baseX[up] + pos[up * 3]
      const uy = baseY[up] + pos[up * 3 + 1]
      const uz = pos[up * 3 + 2]

      const txx = rx - lx
      const txy = ry - ly
      const txz = rz - lz
      const tyx = ux - dx
      const tyy = uy - dy
      const tyz = uz - dz

      let nx = txy * tyz - txz * tyy
      let ny = txz * tyx - txx * tyz
      let nz = txx * tyy - txy * tyx
      if (nz < 0) {
        nx = -nx
        ny = -ny
        nz = -nz
      }
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      normals[o] = nx / length
      normals[o + 1] = ny / length
      normals[o + 2] = nz / length

      // Lattice units back into the local +/-0.5 box the geometry is built in.
      offsets[o] = pos[o] * invX
      offsets[o + 1] = pos[o + 1] * 0.5
      offsets[o + 2] = pos[o + 2] * 0.5

      const magnitude =
        Math.abs(pos[o]) + Math.abs(pos[o + 1]) + Math.abs(pos[o + 2]) +
        Math.abs(vel[o]) + Math.abs(vel[o + 1]) + Math.abs(vel[o + 2])
      if (magnitude > residual) residual = magnitude
    }
  }

  sheet.offsetAttribute.needsUpdate = true
  sheet.normalAttribute.needsUpdate = true
  return residual
}

function advanceElasticSheet(
  sheet: ElasticSheet,
  delta: number,
  active: boolean,
  pointerX: number,
  pointerY: number
) {
  if (sheet.settled && !active) return

  sheet.accumulator += delta
  let substeps = 0
  while (sheet.accumulator >= ELASTIC_STEP && substeps < ELASTIC_MAX_SUBSTEPS) {
    elasticSubstep(sheet, active, pointerX, pointerY)
    sheet.accumulator -= ELASTIC_STEP
    substeps++
  }
  if (sheet.accumulator > ELASTIC_STEP) sheet.accumulator = 0
  if (!substeps) return

  const residual = commitElasticSheet(sheet)
  sheet.settled = !active && residual < ELASTIC_REST_EPSILON
}
function getCardRects(width: number, height: number, images: readonly GlazeImage[]): CardRect[] {
  if (width <= 640) {
    return [
      { left: width * 0.03, top: height * 0.22, width: width * 0.64, height: (width * 0.64) / images[0].aspect },
      { left: width * 0.45, top: height * 0.41, width: width * 0.32, height: (width * 0.32) / images[1].aspect },
      { left: width * 0.12, top: height * 0.6, width: width * 0.7, height: (width * 0.7) / images[2].aspect },
    ]
  }

  const widths = [width * 0.31, width * 0.165, width * 0.32]
  return [
    { left: width * 0.045, top: height * 0.115, width: widths[0], height: widths[0] / images[0].aspect },
    { left: width * 0.24, top: height * 0.285, width: widths[1], height: widths[1] / images[1].aspect },
    { left: width * 0.34, top: height * 0.47, width: widths[2], height: widths[2] / images[2].aspect },
  ]
}

export default function FAQImageShader({
  pointerX,
  pointerY,
  variant = "default",
  imageSet = faqImages,
  layout = getCardRects,
  classNames = {
    root: "faqShaderCanvas",
    shadows: "faqShaderShadows",
    fallback: "faqShaderFallback",
    fallbackImage: "faqShaderFallbackImage",
  },
}: FAQImageShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const shadersEnabled = useShadersEnabled()

  useEffect(() => {
    /* No canvas is rendered when shaders are off, so there is nothing to attach to and none of
       the three.js setup below runs — no renderer, no textures, no rAF loop. `ready` stays false,
       which is what keeps the fallback images at full opacity (see the `.is-ready` rules in the
       shader stylesheets). */
    if (!shadersEnabled) return

    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    let renderer: THREE.WebGLRenderer | null = null
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1
    let rects: CardRect[] = []
    let elapsed = 0
    let previousTime = performance.now()
    let previousPointer = new THREE.Vector2(pointerX.get(), pointerY.get())
    const targetPointer = new THREE.Vector2(previousPointer.x, previousPointer.y)
    const pointer = new THREE.Vector2(previousPointer.x, previousPointer.y)
    const nextPointer = new THREE.Vector2()
    let energy = 0
    const scene = new THREE.Scene()
    const isHero = variant === "hero"
    const isAbout = variant === "about" || isHero
    const cameraDistance = 1000
    const camera = isAbout
      ? new THREE.PerspectiveCamera(45, 1, 0.1, 2200)
      : new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 20)
    camera.position.z = isAbout ? cameraDistance : 10
    const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = []
    const sheets: ElasticSheet[] = []

    /*
     * The brush's displacement field. One per shader instance and shared by every card in it, in a
     * space that covers the host plus whatever the cards overhang it by — the home hero's card is
     * 7% wider than its host, and sampling a field that stopped at the host edge would have smeared
     * the clamped border texel down the whole side of it.
     */
    const ripple: RippleSettings = isHero
      ? { brushSize: 210, strength: 0.007, swirl: 1, rings: 3, spread: 4, fade: 1.3, spacing: 30 }
      : isAbout
        ? { brushSize: 180, strength: 0.012, swirl: 1, rings: 3, spread: 4.5, fade: 1.7, spacing: 24 }
        : { brushSize: 155, strength: 0.016, swirl: 1, rings: 4, spread: 5, fade: 2.1, spacing: 20 }

    const rippleScene = new THREE.Scene()
    const rippleCamera = new THREE.Camera()
    const rippleTarget = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    })

    const waveOffsets = new Float32Array(RIPPLE_MAX_WAVES * 2)
    const waveScales = new Float32Array(RIPPLE_MAX_WAVES * 2)
    const waveOpacities = new Float32Array(RIPPLE_MAX_WAVES)
    const waves = Array.from({ length: RIPPLE_MAX_WAVES }, () => ({
      x: 0,
      y: 0,
      scale: RIPPLE_START_SCALE,
      target: RIPPLE_START_SCALE,
      size: 1,
      opacity: 0,
    }))
    let waveCursor = 0
    let liveWaves = 0
    /* One extra clear after the last wave dies, so the field is left black rather than frozen. */
    let rippleDirty = true

    const waveGeometry = new THREE.InstancedBufferGeometry()
    waveGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]),
        3
      )
    )
    waveGeometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
        2
      )
    )
    const offsetAttribute = new THREE.InstancedBufferAttribute(waveOffsets, 2)
    const scaleAttribute = new THREE.InstancedBufferAttribute(waveScales, 2)
    const opacityAttribute = new THREE.InstancedBufferAttribute(waveOpacities, 1)
    offsetAttribute.setUsage(THREE.DynamicDrawUsage)
    scaleAttribute.setUsage(THREE.DynamicDrawUsage)
    opacityAttribute.setUsage(THREE.DynamicDrawUsage)
    waveGeometry.setAttribute("iOffset", offsetAttribute)
    waveGeometry.setAttribute("iScale", scaleAttribute)
    waveGeometry.setAttribute("iOpacity", opacityAttribute)
    waveGeometry.instanceCount = RIPPLE_MAX_WAVES

    const waveMaterial = new THREE.RawShaderMaterial({
      vertexShader: rippleVertexShader,
      fragmentShader: rippleFragmentShader,
      uniforms: { uRings: { value: ripple.rings } },
      depthTest: false,
      depthWrite: false,
      /* Additive, so overlapping stamps in a stroke build one continuous ridge. */
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    })
    const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial)
    waveMesh.frustumCulled = false
    rippleScene.add(waveMesh)

    /* Field bounds in host pixels: the union of the host box and every card. */
    let fieldLeft = 0
    let fieldTop = 0
    let fieldWidth = 1
    let fieldHeight = 1
    let lastStampX = 0
    let lastStampY = 0

    const stampWave = (hostX: number, hostY: number) => {
      const wave = waves[waveCursor]
      waveCursor = (waveCursor + 1) % RIPPLE_MAX_WAVES
      wave.x = hostX
      wave.y = hostY
      wave.scale = RIPPLE_START_SCALE
      wave.target = RIPPLE_START_SCALE * ripple.spread
      wave.size = ripple.brushSize
      wave.opacity = 1
    }
    const textures: THREE.Texture[] = []
    let pointerInsideHero = false

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") return
      const bounds = host.getBoundingClientRect()
      const isInside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom

      if (isInside) {
        pointerInsideHero = true
        targetPointer.set(
          (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5,
          (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5
        )

        /* A stamp every `spacing` pixels of travel rather than one per event, so the density of
           the stroke follows the distance moved and not the pointer's report rate. */
        const hostX = event.clientX - bounds.left
        const hostY = event.clientY - bounds.top
        if (
          Math.abs(hostX - lastStampX) > ripple.spacing ||
          Math.abs(hostY - lastStampY) > ripple.spacing
        ) {
          stampWave(hostX, hostY)
          lastStampX = hostX
          lastStampY = hostY
        }
      } else {
        pointerInsideHero = false
        targetPointer.set(0, 0)
      }
    }

    const resize = () => {
      if (!renderer) return
      const bounds = host.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      rects = layout(width, height, imageSet)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
      renderer.setSize(width, height, false)
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = width / height
        camera.fov = THREE.MathUtils.radToDeg(
          2 * Math.atan(height / (2 * cameraDistance))
        )
      } else {
        camera.left = -width / 2
        camera.right = width / 2
        camera.top = height / 2
        camera.bottom = -height / 2
      }
      camera.updateProjectionMatrix()

      fieldLeft = 0
      fieldTop = 0
      let fieldRight = width
      let fieldBottom = height
      rects.forEach((rect) => {
        fieldLeft = Math.min(fieldLeft, rect.left)
        fieldTop = Math.min(fieldTop, rect.top)
        fieldRight = Math.max(fieldRight, rect.left + rect.width)
        fieldBottom = Math.max(fieldBottom, rect.top + rect.height)
      })
      fieldWidth = Math.max(1, fieldRight - fieldLeft)
      fieldHeight = Math.max(1, fieldBottom - fieldTop)
      rippleTarget.setSize(
        Math.max(2, Math.min(RIPPLE_MAX_FIELD, Math.round(fieldWidth * RIPPLE_QUALITY))),
        Math.max(2, Math.min(RIPPLE_MAX_FIELD, Math.round(fieldHeight * RIPPLE_QUALITY)))
      )
      rippleDirty = true

      meshes.forEach((mesh, index) => {
        const rect = rects[index]
        mesh.scale.set(
          rect.width,
          rect.height,
          isAbout ? Math.min(rect.width, rect.height) : 1
        )
        mesh.position.set(
          rect.left + rect.width / 2 - width / 2,
          height / 2 - rect.top - rect.height / 2,
          index === 1 ? 1.2 : index === 2 ? 0.6 : 0
        )
        mesh.material.uniforms.uPlaneAspect.value = rect.width / rect.height
        mesh.material.uniforms.uSize.value.set(rect.width, rect.height)
        /* Card uv v=0 is its bottom edge, and the field's v=0 is the field's bottom edge, so the
           card's origin in field space is measured from its *lower* side. */
        mesh.material.uniforms.uRippleRect.value.set(
          (rect.left - fieldLeft) / fieldWidth,
          1 - (rect.top + rect.height - fieldTop) / fieldHeight,
          rect.width / fieldWidth,
          rect.height / fieldHeight
        )
        setSheetAspect(sheets[index], rect.width / rect.height)
      })
    }

    const placeMeshes = () => {
      meshes.forEach((mesh, index) => {
        const rect = rects[index]
        const depth = [9, -12, 7][index]
        const targetX = rect.left + rect.width / 2 - width / 2 + pointer.x * depth
        const targetY = height / 2 - rect.top - rect.height / 2 - pointer.y * depth
        const positionEase = isAbout ? 0.052 : 0.075
        const rotationEase = isAbout ? 0.045 : 0.07
        mesh.position.x += (targetX - mesh.position.x) * positionEase
        mesh.position.y += (targetY - mesh.position.y) * positionEase
        mesh.position.z = index === 1 ? 1.2 : index === 2 ? 0.6 : 0
        mesh.rotation.x += ((-pointer.y * [0.011, -0.014, 0.009][index]) - mesh.rotation.x) * rotationEase
        mesh.rotation.y += ((pointer.x * [0.014, -0.017, 0.011][index]) - mesh.rotation.y) * rotationEase
      })
    }

    const animate = (now: number) => {
      if (disposed || !renderer) return
      const delta = Math.min((now - previousTime) / 1000, 0.05)
      previousTime = now
      elapsed += delta

      const nextX = targetPointer.x
      const nextY = targetPointer.y
      const dx = nextX - previousPointer.x
      const dy = nextY - previousPointer.y
      const instantaneousSpeed = Math.min(Math.hypot(dx, dy) / Math.max(delta, 0.001) * 0.42, 1)
      energy += (instantaneousSpeed - energy) * (
        instantaneousSpeed > energy
          ? (isAbout ? 0.16 : 0.34)
          : (isAbout ? 0.04 : 0.028)
      )
      nextPointer.set(nextX, nextY)
      pointer.lerp(nextPointer, isAbout ? 0.052 : 0.09)
      previousPointer.set(nextX, nextY)

      /*
       * Wave integration, straight from the reference: each stamp eases out towards its target
       * scale while its opacity decays to 1/500 over `fade` seconds. Opacity is squared in the
       * stamp shader, so the tail thins faster than it shrinks — the stroke fades rather than
       * collapsing.
       */
      const growth = 1 - Math.exp(-delta * 1.09)
      const decay = Math.exp((-delta * RIPPLE_LIFE_CONSTANT) / Math.max(0.15, ripple.fade))
      liveWaves = 0
      for (let index = 0; index < RIPPLE_MAX_WAVES; index++) {
        const wave = waves[index]
        if (wave.opacity <= 0) {
          waveOpacities[index] = 0
          continue
        }
        wave.opacity *= decay
        wave.scale += (wave.target - wave.scale) * growth
        if (wave.opacity < 0.002) {
          wave.opacity = 0
          waveOpacities[index] = 0
          continue
        }
        const half = (wave.scale * wave.size) / 2
        waveOffsets[index * 2] = ((wave.x - fieldLeft) / fieldWidth) * 2 - 1
        waveOffsets[index * 2 + 1] =
          (1 - (wave.y - fieldTop) / fieldHeight) * 2 - 1
        waveScales[index * 2] = (half / fieldWidth) * 2
        waveScales[index * 2 + 1] = (half / fieldHeight) * 2
        waveOpacities[index] = wave.opacity
        liveWaves++
      }

      if (liveWaves > 0 || rippleDirty) {
        offsetAttribute.needsUpdate = true
        scaleAttribute.needsUpdate = true
        opacityAttribute.needsUpdate = true
        renderer.setRenderTarget(rippleTarget)
        renderer.setClearColor(0x000000, 1)
        renderer.clear(true, false, false)
        renderer.render(rippleScene, rippleCamera)
        renderer.setRenderTarget(null)
        renderer.setClearColor(0x000000, 0)
        rippleDirty = liveWaves > 0
      }

      placeMeshes()
      meshes.forEach((mesh, index) => {
        const rect = rects[index]
        const localX = (pointer.x + 0.5) * width
        const localY = (pointer.y + 0.5) * height
        mesh.material.uniforms.uTime.value = elapsed + index * 1.7
        mesh.material.uniforms.uEnergy.value = 0.08 + energy * 0.55
        // Reduced-motion shader energy fallback, intentionally disabled for now:
        // mesh.material.uniforms.uEnergy.value = energy * 0.2
        mesh.material.uniforms.uPointer.value.set(
          (localX - rect.left) / rect.width,
          1 - (localY - rect.top) / rect.height
        )
        const isHovered = pointerInsideHero
          && localX >= rect.left
          && localX <= rect.left + rect.width
          && localY >= rect.top
          && localY <= rect.top + rect.height
        const hoverTarget = isHovered ? 1 : 0
        mesh.material.uniforms.uHover.value += (
          hoverTarget - mesh.material.uniforms.uHover.value
        ) * (isAbout ? 0.045 : 0.075)

        /* The lattice is grabbed by the same pointer the shader already resolved for this card,
           re-expressed in its own lattice box. Once the cursor leaves and the springs have run
           down, `advanceElasticSheet` stops integrating entirely. */
        const sheet = sheets[index]
        const cardPointer = mesh.material.uniforms.uPointer.value
        advanceElasticSheet(
          sheet,
          delta,
          isHovered,
          (cardPointer.x * 2 - 1) * sheet.aspect,
          cardPointer.y * 2 - 1
        )
      })

      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }

    const start = async () => {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" })
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.setClearColor(0x000000, 0)

        const loader = new THREE.TextureLoader()
        const loadedTextures = await Promise.all(imageSet.map(({ src }) => loader.loadAsync(src)))
        if (disposed) {
          loadedTextures.forEach((texture) => texture.dispose())
          return
        }

        loadedTextures.forEach((texture, index) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          textures.push(texture)
          const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide,
            uniforms: {
              uTexture: { value: texture },
              uTime: { value: 0 },
              uEnergy: { value: 0 },
              uHover: { value: 0 },
              uImageAspect: { value: imageSet[index].aspect },
              uPlaneAspect: { value: imageSet[index].aspect },
              uPointer: { value: new THREE.Vector2(0.5, 0.5) },
              uSize: { value: new THREE.Vector2(1, 1) },
              uPointerFalloff: { value: isHero ? 2.65 : isAbout ? 3.1 : 6.8 },
              uCornerStrength: { value: isHero ? 0.3 : isAbout ? 0.46 : 1 },
              uCornerMotion: { value: isHero ? 0.024 : isAbout ? 0.08 : 1 },
              uDepthStrength: { value: isHero ? 0.062 : isAbout ? 0.038 : 0 },
              /* The brush: the pointer-led smear, ripple and chromatic drag over the photo.
                 Heavily pulled back on the home hero on request — it stays, it just no longer
                 works the image. The other two surfaces are unchanged. */
              uRipple: { value: rippleTarget.texture },
              uRippleRect: { value: new THREE.Vector4(0, 0, 1, 1) },
              uRippleStrength: { value: ripple.strength },
              uRippleSwirl: { value: ripple.swirl },
              /* No chromatic split and no re-tint: the photograph stays the photograph. */
              uRippleDispersion: { value: 0 },
              uElasticShading: { value: isHero ? 0.42 : isAbout ? 0.46 : 0.5 },
              uGlazeStrength: { value: isHero ? 0.045 : 1 },
            },
          })
          /* One card gets a denser lattice than three do: the cost is O(n^2) per substep and
             the hero has a single sheet where the FAQ has three. */
          const { geometry, sheet } = createElasticSheet(isHero ? 26 : isAbout ? 22 : 18)
          sheets.push(sheet)
          const mesh = new THREE.Mesh(geometry, material)
          /* The lattice pushes vertices past the flat plane's bounds, and three derives the
             bounding sphere from the rest positions — leave culling on and a deformed card can
             pop out at the edge of the viewport. There are at most three of them. */
          mesh.frustumCulled = false
          mesh.renderOrder = index === 1 ? 3 : index + 1
          meshes.push(mesh)
          scene.add(mesh)
        })

        resize()
        placeMeshes()
        setReady(true)
        frame = requestAnimationFrame(animate)
      } catch (error) {
        setFailed(true)
        console.warn("The FAQ image shader could not start; using the static image fallback.", error)
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    window.addEventListener("pointermove", handlePointerMove, { passive: true, capture: true })
    void start()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("pointermove", handlePointerMove, true)
      meshes.forEach((mesh) => {
        mesh.geometry.dispose()
        mesh.material.dispose()
      })
      textures.forEach((texture) => texture.dispose())
      waveGeometry.dispose()
      waveMaterial.dispose()
      rippleTarget.dispose()
      renderer?.dispose()
    }
  }, [imageSet, layout, pointerX, pointerY, variant, shadersEnabled])

  return (
    <div
      className={`${classNames.root} ${ready ? "is-ready" : ""} ${failed ? "is-error" : ""}`}
      data-shader-state={
        !shadersEnabled ? "disabled" : failed ? "error" : ready ? "ready" : "loading"
      }
      aria-hidden="true"
    >
      <div className={classNames.shadows}>
        {imageSet.map((image) => <i key={image.src} />)}
      </div>
      {shadersEnabled && <canvas ref={canvasRef} />}
      <div className={classNames.fallback}>
        {imageSet.map((image) => (
          <div className={classNames.fallbackImage} key={image.src}>
            <Image src={image.src} alt="" fill sizes="(max-width: 640px) 70vw, 32vw" priority />
          </div>
        ))}
      </div>
    </div>
  )
}
