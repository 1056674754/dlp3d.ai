'use client'

import {
  Scene,
  Mesh,
  VertexBuffer,
  MorphTargetManager,
  MorphTarget,
  Skeleton,
  Bone,
  AnimationGroup,
  Animation,
  Matrix,
  Vector3,
  Quaternion,
  Color3,
  PBRMaterial,
  Texture,
  SubMesh,
  AbstractMesh,
  TransformNode,
} from '@babylonjs/core'
import type { ISceneLoaderAsyncResult } from '@babylonjs/core'
import { logStartupEvent, createStartupSpan } from '@/utils/startupProfiler'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const DB_NAME = 'dlp3d-character-cache'
const DB_VERSION = 1
const STORE_NAME = 'characters'
const FORMAT_VERSION = 2

const VERTEX_KINDS = [
  VertexBuffer.PositionKind,
  VertexBuffer.NormalKind,
  VertexBuffer.TangentKind,
  VertexBuffer.UVKind,
  VertexBuffer.UV2Kind,
  VertexBuffer.ColorKind,
  VertexBuffer.MatricesIndicesKind,
  VertexBuffer.MatricesWeightsKind,
  VertexBuffer.MatricesIndicesExtraKind,
  VertexBuffer.MatricesWeightsExtraKind,
]

interface CachedCharacter {
  formatVersion: number
  cacheKey: string
  timestamp: number
  meshes: CachedMesh[]
  skeleton: CachedSkeleton | null
  animationGroups: CachedAnimGroup[]
  gltfMaterials: CachedGltfMaterial[]
  images: CachedImage[]
}

interface CachedMesh {
  name: string
  parentName: string | null
  position: number[]
  rotationQuaternion: number[] | null
  rotation: number[]
  scaling: number[]
  isVisible: boolean
  receiveShadows: boolean
  numBoneInfluencers: number
  vertexData: Record<string, Float32Array>
  indices: Uint32Array
  totalVertices: number
  subMeshes: {
    materialIndex: number
    verticesStart: number
    verticesCount: number
    indexStart: number
    indexCount: number
  }[]
  morphTargets: CachedMorphTarget[]
  materialIndex: number
}

interface CachedMorphTarget {
  name: string
  influence: number
  positions: Float32Array | null
  normals: Float32Array | null
  tangents: Float32Array | null
  uvs: Float32Array | null
}

interface CachedSkeleton {
  name: string
  id: string
  bones: CachedBone[]
}

interface CachedBone {
  name: string
  index: number
  parentIndex: number
  matrix: number[]
  rest: number[]
  length: number
}

interface CachedAnimGroup {
  name: string
  from: number
  to: number
  animations: CachedTargetedAnim[]
}

interface CachedTargetedAnim {
  targetType: 'bone' | 'mesh' | 'transformNode' | 'morphTarget'
  targetName: string
  meshName?: string
  morphTargetIndex?: number
  animation: CachedAnim
}

interface CachedAnim {
  name: string
  targetProperty: string
  framePerSecond: number
  dataType: number
  loopMode: number
  keys: {
    frame: number
    value: number[]
    inTangent?: number[]
    outTangent?: number[]
  }[]
}

interface CachedGltfMaterial {
  name: string
  pbrBaseColorFactor: number[]
  metallicFactor: number
  roughnessFactor: number
  emissiveFactor: number[]
  doubleSided: boolean
  alphaMode: string
  alphaCutoff: number
  baseColorTexIdx: number
  metallicRoughnessTexIdx: number
  normalTexIdx: number
  emissiveTexIdx: number
  occlusionTexIdx: number
}

