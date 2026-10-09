/**
 * QR render — серверная генерация SVG из строки (pass-token / URL).
 * Использует qrcode (MIT) — один из немногих, кто умеет SVG без canvas.
 */
import 'server-only';

import QRCode from 'qrcode';

export async function qrSvgString(data: string, size = 192): Promise<string> {
  // Плотный, но читаемый: errorCorrection M, без margin (мы даём свой p-2 контейнером)
  // Hex запрещён линт-правилом вне tokens — это не дизайн-токен, а техцвет QR (ч/б)
  // eslint-disable-next-line no-restricted-syntax -- QR palette is technical (black-on-white), not a design token
  const dark = '#111827';
  // eslint-disable-next-line no-restricted-syntax -- QR palette is technical (white), not a design token
  const light = '#FFFFFF';
  const raw = await QRCode.toString(data, {
    type: 'svg' as const,
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark, light },
  });
  // qrcode возвращает <svg ...> — подгоняем под контейнер (100% внутри коробки)
  return raw.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"');
}
