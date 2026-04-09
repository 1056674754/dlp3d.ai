/**
 * AudioRecordState
 *
 * Enum representing the current microphone recording state in the app.
 */
export enum AudioRecordState {
  /** Recording is currently active. */
  RECORDING = 'recording',
  /** Recording is currently not active. */
  NOT_RECORDING = 'not_recording',
  /** User denied microphone permission. */
  PERMISSION_DENIED = 'permission_denied',
  /** No microphone device was found on the system. */
  MICROPHONE_NOT_FOUND = 'microphone_not_found',
  /** An unknown error occurred while accessing or using the microphone. */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * StreamedAudioEvents
 *
 * Enum of event names emitted by the streamed audio layer.
 */
export enum StreamedAudioEvents {
  /** Event fired when the recording state changes. */
  RECORD_STATE = 'recordState',
  /** Event fired when the live microphone level changes. */
  MIC_LEVEL = 'micLevel',
}

/**
 * StreamedAudioEventPayloads
 *
 * Mapping from streamed audio event names to their payload shapes.
 */
export interface StreamedAudioEventPayloads {
  /** Payload for the record state change event. */
  recordState: AudioRecordState
  /** Payload for the microphone level change event. */
  micLevel: number
}

/**
 * AudioStreamState
 *
 * Shape describing microphone recording state and related controls.
 * Includes methods to start/stop recording, check device availability,
 * and subscribe to recording state changes.
 */
export interface AudioStreamState {
  /** Current recording state of the microphone. */
  recordState: AudioRecordState
  /** Smoothed microphone level for UI feedback, normalized to 0-1. */
  micLevel: number
  /**
   * Start microphone recording.
   *
   * @returns Promise<void> Resolves when recording has started.
   */
  startRecord: () => Promise<void>
  /**
   * Stop microphone recording.
   *
   * @returns Promise<void> Resolves when recording has stopped.
   */
  stopRecord: () => Promise<void>
  /**
   * Check for microphone availability and permission status.
   *
   * @returns Promise<AudioRecordState> The resulting availability/permission state.
   */
  checkDevice: () => Promise<AudioRecordState>
  /**
   * Subscribe to recording state changes.
   *
   * @param cb Callback invoked with the latest AudioRecordState.
   * @returns void
   */
  onRecordStateChange: (cb: (state: AudioRecordState) => void) => void
  /**
   * Unsubscribe from recording state changes.
   *
   * @param cb The previously registered callback to remove.
   * @returns void
   */
  offRecordStateChange: (cb: (state: AudioRecordState) => void) => void
  /**
   * Subscribe to microphone level changes.
   *
   * @param cb Callback invoked with the latest normalized microphone level.
   * @returns void
   */
  onMicLevelChange: (cb: (level: number) => void) => void
  /**
   * Unsubscribe from microphone level changes.
   *
   * @param cb The previously registered callback to remove.
   * @returns void
   */
  offMicLevelChange: (cb: (level: number) => void) => void
}
