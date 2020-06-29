class UnisonDetune extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const {
      detune: detuneBase,
      blend,
      index: [index],
      count: [count],
    } = parameters;
    const [[detune], [gain]] = outputs;
    const center = (count - 1) / 2;
    const position = (index - center) / Math.max(1, center);
    const isCenter = Math.abs(position) < 1;
    if (index < count) {
      for (let i = 0; i < detune.length; ++i) {
        detune[i] = position * (detuneBase[i] ?? detuneBase[0]);
      }
      for (let i = 0; i < gain.length; ++i) {
        gain[i] = (isCenter ? 1 : blend[i] ?? blend[0]) / count;
      }
    } else {
      detune.fill(0);
      gain.fill(0);
    }
    return true;
  }

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: "detune",
        automationRate: "a-rate",
      },
      {
        name: "blend",
        automationRate: "a-rate",
      },
      {
        name: "index",
        automationRate: "k-rate",
      },
      {
        name: "count",
        automationRate: "k-rate",
        minValue: 1,
      },
    ];
  }
}

registerProcessor("unison-detune", UnisonDetune);
