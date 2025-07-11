// This file contains browser-only audio initialization code
let audioContext;
let audioWorklet;

export function initAudio() {
  if (typeof window !== 'undefined') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }
  return null;
}

export function getAudioContext() {
  return audioContext;
}

export async function loadAudioWorklet() {
  if (typeof window !== 'undefined' && audioContext) {
    try {
      await audioContext.audioWorklet.addModule('/audio-worklet.js');
      audioWorklet = true;
    } catch (err) {
      console.error('Failed to load audio worklet:', err);
    }
  }
  return audioWorklet;
} 