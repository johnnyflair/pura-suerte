import { DEFS, PIZ_FELIZ } from './pizoteArt';

/** Arma la imagen para historias (1080×1920) en el celular, sin servidor. */
export async function makeShareImage(mult: number, code: string, host: string): Promise<Blob> {
  const defsInner = DEFS.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const piz = PIZ_FELIZ.replace('<svg width="100%" height="100%"', '<svg x="105" y="250" width="180" height="210"');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 390 693">
<defs><radialGradient id="bgS" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#FFD166"/><stop offset=".55" stop-color="#F0663F"/><stop offset="1" stop-color="#8E2A12"/></radialGradient>
<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
${defsInner}
<rect width="390" height="693" fill="url(#bgS)"/>
<g fill="#fff" opacity=".18">${Array.from({ length: 18 }, (_, i) => `<path d="M195 330 L${195 + 600 * Math.cos((i * 20 * Math.PI) / 180)} ${330 + 600 * Math.sin((i * 20 * Math.PI) / 180)} L${195 + 600 * Math.cos(((i * 20 + 8) * Math.PI) / 180)} ${330 + 600 * Math.sin(((i * 20 + 8) * Math.PI) / 180)} Z"/>`).join('')}</g>
<text x="195" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="900" fill="#fff">pura<tspan fill="#2A1A12">suerte</tspan></text>
<text x="195" y="112" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#fff">Mi pizote cruzó Chepe hasta</text>
<text x="195" y="212" text-anchor="middle" font-family="Arial, sans-serif" font-size="96" font-weight="900" fill="#6B1F0D" opacity=".55">x${mult.toFixed(2)}</text>
<text x="195" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="96" font-weight="900" fill="#fff">x${mult.toFixed(2)}</text>
<circle cx="195" cy="355" r="120" fill="url(#halo)"/>
${piz}
<rect x="60" y="478" width="270" height="62" rx="16" fill="#2A1A12" opacity=".88"/>
<text x="195" y="504" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#fff">Esquivé buses, taxis y huecos</text>
<text x="195" y="528" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="900" fill="#FFD166">¿Me ganás?</text>
<rect x="24" y="568" width="342" height="84" rx="18" fill="#fff"/>
<text x="195" y="600" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#2A1A12">Aceptá el reto y ganamos 5,000 monedas</text>
<text x="195" y="628" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#C8401F">${host}/reto/${code}</text>
<text x="195" y="676" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#fff" opacity=".9">Monedas virtuales sin valor monetario · Solo +18</text>
</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  canvas.getContext('2d')!.drawImage(img, 0, 0, 1080, 1920);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo crear la imagen'))), 'image/png'));
}
