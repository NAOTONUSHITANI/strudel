
export class Hap {
  /*
      Event class, representing a value active during the timespan
      'part'. This might be a fragment of an event, in which case the
      timespan will be smaller than the 'whole' timespan, otherwise the
      two timespans will be the same. The 'part' must never extend outside of the
      'whole'. If the event represents a continuously changing value
      then the whole will be returned as None, in which case the given
      value will have been sampled from the point halfway between the
      start and end of the 'part' timespan.
      The context is to store a list of source code locations causing the event
      */

  constructor(whole, part, value, context = {}, stateful = false) {
    this.whole = whole;
    this.part = part;
    this.value = value;
    this.context = context;
    this.stateful = stateful;
    if (stateful) {
      console.assert(typeof this.value === 'function', 'Stateful values must be functions');
    }
  }

  get duration() {
    return this.whole.end.sub(this.whole.begin).valueOf();
  }

  wholeOrPart() {
    return this.whole ? this.whole : this.part;
  }

  withSpan(func) {
    // Returns a new event with the function f applies to the event timespan.
    const whole = this.whole ? func(this.whole) : undefined;
    return new Hap(whole, func(this.part), this.value, this.context);
  }

  withValue(func) {
    // Returns a new event with the function f applies to the event value.
    return new Hap(this.whole, this.part, func(this.value), this.context);
  }

  hasOnset() {
    // Test whether the event contains the onset, i.e that
    // the beginning of the part is the same as that of the whole timespan."""
    return this.whole != undefined && this.whole.begin.equals(this.part.begin);
  }

  resolveState(state) {
    if (this.stateful && this.hasOnset()) {
      console.log('stateful');
      const func = this.value;
      const [newState, newValue] = func(state);
      return [newState, new Hap(this.whole, this.part, newValue, this.context, false)];
    }
    return [state, this];
  }

  spanEquals(other) {
    return (this.whole == undefined && other.whole == undefined) || this.whole.equals(other.whole);
  }

  equals(other) {
    return (
      this.spanEquals(other) &&
      this.part.equals(other.part) &&
      // TODO would == be better ??
      this.value === other.value
    );
  }

  show() {
    return (
      '(' + (this.whole == undefined ? '~' : this.whole.show()) + ', ' + this.part.show() + ', ' + this.value + ')'
    );
  }

  combineContext(b) {
    const a = this;
    return { ...a.context, ...b.context, locations: (a.context.locations || []).concat(b.context.locations || []) };
  }

  setContext(context) {
    return new Hap(this.whole, this.part, this.value, context);
  }
}

export default Hap;