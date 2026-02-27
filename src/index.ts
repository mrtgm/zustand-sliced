import type { StoreApi } from "zustand/vanilla";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Scoped set — only modifies the slice's own namespace.
 *
 * With immer middleware, you can mutate the draft directly:
 * ```ts
 * set(s => { s.items.push(item) })
 * ```
 */
export type ScopedSet<TSlice> = (
  partial: Partial<TSlice> | ((prev: TSlice) => Partial<TSlice> | void),
) => void;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Convert namespaced slice definitions into a zustand StateCreator.
 * Use with zustand's `create()` — composes with any middleware.
 *
 * @example
 * ```ts
 * import { create } from 'zustand'
 * import { immer } from 'zustand/middleware/immer'
 * import { sliced } from 'zustand-sliced'
 *
 * interface AuthSlice { user: string | null; login: (name: string) => void }
 * interface CartSlice { items: string[]; add: (item: string) => void }
 * interface Store { auth: AuthSlice; cart: CartSlice }
 *
 * const useStore = create<Store>()(
 *   immer(sliced({
 *     auth: (set, get) => ({
 *       user: null,
 *       login: (name) => set({ user: name }),
 *     }),
 *     cart: (set, get) => ({
 *       items: [],
 *       add: (item) => set(s => { s.items.push(item) }),
 *     }),
 *   }))
 * )
 * ```
 */
export function sliced<TStore>(
  definitions: {
    [K in keyof TStore]: (
      set: ScopedSet<TStore[K]>,
      get: () => TStore,
    ) => TStore[K];
  },
): (set: any, get: any, api: StoreApi<TStore>) => TStore {
  return (_set, _get, api) => {
    const initialState: Record<string, unknown> = {};

    for (const key of Object.keys(definitions)) {
      const creator = (definitions as any)[key];

      // Scoped set: merges partial into `state[key]` only.
      // Compatible with immer (void return = draft mutation).
      // Passes action name for devtools.
      const scopedSet = (
        partial:
          | Record<string, unknown>
          | ((
              prev: Record<string, unknown>,
            ) => Record<string, unknown> | void),
      ) => {
        (api.setState as any)(
          (prev: any) => {
            const prevSlice = prev[key];
            if (typeof partial === "function") {
              const result = partial(prevSlice);
              if (result === undefined) return;
              return { [key]: { ...prevSlice, ...result } };
            }
            return { [key]: { ...prevSlice, ...partial } };
          },
          false,
          `${key}/set`,
        );
      };

      const fullGet = () => api.getState();

      initialState[key] = creator(scopedSet, fullGet);
    }

    return initialState as TStore;
  };
}
