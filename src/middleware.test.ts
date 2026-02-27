import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { sliced } from "./index";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface CounterSlice {
  count: number;
  inc: () => void;
  add: (n: number) => void;
}

interface TodoSlice {
  items: string[];
  add: (item: string) => void;
  clear: () => void;
}

interface Store {
  counter: CounterSlice;
  todo: TodoSlice;
}

const counterDef = (set: any) => ({
  count: 0,
  inc: () => set((s: CounterSlice) => ({ count: s.count + 1 })),
  add: (n: number) => set((s: CounterSlice) => ({ count: s.count + n })),
});

const todoDef = (set: any) => ({
  items: [] as string[],
  add: (item: string) =>
    set((s: TodoSlice) => ({ items: [...s.items, item] })),
  clear: () => set({ items: [] }),
});

// ---------------------------------------------------------------------------
// Immer
// ---------------------------------------------------------------------------

describe("immer middleware", () => {
  it("supports draft mutation style in set", () => {
    interface ImmerTodoSlice {
      items: string[];
      add: (item: string) => void;
      remove: (index: number) => void;
    }
    interface ImmerStore {
      counter: CounterSlice;
      todo: ImmerTodoSlice;
    }

    const useStore = create<ImmerStore>()(
      immer(
        sliced({
          counter: (set) => ({
            count: 0,
            inc: () =>
              set((s) => {
                s.count += 1;
              }),
            add: (n) =>
              set((s) => {
                s.count += n;
              }),
          }),
          todo: (set) => ({
            items: [],
            add: (item) =>
              set((s) => {
                s.items.push(item);
              }),
            remove: (index) =>
              set((s) => {
                s.items.splice(index, 1);
              }),
          }),
        }),
      ),
    );

    useStore.getState().counter.inc();
    useStore.getState().counter.inc();
    useStore.getState().counter.add(10);
    expect(useStore.getState().counter.count).toBe(12);

    useStore.getState().todo.add("Buy milk");
    useStore.getState().todo.add("Write tests");
    useStore.getState().todo.add("Ship it");
    expect(useStore.getState().todo.items).toEqual([
      "Buy milk",
      "Write tests",
      "Ship it",
    ]);

    useStore.getState().todo.remove(1);
    expect(useStore.getState().todo.items).toEqual(["Buy milk", "Ship it"]);
  });

  it("regular (non-mutation) set still works with immer", () => {
    const useStore = create<Store>()(
      immer(sliced({ counter: counterDef, todo: todoDef })),
    );

    useStore.getState().counter.inc();
    expect(useStore.getState().counter.count).toBe(1);

    useStore.getState().todo.add("test");
    expect(useStore.getState().todo.items).toEqual(["test"]);
  });

  it("cross-slice reads work with immer", () => {
    interface AuthSlice {
      user: string | null;
      login: (name: string) => void;
    }
    interface CartSlice {
      items: string[];
      add: (item: string) => void;
      summary: () => string;
    }
    interface S {
      auth: AuthSlice;
      cart: CartSlice;
    }

    const useStore = create<S>()(
      immer(
        sliced({
          auth: (set) => ({
            user: null,
            login: (name) =>
              set((s) => {
                s.user = name;
              }),
          }),
          cart: (set, get) => ({
            items: [],
            add: (item) =>
              set((s) => {
                s.items.push(item);
              }),
            summary: () => {
              const user = get().auth.user ?? "anonymous";
              return `${user}: ${get().cart.items.length} items`;
            },
          }),
        }),
      ),
    );

    useStore.getState().auth.login("Alice");
    useStore.getState().cart.add("Widget");
    expect(useStore.getState().cart.summary()).toBe("Alice: 1 items");
  });
});

// ---------------------------------------------------------------------------
// Devtools
// ---------------------------------------------------------------------------

