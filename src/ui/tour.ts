import type { PanoView } from '../3d/pano';
import { bySlug, properties, type Property } from '../data/properties';
import { hasWebGL, prefersReducedMotion } from '../utils/env';
import { $ } from '../utils/dom';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Todos os cômodos de todos os imóveis com tour, em sequência: é o "percurso" que se caminha. */
const toured = properties.filter((p) => p.rooms.length > 0);
const journey = toured.flatMap((p) => p.rooms.map((_, i) => ({ p, i })));

/**
 * Tour virtual 360° com caminhada.
 * • Roda do mouse, ↑/↓ da tela ou as setas no chão: caminha pelos cômodos (sem corte seco) e, ao fim de
 *   um imóvel, segue para o próximo.
 * • Arrastar: olhar em volta. Ctrl + roda / pinça / botões +/−: zoom.
 */
export function initTour() {
  const dlg = $<HTMLDialogElement>('#tour-dialog');
  const stage = $('#tour-stage');
  const flat = $('#tour-flat');
  const loading = $('#tour-loading');
  const loadingText = $('#tour-loading-text');
  const propLabel = $('#tour-heading');
  const roomLabel = $('#tour-room');
  const progress = $('#tour-progress');
  const roomsEl = $('#tour-rooms');
  const hint = $('#tour-hint');
  const rotateBtn = $<HTMLButtonElement>('#tour-rotate');
  const tools = $('.tour__tools');
  const nextBtn = $<HTMLButtonElement>('#walk-next');
  const prevBtn = $<HTMLButtonElement>('#walk-prev');
  const nextLabel = $('#walk-next-label');
  const prevLabel = $('#walk-prev-label');

  let view: PanoView | null = null;
  let mod: typeof import('../3d/pano') | null = null;
  let prop: Property | null = null;
  let pos = 0; // posição atual no percurso
  let flatMode = false;
  let token = 0;
  let busy = false;
  let wheelLock = 0;
  const handlers: { onRoom?: (slug: string, room: number) => void; onClose?: () => void; onHome?: () => void } = {};

  const at = (n: number) => journey[((n % journey.length) + journey.length) % journey.length];

  const urls = (pano: string) => {
    const pick = mod && view ? mod.pickResolution(view.renderer) : 2048;
    return [pick, 4096, 2048].filter((v, i, a) => a.indexOf(v) === i && v <= Math.max(pick, 2048)).map((r) => `/pano/${pano}-${r}.webp`);
  };

  function renderProperty(p: Property) {
    prop = p;
    propLabel.textContent = p.title;
    roomsEl.innerHTML = p.rooms
      .map(
        (r, i) =>
          `<button class="room" type="button" data-i="${i}" aria-label="${esc(r.label)}"><img src="/pano/${r.pano}-thumb.webp" alt="" width="640" height="400" /><span>${esc(r.label)}</span></button>`,
      )
      .join('');
    roomsEl.hidden = p.rooms.length < 2;
  }

  /** Atualiza título, progresso, miniaturas e rótulos das setas para a posição `n`. */
  function labelFor(n: number) {
    const { p, i } = at(n);
    if (p !== prop) renderProperty(p);
    const tourIndex = toured.indexOf(p);
    roomLabel.textContent = p.rooms[i].label;
    progress.textContent = `Imóvel ${tourIndex + 1} de ${toured.length} · Cômodo ${i + 1} de ${p.rooms.length}`;
    roomsEl.querySelectorAll('button').forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    const nx = at(n + 1);
    const pv = at(n - 1);
    nextLabel.textContent = nx.p === p ? `Seguir: ${nx.p.rooms[nx.i].label}` : `Próximo imóvel: ${nx.p.title}`;
    prevLabel.textContent = pv.p === p ? `Voltar: ${pv.p.rooms[pv.i].label}` : `Imóvel anterior: ${pv.p.title}`;
    handlers.onRoom?.(p.slug, i);
  }

  /**
   * Vai para a posição `n` do percurso. Sem `instant`, CAMINHA até lá (gira, avança e dissolve) em vez de trocar a imagem.
   */
  async function goTo(n: number, { instant = false, dir = 1 }: { instant?: boolean; dir?: 1 | -1 } = {}) {
    const total = journey.length;
    n = ((n % total) + total) % total;
    const { p, i } = at(n);
    const room = p.rooms[i];
    const tk = ++token;
    busy = true;
    const walking = !instant && !flatMode && !!view;
    if (walking) progress.textContent = 'Caminhando…';
    else {
      loading.classList.remove('is-done');
      loadingText.textContent = 'Carregando o cômodo…';
      labelFor(n);
    }

    if (flatMode) {
      flat.innerHTML = `<img src="/pano/${room.pano}-2048.webp" alt="Panorama de ${esc(room.label)}" />`;
      await flat.querySelector('img')!.decode().catch(() => undefined);
      if (tk !== token) return;
      flat.scrollLeft = (flat.scrollWidth - flat.clientWidth) * room.u;
      loading.classList.add('is-done');
      pos = n;
      busy = false;
      return;
    }

    let ok = false;
    for (const url of urls(room.pano)) {
      try {
        if (walking) {
          await view!.walkTo(url, room.u, dir, () => {
            loading.classList.remove('is-done');
            loadingText.textContent = 'Carregando o cômodo…';
          });
        } else await view!.show(url, room.u, { instant });
        ok = true;
        break;
      } catch {
        /* tenta a próxima resolução */
      }
    }
    if (tk !== token) return;
    busy = false;
    if (!ok) {
      loadingText.textContent = 'Não foi possível carregar este cômodo.';
      loading.classList.remove('is-done');
      labelFor(pos);
      return;
    }
    pos = n;
    labelFor(n);
    loading.classList.add('is-done');
    const nx = at(n + 1);
    new Image().src = urls(nx.p.rooms[nx.i].pano)[0]; // pré-carrega o próximo trecho da caminhada
  }

  const step = (dir: 1 | -1) => (busy ? Promise.resolve() : goTo(pos + dir, { dir }));

  async function open(slug: string, room = 0) {
    const p = bySlug.get(slug);
    if (!p || !p.rooms.length) return false;
    view?.dispose();
    view = null;
    prop = null;
    busy = false;
    hint.classList.remove('is-gone');
    hint.textContent = window.matchMedia('(pointer: coarse)').matches ? 'Toque na seta para caminhar' : 'Role o mouse para caminhar pelos cômodos · arraste para olhar';
    document.body.classList.add('is-locked');
    if (!dlg.open) dlg.showModal();
    loading.classList.remove('is-done');

    flatMode = !hasWebGL();
    flat.hidden = !flatMode;
    tools.hidden = flatMode;
    nextBtn.hidden = prevBtn.hidden = true;
    if (!flatMode) {
      try {
        mod ??= await import('../3d/pano');
        view = new mod.PanoView(stage, { interactive: true, autoRotate: true, maxDpr: 2, wheelZoom: false, reducedMotion: prefersReducedMotion() });
        view.onInteract = () => hint.classList.add('is-gone');
        view.onFrame = placeArrows;
        rotateBtn.setAttribute('aria-pressed', 'true');
      } catch {
        flatMode = true;
        flat.hidden = false;
        tools.hidden = true;
      }
    }
    const start = journey.findIndex((j) => j.p === p && j.i === Math.min(room, p.rooms.length - 1));
    await goTo(start, { instant: true });
    return true;
  }

  /** Posiciona as setas de caminhada no "chão", na direção em frente/atrás do cômodo. */
  function placeArrows() {
    if (!view || !prop) return;
    const show = !view.walkingNow && !busy && journey.length > 1;
    for (const [btn, off] of [
      [nextBtn, 0],
      [prevBtn, 180],
    ] as const) {
      const p = view.project(view.forwardLon + off, -16);
      // fora do quadro (mas à frente): a seta gruda na borda para continuar tocável
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const x = Math.min(w - 60, Math.max(60, p.x));
      const y = Math.min(h - 250, Math.max(160, p.y));
      btn.hidden = !show || !p.front;
      if (!btn.hidden) btn.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }

  function teardown() {
    token++;
    view?.dispose();
    view = null;
    flat.innerHTML = '';
    prop = null;
    busy = false;
    if (!$('#detail').hasAttribute('open')) document.body.classList.remove('is-locked');
    handlers.onClose?.();
  }

  roomsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (!b || busy || !prop) return;
    const target = pos - at(pos).i + Number(b.dataset.i);
    if (target !== pos) void goTo(target, { dir: target > pos ? 1 : -1 });
  });
  $('#tour-close').addEventListener('click', () => dlg.close());
  $('#tour-home').addEventListener('click', () => handlers.onHome?.());
  dlg.addEventListener('close', teardown);
  $('#tour-prev').addEventListener('click', () => void step(-1));
  $('#tour-next').addEventListener('click', () => void step(1));
  nextBtn.addEventListener('click', () => void step(1));
  prevBtn.addEventListener('click', () => void step(-1));
  $('#tour-zoom-in').addEventListener('click', () => view?.zoom(-10));
  $('#tour-zoom-out').addEventListener('click', () => view?.zoom(10));
  rotateBtn.addEventListener('click', () => {
    if (!view) return;
    view.setAutoRotate(!view.isAutoRotating);
    rotateBtn.setAttribute('aria-pressed', String(view.isAutoRotating));
  });
  $('#tour-full').addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void dlg.requestFullscreen?.();
  });

  // Roda do mouse: caminha para frente/trás (Ctrl + roda = zoom, tratado pelo visualizador)
  dlg.addEventListener(
    'wheel',
    (e) => {
      if (!dlg.open || e.ctrlKey) return;
      e.preventDefault();
      const now = performance.now();
      if (busy || now - wheelLock < 400 || Math.abs(e.deltaY) < 8) return;
      wheelLock = now;
      hint.classList.add('is-gone');
      void step(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false },
  );

  dlg.addEventListener('keydown', (e) => {
    if (!view || !prop) return;
    const k = e.shiftKey ? 25 : 10;
    switch (e.key) {
      case 'ArrowLeft':
        view.turn(-k);
        break;
      case 'ArrowRight':
        view.turn(k);
        break;
      case 'ArrowUp':
        view.turn(0, k);
        break;
      case 'ArrowDown':
        view.turn(0, -k);
        break;
      case '+':
      case '=':
        view.zoom(-8);
        break;
      case '-':
        view.zoom(8);
        break;
      case 'PageDown':
      case 'n':
        void step(1);
        break;
      case 'PageUp':
      case 'p':
        void step(-1);
        break;
      case 'Home':
        handlers.onHome?.();
        break;
      default:
        return;
    }
    e.preventDefault();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });

  return {
    dialog: dlg,
    open,
    close: () => dlg.open && dlg.close(),
    setHandlers: (h: typeof handlers) => Object.assign(handlers, h),
  };
}
