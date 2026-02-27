import { describe, it, expect } from "vitest";
import { sliced } from "./index";

// ---------------------------------------------------------------------------
// Helpers — suppress "useStore must be used inside React" by calling
// getState / setState directly (vanilla mode).
// ---------------------------------------------------------------------------

describe("sliced", () => {
  it("creates a store with namespaced initial state", () => {
    const useStore = sliced({
      counter: (set) => ({
        count: 0,
        inc: () => set((s: any) => ({ count: s.count + 1 })),
      }),
      greeting: (set) => ({
        message: "hello",
        setMessage: (m: string) => set({ message: m }),
      }),
    });

    const state = useStore.getState();
    expect(state.counter.count).toBe(0);
    expect(state.greeting.message).toBe("hello");
  });

  it("scoped set only updates its own slice", () => {
    const useStore = sliced({
      a: (set) => ({
        value: 1,
        setValue: (v: number) => set({ value: v }),
      }),
      b: (set) => ({
        value: 100,
        setValue: (v: number) => set({ value: v }),
      }),
    });

    // Mutate slice `a`
    useStore.getState().a.setValue(42);

    expect(useStore.getState().a.value).toBe(42);
    // Slice `b` must be untouched
    expect(useStore.getState().b.value).toBe(100);
  });

  it("scoped set with updater function receives the slice state", () => {
    const useStore = sliced({
      counter: (set) => ({
        count: 0,
        inc: () => set((s: any) => ({ count: s.count + 1 })),
        add: (n: number) => set((s: any) => ({ count: s.count + n })),
      }),
    });

    useStore.getState().counter.inc();
    useStore.getState().counter.inc();
    useStore.getState().counter.add(10);

    expect(useStore.getState().counter.count).toBe(12);
  });

  it("get() returns the full store for cross-slice reads", () => {
    const useStore = sliced({
      auth: (set) => ({
        user: null as string | null,
        login: (name: string) => set({ user: name }),
      }),
      cart: (set, get) => ({
        items: [] as string[],
        add: (item: string) => set((s: any) => ({ items: [...s.items, item] })),
        checkout: () => {
          const user = get().auth.user;
          if (!user) throw new Error("Not logged in");
          return `${user} bought ${get().cart.items.length} items`;
        },
      }),
    });

    // Should throw when not logged in
    expect(() => useStore.getState().cart.checkout()).toThrow("Not logged in");

    // Login and add items
    useStore.getState().auth.login("Alice");
    useStore.getState().cart.add("Widget");
    useStore.getState().cart.add("Gadget");

    expect(useStore.getState().cart.checkout()).toBe("Alice bought 2 items");
  });

  it("subscribe notifies on any slice change", () => {
    const useStore = sliced({
      x: (set) => ({
        val: 0,
        set: (v: number) => set({ val: v }),
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
    const useStore = sliced({
      foo: (set) => ({
        name: "foo",
        update: () => set({ name: "FOO" }),
      }),
      bar: (set) => ({
        name: "bar",
        update: () => set({ name: "BAR" }),
      }),
    });

    // Both have `name` — no collision because they're namespaced
    expect(useStore.getState().foo.name).toBe("foo");
    expect(useStore.getState().bar.name).toBe("bar");

    useStore.getState().foo.update();

    expect(useStore.getState().foo.name).toBe("FOO");
    expect(useStore.getState().bar.name).toBe("bar");
  });

  it("preserves other properties in a slice when doing partial set", () => {
    const useStore = sliced({
      profile: (set) => ({
        firstName: "John",
        lastName: "Doe",
        age: 30,
        setFirstName: (n: string) => set({ firstName: n }),
      }),
    });

    useStore.getState().profile.setFirstName("Jane");

    const profile = useStore.getState().profile;
    expect(profile.firstName).toBe("Jane");
    expect(profile.lastName).toBe("Doe");
    expect(profile.age).toBe(30);
  });
});
