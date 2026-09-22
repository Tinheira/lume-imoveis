import type { StreetStage } from '../3d/street';
import { brl, kindLabel, priceLabel, properties, purposeLabel, shortPrice, type Property } from '../data/properties';
import { $ } from '../utils/dom';
import { icons } from './icons';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ExploreHooks {
  /** abre o tour 360° (caminhada) do imóvel, já com a porta atravessada */
  openTour: (slug: string) => void;
  openDetail: (slug: string) => void;
  contact: (slug: string) => void;
}

/** Metros andados por "unidade" de rolagem da roda / do dedo. */
const WHEEL_M = 0.055;
const TOUCH_M = 0.16;
const KEY_M = 9;

/**
 * Modo "caminhar pela rua": a roda do mouse (ou o dedo, ou as setas do teclado) anda pela rua de forma contínua.
 * Ao parar diante de um imóvel abre-se o painel; chips, etiquetas e mini-mapa levam a qualquer um.
 * Não conhece Three.js além da API pública do palco.
 */
export class Explore {
  private exploring = false;
  private busy = false;
  private trigger: HTMLElement | null = null;
  private hotspotEls = new Map<string, HTMLElement>();
  /** imóvel diante da câmera (-1 = andando entre imóveis) e o último visitado */
  private focus = -1;
  private lastFocus = 0;

  private stageEl = $('#stage');
  private hud = $('#hud');
  private caption = $('#hud-caption');
  private chips = $('#hud-chips');
  private prev = $<HTMLButtonElement>('#hud-prev');
  private next = $<HTMLButtonElement>('#hud-next');
  private hint = $('#hud-hint');
  private panel = $('#panel');
  private road = $('#hud-road');
  private roadMark = $('#road-mark');

  constructor(private stage: StreetStage, private hooks: ExploreHooks) {
    this.buildHotspots();
    this.buildChips();
    this.buildRoad();
    this.bind();
    stage.bindHotspots(this.hotspotEls);
    stage.onInteract = () => this.hint.classList.add('is-gone');
    stage.onFocus = (i) => this.onFocus(i);
    stage.onSettle = (i) => this.onSettle(i);
    stage.onWalk = (t) => (this.roadMark.style.left = `${(t * 100).toFixed(2)}%`);
  }

  get active() {
    return this.exploring;
  }

  // ───────── construção ─────────

