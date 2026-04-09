import { CHARACTER_MODEL_NAMES } from '@/constants/characterModels';

const CHARACTER_PREVIEW_BASE = 'asset:/web/img/preview/character';

export function normalizeCharacterPreviewName(
  modelName?: string | null,
): string | null {
  if (!modelName) {
    return null;
  }

  const trimmed = modelName.trim();
  if (!trimmed) {
    return null;
  }

  return (
    CHARACTER_MODEL_NAMES.find(
      name =>
        trimmed === name ||
        trimmed.startsWith(`${name}_`) ||
        trimmed.startsWith(`${name}.`),
    ) ?? null
  );
}

export function resolveCharacterPreviewUri(
  modelName?: string | null,
): string | null {
  const normalized = normalizeCharacterPreviewName(modelName);
  if (!normalized) {
    return null;
  }
  return `${CHARACTER_PREVIEW_BASE}/${normalized}.png`;
}
