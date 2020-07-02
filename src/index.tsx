import { autorun, observable } from "mobx";
import { observer } from "mobx-react";
import "mobx-react-lite/batchingForReactDom";
import React, { useRef, useLayoutEffect } from "react";
import ReactDOM from "react-dom";

namespace Salvation {
  namespace Audio {
    export class State {
      constructor() {
        this.init();
      }

      audioContext!: AudioContext;
      master!: Master;
      filter!: Filter;
      sub!: Sub;
      noise!: Noise;
      oscA!: Oscillator;
      oscB!: Oscillator;

      waveA: Wave = new SineWave();
      waveB: Wave = new SineWave();

      async init() {
        // TODO handle context creation failure
        this.audioContext = new AudioContext();

        await this.loadAudioWorklets();

        this.master = new Master(
          this.audioContext,
          this.audioContext.destination
        );
        this.filter = new Filter(this.audioContext, this.master.node);
        this.sub = new Sub(this.audioContext, this.filter.inputNode);
        this.noise = new Noise(this.audioContext, this.filter.inputNode);
        this.oscA = new Oscillator(this.audioContext, this.filter.inputNode);
        this.oscB = new Oscillator(this.audioContext, this.filter.inputNode);

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
          new Worker("./audio-worklets/unison.ts").promise,
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

    export class Oscillator {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        const maxVoices = 16;
        for (let i = 0; i < maxVoices; ++i) {
          const unisonNode = new AudioWorkletNode(audioContext, "unison", {
            channelCount: 1,
            numberOfInputs: 0,
            numberOfOutputs: 2,
            parameterData: {
              index: i,
            },
          });
          const oscNode = new OscillatorNode(this.audioContext, {
            type: "sawtooth",
            frequency: 0,
          });
          const blendNode = new GainNode(this.audioContext, {
            gain: 0,
          });
          this.detuneKnob.constantNode.connect(
            unisonNode.parameters.get("detune")!
          );
          this.blendKnob.constantNode.connect(
            unisonNode.parameters.get("blend")!
          );
          this.voicesKnob.constantNode.connect(
            unisonNode.parameters.get("voices")!
          );
          unisonNode.connect(oscNode.detune, 0);
          unisonNode.connect(blendNode.gain, 1);
          this.frequencyKnob.constantNode.connect(oscNode.frequency);
          oscNode.connect(blendNode);
          blendNode.connect(this.levelKnob.gainNode);
          oscNode.start();
        }
        this.levelKnob.gainNode.connect(this.bypass.inputNode);
      }

      readonly bypass = new Bypass(this.audioContext, this.destinationNode);
      readonly frequencyKnob = new Knob(this.audioContext, "frequency", 440);
      readonly voicesKnob = new Knob(this.audioContext, "voices", 1);
      readonly detuneKnob = new Knob(this.audioContext, "detune");
      readonly blendKnob = new Knob(this.audioContext, "blend");
      readonly phaseKnob = new Knob(this.audioContext, "phase");
      readonly randKnob = new Knob(this.audioContext, "rand");
      readonly wtPosKnob = new Knob(this.audioContext, "wt pos");
      readonly panKnob = new Knob(this.audioContext, "pan");
      readonly levelKnob = new Knob(this.audioContext, "level");
    }

    class Sub {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        const oscNode = new OscillatorNode(audioContext);
        oscNode.frequency.value = 0;
        this.frequencyKnob.constantNode.connect(oscNode.frequency);
        oscNode.connect(this.levelKnob.gainNode);
        this.levelKnob.gainNode.connect(this.bypass.inputNode);
        oscNode.start();
      }

      readonly bypass = new Bypass(this.audioContext, this.destinationNode);
      readonly frequencyKnob = new Knob(this.audioContext, "frequency");
      readonly panKnob = new Knob(this.audioContext, "pan");
      readonly levelKnob = new Knob(this.audioContext, "level");
    }

    class Noise {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        const noiseNode = new AudioWorkletNode(
          this.audioContext,
          "white-noise",
          {
            numberOfInputs: 0,
          }
        );
        noiseNode.connect(this.levelKnob.gainNode);
        this.levelKnob.gainNode.connect(this.bypass.inputNode);
      }

      readonly bypass = new Bypass(this.audioContext, this.destinationNode);
      readonly phaseKnob = new Knob(this.audioContext, "phase");
      readonly randKnob = new Knob(this.audioContext, "rand");
      readonly pitchKnob = new Knob(this.audioContext, "pitch");
      readonly panKnob = new Knob(this.audioContext, "pan");
      readonly levelKnob = new Knob(this.audioContext, "level");
    }

    class Filter {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        this.inputNode.connect(this.bypass.passthroughInputNode);
        const lpfNode = new BiquadFilterNode(audioContext, { type: "lowpass" });
        this.inputNode.connect(lpfNode);
        lpfNode.frequency.value = 0;
        this.cutoffKnob.constantNode.connect(lpfNode.frequency);
        lpfNode.Q.value = 0;
        this.resKnob.constantNode.connect(lpfNode.Q);
        lpfNode.connect(this.mixKnob.gainNode);
        this.mixKnob.gainNode.connect(this.bypass.inputNode);

