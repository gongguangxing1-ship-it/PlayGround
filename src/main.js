import * as THREE from 'three'
import { buildWorld, resolveCollision, MAP_HALF } from './world.js'
import { createSoldier } from './soldier.js'
import './style.css'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const rand = (min, max) => min + Math.random() * (max - min)
const lerp = (a, b, t) => a + (b - a) * t

const params = new URLSearchParams(window.location.search)
const forceTouch = params.has('touch')
const IS_TOUCH =
  forceTouch ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
  (navigator.maxTouchPoints || 0) > 0

const PLAYER_RADIUS = 0.42
const WALK_SPEED = 5.3
const SPRINT_SPEED = 8.3
const GRAVITY = 18
const JUMP_SPEED = 5.6
const FIRE_INTERVAL = 0.095
const MAG_SIZE = 30
const RELOAD_TIME = 1.9
const BOT_COUNT = 11
const AIM_ASSIST = IS_TOUCH ? 0.55 : 0.16
const VICTORY_DELAY = 1.2

const ZONE_PHASES = [
  { radius: 74, wait: 16, shrink: 12, dps: 2 },
  { radius: 52, wait: 14, shrink: 11, dps: 3 },
  { radius: 34, wait: 12, shrink: 10, dps: 5 },
  { radius: 20, wait: 10, shrink: 9, dps: 7 },
  { radius: 10, wait: 9, shrink: 8, dps: 10 },
  { radius: 4.5, wait: 8, shrink: 8, dps: 14 }
]

const BOT_NAMES = ['夜鹰', '雷豹', '孤狼', '闪电', '铁壁', '幽灵', '红隼', '猎手', '白鲨', '山猫', '疾风', '断刃', '寒鸦', '赤狐', '黑曜']
const BOT_UNIFORMS = [0x5d6b48, 0x6d6a52, 0x4c5a60, 0x6b5b45, 0x545c46, 0x5f5346, 0x4a5340]
const BOT_ACCENTS = [0xd9534f, 0xe0a53a, 0x5a8fd6, 0x8a6fb5, 0x5fae72, 0xc9793d]

const SPAWN_POINTS = [
  [-72, -52],
  [64, -64],
  [-62, 66],
  [70, 58],
  [8, 78],
  [-84, 8],
  [82, -6],
  [-8, -74],
  [40, 0],
  [-42, -8]
]

const canvas = document.getElementById('scene')
const overlay = document.getElementById('overlay')
const pausedScreen = document.getElementById('paused')
const resultScreen = document.getElementById('result')
const fatalScreen = document.getElementById('fatal')
const playBtn = document.getElementById('play-btn')
const retryBtn = document.getElementById('retry-btn')
const lobbyBtn = document.getElementById('lobby-btn')
const quitBtn = document.getElementById('quit-btn')
const pauseBtn = document.getElementById('pause-btn')
const resumeBtn = document.getElementById('resume-btn')

const aliveEl = document.getElementById('alive-count')
const killEl = document.getElementById('kill-count')
const healthFill = document.getElementById('health-fill')
const healthText = document.getElementById('health-text')
const armorFill = document.getElementById('armor-fill')
const armorText = document.getElementById('armor-text')
const ammoMagEl = document.getElementById('ammo-mag')
const ammoReserveEl = document.getElementById('ammo-reserve')
const medCountEl = document.getElementById('med-count')
const reloadMeter = document.getElementById('reload-meter')
const killfeedEl = document.getElementById('killfeed')
const zoneBanner = document.getElementById('zone-banner')
const pickupToast = document.getElementById('pickup-toast')
const zonePhaseEl = document.getElementById('zone-phase')
const zoneTimerEl = document.getElementById('zone-timer')
const minimapCanvas = document.getElementById('minimap')
const minimapCtx = minimapCanvas.getContext('2d')
const compassCanvas = document.getElementById('compass')
const compassCtx = compassCanvas.getContext('2d')
const damageFlashEl = document.getElementById('damage-flash')
const hitmarkerEl = document.getElementById('hitmarker')
const crosshairEl = document.getElementById('crosshair')
const joystickEl = document.getElementById('joystick')
const joystickKnob = document.getElementById('joystick-knob')
const fireBtn = document.getElementById('btn-fire')
const reloadBtn = document.getElementById('btn-reload')
const healBtn = document.getElementById('btn-heal')
const jumpBtn = document.getElementById('btn-jump')

const resultEyebrow = document.getElementById('result-eyebrow')
const resultTitle = document.getElementById('result-title')
const resultSub = document.getElementById('result-sub')
const resultRank = document.getElementById('result-rank')
const resultKills = document.getElementById('result-kills')
const resultDamage = document.getElementById('result-damage')
const resultTime = document.getElementById('result-time')
const resultPanel = resultScreen.querySelector('.panel')

const state = {
  started: false,
  paused: false,
  over: false,
  victory: false,
  ready: false,
  webgl: false,
  frames: 0,
  drawCalls: 0,
  alive: BOT_COUNT + 1,
  kills: 0,
  damage: 0,
  time: 0
}
window.__PEACE_STATE = state

const debug = {
  frozen: false,
  god: false
}

if (IS_TOUCH) document.body.classList.add('is-touch')

let renderer
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  })
  state.webgl = true
} catch (error) {
  console.error(error)
  document.body.dataset.appError = 'webgl'
  overlay.classList.add('hidden')
  fatalScreen.classList.remove('hidden')
  throw error
}

const shadows = !IS_TOUCH && params.get('shadows') !== '0'
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 1.75))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
if (shadows) {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 480)

const world = buildWorld(scene, { shadows })
const glowTexture = world.glowTexture

const tempA = new THREE.Vector3()
const tempB = new THREE.Vector3()
const tempC = new THREE.Vector3()
const tempD = new THREE.Vector3()
const tempE = new THREE.Vector3()

function makeShadowTexture() {
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 128
  const ctx = shadowCanvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.26)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(shadowCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const shadowTexture = makeShadowTexture()
const shadowGeometry = new THREE.PlaneGeometry(1.7, 1.7)
const shadowMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  toneMapped: false
})

function makeBlobShadow() {
  const mesh = new THREE.Mesh(shadowGeometry, shadowMaterial)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.035
  mesh.renderOrder = 1
  scene.add(mesh)
  return mesh
}

const player = {
  isPlayer: true,
  position: new THREE.Vector3(0, 0, 0),
  yaw: 0.35,
  pitch: -0.04,
  vy: 0,
  grounded: true,
  health: 100,
  armor: 0,
  alive: true,
  mag: MAG_SIZE,
  reserve: 120,
  medkits: 2,
  reloading: false,
  reloadTimer: 0,
  nextShot: 0,
  spread: 0,
  moving: false,
  healCooldown: 0,
  model: createSoldier({
    uniform: 0x5f6e4b,
    vest: 0x3b452f,
    accent: 0xf7b733,
    shadows
  }),
  blob: makeBlobShadow()
}
player.model.group.visible = true
scene.add(player.model.group)

const bots = []
const pickups = []
const BOT_RADIUS = 0.4

const zone = {
  radius: 96,
  cx: 0,
  cz: 0,
  targetRadius: 74,
  targetCx: 0,
  targetCz: 0,
  startRadius: 96,
  startCx: 0,
  startCz: 0,
  phase: 0,
  state: 'wait',
  timer: ZONE_PHASES[0].wait,
  shrink: ZONE_PHASES[0].shrink,
  dps: ZONE_PHASES[0].dps
}

const zoneGroup = new THREE.Group()
zoneGroup.visible = false
scene.add(zoneGroup)

const zoneWallMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x3fa9ff) }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float fade = pow(1.0 - vUv.y, 1.7);
      float bands = 0.55 + 0.45 * sin(vUv.y * 120.0 - uTime * 2.4);
      float pulse = 0.88 + 0.12 * sin(uTime * 3.2);
      float alpha = (0.15 + bands * 0.06) * fade * pulse;
      vec3 color = uColor * (0.75 + bands * 0.6);
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false
})

const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 46, 96, 1, true), zoneWallMaterial)
zoneWall.position.y = 23
zoneWall.renderOrder = 2
zoneGroup.add(zoneWall)

