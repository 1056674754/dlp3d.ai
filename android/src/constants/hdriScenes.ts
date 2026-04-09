/**
 * Scene display names — must match `HDRI_SCENES[].name` in web
 * `app/library/babylonjs/config/scene.ts` and backend `scene_name`.
 */
export const HDRI_SCENE_NAMES = [
  'Seabed',
  'Ground View',
  'Cobbled Street',
  'Vast',
  'Cyber Black',
  'Green',
] as const;

const HDRI_PREVIEW_BASE = 'asset:/web/img/preview/hdr';

export const HDRI_SCENE_PREVIEWS: Record<(typeof HDRI_SCENE_NAMES)[number], string> =
  {
    Seabed: `${HDRI_PREVIEW_BASE}/hdr-seabed.jpg`,
    'Ground View': `${HDRI_PREVIEW_BASE}/hdr-black.jpg`,
    'Cobbled Street': `${HDRI_PREVIEW_BASE}/hdr-street.jpg`,
    Vast: `${HDRI_PREVIEW_BASE}/hdr-vast.jpg`,
    'Cyber Black': `${HDRI_PREVIEW_BASE}/hdr-cyber_black.png`,
    Green: `${HDRI_PREVIEW_BASE}/hdr-green.jpg`,
  };

/** Map API `scene_name` to a known HDRI label; empty if unknown. */
export function normalizeHdriSceneName(
  name: string | null | undefined,
): string {
  if (name == null || name === '') return '';
  const trimmed = name.trim();
  const exact = HDRI_SCENE_NAMES.find(n => n === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  const byLower = HDRI_SCENE_NAMES.find(n => n.toLowerCase() === lower);
  return byLower ?? '';
}

export function resolveHdriPreviewUri(
  name: string | null | undefined,
): string | null {
  const normalized = normalizeHdriSceneName(name);
  if (!normalized) {
    return null;
  }
  return HDRI_SCENE_PREVIEWS[normalized as keyof typeof HDRI_SCENE_PREVIEWS];
}
