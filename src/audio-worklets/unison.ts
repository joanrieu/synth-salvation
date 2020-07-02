class Unison extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    [[detune], [gain]]: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const {
      detune: detuneBase,
      blend,
      index: [index],
      voices: [voices],
    } = parameters;

    if (index < voices) {
      const middle = voices / 2;
      const delta = Math.abs(index - middle) < 1;
      const dual = voices % 2 === 0;

      for (let i = 0; i < detune.length; ++i) {
        detune[i] = (detuneBase[i] ?? detuneBase[0]) * (index - middle) * 50;
      }

      for (let i = 0; i < gain.length; ++i) {
        gain[i] = delta ? (dual ? 0.5 : 1) : blend[i] ?? blend[0];
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

registerProcessor("unison", Unison);
