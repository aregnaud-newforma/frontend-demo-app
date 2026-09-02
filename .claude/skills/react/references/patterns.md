## Before applying patterns

Every pattern here trades inversion of control for integration complexity. The more
control you hand to the consumer, the further the component moves from plug-and-play.

Before applying one, name the concrete problem it removes — the prop count, the drilled
prop, the mixed concern. No name, no pattern.

Sections run in increasing order of control handed over. Take the first one that solves
the problem you named, not the most powerful one.

## Component composition

### Children as props

```jsx
// Without composition - Heavy API, Props Drillings and bad Separation of Concerns
<Form
    name={name}
    age={age}
    address={address}
    onNameChange={setName}
    onAgeChange={setAge}
    onAddressChange={setAddress}
    onSubmit={handleSubmit}
/>

// With composition - Components structure have been flattened, Better reusability, and Separation of Concerns
<Form>
    <Content>
    <Input value={name} onChange={setName} />
    <Input type="number" value={age} onChange={setAge} />
    <Input value={address} onChange={setAddress} />
    </Content>
    <button onClick={handleSubmit} />
</Form>
```

This pattern also stops the wrapper's own state from re-rendering its children — see
`references/rerender.md`.

### Elements as props

Pass a ready-made element through a named prop when the wrapper needs more than one slot.

```jsx
// Without composition - Mix of concerns, the icon's API leaks into the Button's API
<>
  <Button size="md" appearance="primary" icon="home" iconSize="lg" />
  <Button size="lg" appearance="secondary" icon="plus" iconColor="blue" iconSize="lg" />
</>

// With composition - Clear Separation of Concerns, better flexibility
<>
  <Button icon={<HomeIcon />} />
  <Button icon={<PlusIcon size="lg" />} />
</>
```

The wrapper renders it as-is: `<div className={getClassName(...)}>{icon}</div>`.

Injecting defaults into the passed element needs `cloneElement`, and that is where the
pattern turns fragile: the wrapper silently overwrites props the consumer wrote, and
nothing in the types says which ones. React's own docs flag `cloneElement` as uncommon
and easy to get wrong. When the element needs values the wrapper holds, use render props.

### Render props

Reach for this when the slot has to react to state the **wrapper** owns — hover, open,
selection. An element passed as a prop is created before the wrapper renders, so it can
never see that state.

```jsx
// Without composition - icon was created by App, so isHovered can never reach it
<Button icon={<HomeIcon />} />;

// With composition - the wrapper hands its state to the consumer, who decides what to render
function App() {
  const iconHome = (props, state) =>
    state.isHovered ? <HomeIconHovered {...props} /> : <HomeIcon {...props} />;
  return (
    <>
      <Button renderIcon={iconHome} />
      <Button renderIcon={(props) => <HomeIcon {...props} size="lg" color="red" />} />
    </>
  );
}

const Button = ({ appearance, size, renderIcon }) => {
  const [isHovered, setIsHovered] = useState(false);
  const iconParams = {
    size: size === "large" ? "large" : "medium",
    color: appearance === "primary" ? "white" : "black",
  };
  return (
    <button onMouseOver={() => setIsHovered(true)}>
      Submit {renderIcon(iconParams, { isHovered })}
    </button>
  );
};
```

## Compound components

A parent owns the state and exposes its parts as sub-components. The consumer arranges
the parts; the parent never learns what the layout is.

Reach for it when a component's prop list has grown a section per child — `label`,
`hideLabel`, `max`, `incrementIcon`, `decrementIcon` — and each new child adds three more.
Order, presence and placement become the consumer's call instead of a `hideX` flag.

```jsx
// Without composition - every child's API is bolted onto the parent, then drilled down.
// Reordering or dropping a part means a new prop.
<Counter
  label="Counter"
  max={10}
  incrementIcon="plus"
  decrementIcon="minus"
  labelPosition="middle"
  onChange={handleChangeCounter}
/>

// With composition - the parent owns count, the consumer owns the layout
<Counter onChange={handleChangeCounter}>
  <Counter.Decrement icon="minus" />
  <Counter.Label>Counter</Counter.Label>
  <Counter.Count max={10} />
  <Counter.Increment icon="plus" />
</Counter>
```

The parts talk to the parent through context, so they work at any depth. Export a provider
and a hook, never the raw context — see `references/context.md`.

```jsx
const CounterContext = createContext(undefined);

function useCounterContext() {
  const context = useContext(CounterContext);
  if (context === undefined) {
    // a part rendered outside <Counter> fails here, not on an undefined read later
    throw new Error("useCounterContext must be used within a Counter");
  }
  return context;
}
```

