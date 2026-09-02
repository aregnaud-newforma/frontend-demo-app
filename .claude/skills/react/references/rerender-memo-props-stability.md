---
title: Keep Every Prop of a Memoized Component Stable
impact: MEDIUM
impactDescription: prevents silently broken memoization
tags: rerender, memo, useCallback, props
---

## Keep Every Prop of a Memoized Component Stable

`React.memo` compares props with `Object.is`. One prop that gets a new reference each render — an inline function, a fresh object, an unmemoized value returned by a hook — silently defeats the whole memoization. Four rules keep it intact:

**1. Every prop must be a primitive or persistent between renders.**

```tsx
const ChildMemo = memo(Child)

// Incorrect: onChange is recreated every render, ChildMemo always re-renders
const onChange = () => {}
return <ChildMemo onChange={onChange} />

// Correct
const onChange = useCallback(() => {}, [])
return <ChildMemo onChange={onChange} />
```

**2. Never spread props received from another component.**

```tsx
// Incorrect: any unstable value inside props breaks memoization invisibly
const Component = (props: Props) => <ChildMemo {...props} />

// Correct: pass named props so instability is visible at the call site
const Component = (props: Props) => <ChildMemo some={props.some} other={props.other} />
```

**3. Non-primitive props received from parents must be memoized at their source.** A `submit` created in a grandparent without `useCallback` breaks a `ChildMemo` two levels down.

**4. Watch non-primitive values returned by custom hooks.**

```tsx
// If useForm does not memoize submit internally, ChildMemo re-renders every time
const { submit } = useForm()
return <ChildMemo onChange={submit} />
```

**Note:** If your project has [React Compiler](https://react.dev/learn/react-compiler) enabled, it memoizes components and values automatically — do not write `memo`/`useCallback` by hand; these rules then only matter for escape hatches the compiler skips.
