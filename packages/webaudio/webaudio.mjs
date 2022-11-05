/*
webaudio.mjs - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://github.com/tidalcycles/strudel/blob/main/packages/webaudio/webaudio.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// import { Pattern, getFrequency, patternify2 } from '@strudel.cycles/core';
import * as strudel from '@strudel.cycles/core';
import { fromMidi, isNote, toMidi } from '@strudel.cycles/core';
import './feedbackdelay.mjs';
import './reverb.mjs';
import { loadBuffer, reverseBuffer } from './sampler.mjs';
const { Pattern } = strudel;
import './vowel.mjs';
import workletsUrl from './worklets.mjs?url';

// export const getAudioContext = () => Tone.getContext().rawContext;

let audioContext;
export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

let destination;
const getDestination = () => {
  const ctx = getAudioContext();
  if (!destination) {
    destination = ctx.createGain();
    destination.connect(ctx.destination);
  }
  return destination;
};

export const panic = () => {
  getDestination().gain.linearRampToValueAtTime(0, getAudioContext().currentTime + 0.01);
  destination = null;
};

const getFilter = (type, frequency, Q) => {
  const filter = getAudioContext().createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = Q;
  return filter;
};

const getADSR = (attack, decay, sustain, release, velocity, begin, end) => {
  const gainNode = getAudioContext().createGain();
  gainNode.gain.setValueAtTime(0, begin);
  gainNode.gain.linearRampToValueAtTime(velocity, begin + attack); // attack
  gainNode.gain.linearRampToValueAtTime(sustain * velocity, begin + attack + decay); // sustain start
  gainNode.gain.setValueAtTime(sustain * velocity, end); // sustain end
  gainNode.gain.linearRampToValueAtTime(0, end + release); // release
  // for some reason, using exponential ramping creates little cracklings
  /* let t = begin;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.exponentialRampToValueAtTime(velocity, (t += attack));
  const sustainGain = Math.max(sustain * velocity, 0.001);
  gainNode.gain.exponentialRampToValueAtTime(sustainGain, (t += decay));
  if (end - begin < attack + decay) {
    gainNode.gain.cancelAndHoldAtTime(end);
  } else {
    gainNode.gain.setValueAtTime(sustainGain, end);
  }
  gainNode.gain.exponentialRampToValueAtTime(0.001, end + release); // release */
  return gainNode;
};

const getOscillator = ({ s, freq, t, duration, release }) => {
  // make oscillator
  const o = getAudioContext().createOscillator();
  o.type = s || 'triangle';
  o.frequency.value = Number(freq);
  o.start(t);
  o.stop(t + duration + release);
  return o;
};

const getSoundfontKey = (s) => {
  if (!globalThis.soundfontList) {
    // soundfont package not loaded
    return false;
  }
  if (globalThis.soundfontList?.instruments?.includes(s)) {
    return s;
  }
  // check if s is one of the soundfonts, which are loaded into globalThis, to avoid coupling both packages
  const nameIndex = globalThis.soundfontList?.instrumentNames?.indexOf(s);
  // convert number nameIndex (0-128) to 3 digit string (001-128)
  const name = nameIndex < 10 ? `00${nameIndex}` : nameIndex < 100 ? `0${nameIndex}` : nameIndex;
  if (nameIndex !== -1) {
    // TODO: indices of instrumentNames do not seem to match instruments
    return globalThis.soundfontList.instruments.find((instrument) => instrument.startsWith(name));
  }
  return;
};

const getSampleBufferSource = async (s, n, note, speed) => {
  let transpose = 0;
  let midi = typeof note === 'string' ? toMidi(note) : note || 36;
  transpose = midi - 36; // C3 is middle C

  const ac = getAudioContext();
  // is sample from loaded samples(..)
  const samples = getLoadedSamples();
  if (!samples) {
    throw new Error('no samples loaded');
  }
  const bank = samples?.[s];
  if (!bank) {
    throw new Error(
      `sample not found: "${s}", try one of ${Object.keys(samples)
        .map((s) => `"${s}"`)
        .join(', ')}.`,
    );
  }
  if (typeof bank !== 'object') {
    throw new Error('wrong format for sample bank:', s);
  }
  let sampleUrl;
  if (Array.isArray(bank)) {
    sampleUrl = bank[n % bank.length];
  } else {
    const midiDiff = (noteA) => toMidi(noteA) - midi;
    // object format will expect keys as notes
    const closest = Object.keys(bank)
      .filter((k) => !k.startsWith('_'))
      .reduce(
        (closest, key, j) => (!closest || Math.abs(midiDiff(key)) < Math.abs(midiDiff(closest)) ? key : closest),
        null,
      );
    transpose = -midiDiff(closest); // semitones to repitch
    sampleUrl = bank[closest][n % bank[closest].length];
  }
  let buffer = await loadBuffer(sampleUrl, ac);
  if (speed < 0) {
    // should this be cached?
    buffer = reverseBuffer(buffer);
  }
  const bufferSource = ac.createBufferSource();
  bufferSource.buffer = buffer;
  const playbackRate = 1.0 * Math.pow(2, transpose / 12);
  // bufferSource.playbackRate.value = Math.pow(2, transpose / 12);
  bufferSource.playbackRate.value = playbackRate;
  return bufferSource;
};

