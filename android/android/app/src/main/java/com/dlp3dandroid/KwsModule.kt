package com.dlp3dandroid

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import kotlin.concurrent.thread

@ReactModule(name = KwsModule.NAME)
class KwsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "Kws"
        private const val TAG = "Kws"
        private const val SAMPLE_RATE = 16000
        private const val MODEL_DIR =
            "sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01"
    }

    private var keywordSpotter: KeywordSpotter? = null
    private var stream: OnlineStream? = null
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null

    @Volatile
    private var isListening = false

    @Volatile
    private var isModelLoaded = false

    override fun getName(): String = NAME

    @ReactMethod
    fun loadModel(promise: Promise) {
        if (isModelLoaded && keywordSpotter != null) {
            promise.resolve(true)
            return
        }

        try {
            val config = KeywordSpotterConfig(
                featConfig = FeatureConfig(
                    sampleRate = SAMPLE_RATE,
                    featureDim = 80,
                ),
                modelConfig = OnlineModelConfig(
                    transducer = OnlineTransducerModelConfig(
                        encoder = "$MODEL_DIR/encoder-epoch-12-avg-2-chunk-16-left-64.onnx",
                        decoder = "$MODEL_DIR/decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
                        joiner = "$MODEL_DIR/joiner-epoch-12-avg-2-chunk-16-left-64.onnx",
                    ),
                    tokens = "$MODEL_DIR/tokens.txt",
                    modelType = "zipformer2",
                    numThreads = 2,
                    debug = false,
                    provider = "cpu",
                ),
                keywordsFile = "$MODEL_DIR/keywords.txt",
                maxActivePaths = 4,
                keywordsScore = 1.0f,
                keywordsThreshold = 0.6f,
                numTrailingBlanks = 4,
            )

            keywordSpotter = KeywordSpotter(
                assetManager = reactContext.assets,
                config = config,
            )
            isModelLoaded = true
            Log.i(TAG, "Sherpa-ONNX KWS model loaded successfully")
            sendEvent("onKwsModelLoaded", null)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load KWS model: ${e.message}", e)
            isModelLoaded = false
            promise.reject("KWS_LOAD_FAILED", "Failed to load KWS model: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startListening(keywords: String, promise: Promise) {
        if (isListening) {
            promise.resolve(true)
            return
        }

        val kws = keywordSpotter
        if (kws == null) {
            promise.reject("KWS_NOT_LOADED", "KWS model is not loaded")
            return
        }

        try {
            // Create AudioRecord
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, channelConfig, audioFormat)

            if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                promise.reject("AUDIO_ERROR", "Failed to get minimum buffer size")
                return
            }

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                channelConfig,
                audioFormat,
                minBufferSize * 2,
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("AUDIO_INIT_FAILED", "AudioRecord not initialized")
                audioRecord?.release()
                audioRecord = null
                return
            }

            // Create stream with keywords
            val normalizedKeywords = keywords.trim()
            val kwStream = if (normalizedKeywords.isNotEmpty()) {
                kws.createStream(normalizedKeywords)
            } else {
                kws.createStream()
            }

            if (kwStream.ptr == 0L) {
                promise.reject("KWS_STREAM_FAILED", "Failed to create KWS stream with keywords: $normalizedKeywords")
                audioRecord?.release()
                audioRecord = null
                return
            }

            stream = kwStream
            isListening = true

            audioRecord?.startRecording()

            // Start processing thread
            recordingThread = thread(true, name = "kws-recording") {
                processSamples(kws, kwStream)
            }

            Log.i(TAG, "KWS listening started with keywords: $normalizedKeywords")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start KWS listening: ${e.message}", e)
            isListening = false
            promise.reject("KWS_START_FAILED", "Failed to start KWS listening: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        isListening = false

        // Wait for recording thread to finish
        recordingThread?.let {
            try {
                it.join(1000)
            } catch (_: InterruptedException) {
                // Ignore
            }
        }
        recordingThread = null

        stream?.release()
        stream = null

        audioRecord?.let {
            try {
                it.stop()
            } catch (_: IllegalStateException) {
                // Ignore — may already be stopped
            }
            it.release()
        }
        audioRecord = null

        Log.i(TAG, "KWS listening stopped")
        promise.resolve(true)
    }

    @ReactMethod
    fun unload(promise: Promise) {
        // Stop listening first
        isListening = false
        recordingThread?.let {
            try { it.join(1000) } catch (_: InterruptedException) {}
        }
        recordingThread = null
        stream?.release()
        stream = null
        audioRecord?.let {
            try { it.stop() } catch (_: IllegalStateException) {}
            it.release()
        }
        audioRecord = null

        keywordSpotter?.release()
        keywordSpotter = null
        isModelLoaded = false

        Log.i(TAG, "KWS model unloaded")
        promise.resolve(true)
    }

    private fun processSamples(kws: KeywordSpotter, kwStream: OnlineStream) {
        Log.i(TAG, "KWS recording thread started")

        val interval = 0.1 // 100ms
        val bufferSize = (interval * SAMPLE_RATE).toInt() // 1600 samples
        val buffer = ShortArray(bufferSize)

        while (isListening) {
            val ret = audioRecord?.read(buffer, 0, buffer.size)
            if (ret != null && ret > 0) {
                // Convert ShortArray to FloatArray
                val samples = FloatArray(ret) { buffer[it] / 32768.0f }
                kwStream.acceptWaveform(samples, SAMPLE_RATE)

                while (kws.isReady(kwStream)) {
                    kws.decode(kwStream)

                    val result = kws.getResult(kwStream)
                    val keyword = result.keyword

                    if (keyword.isNotBlank()) {
                        Log.i(TAG, "Keyword detected: $keyword (tokens: ${result.tokens.joinToString(",")})")

                        // Stop listening immediately to prevent double detection.
                        // The JS side will call stopListening() to clean up resources.
                        isListening = false

                        // Send detection event to JS
                        val params = Arguments.createMap().apply {
                            putString("keyword", keyword)
                        }
                        sendEvent("onKwsDetected", params)

                        // Exit the decode loop — thread will exit the outer while too
                        break
                    }
                }
            } else if (ret == null || ret == 0) {
                break
            }
        }

        Log.i(TAG, "KWS recording thread exiting")
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName: ${e.message}")
        }
    }
}
