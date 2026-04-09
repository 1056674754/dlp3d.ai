/* eslint-disable no-undef */
/**
 * StreamedAudioProcessor
 *
 * An AudioWorklet processor that converts incoming Float32 PCM frames to
 * 16-bit PCM (Int16Array) and streams them to the main thread via the
 * MessagePort for further handling (e.g., encoding or network transport).
 */
class StreamedAudioProcessor extends AudioWorkletProcessor {
  /**
   * Create a new StreamedAudioProcessor.
   */
  constructor() {
    super()
  }

  /**
   * Process audio data from the input, convert it to 16-bit PCM, and post it
   * to the main thread using a transferable ArrayBuffer.
   *
   * @param inputs Array of input channels from the audio graph.
   * @param outputs Array of output channels.
   * @param parameters Map of AudioParam data.
   *
   * @returns {boolean} Always true to keep the processor alive.
   */
  process(inputs, _outputs, _parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const floatData = input[0]
      if (!floatData || floatData.length === 0) {
        return true
      }
      const int16Data = new Int16Array(floatData.length)
      let sumSquares = 0
      for (let i = 0; i < floatData.length; i++) {
        let s = floatData[i]
        s = Math.max(-1, Math.min(1, s)) // Clipping to [-1, 1]
        sumSquares += s * s
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      const rmsLevel = Math.sqrt(sumSquares / floatData.length)
      // The posted data must be an ArrayBuffer
      const buffer = int16Data.buffer
      if (this.port && this.port.postMessage) {
        this.port.postMessage(
          {
            buffer,
            level: rmsLevel,
          },
          [buffer],
        )
      }
    }
    return true
  }
}

registerProcessor('pcm-processor', StreamedAudioProcessor)
