/**
 * Face tracking hook for camera-based eye gaze control.
 *
 * Captures front camera feed, runs ML Kit face detection, and sends
 * normalized face position (-1..1) to the WebView via the bridge.
 * The 3D character's eyes then follow the detected face position.
 *
 * ─── Required dependencies (install before enabling) ──────────
 *
 *   pnpm add react-native-vision-camera
 *   pnpm add react-native-worklets-core
 *   pnpm add react-native-vision-camera-face-detector
 *
 *   After installing, rebuild the Android app:
 *     cd android && ./gradlew clean && cd .. && pnpm android
 *
 * ─── Usage ────────────────────────────────────────────────────
 *
 *   In HomeScreen or DLP3DWebView parent:
 *
 *     const faceTrackingView = useFaceTracking({ enabled: true });
 *     return <>{faceTrackingView}{...rest of UI}</>;
 *
 *   The hook renders a hidden 1x1 camera view and sends face:position
 *   events to the WebView via the bridge singleton.
 */

import {useEffect, useRef, useCallback, useState} from 'react';
import {Platform, AppState} from 'react-native';
import {bridge} from '@/bridge/WebViewBridge';

interface FaceTrackingOptions {
  enabled: boolean;
  /** How often to send position updates in ms. Default: 66 (~15fps) */
  throttleMs?: number;
}

/**
 * Smoothing filter for face position to reduce jitter.
 */
class PositionSmoother {
  private _x = 0;
  private _y = 0;
  private readonly _factor: number;

  constructor(smoothingFactor = 0.3) {
    this._factor = smoothingFactor;
  }

  update(rawX: number, rawY: number): {x: number; y: number} {
    this._x += (rawX - this._x) * this._factor;
    this._y += (rawY - this._y) * this._factor;
    return {x: this._x, y: this._y};
  }

  reset() {
    this._x = 0;
    this._y = 0;
  }
}

/**
 * Hook that provides face-tracking-based gaze input to the WebView 3D scene.
 *
 * Returns a React element (hidden camera preview) to render, or null if
 * face tracking is not available or disabled.
 *
 * The implementation below is structured for react-native-vision-camera v4+
 * with the face-detector plugin. Uncomment the implementation once
 * dependencies are installed.
 */
export function useFaceTracking({
  enabled,
  throttleMs = 66,
}: FaceTrackingOptions): React.ReactElement | null {
  const smootherRef = useRef(new PositionSmoother(0.3));
  const lastSendRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  const sendFacePosition = useCallback(
    (normalizedX: number, normalizedY: number) => {
      const now = Date.now();
      if (now - lastSendRef.current < throttleMs) return;
      lastSendRef.current = now;

      const smoothed = smootherRef.current.update(normalizedX, normalizedY);
      bridge.send({
        type: 'face:position',
        payload: {x: smoothed.x, y: smoothed.y},
      });
    },
    [throttleMs],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  if (!enabled || Platform.OS !== 'android') {
    return null;
  }

  // ─── Implementation stub ───────────────────────────────────
  //
  // Uncomment the block below after installing dependencies:
  //
  //   import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
  //   import { useFaceDetector } from 'react-native-vision-camera-face-detector';
  //
  //   function FaceTrackingCamera({ onFaceDetected }) {
  //     const device = useCameraDevice('front');
  //     const { detectFaces } = useFaceDetector({
  //       performanceMode: 'fast',
  //       landmarkMode: 'none',
  //       classificationMode: 'none',
  //     });
  //
  //     const frameProcessor = useFrameProcessor((frame) => {
  //       'worklet';
  //       const faces = detectFaces(frame);
  //       if (faces.length > 0) {
  //         const face = faces[0];
  //         const centerX = face.bounds.x + face.bounds.width / 2;
  //         const centerY = face.bounds.y + face.bounds.height / 2;
  //         // Normalize to -1..1 range (centered)
  //         const nx = (centerX / frame.width - 0.5) * 2;
  //         const ny = (centerY / frame.height - 0.5) * 2;
  //         onFaceDetected(nx, ny);
  //       }
  //     }, [detectFaces, onFaceDetected]);
  //
  //     if (!device) return null;
  //
  //     return (
  //       <Camera
  //         device={device}
  //         isActive={true}
  //         frameProcessor={frameProcessor}
  //         style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
  //         photo={false}
  //         video={false}
  //         audio={false}
  //         pixelFormat="yuv"
  //         fps={15}
  //       />
  //     );
  //   }
  //
  //   return <FaceTrackingCamera onFaceDetected={sendFacePosition} />;

  // For now, return null until dependencies are installed.
  // The device orientation + mouse tracking fallback in BabylonViewer
  // provides immediate interactive eye tracking without camera.
  return null;
}
