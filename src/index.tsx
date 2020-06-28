import React from "react";
import ReactDOM from "react-dom";
import { observable, autorun, when } from "mobx";
import { observer } from "mobx-react";
import "mobx-react-lite/batchingForReactDom";

namespace Salvation {
  class State {
    constructor() {
      this.init();
    }

    audioContext!: AudioContext;
    master!: Knob;
    noise!: Noise;
    oscA!: Oscillator;
    oscB!: Oscillator;

    async init() {
      // TODO handle context creation failure
      this.audioContext = new AudioContext();

      await this.loadAudioWorklet();

      this.master = new Knob(this.audioContext, "master");
      this.noise = new Noise(this.audioContext, this.master.gainNode);
      this.oscA = new Oscillator(this.audioContext, this.master.gainNode);
      this.oscB = new Oscillator(this.audioContext, this.master.gainNode);

      this.master.gainNode.connect(this.audioContext.destination);

      ReactDOM.render(<App />, document.getElementById("app"));
    }

    loadAudioWorklet() {
      const { audioWorklet } = this.audioContext;

      /**
       * This class is a hack to make Parcel replace URLs properly
       * and build the audio worklet file as if it was a web worker.
       * Parcel does some magic when it sees `new Worker("path/to/file")`.
       * Parcel logs an error at runtime but it doesn't cause any actual issue.
       */
      class Worker {
        constructor(readonly url: string) {}
        promise = audioWorklet.addModule(this.url);
      }

      return new Worker("./audio.ts").promise;
    }
  }

  class Oscillator {
    constructor(
      readonly audioContext: AudioContext,
      readonly destinationNode: AudioNode
    ) {
      this.oscillatorNode.connect(this.levelKnob.gainNode);
      this.levelKnob.gainNode.connect(this.bypass.node);
      this.oscillatorNode.start();
    }

    readonly oscillatorNode = new OscillatorNode(this.audioContext, {
      type: "sawtooth",
    });

    readonly bypass = new Bypass(this.audioContext, this.destinationNode);

    readonly unisonKnob = new Knob(this.audioContext, "unison");
    readonly detuneKnob = new Knob(this.audioContext, "detune");
    readonly blendKnob = new Knob(this.audioContext, "blend");
    readonly phaseKnob = new Knob(this.audioContext, "phase");
    readonly randKnob = new Knob(this.audioContext, "rand");
    readonly wtPosKnob = new Knob(this.audioContext, "wtPos");
    readonly panKnob = new Knob(this.audioContext, "pan");
    readonly levelKnob = new Knob(this.audioContext, "level");
  }

  class Noise {
    constructor(
      readonly audioContext: AudioContext,
      readonly destinationNode: AudioNode
    ) {
      this.noiseNode.connect(this.noiseLevelKnob.gainNode);
      this.noiseLevelKnob.gainNode.connect(this.bypass.node);
    }

    readonly bypass = new Bypass(this.audioContext, this.destinationNode);
    readonly noiseNode = new AudioWorkletNode(
      this.audioContext,
      "white-noise",
      {
        numberOfInputs: 0,
      }
    );
    readonly noiseLevelKnob = new Knob(this.audioContext, "level");
  }

  class Bypass {
    constructor(
      readonly audioContext: AudioContext,
      readonly destinationNode: AudioNode
    ) {
      when(
        () => !this.enabled,
        () => {
          autorun(() => {
            if (this.enabled) {
              this.node.disconnect(destinationNode);
            } else {
              this.node.connect(destinationNode);
            }
          });
        }
      );
    }

    @observable enabled = true;
    readonly node = new GainNode(this.audioContext);
  }

  class Knob {
    constructor(readonly audioContext: AudioContext, readonly name: string) {
      this.constantNode.connect(this.gainNode.gain);
    }

    @observable value = 0;
    readonly constantNode = new ConstantSourceNode(this.audioContext);
    readonly gainNode = new GainNode(this.audioContext);
  }

  const state = new State();

  export const App = () => (
    <main
      style={{
        display: "grid",
        gridTemplate: "1fr 5fr 4fr 2fr / auto",
        gridGap: 4,
        width: 900,
        height: 800,
      }}
    >
      <HeaderSection />
      <OscillatorSection />
      <ModulationSection />
      <KeyboardSection />
    </main>
  );

