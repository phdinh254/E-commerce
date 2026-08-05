import "@testing-library/jest-dom/vitest";

// jsdom does not implement IntersectionObserver — stub a no-op so
// components using useIntersectionObserver (the catalog's infinite-scroll
// sentinel) can mount in tests. Tests that need to simulate an actual
// intersection replace this per-test via `vi.stubGlobal`.
if (typeof globalThis.IntersectionObserver === "undefined") {
  class NoopIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
