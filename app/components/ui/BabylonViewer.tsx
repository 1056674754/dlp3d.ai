'use client'

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  EquiRectangularCubeTexture,
  SceneLoader,
  AbstractMesh,
  Color4,
  DefaultRenderingPipeline,
  Tools,
  ParticleSystem,
  Texture,
  Mesh,
  ShadowGenerator,
  TransformNode,
  AnimationGroup,
  Quaternion,
} from '@babylonjs/core'
import { PhotoDome } from '@babylonjs/core/Helpers/photoDome'
import { GLTFFileLoader } from '@babylonjs/loaders'
import '@babylonjs/loaders/glTF'
import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Control,
  StackPanel,
  Image,
} from '@babylonjs/gui'
import { loadGroundMeshForHDR } from '../../library/babylonjs/utils/loadMesh'
import { LoadingProgressManager } from '../../utils/progressManager'
import {
  HDRI_SCENES,
  SKYBOX_ENVIRONMENT_INTENSITY,
  SKYBOX_BLUR_LEVEL,
  SKYBOX_Y_ROTATION_DEGREES,
} from '@/library/babylonjs/config/scene'
import {
  getCharacterModelUrl,
  resolveBabylonAssetUrl,
  resolveHdriUrl,
} from '@/utils/nativeAssets'
import { createStartupSpan, logStartupEvent } from '@/utils/startupProfiler'
import { tryLoadCachedCharacter, cacheCharacterResult } from '@/utils/characterCache'
import { resolvePublicUrl } from '@/utils/publicUrl'

