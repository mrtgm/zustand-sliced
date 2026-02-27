# zustand-sliced

Namespaced slices for [zustand](https://github.com/pmndrs/zustand).

## Why

Zustand's [slice pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern) flat-merges all state into one object:

```ts
const useStore = create((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
}))

useStore(s => s.user)   // which slice?
useStore(s => s.items)  // name collision if both slices have `items`
```

You end up prefixing everything (`authUser`, `cartItems`, `authLoading`, `cartLoading`, ...) which defeats the purpose of slices.

## Usage

```
npm install zustand-sliced
```

```ts
import { sliced } from 'zustand-sliced'

const useStore = sliced({
  auth: (set, get) => ({
    user: null as string | null,
    login: (name: string) => set({ user: name }),
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

// Namespaced, typed, no ambiguity
useStore(s => s.auth.user)    // string | null
useStore(s => s.cart.items)   // string[]
```

- **`set`** is scoped — `set({ user: name })` only touches `state.auth`
- **`get`** returns the full store — `get().cart.items` for cross-slice reads

Slices can live in separate files:

```ts
// store.ts
import { authSlice } from './features/auth/slice'
import { cartSlice } from './features/cart/slice'

export const useStore = sliced({ auth: authSlice, cart: cartSlice })
```

## Typed slices

By default, consumer code is fully typed but `set`/`get` inside creators are `any`.

Pass an explicit Store type for full internal type safety:

```ts
interface AuthSlice { user: string | null; login: (name: string) => void }
interface CartSlice { items: string[]; add: (item: string) => void }
interface Store { auth: AuthSlice; cart: CartSlice }

const useStore = sliced<Store>({
  auth: (set, get) => ({
    user: null,
    login: (name) => set({ user: name }),   // ScopedSet<AuthSlice>
    // set({ typo: 1 })                     // compile error
  }),
  cart: (set, get) => ({
    items: [],
    add: (item) => set(s => ({ items: [...s.items, item] })),
  }),
})
```

## License

MIT
