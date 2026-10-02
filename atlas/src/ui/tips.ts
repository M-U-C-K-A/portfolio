/**
 * Infobulles de l'interface (style panneau warcraftcn) : tout élément portant `data-tip` affiche, après un
 * court délai, un encart avec un titre facultatif (`data-tip-title`) et un raccourci (`data-tip-key`).
 * Placé au-dessus de l'élément s'il est dans la moitié basse de l'écran, en dessous sinon.
 */
export function initTips(container: HTMLElement): void {
  const tip = document.createElement('div');
  tip.id = 'ui-tip';
  tip.className = 'fantasy wc-panel';
  tip.hidden = true;
  container.append(tip);
  let timer = 0;
  let current: HTMLElement | null = null;

  const hide = () => {
    clearTimeout(timer);
    current = null;
    tip.hidden = true;
  };
  const show = (el: HTMLElement) => {
    const title = el.dataset.tipTitle, text = el.dataset.tip ?? '', key = el.dataset.tipKey;
    tip.innerHTML = `${title ? `<div class="tt">${title}${key ? `<kbd>${key}</kbd>` : ''}</div>` : ''}<div class="tx">${text}</div>${!title && key ? `<div class="tk">Raccourci : <kbd>${key}</kbd></div>` : ''}`;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), c = container.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2 - c.left;
    x = Math.max(8, Math.min(c.width - tw - 8, x));
    const below = r.top + r.height / 2 < c.top + c.height / 2;
    let y = below ? r.bottom - c.top + 8 : r.top - c.top - th - 8;
    // listes latérales (Chroniques) : à côté de l'élément, pour ne pas masquer la liste
    const panel = el.closest<HTMLElement>('[data-tip-side="right"]');
    if (panel) {
      x = Math.min(c.width - tw - 8, panel.getBoundingClientRect().right - c.left + 10);
      y = r.top - c.top;
    }
    y = Math.max(8, Math.min(c.height - th - 8, y));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };

  container.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el === current) return;
    hide();
    if (!el || !container.contains(el)) return;
    current = el;
    timer = window.setTimeout(() => current === el && el.isConnected && show(el), 320);
  });
  container.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget as HTMLElement | null;
    if (current && to && current.contains(to)) return;
    hide();
  });
  container.addEventListener('pointerdown', hide, true);
  container.addEventListener('wheel', hide, { passive: true, capture: true });
}