```jsx
function Counter({ children, onChange, initialValue = 0 }) {
  const [count, setCount] = useState(initialValue);

  // notify the parent in the handler, not from an effect - see references/effects.md
  const handleIncrement = () => {
    const next = count + 1;
    setCount(next);
    onChange?.(next);
  };

  const handleDecrement = () => {
    const next = Math.max(0, count - 1);
    setCount(next);
    onChange?.(next);
  };

  return (
    <CounterContext.Provider value={{ count, handleIncrement, handleDecrement }}>
      <div className="counter">{children}</div>
    </CounterContext.Provider>
  );
}

function Count({ max }) {
  const { count } = useCounterContext();
  return <div className={count >= max ? "count error" : "count"}>{count}</div>;
}

function Increment({ icon = "plus" }) {
  const { handleIncrement } = useCounterContext();
  return <button onClick={handleIncrement}>{icon}</button>;
}

// Decrement mirrors Increment. Label reads nothing from context -
// it is a part by convention, not by need.

Counter.Count = Count;
Counter.Label = Label;
Counter.Increment = Increment;
Counter.Decrement = Decrement;
```

The cost: the consumer can now render an invalid arrangement — two counts, no increment,
a part outside its parent. The thrown error in `useCounterContext` is what keeps the last
case cheap to diagnose. Every consumer also writes more markup for the default case, so
this only pays off when the arrangement genuinely varies between call sites.

## Control props

The component keeps its own state by default, but lets the consumer take it over by
passing `value` + `onChange` — the same contract as a native `<input>`.

Reach for it when a call site needs to do something the component's internal state cannot
express: seed the value from elsewhere, clamp or reject a change, keep two widgets in
sync, or drive it from a store. Without it, the consumer's only escape is a `key` remount
or a `ref` hack.

```jsx
// Uncontrolled - the component owns count, the consumer just watches
<Counter onChange={handleChangeCounter}>
  <Counter.Count max={10} />
  <Counter.Increment />
</Counter>;

// Controlled - the consumer owns count, and can refuse or transform a change
const [count, setCount] = useState(0);

<Counter value={count} onChange={(next) => setCount(Math.min(next, 10))}>
  <Counter.Count max={10} />
  <Counter.Increment />
</Counter>;
```

Only `Counter` changes — the parts keep reading `count` from context and know nothing
about who owns it.

```jsx
function Counter({ children, value, initialValue = 0, onChange }) {
  const [internalCount, setInternalCount] = useState(initialValue);

  // `value` present means the consumer drives it, exactly like a native input
  const isControlled = value !== undefined;
  const count = isControlled ? value : internalCount;

  const setCount = (next) => {
    // never setState when controlled - the consumer's state is the only source of truth
    if (!isControlled) setInternalCount(next);
    onChange?.(next);
  };

  const handleIncrement = () => setCount(count + 1);
  const handleDecrement = () => setCount(Math.max(0, count - 1));

  return (
    <CounterContext.Provider value={{ count, handleIncrement, handleDecrement }}>
      <div className="counter">{children}</div>
    </CounterContext.Provider>
  );
}
```

Rules that make it safe:

- **One source of truth per render.** When controlled, `internalCount` is dead — read it
  and the two will drift.
- **`value` without `onChange` freezes the component** — the same trap as a controlled
  `<input>` with no handler. There is no internal state left to fall back on.

The cost: every call site now has to know which mode it is in, and the component carries
both paths forever. Ship it uncontrolled, and add `value` when a real call site needs it.

## Custom hook as public API

The component ships a hook next to it,
the consumer calls the hook and wires the result into the parts themselves.

This is about **publishing your internals as API** — distinct from extracting a hook for
your own reuse, which `references/hooks.md` owns. Reach for it only when consumers need to
drive the component from outside its markup: an external button, a keyboard shortcut, a
reset from a parent form. If they only need to read or override the value, control props
above is far cheaper.

```jsx
function useCounter(initialCount = 0) {
  const [count, setCount] = useState(initialCount);

  const handleIncrement = () => setCount((prev) => prev + 1);
  const handleDecrement = () => setCount((prev) => Math.max(0, prev - 1));

  return { count, handleIncrement, handleDecrement };
}
```

`Counter` drops to `({ children, value })` — it provides `count` and nothing else. The
parts stop reading handlers from context and take `onClick` / `disabled` as props.

The consumer owns the rules, and can drive the same state from anywhere on the page:

```jsx
function App() {
  const { count, handleIncrement, handleDecrement } = useCounter(0);
  const MAX_COUNT = 10;

  // the clamp lives here now - the component has no opinion about it
  const handleClickIncrement = () => {
    if (count < MAX_COUNT) handleIncrement();
  };

  return (
    <>
      <Counter value={count}>
        <Counter.Decrement onClick={handleDecrement} disabled={count === 0} />
        <Counter.Count />
        <Counter.Increment onClick={handleClickIncrement} disabled={count === MAX_COUNT} />
      </Counter>

      {/* same state, driven from outside the component entirely */}
      <button onClick={handleClickIncrement} disabled={count === MAX_COUNT}>
        Increment from anywhere
      </button>
    </>
  );
}
```

The cost is the steepest in this file, and it is not the hook — it is the wiring. Every
call site must now know which handler belongs on which part; forget one `onClick` and that
button silently does nothing. The logic and the markup are separate pieces the consumer
has to keep in sync, so a change to either one is a change at every call site.

Ship this only alongside the plug-and-play component, never instead of it — export both
`useCounter` and a `Counter` that calls it internally, so the common case stays one line.
