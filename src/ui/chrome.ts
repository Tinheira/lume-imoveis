import { agency } from '../data/agency';
import { $ } from '../utils/dom';

/** Menu, cabeçalho que fica sólido ao rolar, dados da agência e lista de contatos. */
export function initChrome() {
  const nav = $('#nav');
  const toggle = $<HTMLButtonElement>('#menu-toggle');
  const header = $('.header');

  const set = (open: boolean) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('is-locked', open);
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      set(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => e.matches && set(false));

  const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 60);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  document.querySelectorAll<HTMLElement>('[data-agency]').forEach((el) => {
    const v = agency[el.dataset.agency as 'name' | 'creci'];
    if (typeof v === 'string') el.textContent = v;
  });

  const list = $('#contact-list');
  const items: string[] = [];
  items.push(agency.phone ? `Telefone: ${agency.phone.display}` : 'Telefone: [A DEFINIR]');
  items.push(agency.email ? `E-mail: ${agency.email}` : 'E-mail: [A DEFINIR]');
  items.push(agency.address ? `Endereço: ${agency.address}` : 'Endereço: [A DEFINIR]');
  items.forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    list.append(li);
  });
}