const zoneRing = new THREE.Mesh(
  new THREE.RingGeometry(0.976, 1, 180),
  new THREE.MeshBasicMaterial({
    color: 0x47b4ff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
)
zoneRing.rotation.x = -Math.PI / 2
zoneRing.position.y = 0.05
zoneGroup.add(zoneRing)

const nextRing = new THREE.Mesh(
  new THREE.RingGeometry(0.982, 1, 180),
  new THREE.MeshBasicMaterial({
    color: 0xf6fbff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
)
nextRing.rotation.x = -Math.PI / 2
nextRing.position.y = 0.07
zoneGroup.add(nextRing)

const tracers = []
for (let index = 0; index < 30; index += 1) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  const material = new THREE.LineBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
  const line = new THREE.Line(geometry, material)
  line.frustumCulled = false
  line.visible = false
  scene.add(line)
  tracers.push({ line, life: 0, max: 0.1 })
}

const sparkSprites = []
for (let index = 0; index < 24; index += 1) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffc46a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const sprite = new THREE.Sprite(material)
  sprite.visible = false
  sprite.scale.set(0.4, 0.4, 1)
  scene.add(sprite)
  sparkSprites.push({ sprite, life: 0, max: 0.24, size: 1 })
}

const muzzleSprites = []
for (let index = 0; index < 6; index += 1) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffdf9a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const sprite = new THREE.Sprite(material)
  sprite.visible = false
  sprite.scale.set(1.3, 1.3, 1)
  scene.add(sprite)
  muzzleSprites.push({ sprite, life: 0, max: 0.07 })
}

const muzzleLight = new THREE.PointLight(0xffb347, 0, 10, 2)
scene.add(muzzleLight)

function spawnTracer(from, to, color = 0xffd27a) {
  const tracer = tracers.find((item) => item.life <= 0) || tracers[0]
  const attribute = tracer.line.geometry.attributes.position
  attribute.setXYZ(0, from.x, from.y, from.z)
  attribute.setXYZ(1, to.x, to.y, to.z)
  attribute.needsUpdate = true
  tracer.line.material.color.set(color)
  tracer.line.material.opacity = 0.95
  tracer.line.visible = true
  tracer.life = tracer.max = rand(0.07, 0.12)
}

function spawnSpark(position, color = 0xffc46a, size = 0.7, life = 0.26) {
  const spark = sparkSprites.find((item) => item.life <= 0) || sparkSprites[0]
  spark.sprite.position.copy(position)
  spark.sprite.material.color.set(color)
  spark.sprite.material.opacity = 0.9
  spark.sprite.visible = true
  spark.sprite.scale.setScalar(size)
  spark.life = spark.max = life
  spark.size = size
}

function muzzleFlash(position) {
  const flash = muzzleSprites.find((item) => item.life <= 0) || muzzleSprites[0]
  flash.sprite.position.copy(position)
  flash.sprite.material.opacity = 0.95
  flash.sprite.visible = true
  flash.sprite.scale.setScalar(rand(0.9, 1.5))
  flash.life = flash.max = 0.06
  muzzleLight.position.copy(position)
  muzzleLight.intensity = 9
}

function updateEffects(dt) {
  for (const tracer of tracers) {
    if (tracer.life <= 0) continue
    tracer.life -= dt
    if (tracer.life <= 0) {
      tracer.line.visible = false
      tracer.line.material.opacity = 0
      continue
    }
    tracer.line.material.opacity = (tracer.life / tracer.max) * 0.95
  }

  for (const spark of sparkSprites) {
    if (spark.life <= 0) continue
    spark.life -= dt
    if (spark.life <= 0) {
      spark.sprite.visible = false
      spark.sprite.material.opacity = 0
      continue
    }
    const progress = 1 - spark.life / spark.max
    spark.sprite.material.opacity = (1 - progress) * 0.9
    spark.sprite.scale.setScalar(spark.size * (1 + progress * 2.4))
  }

  for (const flash of muzzleSprites) {
    if (flash.life <= 0) continue
    flash.life -= dt
    if (flash.life <= 0) {
      flash.sprite.visible = false
      flash.sprite.material.opacity = 0
      continue
    }
    flash.sprite.material.opacity = (flash.life / flash.max) * 0.95
  }

  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 90)
}

const keys = new Set()
let firing = false
let jumpQueued = false
let joystick = { x: 0, y: 0, active: false }
let lookPointer = null
let joystickPointer = null
let victoryDelay = 0
let shake = 0
let damageFlash = 0
let zonePulse = 0
let toastTimer = null
let compassTimer = 0
let minimapTimer = 0
let zoneUiTimer = 0
let lastHud = {}

let audioCtx = null
let noiseBuffer = null

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) return
  try {
    audioCtx = new AudioCtor()
    const length = Math.floor(audioCtx.sampleRate * 0.2)
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1
  } catch {
    audioCtx = null
  }
}

