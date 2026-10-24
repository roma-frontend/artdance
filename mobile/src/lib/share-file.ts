import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Сохраняет текст во временный файл и открывает системное окно отправки. */
export async function shareTextFile(name: string, text: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: 'public.json' });
}
