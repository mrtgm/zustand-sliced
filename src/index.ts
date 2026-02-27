import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore as useZustandStore } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A slice creator: `(set, get) => sliceState`. */
type SliceCreatorFn = (set: any, get: any) => Record<string, unknown>;

/** Combine return types of all slice creators into a namespaced store type. */
type InferStore<TDefs extends Record<string, SliceCreatorFn>> = {
  [K in keyof TDefs]: ReturnType<TDefs[K]>;
};

/**
 * Scoped set — only modifies the slice's own namespace.
 * Accepts a partial object or an updater function.
 */
export type ScopedSet<TSlice> = (
  partial: Partial<TSlice> | ((prev: TSlice) => Partial<TSlice>),
) => void;

/**
 * Fully-typed slice definitions.
 * Used when Store type is explicitly provided via `sliced<Store>(...)`.
 */
type TypedSliceDefinitions<TStore> = {
  [K in keyof TStore]: (
    set: ScopedSet<TStore[K]>,
    get: () => TStore,
  ) => TStore[K];
};

/** Zustand-compatible hook with full selector support. */
type UseBoundStore<TStore> = {
  <U>(selector: (state: TStore) => U): U;
  getState: () => TStore;
  setState: StoreApi<TStore>["setState"];
  subscribe: StoreApi<TStore>["subscribe"];
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a zustand store with namespaced slices.
 *
 * **Usage 1 — Inferred (quick & simple):**
 *
 * ```ts
 * const useStore = sliced({
 *   counter: (set, get) => ({
 *     count: 0,
 *     inc: () => set((s: any) => ({ count: s.count + 1 })),
 *   }),
 * });
 * // Consumer side is fully typed: useStore(s => s.counter.count) → number
 * ```
 *
 * **Usage 2 — Explicit Store type (full internal typing):**
 *
 * ```ts
 * interface AuthSlice { user: string | null; login: (name: string) => void }
 * interface CartSlice { items: string[]; add: (item: string) => void }
 * interface Store { auth: AuthSlice; cart: CartSlice }
 *
 * const useStore = sliced<Store>({
 *   auth: (set, get) => ({
 *     user: null,
 *     login: (name) => set({ user: name }),   // set: ScopedSet<AuthSlice>
 *   }),
 *   cart: (set, get) => ({
 *     items: [],
 *     add: (item) => set(s => ({ items: [...s.items, item] })),
 *     // get().auth.user — fully typed cross-slice read
 *   }),
 * });
 * ```
 */

// Overload 1: inferred — default when no type param is given
export function sliced<TDefs extends Record<string, SliceCreatorFn>>(
  definitions: TDefs,
): UseBoundStore<InferStore<TDefs>>;

// Overload 2: explicit Store type — set/get fully typed inside creators
export function sliced<TStore>(
  definitions: TypedSliceDefinitions<TStore>,
): UseBoundStore<TStore>;

// Implementation
export function sliced(
  definitions: Record<string, (set: any, get: any) => Record<string, unknown>>,
): UseBoundStore<any> {
  let store: StoreApi<any>;

  const initialState: Record<string, Record<string, unknown>> = {};

  for (const key of Object.keys(definitions)) {
    const creator = definitions[key];

    // Scoped set: merges partial into `state[key]` only
    const scopedSet = (
      partial:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      store.setState((prev: any) => {
        const prevSlice = prev[key];
        const nextPartial =
          typeof partial === "function" ? partial(prevSlice) : partial;
        return { [key]: { ...prevSlice, ...nextPartial } };
      });
    };

    // Full-store get (captured lazily — safe before store init)
    const fullGet = () => store.getState();

    initialState[key] = creator(scopedSet, fullGet);
  }

  store = createStore(() => initialState);

  // Build a React hook with getState/setState/subscribe attached
  const useBoundStore = ((selector: any) =>
    useZustandStore(store, selector)) as UseBoundStore<any>;

  useBoundStore.getState = store.getState.bind(store);
  useBoundStore.setState = store.setState.bind(store);
  useBoundStore.subscribe = store.subscribe.bind(store);

  return useBoundStore;
}