function tone(frequency, duration, type = 'sine', volume = 0.08, slideTo = null, delay = 0) {
  if (!audioCtx) return
  const start = audioCtx.currentTime + delay
  const oscillator = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(audioCtx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function noiseBurst(volume, duration, frequency) {
  if (!audioCtx || !noiseBuffer) return
  const start = audioCtx.currentTime
  const source = audioCtx.createBufferSource()
  source.buffer = noiseBuffer
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = frequency
  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(audioCtx.destination)
  source.start(start)
  source.stop(start + duration + 0.02)
}

const sound = {
  shot() {
    noiseBurst(0.16, 0.09, 2400)
    tone(120, 0.11, 'triangle', 0.14, 44)
  },
  hit() {
    tone(920, 0.045, 'square', 0.05)
  },
  kill() {
    tone(680, 0.08, 'square', 0.06)
    tone(1020, 0.11, 'square', 0.06, null, 0.08)
  },
  reload() {
    tone(340, 0.04, 'square', 0.035)
    tone(240, 0.05, 'square', 0.035, null, 0.13)
  },
  zone() {
    tone(190, 0.35, 'sawtooth', 0.045, 130)
  },
  win() {
    ;[523, 659, 784, 1047].forEach((frequency, index) => {
      tone(frequency, 0.28, 'triangle', 0.07, null, index * 0.14)
    })
  },
  lose() {
    ;[330, 262, 196].forEach((frequency, index) => {
      tone(frequency, 0.34, 'triangle', 0.06, null, index * 0.16)
    })
  }
}

function getAimDirection(target = new THREE.Vector3()) {
  const cosPitch = Math.cos(player.pitch)
  return target.set(
    -Math.sin(player.yaw) * cosPitch,
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * cosPitch
  )
}

function raySphere(origin, direction, center, radius) {
  const oc = tempE.copy(origin).sub(center)
  const b = oc.dot(direction)
  const c = oc.lengthSq() - radius * radius
  const discriminant = b * b - c
  if (discriminant < 0) return -1
  const root = Math.sqrt(discriminant)
  let distance = -b - root
  if (distance < 0) distance = -b + root
  return distance >= 0 ? distance : -1
}

function rayAABB(origin, direction, collider, maxDistance) {
  let tMin = 0
  let tMax = maxDistance

  if (Math.abs(direction.x) < 1e-8) {
    if (origin.x < collider.minX || origin.x > collider.maxX) return null
  } else {
    let t1 = (collider.minX - origin.x) / direction.x
    let t2 = (collider.maxX - origin.x) / direction.x
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return null
  }

  if (Math.abs(direction.y) < 1e-8) {
    if (origin.y < 0 || origin.y > collider.height) return null
  } else {
    let t1 = (0 - origin.y) / direction.y
    let t2 = (collider.height - origin.y) / direction.y
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return null
  }

  if (Math.abs(direction.z) < 1e-8) {
    if (origin.z < collider.minZ || origin.z > collider.maxZ) return null
  } else {
    let t1 = (collider.minZ - origin.z) / direction.z
    let t2 = (collider.maxZ - origin.z) / direction.z
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return null
  }

  return tMin >= 0 ? tMin : null
}

function raycastWorld(origin, direction, maxDistance) {
  let nearest = maxDistance
  for (const collider of world.colliders) {
    if (!collider.blocksSight) continue
    const distance = rayAABB(origin, direction, collider, maxDistance)
    if (distance !== null && distance < nearest) nearest = distance
  }
  return nearest
}

function traceShot(origin, direction, maxDistance) {
  let nearest = raycastWorld(origin, direction, maxDistance)
  let hit = {
    type: nearest < maxDistance ? 'world' : 'none',
    point: origin.clone().addScaledVector(direction, nearest),
    distance: nearest,
    bot: null,
    part: null
  }

  for (const bot of bots) {
    if (!bot.alive) continue
    const parts = [
      { dy: 1.68, radius: 0.23, name: 'head' },
      { dy: 1.06, radius: 0.42, name: 'body' },
      { dy: 0.5, radius: 0.35, name: 'legs' }
    ]
    for (const part of parts) {
      tempA.set(bot.position.x, bot.position.y + part.dy, bot.position.z)
      const distance = raySphere(origin, direction, tempA, part.radius)
      if (distance > 0 && distance < nearest) {
        nearest = distance
        hit = {
          type: 'bot',
          point: origin.clone().addScaledVector(direction, distance),
          distance,
          bot,
          part: part.name
        }
      }
    }
  }
  return hit
}

function hasLineOfSight(from, to) {
  const direction = tempB.copy(to).sub(from)
  const distance = direction.length()
  if (distance < 0.05) return true
  direction.multiplyScalar(1 / distance)
  return raycastWorld(from, direction, distance - 0.15) >= distance - 0.15
}

function findAimAssistTarget(origin, direction) {
  let best = null
  let bestScore = Math.cos(IS_TOUCH ? 0.14 : 0.055)
  for (const bot of bots) {
    if (!bot.alive) continue
    tempA.set(bot.position.x, bot.position.y + 1.1, bot.position.z)
    const distance = origin.distanceTo(tempA)
    if (distance > 75) continue
    tempB.copy(tempA).sub(origin).normalize()
    const dot = tempB.dot(direction)
    if (dot > bestScore && hasLineOfSight(origin, tempA)) {
      bestScore = dot
      best = { position: tempA.clone(), direction: tempB.clone() }
    }
  }
  return best
}

function pickBotTarget(bot) {
  const eye = tempA.set(bot.position.x, bot.position.y + 1.55, bot.position.z)
  let best = null
  let bestDistance = 54

  if (player.alive) {
    const chest = tempB.set(player.position.x, player.position.y + 1.15, player.position.z)
    const distance = bot.position.distanceTo(player.position)
    if (distance < bestDistance && hasLineOfSight(eye, chest)) {
      best = player
      bestDistance = distance
    }
  }

  for (const other of bots) {
    if (other === bot || !other.alive) continue
    const distance = bot.position.distanceTo(other.position)
    if (distance >= bestDistance) continue
    const chest = tempB.set(other.position.x, other.position.y + 1.1, other.position.z)
    if (hasLineOfSight(eye, chest)) {
      best = other
      bestDistance = distance
    }
  }

  return best
}

function angleLerp(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + delta * clamp(amount, 0, 1)
}

function countAlive() {
  return (player.alive ? 1 : 0) + bots.reduce((total, bot) => total + (bot.alive ? 1 : 0), 0)
}

function isFreeSpot(x, z, radius) {
  if (Math.abs(x) > MAP_HALF - 6 || Math.abs(z) > MAP_HALF - 6) return false
  for (const collider of world.colliders) {
    if (
      x > collider.minX - radius &&
      x < collider.maxX + radius &&
      z > collider.minZ - radius &&
      z < collider.maxZ + radius
    ) {
      return false
    }
  }
  return true
}

function damageBot(bot, amount, killer, part = 'body') {
  if (!bot.alive) return
  const actual = Math.min(bot.hp, amount)
  bot.hp -= amount
  if (killer === player) state.damage += actual
  const hitPoint = tempA.set(bot.position.x, bot.position.y + (part === 'head' ? 1.68 : 1.1), bot.position.z)
  spawnSpark(hitPoint, 0xd9483d, 0.8, 0.22)
  if (bot.hp <= 0) killBot(bot, killer, part)
}

function killBot(bot, killer, cause = 'gun') {
  if (!bot.alive) return
  bot.alive = false
  bot.model.die()
  bot.blob.visible = false
  state.alive = countAlive()

  const killerName = killer === player ? '你' : killer ? killer.name : '信号区'
  const weapon = cause === 'zone' ? '信号区' : cause === 'head' ? '爆头' : 'M416'
  addKillFeed(killerName, bot.name, weapon, killer === player)

  if (killer === player) {
    state.kills += 1
    sound.kill()
  }

  dropPickup(bot.position.x, bot.position.z, Math.random() < 0.6 ? 'ammo' : Math.random() < 0.7 ? 'med' : 'armor')
  updateHud(true)

  if (player.alive && bots.every((item) => !item.alive) && !state.over) {
    victoryDelay = VICTORY_DELAY
  }
}

function damagePlayer(amount, killer = null, cause = 'gun') {
  if (!player.alive || state.over || debug.god) return
  let remaining = amount
  if (player.armor > 0 && cause !== 'zone') {
    const absorbed = Math.min(player.armor, amount * 0.55)
    player.armor -= absorbed
    remaining -= absorbed
  }
  player.health = Math.max(0, player.health - remaining)
  damageFlash = Math.min(1, damageFlash + 0.55)
  shake = Math.min(1.2, shake + 0.28)

  if (player.health <= 0) {
    player.alive = false
    player.health = 0
    player.model.die()
    player.blob.visible = false
    state.alive = countAlive()
    const killerName = killer === player ? '你' : killer ? killer.name : '信号区'
    addKillFeed(killerName, '你', cause === 'zone' ? '信号区' : 'M416', false)
    updateHud(true)
    endGame(false)
  } else {
    updateHud()
  }
}

function playerDieFromZone() {
  if (!player.alive || state.over) return
  player.alive = false
  player.health = 0
  player.model.die()
  player.blob.visible = false
  state.alive = countAlive()
  addKillFeed('信号区', '你', '信号区', false)
  updateHud(true)
  endGame(false)
}

function addKillFeed(killerName, victimName, weapon, playerKiller) {
  const entry = document.createElement('div')
  entry.className = 'kf-entry'
  if (playerKiller) entry.classList.add('is-player')

  const killer = document.createElement('span')
  killer.className = 'kf-name'
  killer.textContent = killerName

  const weaponEl = document.createElement('i')
  weaponEl.className = 'kf-weapon'
  weaponEl.textContent = weapon

  const victim = document.createElement('span')
  victim.className = 'kf-name kf-victim'
  victim.textContent = victimName

  entry.append(killer, weaponEl, victim)
  killfeedEl.append(entry)
  while (killfeedEl.children.length > 4) killfeedEl.firstElementChild.remove()
  window.setTimeout(() => entry.classList.add('fade'), 4200)
  window.setTimeout(() => entry.remove(), 5000)
}

function showToast(text) {
  pickupToast.textContent = text
  pickupToast.classList.add('show')
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => pickupToast.classList.remove('show'), 1700)
}

function startReload() {
  if (!player.alive || player.reloading || player.mag >= MAG_SIZE || player.reserve <= 0 || state.over) return
  player.reloading = true
  player.reloadTimer = RELOAD_TIME
  sound.reload()
  updateHud(true)
}

function useMedkit() {
  if (!player.alive || player.medkits <= 0 || player.health >= 100 || state.over || player.healCooldown > 0) return
  player.medkits -= 1
  player.health = Math.min(100, player.health + 40)
  player.healCooldown = 1.2
  showToast('使用急救包  +40 生命')
  spawnSpark(tempA.set(player.position.x, player.position.y + 1, player.position.z), 0x69e08a, 1.1, 0.5)
  updateHud(true)
}

function shoot() {
  if (!player.alive || player.reloading || state.over || state.paused) return
  if (state.time < player.nextShot) return
  if (player.mag <= 0) {
    startReload()
    return
  }

  player.mag -= 1
  player.nextShot = state.time + FIRE_INTERVAL
  player.spread = Math.min(0.038, player.spread + 0.0034)

  const origin = camera.position.clone()
  const direction = getAimDirection(new THREE.Vector3())

  const assist = findAimAssistTarget(origin, direction)
  if (assist) direction.lerp(assist.direction, AIM_ASSIST).normalize()

  const spread = 0.0045 + player.spread + (player.moving ? 0.008 : 0)
  direction.x += rand(-1, 1) * spread
  direction.y += rand(-1, 1) * spread
  direction.z += rand(-1, 1) * spread
  direction.normalize()

  const hit = traceShot(origin, direction, 170)
  const muzzle = player.model.muzzle.getWorldPosition(new THREE.Vector3())
  spawnTracer(muzzle, hit.point, 0xffd27a)
  muzzleFlash(muzzle)
  sound.shot()

  if (hit.type === 'bot') {
    const damage = hit.part === 'head' ? 68 : hit.part === 'legs' ? 18 : 26
    damageBot(hit.bot, damage, player, hit.part)
    showHitmarker(false)
    sound.hit()
  } else if (hit.type === 'world') {
    spawnSpark(hit.point, 0xd8c39a, 0.4, 0.2)
  }

  player.pitch = clamp(player.pitch + rand(0.0022, 0.0052), -1.05, 0.95)
  shake = Math.max(shake, 0.07)
  updateHud()
}

function showHitmarker(kill) {
  hitmarkerEl.classList.remove('show', 'kill')
  void hitmarkerEl.offsetWidth
  hitmarkerEl.classList.add('show')
  if (kill) hitmarkerEl.classList.add('kill')
}

function botShoot(bot) {
  const target = bot.target
  if (!target || !target.alive) return

  const muzzle = bot.model.muzzle.getWorldPosition(new THREE.Vector3())
  const aim = tempA.set(
    target.position.x,
    target.position.y + (target.isPlayer ? 1.15 : 1.05),
    target.position.z
  )
  const direction = tempB.copy(aim).sub(muzzle)
  const distance = direction.length()
  if (distance < 0.1) return
  direction.multiplyScalar(1 / distance)

  const movementPenalty = target.isPlayer && player.moving ? 0.009 : 0
  const spread = 0.012 + distance * 0.00055 + (1 - bot.skill) * 0.022 + movementPenalty
  direction.x += rand(-1, 1) * spread
  direction.y += rand(-1, 1) * spread
  direction.z += rand(-1, 1) * spread
  direction.normalize()

  const wall = raycastWorld(muzzle, direction, 90)
  const chest = tempC.set(target.position.x, target.position.y + 1.06, target.position.z)
  const hitDistance = raySphere(muzzle, direction, chest, 0.52)

  let end
  if (hitDistance > 0 && hitDistance < wall) {
    end = muzzle.clone().addScaledVector(direction, hitDistance)
    spawnSpark(end, 0xd9483d, 0.6, 0.2)
    if (target.isPlayer) {
      damagePlayer(rand(6, 10) * (0.7 + bot.skill * 0.5), bot)
    } else {
      damageBot(target, rand(6, 10) * (0.7 + bot.skill * 0.5), bot)
    }
  } else {
    const length = Math.min(wall, 70)
    end = muzzle.clone().addScaledVector(direction, length)
    if (wall < 70) spawnSpark(end, 0xd8c39a, 0.35, 0.18)
  }

  spawnTracer(muzzle, end, 0xff9a5a)
  const flash = muzzleSprites.find((item) => item.life <= 0) || muzzleSprites[0]
  flash.sprite.position.copy(muzzle)
  flash.sprite.material.opacity = 0.7
  flash.sprite.visible = true
  flash.sprite.scale.setScalar(0.8)
  flash.life = flash.max = 0.05
}

function pickWanderPoint(bot) {
  const angle = rand(0, Math.PI * 2)
  const maxRadius = Math.max(6, zone.radius - 8)
  const radius = Math.sqrt(Math.random()) * maxRadius
  bot.wander = {
    x: zone.cx + Math.cos(angle) * radius,
    z: zone.cz + Math.sin(angle) * radius
  }
}

function spawnBots() {
  for (let index = 0; index < BOT_COUNT; index += 1) {
    let x = 0
    let z = 0
    let attempts = 0
    do {
      const angle = rand(0, Math.PI * 2)
      const radius = rand(26, 82)
      x = Math.cos(angle) * radius
      z = Math.sin(angle) * radius
      attempts += 1
    } while (
      attempts < 60 &&
      (!isFreeSpot(x, z, 1.2) ||
        Math.hypot(x - player.position.x, z - player.position.z) < 30 ||
        bots.some((bot) => Math.hypot(bot.position.x - x, bot.position.z - z) < 7))
    )

    const model = createSoldier({
      uniform: BOT_UNIFORMS[index % BOT_UNIFORMS.length],
      vest: 0x363d2c,
      accent: BOT_ACCENTS[index % BOT_ACCENTS.length],
      shadows
    })
    model.group.position.set(x, 0, z)
    scene.add(model.group)

    const bot = {
      isPlayer: false,
      name: BOT_NAMES[index % BOT_NAMES.length],
      position: new THREE.Vector3(x, 0, z),
      yaw: rand(0, Math.PI * 2),
      pitch: 0,
      hp: 100,
      alive: true,
      model,
      blob: makeBlobShadow(),
      target: null,
      thinkTimer: rand(0.1, 0.6),
      fireTimer: rand(0.6, 2.2),
      burst: 0,
      burstTimer: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: rand(1, 3),
      speed: rand(3.3, 4.3),
      skill: rand(0.55, 0.95),
      wander: null,
      moveAmount: 0
    }
    bots.push(bot)
  }
}

function updateBotModel(bot, dt, t) {
  bot.model.group.position.copy(bot.position)
  bot.model.group.rotation.y = bot.yaw
  bot.model.update(dt, {
    moving: bot.moveAmount > 0.05,
    speed: bot.moveAmount,
    pitch: bot.pitch,
    time: t,
    aiming: Boolean(bot.target)
  })
  bot.blob.position.set(bot.position.x, 0.035, bot.position.z)
}

function updateBots(dt, t) {
  for (const bot of bots) {
    if (!bot.alive) {
      bot.model.update(dt)
      continue
    }

    if (debug.frozen) {
      bot.model.update(dt, { moving: false, speed: 0, pitch: bot.pitch, time: t })
      continue
    }

    bot.thinkTimer -= dt
    bot.fireTimer -= dt
    bot.burstTimer -= dt
    bot.strafeTimer -= dt

    if (bot.strafeTimer <= 0) {
      bot.strafe *= -1
      bot.strafeTimer = rand(1.3, 3.1)
    }

    const distanceToCenter = Math.hypot(bot.position.x - zone.cx, bot.position.z - zone.cz)
    const outside = distanceToCenter > zone.radius - 4

    if (bot.thinkTimer <= 0) {
      bot.thinkTimer = rand(0.24, 0.45)
      bot.target = outside ? null : pickBotTarget(bot)
      if (
        !bot.target &&
        (!bot.wander || Math.hypot(bot.position.x - bot.wander.x, bot.position.z - bot.wander.z) < 3)
      ) {
        pickWanderPoint(bot)
      }
    }

    let moveX = 0
    let moveZ = 0
    let speed = bot.speed

    if (outside) {
      const dx = zone.cx - bot.position.x
      const dz = zone.cz - bot.position.z
      const length = Math.hypot(dx, dz) || 1
      moveX = dx / length
      moveZ = dz / length
      speed *= 1.35
      bot.target = null
      bot.yaw = angleLerp(bot.yaw, Math.atan2(-moveX, -moveZ), dt * 5)
    } else if (bot.target) {
      const target = bot.target
      const dx = target.position.x - bot.position.x
      const dz = target.position.z - bot.position.z
      const distance = Math.hypot(dx, dz) || 1
      const nx = dx / distance
      const nz = dz / distance

      if (distance > 24) {
        moveX += nx
        moveZ += nz
      } else if (distance < 12) {
        moveX -= nx
        moveZ -= nz
      }
      moveX += -nz * bot.strafe * 0.85
      moveZ += nx * bot.strafe * 0.85

      bot.yaw = angleLerp(bot.yaw, Math.atan2(-nx, -nz), dt * 7)
      bot.pitch = Math.atan2(target.position.y + 1.1 - (bot.position.y + 1.5), distance)

      if (bot.burst > 0) {
        if (bot.burstTimer <= 0) {
          const eye = tempA.set(bot.position.x, bot.position.y + 1.55, bot.position.z)
          const chest = tempB.set(target.position.x, target.position.y + 1.1, target.position.z)
          if (hasLineOfSight(eye, chest)) botShoot(bot)
          bot.burst -= 1
          bot.burstTimer = 0.14
        }
      } else if (bot.fireTimer <= 0) {
        const eye = tempA.set(bot.position.x, bot.position.y + 1.55, bot.position.z)
        const chest = tempB.set(target.position.x, target.position.y + 1.1, target.position.z)
        if (distance < 58 && hasLineOfSight(eye, chest)) {
          bot.burst = 3 + Math.floor(rand(0, 2))
          bot.burstTimer = 0
          bot.fireTimer = rand(1.05, 1.9)
        } else {
          bot.fireTimer = 0.3
        }
      }
    } else if (bot.wander) {
      const dx = bot.wander.x - bot.position.x
      const dz = bot.wander.z - bot.position.z
      const length = Math.hypot(dx, dz)
      if (length > 1.4) {
        moveX = dx / length
        moveZ = dz / length
        bot.yaw = angleLerp(bot.yaw, Math.atan2(-moveX, -moveZ), dt * 4)
      } else {
        pickWanderPoint(bot)
      }
      bot.pitch = 0
    }

    const moveLength = Math.hypot(moveX, moveZ)
    if (moveLength > 0.001) {
      moveX /= moveLength
      moveZ /= moveLength
      const step = speed * dt
      bot.position.x += moveX * step
      bot.position.z += moveZ * step
      bot.moveAmount = speed
    } else {
      bot.moveAmount = 0
    }

    for (const other of bots) {
      if (other === bot || !other.alive) continue
      const dx = bot.position.x - other.position.x
      const dz = bot.position.z - other.position.z
      const distance = Math.hypot(dx, dz)
      if (distance > 0.001 && distance < 1.3) {
        const push = (1.3 - distance) * 0.5
        bot.position.x += (dx / distance) * push
        bot.position.z += (dz / distance) * push
      }
    }

    resolveCollision(bot.position, BOT_RADIUS, world.colliders)

    if (Math.hypot(bot.position.x - zone.cx, bot.position.z - zone.cz) > zone.radius) {
      bot.hp -= zone.dps * dt
      if (bot.hp <= 0) killBot(bot, null, 'zone')
    }

    updateBotModel(bot, dt, t)
  }
}

function updatePlayer(dt, t) {
  const forwardX = -Math.sin(player.yaw)
  const forwardZ = -Math.cos(player.yaw)
  const rightX = Math.cos(player.yaw)
  const rightZ = -Math.sin(player.yaw)

  let inputX = 0
  let inputZ = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1
  inputX += joystick.x
  inputZ -= joystick.y

  const inputLength = Math.hypot(inputX, inputZ)
  if (inputLength > 1) {
    inputX /= inputLength
    inputZ /= inputLength
  }
  const moving = inputLength > 0.08
  const sprinting =
    keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joystick.x, joystick.y) > 0.92
  let speed = sprinting ? SPRINT_SPEED : WALK_SPEED
  if (player.reloading) speed *= 0.9

  if (moving) {
    const moveX = forwardX * inputZ + rightX * inputX
    const moveZ = forwardZ * inputZ + rightZ * inputX
    const length = Math.hypot(moveX, moveZ) || 1
    player.position.x += (moveX / length) * speed * dt
    player.position.z += (moveZ / length) * speed * dt
  }
  resolveCollision(player.position, PLAYER_RADIUS, world.colliders)
  player.moving = moving

  if (jumpQueued && player.grounded) {
    player.vy = JUMP_SPEED
    player.grounded = false
  }
  jumpQueued = false
  player.vy -= GRAVITY * dt
  player.position.y += player.vy * dt
  if (player.position.y <= 0) {
    player.position.y = 0
    player.vy = 0
    player.grounded = true
  }

  if (player.reloading) {
    player.reloadTimer -= dt
    if (player.reloadTimer <= 0) {
      const needed = MAG_SIZE - player.mag
      const taken = Math.min(needed, player.reserve)
      player.mag += taken
      player.reserve -= taken
      player.reloading = false
      player.reloadTimer = 0
      updateHud(true)
    }
  }

  if (player.healCooldown > 0) player.healCooldown -= dt
  player.spread = Math.max(0, player.spread - dt * 0.085)

  if (firing) shoot()

  player.model.group.position.copy(player.position)
  player.model.group.rotation.y = player.yaw
  player.model.update(dt, {
    moving,
    speed,
    pitch: player.pitch,
    time: t,
    aiming: firing
  })
  player.blob.position.set(player.position.x, 0.035, player.position.z)
  player.blob.scale.setScalar(1 - Math.min(0.45, player.position.y * 0.14))
}

