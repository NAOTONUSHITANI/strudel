// coarse, crush, and shape processors adapted from dktr0's webdirt: https://github.com/dktr0/WebDirt/blob/5ce3d698362c54d6e1b68acc47eb2955ac62c793/dist/AudioWorklets.js
// LICENSE GNU General Public License v3.0 see https://github.com/dktr0/WebDirt/blob/main/LICENSE
// TOFIX: THIS FILE DOES NOT SUPPORT IMPORTS ON DEPOLYMENT

import OLAProcessor from './ola-processor';
import FFT from './fft.js';

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const _mod = (n, m) => ((n % m) + m) % m;

const blockSize = 128;
// adjust waveshape to remove frequencies above nyquist to prevent aliasing
// referenced from https://www.kvraudio.com/forum/viewtopic.php?t=375517
function polyBlep(phase, dt) {
  // 0 <= phase < 1
  if (phase < dt) {
    phase /= dt;
    // 2 * (phase - phase^2/2 - 0.5)
    return phase + phase - phase * phase - 1;
  }

  // -1 < phase < 0
  else if (phase > 1 - dt) {
    phase = (phase - 1) / dt;
    // 2 * (phase^2/2 + phase + 0.5)
    return phase * phase + phase + phase + 1;
  }

  // 0 otherwise
  else {
    return 0;
  }
}

const waveshapes = {
  tri(phase, skew = 0.5) {
    const x = 1 - skew;
    if (phase >= skew) {
      return 1 / x - phase / x;
    }
    return phase / skew;
  },
  sine(phase) {
    return Math.sin(Math.PI * 2 * phase) * 0.5 + 0.5;
  },
  ramp(phase) {
    return phase;
  },
  saw(phase) {
    return 1 - phase;
  },

  square(phase, skew = 0.5) {
    if (phase >= skew) {
      return 0;
    }
    return 1;
  },
  custom(phase, values = [0, 1]) {
    const numParts = values.length - 1;
    const currPart = Math.floor(phase * numParts);

    const partLength = 1 / numParts;
    const startVal = clamp(values[currPart], 0, 1);
    const endVal = clamp(values[currPart + 1], 0, 1);
    const y2 = endVal;
    const y1 = startVal;
    const x1 = 0;
    const x2 = partLength;
    const slope = (y2 - y1) / (x2 - x1);
    return slope * (phase - partLength * currPart) + startVal;
  },
  sawblep(phase, dt) {
    const v = 2 * phase - 1;
    return v - polyBlep(phase, dt);
  },
};

function getParamValue(block, param) {
  if (param.length > 1) {
    return param[block];
  }
  return param[0];
}

const waveShapeNames = Object.keys(waveshapes);

// Export the worklet code as a string
const workletCode = `
class LFOProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'time', defaultValue: 0 },
      { name: 'end', defaultValue: 0 },
      { name: 'frequency', defaultValue: 0.5 },
      { name: 'skew', defaultValue: 0.5 },
      { name: 'depth', defaultValue: 1 },
      { name: 'phaseoffset', defaultValue: 0 },
      { name: 'shape', defaultValue: 0 },
      { name: 'dcoffset', defaultValue: 0 },
    ];
  }

  constructor() {
    super();
    this.phase;
  }

  incrementPhase(dt) {
    this.phase += dt;
    if (this.phase > 1.0) {
      this.phase = this.phase - 1;
    }
  }

  process(inputs, outputs, parameters) {
    if (currentTime >= parameters.end[0]) {
      return false;
    }

    const output = outputs[0];
    const frequency = parameters['frequency'][0];
    const time = parameters['time'][0];
    const depth = parameters['depth'][0];
    const skew = parameters['skew'][0];
    const phaseoffset = parameters['phaseoffset'][0];
    const dcoffset = parameters['dcoffset'][0];
    const shape = waveShapeNames[parameters['shape'][0]];

    const blockSize = output[0].length ?? 0;

    if (this.phase == null) {
      this.phase = _mod(time * frequency + phaseoffset, 1);
    }
    const dt = frequency / sampleRate;
    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < output.length; i++) {
        const modval = (waveshapes[shape](this.phase, skew) + dcoffset) * depth;
        output[i][n] = modval;
      }
      this.incrementPhase(dt);
    }

    return true;
  }
}
registerProcessor('lfo-processor', LFOProcessor);

class CoarseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'coarse', defaultValue: 1 }];
  }

  constructor() {
    super();
    this.started = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }
    this.started = hasInput;

    let coarse = parameters.coarse[0] ?? 0;
    coarse = Math.max(1, coarse);
    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < input.length; i++) {
        output[i][n] = n % coarse === 0 ? input[i][n] : output[i][n - 1];
      }
    }
    return true;
  }
}
registerProcessor('coarse-processor', CoarseProcessor);

class CrushProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'crush', defaultValue: 0 }];
  }

  constructor() {
    super();
    this.started = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }
    this.started = hasInput;

    let crush = parameters.crush[0] ?? 8;
    crush = Math.max(1, crush);
    const step = Math.pow(0.5, crush);
    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < input.length; i++) {
        output[i][n] = step * Math.floor((1 / step) * input[i][n] + 0.5);
      }
    }
    return true;
  }
}
registerProcessor('crush-processor', CrushProcessor);
`;

export default workletCode;
