import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'strong', 'em', 'u', 's', 'mark', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre',
  'a', 'hr',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style', 'data-text-align'];

export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NAMED_COLOR = /^[a-zA-Z]{3,20}$/;

export const sanitizeColor = (color: string | undefined, fallback: string): string => {
  if (!color) return fallback;
  if (HEX_COLOR.test(color) || NAMED_COLOR.test(color)) return color;
  return fallback;
};

/** Esquemas aceitos em href. Bloqueia javascript:, data:, vbscript: e afins.
 *  Valida na renderizacao E na gravacao: o dado ja salvo pode ser antigo. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

export const safeUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL | null = null;
  try {
    // Sem base: URL relativa lanca, e e' isso que queremos para href externo.
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }
  if (parsed && SAFE_SCHEMES.includes(parsed.protocol)) return trimmed;
  // "localhost:3000" e "exemplo.com:8080/x" parseiam com o host no lugar do
  // esquema. Com ponto ou localhost antes do ":" e porta depois, e endereco.
  const hostComPorta = /^(localhost|[^\s:/?#]*\.[^\s:/?#]*):\d/i.test(trimmed);
  if (parsed && !hostComPorta) return null;
  // Sem esquema (ou host com porta): vira https. O resultado sempre comeca por
  // https://, entao nenhum esquema perigoso passa por aqui. Antes, qualquer ":"
  // ("youtube.com/watch?t=1:30") descartava o link sem aviso.
  const comEsquema = `https://${trimmed}`;
  try {
    return new URL(comEsquema).hostname ? comEsquema : null;
  } catch {
    return null;
  }
};