function pickNextZone() {
  const phase = ZONE_PHASES[Math.min(zone.phase, ZONE_PHASES.length - 1)]
  zone.targetRadius = phase.radius
  zone.shrink = phase.shrink
  zone.dps = phase.dps

  const maxOffset = Math.max(0, zone.radius - zone.targetRadius - 3)
  const angle = rand(0, Math.PI * 2)
  const distance = Math.sqrt(Math.random()) * maxOffset * 0.82
  const minX = -MAP_HALF + zone.targetRadius + 5
  const maxX = MAP_HALF - zone.targetRadius - 5
  const minZ = -MAP_HALF + zone.targetRadius + 5
  const maxZ = MAP_HALF - zone.targetRadius - 5
  zone.targetCx = clamp(zone.cx + Math.cos(angle) * distance, minX, maxX)
  zone.targetCz = clamp(zone.cz + Math.sin(angle) * distance, minZ, maxZ)
}

function resetZone() {
  zone.radius = 96
  zone.cx = 0
  zone.cz = 0
  zone.phase = 0
  zone.state = 'wait'
  zone.timer = ZONE_PHASES[0].wait
  zone.shrink = ZONE_PHASES[0].shrink
  zone.dps = ZONE_PHASES[0].dps
  zone.startRadius = zone.radius
  zone.startCx = 0
  zone.startCz = 0
  pickNextZone()
  zoneGroup.visible = true
  nextRing.visible = true
  updateZoneVisuals()
}

