import { config as loadEnv } from 'dotenv';
import { config, higgsfield } from '@higgsfield/client/v2';

loadEnv({ path: '.env.local', quiet: true });

const credentials = process.env.HF_CREDENTIALS;
if (!credentials || !/^[^:]+:[^:]+$/.test(credentials)) {
  throw new Error('Set HF_CREDENTIALS in .env.local using KEY_ID:KEY_SECRET format.');
}

config({
  credentials,
  maxPollTime: 30 * 60 * 1000,
});

const prompt = `Dark theatrical stage, single continuous shot, no cuts.

The clip opens on a heavy black stage curtain slightly parted — through the narrow gap of hot golden light, the sharp SILHOUETTES of two dancers are visible: fast footwork, whipping hip action. A dance is happening behind the curtain.

The curtain glides open, revealing a competitive Latine couple mid-performance.

The MAN: muscular male athlete, clearly masculine — short hair, broad chest exposed by an open-chested black latin shirt, black trousers, black latin shoes. Strictly masculine silhouette — no dress, no skirt on him.

The WOMAN: feminine, in a fringed latin dress of deep burgundy and red with crystals catching the light, hair up, bold stage makeup.

They perform an energetic cha-cha / jive: syncopated hips, fast precise footwork, a dramatic dip, a sharp arm-styling moment. Faces full of fire and showmanship.

The background stays pitch-black: black stage, warm spotlights, burgundy rim light, thin haze. No audience, no bright colors, no daylight.

Camera: locked tripod, very slow push-in. Ends on a held showstopper pose.

Photorealistic, cinematic, Seedance 2, 4k, 15 sec.
No text, no logos, no watermarks.`;

async function main(): Promise<void> {
  const result = await higgsfield.subscribe('bytedance/seedance-2.0/text-to-video', {
    input: {
      prompt,
      duration: 15,
      resolution: '4k',
      aspect_ratio: '16:9',
      generate_audio: false,
    },
    withPolling: true,
  });

  type TerminalStatus = typeof result.status | 'canceled';
  const status = result.status as TerminalStatus;

  if (status === 'completed' && result.video?.url) {
    console.log(result.video.url);
  } else if (status === 'nsfw') {
    throw new Error(`Request ${result.request_id} was moderated; no video was generated.`);
  } else if (status === 'canceled') {
    throw new Error(`Request ${result.request_id} was canceled; no video was generated.`);
  } else {
    const apiError = (result as typeof result & { error?: string | null }).error;
    throw new Error(
      `Request ${result.request_id} ${status}${apiError ? `: ${apiError}` : '; no video was generated.'}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});