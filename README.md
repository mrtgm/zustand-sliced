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

Define your store shape as interfaces, pass the combined type to `sliced<Store>()`:

```ts
import { sliced } from 'zustand-sliced'

interface AuthSlice {
  user: string | null
  login: (name: string) => void
}

interface CartSlice {
  items: string[]
  add: (item: string) => void
}

interface Store {
  auth: AuthSlice
  cart: CartSlice
}

const useStore = sliced<Store>({
  auth: (set, get) => ({
    user: null,
    login: (name) => set({ user: name }),
    // set({ typo: 1 })   — compile error
  }),
  cart: (set, get) => ({
    items: [],
    add: (item) => set(s => ({ items: [...s.items, item] })),
    // get().auth.user     — fully typed cross-slice read
  }),
})

// Namespaced, fully typed
useStore(s => s.auth.user)    // string | null
useStore(s => s.cart.items)   // string[]
```

- **`set`** is scoped to its own slice and fully typed — `set({ user: name })` only touches `state.auth`
- **`get`** returns the full store, fully typed — `get().cart.items` for cross-slice reads
- Missing or wrong slice properties are caught at compile time

Slices can live in separate files:

```ts
// store.ts
import { authSlice } from './features/auth/slice'
import { cartSlice } from './features/cart/slice'

export const useStore = sliced<Store>({ auth: authSlice, cart: cartSlice })
```

## License

MIT