function updateZoneVisuals() {
  zoneWall.position.set(zone.cx, 23, zone.cz)
  zoneWall.scale.set(zone.radius, 1, zone.radius)
  zoneRing.position.set(zone.cx, 0.05, zone.cz)
  zoneRing.scale.set(zone.radius, zone.radius, 1)
  nextRing.position.set(zone.targetCx, 0.07, zone.targetCz)
  nextRing.scale.set(zone.targetRadius, zone.targetRadius, 1)
  nextRing.visible = zone.state === 'wait'
}

function updateZone(dt, t) {
  if (zone.state === 'wait') {
    zone.timer -= dt
    if (zone.timer <= 0) {
      zone.state = 'shrink'
      zone.timer = zone.shrink
      zone.startRadius = zone.radius
      zone.startCx = zone.cx
      zone.startCz = zone.cz
      sound.zone()
    }
  } else if (zone.state === 'shrink') {
    zone.timer -= dt
    const progress = clamp(1 - zone.timer / zone.shrink, 0, 1)
    zone.radius = lerp(zone.startRadius, zone.targetRadius, progress)
    zone.cx = lerp(zone.startCx, zone.targetCx, progress)
    zone.cz = lerp(zone.startCz, zone.targetCz, progress)

    if (zone.timer <= 0) {
      zone.radius = zone.targetRadius
      zone.cx = zone.targetCx
      zone.cz = zone.targetCz
      zone.phase += 1
      if (zone.phase < ZONE_PHASES.length) {
        zone.state = 'wait'
        zone.timer = ZONE_PHASES[zone.phase].wait
        pickNextZone()
      } else {
        zone.state = 'final'
        zone.timer = 0
      }
    }
  }

  const outside = Math.hypot(player.position.x - zone.cx, player.position.z - zone.cz) > zone.radius
  if (outside && player.alive) {
    player.health = Math.max(0, player.health - zone.dps * dt)
    zonePulse -= dt
    if (zonePulse <= 0) {
      zonePulse = 0.75
      damageFlash = Math.max(damageFlash, 0.32)
    }
    if (player.health <= 0) playerDieFromZone()
  }

  updateZoneVisuals()
  zoneWallMaterial.uniforms.uTime.value = t
}

function makePickupVisual(type) {
  const group = new THREE.Group()
  const color = type === 'ammo' ? 0xf2b63c : type === 'med' ? 0x67dc83 : 0x5aa6f0
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
  glow.scale.set(1.7, 1.7, 1)
  glow.position.y = 0.62
  group.add(glow)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 26),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.04
  group.add(ring)

  const item = new THREE.Group()
  item.position.y = 0.62

  if (type === 'ammo') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.22, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x3d4a2d, roughness: 0.7, metalness: 0.25 })
    )
    item.add(box)
    for (let index = 0; index < 3; index += 1) {
      const bullet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6),
        new THREE.MeshStandardMaterial({ color: 0xe2b34c, metalness: 0.8, roughness: 0.3 })
      )
      bullet.position.set(-0.08 + index * 0.08, 0.18, 0)
      item.add(bullet)
    }
  } else if (type === 'med') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.34, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xe9efe6, roughness: 0.7 })
    )
    item.add(box)
    const crossMaterial = new THREE.MeshStandardMaterial({
      color: 0xd54a45,
      emissive: 0x5c0e0c,
      emissiveIntensity: 0.7
    })
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.02), crossMaterial)
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.02), crossMaterial)
    crossA.position.z = 0.13
    crossB.position.z = 0.13
    item.add(crossA, crossB)
  } else {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x3d6fa5, roughness: 0.55, metalness: 0.25 })
    )
    item.add(box)
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x233d57, roughness: 0.8 })
    )
    strap.position.x = 0.1
    item.add(strap)
  }

  group.add(item)
  return { group, item, ring, glow }
}