const splitSN = (s, n) => {
  if (!s.includes(':')) {
    return [s, n];
  }
  let [s2, n2] = s.split(':');
  if (isNaN(Number(n2))) {
    return [s, n];
  }
  return [s2, n2];
};

let workletsLoading;
function loadWorklets() {
  if (workletsLoading) {
    return workletsLoading;
  }
  workletsLoading = getAudioContext().audioWorklet.addModule(workletsUrl);
  return workletsLoading;
}

function getWorklet(ac, processor, params) {
  const node = new AudioWorkletNode(ac, processor);
  Object.entries(params).forEach(([key, value]) => {
    node.parameters.get(key).value = value;
  });
  return node;
}

if (typeof window !== 'undefined') {
  try {
    loadWorklets();
  } catch (err) {
    console.warn('could not load AudioWorklet effects coarse, crush and shape', err);
  }
}

function gainNode(value) {
  const node = getAudioContext().createGain();
  node.gain.value = value;
  return node;
}
const cutGroupSources = [];
const cutGroupEnvelopes = [];

let delays = {};
function getDelay(orbit, delaytime, delayfeedback, t) {
  if (!delays[orbit]) {
    const ac = getAudioContext();
    const dly = ac.createFeedbackDelay(1, delaytime, delayfeedback);
    dly.start(t);
    dly.connect(getDestination());
    delays[orbit] = dly;
  }
  delays[orbit].delayTime.value !== delaytime && delays[orbit].delayTime.setValueAtTime(delaytime, t);
  delays[orbit].feedback.value !== delayfeedback && delays[orbit].feedback.setValueAtTime(delayfeedback, t);
  return delays[orbit];
}

let reverbs = {};
function getReverb(orbit, duration = 2) {
  if (!reverbs[orbit]) {
    const ac = getAudioContext();
    const reverb = ac.createReverb(duration);
    reverb.connect(getDestination());
    reverbs[orbit] = reverb;
  }
  if (reverbs[orbit].duration !== duration) {
    reverbs[orbit] = reverbs[orbit].setDuration(duration);
    reverbs[orbit].duration = duration;
  }
  return reverbs[orbit];
}

function effectSend(input, effect, wet) {
  const send = gainNode(wet);
  input.connect(send);
  send.connect(effect);
  return send;
}

