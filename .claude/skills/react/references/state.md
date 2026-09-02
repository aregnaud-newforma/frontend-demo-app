## Type of state

Ask in this order. The first match is the category.

| Ask                                                                      | If yes                          | Tool                  | For example                             |
| ------------------------------------------------------------------------ | ------------------------------- | --------------------- | --------------------------------------- |
| Does a backend own the truth?                                            | **Server state**                | TanStack Query        | Account record, search results          |
| Should it survive a refresh or travel in a shared link?                  | **URL state**                   | nuqs                  | Filter, sort, page number, active tab   |
| Is it session configuration the whole app reads?                         | **Global state**                | React Context         | Signed-in user, theme, language         |
| Is it client-only, shared across distant components, and changing often? | **Complex shared client state** | Zustand or Redux      | Unsaved draft, canvas selection, toasts |
| Otherwise                                                                | **UI state**                    | `useState`, colocated | Dialog open, expanded row, hover        |

`package.json` says which of the tools named in this file the repo actually has.
Before reaching for one, check it is there; when it is missing, ask the user
whether to install it (Recommended) and wait for the answer before writing the state.

Never copy server state into client state with an effect — store only the user's
choice and derive the default:
[rerender-derived-state-no-effect.md](rerender-derived-state-no-effect.md)

## Where to put React State

Decision procedure for choosing where a piece of state should live.
Before writing state, check where the state should live based on the decision flow.
Re-run it whenever requirements change.

### Decision rules

1. Start every piece of state as local `useState`.
2. Is it used by only this component? -> **Leave It** where it is.
3. Used by only one child? -> **Colocate State**: move it down into that child.
4. Used by a sibling or the parent? -> **Lift State**: move it to the closest common parent.
5. Once state lives in a parent, is there a prop-drilling problem?
   - No -> **Ship It**.
   - Yes, and the child can function outside the parent -> **Move State to Context Provider**.
   - Yes, but the child cannot function outside the parent -> **Use Component Composition**.
6. When requirements change, start the procedure again from the top.

### Actions reference

- **Colocate State** - Move state to that specific child. Removes the need to pass it around.
- **Lift State** - Move state to the parent. State can be passed down via props or composition (as way to avoid props drilling).
- **Component Composition** - Move state to the parent, and pass it deep down using `{props.children}`.
- **Context Provider** - Put the state in a context provider and render it where the state was managed.

## Updating state

Always update state immutably. When an immutable update gets awkward — deep
nesting, duplicated objects, several setters per transition — the problem is the
state's shape; the structure rules below fix it.

## useState or useReducer ?

`useState` for independent pieces of state; `useReducer` when several pieces
must change together as one transition (loading + error + data), so impossible
combinations have nowhere to come from.
[state-usereducer-dependent.md](state-usereducer-dependent.md)

## Per-rule references

| Whenever you deal with a...                      | Read                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| object stored in state that also lives in a list | [state-no-duplication.md](state-no-duplication.md)             |
| booleans that can contradict each other          | [state-no-impossible-states.md](state-no-impossible-states.md) |
| several `setState` calls per transition          | [state-usereducer-dependent.md](state-usereducer-dependent.md) |
| deeply nested state object                       | [state-flat-structure.md](state-flat-structure.md)             |
| several state values always updated together     | [state-group-related.md](state-group-related.md)               |
