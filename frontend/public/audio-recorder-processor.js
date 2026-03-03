// AudioWorklet processor for recording microphone input
// Replaces the deprecated ScriptProcessorNode
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = true;
    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this._recording = false;
      }
    };
  }

  process(inputs) {
    if (!this._recording) return false;

    const input = inputs[0];
    if (input && input.length > 0) {
      // Send a copy of the audio data to the main thread
      const channelData = input[0];
      this.port.postMessage(new Float32Array(channelData));
    }

    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
