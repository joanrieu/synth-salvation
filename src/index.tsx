import { autorun, observable, when } from "mobx";
import { observer } from "mobx-react";
import "mobx-react-lite/batchingForReactDom";
import React, { ReactChild, ReactChildren, CSSProperties } from "react";
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
      readonly wtPosKnob = new Knob(this.audioContext, "wt pos");
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
      <HeaderSectionItem
        style={{
          backgroundImage:
            "linear-gradient(0deg, var(--primary) -700%, transparent 200%)",
        }}
      >
        <h1
          style={{
            padding: "0 1em",
            fontSize: 40,
            textShadow: [
              "0 0 .5em var(--primary)",
              "0 0 1em var(--primary)",
              "1px 1px 1px black",
            ].join(),
          }}
        >
          Salvation
        </h1>
      </HeaderSectionItem>
    );

    const MasterSection = () => (
      <HeaderSectionItem>
        <Knob knob={state.master.knob} style={{ padding: 8 }} />
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
        <div
          style={{
            gridRow: "1 / span 2",
            gridColumn: "1 / span 4",
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(transparent 50%, rgba(0, 0, 0, .1), rgba(0, 0, 0, .3))",
          }}
        ></div>
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
          <Checkbox enabled={enabled} />
          <h2
            style={{
              fontSize: 11,
              lineHeight: 0,
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gridGap: 8,
            margin: "8px 0",
          }}
        >
          <Knob knob={state.oscA.unisonKnob} />
          <Knob knob={state.oscA.detuneKnob} />
          <Knob knob={state.oscA.blendKnob} />

          <Knob knob={state.oscA.phaseKnob} />
          <Knob knob={state.oscA.randKnob} />

          <Knob knob={state.oscA.wtPosKnob} />

          <Knob knob={state.oscA.levelKnob} />
          <Knob knob={state.oscA.panKnob} />

          <Knob knob={state.oscA.frequencyKnob} />
        </div>
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
      <section style={{ backgroundColor: "#222" }}></section>
    );

    const KeyboardSection = () => (
      <section style={{ backgroundColor: "#222" }}></section>
    );

    const Checkbox = ({ enabled }: { enabled: boolean }) => (
      <div
        style={{
          width: 10,
          height: 10,
          border: "1px solid #ccc",
          backgroundColor: enabled ? "var(--primary)" : "#333",
        }}
      />
    );

    const Knob = observer(
      ({
        knob,
        style,
        ...props
      }: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
      > & { knob: Audio.Knob }) => {
        const Circle = ({
          children,
          style,
          ...props
        }: React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLDivElement>,
          HTMLDivElement
        >) => (
          <div
            style={{
              gridRow: 1,
              gridColumn: 1,
              display: "grid",
              placeItems: "start center",
              width: "100%",
              height: "100%",
              borderRadius: "100%",
              ...style,
            }}
            {...props}
          >
            {children}
          </div>
        );

        const Pointer = () => (
          <div
            style={{
              width: 2,
              height: 10,
              marginTop: 1,
              background: "#eee",
              backgroundImage:
                "linear-gradient(var(--primary) 20%, #333 20%, #333 40%, transparent 40%)",
            }}
          ></div>
        );

        const Label = ({ children }: { children: React.ReactNode }) => (
          <div
            style={{
              background: "#444",
              border: "1px solid #777",
              borderRadius: 2,
              textTransform: "uppercase",
              fontSize: 9,
              padding: "2px 4px",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
          >
            {children}
          </div>
        );

        const dragKnob = () => {
          const listener = (event: MouseEvent) => {
            const delta = -event.movementY / 200;
            knob.value = Math.max(0, Math.min(1, knob.value + delta));
            if (event.type === "mouseup") {
              window.removeEventListener("mousemove", listener);
            }
          };
          window.addEventListener("mousemove", listener);
          window.addEventListener("mouseup", listener, { once: true });
        };

        return (
          <div
            style={{
              display: "grid",
              gridGap: 4,
              placeItems: "center",
              ...style,
            }}
            {...props}
          >
            <Circle
              style={{
                width: 32,
                height: 32,
                boxShadow: "2px 4px 8px rgba(0, 0, 0, .5)",
              }}
              onMouseDown={dragKnob}
            >
              <Circle
                style={{
                  border: "3px solid #222",
                }}
              >
                <Circle
                  style={{
                    border: "1px solid #555",
                    backgroundImage: "radial-gradient(#444, #222)",
                  }}
                />
              </Circle>
              <Circle
                style={{
                  transform:
                    "rotate(" + ((knob.value - 0.5) * 270).toFixed(0) + "deg)",
                }}
              >
                <Pointer />
              </Circle>
            </Circle>
            <Label>{knob.name}</Label>
          </div>
        );
      }
    );
  }
}
