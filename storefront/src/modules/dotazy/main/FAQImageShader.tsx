"use client"

import type { MotionValue } from "framer-motion"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
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

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uHover;
  uniform vec2 uPointer;
  uniform vec2 uVelocity;
  uniform float uPointerFalloff;
  uniform float uCornerStrength;
  uniform float uCornerMotion;
  uniform float uDepthStrength;
  varying vec2 vUv;

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
    vec3 displaced = position;
    float energy = clamp(uEnergy, 0.0, 1.0);
    vec2 pointerDelta = uv - uPointer;
    float pointerDistance = length(pointerDelta);
    float pointerInfluence = exp(-pointerDistance * pointerDistance * uPointerFalloff);
    float glazeInfluence = pointerInfluence * uHover;
    float time = uTime * (0.34 + energy * 0.8);
    float broadNoise = vertexNoise(uv * vec2(3.4, 3.0) + vec2(time * 0.34, -time * 0.27)) - 0.5;
    float crossNoise = vertexNoise(uv.yx * vec2(5.0, 4.2) + vec2(-time * 0.42, time * 0.31)) - 0.5;
    float ripple = sin(pointerDistance * 28.0 - uTime * 7.0) * pointerInfluence;
    float hoverWaveX = sin(uv.y * 9.4248 + uTime * 1.15) * cos(uv.x * 6.2832 - uTime * 0.7);
    float hoverWaveY = cos(uv.x * 9.4248 - uTime * 0.95) * sin(uv.y * 6.2832 + uTime * 0.62);
    float corners = cornerInfluence(uv, uPointer, vec2(0.0, 0.0))
      + cornerInfluence(uv, uPointer, vec2(1.0, 0.0))
      + cornerInfluence(uv, uPointer, vec2(0.0, 1.0))
      + cornerInfluence(uv, uPointer, vec2(1.0, 1.0));
    float animatedCornerPulse = 0.72 + sin(uTime * 1.35 + (uv.x + uv.y) * 5.0) * 0.28;
    float cornerPulse = mix(1.0, animatedCornerPulse, uCornerMotion);
    vec2 cornerDirection = normalize(uv - 0.5 + vec2(0.0001));
    float strength = energy * 0.009 + glazeInfluence * 0.008;

    displaced.x += (broadNoise * 0.62 + ripple * 0.18) * strength;
    displaced.y += (crossNoise * 0.54 + ripple * 0.13) * strength;
    displaced.x += hoverWaveX * glazeInfluence * 0.0038;
    displaced.y += hoverWaveY * glazeInfluence * 0.003;
    displaced.xy += cornerDirection * corners * uHover * cornerPulse * (0.015 + energy * 0.009) * uCornerStrength;
    displaced.x += uVelocity.x * glazeInfluence * energy * 0.0035;
    displaced.y += uVelocity.y * glazeInfluence * energy * 0.0035;
    displaced.z += pointerInfluence * uHover * uDepthStrength * (0.72 + broadNoise * 0.18);
    displaced.z += corners * uHover * uDepthStrength * 0.22;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uHover;
  uniform float uImageAspect;
  uniform float uPlaneAspect;
  uniform vec2 uPointer;
  uniform vec2 uVelocity;
  uniform vec2 uSize;
  uniform float uPointerFalloff;
  uniform float uDistortionStrength;
  uniform float uBrightness;
  uniform float uGlazeStrength;
  varying vec2 vUv;

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
    float movingEnergy = clamp(uEnergy, 0.0, 1.0);
    float amplitude = (0.0008 + movingEnergy * 0.006 + glazeInfluence * 0.009) * uDistortionStrength;

    vec2 field = vUv * vec2(5.0, 4.0);
    float time = uTime * (0.18 + movingEnergy * 0.72);
    float waveX = fbm(field + vec2(time, -time * 0.62));
    float waveY = fbm(field.yx * 1.13 + vec2(-time * 0.74, time));
    vec2 wave = (vec2(waveX, waveY) - 0.5) * amplitude;
    float ripple = sin(pointerDistance * 38.0 - uTime * 8.5) * pointerInfluence * movingEnergy;
    vec2 radialDirection = normalize(pointerDelta + vec2(0.0001));
    float lens = (1.0 - smoothstep(0.0, 0.62, pointerDistance)) * glazeInfluence;
    float corners = cornerInfluence(vUv, uPointer, vec2(0.0, 0.0))
      + cornerInfluence(vUv, uPointer, vec2(1.0, 0.0))
      + cornerInfluence(vUv, uPointer, vec2(0.0, 1.0))
      + cornerInfluence(vUv, uPointer, vec2(1.0, 1.0));
    wave -= pointerDelta * lens * 0.016;
    wave += radialDirection * ripple * uHover * 0.0055;
    wave += uVelocity * glazeInfluence * movingEnergy * 0.008;
    wave -= normalize(vUv - 0.5 + vec2(0.0001)) * corners * uHover * 0.011;

    vec2 uv = coverUv(vUv + wave);
    vec2 chroma = (wave + uVelocity * 0.001) * glazeInfluence * movingEnergy * 0.12;
    float red = texture2D(uTexture, clamp(uv + chroma, 0.001, 0.999)).r;
    float green = texture2D(uTexture, clamp(uv, 0.001, 0.999)).g;
    float blue = texture2D(uTexture, clamp(uv - chroma, 0.001, 0.999)).b;
    float alpha = texture2D(uTexture, clamp(uv, 0.001, 0.999)).a;

    vec3 color = vec3(red, green, blue);
    color *= mix(0.91, 1.025, vUv.y);
    color = mix(color, color * vec3(1.025, 0.985, 0.95), 0.12 + movingEnergy * 0.08);
    color *= uBrightness;

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

  useEffect(() => {
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
    const instantaneousVelocity = new THREE.Vector2()
    const velocity = new THREE.Vector2()
    let energy = 0
    const scene = new THREE.Scene()
    const isHero = variant === "hero"
    const isAbout = variant === "about" || isHero
    const cameraDistance = 1000
    const camera = isAbout
      ? new THREE.PerspectiveCamera(45, 1, 0.1, 2200)
      : new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 20)
    camera.position.z = isAbout ? cameraDistance : 10
    const meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
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
      instantaneousVelocity.set(dx, -dy).multiplyScalar(22)
      nextPointer.set(nextX, nextY)
      velocity.lerp(instantaneousVelocity, isAbout ? 0.085 : 0.16)
      pointer.lerp(nextPointer, isAbout ? 0.052 : 0.09)
      previousPointer.set(nextX, nextY)

      placeMeshes()
      meshes.forEach((mesh, index) => {
        const rect = rects[index]
        const localX = (pointer.x + 0.5) * width
        const localY = (pointer.y + 0.5) * height
        mesh.material.uniforms.uTime.value = elapsed + index * 1.7
        mesh.material.uniforms.uEnergy.value = 0.08 + energy * 0.55
        // Reduced-motion shader energy fallback, intentionally disabled for now:
        // mesh.material.uniforms.uEnergy.value = energy * 0.2
        mesh.material.uniforms.uVelocity.value.copy(velocity)
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
              uVelocity: { value: new THREE.Vector2() },
              uSize: { value: new THREE.Vector2(1, 1) },
              uPointerFalloff: { value: isHero ? 2.65 : isAbout ? 3.1 : 6.8 },
              uCornerStrength: { value: isHero ? 0.3 : isAbout ? 0.46 : 1 },
              uCornerMotion: { value: isHero ? 0.024 : isAbout ? 0.08 : 1 },
              uDepthStrength: { value: isHero ? 0.062 : isAbout ? 0.038 : 0 },
              uDistortionStrength: { value: isHero ? 0.44 : isAbout ? 0.96 : 1 },
              uBrightness: { value: isHero ? 1.2 : isAbout ? 1.22 : 1 },
              uGlazeStrength: { value: isHero ? 0.045 : 1 },
            },
          })
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(
              1,
              1,
              isAbout ? 36 : 28,
              isAbout ? 28 : 20
            ),
            material
          )
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
      renderer?.dispose()
    }
  }, [imageSet, layout, pointerX, pointerY, variant])

  return (
    <div
      className={`${classNames.root} ${ready ? "is-ready" : ""} ${failed ? "is-error" : ""}`}
      data-shader-state={failed ? "error" : ready ? "ready" : "loading"}
      aria-hidden="true"
    >
      <div className={classNames.shadows}>
        {imageSet.map((image) => <i key={image.src} />)}
      </div>
      <canvas ref={canvasRef} />
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