  const HeaderSection = () => (
    <section
      style={{
        display: "grid",
        grid: "auto / auto 1fr",
        gridGap: 2,
      }}
    >
      <AppTitleSection />
      <HeaderSectionItem />
    </section>
  );

  const HeaderSectionItem = ({
    children,
    style,
    ...props
  }: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLElement>,
    HTMLElement
  >) => (
    <section
      style={{
        display: "grid",
        placeItems: "center",
        backgroundColor: "#333",
        border: "1px solid #444",
        ...style,
      }}
      {...props}
    >
      {children}
    </section>
  );

  const AppTitleSection = () => (
    <HeaderSectionItem>
      <h1
        style={{
          padding: "0 1em",
          fontSize: 24,
          letterSpacing: 2,
          fontWeight: "bold",
          textTransform: "uppercase",
          textShadow: "0 0 .5em var(--primary), 0 0 1em var(--primary)",
        }}
      >
        Salvation
      </h1>
    </HeaderSectionItem>
  );

  const OscillatorSection = () => (
    <section
      style={{
        display: "grid",
        grid: "2fr 3fr / 3fr 5fr 5fr 4fr",
        gridTemplateAreas: "'s a b f' 'n a b f'",
        gridGap: 2,
      }}
    >
      <SubOscillatorSection />
      <NoiseSection />
      <OscASection />
      <OscBSection />
      <FilterSection />
    </section>
  );

  const OscillatorSectionItem = ({
    children,
    title,
    enabled,
    onClick,
    style,
    ...props
  }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
    enabled: boolean;
  }) => (
    <section
      style={{
        padding: 8,
        backgroundColor: "#666",
        border: "1px solid #888",
        filter: enabled ? "" : "grayscale(1)",
        opacity: enabled ? 1 : 0.8,
        ...style,
      }}
      {...props}
    >
      <header
        style={{
          padding: 4,
          display: "grid",
          grid: "auto / auto 1fr",
          gridGap: 8,
          placeItems: "center left",
          background: "#555",
          border: "1px solid #777",
          borderRadius: 4,
        }}
        {...{ onClick }}
      >
        <Checkbox />
        <h2
          style={{
            fontSize: 11,
            lineHeight: 0,
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
      </header>
      {children}
    </section>
  );

  const SubOscillatorSection = () => (
    <OscillatorSectionItem
      title="Sub"
      style={{ gridArea: "s" }}
    ></OscillatorSectionItem>
  );

  const NoiseSection = observer(() => (
    <OscillatorSectionItem
      title="Noise"
      style={{ gridArea: "n" }}
      enabled={!state.noise.bypass.enabled}
      onClick={() => (state.noise.bypass.enabled = !state.noise.bypass.enabled)}
    ></OscillatorSectionItem>
  ));

  const OscASection = observer(() => (
    <OscillatorSectionItem
      title="Osc A"
      style={{ gridArea: "a" }}
      enabled={!state.oscA.bypass.enabled}
      onClick={() => (state.oscA.bypass.enabled = !state.oscA.bypass.enabled)}
    ></OscillatorSectionItem>
  ));

  const OscBSection = observer(() => (
    <OscillatorSectionItem
      title="Osc B"
      style={{ gridArea: "b" }}
      enabled={!state.oscB.bypass.enabled}
      onClick={() => (state.oscB.bypass.enabled = !state.oscB.bypass.enabled)}
    ></OscillatorSectionItem>
  ));

  const FilterSection = () => (
    <OscillatorSectionItem
      title="Filter"
      style={{ gridArea: "f" }}
    ></OscillatorSectionItem>
  );

  const ModulationSection = () => (
    <section style={{ backgroundColor: "#222" }}>ModulationSection</section>
  );

  const KeyboardSection = () => (
    <section style={{ backgroundColor: "#222" }}>KeyboardSection</section>
  );

  const Checkbox = () => (
    <div
      style={{
        width: 10,
        height: 10,
        border: "1px solid #ccc",
        backgroundColor: "var(--primary)",
      }}
    />
  );
}