interface CachedImage {
  mimeType: string
  data: ArrayBuffer
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getFromDB(key: string): Promise<CachedCharacter | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      const result = req.result as CachedCharacter | undefined
      resolve(result && result.formatVersion === FORMAT_VERSION ? result : null)
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

async function putToDB(data: CachedCharacter): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(data)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

// ---------------------------------------------------------------------------
// GLB parsing — extract glTF JSON + embedded images
// ---------------------------------------------------------------------------

interface ParsedGLB {
  json: Record<string, unknown>
  binChunk: Uint8Array
}

function parseGLBHeader(buffer: ArrayBuffer): ParsedGLB {
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file')

  const jsonLen = view.getUint32(12, true)
  const jsonBytes = new Uint8Array(buffer, 20, jsonLen)
  const json = JSON.parse(new TextDecoder().decode(jsonBytes))

  let binChunk = new Uint8Array(0)
  const binOffset = 12 + 8 + jsonLen
  if (binOffset + 8 <= buffer.byteLength) {
    const binLen = view.getUint32(binOffset, true)
    binChunk = new Uint8Array(buffer, binOffset + 8, binLen)
  }

  return { json, binChunk }
}

function extractGLBImages(glb: ParsedGLB): CachedImage[] {
  const gltf = glb.json as Record<string, unknown>
  const images = (gltf.images ?? []) as { bufferView?: number; mimeType?: string }[]
  const bufferViews = (gltf.bufferViews ?? []) as {
    byteOffset?: number
    byteLength: number
  }[]

  return images.map(img => {
    if (img.bufferView === undefined)
      return { mimeType: 'image/png', data: new ArrayBuffer(0) }
    const bv = bufferViews[img.bufferView]
    const offset = bv.byteOffset ?? 0
    return {
      mimeType: img.mimeType ?? 'image/png',
      data: glb.binChunk.slice(offset, offset + bv.byteLength).buffer,
    }
  })
}

function extractGLBMaterials(gltf: Record<string, unknown>): CachedGltfMaterial[] {
  const textures = (gltf.textures ?? []) as { source?: number }[]
  const resolve = (texInfo: { index?: number } | undefined): number => {
    if (!texInfo || texInfo.index === undefined) return -1
    const t = textures[texInfo.index]
    return t?.source ?? -1
  }

  return ((gltf.materials ?? []) as Record<string, unknown>[]).map(
    (m: Record<string, unknown>) => {
      const pbr = (m.pbrMetallicRoughness ?? {}) as Record<string, unknown>
      const bcf = (pbr.baseColorFactor as number[] | undefined) ?? [1, 1, 1, 1]
      return {
        name: (m.name as string) ?? '',
        pbrBaseColorFactor: bcf,
        metallicFactor: (pbr.metallicFactor as number) ?? 1,
        roughnessFactor: (pbr.roughnessFactor as number) ?? 1,
        emissiveFactor: (m.emissiveFactor as number[]) ?? [0, 0, 0],
        doubleSided: (m.doubleSided as boolean) ?? false,
        alphaMode: (m.alphaMode as string) ?? 'OPAQUE',
        alphaCutoff: (m.alphaCutoff as number) ?? 0.5,
        baseColorTexIdx: resolve(
          pbr.baseColorTexture as { index?: number } | undefined,
        ),
        metallicRoughnessTexIdx: resolve(
          pbr.metallicRoughnessTexture as { index?: number } | undefined,
        ),
        normalTexIdx: resolve(m.normalTexture as { index?: number } | undefined),
        emissiveTexIdx: resolve(m.emissiveTexture as { index?: number } | undefined),
        occlusionTexIdx: resolve(
          m.occlusionTexture as { index?: number } | undefined,
        ),
      }
    },
  )
}

function buildMeshMaterialMap(gltf: Record<string, unknown>): Map<string, number> {
  const nodes = (gltf.nodes ?? []) as { name?: string; mesh?: number }[]
  const meshes = (gltf.meshes ?? []) as {
    primitives: { material?: number }[]
  }[]
  const map = new Map<string, number>()

  for (const node of nodes) {
    if (node.mesh === undefined) continue
    const gltfMesh = meshes[node.mesh]
    if (!gltfMesh) continue
    const prims = gltfMesh.primitives
    if (prims.length === 1) {
      map.set(node.name ?? '', prims[0].material ?? 0)
    } else {
      prims.forEach((p, i) => {
        map.set(`${node.name ?? ''}_primitive${i}`, p.material ?? 0)
      })
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Extract — Babylon objects → CachedCharacter
// ---------------------------------------------------------------------------

function extractMesh(mesh: AbstractMesh, materialIndex: number): CachedMesh {
  const vData: Record<string, Float32Array> = {}
  for (const kind of VERTEX_KINDS) {
    const d = mesh.getVerticesData(kind)
    if (d) vData[kind] = new Float32Array(d)
  }

  const rawIdx = mesh.getIndices()
  const indices = rawIdx ? new Uint32Array(rawIdx) : new Uint32Array(0)

  const morphTargets: CachedMorphTarget[] = []
  const mtm = (mesh as Mesh).morphTargetManager
  if (mtm) {
    for (let i = 0; i < mtm.numTargets; i++) {
      const t = mtm.getTarget(i)
      morphTargets.push({
        name: t.name,
        influence: t.influence,
        positions: t.getPositions() ? new Float32Array(t.getPositions()!) : null,
        normals: t.getNormals() ? new Float32Array(t.getNormals()!) : null,
        tangents: t.getTangents() ? new Float32Array(t.getTangents()!) : null,
        uvs: t.getUVs() ? new Float32Array(t.getUVs()!) : null,
      })
    }
  }

  const subMeshes =
    (mesh as Mesh).subMeshes?.map(s => ({
      materialIndex: s.materialIndex,
      verticesStart: s.verticesStart,
      verticesCount: s.verticesCount,
      indexStart: s.indexStart,
      indexCount: s.indexCount,
    })) ?? []

  const rq = mesh.rotationQuaternion
  return {
    name: mesh.name,
    parentName: mesh.parent?.name ?? null,
    position: mesh.position.asArray(),
    rotationQuaternion: rq ? [rq.x, rq.y, rq.z, rq.w] : null,
    rotation: mesh.rotation.asArray(),
    scaling: mesh.scaling.asArray(),
    isVisible: mesh.isVisible,
    receiveShadows: mesh.receiveShadows,
    numBoneInfluencers: (mesh as Mesh).numBoneInfluencers ?? 4,
    vertexData: vData,
    indices,
    totalVertices: mesh.getTotalVertices(),
    subMeshes,
    morphTargets,
    materialIndex,
  }
}

function extractSkeleton(skeleton: Skeleton): CachedSkeleton {
  return {
    name: skeleton.name,
    id: skeleton.id,
    bones: skeleton.bones.map((b, idx) => ({
      name: b.name,
      index: idx,
      parentIndex: b.getParent() ? skeleton.bones.indexOf(b.getParent()!) : -1,
      matrix: b.getLocalMatrix().asArray(),
      rest: b.getRestMatrix().asArray(),
      length: b.length,
    })),
  }
}

function serializeAnimValue(v: unknown, dataType: number): number[] {
  if (v == null) return []
  switch (dataType) {
    case Animation.ANIMATIONTYPE_FLOAT:
      return [v as number]
    case Animation.ANIMATIONTYPE_VECTOR3: {
      const vec = v as Vector3
      return [vec.x, vec.y, vec.z]
    }
    case Animation.ANIMATIONTYPE_QUATERNION: {
      const q = v as Quaternion
      return [q.x, q.y, q.z, q.w]
    }
    case Animation.ANIMATIONTYPE_MATRIX:
      return Array.from((v as Matrix).asArray())
    case Animation.ANIMATIONTYPE_COLOR3: {
      const c = v as Color3
      return [c.r, c.g, c.b]
    }
    default:
      return [v as number]
  }
}

function extractAnimGroups(
  groups: AnimationGroup[],
  meshes: AbstractMesh[],
): CachedAnimGroup[] {
  return groups.map(g => ({
    name: g.name,
    from: g.from,
    to: g.to,
    animations: g.targetedAnimations.map(ta => {
      let targetType: CachedTargetedAnim['targetType'] = 'transformNode'
      let meshName: string | undefined
      let morphTargetIndex: number | undefined

      if (ta.target instanceof Bone) {
        targetType = 'bone'
      } else if (ta.target instanceof MorphTarget) {
        targetType = 'morphTarget'
        for (const m of meshes) {
          const mtm = (m as Mesh).morphTargetManager
          if (!mtm) continue
          for (let i = 0; i < mtm.numTargets; i++) {
            if (mtm.getTarget(i) === ta.target) {
              meshName = m.name
              morphTargetIndex = i
              break
            }
          }
          if (meshName) break
        }
      } else if (ta.target instanceof AbstractMesh) {
        targetType = 'mesh'
      }

      const anim = ta.animation
      return {
        targetType,
        targetName: ta.target.name,
        meshName,
        morphTargetIndex,
        animation: {
          name: anim.name,
          targetProperty: anim.targetProperty,
          framePerSecond: anim.framePerSecond,
          dataType: anim.dataType,
          loopMode: anim.loopMode ?? Animation.ANIMATIONLOOPMODE_CYCLE,
          keys: anim.getKeys().map(k => ({
            frame: k.frame,
            value: serializeAnimValue(k.value, anim.dataType),
            inTangent: k.inTangent
              ? serializeAnimValue(k.inTangent, anim.dataType)
              : undefined,
            outTangent: k.outTangent
              ? serializeAnimValue(k.outTangent, anim.dataType)
              : undefined,
          })),
        },
      }
    }),
  }))
}

// ---------------------------------------------------------------------------
// Restore — CachedCharacter → Babylon objects
// ---------------------------------------------------------------------------

function createTextureFromCachedImage(
  image: CachedImage,
  scene: Scene,
  label: string,
): Texture {
  const blob = new Blob([image.data], { type: image.mimeType })
  const url = URL.createObjectURL(blob)
  const tex = new Texture(
    url,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => URL.revokeObjectURL(url),
    () => URL.revokeObjectURL(url),
  )
  tex.name = label
  return tex
}

function restoreMaterials(
  cached: CachedGltfMaterial[],
  images: CachedImage[],
  scene: Scene,
): PBRMaterial[] {
  const texCache = new Map<number, Texture>()
  const getTex = (imgIdx: number, label: string): Texture | null => {
    if (imgIdx < 0 || imgIdx >= images.length) return null
    if (images[imgIdx].data.byteLength === 0) return null
    let t = texCache.get(imgIdx)
    if (!t) {
      t = createTextureFromCachedImage(images[imgIdx], scene, label)
      texCache.set(imgIdx, t)
    }
    return t
  }

  return cached.map((cm, idx) => {
    const mat = new PBRMaterial(`cached_${cm.name || idx}`, scene)
    const bcf = cm.pbrBaseColorFactor
    mat.albedoColor = new Color3(bcf[0], bcf[1], bcf[2])
    mat.alpha = bcf[3] ?? 1
    mat.metallic = cm.metallicFactor
    mat.roughness = cm.roughnessFactor
    mat.emissiveColor = new Color3(
      cm.emissiveFactor[0],
      cm.emissiveFactor[1],
      cm.emissiveFactor[2],
    )
    mat.backFaceCulling = !cm.doubleSided
    mat.forceDepthWrite = true

    if (cm.alphaMode === 'BLEND') {
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
    } else if (cm.alphaMode === 'MASK') {
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST
      mat.alphaCutOff = cm.alphaCutoff
    }

    const base = getTex(cm.baseColorTexIdx, `${cm.name}_baseColor`)
    if (base) {
      mat.albedoTexture = base
      if (bcf[3] != null && bcf[3] < 1) base.hasAlpha = true
    }
    const mr = getTex(cm.metallicRoughnessTexIdx, `${cm.name}_metallicRoughness`)
    if (mr) mat.metallicTexture = mr
    const nm = getTex(cm.normalTexIdx, `${cm.name}_normal`)
    if (nm) mat.bumpTexture = nm
    const em = getTex(cm.emissiveTexIdx, `${cm.name}_emissive`)
    if (em) mat.emissiveTexture = em
    const ao = getTex(cm.occlusionTexIdx, `${cm.name}_occlusion`)
    if (ao) mat.ambientTexture = ao

    return mat
  })
}

function restoreSkeleton(cached: CachedSkeleton, scene: Scene): Skeleton {
  const skeleton = new Skeleton(cached.name, cached.id, scene)

  for (const bd of cached.bones) {
    const parent = bd.parentIndex >= 0 ? skeleton.bones[bd.parentIndex] : null
    const localMatrix = Matrix.FromArray(bd.matrix)
    const restMatrix = Matrix.FromArray(bd.rest)
    const bone = new Bone(bd.name, skeleton, parent, localMatrix, restMatrix)
    bone.length = bd.length
  }

  return skeleton
}

function restoreMeshes(
  cached: CachedMesh[],
  scene: Scene,
  materials: PBRMaterial[],
  skeleton: Skeleton | null,
): AbstractMesh[] {
  const meshMap = new Map<string, AbstractMesh>()
  const result: AbstractMesh[] = []

  for (const cm of cached) {
    const hasGeometry =
      Object.keys(cm.vertexData).length > 0 && cm.indices.length > 0

    let node: AbstractMesh
    if (hasGeometry) {
      const mesh = new Mesh(cm.name, scene)

      for (const [kind, data] of Object.entries(cm.vertexData)) {
        mesh.setVerticesData(kind, data, false)
      }
      mesh.setIndices(cm.indices)
      ;(mesh.geometry as unknown as { _totalVertices: number })._totalVertices =
        cm.totalVertices

      if (cm.subMeshes.length > 0) {
        mesh.subMeshes = []
        for (const sm of cm.subMeshes) {
          new SubMesh(
            sm.materialIndex,
            sm.verticesStart,
            sm.verticesCount,
            sm.indexStart,
            sm.indexCount,
            mesh,
          )
        }
      }

      if (cm.morphTargets.length > 0) {
        const mtm = new MorphTargetManager(scene)
        for (const mt of cm.morphTargets) {
          const target = new MorphTarget(mt.name, mt.influence, scene)
          if (mt.positions) target.setPositions(mt.positions)
          if (mt.normals) target.setNormals(mt.normals)
          if (mt.tangents) target.setTangents(mt.tangents)
          if (mt.uvs) target.setUVs(mt.uvs)
          mtm.addTarget(target)
        }
        mesh.morphTargetManager = mtm
      }

      if (
        skeleton &&
        cm.numBoneInfluencers > 0 &&
        cm.vertexData[VertexBuffer.MatricesIndicesKind]
      ) {
        mesh.skeleton = skeleton
        mesh.numBoneInfluencers = cm.numBoneInfluencers
      }

      if (cm.materialIndex >= 0 && cm.materialIndex < materials.length) {
        mesh.material = materials[cm.materialIndex]
      }

      node = mesh
    } else {
      node = new TransformNode(cm.name, scene) as unknown as AbstractMesh
    }

    node.position = Vector3.FromArray(cm.position)
    if (cm.rotationQuaternion) {
      node.rotationQuaternion = Quaternion.FromArray(cm.rotationQuaternion)
    } else {
      node.rotation = Vector3.FromArray(cm.rotation)
    }
    node.scaling = Vector3.FromArray(cm.scaling)
    node.isVisible = cm.isVisible

    meshMap.set(cm.name, node)
    result.push(node)
  }

  for (const cm of cached) {
    if (cm.parentName) {
      const child = meshMap.get(cm.name)
      const parent = meshMap.get(cm.parentName)
      if (child && parent) child.parent = parent
    }
  }

  return result
}

function deserializeAnimValue(arr: number[], dataType: number): unknown {
  switch (dataType) {
    case Animation.ANIMATIONTYPE_FLOAT:
      return arr[0]
    case Animation.ANIMATIONTYPE_VECTOR3:
      return new Vector3(arr[0], arr[1], arr[2])
    case Animation.ANIMATIONTYPE_QUATERNION:
      return new Quaternion(arr[0], arr[1], arr[2], arr[3])
    case Animation.ANIMATIONTYPE_MATRIX:
      return Matrix.FromArray(arr)
    case Animation.ANIMATIONTYPE_COLOR3:
      return new Color3(arr[0], arr[1], arr[2])
    default:
      return arr[0]
  }
}

function restoreAnimGroups(
  cached: CachedAnimGroup[],
  scene: Scene,
  skeleton: Skeleton | null,
  meshes: AbstractMesh[],
): AnimationGroup[] {
  return cached.map(cg => {
    const group = new AnimationGroup(cg.name, scene)

    for (const ta of cg.animations) {
      let target: unknown = null

      switch (ta.targetType) {
        case 'bone':
          target = skeleton?.bones.find(b => b.name === ta.targetName) ?? null
          break
        case 'morphTarget':
          if (ta.meshName != null && ta.morphTargetIndex != null) {
            const m = meshes.find(mm => mm.name === ta.meshName) as Mesh | undefined
            target = m?.morphTargetManager?.getTarget(ta.morphTargetIndex) ?? null
          }
          break
        default:
          target =
            meshes.find(m => m.name === ta.targetName) ??
            scene.getTransformNodeByName(ta.targetName)
          break
      }

      if (!target) continue

      const ca = ta.animation
      const anim = new Animation(
        ca.name,
        ca.targetProperty,
        ca.framePerSecond,
        ca.dataType,
        ca.loopMode,
      )
      anim.setKeys(
        ca.keys.map(k => ({
          frame: k.frame,
          value: deserializeAnimValue(k.value, ca.dataType),
          inTangent: k.inTangent
            ? deserializeAnimValue(k.inTangent, ca.dataType)
            : undefined,
          outTangent: k.outTangent
            ? deserializeAnimValue(k.outTangent, ca.dataType)
            : undefined,
        })),
      )

      group.addTargetedAnimation(anim, target)
    }

    return group
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function tryLoadCachedCharacter(
  cacheKey: string,
  scene: Scene,
): Promise<ISceneLoaderAsyncResult | null> {
  try {
    const finishSpan = createStartupSpan('characterCache.restore', { cacheKey })
    const cached = await getFromDB(cacheKey)
    if (!cached) {
      finishSpan({ hit: false })
      return null
    }

    logStartupEvent('characterCache.hit', {
      cacheKey,
      meshCount: cached.meshes.length,
    })

    const materials = restoreMaterials(cached.gltfMaterials, cached.images, scene)
    const skeleton = cached.skeleton ? restoreSkeleton(cached.skeleton, scene) : null
    const meshes = restoreMeshes(cached.meshes, scene, materials, skeleton)
    const animationGroups = restoreAnimGroups(
      cached.animationGroups,
      scene,
      skeleton,
      meshes,
    )

    finishSpan({
      hit: true,
      meshCount: meshes.length,
      morphTargetMeshes: meshes.filter(m => (m as Mesh).morphTargetManager).length,
      animGroupCount: animationGroups.length,
    })

    return {
      meshes,
      animationGroups,
      skeletons: skeleton ? [skeleton] : [],
      particleSystems: [],
      transformNodes: [],
      geometries: [],
      lights: [],
      spriteManagers: [],
    }
  } catch (err) {
    console.warn('[characterCache] restore failed, will fall back to GLB:', err)
    return null
  }
}

export async function cacheCharacterResult(
  cacheKey: string,
  result: ISceneLoaderAsyncResult,
  glbUrl: string,
): Promise<void> {
  try {
    const finishSpan = createStartupSpan('characterCache.store', { cacheKey })

    const glbResp = await fetch(glbUrl)
    const glbBuffer = await glbResp.arrayBuffer()
    const glb = parseGLBHeader(glbBuffer)
    const images = extractGLBImages(glb)
    const gltfMaterials = extractGLBMaterials(glb.json as Record<string, unknown>)
    const matMap = buildMeshMaterialMap(glb.json as Record<string, unknown>)

    const meshes = result.meshes.map(m => extractMesh(m, matMap.get(m.name) ?? 0))

    const skeleton =
      result.skeletons.length > 0 ? extractSkeleton(result.skeletons[0]) : null

    const animationGroups = extractAnimGroups(result.animationGroups, result.meshes)

    const entry: CachedCharacter = {
      formatVersion: FORMAT_VERSION,
      cacheKey,
      timestamp: Date.now(),
      meshes,
      skeleton,
      animationGroups,
      gltfMaterials,
      images,
    }

    await putToDB(entry)
    finishSpan({
      meshCount: meshes.length,
      imageCount: images.length,
      totalMorphTargets: meshes.reduce((s, m) => s + m.morphTargets.length, 0),
    })
  } catch (err) {
    console.warn('[characterCache] failed to cache character:', err)
  }
}

export async function clearCharacterCache(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}
