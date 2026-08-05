"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches an `IntersectionObserver` to the returned ref and calls
 * `onIntersect` whenever that element becomes visible. Deliberately not a
 * new dependency — `IntersectionObserver` is a standard browser API and a
 * single sentinel per list doesn't warrant an npm package.
 *
 * `enabled` gates the observer entirely (no `next page` sentinel is
 * watched when there is no next page, or while a fetch is already in
 * flight) so a fast/short viewport can't trigger `onIntersect` in a tight
 * loop — the caller (useInfiniteProducts consumer) is expected to pass
 * `hasNextPage && !isFetchingNextPage`.
 */
export function useIntersectionObserver(
  onIntersect: () => void,
  options: { enabled: boolean; rootMargin?: string } = { enabled: true },
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const onIntersectRef = useRef(onIntersect);

  useEffect(() => {
    onIntersectRef.current = onIntersect;
  });

  useEffect(() => {
    if (!options.enabled) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersectRef.current();
      },
      { rootMargin: options.rootMargin ?? "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options.enabled, options.rootMargin]);

  return ref;
}
