import { brl, kindLabel, priceLabel, properties, purposeLabel, type Kind, type Property, type Purpose } from '../data/properties';
import { $ } from '../utils/dom';
import { icons } from './icons';

export interface Filters {
  purpose: '' | Purpose;
  kind: '' | Kind;
  tour: boolean;
  q: string;
  sort: 'destaque' | 'menor' | 'maior';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function card(p: Property, i: number) {
  const tour = p.rooms.length ? `<span class="pill pill--tour">${icons.globe}Tour 360°</span>` : '';
  const cond = p.condo ? ` <small>· cond. ${brl(p.condo)}</small>` : '';
  const img = `<img src="/img/${p.cover}-800.webp" srcset="/img/${p.cover}-800.webp 800w, /img/${p.cover}-1600.webp 1600w" sizes="(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw" width="800" height="600" alt="${esc(p.coverAlt)}" loading="lazy" decoding="async" />`;
  return `
  <li class="card" style="animation-delay:${Math.min(i, 8) * 60}ms">
    <div class="card__media">
      ${img}
      <span class="pill pill--left">${purposeLabel(p.purpose)} · ${kindLabel(p.kind)}</span>
      ${tour}
    </div>
    <div class="card__body">
      <p class="card__price">${priceLabel(p)}${cond}</p>
      <h3 class="card__title"><button type="button" data-open="${p.slug}">${esc(p.title)}</button></h3>
      <p class="card__where">${esc(p.neighborhood)}</p>
      <ul class="specs" aria-label="Características">
        <li>${icons.area}${p.area} m²</li>
        <li>${icons.bed}${p.bedrooms} ${p.bedrooms === 1 ? 'quarto' : 'quartos'}</li>
        <li>${icons.bath}${p.bathrooms} ${p.bathrooms === 1 ? 'banheiro' : 'banheiros'}</li>
        <li>${icons.car}${p.parking} ${p.parking === 1 ? 'vaga' : 'vagas'}</li>
      </ul>
    </div>
  </li>`;
}

export function initListings(onOpen: (slug: string) => void) {
  const grid = $('#grid');
  const results = $('#results');
  const empty = $('#empty');
  const sort = $<HTMLSelectElement>('#sort');
  const state: Filters = { purpose: '', kind: '', tour: false, q: '', sort: 'destaque' };
  const bag = state as unknown as Record<string, string>;

  const apply = (): Property[] => {
    const q = norm(state.q.trim());
    let list = properties.filter(
      (p) =>
        (!state.purpose || p.purpose === state.purpose) &&
        (!state.kind || p.kind === state.kind) &&
        (!state.tour || p.rooms.length > 0) &&
        (!q || norm([p.title, p.neighborhood, p.summary, p.description, ...p.features].join(' ')).includes(q)),
    );
    if (state.sort === 'destaque') list = [...list].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    else {
      const dir = state.sort === 'menor' ? 1 : -1;
      // venda e aluguel têm ordens de grandeza diferentes: ordena dentro de cada finalidade
      list = [...list].sort((a, b) => (a.purpose === b.purpose ? dir * (a.price - b.price) : a.purpose === 'venda' ? -1 : 1));
    }
    return list;
  };

  const render = () => {
    const list = apply();
    grid.innerHTML = list.map(card).join('');
    empty.hidden = list.length > 0;
    const q = state.q.trim();
    results.replaceChildren();
    if (list.length) {
      results.append(`${list.length} ${list.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}`);
    }
    if (q) {
      results.append(` para “${q}” `);
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'linkbtn';
      clear.textContent = 'limpar busca';
      clear.addEventListener('click', () => {
        state.q = '';
        render();
      });
      results.append(clear);
    }
    document.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => {
      const f = c.dataset.filter as string;
      const on = f === 'tour' ? state.tour : bag[f] === c.dataset.value;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    sort.value = state.sort;
  };

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const chip = t.closest<HTMLButtonElement>('.chip');
    if (chip) {
      const f = chip.dataset.filter!;
      if (f === 'tour') state.tour = !state.tour;
      else bag[f] = chip.dataset.value ?? '';
      render();
      return;
    }
    const open = t.closest<HTMLElement>('[data-open]');
    if (open) onOpen(open.dataset.open!);
  });
  sort.addEventListener('change', () => {
    state.sort = sort.value as Filters['sort'];
    render();
  });
  $('#clear-filters').addEventListener('click', () => {
    Object.assign(state, { purpose: '', kind: '', tour: false, q: '', sort: 'destaque' } satisfies Filters);
    render();
  });

  render();
  return {
    set(partial: Partial<Filters>) {
      Object.assign(state, partial);
      render();
    },
  };
}
