/**
 * Кадрирование аватара на сервере. Клиент присылает прямоугольник в долях
 * (0..1) от изображения ПОСЛЕ применения EXIF-ориентации, сервер пересчитывает
 * его в пиксели и вырезает квадрат. Клиенту не нужно знать пиксели исходника.
 */

import sharp from 'sharp';

import { mediaProcessing } from '@/config/media';

export type AvatarCrop = { x: number; y: number; w: number; h: number };

export type SquareRect = { left: number; top: number; side: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Квадрат в пикселях для изображения `width × height`. Без `crop` берётся
 * центральный квадрат, с `crop` — прямоугольник клиента, сжатый до квадрата.
 */
export function squareRectFor(width: number, height: number, crop?: AvatarCrop): SquareRect {
  if (!crop) {
    const side = Math.max(1, Math.min(width, height));
    return { left: Math.floor((width - side) / 2), top: Math.floor((height - side) / 2), side };
  }

  const left = clamp(Math.round(crop.x * width), 0, width - 1);
  const top = clamp(Math.round(crop.y * height), 0, height - 1);
  const w = Math.min(Math.round(crop.w * width), width - left);
  const h = Math.min(Math.round(crop.h * height), height - top);
  const side = Math.max(1, Math.min(w, h));
  return { left, top, side };
}

/**
 * Применяет EXIF-ориентацию, вырезает квадрат и возвращает буфер того же
 * формата. Ошибка декодирования всплывает наружу: её превращает в отказ роут.
 */
export async function cropAvatar(input: Buffer, crop?: AvatarCrop): Promise<Buffer> {
  const oriented = await sharp(input, {
    limitInputPixels: mediaProcessing.maxInputPixels,
    failOn: 'error',
  })
    .rotate()
    .toBuffer({ resolveWithObject: true });

  const { left, top, side } = squareRectFor(oriented.info.width, oriented.info.height, crop);
  return sharp(oriented.data).extract({ left, top, width: side, height: side }).toBuffer();
}
