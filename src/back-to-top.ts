import './back-to-top.css';

const BACK_TO_TOP_ID = 'back-to-top';
const VISIBILITY_OFFSET = 600;

export function mountBackToTop(): void {
  if (document.getElementById(BACK_TO_TOP_ID)) return;

  const button = document.createElement('button');
  button.id = BACK_TO_TOP_ID;
  button.className = 'back-to-top';
  button.type = 'button';
  button.setAttribute('aria-label', 'ページ上部へ戻る');
  button.title = 'BACK TO TOP';
  button.textContent = '↑';
  document.body.append(button);

  const syncVisibility = (): void => {
    button.classList.toggle('is-visible', window.scrollY > VISIBILITY_OFFSET);
  };

  window.addEventListener('scroll', syncVisibility, { passive: true });
  button.addEventListener('click', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  syncVisibility();
}
