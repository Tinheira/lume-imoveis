export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface NavigatorExt extends Navigator {
  connection?: { saveData?: boolean };
}
export const saveData = () => !!(navigator as NavigatorExt).connection?.saveData;

let webgl: boolean | undefined;
export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    webgl = !!gl;
  } catch {
    webgl = false;
  }
  return webgl;
}

export type Quality = 'high' | 'medium' | 'low';
/** Qualidade gráfica inicial conforme o aparelho (rebaixada sozinha se o FPS cair). ?q=high|medium|low força. */
export function detectQuality(): Quality {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'high' || q === 'medium' || q === 'low') return q;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse) return cores <= 4 ? 'low' : 'medium';
  return cores >= 8 ? 'high' : 'medium';
}
