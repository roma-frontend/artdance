import { describe, expect, it } from 'vitest';

import { imagePresets } from '@/config/media';

import { Media } from './media';

const props = { src: 'https://pub-example.r2.dev/blog/cover.jpg', alt: 'Blog cover', preset: 'heroFullBleed' as const };

describe('Media container dimensions', () => {
  it('reserves the preset aspect ratio for remote images without dimensions', () => {
    expect(Media(props)?.props.style).toEqual({ aspectRatio: imagePresets.heroFullBleed.aspectRatio });
  });

  it('preserves the preset aspect ratio for images with dimensions', () => {
    expect(Media({ ...props, width: 1200, height: 800 })?.props.style)
      .toEqual({ aspectRatio: imagePresets.heroFullBleed.aspectRatio });
  });

  it('leaves sizing to the parent when fill is explicit', () => {
    expect(Media({ ...props, fill: true })?.props.style).toBeUndefined();
  });
});