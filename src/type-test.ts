/**
 * Compile-time type tests — if this file compiles, types are correct.
 * Not executed at runtime.
 */
import { create } from "zustand";
import { sliced } from "./index";

// ===================================================================
// Store type declaration
// ===================================================================

interface AuthSlice {
  user: string | null;
  token: string | null;
  login: (name: string) => void;
  logout: () => void;
}

interface CartSlice {
  items: string[];
  add: (item: string) => void;
  checkout: () => string;
}

interface Store {
  auth: AuthSlice;
  cart: CartSlice;
}

// ===================================================================
// 1. set and get are fully typed inside creators
// ===================================================================

const useStore = create<Store>()(
  sliced({
    auth: (set, get) => ({
      user: null,
      token: null,
      login: (name) => {
        set({ user: name }); // set: ScopedSet<AuthSlice>

        // @ts-expect-error — `typo` is not a key in AuthSlice
        set({ typo: 123 });
      },
      logout: () => set({ user: null, token: null }),
    }),
    cart: (set, get) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      checkout: () => {
        const user = get().auth.user; // get(): Store — fully typed

        // @ts-expect-error — `auth` doesn't have `items`
        get().auth.items;

        // @ts-expect-error — `cart` doesn't have `user`
        get().cart.user;

        return user ?? "anonymous";
      },
    }),
  }),
);

// ===================================================================
// 2. Consumer side is fully typed
// ===================================================================

const user: string | null = useStore.getState().auth.user;
const items: string[] = useStore.getState().cart.items;
const login: (name: string) => void = useStore.getState().auth.login;
const add: (item: string) => void = useStore.getState().cart.add;

// @ts-expect-error — `auth` doesn't have `add`
useStore.getState().auth.add;

// @ts-expect-error — `cart` doesn't have `user`
useStore.getState().cart.user;

// @ts-expect-error — top-level doesn't have `user` (namespaced)
useStore.getState().user;

// ===================================================================
// 3. Missing slice properties are caught at compile time
// ===================================================================

create<Store>()(
  sliced({
    auth: (set, get) => ({
      user: null,
      token: null,
      login: (name: string) => set({ user: name }),
      logout: () => set({ user: null, token: null }),
    }),
    // @ts-expect-error — cart is missing `checkout`
    cart: (set, get) => ({
      items: [],
      add: (item: string) => set((s) => ({ items: [...s.items, item] })),
    }),
  }),
);
