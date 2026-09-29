/**
 * One IntersectionObserver for every [data-reveal] on the page.
 *
 * The hidden state lives in CSS behind `.js`. With JavaScript off the class is
 * never set; if this module fails to load or throws before signalling ready,
 * the watchdog in BaseLayout removes `.js`. Never move the hiding into JS.
 */
export function initReveal(): void {
  // Must stay the first statement: it stops the watchdog in BaseLayout, which
  // otherwise removes the .js class and shows all content un-animated.
  document.documentElement.setAttribute('data-reveal-ready', '');

  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay ?? 0);
        window.setTimeout(() => el.classList.add('is-revealed'), delay);
        observer.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
  );

  targets.forEach((el) => observer.observe(el));
}