function waitForNextFrames(frameCount: number): Promise<void> {
  let remaining = Math.max(1, frameCount)
  return new Promise(resolve => {
    const step = () => {
      remaining -= 1
      if (remaining <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

function waitForTextureReady(texture: EquiRectangularCubeTexture): Promise<void> {
  if (texture.isReady()) {
    return Promise.resolve()
  }
  const observableTexture = texture as EquiRectangularCubeTexture & {
    onLoadObservable?: {
      add: (callback: () => void) => unknown
      remove: (observer: unknown) => void
    }
  }
  return new Promise(resolve => {
    let observer: unknown = null
    const finish = () => {
      if (observer && observableTexture.onLoadObservable) {
        observableTexture.onLoadObservable.remove(observer)
        observer = null
      }
      resolve()
    }
    if (!observableTexture.onLoadObservable) {
      const retry = () => {
        if (texture.isReady()) {
          finish()
          return
        }
        window.setTimeout(retry, 16)
      }
      retry()
      return
    }
    observer = observableTexture.onLoadObservable.add(() => finish())
  })
}
/**
 * Props interface for the BabylonViewer component.
 */
interface BabylonViewerProps {
  /** Width of the viewer canvas, defaults to '600px' */
  width?: string
  /** Height of the viewer canvas, defaults to '400px' */
  height?: string
  /** Additional CSS class name for styling */
  className?: string
  /** sceneName for scenes, defaults to 'Vast' */
  sceneName?: string
  /** Index of the selected character model, defaults to 1 (KQ-default) */
  selectedCharacter?: number
  /** Key to trigger character change, defaults to 0 */
  characterChangeKey?: number
  /** Callback function called when character is loaded */
  onCharacterLoaded?: () => void
  /** Callback function called when scene is loaded */
  onSceneLoaded?: () => void
}

/**
 * Reference interface for BabylonViewer component methods.
 */
export interface BabylonViewerRef {
  /** Rotate the camera left by a small angle */
  rotateLeft: () => void
  /** Rotate the camera right by a small angle */
  rotateRight: () => void
  /** Take a screenshot of the current scene and return as base64 string */
  takeScreenshot: () => Promise<string>
  /** Get the current camera state including position and rotation */
  getCameraState: () => {
    alpha: number
    beta: number
    radius: number
    target: { x: number; y: number; z: number }
  } | null
}

/**
 * BabylonViewer Component
 *
 * A React component that renders a 3D scene using Babylon.js with character models,
 * HDRI environment lighting, particle effects, and interactive camera controls.
 * Supports character switching, screenshot capture, and real-time 3D rendering.
 */
const BabylonViewer = forwardRef<BabylonViewerRef, BabylonViewerProps>(
  (
    {
      width = '600px',
      height = '400px',
      className = '',
      sceneName = 'Vast',
      selectedCharacter = 1,
      characterChangeKey = 0,
      onCharacterLoaded,
      onSceneLoaded,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const engineRef = useRef<Engine | null>(null)
    const sceneRef = useRef<Scene | null>(null)
    const hdrTextureRef = useRef<EquiRectangularCubeTexture | null>(null)
    const photoDomeRef = useRef<PhotoDome | null>(null)
    const characterMeshRef = useRef<AbstractMesh[] | null>(null)
    const cameraRef = useRef<ArcRotateCamera | null>(null)
    const particleSystemRef = useRef<ParticleSystem | null>(null)
    const dlpPatchRef = useRef<Mesh | null>(null)
    const shadowGeneratorRef = useRef<ShadowGenerator | null>(null)
    const currentGroundMeshRef = useRef<Mesh | null>(null)
    const fallbackGroundRef = useRef<Mesh | null>(null)
    const characterRootRef = useRef<TransformNode | null>(null)
    const lastAnimationGroupsRef = useRef<AnimationGroup[] | null>(null)
    const loadVersionRef = useRef<number>(0)
    const eyeTrackingCleanupRef = useRef<(() => void) | null>(null)

    /**
     * Expose camera rotation methods and other utilities to parent components.
     */
    useImperativeHandle(ref, () => ({
      rotateLeft: () => {
        if (cameraRef.current) {
          cameraRef.current.alpha += Math.PI / 360 // Rotate 1 degree left
        }
      },
      rotateRight: () => {
        if (cameraRef.current) {
          cameraRef.current.alpha -= Math.PI / 360 // Rotate 1 degree right
        }
      },
      /**
       * Take a screenshot of the current scene.
       *
       * @returns Promise that resolves to base64 encoded image data
       * @throws {Error} if engine, scene, or camera is not available
       */
      takeScreenshot: async (): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (
            !engineRef.current ||
            !sceneRef.current ||
            !sceneRef.current.activeCamera
          ) {
            reject(new Error('Engine, scene, or camera not available'))
            return
          }
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { Tools } = require('@babylonjs/core')
            Tools.CreateScreenshot(
              engineRef.current,
              sceneRef.current.activeCamera!,
              {
                width: engineRef.current.getRenderWidth(),
                height: engineRef.current.getRenderHeight(),
              },
              (data: string) => {
                // Return raw base64 data
                resolve(data)
              },
            )
          } catch (error) {
            reject(error)
          }
        })
      },
      /**
       * Get the current camera state including rotation and position.
       *
       * @returns Camera state object with alpha, beta, radius, and target coordinates, or null if camera not available
       */
      getCameraState: () => {
        if (!cameraRef.current) return null
        return {
          alpha: cameraRef.current.alpha,
          beta: cameraRef.current.beta,
          radius: cameraRef.current.radius,
          target: {
            x: cameraRef.current.target.x,
            y: cameraRef.current.target.y,
            z: cameraRef.current.target.z,
          },
        }
      },
    }))

    /**
     * Add GUI text patch with logo (only displayed on homepage).
     *
     * @param scene The Babylon.js scene to add the patch to
     */
    const addDlpTextPatch = useCallback((scene: Scene) => {
      if (dlpPatchRef.current) return // Only create once
      if (typeof window !== 'undefined' && window.location.pathname !== '/') return // Only show on homepage
      const patchWidth = 10
      const patchHeight = 3.0
      const patchPlane = MeshBuilder.CreatePlane(
        'dlpTextPatch',
        { width: patchWidth, height: patchHeight },
        scene,
      )
      const texture = AdvancedDynamicTexture.CreateForMesh(
        patchPlane,
        2048,
        512,
        false,
      )
      // Background
      const rect = new Rectangle()
      rect.width = 1
      rect.height = 1
      rect.thickness = 0
      rect.background = 'transparent'
      texture.addControl(rect)
      // Vertical layout
      const stack = new StackPanel()
      stack.width = 1
      stack.height = 1
      stack.isVertical = true
      rect.addControl(stack)

      // Title logo image with enhanced glow effect
      const titleLogo = new Image(
        'titleLogo',
        resolvePublicUrl('/img/logo-title.png'),
      )
      titleLogo.width = '65%'
      titleLogo.height = '100px'
      titleLogo.top = '-10px'
      titleLogo.stretch = Image.STRETCH_UNIFORM
      titleLogo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER

      // Add glow effect to the image
      titleLogo.shadowBlur = 8
      titleLogo.shadowColor = 'rgba(138, 43, 226, 0.8)' // Purple glow
      titleLogo.shadowOffsetX = 0
      titleLogo.shadowOffsetY = 0

      stack.addControl(titleLogo)

      // Position in scene space
      patchPlane.position = new Vector3(0, -0.4, -1.6) // Slightly raised position
      patchPlane.billboardMode = Mesh.BILLBOARDMODE_NONE
      dlpPatchRef.current = patchPlane

      // Add rainbow gradient animation effect
      let time = 0
      scene.registerBeforeRender(() => {
        time += scene.getEngine().getDeltaTime() * 0.001

        // Rainbow gradient colors
        const hue = (time * 30) % 360 // 30 degrees per second hue change
        const rainbowGlow = `hsla(${hue}, 80%, 70%, 0.8)`

        // Update image glow color, maintain maximum glow intensity
        titleLogo.shadowBlur = 10 // Maintain maximum glow intensity
        titleLogo.shadowColor = rainbowGlow
      })
    }, [])

    const createStartupGround = useCallback(
      (scene: Scene, sceneConfig: (typeof HDRI_SCENES)[number]) => {
        if (fallbackGroundRef.current) {
          return fallbackGroundRef.current
        }
        const ground = MeshBuilder.CreateGround(
          `startup-ground-${sceneConfig.name}`,
          { width: 18, height: 18, subdivisions: 1 },
          scene,
        )
        const material = new StandardMaterial(
          `startup-ground-material-${sceneConfig.name}`,
          scene,
        )
        material.diffuseColor =
          sceneConfig.name === 'Vast'
            ? new Color3(0.11, 0.12, 0.15)
            : new Color3(0.16, 0.16, 0.19)
        material.specularColor = new Color3(0, 0, 0)
        material.alpha = 0.92
        ground.material = material
        ground.isPickable = false
        ground.receiveShadows = true
        if (sceneConfig.groundModel) {
          ground.position = sceneConfig.groundModel.translation.clone()
          ground.rotation = new Vector3(
            Tools.ToRadians(sceneConfig.groundModel.rotation.x),
            Tools.ToRadians(sceneConfig.groundModel.rotation.y),
            Tools.ToRadians(sceneConfig.groundModel.rotation.z),
          )
        } else {
          ground.position = new Vector3(0, -0.02, 0)
        }
        fallbackGroundRef.current = ground
        return ground
      },
      [],
    )

    /**
     * Load a character model by index with animation and effects.
     *
     * @param characterIndex The index of the character to load (0-3)
     */
    const loadCharacter = useCallback(
      async (characterIndex: number) => {
        if (!sceneRef.current) {
          console.error('[BabylonViewer] loadCharacter called but sceneRef is null')
          if (onCharacterLoaded) onCharacterLoaded()
          return
        }
        const finishCharacterLoad = createStartupSpan('babylon.character-load', {
          characterIndex,
        })

        try {
          // Increment version to invalidate any in-flight loads
          const myVersion = ++loadVersionRef.current

          // Stop and dispose previous animation groups
          if (lastAnimationGroupsRef.current) {
            lastAnimationGroupsRef.current.forEach(g => {
              try {
                g.stop()
              } catch (_) {}
              try {
                g.dispose()
              } catch (_) {}
            })
            lastAnimationGroupsRef.current = null
          }

          // Remove previous meshes from shadow generator
          if (shadowGeneratorRef.current && characterMeshRef.current) {
            characterMeshRef.current.forEach(m => {
              try {
                if (m && m instanceof Mesh) {
                  shadowGeneratorRef.current!.removeShadowCaster(m, true)
                }
              } catch (_) {}
            })
          }

          // Dispose previous character root (disposes all child meshes)
          if (characterRootRef.current) {
            try {
              characterRootRef.current.dispose()
            } catch (_) {}
            characterRootRef.current = null
          }
          characterMeshRef.current = null

          const character_index_file_name_mapping: { [key: number]: string } = {
            0: 'Ani-default_481.glb',
            1: 'KQ-default_420.glb',
            2: 'HT-default_214.glb',
            3: 'FNN-default_296.glb',
            4: 'KL-default_214.glb',
            5: 'NXD-default_321.glb',
          }

          const modelUrl = getCharacterModelUrl(characterIndex)
          const cacheKey = `char_${characterIndex}_${modelUrl.split('/').pop()}`

          let result = await tryLoadCachedCharacter(cacheKey, sceneRef.current!)

          if (!result) {
            const loadableModelUrl = await resolveBabylonAssetUrl(
              modelUrl,
              'model/gltf-binary',
            )
            const isBlobUrl = loadableModelUrl.startsWith('blob:')
            const slash = loadableModelUrl.lastIndexOf('/')
            const rootUrl = isBlobUrl ? '' : loadableModelUrl.slice(0, slash + 1)
            const meshFile = isBlobUrl
              ? loadableModelUrl
              : loadableModelUrl.slice(slash + 1)
            result = await SceneLoader.ImportMeshAsync(
              '',
              rootUrl,
              meshFile,
              sceneRef.current,
              undefined,
              '.glb',
            )
            void cacheCharacterResult(cacheKey, result, modelUrl)
          }

          // Stale check: if a newer load started, discard this result
          if (myVersion !== loadVersionRef.current) {
            try {
              result.animationGroups?.forEach(g => {
                try {
                  g.stop()
                } catch (_) {}
                try {
                  g.dispose()
                } catch (_) {}
              })
              result.meshes?.forEach(m => {
                try {
                  m.dispose()
                } catch (_) {}
              })
            } catch (_) {}
            finishCharacterLoad({
              stale: true,
            })
            return
          }

          if (result.meshes.length > 0) {
            // Create a dedicated root for the character to simplify cleanup
            const root = new TransformNode('characterRoot', sceneRef.current!)
            result.meshes.forEach(m => {
              if (m && m.parent == null) m.parent = root
            })
            characterRootRef.current = root
            characterMeshRef.current = result.meshes
            // Position and scale the character - aligned with babylon page settings
            const rootMesh = result.meshes[0]
            if (rootMesh) {
              rootMesh.position = Vector3.Zero()
              rootMesh.scaling = new Vector3(0.8, 0.8, 0.8) // Reduced from 1,1,1 to avoid UI overlap

              // Apply rotation to match camera initial angle (0 degrees)
              rootMesh.rotation = new Vector3(0, Tools.ToRadians(0), 0) // Y-axis rotation 0 degrees
              // Immediately refresh bounding info after transformation
              if (rootMesh instanceof Mesh) {
                rootMesh.refreshBoundingInfo()
              }
              // Apply to all child meshes too
              result.meshes.forEach(mesh => {
                if (mesh instanceof Mesh && mesh !== rootMesh) {
                  mesh.refreshBoundingInfo()
                }
              })
              rootMesh.position.y = 0 // Keep at ground level like babylon page
            }

            // Enable animation playback for GLB files with embedded animations
            if (result.animationGroups.length > 0) {
              const animationGroup = result.animationGroups[0]
              const originalEndFrame = animationGroup.to
              const middleFrame = parseInt(
                character_index_file_name_mapping[characterIndex].split('_')[1],
              )
              animationGroup.play(false)
              animationGroup.setWeightForAllAnimatables(1.0)
              animationGroup.to = middleFrame

              const onEntranceAnimationEnd = () => {
                animationGroup.onAnimationGroupEndObservable.removeCallback(
                  onEntranceAnimationEnd,
                )
                animationGroup.from = middleFrame
                const loopEndFrame = characterIndex === 3 ? 391 : originalEndFrame
                animationGroup.to = loopEndFrame
                animationGroup.play(true)

                // Idle variation: randomize playback speed slightly every few seconds
                let nextSpeedChange = 3000 + Math.random() * 5000
                let speedTimer = 0
                sceneRef.current!.registerBeforeRender(() => {
                  speedTimer += sceneRef.current!.getEngine().getDeltaTime()
                  if (speedTimer >= nextSpeedChange) {
                    speedTimer = 0
                    nextSpeedChange = 3000 + Math.random() * 5000
                    const newSpeed = 0.85 + Math.random() * 0.3 // 0.85 ~ 1.15
                    animationGroup.speedRatio = newSpeed
                  }
                })
              }

              animationGroup.onAnimationGroupEndObservable.add(
                onEntranceAnimationEnd,
              )
              lastAnimationGroupsRef.current = result.animationGroups
            }

            // Eye tracking: character eyes follow user via device orientation,
            // mouse position, or native camera face detection
            if (eyeTrackingCleanupRef.current) {
              eyeTrackingCleanupRef.current()
              eyeTrackingCleanupRef.current = null
            }
            const leftEye = sceneRef.current!.getTransformNodeByName('Eye_L')
            const rightEye = sceneRef.current!.getTransformNodeByName('Eye_R')

            if (leftEye?.rotationQuaternion && rightEye?.rotationQuaternion) {
              const MAX_H = 12
              const MAX_V = 5
              const SMOOTH = 0.08
              let gazeTargetH = 0
              let gazeTargetV = 0
              let gazeSmoothH = 0
              let gazeSmoothV = 0
              let eyeTrackingDisposed = false

              const leftEyeBaseRot = leftEye.rotationQuaternion.clone()
              const rightEyeBaseRot = rightEye.rotationQuaternion.clone()

              const onDeviceOrientation = (e: DeviceOrientationEvent) => {
                if (eyeTrackingDisposed) return
                if (e.gamma != null) {
                  gazeTargetH = Math.max(-MAX_H, Math.min(MAX_H, -e.gamma * 0.4))
                }
                if (e.beta != null) {
                  gazeTargetV = Math.max(
                    -MAX_V,
                    Math.min(MAX_V, -(e.beta - 70) * 0.15),
                  )
                }
              }

              const onMouseMove = (e: MouseEvent) => {
                if (eyeTrackingDisposed || e.buttons !== 0) return
                const nx = (e.clientX / window.innerWidth - 0.5) * 2
                const ny = (e.clientY / window.innerHeight - 0.5) * 2
                gazeTargetH = nx * MAX_H
                gazeTargetV = ny * MAX_V * 0.5
              }

              const onFacePosition = (e: Event) => {
                if (eyeTrackingDisposed) return
                const { x, y } = (e as CustomEvent).detail
                gazeTargetH = (x as number) * MAX_H
                gazeTargetV = (y as number) * MAX_V
              }

              window.addEventListener('deviceorientation', onDeviceOrientation)
              window.addEventListener('mousemove', onMouseMove)
              window.addEventListener('dlp3d:face-position', onFacePosition)

              const observer = sceneRef.current!.onBeforeRenderObservable.add(() => {
                if (
                  eyeTrackingDisposed ||
                  !leftEye.rotationQuaternion ||
                  !rightEye.rotationQuaternion
                ) {
                  return
                }

                gazeSmoothH += (gazeTargetH - gazeSmoothH) * SMOOTH
                gazeSmoothV += (gazeTargetV - gazeSmoothV) * SMOOTH

                if (Math.abs(gazeSmoothH) < 0.05 && Math.abs(gazeSmoothV) < 0.05) {
                  leftEye.rotationQuaternion.copyFrom(leftEyeBaseRot)
                  rightEye.rotationQuaternion.copyFrom(rightEyeBaseRot)
                  return
                }

                const gazeRot = Quaternion.RotationYawPitchRoll(
                  Tools.ToRadians(gazeSmoothH),
                  Tools.ToRadians(gazeSmoothV),
                  0,
                )
                leftEye.rotationQuaternion = leftEyeBaseRot.multiply(gazeRot)
                rightEye.rotationQuaternion = rightEyeBaseRot.multiply(gazeRot)
              })

              eyeTrackingCleanupRef.current = () => {
                eyeTrackingDisposed = true
                window.removeEventListener('deviceorientation', onDeviceOrientation)
                window.removeEventListener('mousemove', onMouseMove)
                window.removeEventListener('dlp3d:face-position', onFacePosition)
                sceneRef.current?.onBeforeRenderObservable.remove(observer)
              }
            }

            // Set all loaded meshes to cast shadows
            if (shadowGeneratorRef.current) {
              result.meshes.forEach(mesh => {
                if (mesh && mesh.receiveShadows !== undefined)
                  mesh.receiveShadows = false
                if (mesh && mesh instanceof Mesh) {
                  shadowGeneratorRef.current!.addShadowCaster(mesh, true)
                }
              })
            }

            // Add self-illumination effect to all character meshes
            result.meshes.forEach(mesh => {
              if (mesh.material) {
                const material = mesh.material as StandardMaterial

                // Store original emissive color (or create default if none exists)
                const originalEmissive = material.emissiveColor
                  ? material.emissiveColor.clone()
                  : new Color3(0, 0, 0)

                // Set bright self-illumination - synchronized with particle effects
                material.emissiveColor = new Color3(0.8, 0.9, 1.0) // Bright blue-white glow

                // Gradually fade back to normal over 0.8 seconds to match particle duration
                let time = 0
                const fadeOut = () => {
                  time += sceneRef.current!.getEngine().getDeltaTime() * 0.001 // Convert to seconds
                  const fadeProgress = Math.min(time / 0.8, 1.0) // 0.8 second fade to match particles

                  if (fadeProgress >= 1.0) {
                    // Restore original emissive
                    material.emissiveColor = originalEmissive
                    sceneRef.current!.unregisterBeforeRender(fadeOut)
                  } else {
                    // Interpolate between glow and original
                    const currentEmissive = Color3.Lerp(
                      new Color3(0.8, 0.9, 1.0),
                      originalEmissive,
                      fadeProgress,
                    )
                    material.emissiveColor = currentEmissive
                  }
                }

                sceneRef.current!.registerBeforeRender(fadeOut)
              }
            })
            // Disable back face culling for all loaded meshes to ensure both sides are rendered
            result.meshes.forEach(mesh => {
              mesh.alwaysSelectAsActiveMesh = true
              if (mesh.material && mesh.material.backFaceCulling !== undefined) {
                mesh.material.backFaceCulling = false
              }
            })
            finishCharacterLoad({
              meshCount: result.meshes.length,
              animationGroupCount: result.animationGroups.length,
            })
            if (onCharacterLoaded) onCharacterLoaded()
          } else {
            finishCharacterLoad({
              meshCount: 0,
            })
            if (onCharacterLoaded) onCharacterLoaded()
          }
        } catch (error) {
          finishCharacterLoad({
            failed: true,
          })
          console.error('Error loading character:', error)

          // Fallback: create a simple placeholder
          const placeholder = MeshBuilder.CreateBox(
            'placeholder',
            { size: 2 },
            sceneRef.current,
          )
          const material = new StandardMaterial(
            'placeholderMaterial',
            sceneRef.current,
          )
          material.diffuseColor = new Color3(0.5, 0.5, 0.8)
          placeholder.material = material

          characterMeshRef.current = [placeholder]
          if (onCharacterLoaded) onCharacterLoaded()
        }
      },
      [onCharacterLoaded],
    )

    /**
     * Spawn particle light effects when switching characters - synchronized with glow effects.
     */
    const spawnCharacterSwitchEffect = useCallback(() => {
      const scene = sceneRef.current
      if (!scene) return

      // Emit main glow particles (circular) - matching character glow effect colors
      const bodyGlowSystemCircle = new ParticleSystem(
        'bodyGlowEffectCircle',
        100,
        scene,
      )
      bodyGlowSystemCircle.particleTexture = new Texture(
        resolvePublicUrl('/img/particle_circle.png.png'),
        scene,
      )
      bodyGlowSystemCircle.emitter = new Vector3(0, 0.8, 0) // Character center
      bodyGlowSystemCircle.minSize = 0.02
      bodyGlowSystemCircle.maxSize = 0.05
      bodyGlowSystemCircle.manualEmitCount = 100
      bodyGlowSystemCircle.color1 = new Color4(0.8, 0.9, 1.0, 0.8) // Blue-white matching glow effect
      bodyGlowSystemCircle.color2 = new Color4(1, 1, 1, 0.6) // White
      bodyGlowSystemCircle.minLifeTime = 0.4
      bodyGlowSystemCircle.maxLifeTime = 0.8
      bodyGlowSystemCircle.emitRate = 120
      bodyGlowSystemCircle.blendMode = ParticleSystem.BLENDMODE_ADD
      bodyGlowSystemCircle.addColorGradient(0, new Color4(1, 1, 1, 0))
      bodyGlowSystemCircle.addColorGradient(0.2, new Color4(0.8, 0.9, 1.0, 0.8))
      bodyGlowSystemCircle.addColorGradient(0.6, new Color4(1, 1, 1, 0.6))
      bodyGlowSystemCircle.addColorGradient(1, new Color4(1, 1, 1, 0))
      bodyGlowSystemCircle.direction1 = new Vector3(0, 1, 0) // Upward
      bodyGlowSystemCircle.direction2 = new Vector3(0, 1, 0) // Also upward
      bodyGlowSystemCircle.minEmitPower = 0.15
      bodyGlowSystemCircle.maxEmitPower = 0.4
      bodyGlowSystemCircle.start()

      // Add surrounding particle effects
      const ringParticleSystem = new ParticleSystem('ringParticleEffect', 50, scene)
      ringParticleSystem.particleTexture = new Texture(
        resolvePublicUrl('/img/particle_circle.png.png'),
        scene,
      )
      ringParticleSystem.emitter = new Vector3(0, 0.8, 0) // Character center
      ringParticleSystem.minSize = 0.01
      ringParticleSystem.maxSize = 0.03
      ringParticleSystem.manualEmitCount = 50
      ringParticleSystem.color1 = new Color4(0.6, 0.8, 1.0, 0.6) // Light blue
      ringParticleSystem.color2 = new Color4(1, 1, 1, 0.4) // White
      ringParticleSystem.minLifeTime = 0.6
      ringParticleSystem.maxLifeTime = 1.0
      ringParticleSystem.emitRate = 80
      ringParticleSystem.blendMode = ParticleSystem.BLENDMODE_ADD
      ringParticleSystem.addColorGradient(0, new Color4(1, 1, 1, 0))
      ringParticleSystem.addColorGradient(0.3, new Color4(0.6, 0.8, 1.0, 0.6))
      ringParticleSystem.addColorGradient(0.7, new Color4(1, 1, 1, 0.4))
      ringParticleSystem.addColorGradient(1, new Color4(1, 1, 1, 0))
      // Surrounding direction
      ringParticleSystem.direction1 = new Vector3(1, 0, 0) // Horizontal direction
      ringParticleSystem.direction2 = new Vector3(-1, 0, 0) // Reverse direction
      ringParticleSystem.minEmitPower = 0.1
      ringParticleSystem.maxEmitPower = 0.3
      ringParticleSystem.start()

      // Duration synchronized with glow effects
      setTimeout(() => {
        bodyGlowSystemCircle.stop()
        bodyGlowSystemCircle.dispose()
        ringParticleSystem.stop()
        ringParticleSystem.dispose()
      }, 800)
    }, [])

    /**
     * Listen for chat-starting event to hide homepage 3D title and ribbon.
     */
    useEffect(() => {
      const handler = () => {
        if (dlpPatchRef.current) dlpPatchRef.current.setEnabled(false)
      }
      window.addEventListener('chat-starting', handler)
      return () => window.removeEventListener('chat-starting', handler)
    }, [])

    /**
     * Listen for chat-screenshot-done event to show homepage 3D title and ribbon.
     */
    useEffect(() => {
      const handler = () => {
        if (dlpPatchRef.current) dlpPatchRef.current.setEnabled(true)
      }
      window.addEventListener('chat-screenshot-done', handler)
      return () => window.removeEventListener('chat-screenshot-done', handler)
    }, [])

    /**
     * Initialize the Babylon.js scene with camera, lighting, and effects.
     */
    useEffect(() => {
      if (!canvasRef.current) return

      logStartupEvent('babylon.viewer-mounted')

      // Initialize LoadingProgressManager
      LoadingProgressManager.getInstance().reset()

      // Initialize Babylon.js engine if it doesn't exist
      if (!engineRef.current) {
        engineRef.current = new Engine(canvasRef.current, true, {
          preserveDrawingBuffer: true,
          stencil: true,
          antialias: true,
          powerPreference: 'high-performance',
          adaptToDeviceRatio: true,
        })
        engineRef.current.hideLoadingUI()
      }
      const engine = engineRef.current

      // Create scene if it doesn't exist
      if (!sceneRef.current) {
        const scene = new Scene(engine)
        sceneRef.current = scene

        // Update scene coordinate system to match babylon page
        scene.useRightHandedSystem = true

        // Configure GLTFFileLoader for consistency
        SceneLoader.OnPluginActivatedObservable.add(function (plugin) {
          if (plugin.name === 'gltf' && plugin instanceof GLTFFileLoader)
            plugin.targetFps = 30
        })

        // Create camera - initial angle set to 90 degrees
        const camera = new ArcRotateCamera(
          'camera',
          Tools.ToRadians(90), // alpha: initial angle set to 90 degrees
          Tools.ToRadians(85), // beta: keep 85 degrees
          2.7, // radius: keep 2.7
          new Vector3(0, 0.8, 0), // target: keep target point
          scene,
        )
        // Disable keyboard control to match chat interface
        camera.inputs.remove(camera.inputs.attached.keyboard)

        // Set camera as active camera for the scene
        scene.activeCamera = camera

        // Attach camera controls to canvas
        camera.attachControl(canvasRef.current, true)
        camera.setTarget(new Vector3(0, 0.8, 0))
        camera.fov = Tools.ToRadians(45) // match babylon page FOV
        camera.panningSensibility = 2000
        camera.maxZ = 999
        camera.minZ = 0
        camera.wheelPrecision = 200 // Higher value = smaller zoom steps
        camera.pinchPrecision = 150 // Match wheel precision for mobile pinch zoom
        camera.pinchDeltaPercentage = 0.005 // Proportional zoom: 0.5% per pixel delta
        camera.lowerRadiusLimit = 0.8
        camera.upperRadiusLimit = 5.0
        camera.useBouncingBehavior = false
        // Lock vertical rotation to current angle - only allow horizontal rotation
        camera.upperBetaLimit = Tools.ToRadians(85)
        camera.lowerBetaLimit = Tools.ToRadians(85)

        // Add keyboard control keys to match chat interface
        camera.keysUp.push(87) // W key
        camera.keysDown.push(83) // S key
        camera.keysLeft.push(65) // A key
        camera.keysRight.push(68) // D key

        camera.inertia = 0.85
        camera.angularSensibilityX = 1000
        camera.angularSensibilityY = 1000
        cameraRef.current = camera

        // Idle auto-rotation: slow turntable, pauses when user interacts
        camera.useAutoRotationBehavior = true
        const autoRotation = camera.autoRotationBehavior!
        autoRotation.idleRotationSpeed = 0.02
        autoRotation.idleRotationSpinupTime = 5000
        autoRotation.idleRotationWaitTime = 60000 // 1 minute idle before auto-rotate starts
        autoRotation.zoomStopsAnimation = false

        // Replace lighting with dual hemispheric lights matching babylon page
        // Primary light
        const primaryLight = new HemisphericLight(
          'hemiLight',
          new Vector3(0, 1, 0),
          scene,
        )
        primaryLight.intensity = 0.6
        primaryLight.specular = new Color3(0, 0, 0)
        primaryLight.groundColor = new Color3(1, 1, 1)

        // Secondary light (matches onSceneReady.ts)
        const secondaryLight = new HemisphericLight(
          'HemisphericLight',
          new Vector3(0, 1, 0),
          scene,
        )
        secondaryLight.intensity = 0.3
        secondaryLight.specular = new Color3(0, 0, 0)
        secondaryLight.groundColor = new Color3(1, 1, 1)

        // Create particle effects - adjusted for closer camera view
        const createParticleEffect = () => {
          if (!sceneRef.current) return

          // Create particle system
          const particleSystem = new ParticleSystem(
            'particles',
            300,
            sceneRef.current,
          )

          // Create a simple white dot texture for particles
          const particleTexture = new Texture(
            resolvePublicUrl('/img/particle_circle.png.png'),
            sceneRef.current,
          )
          particleSystem.particleTexture = particleTexture

          // Create directed sphere emitter as suggested
          const boxEmitter = particleSystem.createBoxEmitter(
            new Vector3(0, 1, 0), // direction1: upward
            new Vector3(0, -1, 0), // direction2: downward
            new Vector3(-5, -5, -5), // minEmitBox
            new Vector3(5, 5, 5), // maxEmitBox
          )

          // Set beautiful colors
          particleSystem.color1 = new Color4(1, 0.4, 0.4, 1) // Red
          particleSystem.color2 = new Color4(0.4, 1, 0.6, 1) // Green
          particleSystem.colorDead = new Color4(0.5, 0.5, 1, 1) // Blue-purple

          // Size settings - adjusted for closer camera
          particleSystem.minSize = 0.01 // Reduced from 0.02
          particleSystem.maxSize = 0.05 // Reduced from 0.1

          // Life time
          particleSystem.minLifeTime = 99999
          particleSystem.maxLifeTime = 99999

          // Emission rate
          particleSystem.emitRate = 0

          // Generate only once with fixed number of particles
          particleSystem.manualEmitCount = 150 // Fixed particle count, reduced quantity

          // Set emitter position slightly above ground - adjusted for closer camera
          particleSystem.emitter = new Vector3(0, 0.5, 0) // Lowered from y=1 to y=0.5

          // Speed
          particleSystem.minEmitPower = -0.1
          particleSystem.maxEmitPower = 0.1
          particleSystem.updateSpeed = 0.01

          // Gravity for natural falling effect
          particleSystem.gravity = new Vector3(0, 0, 0)

          // Blend mode for normal alpha blending
          particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD

          // Start the particle system
          particleSystem.start()

          particleSystemRef.current = particleSystem

          // Add some animation to make it more dynamic - adjusted for closer view
          let time = 0
          sceneRef.current.registerBeforeRender(() => {
            if (!sceneRef.current) return
            time += sceneRef.current.getEngine().getDeltaTime() * 0.0001
            // Particles only distributed within 0.5~5m spherical shell
            if (particleSystemRef.current) {
              const minR = 0.5
              const maxR = 5
              for (let i = 0; i < particleSystemRef.current.particles.length; i++) {
                const p = particleSystemRef.current.particles[i]
                const r = Math.sqrt(
                  p.position.x ** 2 + p.position.y ** 2 + p.position.z ** 2,
                )
                if (r < minR || r > maxR) {
                  // Re-randomize a valid spherical shell position
                  const theta = Math.random() * 2 * Math.PI
                  const phi = Math.acos(2 * Math.random() - 1)
                  const newR = minR + Math.random() * (maxR - minR)
                  p.position.x = newR * Math.sin(phi) * Math.cos(theta)
                  p.position.y = newR * Math.sin(phi) * Math.sin(theta)
                  p.position.z = newR * Math.cos(phi)
                }
              }
            }
          })
          particleSystem.direction1 = new Vector3(0, 1, 0)
          particleSystem.direction2 = new Vector3(0, -1, 0)
        }
        createParticleEffect()

        // Add rendering pipeline for professional graphics
        const renderPipeline = new DefaultRenderingPipeline(
          'defaultRenderingPipeline',
          true,
          scene,
          [camera],
        )
        renderPipeline.bloomEnabled = true
        renderPipeline.fxaaEnabled = true
        renderPipeline.bloomWeight = 0.4
        renderPipeline.imageProcessing.exposure = 1.1
        renderPipeline.imageProcessing.vignetteEnabled = true
        renderPipeline.imageProcessing.vignetteWeight = 2
        renderPipeline.imageProcessing.vignetteStretch = 1
        renderPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0)
        renderPipeline.samples = 4

        // Create patch only once during initialization
        addDlpTextPatch(scene)

        // Render loop
        engine.runRenderLoop(() => {
          scene.render()
        })

        // Handle resize
        const handleResize = () => {
          engine.resize()
        }
        window.addEventListener('resize', handleResize)

        // Store cleanup function
        const cleanup = () => {
          window.removeEventListener('resize', handleResize)
          if (characterMeshRef.current) {
            characterMeshRef.current.forEach(mesh => mesh.dispose())
          }
          if (particleSystemRef.current) {
            particleSystemRef.current.dispose()
          }
          // Reset LoadingProgressManager
          LoadingProgressManager.getInstance().reset()
          scene.dispose()
          engine.dispose()
        }
        ;(scene as any).customCleanup = cleanup
      }
    }, [])

    /**
     * Handle HDRI texture changes and ground mesh loading.
     */
    useEffect(() => {
      let canceled = false
      if (sceneRef.current && sceneName) {
        // Update HDR texture
        if (hdrTextureRef.current) {
          hdrTextureRef.current.dispose()
          hdrTextureRef.current = null
        }
        if (photoDomeRef.current) {
          photoDomeRef.current.dispose()
          photoDomeRef.current = null
        }
        const sceneConfig = HDRI_SCENES.find(scene => scene.name === sceneName)!
        const image = resolveHdriUrl(sceneConfig.hdri)
        const pathname =
          typeof window !== 'undefined' ? window.location.pathname : ''
        const isEmbeddedAndroidAssetWebView =
          typeof window !== 'undefined' &&
          window.location.protocol === 'file:' &&
          pathname.startsWith('/android_asset/web/') &&
          Boolean(
            (
              window as Window & {
                __DLP3D_EMBEDDED_IN_RN__?: boolean
              }
            ).__DLP3D_EMBEDDED_IN_RN__,
          )
        const isHomepageDefaultScene =
          (pathname === '/' || pathname.endsWith('/index.html')) &&
          sceneConfig.name === 'Vast'
        const hdrTextureSize = isHomepageDefaultScene ? 512 : 1024

        const hdrTextureReadyPromise = isEmbeddedAndroidAssetWebView
          ? resolveBabylonAssetUrl(image, 'image/jpeg', 'dataUrl').then(
              loadableImage => {
                if (canceled || !sceneRef.current) return undefined

                const oldSkybox = sceneRef.current.getMeshByName('skyBox')
                if (oldSkybox) {
                  oldSkybox.dispose()
                }

                const photoDome = new PhotoDome(
                  'androidSkyDome',
                  loadableImage,
                  {
                    resolution: isHomepageDefaultScene ? 16 : 24,
                    size: 1000,
                  },
                  sceneRef.current,
                )
                photoDomeRef.current = photoDome
                return undefined
              },
            )
          : resolveBabylonAssetUrl(image, 'image/jpeg', 'dataUrl').then(
              loadableImage => {
                if (canceled || !sceneRef.current) return

                const newHdrTexture = new EquiRectangularCubeTexture(
                  loadableImage,
                  sceneRef.current,
                  hdrTextureSize,
                )
                sceneRef.current.environmentTexture = newHdrTexture

                // Set environment intensity to brighter level for better visibility
                sceneRef.current.environmentIntensity = SKYBOX_ENVIRONMENT_INTENSITY

                // Dispose existing skybox if it exists
                const oldSkybox = sceneRef.current.getMeshByName('skyBox')
                if (oldSkybox) {
                  oldSkybox.dispose()
                }
                const skybox = sceneRef.current.createDefaultSkybox(
                  newHdrTexture,
                  true,
                  1000,
                  SKYBOX_BLUR_LEVEL,
                )

                // Rotate skybox 15 degrees counterclockwise to rotate HDR environment
                if (skybox) {
                  skybox.rotate(
                    new Vector3(0, 1, 0),
                    Tools.ToRadians(SKYBOX_Y_ROTATION_DEGREES),
                  )
                }
                hdrTextureRef.current = newHdrTexture
                return newHdrTexture
              },
            )

        // Dispose existing ground mesh (supports both array and single mesh)
        if (currentGroundMeshRef.current) {
          console.log(
            'Disposing current ground mesh ref:',
            currentGroundMeshRef.current.name,
          )
          if (Array.isArray(currentGroundMeshRef.current)) {
            currentGroundMeshRef.current.forEach(mesh => mesh.dispose())
          } else {
            currentGroundMeshRef.current.dispose()
          }
          currentGroundMeshRef.current = null
        }
        if (fallbackGroundRef.current) {
          fallbackGroundRef.current.dispose()
          fallbackGroundRef.current = null
        }

        // Clean up all possible ground-related models
        const groundMeshes = sceneRef.current.getMeshesByTags('ground')
        groundMeshes.forEach(mesh => {
          mesh.dispose()
        })

        // Clean up all meshes named ground or containing ground
        const allMeshes = [...sceneRef.current.meshes] // Create copy to avoid modifying array during iteration
        allMeshes.forEach(mesh => {
          if (
            mesh.name.toLowerCase().includes('ground') ||
            mesh.name.toLowerCase().includes('platform') ||
            mesh.name.toLowerCase().includes('floor') ||
            mesh.name.toLowerCase().includes('groundparent')
          ) {
            console.log('Disposing mesh by name:', mesh.name)
            mesh.dispose()
          }
        })

        // Force clean up all meshes in scene to ensure no residue
        const remainingMeshes = [...sceneRef.current.meshes] // Create copy again
        remainingMeshes.forEach(mesh => {
          if (
            mesh.metadata &&
            mesh.metadata.parentMesh &&
            mesh.metadata.parentMesh.name.toLowerCase().includes('ground')
          ) {
            console.log(
              'Disposing mesh by parent:',
              mesh.name,
              'parent:',
              mesh.metadata.parentMesh.name,
            )
            mesh.dispose()
          }
        })

        logStartupEvent('babylon.scene-change', {
          sceneName,
          homepageDefaultScene: isHomepageDefaultScene,
        })

        // Load corresponding ground model and split visual-ready from full-ready.
        const run = async () => {
          let didNotifyVisualReady = false
          type SpanFinish = (extra?: Record<string, unknown>) => void
          const noop: SpanFinish = () => {}
          let finishHdrLoad: SpanFinish = noop
          let finishGroundLoad: SpanFinish = noop

          const notifyVisualReady = (phase: 'startup-ground' | 'hdr') => {
            if (didNotifyVisualReady || canceled) {
              return
            }
            didNotifyVisualReady = true
            logStartupEvent('babylon.scene.visual-ready', {
              sceneName,
              homepageDefaultScene: isHomepageDefaultScene,
              phase,
            })
          }

          try {
            if (isHomepageDefaultScene) {
              createStartupGround(sceneRef.current!, sceneConfig)
              logStartupEvent('babylon.scene.startup-ground-ready', {
                sceneName,
              })
              await waitForNextFrames(1)
              notifyVisualReady('startup-ground')
            }

            finishHdrLoad = createStartupSpan('babylon.scene.hdr', {
              sceneName,
              textureSize: hdrTextureSize,
              skippedForAndroidPackagedWebView: isEmbeddedAndroidAssetWebView,
            })
            const readyHdrTexture = await hdrTextureReadyPromise
            if (!readyHdrTexture) {
              finishHdrLoad({
                androidPhotoDome: isEmbeddedAndroidAssetWebView,
              })
            } else {
              await waitForTextureReady(readyHdrTexture)
              finishHdrLoad()
            }

            const groundModel = sceneConfig.groundModel
            const groundPromise = groundModel
              ? (async () => {
                  finishGroundLoad = createStartupSpan('babylon.scene.ground', {
                    sceneName,
                  })
                  try {
                    const meshes = await loadGroundMeshForHDR(
                      sceneRef.current!,
                      groundModel.filename,
                      groundModel.translation,
                      groundModel.rotation,
                      groundModel.scale,
                      true,
                    )
                    if (canceled) {
                      meshes.forEach(mesh => mesh.dispose())
                      finishGroundLoad({ canceled: true })
                      return
                    }
                    if (meshes && meshes.length > 0) {
                      const mesh = meshes.find(m => m instanceof Mesh)
                      if (mesh) currentGroundMeshRef.current = mesh as Mesh
                    }
                    if (fallbackGroundRef.current) {
                      fallbackGroundRef.current.dispose()
                      fallbackGroundRef.current = null
                    }
                    finishGroundLoad({
                      meshCount: meshes.length,
                    })
                  } catch (error) {
                    finishGroundLoad({
                      failed: true,
                    })
                    console.warn(
                      `Failed to load ground model for ${sceneName}, keeping lightweight ground:`,
                      error,
                    )
                    currentGroundMeshRef.current = null
                  }
                })()
              : Promise.resolve()

            void (async () => {
              try {
                await sceneRef.current!.whenReadyAsync()
              } catch (_) {
                // whenReadyAsync failure is non-critical
              }
            })()

            if (!isHomepageDefaultScene) {
              await waitForNextFrames(2)
              notifyVisualReady('hdr')
            }

            await groundPromise

            if (!canceled) {
              logStartupEvent('babylon.scene.fully-ready', {
                sceneName,
                homepageDefaultScene: isHomepageDefaultScene,
              })
              onSceneLoaded?.()
            }
          } catch (error) {
            finishHdrLoad({ failed: true })
            finishGroundLoad({ skipped: true })
            console.warn(`Failed to prepare scene ${sceneName}:`, error)
            onSceneLoaded?.()
          }
        }

        run()
      }
      return () => {
        canceled = true
      }
    }, [
      sceneName,
      HDRI_SCENES,
      loadGroundMeshForHDR,
      currentGroundMeshRef,
      onSceneLoaded,
      createStartupGround,
    ])

    /**
     * Handle character selection changes with synchronized loading and effects.
     */
    useEffect(() => {
      if (sceneRef.current) {
        // Simultaneously trigger character loading and particle effects to ensure complete synchronization
        const loadAndEffect = async () => {
          // console.log('Loading character:', selectedCharacter)
          await loadCharacter(selectedCharacter)
          // Slight delay to ensure character loading is complete before triggering particle effects
          setTimeout(() => {
            spawnCharacterSwitchEffect()
          }, 50)
        }
        loadAndEffect()
      }
    }, [
      selectedCharacter,
      characterChangeKey,
      loadCharacter,
      spawnCharacterSwitchEffect,
    ])

    /**
     * Cleanup on component unmount.
     */
    useEffect(() => {
      const engine = engineRef.current
      return () => {
        if (sceneRef.current) {
          if ((sceneRef.current as any).customCleanup) {
            ;(sceneRef.current as any).customCleanup()
          } else {
            sceneRef.current.dispose()
          }
        }
        if (engine) {
          engine.dispose()
        }
      }
    }, [])

    return (
      <div className={`babylon-viewer ${className}`} style={{ width, height }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            outline: 'none',
          }}
        />
      </div>
    )
  },
)

BabylonViewer.displayName = 'BabylonViewer'

export default BabylonViewer
