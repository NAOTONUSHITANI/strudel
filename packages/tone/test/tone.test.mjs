import { strict as assert } from 'assert';
import '../tone.mjs';
import { pure } from '@strudel.cycles/core';
import Tone from 'tone';

describe('tone', () => {
  it('Should have working tone function', () => {
    const s = synth().chain(out());
    assert.deepStrictEqual(s, new Tone.Synth().chain(out()));
    assert.deepStrictEqual(pure('c3').tone(s)._firstCycleValues, ['c3']);
  });
});