function createPickup(x, z, type) {
  const visual = makePickupVisual(type)
  visual.group.position.set(x, 0, z)
  scene.add(visual.group)
  pickups.push({
    x,
    z,
    type,
    group: visual.group,
    item: visual.item,
    ring: visual.ring,
    glow: visual.glow,
    phase: rand(0, Math.PI * 2),
    active: true
  })
}

function dropPickup(x, z, type) {
  if (!isFreeSpot(x, z, 0.5)) return
  createPickup(x, z, type)
}

function spawnLoot() {
  const spots = [...world.lootSpots].sort(() => Math.random() - 0.5)
  let count = 0
  for (const spot of spots) {
    if (count >= 30) break
    if (!isFreeSpot(spot.x, spot.z, 1.1)) continue
    const roll = Math.random()
    const type = roll < 0.46 ? 'ammo' : roll < 0.75 ? 'med' : 'armor'
    createPickup(spot.x, spot.z, type)
    count += 1
  }
}

function updateLoot(dt, t) {
  for (const pickup of pickups) {
    if (!pickup.active) continue
    pickup.item.position.y = 0.62 + Math.sin(t * 2.2 + pickup.phase) * 0.09
    pickup.item.rotation.y += dt * 1.4
    pickup.ring.rotation.z += dt * 0.6
    pickup.glow.material.opacity = 0.6 + Math.sin(t * 3 + pickup.phase) * 0.16

    const dx = pickup.x - player.position.x
    const dz = pickup.z - player.position.z
    if (player.alive && dx * dx + dz * dz < 1.7 * 1.7) {
      pickup.active = false
      pickup.group.visible = false
      if (pickup.type === 'ammo') {
        player.reserve = Math.min(300, player.reserve + 45)
        showToast('获得 5.56 毫米弹药  +45')
      } else if (pickup.type === 'med') {
        player.medkits = Math.min(5, player.medkits + 1)
        showToast('获得 急救包  +1')
      } else {
        player.armor = Math.min(100, player.armor + 30)
        showToast('获得 防弹衣  +30')
      }
      spawnSpark(
        tempA.set(pickup.x, 0.7, pickup.z),
        pickup.type === 'ammo' ? 0xf2b63c : pickup.type === 'med' ? 0x67dc83 : 0x5aa6f0,
        0.9,
        0.4
      )
      updateHud(true)
    }
  }
}

function clearBots() {
  for (const bot of bots) {
    scene.remove(bot.model.group)
    scene.remove(bot.blob)
  }
  bots.length = 0
}

function clearPickups() {
  for (const pickup of pickups) scene.remove(pickup.group)
  pickups.length = 0
}

function resetPlayerAtSpawn() {
  const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
  player.position.set(spawn[0], 0, spawn[1])
  resolveCollision(player.position, PLAYER_RADIUS, world.colliders)
  player.yaw = rand(0, Math.PI * 2)
  player.pitch = -0.04
  player.vy = 0
  player.grounded = true
  player.health = 100
  player.armor = 0
  player.alive = true
  player.mag = MAG_SIZE
  player.reserve = 120
  player.medkits = 2
  player.reloading = false
  player.reloadTimer = 0
  player.nextShot = 0
  player.spread = 0
  player.moving = false
  player.healCooldown = 0
  player.model.reset()
  player.model.group.visible = true
  player.model.group.position.copy(player.position)
  player.blob.visible = true
  player.blob.position.set(player.position.x, 0.035, player.position.z)
}

function startGame() {
  if (state.started && !state.over) return
  clearBots()
  clearPickups()
  resetPlayerAtSpawn()

  state.started = true
  state.paused = false
  state.over = false
  state.victory = false
  state.time = 0
  state.kills = 0
  state.damage = 0
  state.alive = BOT_COUNT + 1
  victoryDelay = 0
  firing = false
  jumpQueued = false
  joystick = { x: 0, y: 0, active: false }
  joystickKnob.style.transform = 'translate(-50%, -50%)'
  shake = 0
  damageFlash = 0
  zonePulse = 0
  lastHud = {}

  spawnBots()
  spawnLoot()
  resetZone()

  overlay.classList.add('hidden')
  pausedScreen.classList.add('hidden')
  resultScreen.classList.add('hidden')
  document.body.dataset.gameStarted = 'true'
  document.body.dataset.paused = 'false'
  document.body.dataset.gameOver = 'false'
  pauseBtn.classList.remove('is-paused')
  pauseBtn.setAttribute('aria-label', '暂停游戏')

  updateCamera(0, 0, true)
  updateHud(true)
  updateMinimap()
  updateCompass()
  initAudio()
}

function returnToLobby() {
  clearBots()
  clearPickups()
  state.started = false
  state.paused = false
  state.over = false
  state.victory = false
  state.time = 0
  firing = false
  keys.clear()
  joystick = { x: 0, y: 0, active: false }
  joystickKnob.style.transform = 'translate(-50%, -50%)'

  player.position.set(0, 0, 0)
  player.yaw = 0.35
  player.pitch = -0.04
  player.health = 100
  player.armor = 0
  player.alive = true
  player.model.reset()
  player.model.group.visible = true
  player.model.group.position.set(0, 0, 0)
  player.blob.visible = true
  player.blob.position.set(0, 0.035, 0)
  zoneGroup.visible = false

  overlay.classList.remove('hidden')
  pausedScreen.classList.add('hidden')
  resultScreen.classList.add('hidden')
  document.body.dataset.gameStarted = 'false'
  document.body.dataset.paused = 'false'
  document.body.dataset.gameOver = 'false'
  pauseBtn.classList.remove('is-paused')
}

function setPaused(value) {
  if (!state.started || state.over) return
  state.paused = value
  firing = false
  keys.clear()
  joystick = { x: 0, y: 0, active: false }
  joystickKnob.style.transform = 'translate(-50%, -50%)'
  document.body.dataset.paused = value ? 'true' : 'false'
  pausedScreen.classList.toggle('hidden', !value)
  pauseBtn.classList.toggle('is-paused', value)
  pauseBtn.setAttribute('aria-label', value ? '继续游戏' : '暂停游戏')
  if (value && document.pointerLockElement) document.exitPointerLock()
}

