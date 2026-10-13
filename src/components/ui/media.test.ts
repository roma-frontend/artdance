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

  it('unwraps proxy paths so the optimizer receives an R2 key, not /media-proxy/...', () => {
    const wrapper = Media({
      src: '/media-proxy/media/style-tiles/ballet/ballet-poster.webp',
      alt: 'Ballet',
      preset: 'categoryCard',
    }) as { props: { children: { props: { src: string } } } };
    const src = wrapper.props.children.props.src;
    expect(src).toMatch(/(^|\/)media\/style-tiles\/ballet\/ballet-poster\.webp$/);
    expect(src).not.toContain('/media-proxy/');
  });
});
