import React from "react";
import ReactDOM from "react-dom";
import { observable, autorun } from "mobx";
import { observer } from "mobx-react";
import "mobx-react-lite/batchingForReactDom";

namespace Salvation {
  class State {
    constructor() {
      this.init();
    }

    audioContext!: AudioContext;

    async init() {
      this.audioContext = new AudioContext();
      await this.loadAudioWorklet();
      this.initMaster();
      this.initNoise();
      this.initUI();
    }

    loadAudioWorklet() {
      const { audioContext } = this;
      let promise!: Promise<void>;

      /**
       * This class is a hack to make Parcel replace URLs properly
       * and build the audio worklet file as if it was a web worker.
       * Parcel does some magic when it sees `new Worker("path/to/file")`.
       * Parcel logs an error at runtime but it doesn't cause any actual issue.
       */
      class Worker {
        constructor(url: string) {
          promise = audioContext.audioWorklet.addModule(url);
        }
      }

      new Worker("./audio.ts");

      return promise;
    }

    @observable masterLevel = 1;
    @observable masterGainNode!: GainNode;

    initMaster() {
      this.masterGainNode = new GainNode(this.audioContext);
      autorun(() => (this.masterGainNode.gain.value = this.masterLevel));
      this.masterGainNode.connect(this.audioContext.destination);
    }

    @observable noiseEnabled = false;
    @observable noiseLevel = 1;
    noiseNode!: AudioWorkletNode;
    noiseGainNode!: GainNode;

    initNoise() {
      this.noiseNode = new AudioWorkletNode(this.audioContext, "white-noise", {
        numberOfInputs: 0,
      });
      this.noiseGainNode = new GainNode(this.audioContext);
      autorun(
        () =>
          (this.noiseGainNode.gain.value =
            Number(this.noiseEnabled) * this.noiseLevel)
      );
      this.noiseNode.connect(this.noiseGainNode);
      this.noiseGainNode.connect(this.masterGainNode);
    }

    initUI() {
      ReactDOM.render(<Salvation.App />, document.getElementById("app"));
    }
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
      enabled={state.noiseEnabled}
      onClick={() => (state.noiseEnabled = !state.noiseEnabled)}
    ></OscillatorSectionItem>
  ));

  const OscASection = () => (
    <OscillatorSectionItem
      title="Osc A"
      style={{ gridArea: "a" }}
    ></OscillatorSectionItem>
  );

  const OscBSection = () => (
    <OscillatorSectionItem
      title="Osc B"
      style={{ gridArea: "b" }}
    ></OscillatorSectionItem>
  );

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