function endGame(victory) {
  if (state.over) return
  state.over = true
  state.victory = victory
  state.alive = countAlive()
  firing = false
  if (document.pointerLockElement) document.exitPointerLock()

  const rank = victory ? 1 : countAlive() + 1
  resultEyebrow.textContent = victory ? 'MISSION COMPLETE' : 'MISSION FAILED'
  resultTitle.textContent = victory ? '大吉大利' : '你被淘汰了'
  resultSub.textContent = victory
    ? '今晚吃鸡 · WINNER WINNER CHICKEN DINNER'
    : '保持冷静，下一局注意信号区和掩体'
  resultRank.textContent = `#${rank}`
  resultKills.textContent = String(state.kills)
  resultDamage.textContent = String(Math.round(state.damage))
  resultTime.textContent = formatTime(state.time)
  resultPanel.classList.toggle('victory', victory)
  resultPanel.classList.toggle('defeat', !victory)
  resultScreen.classList.remove('hidden')
  document.body.dataset.gameOver = 'true'
  updateHud(true)

  if (victory) sound.win()
  else sound.lose()
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function updateHud(force = false) {
  const hp = Math.ceil(player.health)
  if (force || lastHud.hp !== hp) {
    lastHud.hp = hp
    healthText.textContent = String(hp)
    healthFill.style.width = `${clamp(player.health, 0, 100)}%`
    healthFill.classList.toggle('low', player.health <= 30)
  }

  const armor = Math.ceil(player.armor)
  if (force || lastHud.armor !== armor) {
    lastHud.armor = armor
    armorText.textContent = String(armor)
    armorFill.style.width = `${clamp(player.armor, 0, 100)}%`
  }

  if (force || lastHud.mag !== player.mag) {
    lastHud.mag = player.mag
    ammoMagEl.textContent = String(player.mag)
    ammoMagEl.classList.toggle('empty', player.mag === 0)
  }
  if (force || lastHud.reserve !== player.reserve) {
    lastHud.reserve = player.reserve
    ammoReserveEl.textContent = String(player.reserve)
  }
  if (force || lastHud.medkits !== player.medkits) {
    lastHud.medkits = player.medkits
    medCountEl.textContent = String(player.medkits)
  }
  if (force || lastHud.alive !== state.alive) {
    lastHud.alive = state.alive
    aliveEl.textContent = String(state.alive)
  }
  if (force || lastHud.kills !== state.kills) {
    lastHud.kills = state.kills
    killEl.textContent = String(state.kills)
  }

  if (player.reloading) {
    reloadMeter.classList.add('active')
    reloadMeter.querySelector('i').style.width = `${(1 - player.reloadTimer / RELOAD_TIME) * 100}%`
  } else {
    reloadMeter.classList.remove('active')
  }

  crosshairEl.classList.toggle('firing', firing)
}

function updateZoneUi() {
  const label =
    zone.state === 'shrink'
      ? '信号区收缩中'
      : zone.state === 'final'
        ? '最终信号区'
        : `安全区 ${Math.min(zone.phase + 1, ZONE_PHASES.length)}`
  zonePhaseEl.textContent = label
  zoneTimerEl.textContent = zone.state === 'final' ? '--:--' : formatTime(zone.timer)

  const outside =
    state.started &&
    !state.over &&
    player.alive &&
    Math.hypot(player.position.x - zone.cx, player.position.z - zone.cz) > zone.radius

  if (outside) {
    zoneBanner.textContent = '你位于信号区外 · 正在损失生命'
    zoneBanner.className = 'danger'
  } else if (state.started && !state.over && zone.state === 'shrink') {
    zoneBanner.textContent = '信号区正在缩小 · 立即转移'
    zoneBanner.className = 'warning'
  } else if (state.started && !state.over && zone.state === 'wait' && zone.timer <= 5) {
    zoneBanner.textContent = `信号区将在 ${Math.ceil(zone.timer)} 秒后收缩`
    zoneBanner.className = 'warning'
  } else {
    zoneBanner.className = 'hidden'
  }
}

function updateCompass() {
  const ctx = compassCtx
  const width = compassCanvas.width
  const height = compassCanvas.height
  ctx.clearRect(0, 0, width, height)

  const heading = ((-player.yaw * 180) / Math.PI + 360) % 360
  const pixelsPerDegree = width / 120
  const center = width / 2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif'

  for (let offset = -60; offset <= 60; offset += 5) {
    const degree = (((heading + offset) % 360) + 360) % 360
    const x = center + offset * pixelsPerDegree
    const major = degree % 45 === 0
    ctx.strokeStyle = major ? 'rgba(247,183,51,0.95)' : 'rgba(235,242,232,0.42)'
    ctx.lineWidth = major ? 2.5 : 1.2
    ctx.beginPath()
    ctx.moveTo(x, height - (major ? 26 : 16))
    ctx.lineTo(x, height - 4)
    ctx.stroke()

    if (degree % 90 === 0) {
      const labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }
      ctx.fillStyle = '#f7b733'
      ctx.font = '700 22px "Segoe UI", system-ui, sans-serif'
      ctx.fillText(labels[degree], x, 14)
    } else if (degree % 45 === 0) {
      const diagonal = { 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }
      ctx.fillStyle = 'rgba(235,242,232,0.7)'
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif'
      ctx.fillText(diagonal[degree], x, 14)
    }
  }

  ctx.fillStyle = 'rgba(247,183,51,0.95)'
  ctx.beginPath()
  ctx.moveTo(center, height - 30)
  ctx.lineTo(center - 7, height - 42)
  ctx.lineTo(center + 7, height - 42)
  ctx.closePath()
  ctx.fill()
}

function updateMinimap() {
  const ctx = minimapCtx
  const size = minimapCanvas.width
  const scale = size / (MAP_HALF * 2)
  const toX = (x) => size / 2 + x * scale
  const toY = (z) => size / 2 + z * scale

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = '#3f5134'
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = 'rgba(220,235,210,0.08)'
  ctx.lineWidth = 1
  for (let value = -100; value <= 100; value += 25) {
    ctx.beginPath()
    ctx.moveTo(toX(value), 0)
    ctx.lineTo(toX(value), size)
    ctx.moveTo(0, toY(value))
    ctx.lineTo(size, toY(value))
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(151,131,93,0.9)'
  ctx.fillRect(toX(-8), 0, 16 * scale, size)
  ctx.fillRect(0, toY(1), size, 16 * scale)

  for (const building of world.buildings) {
    ctx.fillStyle =
      building.label === 'container' ? 'rgba(120,140,130,0.85)' : 'rgba(170,172,158,0.9)'
    const x = toX(building.x - building.width / 2)
    const y = toY(building.z - building.depth / 2)
    ctx.fillRect(x, y, Math.max(2, building.width * scale), Math.max(2, building.depth * scale))
  }

  ctx.beginPath()
  ctx.rect(0, 0, size, size)
  ctx.arc(toX(zone.cx), toY(zone.cz), zone.radius * scale, 0, Math.PI * 2, true)
  ctx.fillStyle = 'rgba(50,150,255,0.28)'
  ctx.fill('evenodd')

  ctx.strokeStyle = 'rgba(88,190,255,0.95)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(toX(zone.cx), toY(zone.cz), zone.radius * scale, 0, Math.PI * 2)
  ctx.stroke()

  if (zone.state === 'wait') {
    ctx.strokeStyle = 'rgba(250,252,255,0.92)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(toX(zone.targetCx), toY(zone.targetCz), zone.targetRadius * scale, 0, Math.PI * 2)
    ctx.stroke()
  }

  const px = toX(player.position.x)
  const py = toY(player.position.z)
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(-player.yaw)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -11)
  ctx.lineTo(7, 8)
  ctx.lineTo(0, 4)
  ctx.lineTo(-7, 8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

function updateCamera(dt, t, immediate = false) {
  if (!state.started) {
    const angle = t * 0.11
    camera.position.set(
      Math.sin(angle) * 13,
      4.4 + Math.sin(t * 0.45) * 0.25,
      Math.cos(angle) * 13
    )
    camera.lookAt(0, 1.3, 0)
    return
  }

  const behindX = Math.sin(player.yaw)
  const behindZ = Math.cos(player.yaw)
  const rightX = Math.cos(player.yaw)
  const rightZ = -Math.sin(player.yaw)

  tempA.set(
    player.position.x + behindX * 4.7 + rightX * 0.72,
    player.position.y + 2.2,
    player.position.z + behindZ * 4.7 + rightZ * 0.72
  )

  const head = tempB.set(player.position.x, player.position.y + 1.65, player.position.z)
  const offset = tempC.copy(tempA).sub(head)
  const distance = offset.length()
  offset.multiplyScalar(1 / distance)
  const wall = raycastWorld(head, offset, distance)
  if (wall < distance) {
    tempA.copy(head).addScaledVector(offset, Math.max(1.2, wall - 0.35))
  }
  if (tempA.y < 0.65) tempA.y = 0.65

  if (immediate) {
    camera.position.copy(tempA)
  } else {
    camera.position.lerp(tempA, 1 - Math.exp(-22 * dt))
  }

  camera.position.x += rand(-1, 1) * shake * 0.16
  camera.position.y += rand(-1, 1) * shake * 0.12
  shake = Math.max(0, shake - dt * 2.2)

  const aim = getAimDirection(tempD)
  camera.lookAt(
    camera.position.x + aim.x * 40,
    camera.position.y + aim.y * 40,
    camera.position.z + aim.z * 40
  )
}

function updateDamageFlash(dt) {
  damageFlash = Math.max(0, damageFlash - dt * 1.8)
  damageFlashEl.style.opacity = damageFlash.toFixed(3)
}

function updateGame(dt, t) {
  state.time += dt
  world.sun.position.set(player.position.x + 58, 86, player.position.z + 44)
  world.sun.target.position.set(player.position.x, 0, player.position.z)
  world.sun.target.updateMatrixWorld()
  updatePlayer(dt, t)
  updateBots(dt, t)
  updateZone(dt, t)
  updateLoot(dt, t)
  updateCamera(dt, t)
  updateHud()
  updateDamageFlash(dt)

  compassTimer -= dt
  if (compassTimer <= 0) {
    compassTimer = 0.05
    updateCompass()
  }
  minimapTimer -= dt
  if (minimapTimer <= 0) {
    minimapTimer = 0.12
    updateMinimap()
  }
  zoneUiTimer -= dt
  if (zoneUiTimer <= 0) {
    zoneUiTimer = 0.1
    updateZoneUi()
  }

  if (victoryDelay > 0) {
    victoryDelay -= dt
    if (victoryDelay <= 0 && !state.over) endGame(true)
  }
}

function updateIdle(dt, t) {
  player.model.group.position.set(0, 0, 0)
  player.model.group.rotation.y = player.yaw
  player.model.update(dt, { moving: false, speed: 0, pitch: 0, time: t, aiming: false })
  player.blob.position.set(0, 0.035, 0)
  updateCamera(dt, t, true)
  updateDamageFlash(dt)
  updateZoneUi()
}

const clock = new THREE.Clock()

function frame() {
  requestAnimationFrame(frame)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  if (state.started && !state.paused) {
    if (!state.over) {
      updateGame(dt, t)
    } else {
      for (const bot of bots) bot.model.update(dt)
      player.model.update(dt)
      updateEffects(dt)
      updateCamera(dt, t)
      updateDamageFlash(dt)
    }
  } else if (!state.started) {
    updateIdle(dt, t)
    updateEffects(dt)
  } else {
    updateDamageFlash(dt)
  }

  world.update(t, dt)
  renderer.render(scene, camera)

  state.frames += 1
  state.drawCalls = renderer.info.render.calls
  if (!state.ready) {
    state.ready = true
    document.body.dataset.appReady = 'true'
  }
}

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  const pixelRatio = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 1.75)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.fov = width / height < 0.82 ? 74 : 64
  camera.updateProjectionMatrix()
}

