# zustand-sliced

[![npm version](https://img.shields.io/npm/v/zustand-sliced)](https://www.npmjs.com/package/zustand-sliced)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/zustand-sliced)](https://bundlephobia.com/package/zustand-sliced)
[![CI](https://github.com/mrtgm/zustand-sliced/actions/workflows/ci.yml/badge.svg)](https://github.com/mrtgm/zustand-sliced/actions/workflows/ci.yml)

Namespaced slices for [zustand](https://github.com/pmndrs/zustand).

## Why

Zustand's [slice pattern](https://zustand.docs.pmnd.rs/learn/guides/advanced-typescript#slices-pattern) flat-merges all state into one object:

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

Define your store shape as interfaces, use `sliced()` with zustand's `create()`:

```ts
import { create } from 'zustand'
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

const useStore = create<Store>()(
  sliced({
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
)

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

export const useStore = create<Store>()(
  sliced({ auth: authSlice, cart: cartSlice })
)
```

## Middleware

`sliced()` returns a standard zustand StateCreator, so middleware works exactly like normal zustand:

```ts
import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const useStore = create<Store>()(
  devtools(
    persist(
      immer(
        sliced({
          auth: (set, get) => ({
            user: null,
            login: (name) => set(s => { s.user = name }),  // immer draft mutation
          }),
          cart: (set, get) => ({
            items: [],
            add: (item) => set(s => { s.items.push(item) }),  // just push
          }),
        })
      ),
      { name: 'store', storage: createJSONStorage(() => localStorage) }
    )
  )
)
```

Each slice's actions automatically show as `auth/set`, `cart/set` in Redux DevTools.

## License

MIT
