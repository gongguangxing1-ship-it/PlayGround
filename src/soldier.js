import * as THREE from 'three'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function createSoldier({
  uniform = 0x5d6b48,
  vest = 0x39422f,
  skin = 0xc79a72,
  helmet = 0x3f4732,
  accent = 0xf7b733,
  shadows = true
} = {}) {
  const group = new THREE.Group()
  const root = new THREE.Group()
  group.add(root)

  const uniformMaterial = new THREE.MeshStandardMaterial({ color: uniform, roughness: 0.86, metalness: 0.04 })
  const vestMaterial = new THREE.MeshStandardMaterial({ color: vest, roughness: 0.82, metalness: 0.08 })
  const skinMaterial = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8, metalness: 0 })
  const helmetMaterial = new THREE.MeshStandardMaterial({ color: helmet, roughness: 0.55, metalness: 0.25 })
  const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x26251f, roughness: 0.9 })
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.2
  })
  const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.45, metalness: 0.72 })
  const gunAccentMaterial = new THREE.MeshStandardMaterial({ color: 0x454b4d, roughness: 0.4, metalness: 0.8 })

  function part(geometry, material, x, y, z, parent = root) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadows
    mesh.receiveShadow = shadows
    parent.add(mesh)
    return mesh
  }

  const legLeft = new THREE.Group()
  legLeft.position.set(-0.155, 0.94, 0)
  root.add(legLeft)
  part(new THREE.BoxGeometry(0.19, 0.82, 0.21), uniformMaterial, 0, -0.41, 0, legLeft)
  part(new THREE.BoxGeometry(0.21, 0.14, 0.3), bootMaterial, 0, -0.86, -0.04, legLeft)

  const legRight = new THREE.Group()
  legRight.position.set(0.155, 0.94, 0)
  root.add(legRight)
  part(new THREE.BoxGeometry(0.19, 0.82, 0.21), uniformMaterial, 0, -0.41, 0, legRight)
  part(new THREE.BoxGeometry(0.21, 0.14, 0.3), bootMaterial, 0, -0.86, -0.04, legRight)

  const torso = new THREE.Group()
  torso.position.set(0, 1.31, 0)
  root.add(torso)
  part(new THREE.BoxGeometry(0.54, 0.68, 0.34), uniformMaterial, 0, 0, 0, torso)
  part(new THREE.BoxGeometry(0.6, 0.48, 0.4), vestMaterial, 0, 0.02, 0, torso)
  part(new THREE.BoxGeometry(0.15, 0.16, 0.07), accentMaterial, -0.16, 0.13, 0.22, torso)
  part(new THREE.BoxGeometry(0.15, 0.16, 0.07), vestMaterial, 0.02, 0.13, 0.23, torso)
  part(new THREE.BoxGeometry(0.15, 0.16, 0.07), vestMaterial, 0.19, 0.13, 0.22, torso)
  part(new THREE.BoxGeometry(0.38, 0.44, 0.2), vestMaterial, 0, 0.02, 0.27, torso)

  const head = new THREE.Group()
  head.position.set(0, 1.75, 0)
  root.add(head)
  part(new THREE.SphereGeometry(0.17, 14, 12), skinMaterial, 0, 0, 0, head)
  const helmetMesh = part(new THREE.SphereGeometry(0.205, 16, 12), helmetMaterial, 0, 0.045, 0.01, head)
  helmetMesh.scale.set(1, 0.86, 1.04)
  part(new THREE.BoxGeometry(0.3, 0.07, 0.1), gunMaterial, 0, 0.01, -0.145, head)
  part(new THREE.BoxGeometry(0.34, 0.06, 0.06), accentMaterial, 0, 0.12, -0.02, head)

  const armLeft = new THREE.Group()
  armLeft.position.set(-0.35, 1.52, 0)
  armLeft.rotation.x = -1.02
  armLeft.rotation.z = 0.18
  root.add(armLeft)
  part(new THREE.BoxGeometry(0.15, 0.46, 0.17), uniformMaterial, 0, -0.23, 0, armLeft)
  part(new THREE.BoxGeometry(0.13, 0.15, 0.14), skinMaterial, 0, -0.49, 0, armLeft)

  const armRight = new THREE.Group()
  armRight.position.set(0.35, 1.52, 0)
  armRight.rotation.x = -1.16
  armRight.rotation.z = -0.14
  root.add(armRight)
  part(new THREE.BoxGeometry(0.15, 0.46, 0.17), uniformMaterial, 0, -0.23, 0, armRight)
  part(new THREE.BoxGeometry(0.13, 0.15, 0.14), skinMaterial, 0, -0.49, 0, armRight)

  const gun = new THREE.Group()
  gun.position.set(0.12, 1.3, -0.28)
  torso.add(gun)
  part(new THREE.BoxGeometry(0.09, 0.13, 0.62), gunMaterial, 0, 0, -0.16, gun)
  part(new THREE.BoxGeometry(0.07, 0.08, 0.4), gunAccentMaterial, 0, 0.04, -0.48, gun)
  const barrel = part(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 8), gunMaterial, 0, 0.03, -0.72, gun)
  barrel.rotation.x = Math.PI / 2
  part(new THREE.BoxGeometry(0.08, 0.22, 0.11), gunMaterial, 0, -0.16, -0.22, gun)
  part(new THREE.BoxGeometry(0.06, 0.1, 0.26), gunMaterial, 0, -0.02, 0.24, gun)
  part(new THREE.BoxGeometry(0.07, 0.07, 0.16), gunAccentMaterial, 0, 0.1, -0.2, gun)

  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.03, -0.95)
  gun.add(muzzle)

  let walkPhase = Math.random() * Math.PI * 2
  let dead = false
  let deadTime = 0

  const api = {
    group,
    root,
    torso,
    head,
    gun,
    muzzle,
    legLeft,
    legRight,
    armLeft,
    armRight,
    get dead() {
      return dead
    },
    update(dt, { moving = false, speed = 0, pitch = 0, time = 0, aiming = false } = {}) {
      if (dead) {
        deadTime += dt
        const fall = Math.min(1, deadTime * 3.4)
        root.rotation.x = fall * 1.42
        root.position.y = -fall * 0.12
        return
      }

      const moveAmount = moving ? clamp(speed / 5.2, 0, 1.5) : 0
      if (moving) walkPhase += dt * (5.4 + speed * 1.15)
      const swing = Math.sin(walkPhase) * 0.62 * moveAmount

      api.legLeft.rotation.x = swing
      api.legRight.rotation.x = -swing
      api.armLeft.rotation.x = -1.02 + Math.sin(walkPhase + Math.PI) * 0.08 * moveAmount
      api.armRight.rotation.x = -1.16 + Math.sin(walkPhase) * 0.05 * moveAmount

      const bob = Math.abs(Math.sin(walkPhase)) * 0.05 * moveAmount + Math.sin(time * 1.8) * 0.008
      root.position.y = bob
      root.rotation.z = Math.sin(walkPhase) * 0.02 * moveAmount

      torso.rotation.x = pitch * 0.22
      head.rotation.x = pitch * 0.32
      gun.rotation.x = pitch * 0.72

      if (aiming) {
        api.armLeft.rotation.z = 0.1
        api.armRight.rotation.z = -0.06
      } else {
        api.armLeft.rotation.z = 0.18
        api.armRight.rotation.z = -0.14
      }
    },
    die() {
      if (dead) return
      dead = true
      deadTime = 0
    },
    reset() {
      dead = false
      deadTime = 0
      root.rotation.set(0, 0, 0)
      root.position.set(0, 0, 0)
    }
  }

  return api
}