describe("devtools middleware", () => {
  it("works with devtools middleware", () => {
    const useStore = create<Store>()(
      devtools(sliced({ counter: counterDef, todo: todoDef }), {
        name: "TestStore",
        enabled: false,
      }),
    );

    useStore.getState().counter.inc();
    expect(useStore.getState().counter.count).toBe(1);

    useStore.getState().todo.add("test");
    expect(useStore.getState().todo.items).toEqual(["test"]);
  });
});

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

describe("persist middleware", () => {
  it("persists and rehydrates namespaced state", async () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (name: string) => storage[name] ?? null,
      setItem: (name: string, value: string) => {
        storage[name] = value;
      },
      removeItem: (name: string) => {
        delete storage[name];
      },
    };

    const store1 = create<Store>()(
      persist(sliced({ counter: counterDef, todo: todoDef }), {
        name: "test-store",
        storage: createJSONStorage(() => mockStorage),
      }),
    );

    store1.getState().counter.inc();
    store1.getState().counter.inc();
    store1.getState().todo.add("persisted item");

    expect(store1.getState().counter.count).toBe(2);
    expect(store1.getState().todo.items).toEqual(["persisted item"]);

    const persisted = JSON.parse(storage["test-store"]);
    expect(persisted.state.counter.count).toBe(2);
    expect(persisted.state.todo.items).toEqual(["persisted item"]);

    // New store rehydrates from storage
    const store2 = create<Store>()(
      persist(sliced({ counter: counterDef, todo: todoDef }), {
        name: "test-store",
        storage: createJSONStorage(() => mockStorage),
      }),
    );

    await new Promise((r) => setTimeout(r, 10));

    expect(store2.getState().counter.count).toBe(2);
    expect(store2.getState().todo.items).toEqual(["persisted item"]);
  });

  it("partialize works with namespaced state", () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (name: string) => storage[name] ?? null,
      setItem: (name: string, value: string) => {
        storage[name] = value;
      },
      removeItem: (name: string) => {
        delete storage[name];
      },
    };

    const useStore = create<Store>()(
      persist(sliced({ counter: counterDef, todo: todoDef }), {
        name: "partial-store",
        storage: createJSONStorage(() => mockStorage),
        partialize: (state) => ({ counter: state.counter }) as any,
      }),
    );

    useStore.getState().counter.inc();
    useStore.getState().todo.add("should not persist");

    const persisted = JSON.parse(storage["partial-store"]);
    expect(persisted.state.counter.count).toBe(1);
    expect(persisted.state.todo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Middleware composition
// ---------------------------------------------------------------------------

describe("middleware composition", () => {
  it("immer + devtools work together", () => {
    interface S {
      counter: CounterSlice;
    }

    const useStore = create<S>()(
      devtools(
        immer(
          sliced({
            counter: (set) => ({
              count: 0,
              inc: () =>
                set((s) => {
                  s.count += 1;
                }),
              add: (n) =>
                set((s) => {
                  s.count += n;
                }),
            }),
          }),
        ),
        { name: "ComposedStore", enabled: false },
      ),
    );

    useStore.getState().counter.inc();
    useStore.getState().counter.add(5);
    expect(useStore.getState().counter.count).toBe(6);
  });

  it("immer + persist work together", async () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (name: string) => storage[name] ?? null,
      setItem: (name: string, value: string) => {
        storage[name] = value;
      },
      removeItem: (name: string) => {
        delete storage[name];
      },
    };

    interface S {
      todo: TodoSlice;
    }

    const useStore = create<S>()(
      persist(
        immer(
          sliced({
            todo: (set) => ({
              items: [],
              add: (item) =>
                set((s) => {
                  (s as any).items.push(item);
                }),
              clear: () => set({ items: [] }),
            }),
          }),
        ),
        {
          name: "immer-persist",
          storage: createJSONStorage(() => mockStorage),
        },
      ),
    );

    useStore.getState().todo.add("item1");
    useStore.getState().todo.add("item2");

    const persisted = JSON.parse(storage["immer-persist"]);
    expect(persisted.state.todo.items).toEqual(["item1", "item2"]);
  });
});
