import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore as useZustandStore } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Scoped set — only modifies the slice's own namespace.
 * Accepts a partial object or an updater function.
 */
export type ScopedSet<TSlice> = (
  partial: Partial<TSlice> | ((prev: TSlice) => Partial<TSlice>),
) => void;

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
 * Define your store shape as interfaces, then pass the combined type
 * to `sliced<Store>()`. This gives you fully typed `set` and `get`
 * inside every slice creator.
 *
 * @example
 * ```ts
 * interface AuthSlice {
 *   user: string | null;
 *   login: (name: string) => void;
 * }
 * interface CartSlice {
 *   items: string[];
 *   add: (item: string) => void;
 * }
 * interface Store {
 *   auth: AuthSlice;
 *   cart: CartSlice;
 * }
 *
 * const useStore = sliced<Store>({
 *   auth: (set, get) => ({
 *     user: null,
 *     login: (name) => set({ user: name }),  // set: ScopedSet<AuthSlice>
 *   }),
 *   cart: (set, get) => ({
 *     items: [],
 *     add: (item) => set(s => ({ items: [...s.items, item] })),
 *     // get().auth.user — fully typed cross-slice read
 *   }),
 * });
 * ```
 */
export function sliced<TStore>(
  definitions: {
    [K in keyof TStore]: (
      set: ScopedSet<TStore[K]>,
      get: () => TStore,
    ) => TStore[K];
  },
): UseBoundStore<TStore> {
  let store: StoreApi<TStore>;

  const initialState: Record<string, unknown> = {};

  for (const key of Object.keys(definitions)) {
    const creator = (definitions as any)[key];

    const scopedSet = (
      partial:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      store.setState((prev: any) => {
        const prevSlice = prev[key];
        const nextPartial =
          typeof partial === "function" ? partial(prevSlice) : partial;
        return { [key]: { ...prevSlice, ...nextPartial } } as Partial<TStore>;
      });
    };

    const fullGet = () => store.getState();

    initialState[key] = creator(scopedSet, fullGet);
  }

  store = createStore<TStore>(() => initialState as TStore);

  const useBoundStore = (<U>(selector: (state: TStore) => U) =>
    useZustandStore(store, selector)) as UseBoundStore<TStore>;

  useBoundStore.getState = store.getState.bind(store);
  useBoundStore.setState = store.setState.bind(store);
  useBoundStore.subscribe = store.subscribe.bind(store);

  return useBoundStore;
}
