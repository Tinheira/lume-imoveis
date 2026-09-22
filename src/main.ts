import './styles/main.css';
import './styles/stage.css';
import { properties } from './data/properties';
import { initChrome } from './ui/chrome';
import { initDetail } from './ui/detail';
import { Explore } from './ui/explore';
import { initForm } from './ui/form';
import { initListings } from './ui/listings';
import { initTour } from './ui/tour';
import { $ } from './utils/dom';
import { detectQuality, hasWebGL, prefersReducedMotion, saveData } from './utils/env';

initChrome();
initForm();

// ───────── carregamento ─────────
const loaderEl = $('#loader');
const fill = $('#loader-fill');
const bar = $('.loader__bar');
const status = $('#loader-status');
const enterBtn = $<HTMLButtonElement>('#loader-enter');
const skipBtn = $<HTMLButtonElement>('#loader-skip');
document.body.classList.add('is-locked');
skipBtn.focus({ preventScroll: true });
const setProgress = (p: number, label?: string) => {
  const v = Math.max(0, Math.min(1, p));
  fill.style.transform = `scaleX(${v})`;
  bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  if (label) status.textContent = `${label}  ${Math.round(v * 100)}%`;
};
const hideLoader = () => {
  loaderEl.classList.add('is-done');
  document.body.classList.remove('is-locked');
  setTimeout(() => loaderEl.remove(), 1000);
};

// ───────── rotas por hash: #/imovel/<slug>[/tour/<n>] ─────────
const ROUTE = /^#\/imovel\/([^/]+)(?:\/tour\/(\d+))?$/;
const parse = () => {
  const m = ROUTE.exec(location.hash);
  return m ? { slug: m[1], room: m[2] === undefined ? null : Number(m[2]) } : null;
};
const setHash = (hash: string, replace = false) => history[replace ? 'replaceState' : 'pushState'](null, '', hash);

let explore: Explore | null = null;
let syncing = false;
let lastSlug = properties[0].slug;

initListings((slug) => openDetail(slug));

function contactFor(slug: string) {
  const p = properties.find((x) => x.slug === slug);
  if (!p) return;
  (document.querySelector('#f-mensagem') as HTMLTextAreaElement).value = `Tenho interesse no imóvel "${p.title}" (${p.neighborhood}) e gostaria de agendar uma visita.`;
  ($('#f-interesse') as HTMLSelectElement).value = p.purpose === 'venda' ? 'Comprar um imóvel' : 'Alugar um imóvel';
  detail.close();
  void explore?.exit();
  $('#contato').scrollIntoView({ behavior: 'smooth' });
}

const detail = initDetail({
  openTour: (slug, room) => void openTour(slug, room),
  contact: (p) => contactFor(p.slug),
  home: () => goHome(),
});
const tour = initTour();

/** Fecha tour e ficha, sai do bairro e volta ao topo da página. */
function goHome() {
  syncing = true;
  tour.close();
  detail.close();
  void explore?.exit();
  document.body.classList.remove('is-locked');
  history.replaceState(null, '', location.pathname + '#inicio');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => (syncing = false), 150);
}

function openDetail(slug: string) {
  if (detail.open(slug) && !syncing) setHash(`#/imovel/${slug}`);
}
function setTourCloseLabel(fromStreet: boolean) {
  $('#tour-close').innerHTML = fromStreet ? '<span aria-hidden="true">←</span> Voltar para a rua' : '<span aria-hidden="true">←</span> Voltar ao imóvel';
}

async function openTour(slug: string, room: number) {
  setTourCloseLabel(!!explore?.active && !detail.dialog.open);
  if (!detail.dialog.open && !explore?.active) detail.open(slug);
  if ((await tour.open(slug, room)) && !syncing) setHash(`#/imovel/${slug}/tour/${room}`);
}

tour.setHandlers({
  onHome: () => goHome(),
  onRoom: (slug, i) => {
    lastSlug = slug;
    if (!syncing) setHash(`#/imovel/${slug}/tour/${i}`, true);
  },
  onClose: () => {
    if (syncing) return;
    // tour aberto a partir do bairro: sai pela porta e volta para a calçada do imóvel em que parou
    if (explore?.active && !detail.dialog.open) {
      history.replaceState(null, '', location.pathname + '#inicio');
      void explore.afterTour(lastSlug);
      return;
    }
    const r = parse();
    if (!r) return;
    if (detail.current?.slug !== r.slug) detail.open(r.slug);
    setHash(`#/imovel/${r.slug}`, true);
  },
});
detail.dialog.addEventListener('close', () => {
  if (!tour.dialog.open) document.body.classList.toggle('is-locked', !!explore?.active);
  if (!syncing && parse()) setHash(explore?.active ? '#inicio' : '#imoveis', true);
});

function sync() {
  const r = parse();
  syncing = true;
  try {
    if (!r) {
      tour.close();
      detail.close();
    } else if (r.room === null) {
      tour.close();
      detail.open(r.slug);
    } else {
      if (!detail.dialog.open || detail.current?.slug !== r.slug) detail.open(r.slug);
      void tour.open(r.slug, r.room);
    }
  } finally {
    setTimeout(() => (syncing = false), 50);
  }
}
window.addEventListener('popstate', sync);

// ───────── o bairro em 3D ─────────
let resolveReady!: (e: Explore | null) => void;
const ready = new Promise<Explore | null>((r) => (resolveReady = r));

document.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-enter]');
  if (!t) return;
  void ready.then((e) => (e ? e.enter(0) : $('#imoveis').scrollIntoView({ behavior: 'smooth' })));
});

const wants3d = new URLSearchParams(location.search).get('modo') === '3d';
const can3d = hasWebGL() && (wants3d || (!prefersReducedMotion() && !saveData()));

(async () => {
  if (!can3d) {
    // sem WebGL / movimento reduzido / economia de dados: o site funciona igual, com a foto no hero
    document.querySelectorAll<HTMLElement>('[data-enter]').forEach((b) => (b.hidden = true));
    setProgress(1);
    hideLoader();
    resolveReady(null);
    if (parse()) sync();
    return;
  }
  try {
    setProgress(0.04, 'Carregando o bairro…');
    const { StreetStage } = await import('./3d/street');
    const stage = await StreetStage.create($('#stage-canvas'), {
      count: properties.length,
      quality: detectQuality(),
      reducedMotion: false,
      onProgress: (p, label) => setProgress(0.08 + p * 0.92, label),
    });
    $('#stage').classList.add('is-live');
    explore = new Explore(stage, {
      openTour: (slug) => {
        setTourCloseLabel(true);
        lastSlug = slug;
        setHash(`#/imovel/${slug}/tour/0`, true);
        void tour.open(slug, 0);
      },
      openDetail: (slug) => openDetail(slug),
      contact: (slug) => contactFor(slug),
    });
    resolveReady(explore);
    setProgress(1, 'Bairro pronto.');
    status.textContent = 'O bairro está pronto.';
    enterBtn.hidden = false;
    enterBtn.focus({ preventScroll: true });
    if (parse()) {
      hideLoader();
      sync();
    }
  } catch (err) {
    console.warn('3D indisponível; seguindo com a versão simples.', err);
    document.querySelectorAll<HTMLElement>('[data-enter]').forEach((b) => (b.hidden = true));
    hideLoader();
    resolveReady(null);
  }
})();

enterBtn.addEventListener('click', () => {
  hideLoader();
  void explore?.enter(0);
});
skipBtn.addEventListener('click', hideLoader);
