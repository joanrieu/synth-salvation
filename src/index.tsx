import React from "react";
import ReactDOM from "react-dom";

namespace Salvation {
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
        grid: "2fr 3fr / 2fr 5fr 5fr 4fr",
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
    style,
    ...props
  }: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLElement>,
    HTMLElement
  >) => (
    <section
      style={{
        padding: 8,
        backgroundColor: "#666",
        border: "1px solid #888",
        ...style,
      }}
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

  const NoiseSection = () => (
    <OscillatorSectionItem
      title="Noise"
      style={{ gridArea: "n" }}
    ></OscillatorSectionItem>
  );

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

ReactDOM.render(<Salvation.App />, document.getElementById("app"));