// export const webaudioOutput = async (t, hap, ct, cps) => {
export const webaudioOutput = async (hap, deadline, hapDuration) => {
  try {
    const ac = getAudioContext();
    /* if (isNote(hap.value)) {
      // supports primitive hap values that look like notes
      hap.value = { note: hap.value };
    } */
    if (typeof hap.value !== 'object') {
      throw new Error(
        `hap.value ${hap.value} is not supported by webaudio output. Hint: append .note() or .s() to the end`,
      );
    }
    // calculate correct time (tone.js workaround)
    let t = ac.currentTime + deadline;
    // destructure value
    let {
      freq,
      s,
      bank,
      sf,
      clip = 0, // if 1, samples will be cut off when the hap ends
      n = 0,
      note,
      gain = 0.8,
      cutoff,
      resonance = 1,
      hcutoff,
      hresonance = 1,
      bandf,
      bandq = 1,
      coarse,
      crush,
      shape,
      pan,
      speed = 1, // sample playback speed
      begin = 0,
      end = 1,
      vowel,
      delay = 0,
      delayfeedback = 0.5,
      delaytime = 0.25,
      unit,
      nudge = 0, // TODO: is this in seconds?
      cut,
      loop,
      orbit = 1,
      room,
      size = 2,
      roomsize = size,
    } = hap.value;
    const { velocity = 1 } = hap.context;
    gain *= velocity; // legacy fix for velocity
    // the chain will hold all audio nodes that connect to each other
    const chain = [];
    if (bank && s) {
      s = `${bank}_${s}`;
    }
    if (typeof s === 'string') {
      [s, n] = splitSN(s, n);
    }
    if (typeof note === 'string') {
      [note, n] = splitSN(note, n);
    }
    if (!s || ['sine', 'square', 'triangle', 'sawtooth'].includes(s)) {
      // destructure adsr here, because the default should be different for synths and samples
      const { attack = 0.001, decay = 0.05, sustain = 0.6, release = 0.01 } = hap.value;
      // with synths, n and note are the same thing
      n = note || n || 36;
      if (typeof n === 'string') {
        n = toMidi(n); // e.g. c3 => 48
      }
      // get frequency
      if (!freq && typeof n === 'number') {
        freq = fromMidi(n); // + 48);
      }
      // make oscillator
      const o = getOscillator({ t, s, freq, duration: hapDuration, release });
      chain.push(o);
      // level down oscillators as they are really loud compared to samples i've tested
      chain.push(gainNode(0.3));
      // TODO: make adsr work with samples without pops
      // envelope
      const adsr = getADSR(attack, decay, sustain, release, 1, t, t + hapDuration);
      chain.push(adsr);
    } else {
      // destructure adsr here, because the default should be different for synths and samples
      const { attack = 0.001, decay = 0.001, sustain = 1, release = 0.001 } = hap.value;
      // load sample
      if (speed === 0) {
        // no playback
        return;
      }
      if (!s) {
        console.warn('no sample specified');
        return;
      }
      const soundfont = getSoundfontKey(s);
      let bufferSource;

      try {
        if (soundfont) {
          // is soundfont
          bufferSource = await globalThis.getFontBufferSource(soundfont, note || n, ac);
        } else {
          // is sample from loaded samples(..)
          bufferSource = await getSampleBufferSource(s, n, note, speed);
        }
      } catch (err) {
        console.warn(err);
        return;
      }
      // asny stuff above took too long?
      if (ac.currentTime > t) {
        console.warn('sample still loading:', s, n);
        return;
      }
      if (!bufferSource) {
        console.warn('no buffer source');
        return;
      }
      bufferSource.playbackRate.value = Math.abs(speed) * bufferSource.playbackRate.value;
      if (unit === 'c') {
        // are there other units?
        bufferSource.playbackRate.value = bufferSource.playbackRate.value * bufferSource.buffer.duration;
      }
      let duration = soundfont || clip ? hapDuration : bufferSource.buffer.duration / bufferSource.playbackRate.value;
      // "The computation of the offset into the sound is performed using the sound buffer's natural sample rate,
      // rather than the current playback rate, so even if the sound is playing at twice its normal speed,
      // the midway point through a 10-second audio buffer is still 5."
      const offset = begin * duration * bufferSource.playbackRate.value;
      duration = (end - begin) * duration;
      if (loop) {
        bufferSource.loop = true;
        bufferSource.loopStart = offset;
        bufferSource.loopEnd = offset + duration;
        duration = loop * duration;
      }
      t += nudge;

      bufferSource.start(t, offset);
      chain.push(bufferSource);
      bufferSource.stop(t + duration + release);
      const adsr = getADSR(attack, decay, sustain, release, 1, t, t + duration);
      chain.push(adsr);
      if (cut !== undefined) {
        const cutSource = cutGroupSources[cut];
        const cutEnvelope = cutGroupEnvelopes[cut];
        const fadeTime = 0.001;
        if (cutEnvelope) {
          // cutEnvelope.gain.cancelAndHoldAtTime(t);
          cutEnvelope.gain.cancelScheduledValues(t);
          cutEnvelope.gain.linearRampToValueAtTime(0, t + fadeTime);
          // cutEnvelope.gain.exponentialRampToValueAtTime(0.0001, t + fadeTime);
        }
        if (cutSource) {
          cutSource.stop(t + fadeTime);
        }
        cutGroupSources[cut] = bufferSource;
        cutGroupEnvelopes[cut] = adsr;
      }
    }

    // gain stage
    chain.push(gainNode(gain));

    // filters
    cutoff !== undefined && chain.push(getFilter('lowpass', cutoff, resonance));
    hcutoff !== undefined && chain.push(getFilter('highpass', hcutoff, hresonance));
    bandf !== undefined && chain.push(getFilter('bandpass', bandf, bandq));
    vowel !== undefined && chain.push(ac.createVowelFilter(vowel));

    // effects
    coarse !== undefined && chain.push(getWorklet(ac, 'coarse-processor', { coarse }));
    crush !== undefined && chain.push(getWorklet(ac, 'crush-processor', { crush }));
    shape !== undefined && chain.push(getWorklet(ac, 'shape-processor', { shape }));

    // panning
    if (pan !== undefined) {
      const panner = ac.createStereoPanner();
      panner.pan.value = 2 * pan - 1;
      chain.push(panner);
    }

    // last gain
    const post = gainNode(1);
    chain.push(post);
    post.connect(getDestination());

    // delay
    let delaySend;
    if (delay > 0 && delaytime > 0 && delayfeedback > 0) {
      const delyNode = getDelay(orbit, delaytime, delayfeedback, t);
      delaySend = effectSend(post, delyNode, delay);
    }
    // reverb
    let reverbSend;
    if (room > 0 && roomsize > 0) {
      const reverbNode = getReverb(orbit, roomsize);
      reverbSend = effectSend(post, reverbNode, room);
    }

    // connect chain elements together
    chain.slice(1).reduce((last, current) => last.connect(current), chain[0]);

    // disconnect all nodes when source node has ended:
    chain[0].onended = () => chain.concat([delaySend, reverbSend]).forEach((n) => n?.disconnect());
  } catch (e) {
    console.warn('.out error:', e);
  }
};

export const webaudioOutputTrigger = (t, hap, ct, cps) => webaudioOutput(hap, t - ct, hap.duration / cps);

Pattern.prototype.out = function () {
  // TODO: refactor (t, hap, ct, cps) to (hap, deadline, duration) ?
  return this.onTrigger(webaudioOutputTrigger);
};
