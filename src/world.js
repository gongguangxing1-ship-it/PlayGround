import * as THREE from 'three'

export const MAP_HALF = 108

const rand = (min, max) => min + Math.random() * (max - min)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function canvasTexture(size, paint, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  paint(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function speckle(ctx, size, count, palette, minSize = 1, maxSize = 3, alpha = 0.4) {
  for (let index = 0; index < count; index += 1) {
    ctx.globalAlpha = rand(alpha * 0.35, alpha)
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)]
    const s = rand(minSize, maxSize)
    ctx.fillRect(rand(0, size), rand(0, size), s, s)
  }
  ctx.globalAlpha = 1
}

function makeGrassTexture() {
  return canvasTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = '#526b3c'
      ctx.fillRect(0, 0, size, size)
      speckle(ctx, size, 11000, ['#5f7c45', '#48602f', '#6c8650', '#3f5429', '#7b8a55'], 1, 4, 0.5)

      for (let index = 0; index < 22; index += 1) {
        const x = rand(0, size)
        const y = rand(0, size)
        const radius = rand(16, 66)
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, 'rgba(116,102,68,0.42)')
        gradient.addColorStop(1, 'rgba(116,102,68,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }

      ctx.strokeStyle = 'rgba(96,120,66,0.18)'
      ctx.lineWidth = 2
      for (let y = 0; y < size; y += 26) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(size, y + rand(-6, 6))
        ctx.stroke()
      }
    },
    14,
    14
  )
}

function makeDirtTexture() {
  return canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#8b7a58'
      ctx.fillRect(0, 0, size, size)
      speckle(ctx, size, 4200, ['#9c8a63', '#776646', '#a4936c', '#6c5c40'], 1, 4, 0.55)
      ctx.strokeStyle = 'rgba(88,74,50,0.4)'
      ctx.lineWidth = 5
      for (const x of [66, 190]) {
        ctx.beginPath()
        ctx.moveTo(x + rand(-6, 6), 0)
        ctx.lineTo(x + rand(-8, 8), size)
        ctx.stroke()
      }
    },
    2,
    20
  )
}

function makeConcreteTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#9b9c92'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 3600, ['#a8a99f', '#8c8d84', '#b2b3a9', '#7f8078'], 1, 3, 0.4)
    ctx.strokeStyle = 'rgba(80,82,76,0.35)'
    ctx.lineWidth = 2
    for (let y = 64; y < size; y += 64) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(70,72,66,0.28)'
    ctx.lineWidth = 1.4
    for (let index = 0; index < 5; index += 1) {
      ctx.beginPath()
      let x = rand(0, size)
      let y = rand(0, size)
      ctx.moveTo(x, y)
      for (let step = 0; step < 4; step += 1) {
        x += rand(-22, 22)
        y += rand(6, 26)
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  })
}

function makeContainerTexture(base, dark) {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = x % 32 === 0 ? dark : 'rgba(255,255,255,0.07)'
      ctx.fillRect(x, 0, 6, size)
    }
    speckle(ctx, size, 1500, [dark, '#6b3f26', '#2f3d42', 'rgba(255,255,255,0.5)'], 1, 5, 0.3)
    ctx.strokeStyle = dark
    ctx.lineWidth = 10
    ctx.strokeRect(0, 0, size, size)
  })
}

function makeWoodTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#7c5c3a'
    ctx.fillRect(0, 0, size, size)
    for (let y = 0; y < size; y += 22) {
      ctx.fillStyle = 'rgba(58,40,24,0.35)'
      ctx.fillRect(0, y, size, 3)
      ctx.fillStyle = 'rgba(255,220,160,0.06)'
      ctx.fillRect(0, y + 4, size, 2)
    }
    speckle(ctx, size, 900, ['#8a6842', '#5f452a', '#93714a'], 1, 4, 0.35)
  })
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.24, 'rgba(255,245,210,0.9)')
  gradient.addColorStop(0.55, 'rgba(255,190,90,0.32)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 256, 128)
  for (let index = 0; index < 26; index += 1) {
    const x = rand(30, 226)
    const y = rand(40, 92)
    const radius = rand(18, 46)
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function addCollider(colliders, x, z, width, depth, height, blocksSight = true) {
  colliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    height,
    blocksSight
  })
}

