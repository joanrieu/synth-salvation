import { autorun, observable, when } from "mobx";
import { observer } from "mobx-react";
import "mobx-react-lite/batchingForReactDom";
import React from "react";
import ReactDOM from "react-dom";

namespace Salvation {
  namespace Audio {
    export class State {
      constructor() {
        this.init();
      }

      audioContext!: AudioContext;
      master!: Master;
      noise!: Noise;
      oscA!: Oscillator;
      oscB!: Oscillator;

      async init() {
        // TODO handle context creation failure
        this.audioContext = new AudioContext();

        await this.loadAudioWorklets();

        this.master = new Master(
          this.audioContext,
          this.audioContext.destination
        );
        this.noise = new Noise(this.audioContext, this.master.node);
        this.oscA = new Oscillator(this.audioContext, this.master.node);
        this.oscB = new Oscillator(this.audioContext, this.master.node);

        UI.init();
      }

      loadAudioWorklets() {
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

        return Promise.all([
          new Worker("./audio-worklets/unison-detune.ts").promise,
          new Worker("./audio-worklets/white-noise.ts").promise,
        ]);
      }
    }

    class Master {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        this.node.connect(destinationNode);
      }

      get node() {
        return this.knob.gainNode;
      }

      readonly knob = new Knob(this.audioContext, "master");
    }

    class Oscillator {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        const maxCount = 16;
        for (let i = 0; i < maxCount; ++i) {
          const detuneNode = new AudioWorkletNode(
            audioContext,
            "unison-detune",
            {
              channelCount: 1,
              numberOfInputs: 0,
              numberOfOutputs: 2,
              parameterData: {
                index: i,
              },
            }
          );
          const oscNode = new OscillatorNode(this.audioContext, {
            type: "sawtooth",
            frequency: 0,
          });
          const blendNode = new GainNode(this.audioContext, {
            gain: 0,
          });
          this.detuneKnob.constantNode.connect(
            detuneNode.parameters.get("detune")!
          );
          this.blendKnob.constantNode.connect(
            detuneNode.parameters.get("blend")!
          );
          this.unisonKnob.constantNode.connect(
            detuneNode.parameters.get("count")!
          );
          detuneNode.connect(oscNode.detune, 0);
          detuneNode.connect(blendNode.gain, 1);
          this.frequencyKnob.constantNode.connect(oscNode.frequency);
          oscNode.connect(blendNode);
          blendNode.connect(this.levelKnob.gainNode);
          oscNode.start();
        }
        this.levelKnob.gainNode.connect(this.bypass.node);
      }

      readonly bypass = new Bypass(this.audioContext, this.destinationNode);

      readonly frequencyKnob = new Knob(this.audioContext, "frequency");
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

    export class Knob {
      constructor(readonly audioContext: AudioContext, readonly name: string) {
        this.constantNode.connect(this.gainNode.gain);
        this.constantNode.start();
        autorun(() => {
          this.constantNode.offset.value = this.value;
        });
      }

      @observable value = 0;

      readonly constantNode = new ConstantSourceNode(this.audioContext);

      readonly gainNode = new GainNode(this.audioContext, {
        gain: 0,
      });
    }
  }

  const state = new Audio.State();

  namespace UI {
    export function init() {
      ReactDOM.render(<UI.App />, document.getElementById("app"));
    }

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
          grid: "auto / auto 1fr auto",
          gridGap: 2,
        }}
      >
        <AppTitleSection />
        <HeaderSectionItem />
        <MasterSection />
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
            padding: "0 2em",
            fontSize: 24,
            letterSpacing: 3,
            fontWeight: "bold",
            textTransform: "uppercase",
            textShadow: "0 0 .5em var(--primary), 0 0 1em var(--primary)",
          }}
        >
          Salvation
        </h1>
      </HeaderSectionItem>
    );

    const MasterSection = () => (
      <HeaderSectionItem>
        <Knob knob={state.master.knob} />
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
    }: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & {
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
        onClick={() =>
          (state.noise.bypass.enabled = !state.noise.bypass.enabled)
        }
      >
        <Knob knob={state.noise.noiseLevelKnob} />
      </OscillatorSectionItem>
    ));

    const OscASection = observer(() => (
      <OscillatorSectionItem
        title="Osc A"
        style={{ gridArea: "a" }}
        enabled={!state.oscA.bypass.enabled}
        onClick={() => (state.oscA.bypass.enabled = !state.oscA.bypass.enabled)}
      >
        <Knob knob={state.oscA.blendKnob} />
        <Knob knob={state.oscA.detuneKnob} />
        <Knob knob={state.oscA.frequencyKnob} />
        <Knob knob={state.oscA.levelKnob} />
        <Knob knob={state.oscA.panKnob} />
        <Knob knob={state.oscA.phaseKnob} />
        <Knob knob={state.oscA.randKnob} />
        <Knob knob={state.oscA.unisonKnob} />
        <Knob knob={state.oscA.wtPosKnob} />
      </OscillatorSectionItem>
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

    const Knob = observer(({ knob }: { knob: Audio.Knob }) => (
      <label
        style={{
          display: "grid",
          placeItems: "center",
          padding: 8,
        }}
      >
        <input
          type="range"
          min={0}
          max={
            knob.name.includes("freq")
              ? 2000
              : knob.name.includes("detune")
              ? 100
              : knob.name.includes("unison")
              ? 16
              : 1
          }
          step={0.01}
          defaultValue={knob.value}
          onChange={(e) => (knob.value = Number(e.target.value))}
        />
        <p>
          {knob.name} ({knob.value})
        </p>
      </label>
    ));
  }
}
