/**
 * DADOS DA IMOBILIÁRIA (editáveis).
 * Tudo com [A DEFINIR] é placeholder: nome, contatos e CRECI ainda não foram informados.
 * Enquanto `phone` e `whatsapp` forem null, o site não exibe botões de ligação/WhatsApp.
 */
export const agency = {
  name: 'Lume Imóveis', // [NOME A DEFINIR]
  tagline: 'Conheça por dentro antes de visitar.',
  creci: '[CRECI A DEFINIR]',
  phone: null as null | { display: string; e164: string },
  whatsapp: null as null | { number: string; message: string },
  email: null as null | string,
  address: null as null | string,
  social: [] as { label: string; url: string }[],
  /** Endpoint (POST JSON) que recebe o formulário. null = formulário valida, mas avisa que o envio não está ativo. */
  contactEndpoint: null as string | null,
};

export const isDemo = true; // exibe o aviso "imóveis de demonstração"
