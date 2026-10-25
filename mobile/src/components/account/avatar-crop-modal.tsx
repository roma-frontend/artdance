import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { AvatarCropRect, PickedImage } from '@/lib/account-profile';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type Size = { width: number; height: number };
type Point = { x: number; y: number };

type Props = {
  image: PickedImage | null;
  busy?: boolean;
  notice?: string | null;
  onCancel: () => void;
  onConfirm: (crop: AvatarCropRect) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Геометрия изображения в квадратной рамке. Фото покрывает рамку целиком
 * (cover), zoom увеличивает его поверх. Совпадает с расчётом серверного кропа.
 */
function geometryFor(size: Size, frame: number, zoom: number) {
  const scale = (Math.max(frame / size.width, frame / size.height)) * zoom;
  const dw = size.width * scale;
  const dh = size.height * scale;
  return { scale, dw, dh, maxX: Math.max(0, (dw - frame) / 2), maxY: Math.max(0, (dh - frame) / 2) };
}

/** Модалка кадрирования аватара: перетаскивание, щипок и кнопки масштаба. */
export function AvatarCropModal({ image, busy = false, notice, onCancel, onConfirm }: Props) {
  const t = messagesFor(deviceLocale(undefined));
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const frame = Math.min(screenWidth - space.xl * 2, 320);

  const [size, setSize] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  // Жесты читают значения через ref, чтобы обработчики не пересоздавались.
  const latest = useRef({ size: null as Size | null, frame, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } });
  const gesture = useRef({ pan: { x: 0, y: 0 }, zoom: MIN_ZOOM, distance: null as number | null, dx: 0, dy: 0 });

  useEffect(() => {
    if (!image) return;
    let alive = true;
    setSize(null);
    setFailed(false);
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    Image.getSize(image.uri)
      .then(({ width, height }) => {
        if (!alive) return;
        const loaded = { width, height };
        latest.current = { size: loaded, frame, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };
        setSize(loaded);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [image, frame]);

  const responder = useMemo(() => {
    // Применяет масштаб и сдвиг с ограничением, чтобы рамка всегда была закрыта фото.
    const apply = (nextZoom: number, nextPan: Point) => {
      const current = latest.current;
      if (!current.size) return;
      const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const g = geometryFor(current.size, current.frame, z);
      const p = { x: clamp(nextPan.x, -g.maxX, g.maxX), y: clamp(nextPan.y, -g.maxY, g.maxY) };
      latest.current = { ...current, zoom: z, pan: p };
      setZoom(z);
      setPan(p);
    };

    const rebase = (state: PanResponderGestureState, distance: number | null) => {
      gesture.current = {
        pan: latest.current.pan,
        zoom: latest.current.zoom,
        distance,
        dx: state.dx,
        dy: state.dy,
      };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_event, state) => rebase(state, null),
      onPanResponderMove: (event, state) => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          const [a, b] = touches;
          const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          if (gesture.current.distance === null) rebase(state, distance);
          const start = gesture.current;
          apply(start.zoom * (distance / (start.distance ?? distance)), start.pan);
          return;
        }
        if (gesture.current.distance !== null) rebase(state, null);
        const start = gesture.current;
        apply(latest.current.zoom, { x: start.pan.x + state.dx - start.dx, y: start.pan.y + state.dy - start.dy });
      },
    });
  }, []);

  function changeZoom(delta: number) {
    const current = latest.current;
    if (!current.size) return;
    const z = clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM);
    const g = geometryFor(current.size, current.frame, z);
    const p = { x: clamp(current.pan.x, -g.maxX, g.maxX), y: clamp(current.pan.y, -g.maxY, g.maxY) };
    latest.current = { ...current, zoom: z, pan: p };
    setZoom(z);
    setPan(p);
  }

  /** Квадрат кадрирования в долях исходного изображения, как ждёт сервер. */
  function cropRect(): AvatarCropRect | null {
    if (!size) return null;
    const { scale, dw, dh } = geometryFor(size, frame, zoom);
    const left = (frame - dw) / 2 + pan.x;
    const top = (frame - dh) / 2 + pan.y;
    const side = frame / scale;
    const w = clamp(side / size.width, 0, 1);
    const h = clamp(side / size.height, 0, 1);
    return {
      x: clamp(-left / scale / size.width, 0, 1 - w),
      y: clamp(-top / scale / size.height, 0, 1 - h),
      w,
      h,
    };
  }

  const geometry = size ? geometryFor(size, frame, zoom) : null;

  return (
    <Modal visible={image !== null} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <Text style={type.h2}>{t.profileAvatarCropTitle}</Text>
        <Text style={styles.hint}>{t.profileAvatarCropHint}</Text>

        <View
          style={[styles.frame, { width: frame, height: frame }]}
          {...responder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={t.profileAvatarCropTitle}
        >
          {image && size && geometry ? (
            <Image
              source={{ uri: image.uri }}
              style={{
                position: 'absolute',
                width: geometry.dw,
                height: geometry.dh,
                left: (frame - geometry.dw) / 2 + pan.x,
                top: (frame - geometry.dh) / 2 + pan.y,
              }}
            />
          ) : null}
          <View pointerEvents="none" style={styles.outline} />
        </View>

        {failed ? <Text style={styles.error}>{t.profileAvatarUnreadable}</Text> : null}
        {notice ? <Text style={styles.error}>{notice}</Text> : null}

        <View style={styles.zoomRow}>
          <PressableScale
            onPress={() => changeZoom(-ZOOM_STEP)}
            disabled={busy || zoom <= MIN_ZOOM}
            accessibilityRole="button"
            accessibilityLabel={t.profileAvatarZoomOut}
            style={styles.zoomButton}
          >
            <Ionicons name="remove" size={22} color={colors.text} />
          </PressableScale>
          <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          <PressableScale
            onPress={() => changeZoom(ZOOM_STEP)}
            disabled={busy || zoom >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel={t.profileAvatarZoomIn}
            style={styles.zoomButton}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </PressableScale>
        </View>

        <View style={styles.actions}>
          <Button
            label={t.profileAvatarSave}
            onPress={() => {
              const crop = cropRect();
              if (crop) onConfirm(crop);
            }}
            busy={busy}
            disabled={!size || busy}
          />
          <PressableScale onPress={onCancel} disabled={busy} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelText}>{t.accountCancel}</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', paddingHorizontal: space.xl, gap: space.lg },
  hint: { fontSize: 13, color: colors.text3, textAlign: 'center' },
  frame: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(245,241,234,0.5)',
  },
  error: { fontSize: 13, color: colors.accentBright, textAlign: 'center' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  zoomText: { minWidth: 56, textAlign: 'center', fontSize: 14, color: colors.text2, fontVariant: ['tabular-nums'] },
  actions: { alignSelf: 'stretch', gap: space.md, marginTop: 'auto' },
  cancel: { alignItems: 'center', paddingVertical: space.md },
  cancelText: { fontSize: 15, color: colors.text2 },
});
