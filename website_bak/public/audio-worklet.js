class StrudelAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    // Handle messages from the main thread
    console.log('Message received:', event.data);
  }

  process(inputs, outputs, parameters) {
    // Audio processing logic here
    return true;
  }
}

registerProcessor('strudel-audio-processor', StrudelAudioProcessor); 