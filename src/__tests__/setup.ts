import { afterEach, beforeEach, vi } from 'vitest';

class MockIntersectionObserver implements IntersectionObserver {
    static instances: MockIntersectionObserver[] = [];

    readonly root: Element | Document | null = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];

    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

    constructor(private callback: IntersectionObserverCallback) {
        MockIntersectionObserver.instances.push(this);
    }

    trigger(entries: Partial<IntersectionObserverEntry>[]) {
        this.callback(entries as IntersectionObserverEntry[], this);
    }

    static reset() {
        MockIntersectionObserver.instances = [];
    }
}

Object.defineProperty(window, 'IntersectionObserver', {
    value: MockIntersectionObserver,
    writable: true,
});

Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: MockIntersectionObserver,
    writable: true,
});

Object.defineProperty(window, 'requestIdleCallback', {
    value: vi.fn((callback: IdleRequestCallback) => window.setTimeout(() => callback({
        didTimeout: false,
        timeRemaining: () => 50,
    }), 0)),
    writable: true,
});

Object.defineProperty(window, 'cancelIdleCallback', {
    value: vi.fn((id: number) => window.clearTimeout(id)),
    writable: true,
});

Object.defineProperty(globalThis, 'fetch', {
    value: vi.fn(),
    writable: true,
});

beforeEach(() => {
    localStorage.clear();
    MockIntersectionObserver.reset();
    vi.clearAllMocks();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
});

afterEach(() => {
    vi.useRealTimers();
});

export { MockIntersectionObserver };