function pointFree(x, z, radius, colliders) {
  for (const collider of colliders) {
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

export function buildWorld(scene, { shadows = true } = {}) {
  const colliders = []
  const buildings = []
  const lootSpots = []
  const animated = []

  const grassTexture = makeGrassTexture()
  const dirtTexture = makeDirtTexture()
  const concreteTexture = makeConcreteTexture()
  const woodTexture = makeWoodTexture()
  const glowTexture = makeGlowTexture()
  const cloudTexture = makeCloudTexture()

  scene.fog = new THREE.Fog(0xbfcfc8, 78, 238)

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(430, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3f7fb8) },
        horizonColor: { value: new THREE.Color(0xdfe8dd) },
        bottomColor: { value: new THREE.Color(0x9aa88f) }
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y;
          vec3 color = mix(horizonColor, topColor, smoothstep(0.02, 0.6, h));
          color = mix(bottomColor, color, smoothstep(-0.25, 0.02, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    })
  )
  sky.frustumCulled = false
  scene.add(sky)

  const hemisphere = new THREE.HemisphereLight(0xd6ecff, 0x3d4a2c, 1.5)
  scene.add(hemisphere)

  const sun = new THREE.DirectionalLight(0xfff2d6, 2.35)
  sun.position.set(58, 86, 44)
  sun.castShadow = shadows
  if (shadows) {
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -42
    sun.shadow.camera.right = 42
    sun.shadow.camera.top = 42
    sun.shadow.camera.bottom = -42
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 220
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.02
  }
  scene.add(sun)
  scene.add(sun.target)

  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffe7ae,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })
  )
  sunSprite.position.set(150, 165, 110)
  sunSprite.scale.set(120, 120, 1)
  scene.add(sunSprite)

  const grassMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    roughness: 0.98,
    metalness: 0
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280, 1, 1), grassMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = shadows
  scene.add(ground)

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: dirtTexture,
    roughness: 1,
    metalness: 0
  })
  const roadA = new THREE.Mesh(new THREE.PlaneGeometry(12, 250), roadMaterial)
  roadA.rotation.x = -Math.PI / 2
  roadA.position.set(-2, 0.015, 0)
  roadA.receiveShadow = shadows
  scene.add(roadA)

  const roadB = new THREE.Mesh(new THREE.PlaneGeometry(250, 10), roadMaterial)
  roadB.rotation.x = -Math.PI / 2
  roadB.position.set(0, 0.018, 6)
  roadB.receiveShadow = shadows
  scene.add(roadB)

  const grassTuftGeometry = new THREE.ConeGeometry(0.13, 0.5, 3)
  grassTuftGeometry.translate(0, 0.25, 0)
  const grassTufts = new THREE.InstancedMesh(
    grassTuftGeometry,
    new THREE.MeshStandardMaterial({ color: 0x6a8347, roughness: 1 }),
    760
  )
  const dummy = new THREE.Object3D()
  for (let index = 0; index < 760; index += 1) {
    const x = rand(-118, 118)
    const z = rand(-118, 118)
    dummy.position.set(x, 0, z)
    dummy.rotation.y = rand(0, Math.PI * 2)
    dummy.scale.setScalar(rand(0.7, 1.6))
    dummy.updateMatrix()
    grassTufts.setMatrixAt(index, dummy.matrix)
  }
  grassTufts.instanceMatrix.needsUpdate = true
  grassTufts.frustumCulled = true
  scene.add(grassTufts)

  const concreteMaterial = new THREE.MeshStandardMaterial({
    map: concreteTexture,
    color: 0xd7d4c6,
    roughness: 0.92,
    metalness: 0.04
  })
  const concreteMaterialDark = new THREE.MeshStandardMaterial({
    map: concreteTexture,
    color: 0x9a9a8e,
    roughness: 0.94,
    metalness: 0.04
  })
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4c45,
    roughness: 0.9,
    metalness: 0.08
  })
  const darkGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c2a2c,
    emissive: 0x0a1618,
    emissiveIntensity: 0.8,
    roughness: 0.24,
    metalness: 0.4
  })
  const woodMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xc7a276,
    roughness: 0.9
  })
  const sandbagMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a8a63,
    roughness: 1
  })
  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f6b45,
    roughness: 0.72,
    metalness: 0.35
  })
  const barrelRustMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a4a2c,
    roughness: 0.8,
    metalness: 0.3
  })
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x555c58,
    roughness: 0.7,
    metalness: 0.45
  })

  function box(width, height, depth, material, x, y, z, { cast = true, receive = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = cast && shadows
    mesh.receiveShadow = receive && shadows
    scene.add(mesh)
    return mesh
  }

  function windowStrip(x, y, z, width, height, depth, rotationY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), darkGlassMaterial)
    mesh.position.set(x, y, z)
    mesh.rotation.y = rotationY
    scene.add(mesh)
  }

  function addHouse({ x, z, width, depth, height, material, label }) {
    box(width, height, depth, material, x, height / 2, z)
    box(width + 0.8, 0.34, depth + 0.8, roofMaterial, x, height + 0.17, z)
    box(width + 0.9, 0.12, depth + 0.9, roofMaterial, x, height + 0.02, z)
    addCollider(colliders, x, z, width, depth, height + 0.4)

    const windowY = height * 0.6
    windowStrip(x, windowY, z + depth / 2 + 0.02, width * 0.46, 0.72, 0.08)
    windowStrip(x, windowY, z - depth / 2 - 0.02, width * 0.46, 0.72, 0.08)
    windowStrip(x + width / 2 + 0.02, windowY, z, 0.08, 0.72, depth * 0.46)
    windowStrip(x - width / 2 - 0.02, windowY, z, 0.08, 0.72, depth * 0.46)

    box(1.1, 2.05, 0.12, darkGlassMaterial, x + width * 0.22, 1.02, z + depth / 2 + 0.05)
    box(1.5, 0.16, 0.8, roofMaterial, x - width * 0.24, height * 0.55, z + depth / 2 + 0.35)

    buildings.push({ x, z, width, depth, height, label })
    lootSpots.push({ x: x + rand(-width, width) * 0.9, z: z + depth / 2 + rand(2.4, 4.2) })
    lootSpots.push({ x: x - width / 2 - rand(2.2, 3.8), z: z + rand(-depth, depth) * 0.7 })
  }

  function addWarehouse(x, z, width, depth, height) {
    box(width, height, depth, concreteMaterialDark, x, height / 2, z)
    box(width + 1, 0.4, depth + 1, roofMaterial, x, height + 0.2, z)
    addCollider(colliders, x, z, width, depth, height + 0.4)
    for (let index = -2; index <= 2; index += 1) {
      windowStrip(x + index * (width / 6), height * 0.72, z + depth / 2 + 0.03, width / 9, 0.8, 0.1)
    }
    box(width * 0.34, height * 0.66, 0.2, darkGlassMaterial, x - width * 0.2, height * 0.33, z + depth / 2 + 0.05)
    box(1.2, 0.18, 0.9, roofMaterial, x + width * 0.22, height + 0.5, z)
    buildings.push({ x, z, width, depth, height, label: 'warehouse' })
    lootSpots.push({ x: x + width * 0.35, z: z + depth / 2 + rand(2.5, 4) })
    lootSpots.push({ x: x - width * 0.3, z: z - depth / 2 - rand(2.5, 4) })
  }

  function addContainer(x, z, color, stacked = false) {
    const texture = makeContainerTexture(color, '#2f332f')
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.3 })
    const width = 6.1
    const height = 2.65
    const depth = 2.55
    const y = stacked ? height + 0.02 : height / 2
    box(width, height, depth, material, x, y, z)
    if (stacked) box(width, height, depth, material, x, height * 2 + 0.04, z)
    addCollider(colliders, x, z, width, depth, stacked ? height * 2 : height)
    box(0.1, height * 0.86, 0.12, metalMaterial, x - width / 2 + 0.3, y, z + depth / 2 + 0.04)
    box(0.1, height * 0.86, 0.12, metalMaterial, x + width / 2 - 0.3, y, z + depth / 2 + 0.04)
    buildings.push({ x, z, width, depth, height: stacked ? height * 2 : height, label: 'container' })
    lootSpots.push({ x: x + rand(-width, width) * 0.8, z: z + depth / 2 + rand(2, 3.4) })
  }

  function addWatchtower(x, z) {
    const legOffset = 2.1
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(0.26, 7.2, 0.26, metalMaterial, x + sx * legOffset, 3.6, z + sz * legOffset)
        addCollider(colliders, x + sx * legOffset, z + sz * legOffset, 0.5, 0.5, 7.2)
      }
    }
    box(5.1, 0.3, 5.1, woodMaterial, x, 7.3, z)
    box(5.1, 0.9, 0.16, woodMaterial, x, 7.85, z - 2.45)
    box(5.1, 0.9, 0.16, woodMaterial, x, 7.85, z + 2.45)
    box(0.16, 0.9, 5.1, woodMaterial, x - 2.45, 7.85, z)
    box(0.16, 0.9, 5.1, woodMaterial, x + 2.45, 7.85, z)
    box(5.8, 0.28, 5.8, roofMaterial, x, 9.1, z)
    buildings.push({ x, z, width: 5.4, depth: 5.4, height: 9.4, label: 'tower' })
  }

  function addSandbags(x, z, length, rotation = 0) {
    const horizontal = rotation === 0
    const width = horizontal ? length : 0.8
    const depth = horizontal ? 0.8 : length
    box(width, 0.92, depth, sandbagMaterial, x, 0.46, z)
    const rows = Math.max(2, Math.round(length / 1.1))
    for (let index = 0; index < rows; index += 1) {
      const t = (index + 0.5) / rows - 0.5
      const px = horizontal ? x + t * length : x
      const pz = horizontal ? z : z + t * length
      box(horizontal ? length / rows - 0.06 : 0.74, 0.3, horizontal ? 0.74 : length / rows - 0.06, sandbagMaterial, px, 0.95, pz)
    }
    addCollider(colliders, x, z, width, depth, 1.1, false)
  }

  function addCrates(x, z, count = 3) {
    for (let index = 0; index < count; index += 1) {
      const size = rand(0.9, 1.25)
      const px = x + rand(-1.6, 1.6)
      const pz = z + rand(-1.6, 1.6)
      box(size, size, size, woodMaterial, px, size / 2, pz)
      addCollider(colliders, px, pz, size, size, size, false)
      if (Math.random() < 0.4) {
        box(size * 0.86, 0.1, size * 0.86, metalMaterial, px, size + 0.02, pz)
      }
    }
    lootSpots.push({ x: x + rand(-2.5, 2.5), z: z + rand(2.2, 3.6) })
  }

  function addBarrel(x, z) {
    const material = Math.random() < 0.5 ? barrelMaterial : barrelRustMaterial
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), material)
    mesh.position.set(x, 0.575, z)
    mesh.castShadow = shadows
    mesh.receiveShadow = shadows
    scene.add(mesh)
    addCollider(colliders, x, z, 0.86, 0.86, 1.15, false)
  }

  addWarehouse(-20, -13, 16, 9, 5.4)
  addWarehouse(28, 24, 13, 8, 4.8)
  addHouse({ x: 15, z: -22, width: 9, depth: 7, height: 4.2, material: concreteMaterial })
  addHouse({ x: -31, z: 22, width: 8, depth: 7, height: 4, material: concreteMaterial })
  addHouse({ x: 34, z: -8, width: 7, depth: 6, height: 3.8, material: concreteMaterialDark })
  addHouse({ x: -12, z: 34, width: 8.5, depth: 6.5, height: 4.1, material: concreteMaterial })
  addHouse({ x: 6, z: 48, width: 7, depth: 6, height: 3.6, material: concreteMaterialDark })
  addHouse({ x: -48, z: -30, width: 9, depth: 7.5, height: 4.4, material: concreteMaterial })
  addHouse({ x: 56, z: 44, width: 10, depth: 8, height: 4.6, material: concreteMaterialDark })
  addHouse({ x: 48, z: -52, width: 7.5, depth: 6.5, height: 3.9, material: concreteMaterial })
  addHouse({ x: -62, z: 54, width: 11, depth: 9, height: 5.2, material: concreteMaterialDark })

  addContainer(8, 10, '#7a3b2c')
  addContainer(9.4, 12.8, '#33505a', true)
  addContainer(-4, -2, '#4c5a35')
  addContainer(44, 12, '#3c4c63')
  addContainer(-52, -6, '#6b3c2b')
  addContainer(18, 46, '#44523c')

  addWatchtower(0, -40)
  addWatchtower(-58, 18)

  addSandbags(2, 22, 5.2)
  addSandbags(-8, 18, 4.2, Math.PI / 2)
  addSandbags(22, -16, 5.4)
  addSandbags(-40, 6, 4.6, Math.PI / 2)
  addSandbags(38, 34, 5)
  addSandbags(-26, -44, 4.4)

  addCrates(4, -8, 4)
  addCrates(26, 10, 3)
  addCrates(-36, 36, 4)
  addCrates(52, -20, 3)
  addCrates(-16, 48, 3)
  addCrates(60, 30, 3)

  for (let index = 0; index < 22; index += 1) {
    let x = rand(-95, 95)
    let z = rand(-95, 95)
    if (!pointFree(x, z, 1.2, colliders)) {
      x += rand(-8, 8)
      z += rand(-8, 8)
    }
    addBarrel(x, z)
  }

  const treeTrunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 1, 6)
  treeTrunkGeometry.translate(0, 0.5, 0)
  const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 1 })
  const foliageGeometry = new THREE.ConeGeometry(1, 1, 7)
  foliageGeometry.translate(0, 0.5, 0)
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x4b6a3a, roughness: 1 })

  const treeCount = 78
  const trunks = new THREE.InstancedMesh(treeTrunkGeometry, treeTrunkMaterial, treeCount)
  const foliageLow = new THREE.InstancedMesh(foliageGeometry, foliageMaterial, treeCount)
  const foliageHigh = new THREE.InstancedMesh(foliageGeometry, foliageMaterial.clone(), treeCount)
  foliageHigh.material.color.set(0x587a42)

  const treePositions = []
  for (let index = 0; index < treeCount; index += 1) {
    let x = 0
    let z = 0
    let attempts = 0
    do {
      const angle = rand(0, Math.PI * 2)
      const radius = rand(24, 104)
      x = Math.cos(angle) * radius
      z = Math.sin(angle) * radius
      attempts += 1
    } while (!pointFree(x, z, 1.6, colliders) && attempts < 24)

    const height = rand(4.2, 8.4)
    const spread = rand(1.4, 2.3)
    treePositions.push({ x, z, height, spread })

    dummy.position.set(x, 0, z)
    dummy.rotation.set(0, rand(0, Math.PI * 2), 0)
    dummy.scale.set(rand(0.8, 1.2), height * 0.55, rand(0.8, 1.2))
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)

    dummy.position.set(x, height * 0.42, z)
    dummy.rotation.set(0, rand(0, Math.PI * 2), 0)
    dummy.scale.set(spread, height * 0.55, spread)
    dummy.updateMatrix()
    foliageLow.setMatrixAt(index, dummy.matrix)

    dummy.position.set(x, height * 0.68, z)
    dummy.scale.set(spread * 0.68, height * 0.42, spread * 0.68)
    dummy.updateMatrix()
    foliageHigh.setMatrixAt(index, dummy.matrix)

    addCollider(colliders, x, z, 0.8, 0.8, height * 0.5, false)
  }
  for (const mesh of [trunks, foliageLow, foliageHigh]) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = shadows
    mesh.receiveShadow = shadows
    scene.add(mesh)
  }

  const rockGeometry = new THREE.DodecahedronGeometry(1, 0)
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x8a8a7e, roughness: 0.95 })
  const rockCount = 34
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount)
  for (let index = 0; index < rockCount; index += 1) {
    let x = rand(-100, 100)
    let z = rand(-100, 100)
    let attempts = 0
    while (!pointFree(x, z, 2, colliders) && attempts < 20) {
      x = rand(-100, 100)
      z = rand(-100, 100)
      attempts += 1
    }
    const scale = rand(0.7, 2.1)
    dummy.position.set(x, scale * 0.38, z)
    dummy.rotation.set(rand(0, 1), rand(0, Math.PI * 2), rand(0, 1))
    dummy.scale.set(scale * rand(0.9, 1.5), scale * rand(0.55, 0.9), scale * rand(0.9, 1.5))
    dummy.updateMatrix()
    rocks.setMatrixAt(index, dummy.matrix)
    if (scale > 1.15) addCollider(colliders, x, z, scale * 1.5, scale * 1.5, scale, false)
  }
  rocks.instanceMatrix.needsUpdate = true
  rocks.castShadow = shadows
  rocks.receiveShadow = shadows
  scene.add(rocks)

  const bushGeometry = new THREE.IcosahedronGeometry(1, 0)
  const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x3f5a31, roughness: 1 })
  const bushCount = 80
  const bushes = new THREE.InstancedMesh(bushGeometry, bushMaterial, bushCount)
  for (let index = 0; index < bushCount; index += 1) {
    const x = rand(-104, 104)
    const z = rand(-104, 104)
    dummy.position.set(x, rand(0.2, 0.5), z)
    dummy.rotation.set(rand(0, 1), rand(0, Math.PI * 2), 0)
    dummy.scale.set(rand(0.6, 1.3), rand(0.45, 0.9), rand(0.6, 1.3))
    dummy.updateMatrix()
    bushes.setMatrixAt(index, dummy.matrix)
  }
  bushes.instanceMatrix.needsUpdate = true
  bushes.castShadow = false
  bushes.receiveShadow = false
  scene.add(bushes)

  const hillGeometry = new THREE.IcosahedronGeometry(1, 1)
  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x6d8062, roughness: 1 })
  const hillCount = 30
  const hills = new THREE.InstancedMesh(hillGeometry, hillMaterial, hillCount)
  for (let index = 0; index < hillCount; index += 1) {
    const angle = (index / hillCount) * Math.PI * 2 + rand(-0.05, 0.05)
    const radius = rand(132, 176)
    dummy.position.set(Math.cos(angle) * radius, rand(-4, 2), Math.sin(angle) * radius)
    dummy.rotation.set(0, rand(0, Math.PI * 2), 0)
    dummy.scale.set(rand(18, 38), rand(10, 26), rand(18, 38))
    dummy.updateMatrix()
    hills.setMatrixAt(index, dummy.matrix)
  }
  hills.instanceMatrix.needsUpdate = true
  scene.add(hills)

  const clouds = []
  for (let index = 0; index < 11; index += 1) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: rand(0.28, 0.5),
        depthWrite: false,
        fog: false
      })
    )
    cloud.position.set(rand(-190, 190), rand(58, 96), rand(-190, 190))
    cloud.scale.set(rand(48, 96), rand(22, 42), 1)
    scene.add(cloud)
    clouds.push({ sprite: cloud, speed: rand(0.3, 1.1) })
  }

  const flags = []
  for (const [x, z] of [[0, -40], [-58, 18]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), metalMaterial)
    pole.position.set(x + 2.1, 10.7, z)
    scene.add(pole)
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.9, 6, 1),
      new THREE.MeshStandardMaterial({ color: 0xd9a323, side: THREE.DoubleSide, roughness: 0.9 })
    )
    flag.position.set(x + 2.9, 11.7, z)
    scene.add(flag)
    flags.push({ mesh: flag, phase: rand(0, Math.PI * 2) })
  }

  for (let index = 0; index < 14; index += 1) {
    let x = rand(-90, 90)
    let z = rand(-90, 90)
    let attempts = 0
    while (!pointFree(x, z, 1.4, colliders) && attempts < 24) {
      x = rand(-90, 90)
      z = rand(-90, 90)
      attempts += 1
    }
    lootSpots.push({ x, z })
  }

  function update(t, dt) {
    for (const cloud of clouds) {
      cloud.sprite.position.x += cloud.speed * dt
      if (cloud.sprite.position.x > 210) cloud.sprite.position.x = -210
    }
    for (const flag of flags) {
      const attribute = flag.mesh.geometry.attributes.position
      for (let index = 0; index < attribute.count; index += 1) {
        const x = attribute.getX(index)
        attribute.setZ(index, Math.sin(t * 3 + flag.phase + x * 2.2) * 0.09 * (x + 0.8))
      }
      attribute.needsUpdate = true
    }
  }

  return {
    colliders,
    buildings,
    lootSpots,
    sun,
    glowTexture,
    update,
    half: MAP_HALF
  }
}

export function resolveCollision(position, radius, colliders, half = MAP_HALF) {
  position.x = clamp(position.x, -half + radius, half - radius)
  position.z = clamp(position.z, -half + radius, half - radius)

  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (const collider of colliders) {
      const minX = collider.minX - radius
      const maxX = collider.maxX + radius
      const minZ = collider.minZ - radius
      const maxZ = collider.maxZ + radius
      if (position.x <= minX || position.x >= maxX || position.z <= minZ || position.z >= maxZ) continue

      const left = position.x - minX
      const right = maxX - position.x
      const back = position.z - minZ
      const front = maxZ - position.z
      const smallest = Math.min(left, right, back, front)

      if (smallest === left) position.x = minX
      else if (smallest === right) position.x = maxX
      else if (smallest === back) position.z = minZ
      else position.z = maxZ
    }
  }
  return position
}

export function isPointBlocked(x, y, z, colliders) {
  for (const collider of colliders) {
    if (
      x > collider.minX &&
      x < collider.maxX &&
      z > collider.minZ &&
      z < collider.maxZ &&
      y > 0 &&
      y < collider.height
    ) {
      return true
    }
  }
  return false
}