  private buildHotspots() {
    const layer = $('#hotspots');
    properties.forEach((p, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'hotspot';
      wrap.dataset.i = String(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot__btn';
      btn.setAttribute('aria-label', `${p.title}, ${purposeLabel(p.purpose)}, ${priceLabel(p)}`);
      btn.innerHTML = `<span class="hotspot__dot"></span><span class="hotspot__tag"><b>${esc(shortPrice(p))}</b><i>${esc(p.neighborhood)}</i></span>`;
      btn.addEventListener('click', () => void this.select(i));
      wrap.append(btn);
      layer.append(wrap);
      this.hotspotEls.set(String(i), wrap);
    });
  }

  private buildChips() {
    properties.forEach((p, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = String(i);
      b.innerHTML = `<span>${i + 1}</span>${esc(p.kind === 'casa' ? 'Casa' : 'Apto')} · ${esc(p.neighborhood)}`;
      b.addEventListener('click', () => void this.select(i));
      li.append(b);
      this.chips.append(li);
    });
  }

  /** Mini-mapa da rua: um ponto por imóvel e o marcador da posição atual. */
  private buildRoad() {
    const n = properties.length;
    properties.forEach((p, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hud__road-dot';
      dot.dataset.i = String(i);
      dot.style.left = `${(((i + 0.9) / (n + 1.1)) * 100).toFixed(2)}%`;
      dot.setAttribute('aria-label', `Ir ao imóvel ${i + 1}: ${p.title}`);
      dot.addEventListener('click', () => void this.select(i));
      this.road.append(dot);
    });
  }

  private bind() {
    $('#hud-exit').addEventListener('click', () => void this.exit());
    $('#hud-list').addEventListener('click', () => {
      void this.exit();
      document.querySelector('#imoveis')?.scrollIntoView({ behavior: 'smooth' });
    });
    this.prev.addEventListener('click', () => void this.step(-1));
    this.next.addEventListener('click', () => void this.step(1));

    document.addEventListener('keydown', (e) => {
      if (!this.exploring || this.busy || document.querySelector('dialog[open]')) return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      switch (e.key) {
        case 'Escape':
          void this.exit();
          break;
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          this.stage.walkBy(KEY_M);
          break;
        case 'ArrowUp':
        case 'PageUp':
          this.stage.walkBy(-KEY_M);
          break;
        case 'ArrowRight':
          void this.step(1);
          break;
        case 'ArrowLeft':
          void this.step(-1);
          break;
        case 'Enter':
          if (this.focus >= 0) void this.enterCurrent();
          break;
        default:
          return;
      }
      e.preventDefault();
    });

    // roda do mouse = andar pela rua, de forma contínua
    this.stageEl.addEventListener(
      'wheel',
      (e) => {
        if (!this.exploring || (e.target as HTMLElement).closest('.panel')) return;
        e.preventDefault();
        if (this.busy) return;
        const dy = Math.max(-260, Math.min(260, e.deltaY));
        this.stage.walkBy(dy * WHEEL_M);
      },
      { passive: false },
    );
    // dedo: arrastar para cima anda para frente
    let y0: number | null = null;
    let x0 = 0;
    let mode: 'walk' | 'look' | null = null;
    this.stageEl.addEventListener(
      'touchstart',
      (e) => {
        y0 = e.touches[0].clientY;
        x0 = e.touches[0].clientX;
        mode = null;
      },
      { passive: true },
    );
    this.stageEl.addEventListener(
      'touchmove',
      (e) => {
        if (!this.exploring || y0 === null || this.busy || (e.target as HTMLElement).closest('.panel, .hud__chips, .hud__road')) return;
        const t = e.touches[0];
        const dy = y0 - t.clientY;
        const dx = t.clientX - x0;
        if (mode === null && Math.hypot(dx, dy) > 12) mode = Math.abs(dy) >= Math.abs(dx) ? 'walk' : 'look';
        if (mode === 'walk') {
          this.stage.walkBy(dy * TOUCH_M);
          y0 = t.clientY;
        }
      },
      { passive: true },
    );
    this.stageEl.addEventListener('touchend', () => (y0 = null), { passive: true });
  }

  // ───────── foco e parada (vindos do palco) ─────────

  private setChipsAndHotspots(i: number) {
    this.chips.querySelectorAll('button').forEach((b) => {
      const on = Number(b.dataset.i) === i;
      if (on) {
        b.setAttribute('aria-current', 'true');
        const li = b.parentElement!;
        this.chips.scrollTo({ left: li.offsetLeft - (this.chips.clientWidth - li.clientWidth) / 2, behavior: 'smooth' });
      } else b.removeAttribute('aria-current');
    });
    this.road.querySelectorAll('.hud__road-dot').forEach((d) => d.classList.toggle('is-on', Number((d as HTMLElement).dataset.i) === i));
    this.hotspotEls.forEach((el, id) => el.classList.toggle('is-current', Number(id) === i));
  }

  /** O imóvel em foco mudou (ou nenhum): atualiza legenda, chips e fecha o painel ao sair. */
  private onFocus(i: number) {
    if (!this.exploring) return;
    this.focus = i;
    this.setChipsAndHotspots(i);
    if (i >= 0) {
      this.lastFocus = i;
      const p = properties[i];
      this.caption.innerHTML = `<small>${purposeLabel(p.purpose)} · ${kindLabel(p.kind)}</small><strong>${esc(p.title)}</strong><em>${esc(p.neighborhood)} · ${esc(priceLabel(p))}</em>`;
    } else {
      this.caption.innerHTML = '<small>Rua das Acácias</small><strong>Siga em frente</strong><em>Role o mouse para andar · pare diante de uma casa para ver os detalhes</em>';
      this.panel.hidden = true;
    }
    this.prev.disabled = false;
    this.next.disabled = false;
    this.caption.classList.remove('is-swap');
    void this.caption.offsetWidth;
    this.caption.classList.add('is-swap');
  }

  /** Parou de andar diante de um imóvel: mostra o painel com os dados. */
  private onSettle(i: number) {
    if (!this.exploring || this.busy) return;
    if (i >= 0) this.fillPanel(properties[i]);
    else this.panel.hidden = true;
  }

  private fillPanel(p: Property) {
    const hasTour = p.rooms.length > 0;
    const cond = p.condo ? `<span>Cond. ${brl(p.condo)}</span>` : '';
    this.panel.innerHTML = `
      <button class="panel__close" type="button" id="panel-close" aria-label="Fechar painel">×</button>
      <img class="panel__img" src="/img/${p.cover}-800.webp" alt="${esc(p.coverAlt)}" width="800" height="600" />
      <p class="panel__kicker">${purposeLabel(p.purpose)} · ${kindLabel(p.kind)} · ${esc(p.neighborhood)}</p>
      <h2 class="panel__title" id="panel-title" tabindex="-1">${esc(p.title)}</h2>
      <p class="panel__price">${priceLabel(p)} ${cond}</p>
      <ul class="specs" aria-label="Características">
        <li>${icons.area}${p.area} m²</li>
        <li>${icons.bed}${p.bedrooms} quartos</li>
        <li>${icons.bath}${p.bathrooms} banheiros</li>
        <li>${icons.car}${p.parking} ${p.parking === 1 ? 'vaga' : 'vagas'}</li>
      </ul>
      <p class="panel__body">${esc(p.summary)}</p>
      <div class="panel__actions">
        ${hasTour ? `<button class="btn btn--clay" type="button" data-act="enter">${icons.globe.replace('<svg', '<svg width="18" height="18"')} Entrar e caminhar por dentro</button>` : ''}
        <button class="btn ${hasTour ? 'btn--light' : 'btn--clay'}" type="button" data-act="detail">Ver fotos e detalhes (${p.photos.length + 1})</button>
        <button class="btn btn--light" type="button" data-act="contact">Agendar visita</button>
      </div>`;
    this.panel.hidden = false;
    this.panel.style.animation = 'none';
    void this.panel.offsetWidth;
    this.panel.style.animation = '';
    $('#panel-close').addEventListener('click', () => (this.panel.hidden = true));
    this.panel.querySelector('[data-act=enter]')?.addEventListener('click', () => void this.enterCurrent());
    this.panel.querySelector('[data-act=detail]')?.addEventListener('click', () => this.hooks.openDetail(p.slug));
    this.panel.querySelector('[data-act=contact]')?.addEventListener('click', () => this.hooks.contact(p.slug));
  }

  // ───────── navegação ─────────

  /** Começa o passeio (botão do hero ou do loader): voa até a calçada e começa a caminhada. */
  async enter(startIndex = 0) {
    if (this.exploring) return void this.select(startIndex);
    this.exploring = true;
    this.busy = true;
    this.trigger = document.activeElement as HTMLElement | null;
    document.body.classList.add('is-exploring');
    this.stage.setExploring(true);
    this.hud.hidden = false;
    requestAnimationFrame(() => this.hud.classList.add('is-on'));
    this.hint.textContent = window.matchMedia('(pointer: coarse)').matches ? 'Deslize para cima para andar pela rua' : 'Role o mouse para andar pela rua · arraste para olhar em volta';
    this.hint.classList.remove('is-gone');
    window.setTimeout(() => this.hint.classList.add('is-gone'), 12000);
    $('#hud-exit').focus({ preventScroll: true });
    this.onFocus(-1);
    try {
      await this.stage.startWalk(startIndex);
    } finally {
      this.busy = false;
    }
  }

  /** Caminha até um imóvel (chips, etiquetas, mini-mapa). */
  async select(i: number) {
    if (!this.exploring) return this.enter(i);
    if (this.busy) return;
    this.panel.hidden = true;
    await this.stage.walkToProperty(i);
  }

  private step(dir: 1 | -1) {
    const from = this.focus >= 0 ? this.focus : this.lastFocus;
    const to = Math.max(0, Math.min(properties.length - 1, this.focus >= 0 ? from + dir : from));
    return this.select(to);
  }

  /** Atravessa a porta e abre o tour 360° do imóvel diante da câmera. */
  async enterCurrent() {
    const i = this.focus >= 0 ? this.focus : this.lastFocus;
    if (this.busy) return;
    const p = properties[i];
    if (!p.rooms.length) return this.hooks.openDetail(p.slug);
    this.busy = true;
    this.panel.hidden = true;
    this.hud.classList.add('is-hidden');
    await this.stage.enterDoor(i);
    this.busy = false;
    this.hooks.openTour(p.slug);
  }

  /** O tour foi fechado: volta à calçada do imóvel em que a caminhada parou e retoma o passeio. */
  async afterTour(slug: string) {
    const i = Math.max(0, properties.findIndex((p) => p.slug === slug));
    this.busy = true;
    this.hud.classList.remove('is-hidden');
    await this.stage.leaveDoor(i);
    this.busy = false;
    this.fillPanel(properties[i]);
  }

  async exit() {
    if (!this.exploring) return;
    this.exploring = false;
    document.body.classList.remove('is-exploring');
    this.hud.classList.remove('is-on', 'is-hidden');
    window.setTimeout(() => (this.hud.hidden = !this.exploring), 600);
    this.panel.hidden = true;
    this.stage.setExploring(false);
    this.trigger?.focus({ preventScroll: true });
    this.busy = false;
    await this.stage.overviewShot();
  }
}
