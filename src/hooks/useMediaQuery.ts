import { useLayoutEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const get = () => (typeof window !== "undefined"
    ? window.matchMedia(query).matches
    : false);

  const [matches, setMatches] = useState(get);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // set synchronously before paint
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}