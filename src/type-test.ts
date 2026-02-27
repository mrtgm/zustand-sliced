/**
 * Compile-time type tests — if this file compiles, types are correct.
 * Not executed at runtime.
 */
import { sliced, type ScopedSet } from "./index";

// ===================================================================
// 1. Inferred mode (existing) — consumer side typed, creator side any
// ===================================================================

const inferred = sliced({
  auth: (set, get) => ({
    user: null as string | null,
    login: (name: string) => set({ user: name }),
  }),
  cart: (set, get) => ({
    items: [] as string[],
    add: (item: string) => set((s: any) => ({ items: [...s.items, item] })),
  }),
});

// Consumer side types work:
const u1: string | null = inferred.getState().auth.user;
const i1: string[] = inferred.getState().cart.items;

// @ts-expect-error — `auth` doesn't have `items`
inferred.getState().auth.items;

// @ts-expect-error — top-level doesn't have `user`
inferred.getState().user;

// ===================================================================
// 2. Explicit Store type — FULL typing inside and outside creators
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

const explicit = sliced<Store>({
  auth: (set, get) => ({
    user: null,
    token: null,
    login: (name) => {
      set({ user: name }); // set: ScopedSet<AuthSlice> — typed!

      // @ts-expect-error — `typo` is not a key in AuthSlice
      set({ typo: 123 });
    },
    logout: () => set({ user: null, token: null }),
  }),
  cart: (set, get) => ({
    items: [],
    add: (item) => set((s) => ({ items: [...s.items, item] })), // s: AuthSlice — updater typed!
    checkout: () => {
      const user = get().auth.user; // get(): Store — fully typed!

      // @ts-expect-error — `auth` doesn't have `items`
      get().auth.items;

      // @ts-expect-error — `cart` doesn't have `user`
      get().cart.user;

      return user ?? "anonymous";
    },
  }),
});

// Consumer side types work:
const u2: string | null = explicit.getState().auth.user;
const i2: string[] = explicit.getState().cart.items;
const login: (name: string) => void = explicit.getState().auth.login;

// @ts-expect-error — `auth` doesn't have `add`
explicit.getState().auth.add;

// @ts-expect-error — top-level doesn't have `user`
explicit.getState().user;

// ===================================================================
// 3. Explicit Store type catches missing/wrong slice implementations
// ===================================================================

sliced<Store>({
  auth: (set, get) => ({
    user: null,
    token: null,
    login: (name: string) => set({ user: name }),
    logout: () => set({ user: null, token: null }),
  }),
  // @ts-expect-error — cart is missing required property `checkout`
  cart: (set, get) => ({
    items: [],
    add: (item: string) => set((s) => ({ items: [...s.items, item] })),
    // checkout intentionally omitted — should error
  }),
});
