/**
 * Solidifies the overlay navbar once the page scrolls past the hero's top
 * band, and drives the mobile menu toggle.
 */
export function initNav(): void {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;

  const toggle = nav.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const menu = nav.querySelector<HTMLElement>('[data-nav-menu]');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    // Escape closes it, and focus returns to the control that opened it.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !menu.classList.contains('is-open')) return;
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    });
  }

  if (!nav.classList.contains('navbar--overlay')) return;

  const onScroll = () => {
    nav.classList.toggle('is-solid', window.scrollY > 80);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
