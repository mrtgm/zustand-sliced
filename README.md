# zustand-sliced

Namespaced slices for [zustand](https://github.com/pmndrs/zustand). Scoped `set`, full-store `get`, zero boilerplate.

## The problem

Zustand's recommended [slice pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern) flat-merges everything into a single object:

```ts
const useStore = create((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
}))

useStore(s => s.user)   // which slice does this belong to?
useStore(s => s.items)  // what if another slice also has `items`?
```

This works for small stores, but as slices grow:

- **Naming collisions** — two slices can't have a property with the same name (`items`, `loading`, `error`, ...)
- **No namespace** — you can't tell which slice a property belongs to from the call site
- **Flat state** — DevTools show a wall of keys with no grouping

You end up manually prefixing everything (`authUser`, `cartItems`, `authLoading`, `cartLoading`, ...) — which defeats the purpose of slices.

## The solution

```
npm install zustand-sliced
```

```ts
import { sliced } from 'zustand-sliced'

const useStore = sliced({
  auth: (set, get) => ({
    user: null as string | null,
    login: (name: string) => set({ user: name }),
    logout: () => set({ user: null }),
  }),
  cart: (set, get) => ({
    items: [] as string[],
    add: (item: string) => set((s: any) => ({ items: [...s.items, item] })),
    checkout: () => {
      const user = get().auth.user  // cross-slice read
      if (!user) throw new Error('Not logged in')
    },
  }),
})
```

```ts
// In components — namespaced, typed, no ambiguity
const user = useStore(s => s.auth.user)    // string | null
const items = useStore(s => s.cart.items)  // string[]
```

That's it. Each slice gets:

- **`set`** — scoped to its own namespace. `set({ user: name })` only touches `state.auth`.
- **`get`** — returns the full store. `get().cart.items` reads across slices.

## Feature-directory pattern

Slices live in their own files and combine in a single store file:

```
src/
  features/
    auth/
      slice.ts    ← authSlice
    cart/
      slice.ts    ← cartSlice
  store.ts        ← sliced({ auth: authSlice, cart: cartSlice })
```

```ts
// features/auth/slice.ts
export const authSlice = (set, get) => ({
  user: null as string | null,
  login: (name: string) => set({ user: name }),
})

// features/cart/slice.ts
export const cartSlice = (set, get) => ({
  items: [] as string[],
  add: (item: string) => set((s: any) => ({ items: [...s.items, item] })),
})

// store.ts
import { sliced } from 'zustand-sliced'
import { authSlice } from './features/auth/slice'
import { cartSlice } from './features/cart/slice'

export const useStore = sliced({ auth: authSlice, cart: cartSlice })
```

## Full type safety inside slices

By default, `sliced({...})` infers the store type from return values. Consumer code (`useStore(s => s.auth.user)`) is fully typed, but `set` and `get` inside creators are `any`.

If you want type checking inside slice creators too, pass an explicit Store type:

```ts
// Define each slice's shape
interface AuthSlice {
  user: string | null
  login: (name: string) => void
}

interface CartSlice {
  items: string[]
  add: (item: string) => void
  checkout: () => string
}

// Combine into the Store type
interface Store {
  auth: AuthSlice
  cart: CartSlice
}

// Pass it to sliced<Store>()
const useStore = sliced<Store>({
  auth: (set, get) => ({
    user: null,
    login: (name) => set({ user: name }),   // set: ScopedSet<AuthSlice>
    // set({ typo: 1 })                     // ← compile error!
  }),
  cart: (set, get) => ({
    items: [],
    add: (item) => set(s => ({ items: [...s.items, item] })),
    checkout: () => {
      const user = get().auth.user          // get(): Store — fully typed
      // get().auth.items                   // ← compile error!
      return user ?? 'anonymous'
    },
  }),
})
```

This gives you:

| What | Inferred (`sliced({...})`) | Explicit (`sliced<Store>({...})`) |
|---|---|---|
| `useStore(s => s.auth.user)` | typed | typed |
| `set({ typo: 1 })` inside creator | no error | **compile error** |
| `get().auth.user` inside creator | no type info | **fully typed** |
| Missing slice property | no error | **compile error** |

Use inferred mode for quick prototyping, explicit mode when your store stabilizes.

## Vanilla (non-React) usage

`getState`, `setState`, and `subscribe` are available directly on the hook:

```ts
const useStore = sliced({ ... })

// Read state outside React
const state = useStore.getState()

// Subscribe to changes
useStore.subscribe((state) => {
  console.log('auth changed:', state.auth.user)
})
```

## API

### `sliced(definitions)`

Creates a zustand store with namespaced slices.

**Parameters:**

- `definitions` — an object where each key is a slice name and each value is a slice creator function `(set, get) => sliceState`.

**Returns:** A zustand-compatible hook with `getState()`, `setState()`, and `subscribe()`.

### `ScopedSet<TSlice>`

Exported type for annotating `set` in slice creators when needed:

```ts
import type { ScopedSet } from 'zustand-sliced'
```

## License

MIT
