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
      voices: [voices],
    } = parameters;
    const [[detune], [gain]] = outputs;
    const center = (voices - 1) / 2;
    const position = index - center;
    const isCenter = Math.abs(position) < 1;
    if (index < voices) {
      for (let i = 0; i < detune.length; ++i) {
        detune[i] =
          ((detuneBase[i] ?? detuneBase[0]) * position) / Math.max(1, center);
      }
      for (let i = 0; i < gain.length; ++i) {
        gain[i] = (isCenter ? 1 : blend[i] ?? blend[0]) / voices;
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
        name: "voices",
        automationRate: "k-rate",
        minValue: 1,
      },
    ];
  }
}

registerProcessor("unison-detune", UnisonDetune);
