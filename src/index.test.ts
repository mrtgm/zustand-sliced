import { describe, it, expect } from "vitest";
import { sliced, type ScopedSet } from "./index";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface CounterSlice {
  count: number;
  inc: () => void;
  add: (n: number) => void;
}

interface GreetingSlice {
  message: string;
  setMessage: (m: string) => void;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sliced", () => {
  it("creates a store with namespaced initial state", () => {
    interface S {
      counter: CounterSlice;
      greeting: GreetingSlice;
    }
    const useStore = sliced<S>({
      counter: (set) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
        add: (n) => set((s) => ({ count: s.count + n })),
      }),
      greeting: (set) => ({
        message: "hello",
        setMessage: (m) => set({ message: m }),
      }),
    });

    const state = useStore.getState();
    expect(state.counter.count).toBe(0);
    expect(state.greeting.message).toBe("hello");
  });

  it("scoped set only updates its own slice", () => {
    interface S {
      a: { value: number; setValue: (v: number) => void };
      b: { value: number; setValue: (v: number) => void };
    }
    const useStore = sliced<S>({
      a: (set) => ({
        value: 1,
        setValue: (v) => set({ value: v }),
      }),
      b: (set) => ({
        value: 100,
        setValue: (v) => set({ value: v }),
      }),
    });

    useStore.getState().a.setValue(42);

    expect(useStore.getState().a.value).toBe(42);
    expect(useStore.getState().b.value).toBe(100);
  });

  it("scoped set with updater function receives the slice state", () => {
    interface S {
      counter: CounterSlice;
    }
    const useStore = sliced<S>({
      counter: (set) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
        add: (n) => set((s) => ({ count: s.count + n })),
      }),
    });

    useStore.getState().counter.inc();
    useStore.getState().counter.inc();
    useStore.getState().counter.add(10);

    expect(useStore.getState().counter.count).toBe(12);
  });

  it("get() returns the full store for cross-slice reads", () => {
    interface AuthSlice {
      user: string | null;
      login: (name: string) => void;
    }
    interface CartSlice {
      items: string[];
      add: (item: string) => void;
      checkout: () => string;
    }
    interface S {
      auth: AuthSlice;
      cart: CartSlice;
    }

    const useStore = sliced<S>({
      auth: (set) => ({
        user: null,
        login: (name) => set({ user: name }),
      }),
      cart: (set, get) => ({
        items: [],
        add: (item) => set((s) => ({ items: [...s.items, item] })),
        checkout: () => {
          const user = get().auth.user;
          if (!user) throw new Error("Not logged in");
          return `${user} bought ${get().cart.items.length} items`;
        },
      }),
    });

    expect(() => useStore.getState().cart.checkout()).toThrow("Not logged in");

    useStore.getState().auth.login("Alice");
    useStore.getState().cart.add("Widget");
    useStore.getState().cart.add("Gadget");

    expect(useStore.getState().cart.checkout()).toBe("Alice bought 2 items");
  });

  it("subscribe notifies on any slice change", () => {
    interface S {
      x: { val: number; set: (v: number) => void };
    }
    const useStore = sliced<S>({
      x: (set) => ({
        val: 0,
        set: (v) => set({ val: v }),
      }),
    });

    const calls: number[] = [];
    useStore.subscribe((state) => {
      calls.push(state.x.val);
    });

    useStore.getState().x.set(1);
    useStore.getState().x.set(2);

    expect(calls).toEqual([1, 2]);
  });

  it("multiple slices can coexist without name collisions", () => {
    interface S {
      foo: { name: string; update: () => void };
      bar: { name: string; update: () => void };
    }
    const useStore = sliced<S>({
      foo: (set) => ({
        name: "foo",
        update: () => set({ name: "FOO" }),
      }),
      bar: (set) => ({
        name: "bar",
        update: () => set({ name: "BAR" }),
      }),
    });

    expect(useStore.getState().foo.name).toBe("foo");
    expect(useStore.getState().bar.name).toBe("bar");

    useStore.getState().foo.update();

    expect(useStore.getState().foo.name).toBe("FOO");
    expect(useStore.getState().bar.name).toBe("bar");
  });

  it("preserves other properties in a slice when doing partial set", () => {
    interface S {
      profile: {
        firstName: string;
        lastName: string;
        age: number;
        setFirstName: (n: string) => void;
      };
    }
    const useStore = sliced<S>({
      profile: (set) => ({
        firstName: "John",
        lastName: "Doe",
        age: 30,
        setFirstName: (n) => set({ firstName: n }),
      }),
    });

    useStore.getState().profile.setFirstName("Jane");

    const profile = useStore.getState().profile;
    expect(profile.firstName).toBe("Jane");
    expect(profile.lastName).toBe("Doe");
    expect(profile.age).toBe(30);
  });
});