window.addEventListener('resize', resize)

playBtn.addEventListener('click', startGame)
retryBtn.addEventListener('click', startGame)
lobbyBtn.addEventListener('click', returnToLobby)
quitBtn.addEventListener('click', returnToLobby)
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
resumeBtn.addEventListener('click', () => setPaused(false))

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault()
  }

  if (!state.started && !state.over) {
    if (event.code === 'Space' || event.code === 'Enter') startGame()
    return
  }
  if (state.over) {
    if (event.code === 'Space' || event.code === 'Enter') startGame()
    return
  }
  if (event.code === 'Escape' || event.code === 'KeyP') {
    setPaused(!state.paused)
    return
  }
  if (event.code === 'KeyR') {
    startReload()
    return
  }
  if (event.code === 'KeyF') {
    useMedkit()
    return
  }
  if (event.code === 'Space' && !state.paused) {
    jumpQueued = true
    return
  }
  keys.add(event.code)
})

window.addEventListener('keyup', (event) => keys.delete(event.code))
window.addEventListener('blur', () => {
  keys.clear()
  firing = false
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.started && !state.over && !state.paused) setPaused(true)
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state.started && !state.over && !state.paused) {
    setPaused(true)
  }
})

let mouseDrag = null

canvas.addEventListener('mousedown', (event) => {
  if (IS_TOUCH || !state.started || state.paused || state.over) return
  if (event.button !== 0) return
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.()
    mouseDrag = { x: event.clientX, y: event.clientY }
    firing = true
    return
  }
  firing = true
})

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    firing = false
    mouseDrag = null
  }
})

document.addEventListener('mousemove', (event) => {
  if (IS_TOUCH || !state.started || state.paused || state.over) return
  if (document.pointerLockElement === canvas) {
    player.yaw -= event.movementX * 0.0022
    player.pitch = clamp(player.pitch - event.movementY * 0.0018, -1.05, 0.95)
    return
  }
  if (mouseDrag) {
    player.yaw -= (event.clientX - mouseDrag.x) * 0.003
    player.pitch = clamp(player.pitch - (event.clientY - mouseDrag.y) * 0.0025, -1.05, 0.95)
    mouseDrag.x = event.clientX
    mouseDrag.y = event.clientY
  }
})

canvas.addEventListener('pointerdown', (event) => {
  if (!IS_TOUCH || event.pointerType !== 'touch') return
  if (!state.started || state.paused || state.over) return
  if (lookPointer) return
  lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
  canvas.setPointerCapture(event.pointerId)
})

canvas.addEventListener('pointermove', (event) => {
  if (!IS_TOUCH || event.pointerType !== 'touch') return
  if (!lookPointer || lookPointer.id !== event.pointerId) return
  const dx = event.clientX - lookPointer.x
  const dy = event.clientY - lookPointer.y
  lookPointer.x = event.clientX
  lookPointer.y = event.clientY
  player.yaw -= dx * 0.0044
  player.pitch = clamp(player.pitch - dy * 0.0034, -1.05, 0.95)
})

function endLook(event) {
  if (!lookPointer || lookPointer.id !== event.pointerId) return
  lookPointer = null
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
}

canvas.addEventListener('pointerup', endLook)
canvas.addEventListener('pointercancel', endLook)
canvas.addEventListener('contextmenu', (event) => event.preventDefault())

function updateJoystick(event) {
  const rect = joystickEl.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  let dx = event.clientX - centerX
  let dy = event.clientY - centerY
  const maxRadius = rect.width * 0.34
  const length = Math.hypot(dx, dy)
  if (length > maxRadius) {
    dx = (dx / length) * maxRadius
    dy = (dy / length) * maxRadius
  }
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
  joystick.x = dx / maxRadius
  joystick.y = dy / maxRadius
  if (Math.hypot(joystick.x, joystick.y) < 0.12) {
    joystick.x = 0
    joystick.y = 0
  }
}

joystickEl.addEventListener('pointerdown', (event) => {
  if (!state.started || state.paused || state.over) return
  event.preventDefault()
  joystickPointer = event.pointerId
  joystickEl.setPointerCapture(event.pointerId)
  joystick.active = true
  joystickEl.classList.add('active')
  updateJoystick(event)
})

joystickEl.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointer) return
  updateJoystick(event)
})

function endJoystick(event) {
  if (event.pointerId !== joystickPointer) return
  joystickPointer = null
  joystick.active = false
  joystick.x = 0
  joystick.y = 0
  joystickKnob.style.transform = 'translate(-50%, -50%)'
  joystickEl.classList.remove('active')
  if (joystickEl.hasPointerCapture(event.pointerId)) joystickEl.releasePointerCapture(event.pointerId)
}

joystickEl.addEventListener('pointerup', endJoystick)
joystickEl.addEventListener('pointercancel', endJoystick)

function startFire(event) {
  if (!state.started || state.paused || state.over) return
  event.preventDefault()
  firing = true
  fireBtn.classList.add('active')
  if (event.pointerId !== undefined) fireBtn.setPointerCapture?.(event.pointerId)
}

function stopFire() {
  firing = false
  fireBtn.classList.remove('active')
}

fireBtn.addEventListener('pointerdown', startFire)
fireBtn.addEventListener('pointerup', stopFire)
fireBtn.addEventListener('pointercancel', stopFire)
fireBtn.addEventListener('pointerleave', stopFire)

reloadBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  startReload()
})
healBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  useMedkit()
})
jumpBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  if (state.started && !state.paused && !state.over) jumpQueued = true
})

window.__PEACE = {
  state,
  player,
  bots,
  zone,
  debug,
  start: startGame,
  lobby: returnToLobby,
  teleport(x, z) {
    player.position.set(x, 0, z)
    resolveCollision(player.position, PLAYER_RADIUS, world.colliders)
    player.model.group.position.copy(player.position)
    player.blob.position.set(player.position.x, 0.035, player.position.z)
    updateCamera(0, 0, true)
    updateMinimap()
  },
  setYaw(value) {
    player.yaw = value
    updateCamera(0, 0, true)
    updateCompass()
    updateMinimap()
  },
  setPitch(value) {
    player.pitch = clamp(value, -1.05, 0.95)
    updateCamera(0, 0, true)
  },
  lookAt(x, y, z) {
    const dx = x - player.position.x
    const dy = y - (player.position.y + 1.55)
    const dz = z - player.position.z
    player.yaw = Math.atan2(-dx, -dz)
    player.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.05, 0.95)
    updateCamera(0, 0, true)
    updateCompass()
    updateMinimap()
  },
  fire: shoot,
  setFiring(value) {
    firing = value === true
  },
  hurt(amount) {
    damagePlayer(amount)
  },
  killBots() {
    for (const bot of bots) killBot(bot, player)
  },
  freeze(value) {
    debug.frozen = value === true
  },
  god(value) {
    debug.god = value === true
  },
  setZone(radius, cx = 0, cz = 0) {
    zone.radius = radius
    zone.cx = cx
    zone.cz = cz
    zone.state = 'final'
    zone.timer = 0
    updateZoneVisuals()
    updateMinimap()
    updateZoneUi()
  },
  heal() {
    useMedkit()
  },
  reload: startReload,
  camera
}

updateHud(true)
document.body.dataset.paused = 'false'
document.body.dataset.gameStarted = 'false'
document.body.dataset.gameOver = 'false'
resize()
frame()
