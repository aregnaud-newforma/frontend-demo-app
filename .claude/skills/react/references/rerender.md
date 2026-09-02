## Prevent unnecessary re-render

Structural wins first — where state lives decides what re-renders. Reach for
these before any memoization:

1. **Colocation (move state down).** State declared in a big component
   re-renders everything it returns; move it into a small component wrapping
   only what reads it.
   [rerender-move-state-down.md](rerender-move-state-down.md)
2. **Children as props.** `children` is created in the **parent's** scope,
   before it is passed down. When the stateful wrapper updates, that element
   is the same reference React saw last render, so React skips it.
   [rerender-children-as-props.md](rerender-children-as-props.md)
3. **Elements as props.** Same mechanism through a named prop (`content`,
   `footer`, `icon`) when the wrapper needs more than one slot. Shape and
   trade-offs: [patterns.md](patterns.md)

## Memoization

### Before you use memoization

#### If React Compiler activated

By default, React Compiler will memoize the code based on its analysis and heuristics.
Only reaching for useMemo() and useCallback() and React.Memo as an escape hatch when you need explicit, precise control.

#### If React Compiler isn't activated

The benefits are negligible in most cases; React is highly optimized. You should only rely on memoization as a performance optimization.

In practice, you can make a lot of memoization unnecessary by following a few principles:

- When a component visually wraps other components, **let it accept JSX as children**. This way, when the wrapper component updates its own state, React knows that its children don't need to re-render.
- **Prefer to colocate state and don't lift state up any further than necessary**. For example, don't keep transient state like forms and whether an item is hovered at the top of your tree or in a global state library.
- **Keep your rendering logic pure**. If re-rendering a component causes a problem or produces some noticeable visual artifact, it's a bug in your component! Fix the bug instead of adding memoization.
- **Avoid unnecessary Effects that update state**. Most performance problems in React apps are caused by chains of updates originating from Effects that cause your components to render over and over.
- **Try to remove unnecessary dependencies from your Effects**. For example, instead of memoization, it's often simpler to move some object or a function inside an Effect or outside the component.

### React.memo

`React.memo` compares props with `Object.is`, so it only holds while every prop
stays referentially stable — one inline function, fresh object, or unmemoized
hook return silently defeats it. The four rules that keep it intact:
[rerender-memo-props-stability.md](rerender-memo-props-stability.md)

## Per-rule references

Routed by impact — structural wins (where state lives) before memoization and
scheduling tweaks.

| Impact     | Whenever you deal with a...                                    | Read                                                                             |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| HIGH       | stateful wrapper re-rendering its whole subtree                | [rerender-children-as-props.md](rerender-children-as-props.md)                   |
| HIGH       | state living higher than the components that read it           | [rerender-move-state-down.md](rerender-move-state-down.md)                       |
| HIGH       | component defined inside another component's body              | [rerender-no-inline-components.md](rerender-no-inline-components.md)             |
| HIGH       | slow data boundary — where to place `Suspense`                 | [async-suspense-boundaries.md](async-suspense-boundaries.md)                     |
| MEDIUM     | context or store value read higher than needed                 | [rerender-defer-reads.md](rerender-defer-reads.md)                               |
| MEDIUM     | subscription to a value only used derived                      | [rerender-derived-state.md](rerender-derived-state.md)                           |
| MEDIUM     | value computable from existing state/props                     | [rerender-derived-state-no-effect.md](rerender-derived-state-no-effect.md)       |
| MEDIUM     | `setState` reading the previous state                          | [rerender-functional-setstate.md](rerender-functional-setstate.md)               |
| MEDIUM     | expensive `useState` initial value                             | [rerender-lazy-state-init.md](rerender-lazy-state-init.md)                       |
| MEDIUM     | expensive subtree re-rendering with unchanged props            | [rerender-memo.md](rerender-memo.md)                                             |
| MEDIUM     | memoized component still re-rendering                          | [rerender-memo-props-stability.md](rerender-memo-props-stability.md)             |
| MEDIUM     | non-primitive default parameter on a memoized component        | [rerender-memo-with-default-value.md](rerender-memo-with-default-value.md)       |
| MEDIUM     | interaction logic sitting in an effect                         | [rerender-move-effect-to-event.md](rerender-move-effect-to-event.md)             |
| MEDIUM     | one hook computing several unrelated values                    | [rerender-split-combined-hooks.md](rerender-split-combined-hooks.md)             |
| MEDIUM     | urgent input blocked by a non-urgent update                    | [rerender-transitions.md](rerender-transitions.md)                               |
| MEDIUM     | expensive render derived from fast-changing input              | [rerender-use-deferred-value.md](rerender-use-deferred-value.md)                 |
| MEDIUM     | value that changes often but never affects output              | [rerender-use-ref-transient-values.md](rerender-use-ref-transient-values.md)     |
| MEDIUM     | show/hide of expensive subtrees                                | [rerender-activity.md](rerender-activity.md)                                     |
| LOW-MEDIUM | `useMemo` around a simple primitive expression                 | [rerender-simple-expression-in-memo.md](rerender-simple-expression-in-memo.md)   |
| LOW        | effect depending on a whole object when it reads one field     | [rerender-dependencies.md](rerender-dependencies.md)                             |
| LOW        | `&&`/ternary rendering that can leak `0` or `''`               | [rerender-conditional-render.md](rerender-conditional-render.md)                 |
| LOW        | static JSX recreated every render                              | [rerender-hoist-jsx.md](rerender-hoist-jsx.md)                                   |
| LOW        | manual `isLoading` state around an async update                | [rerender-usetransition-loading.md](rerender-usetransition-loading.md)           |