        const reverseMixNode = new GainNode(audioContext, { gain: 1 });
        this.inputNode.connect(reverseMixNode);
        reverseMixNode.connect(this.bypass.inputNode);
        const oppositeNode = new GainNode(audioContext, { gain: -1 });
        this.mixKnob.constantNode.connect(oppositeNode);
        oppositeNode.connect(reverseMixNode.gain);
      }

      readonly bypass = new Bypass(this.audioContext, this.destinationNode);
      readonly inputNode = new GainNode(this.audioContext);
      readonly cutoffKnob = new Knob(this.audioContext, "cutoff");
      readonly resKnob = new Knob(this.audioContext, "res");
      readonly panKnob = new Knob(this.audioContext, "pan");
      readonly driveKnob = new Knob(this.audioContext, "drive");
      readonly fatKnob = new Knob(this.audioContext, "fat");
      readonly mixKnob = new Knob(this.audioContext, "mix");
    }

    export class Bypass {
      constructor(
        readonly audioContext: AudioContext,
        readonly destinationNode: AudioNode
      ) {
        this.inputNode.connect(destinationNode);
        this.passthroughInputNode.connect(destinationNode);
        autorun(() => {
          this.passthroughInputNode.gain.value = Number(this.enabled);
          this.inputNode.gain.value = Number(!this.enabled);
        });
      }

      @observable enabled = true;
      readonly passthroughInputNode = new GainNode(this.audioContext);
      readonly inputNode = new GainNode(this.audioContext);
    }

    export class Knob {
      constructor(
        readonly audioContext: AudioContext,
        readonly name: string,
        defaultValue = 0
      ) {
        this.value = defaultValue;
        this.constantNode.connect(this.gainNode.gain);
        this.constantNode.start();
        autorun(() => {
          this.constantNode.offset.value = this.value;
        });
      }

      @observable value: number;

      readonly constantNode = new ConstantSourceNode(this.audioContext);

      readonly gainNode = new GainNode(this.audioContext, {
        gain: 0,
      });
    }

    export abstract class Wave {
      get(t: number) {
        return 0;
      }
    }

    export class SineWave extends Wave {
      get(t: number) {
        return Math.sin(t * 2 * Math.PI);
      }
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

    const OscillatorSectionItem = observer(
      ({
        title,
        bypass,
        children,
        style,
        ...props
      }: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        bypass: Audio.Bypass;
      }) => (
        <section
          style={{
            padding: 8,
            backgroundColor: "#666",
            border: "1px solid #888",
            display: "grid",
            gridTemplateRows: "auto 1fr",
            ...style,
          }}
          {...props}
        >
          <header
            style={{
              padding: 4,
              marginBottom: 4,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gridGap: 8,
              placeItems: "center left",
              background: "#555",
              border: "1px solid #777",
              borderRadius: 4,
            }}
            onClick={() => (bypass.enabled = !bypass.enabled)}
          >
            <Checkbox enabled={!bypass.enabled} />
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
          {React.Children.only(children)}
        </section>
      )
    );

    const SubOscillatorSection = observer(() => (
      <OscillatorSectionItem
        title="Sub"
        bypass={state.sub.bypass}
        style={{ gridArea: "s" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridGap: 8,
            margin: "8px 0",
          }}
        >
          <Knob knob={state.sub.frequencyKnob} />
          <Knob knob={state.sub.panKnob} />
          <Knob knob={state.sub.levelKnob} />
        </div>
      </OscillatorSectionItem>
    ));

    const NoiseSection = observer(() => (
      <OscillatorSectionItem
        title="Noise"
        bypass={state.noise.bypass}
        style={{ gridArea: "n" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridGap: 8,
            margin: "8px 0",
          }}
        >
          <Knob knob={state.noise.phaseKnob} />
          <Knob knob={state.noise.randKnob} />
          <Knob knob={state.noise.pitchKnob} />
          <Knob knob={state.noise.panKnob} />
          <Knob knob={state.noise.levelKnob} />
        </div>
      </OscillatorSectionItem>
    ));

    const OscASection = observer(() => (
      <OscillatorSectionItem
        title="Osc A"
        bypass={state.oscA.bypass}
        style={{ gridArea: "a" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr auto",
          }}
        >
          <WavePanel wave={state.waveA} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gridGap: 8,
              margin: "8px 0",
            }}
          >
            <LcdPanel knob={state.oscA.voicesKnob} min={1} max={16} />
            <Knob knob={state.oscA.detuneKnob} />
            <Knob knob={state.oscA.blendKnob} />

            <Knob knob={state.oscA.phaseKnob} />
            <Knob knob={state.oscA.randKnob} />

            <Knob knob={state.oscA.wtPosKnob} />

            <Knob knob={state.oscA.levelKnob} />
            <Knob knob={state.oscA.panKnob} />

            <Knob knob={state.oscA.frequencyKnob} />
          </div>
        </div>
      </OscillatorSectionItem>
    ));

    const OscBSection = observer(() => (
      <OscillatorSectionItem
        title="Osc B"
        bypass={state.oscB.bypass}
        style={{ gridArea: "b" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr auto",
          }}
        >
          <WavePanel wave={state.waveB} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gridGap: 8,
              margin: "8px 0",
            }}
          >
            <LcdPanel knob={state.oscB.voicesKnob} min={1} max={16} />
            <Knob knob={state.oscB.detuneKnob} />
            <Knob knob={state.oscB.blendKnob} />

            <Knob knob={state.oscB.phaseKnob} />
            <Knob knob={state.oscB.randKnob} />

            <Knob knob={state.oscB.wtPosKnob} />

            <Knob knob={state.oscB.levelKnob} />
            <Knob knob={state.oscB.panKnob} />

            <Knob knob={state.oscB.frequencyKnob} />
          </div>
        </div>
      </OscillatorSectionItem>
    ));

    const FilterSection = () => (
      <OscillatorSectionItem
        title="Filter"
        bypass={state.filter.bypass}
        style={{ gridArea: "f" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr auto",
          }}
        >
          <FilterPanel />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridGap: 8,
              margin: "8px 0",
            }}
          >
            <Knob knob={state.filter.cutoffKnob} />
            <Knob knob={state.filter.resKnob} />
            <Knob knob={state.filter.panKnob} />
            <Knob knob={state.filter.driveKnob} />
            <Knob knob={state.filter.fatKnob} />
            <Knob knob={state.filter.mixKnob} />
          </div>
        </div>
      </OscillatorSectionItem>
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
              fontSize: 7,
              padding: "1px 4px",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
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

    const LcdPanel = observer(
      ({ knob, min, max }: { knob: Audio.Knob; min: number; max: number }) => {
        const Button = ({
          children,
          style,
          ...props
        }: React.DetailedHTMLProps<
          React.ButtonHTMLAttributes<HTMLButtonElement>,
          HTMLButtonElement
        >) => (
          <button
            style={{
              gridArea: "u",
              padding: "0 4px",
              background: "#555",
              border: "none",
              color: "#ccc",
              ...style,
            }}
            {...props}
          >
            {children}
          </button>
        );

        return (
          <div
            style={{
              display: "grid",
              placeItems: "center stretch",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateRows: "1fr 1fr",
                gridTemplateColumns: "1fr auto",
                gridTemplateAreas: '"n u" "n d"',
                background: "#222",
                padding: 1,
                gridGap: 1,
                fontSize: 10,
              }}
            >
              <div style={{ gridArea: "n", placeSelf: "center", fontSize: 14 }}>
                {knob.value}
              </div>
              <Button
                style={{ gridArea: "u" }}
                onClick={() => (knob.value = Math.min(max, knob.value + 1))}
              >
                +
              </Button>
              <Button
                style={{ gridArea: "d" }}
                onClick={() => (knob.value = Math.max(min, knob.value - 1))}
              >
                -
              </Button>
            </div>
          </div>
        );
      }
    );

    const WavePanel = ({ wave }: { wave: Audio.Wave }) => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);

      useLayoutEffect(() => {
        requestAnimationFrame(() => {
          const ctx = canvasRef.current!.getContext("2d")!;
          let {
            clientWidth: width,
            clientHeight: height,
          } = ctx.canvas.parentElement!;
          ctx.canvas.width = width;
          ctx.canvas.height = height;
          ctx.clearRect(0, 0, width, height);

          ctx.translate(width / 2, height / 2);
          ctx.scale(0.95, height / width);
          ctx.translate(-width / 2, -height / 2);

          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          for (let t = 0; t <= 1; t += 1e-3) {
            ctx.lineTo(width * t, (height / 2) * (1 + wave.get(t)));
          }
          ctx.lineTo(width, height / 2);

          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, "#9c3fe755");
          gradient.addColorStop(0.5, "#9c3fe711");
          gradient.addColorStop(1, "#9c3fe755");
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.lineWidth = 2;
          ctx.strokeStyle = "#9c3fe7";
          ctx.stroke();
        });
      }, [canvasRef]);

      return (
        <div
          style={{
            background: "#333",
            border: "2px solid #111",
            boxShadow: "0 0 1px white",
            borderRadius: 2,
            display: "flex",
            overflow: "hidden",
          }}
        >
          <canvas ref={canvasRef} style={{ flex: 1 }} />
        </div>
      );
    };

    const FilterPanel = () => (
      <div
        style={{
          background: "#333",
          border: "2px solid #111",
          boxShadow: "0 0 1px white",
          borderRadius: 2,
        }}
      ></div>
    );
  }
}
