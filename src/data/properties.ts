/**
 * IMÓVEIS DE DEMONSTRAÇÃO.
 * Nomes, bairros, valores e metragens são fictícios. As imagens são ilustrativas:
 * capas e fotos de interiores do Unsplash; panoramas 360° do Poly Haven (CC0) e as
 * "fotos" extraídas deles. Substitua por dados e fotos reais.
 */

export type Purpose = 'venda' | 'aluguel';
export type Kind = 'casa' | 'apartamento';

export interface Room {
  /** nome-base do panorama em public/pano (<pano>-6144|4096|2048.webp e -thumb.webp) */
  pano: string;
  label: string;
  /** direção inicial do olhar / de "seguir em frente", 0–1 ao longo da imagem equiretangular */
  u: number;
}

export interface GalleryItem {
  full: string;
  thumb: string;
  alt: string;
  /** se a foto vem de um cômodo com tour, índice do cômodo (abre o tour ali) */
  room?: number;
}

export interface Property {
  slug: string;
  title: string;
  kind: Kind;
  purpose: Purpose;
  neighborhood: string;
  price: number;
  condo?: number;
  area: number;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parking: number;
  summary: string;
  description: string;
  features: string[];
  /** nome-base da capa em public/img (<cover>-800.webp / -1600.webp) */
  cover: string;
  coverAlt: string;
  /** cômodos do tour, na ordem em que se "caminha" por eles */
  rooms: Room[];
  /** fotos da galeria (a capa vem primeiro automaticamente) */
  photos: GalleryItem[];
  featured?: boolean;
}

const interior = (name: string, alt: string): GalleryItem => ({
  full: `/interior/${name}-1400.webp`,
  thumb: `/interior/${name}-640.webp`,
  alt,
});
const still = (pano: string, tag: string, room: number, alt: string): GalleryItem => ({
  full: `/still/${pano}-${tag}-1400.webp`,
  thumb: `/still/${pano}-${tag}-640.webp`,
  alt,
  room,
});

