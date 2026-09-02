---
title: Declare Component Props as a Named Type
impact: LOW
impactDescription: props shape is legible and referenceable
tags: typescript, react, props, types
---

## Declare Component Props as a Named Type

Declare a component's props as a named `type` above the component, called `<Component>Props`, and annotate the parameter with that name. The shape then reads on its own line, and a wrapper, a story, a test helper or an `Omit` has a name to point at.

**Incorrect (shape buried in the signature, unreferenceable):**

```tsx
export function Counter({
  children,
  initialCount = 0,
}: {
  children: ReactNode;
  initialCount?: number;
}) {}
```

**Correct (shape reads first, signature stays one line):**

```tsx
type CounterProps = {
  children: ReactNode;
  initialCount?: number;
};

export function Counter({ children, initialCount = 0 }: CounterProps) {}
```

Export `CounterProps` when something outside the file builds on it; keep it local otherwise.
