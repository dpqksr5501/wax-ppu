export const assetUrl = (path) =>
  `${import.meta.env?.BASE_URL ?? '/'}assets/${path}`;
export const readyImage = (image) =>
  Boolean(image?.complete && image.naturalWidth > 0);
export function loadImage(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => finish(new Error(`이미지 시간 초과: ${url}`)),
      timeoutMs,
    );
    function finish(error) {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error(`이미지 로딩 실패: ${url}`));
    image.src = url;
  });
}
export function loadTexture(path) {
  return loadImage(assetUrl(path.replace(/\.png$/, '.webp'))).catch(() =>
    loadImage(assetUrl(path)),
  );
}
export async function decodeSound(ctx, url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let bytes;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    bytes = await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
  return await ctx.decodeAudioData(bytes);
}
export async function loadSoundBank(ctx, urls, accept) {
  let index = 0;
  const worker = async () => {
    while (index < urls.length) {
      const url = urls[index++];
      try {
        accept(await decodeSound(ctx, url));
      } catch {
        /* synthesis stays available */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, worker));
}