export const properties: Property[] = [
  {
    slug: 'casa-contemporanea-jardim-das-acacias',
    title: 'Casa contemporânea com jardim',
    kind: 'casa',
    purpose: 'venda',
    neighborhood: 'Jardim das Acácias',
    price: 2890000,
    area: 320,
    bedrooms: 4,
    suites: 3,
    bathrooms: 5,
    parking: 4,
    summary: 'Pé-direito duplo, paredes de vidro e jardim com espelho d’água.',
    description:
      'Projeto contemporâneo com concreto aparente, grandes esquadrias e integração total com o jardim. Living de pé-direito duplo, cozinha aberta e suíte principal com vista panorâmica. Ideal para quem valoriza luz natural e privacidade.',
    features: ['Jardim com espelho d’água', 'Pé-direito duplo', 'Suíte com vista', 'Cozinha integrada', 'Automação de iluminação', 'Piso em porcelanato'],
    cover: 'casa',
    coverAlt: 'Fachada de casa contemporânea de concreto e vidro com jardim e espelho d’água',
    rooms: [
      { pano: 'glasshouse_interior', label: 'Living e suíte panorâmica', u: 0.6 },
      { pano: 'kiara_interior', label: 'Cozinha e sala de estar', u: 0.55 },
      { pano: 'wooden_lounge', label: 'Sala de lazer', u: 0.55 },
      { pano: 'en_suite', label: 'Banheiro da suíte', u: 0.35 },
    ],
    photos: [
      interior('cozinha-ilha', 'Cozinha ampla com ilha central de mármore'),
      interior('sala-solarium', 'Sala solarium com mesa de jantar e muita luz natural'),
      still('glasshouse_interior', 'a', 0, 'Living com paredes de vidro e vista para a paisagem'),
      still('glasshouse_interior', 'c', 0, 'Suíte principal com cama de casal e vista panorâmica'),
      still('kiara_interior', 'b', 1, 'Cozinha com bancada de madeira'),
      still('wooden_lounge', 'a', 2, 'Sala de lazer com sofá e teto de madeira'),
      still('wooden_lounge', 'b', 2, 'Sala de lazer com mesa de bilhar'),
      interior('banho-spa', 'Banheiro com banheira de imersão'),
      still('en_suite', 'c', 3, 'Banheiro da suíte com bancada de granito'),
    ],
    featured: true,
  },
  {
    slug: 'villa-piscina-costa-serena',
    title: 'Villa com piscina e varanda',
    kind: 'casa',
    purpose: 'venda',
    neighborhood: 'Costa Serena',
    price: 4200000,
    area: 280,
    bedrooms: 3,
    suites: 3,
    bathrooms: 4,
    parking: 3,
    summary: 'Piscina com borda infinita, jardim tropical e varanda com vista.',
    description:
      'Casa térrea de alto padrão voltada para o jardim tropical e a piscina. Suítes amplas com acesso direto ao deck, sala de jantar com varanda e acabamentos naturais. Perfeita para receber e para descansar.',
    features: ['Piscina com borda infinita', 'Deck e jardim tropical', 'Três suítes', 'Varanda gourmet', 'Iluminação cênica', 'Segurança 24 h'],
    cover: 'villa',
    coverAlt: 'Villa com telhado de palha e piscina iluminada ao anoitecer',
    rooms: [
      { pano: 'reading_room', label: 'Sala de estar', u: 0.85 },
      { pano: 'cayley_interior', label: 'Jantar e varanda', u: 0.45 },
      { pano: 'relax_inn_seaview_suite', label: 'Suíte principal', u: 0.78 },
      { pano: 'bathroom', label: 'Banheiro com banheira', u: 0.4 },
    ],
    photos: [
      interior('jantar-tropical', 'Sala de jantar aberta para o jardim com palmeiras'),
      still('reading_room', 'a', 0, 'Sala de estar com poltronas e portas de madeira'),
      still('reading_room', 'b', 0, 'Canto da sala de estar com luminária de chão'),
      still('cayley_interior', 'a', 1, 'Varanda com vista para o mar'),
      still('cayley_interior', 'c', 1, 'Sala de jantar com mesa de madeira'),
      still('relax_inn_seaview_suite', 'a', 2, 'Suíte principal com cama de casal'),
      still('relax_inn_seaview_suite', 'c', 2, 'Suíte com espelho, TV e acesso à varanda'),
      interior('banho-vidro', 'Banheiro com box de vidro e banheira'),
      still('bathroom', 'a', 3, 'Banheiro com banheira de canto'),
    ],
    featured: true,
  },
  {
    slug: 'apartamento-vista-panoramica-centro-alto',
    title: 'Apartamento com vista panorâmica',
    kind: 'apartamento',
    purpose: 'venda',
    neighborhood: 'Centro Alto',
    price: 1150000,
    condo: 1250,
    area: 118,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking: 2,
    summary: 'Andar alto, sala ampla e janelões voltados para a cidade.',
    description:
      'Apartamento em andar alto com sala integrada, painel de madeira e janelões do piso ao teto. Planta funcional, três dormitórios e ótima ventilação. Condomínio com lazer completo.',
    features: ['Andar alto', 'Janelões piso-teto', 'Sala integrada', 'Suíte com closet', '2 vagas cobertas', 'Lazer completo'],
    cover: 'panoramico',
    coverAlt: 'Sala de apartamento moderno com sofá de canto e janela com vista para a cidade',
    rooms: [
      { pano: 'brown_photostudio_04', label: 'Sala e área de descanso', u: 0.5 },
      { pano: 'photo_studio_loft_hall', label: 'Sala de estar', u: 0.45 },
      { pano: 'hotel_room', label: 'Suíte', u: 0.6 },
      { pano: 'modern_bathroom', label: 'Banheiro', u: 0.5 },
    ],
    photos: [
      interior('cozinha-branca', 'Cozinha branca com ilha e sala de estar integrada'),
      still('brown_photostudio_04', 'a', 0, 'Sala com janelões e vista para a cidade'),
      still('brown_photostudio_04', 'b', 0, 'Cozinha compacta com cortinas leves'),
      still('photo_studio_loft_hall', 'a', 1, 'Sala de estar com parede verde e janelas altas'),
      still('photo_studio_loft_hall', 'b', 1, 'Canto com parede de tijolos aparentes'),
      still('hotel_room', 'b', 2, 'Suíte com cama de casal e cabeceira em madeira'),
      still('hotel_room', 'c', 2, 'Suíte com TV e bancada de trabalho'),
      still('modern_bathroom', 'a', 3, 'Banheiro com banheira e claraboia'),
      still('modern_bathroom', 'c', 3, 'Box amplo com revestimento cinza'),
    ],
    featured: true,
  },
  {
    slug: 'apartamento-residencial-verde-bosque-alto',
    title: 'Apartamento no Residencial Verde',
    kind: 'apartamento',
    purpose: 'aluguel',
    neighborhood: 'Bosque Alto',
    price: 4800,
    condo: 980,
    area: 96,
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
    parking: 1,
    summary: 'Varandas com jardins verticais em prédio novo e arborizado.',
    description:
      'Apartamento em edifício de arquitetura contemporânea, com varandas ajardinadas e muita luz natural. Dois dormitórios, sendo uma suíte, e áreas comuns cuidadas. Localização tranquila e bem servida.',
    features: ['Varanda ajardinada', 'Prédio novo', 'Suíte', 'Portaria 24 h', 'Bicicletário', 'Aceita pets'],
    cover: 'verde',
    coverAlt: 'Edifício residencial moderno com varandas cobertas de plantas',
    rooms: [
      { pano: 'brown_photostudio_05', label: 'Sala', u: 0.45 },
      { pano: 'small_empty_house', label: 'Cozinha e área de serviço', u: 0.5 },
      { pano: 'lythwood_room', label: 'Dormitório', u: 0.4 },
    ],
    photos: [
      interior('cozinha-jantar', 'Cozinha integrada à sala de jantar com porta para a varanda'),
      interior('cozinha-madeira', 'Cozinha com armários de madeira e bancada de pedra'),
      still('brown_photostudio_05', 'b', 0, 'Sala com painéis de parede e sofá azul'),
      still('brown_photostudio_05', 'c', 0, 'Sala com arranjo decorativo e luz natural'),
      still('small_empty_house', 'c', 1, 'Cozinha com fogão e coifa'),
      still('small_empty_house', 'a', 1, 'Sala vazia com duas janelas e porta de entrada'),
      still('lythwood_room', 'a', 2, 'Dormitório com penteadeira e armário embutido'),
      still('lythwood_room', 'c', 2, 'Dormitório com duas camas de solteiro'),
    ],
  },
  {
    slug: 'apartamento-torre-central-vila-serena',
    title: 'Apartamento na Torre Central',
    kind: 'apartamento',
    purpose: 'aluguel',
    neighborhood: 'Vila Serena',
    price: 6500,
    condo: 1450,
    area: 140,
    bedrooms: 3,
    suites: 2,
    bathrooms: 3,
    parking: 2,
    summary: 'Torre com lobby de vidro e varandas amplas, perto de tudo.',
    description:
      'Apartamento de 140 m² em torre com fachada elegante e hall de entrada envidraçado. Três dormitórios, duas suítes e varanda integrada à sala. Condomínio com academia e espaço gourmet.',
    features: ['Duas suítes', 'Varanda integrada', 'Academia', 'Espaço gourmet', '2 vagas', 'Piso laminado'],
    cover: 'torre',
    coverAlt: 'Torre residencial moderna com varandas e lobby de vidro cercada por árvores',
    rooms: [
      { pano: 'brown_photostudio_03', label: 'Sala', u: 0.6 },
      { pano: 'brown_photostudio_02', label: 'Cozinha e área íntima', u: 0.55 },
      { pano: 'lebombo', label: 'Sala ampla', u: 0.55 },
    ],
    photos: [
      interior('cozinha-bancos', 'Cozinha com ilha e bancos'),
      still('brown_photostudio_03', 'b', 0, 'Sala com piso de madeira e plantas'),
      still('brown_photostudio_03', 'c', 0, 'Sala com lareira decorativa'),
      still('brown_photostudio_02', 'a', 1, 'Área íntima com janelões e cama'),
      still('brown_photostudio_02', 'b', 1, 'Cozinha com prateleiras abertas'),
      still('brown_photostudio_02', 'c', 1, 'Divisória de madeira ripada'),
      still('lebombo', 'a', 2, 'Sala ampla com porta de vidro para a varanda'),
    ],
  },
  {
    slug: 'casa-minimalista-recanto-do-lago',
    title: 'Casa minimalista com sala ampla',
    kind: 'casa',
    purpose: 'venda',
    neighborhood: 'Recanto do Lago',
    price: 1780000,
    area: 210,
    bedrooms: 3,
    suites: 1,
    bathrooms: 4,
    parking: 3,
    summary: 'Sala com portas de vidro para o quintal e acabamento sóbrio.',
    description:
      'Casa em um só pavimento com sala ampla e portas de vidro que abrem para o quintal gramado. Estantes planejadas, iluminação indireta e cozinha integrada. Acabamento sóbrio e atemporal.',
    features: ['Portas de vidro', 'Quintal gramado', 'Móveis planejados', 'Cozinha integrada', 'Iluminação indireta', 'Pronta para morar'],
    cover: 'minimalista',
    coverAlt: 'Sala minimalista com sofá modular cinza e portas de vidro para o jardim',
    rooms: [
      { pano: 'lythwood_lounge', label: 'Sala de estar', u: 0.7 },
      { pano: 'anniversary_lounge', label: 'Sala de jantar e estar', u: 0.45 },
      { pano: 'studio_country_hall', label: 'Salão', u: 0.55 },
    ],
    photos: [
      still('lythwood_lounge', 'a', 0, 'Sala de estar com portas de vidro para o quintal'),
      still('lythwood_lounge', 'b', 0, 'Sala com lareira e sofás claros'),
      still('lythwood_lounge', 'c', 0, 'Cantinho de leitura com pedra aparente'),
      still('anniversary_lounge', 'b', 1, 'Sala de estar com sofás verdes'),
      still('anniversary_lounge', 'c', 1, 'Sala com cortinas e iluminação quente'),
      still('studio_country_hall', 'a', 2, 'Salão com bancada e mesa de apoio'),
      still('studio_country_hall', 'c', 2, 'Recanto com janela e madeira natural'),
    ],
  },
  {
    slug: 'sobrado-aconchegante-vila-dos-ipes',
    title: 'Sobrado aconchegante',
    kind: 'casa',
    purpose: 'aluguel',
    neighborhood: 'Vila dos Ipês',
    price: 5200,
    area: 165,
    bedrooms: 3,
    suites: 1,
    bathrooms: 3,
    parking: 2,
    summary: 'Sala com janelões para o jardim, piso de madeira e muita luz.',
    description:
      'Sobrado em rua tranquila, com sala iluminada por janelões e piso de madeira clara. Três dormitórios, quintal e garagem coberta. Ótimo para famílias que querem espaço e conforto. Tour 360° em breve.',
    features: ['Piso de madeira', 'Quintal', 'Garagem coberta', 'Suíte', 'Rua tranquila', 'Aceita pets'],
    cover: 'sobrado',
    coverAlt: 'Sala clara com poltronas, sofá e dois janelões para o jardim',
    rooms: [],
    photos: [
      interior('sala-classica', 'Sala de estar com sofá listrado e portas para a varanda'),
      interior('sala-aconchego', 'Sala aconchegante com poltronas e estantes'),
      interior('cozinha-clara', 'Cozinha com bancada de madeira e bancos'),
      interior('jantar-ensolarado', 'Sala de jantar iluminada com piso de madeira'),
      interior('jantar-branco', 'Mesa de jantar com seis cadeiras estofadas'),
      interior('sala-ecletica', 'Sala ampla com janelas em arco e decoração colorida'),
    ],
  },
];

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const priceLabel = (p: Property) => (p.purpose === 'aluguel' ? `${brl(p.price)}/mês` : brl(p.price));
export const purposeLabel = (p: Purpose) => (p === 'venda' ? 'Comprar' : 'Alugar');
export const kindLabel = (k: Kind) => (k === 'casa' ? 'Casa' : 'Apartamento');
export const bySlug = new Map(properties.map((p) => [p.slug, p]));

/** Todas as imagens de um imóvel: capa primeiro, depois a galeria. */
export const galleryOf = (p: Property): GalleryItem[] => [
  { full: `/img/${p.cover}-1600.webp`, thumb: `/img/${p.cover}-800.webp`, alt: p.coverAlt },
  ...p.photos,
];

/** Preço curto para etiquetas: R$ 2,89 mi · R$ 950 mil · R$ 4,8 mil/mês */
export const shortPrice = (p: Property) => {
  const n = p.price;
  const txt = n >= 1_000_000 ? `R$ ${(n / 1_000_000).toFixed(2).replace('.', ',').replace(/,?0+$/, '')} mi` : n >= 10_000 ? `R$ ${Math.round(n / 1000)} mil` : `R$ ${(n / 1000).toFixed(1).replace('.', ',')} mil`;
  return p.purpose === 'aluguel' ? `${txt}/mês` : txt;
};
