import React, { ReactChildren } from "react";
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
    style,
    ...props
  }: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLElement>,
    HTMLElement
  >) => (
    <section
      style={{
        backgroundColor: "#777",
        border: "1px solid #999",
        ...style,
      }}
    >
      {children}
    </section>
  );

  const SubOscillatorSection = () => (
    <OscillatorSectionItem style={{ gridArea: "s" }}>
      SubOscillatorSection
    </OscillatorSectionItem>
  );

  const NoiseSection = () => (
    <OscillatorSectionItem style={{ gridArea: "n" }}>
      NoiseSection
    </OscillatorSectionItem>
  );

  const OscASection = () => (
    <OscillatorSectionItem style={{ gridArea: "a" }}>
      OscASection
    </OscillatorSectionItem>
  );

  const OscBSection = () => (
    <OscillatorSectionItem style={{ gridArea: "b" }}>
      OscBSection
    </OscillatorSectionItem>
  );

  const FilterSection = () => (
    <OscillatorSectionItem style={{ gridArea: "f" }}>
      FilterSection
    </OscillatorSectionItem>
  );

  const ModulationSection = () => (
    <section style={{ backgroundColor: "#222" }}>ModulationSection</section>
  );

  const KeyboardSection = () => (
    <section style={{ backgroundColor: "#222" }}>KeyboardSection</section>
  );
}

ReactDOM.render(<Salvation.App />, document.getElementById("app"));
