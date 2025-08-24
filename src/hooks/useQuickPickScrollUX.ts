import { useEffect, useRef } from "react";

export function useQuickPickScrollUX<T extends HTMLElement>(mode: "peek"|"bottom"|"none" = "peek") {
  const ref = useRef<T|null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // add nudge
    let nudge = el.querySelector<HTMLDivElement>('.qp-more-nudge');
    if (!nudge) {
      nudge = document.createElement('div');
      nudge.className = 'qp-more-nudge';
      nudge.textContent = 'More ↓';
      nudge.onclick = () => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      el.appendChild(nudge);
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const updateShadows = () => {
      const atTop = el.scrollTop <= 0;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
      el.classList.toggle('at-top', atTop);
      el.classList.toggle('at-bottom', atBottom);
      if (nudge) nudge.style.display = atBottom ? 'none' : 'block';
    };

    const ro = new ResizeObserver(updateShadows);
    el.addEventListener('scroll', updateShadows);
    ro.observe(el);

    const peek = async () => {
      if (prefersReduced) return;
      if (el.scrollHeight <= el.clientHeight) return;
      const start = el.scrollTop;
      el.scrollTo({ top: start + 64, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 500));
      el.scrollTo({ top: start, behavior: prefersReduced ? 'auto' : 'smooth' });
    };

    requestAnimationFrame(() => {
      updateShadows();
      if (mode === "peek") peek();
      if (mode === "bottom") el.scrollTo({ top: el.scrollHeight, behavior: prefersReduced ? 'auto' : 'smooth' });
    });

    return () => {
      el.removeEventListener('scroll', updateShadows);
      ro.disconnect();
    };
  }, [mode]);

  return ref;
}