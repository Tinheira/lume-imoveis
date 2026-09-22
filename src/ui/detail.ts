import { agency, isDemo } from '../data/agency';
import { brl, bySlug, galleryOf, kindLabel, priceLabel, purposeLabel, type Property } from '../data/properties';
import { $ } from '../utils/dom';
import { icons } from './icons';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface DetailHandlers {
  openTour: (slug: string, room: number) => void;
  contact: (p: Property) => void;
  home: () => void;
}

/** Diálogo com a ficha completa do imóvel e uma galeria de fotos navegável. */
export function initDetail(h: DetailHandlers) {
  const dlg = $<HTMLDialogElement>('#detail');
  const body = $('#detail-body');
  const scroll = $('#detail-scroll');
  let current: Property | null = null;
  let photo = 0;

  const render = (p: Property) => {
    const hasTour = p.rooms.length > 0;
    const items = galleryOf(p);
    const globe = icons.globe.replace('<svg', '<svg width="18" height="18"');
    const wa = agency.whatsapp
      ? `<a class="btn btn--ghost" href="https://wa.me/${agency.whatsapp.number}?text=${encodeURIComponent(`${agency.whatsapp.message} ${p.title}`)}" rel="noopener noreferrer">WhatsApp</a>`
      : '';
    body.innerHTML = `
      <div class="gallery" role="group" aria-roledescription="galeria" aria-label="Fotos do imóvel">
        <div class="gallery__main">
          <img id="g-main" src="${items[0].full}" alt="${esc(items[0].alt)}" width="1400" height="900" />
          <button class="gallery__nav gallery__nav--prev" type="button" id="g-prev" aria-label="Foto anterior">‹</button>
          <button class="gallery__nav gallery__nav--next" type="button" id="g-next" aria-label="Próxima foto">›</button>
          <span class="gallery__count" id="g-count" aria-live="polite"></span>
          <button class="btn btn--clay btn--sm gallery__room" type="button" id="g-room" hidden>${globe} Ver este cômodo em 360°</button>
          ${hasTour ? `<button class="btn btn--clay gallery__tour" type="button" data-room="0">${globe} Caminhar pelo imóvel em 360°</button>` : ''}
        </div>
        <div class="gallery__thumbs" id="g-thumbs" role="group" aria-label="Miniaturas">
          ${items
            .map(
              (it, i) =>
                `<button class="thumb" type="button" data-photo="${i}" aria-label="Foto ${i + 1} de ${items.length}"><img src="${it.thumb}" alt="" width="640" height="411" loading="lazy" />${it.room !== undefined ? '<span>360°</span>' : ''}</button>`,
            )
            .join('')}
        </div>
      </div>
      <div class="detail__cols">
        <div>
          <p class="eyebrow eyebrow--dark">${purposeLabel(p.purpose)} · ${kindLabel(p.kind)}</p>
          <h2 id="detail-title" tabindex="-1">${esc(p.title)}</h2>
          <p class="detail__where">${esc(p.neighborhood)}</p>
          <ul class="specs" aria-label="Características">
            <li>${icons.area}${p.area} m²</li>
            <li>${icons.bed}${p.bedrooms} quartos${p.suites ? ` (${p.suites} ${p.suites === 1 ? 'suíte' : 'suítes'})` : ''}</li>
            <li>${icons.bath}${p.bathrooms} banheiros</li>
            <li>${icons.car}${p.parking} ${p.parking === 1 ? 'vaga' : 'vagas'}</li>
          </ul>
          <p class="detail__desc">${esc(p.description)}</p>
          <h3>Diferenciais</h3>
          <ul class="features">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>
        <aside class="detail__aside" aria-label="Valores e contato">
          <p class="detail__price">${priceLabel(p)}</p>
          <div class="detail__facts">
            ${p.condo ? `<p>Condomínio: <strong>${brl(p.condo)}</strong></p>` : ''}
            <p>Finalidade: <strong>${p.purpose === 'venda' ? 'Venda' : 'Aluguel'}</strong></p>
            <p>Fotos: <strong>${items.length}</strong>${hasTour ? ` · Cômodos em 360°: <strong>${p.rooms.length}</strong>` : ''}</p>
          </div>
          ${hasTour ? `<button class="btn btn--clay" type="button" data-room="0">Caminhar pelo imóvel em 360°</button>` : ''}
          <button class="btn btn--forest" type="button" id="detail-contact">Agendar visita</button>
          ${wa}
          ${isDemo ? `<p class="detail__demo">Imóvel de demonstração: dados e imagens ilustrativos.</p>` : ''}
        </aside>
      </div>`;
    show(0);
  };

  /** Mostra a foto `i` da galeria. */
  function show(i: number) {
    if (!current) return;
    const items = galleryOf(current);
    photo = ((i % items.length) + items.length) % items.length;
    const it = items[photo];
    const main = $<HTMLImageElement>('#g-main');
    main.src = it.full;
    main.alt = it.alt;
    $('#g-count').textContent = `${photo + 1} / ${items.length}`;
    const roomBtn = $<HTMLButtonElement>('#g-room');
    roomBtn.hidden = it.room === undefined;
    roomBtn.dataset.room = String(it.room ?? 0);
    const thumbs = $('#g-thumbs');
    thumbs.querySelectorAll<HTMLElement>('.thumb').forEach((t, k) => {
      if (k === photo) {
        t.setAttribute('aria-current', 'true');
        thumbs.scrollTo({ left: t.offsetLeft - (thumbs.clientWidth - t.clientWidth) / 2, behavior: 'smooth' });
      } else t.removeAttribute('aria-current');
    });
    // pré-carrega a vizinha
    new Image().src = items[(photo + 1) % items.length].full;
  }

  body.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const room = t.closest<HTMLElement>('[data-room]');
    if (room && current) return h.openTour(current.slug, Number(room.dataset.room));
    const th = t.closest<HTMLElement>('[data-photo]');
    if (th) return show(Number(th.dataset.photo));
    if (t.closest('#g-prev')) return show(photo - 1);
    if (t.closest('#g-next')) return show(photo + 1);
    if (t.closest('#g-main')) return void $('.gallery__main').requestFullscreen?.();
    if (t.closest('#detail-contact') && current) h.contact(current);
  });
  dlg.addEventListener('keydown', (e) => {
    if (!current || $('#tour-dialog').hasAttribute('open')) return;
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') show(photo + 1);
    else if (e.key === 'ArrowLeft') show(photo - 1);
    else return;
    e.preventDefault();
  });
  $('#detail-back').addEventListener('click', () => dlg.close());
  $('#detail-home').addEventListener('click', () => h.home());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });

  return {
    dialog: dlg,
    get current() {
      return current;
    },
    open(slug: string) {
      const p = bySlug.get(slug);
      if (!p) return false;
      current = p;
      render(p);
      scroll.scrollTop = 0;
      if (!dlg.open) dlg.showModal();
      document.body.classList.add('is-locked');
      $('#detail-title').focus({ preventScroll: true });
      return true;
    },
    close() {
      if (dlg.open) dlg.close();
    },
  };
}
