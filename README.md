# Lume Imóveis — bairro 3D explorável + tour 360°

Site de imobiliária em que o cliente **anda por uma rua de verdade** em 3D: a **roda do mouse** (ou o dedo, ou ↑/↓) caminha
de forma contínua, com suavidade e balanço de passos; o olhar acompanha cada imóvel por onde se passa e, ao parar perto de
um, um "ímã" o enquadra e abre o painel (dados, fotos, agendar). A rua tem casas de preenchimento dos dois lados, faixas de
pedestre, postes, carros e árvores. Dá para **atravessar a porta** e, lá dentro, **caminhar cômodo a cômodo** em panoramas 360° reais. A página tradicional (lista, filtros, ficha,
contato) continua embaixo, indexável e acessível.

**Fluxo:** loader → *Entrar no bairro* → vista geral → rua (imóvel 1…7) → painel → *Entrar e caminhar por dentro* →
a câmera voa até a porta, abre e entra → tour 360° com caminhada → *Voltar para a rua* (volta à calçada do imóvel onde parou).

- `src/3d/street.ts`: palco da rua (luz de fim de tarde, carros, caminhada contínua `walkBy`, mistura de pose por imóvel, ímã de parada, porta que abre). Ajustes: `LOT` (distância entre terrenos), `WHEEL_M` em `src/ui/explore.ts` (velocidade da roda).
- `src/3d/buildings.ts`: casas de preenchimento (`buildFiller`, 4 variações) e as 7 construções modeladas por código (casa contemporânea, villa com piscina, torre com vista, residencial verde, torre central, casa minimalista, sobrado). A ordem segue `properties` (o imóvel *n* usa o modelo *n*).
- `src/ui/explore.ts`: HUD, etiquetas, painel, roda do mouse/teclado (Esc sai, Enter entra na casa atual).
- Sem WebGL, com movimento reduzido ou economia de dados: o hero mostra a foto e o restante do site funciona igual. `?modo=3d` força o 3D; `?q=high|medium|low` fixa a qualidade.

## Rodar

**Windows: dois cliques em `INICIAR.bat`.** (Nunca abra o `index.html` direto no navegador: precisa do servidor do Vite.)

```bash
npm install
npm run dev       # desenvolvimento
npm run build     # verificação de tipos + build de produção
npm run preview   # serve o build
```

## Onde editar

| O quê | Arquivo |
|---|---|
| Nome, CRECI, telefone, WhatsApp, e-mail, endereço, endpoint do formulário | `src/data/agency.ts` |
| Imóveis (título, bairro, valores, metragem, descrição, diferenciais, fotos, cômodos 360°) | `src/data/properties.ts` |
| Cores e tipografia | variáveis no topo de `src/styles/main.css` |

## Pendências (nada foi inventado)

- **Imóveis de demonstração**: nomes, bairros, valores e metragens são fictícios. O aviso "Imóveis de demonstração" some com `isDemo = false` em `agency.ts`.
- **Nome da imobiliária** ("Lume Imóveis"), **CRECI**, telefone, WhatsApp, e-mail e endereço são placeholders `[A DEFINIR]`. Enquanto `phone`/`whatsapp` forem `null`, nenhum botão de ligação/WhatsApp aparece.
- **Formulário**: valida, mas só envia quando `contactEndpoint` (POST JSON) ou `whatsapp` estiver configurado em `agency.ts`.
- Texto institucional da seção "Sobre" e meta tags (`og:image`, domínio/canonical) a definir.

## Como funciona o tour 360°

- `src/3d/pano.ts`: visualizador (esfera invertida + câmera no centro). Arrastar, inércia, pinça/Ctrl+roda para zoom, rotação automática, setas do teclado, transição suave entre cômodos.
- **Caminhada contínua**: a roda do mouse (ou as setas no chão, ou os botões ↑/↓) não troca a imagem de uma vez: o olhar gira até a direção de seguir, a câmera avança (zoom para dentro), o próximo cômodo surge por dissolução já em movimento e a vista se abre ao chegar (`PanoView.walkTo`). Ao fim de um imóvel, segue para o próximo. O percurso vem de `rooms` em `src/data/properties.ts`; o `u` de cada cômodo é a direção de 'seguir em frente'.
- **Voltar / Início**: a ficha e o tour têm os botões “Voltar” e “Início” (fecha tudo e volta ao topo); tecla Home também.
- **Galeria**: cada imóvel tem de 7 a 10 fotos (capa + `photos`), com setas, teclado (←/→), miniaturas e tela cheia. Fotos marcadas com 360° abrem o tour naquele cômodo.
- A resolução do panorama é escolhida por aparelho: **6144 px** (desktop com GPU capaz), **4096 px** ou **2048 px** (celular).
- Rotas por hash: `#/imovel/<slug>` abre a ficha e `#/imovel/<slug>/tour/<n>` abre o tour no cômodo `n` (links compartilháveis; o botão voltar funciona).
- Sem WebGL: cai para o panorama como imagem rolável. Com `prefers-reduced-motion`/economia de dados o hero mantém a imagem estática.
- Teclado no tour: ←↑→↓ olhar, `+`/`-` zoom, `n`/`p` (ou PageDown/PageUp) trocar de cômodo/imóvel, Esc fecha. Botões ↑/↓ na tela fazem o mesmo que a roda (úteis no celular).

### Trocar por panoramas reais da imobiliária

Um panorama por cômodo, imagem equiretangular 2:1 (câmera 360°). Gere `<nome>-6144.webp`, `-4096.webp`, `-2048.webp` e `-thumb.webp` (640×400) em `public/pano/`, e adicione o cômodo em `rooms` do imóvel (`u` = direção inicial do olhar, 0–1).

## Créditos das imagens (ilustrativas)

- **Panoramas 360°** (CC0, domínio público): [Poly Haven](https://polyhaven.com): `glasshouse_interior`, `relax_inn_seaview_suite`, `cayley_interior`, `kiara_interior`, `en_suite`, `bathroom`, `modern_bathroom`, `brown_photostudio_03/04/05`, `photo_studio_loft_hall`, `lythwood_room`, `lythwood_lounge`.
- **Capas** (Unsplash License, uso comercial livre): [casa](https://unsplash.com/photos/modern-house-with-large-windows-and-lush-garden-eWOgoFHlE8g) · [villa](https://unsplash.com/photos/tropical-villa-with-pool-at-twilight-oVnKC7wiQjA) · [apto vista](https://unsplash.com/photos/modern-living-room-with-sectional-sofa-and-large-window-yxO8YG082v8) · [residencial verde](https://unsplash.com/photos/modern-apartment-building-with-balconies-and-greenery-B9OMpxCdrlc) · [torre](https://unsplash.com/photos/modern-high-rise-apartment-building-with-balconies-and-glass-facade-4ZeTJcaspAk) · [casa minimalista](https://unsplash.com/photos/a-modern-living-room-with-a-large-window-vIbxvHj9m9g) · [sobrado](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-large-windows-7pvC_d2iXSE).

- **Fotos de interiores** (Unsplash License): cozinhas, banheiros, salas e jantares em `public/interior/`. **Fotos dos cômodos 360°** (`public/still/`): recortes em perspectiva dos panoramas do Poly Haven (CC0).
