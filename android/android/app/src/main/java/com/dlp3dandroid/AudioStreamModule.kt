package com.dlp3dandroid

import android.content.Context
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = AudioStreamModule.NAME)
class AudioStreamModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AudioStream"
        private const val TAG = "AudioStream"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BATCH_DURATION_MS = 200L
        private const val BATCH_SIZE_SAMPLES = (SAMPLE_RATE * BATCH_DURATION_MS / 1000).toInt()
        private const val BATCH_SIZE_BYTES = BATCH_SIZE_SAMPLES * 2

        private const val VAD_FRAME_MS = 30
        private const val VAD_FRAME_SAMPLES = (SAMPLE_RATE * VAD_FRAME_MS / 1000).toInt()
        private const val VAD_SILENCE_THRESHOLD = 500.0
        private const val VAD_SILENCE_DURATION_MS = 800L
        private const val VAD_SPEECH_DURATION_MS = 150L
    }

    private val audioManager: AudioManager by lazy {
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private var audioFocusRequest: Int = AudioManager.AUDIOFOCUS_REQUEST_FAILED

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null

    @Volatile
    private var isRecording = false

    @Volatile
    private var isSpeech = false
    private var speechFrameCount = 0
    private var silenceFrameCount = 0
    private var consecutiveSpeechFrames = 0
    private var consecutiveSilenceFrames = 0

    private val batchBuffer = ByteArray(BATCH_SIZE_BYTES)
    private var batchPosition = 0

    override fun getName(): String = NAME

    @ReactMethod
    fun start(promise: Promise) {
        if (isRecording) {
            promise.reject("ALREADY_RECORDING", "Already recording")
            return
        }

        val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
        if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
            promise.reject("AUDIO_ERROR", "Failed to get minimum buffer size")
            return
        }

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                maxOf(minBufferSize, BATCH_SIZE_BYTES * 2)
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("AUDIO_ERROR", "AudioRecord not initialized")
                audioRecord?.release()
                audioRecord = null
                return
            }

            isSpeech = false
            speechFrameCount = 0
            silenceFrameCount = 0
            consecutiveSpeechFrames = 0
            consecutiveSilenceFrames = 0
            batchPosition = 0

            isRecording = true
            audioFocusRequest = audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
            audioRecord?.startRecording()

            recordingThread = Thread({ recordingLoop() }, "AudioStreamThread")
            recordingThread?.start()

            promise.resolve("Recording started")
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Microphone permission not granted", e)
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to start recording: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        if (!isRecording) {
            promise.resolve("Not recording")
            return
        }

        isRecording = false
        try {
            recordingThread?.join(1000)
        } catch (_: InterruptedException) {
        }

        try {
            if (audioFocusRequest == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                audioManager.abandonAudioFocus(null)
                audioFocusRequest = AudioManager.AUDIOFOCUS_REQUEST_FAILED
            }
        } catch (_: Exception) {}

        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (_: Exception) {
        }
        audioRecord = null
        recordingThread = null

        promise.resolve("Recording stopped")
    }

    private fun recordingLoop() {
        val vadFrameSize = VAD_FRAME_SAMPLES * 2
        val readBuffer = ByteArray(vadFrameSize)
        val shortBuffer = ShortArray(VAD_FRAME_SAMPLES)
        var warmupFramesRemaining = 3

        while (isRecording) {
            val bytesRead = audioRecord?.read(readBuffer, 0, vadFrameSize) ?: -1
            if (bytesRead <= 0 || !isRecording) break

            if (warmupFramesRemaining > 0) {
                warmupFramesRemaining--
                continue
            }

            for (i in 0 until minOf(bytesRead / 2, shortBuffer.size)) {
                val low = readBuffer[i * 2].toInt() and 0xFF
                val high = readBuffer[i * 2 + 1].toInt()
                shortBuffer[i] = ((high shl 8) or low).toShort()
            }

            var sumSquares = 0.0
            val sampleCount = minOf(bytesRead / 2, shortBuffer.size)
            for (i in 0 until sampleCount) {
                sumSquares += shortBuffer[i].toDouble() * shortBuffer[i].toDouble()
            }
            val rms = if (sampleCount > 0) Math.sqrt(sumSquares / sampleCount) else 0.0

            val wasSpeech = isSpeech

            if (rms > VAD_SILENCE_THRESHOLD) {
                consecutiveSilenceFrames = 0
                consecutiveSpeechFrames++
                if (consecutiveSpeechFrames >= (VAD_SPEECH_DURATION_MS / VAD_FRAME_MS).toInt()) {
                    if (!isSpeech) {
                        isSpeech = true
                        sendEvent("onVadSpeech", null)
                    }
                }
            } else {
                consecutiveSpeechFrames = 0
                consecutiveSilenceFrames++
                if (consecutiveSilenceFrames >= (VAD_SILENCE_DURATION_MS / VAD_FRAME_MS).toInt()) {
                    if (isSpeech) {
                        isSpeech = false
                        sendEvent("onVadSilence", null)
                    }
                }
            }

            val remaining = batchBuffer.size - batchPosition
            if (bytesRead <= remaining) {
                System.arraycopy(readBuffer, 0, batchBuffer, batchPosition, bytesRead)
                batchPosition += bytesRead
            } else {
                System.arraycopy(readBuffer, 0, batchBuffer, batchPosition, remaining)
                batchPosition = batchBuffer.size
                emitBatch()

                val overflow = bytesRead - remaining
                if (overflow > 0) {
                    System.arraycopy(readBuffer, remaining, batchBuffer, 0, overflow)
                    batchPosition = overflow
                }
            }

            if (batchPosition >= batchBuffer.size) {
                emitBatch()
            }
        }

        if (batchPosition > 0) {
            emitPartialBatch()
        }
    }

    private fun emitBatch() {
        val base64Data = Base64.encodeToString(batchBuffer, 0, batchBuffer.size, Base64.NO_WRAP)
        sendEvent("onPCMData", base64Data)
        batchPosition = 0
    }

    private fun emitPartialBatch() {
        if (batchPosition <= 0) return
        val copy = ByteArray(batchPosition)
        System.arraycopy(batchBuffer, 0, copy, 0, batchPosition)
        val base64Data = Base64.encodeToString(copy, 0, copy.size, Base64.NO_WRAP)
        sendEvent("onPCMData", base64Data)
        batchPosition = 0
    }

    private fun sendEvent(eventName: String, data: String?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, data)
    }

    @ReactMethod
    fun addListener(eventName: String?) {
    }

    @ReactMethod
    fun removeListeners(count: Double) {
    }
}
