## Before Writing useEffect

Every time you are about to write a `useEffect`, stop and answer this question:

**Is this syncing with an external system?**

External systems: WebSocket, browser APIs (`IntersectionObserver`, `navigator.onLine`), third-party libraries (map SDKs, chart widgets), DOM measurements, `setInterval` timers.

NOT external systems: props, state, values derived from props or state, user events (clicks, form submissions).

If the answer is no, do NOT write the effect. Walk the decision tree below to find the right alternative — each case links the rule file carrying the incorrect/correct example.

## Decision Tree

Check each case in order:

1. **Transforming or deriving data?** Compute it during render — no state, no effect. [rerender-derived-state-no-effect.md](rerender-derived-state-no-effect.md)
2. **Responding to a user event?** Put the logic in the event handler; effects respond to renders, not actions. [rerender-move-effect-to-event.md](rerender-move-effect-to-event.md)
3. **Resetting state when a prop changes?** Pass a `key` from the parent so React remounts with fresh state. [effects-reset-state-with-key.md](effects-reset-state-with-key.md)
4. **Fetching data?** Use TanStack Query. If an effect is unavoidable, guard against stale responses with a cleanup flag. [effects-fetch-race-condition.md](effects-fetch-race-condition.md)
5. **Notifying a parent component?** Call the parent's callback in the event handler, alongside `setState` — React batches both into one render. [effects-notify-parent-in-handler.md](effects-notify-parent-in-handler.md)
6. **Chaining effects that set state?** Move the cascade into the handler that started it and derive the rest during render. [effects-no-chains.md](effects-no-chains.md)
7. **Subscribing to an external store?** Use `useSyncExternalStore`, not hand-wired listeners. [effects-use-sync-external-store.md](effects-use-sync-external-store.md)

## When useEffect IS correct

If none of the above cases apply and the answer to "Is this an external system?" is genuinely **yes**, then `useEffect` is the right tool. Examples:

- WebSocket connections (open on mount, close on unmount)
- Third-party widget initialization (map SDKs, rich text editors)
- DOM measurements (`useLayoutEffect` for pre-paint, `useEffect` for post-paint)
- Browser API subscriptions with cleanup (`IntersectionObserver`, `ResizeObserver`)

When writing a valid effect:

- **Name the function** for readability: `useEffect(function connectToChat() { ... })`
- **Always return a cleanup function** when subscribing or connecting
- **List all dependencies** the effect reads from
- **Use `useLayoutEffect`** when measuring the DOM to avoid visual flicker

## Per-rule references

| Whenever you deal with a...                                    | Read                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| value computable from existing state/props                     | [rerender-derived-state-no-effect.md](rerender-derived-state-no-effect.md) |
| interaction logic sitting in an effect                         | [rerender-move-effect-to-event.md](rerender-move-effect-to-event.md)       |
| fetch in an effect (races, stale responses)                    | [effects-fetch-race-condition.md](effects-fetch-race-condition.md)         |
| effect setting state that triggers another effect              | [effects-no-chains.md](effects-no-chains.md)                               |
| state reset when a prop changes                                | [effects-reset-state-with-key.md](effects-reset-state-with-key.md)         |
| `onChange`-style callback to a parent                          | [effects-notify-parent-in-handler.md](effects-notify-parent-in-handler.md) |
| subscription to a store outside React                          | [effects-use-sync-external-store.md](effects-use-sync-external-store.md)   |
| callback in a dependency array re-running the effect           | [effects-effect-event.md](effects-effect-event.md)                         |
| effect event (`useEffectEvent`) near a dependency array        | [effects-effect-event-deps.md](effects-effect-event-deps.md)               |
| handler prop re-subscribing an effect                          | [effects-event-handler-refs.md](effects-event-handler-refs.md)             |
| app-wide initialization in a mount effect                      | [effects-init-once.md](effects-init-once.md)                               |
