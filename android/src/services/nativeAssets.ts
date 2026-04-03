/**
 * Android：从配置的静态资源根 URL 下载 `public/` 镜像路径到应用目录，向 WebView 注入本地 file:// 清单。
 * 404 等先用 fetch HEAD 快速判定，避免 RNFS 长超时卡住；进度通过 NativeAssetProgressCallbacks 交给 Redux。
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type { NativeAssetRowStatus } from '@/store/nativeAssetDownloadSlice';
import { createStartupSpan, logStartupEvent } from '@/utils/startupProfiler';

const DEFAULT_CHARACTER_MODEL_INDEX = 1;
const STARTUP_ASSET_CONCURRENCY = 3;
const BACKGROUND_ASSET_CONCURRENCY = 4;

const CHARACTER_REL_PATHS = [
  'characters/Ani-default_481.glb',
  'characters/KQ-default_420.glb',
  'characters/HT-default_214.glb',
  'characters/FNN-default_296.glb',
  'characters/KL-default_214.glb',
  'characters/NXD-default_321.glb',
] as const;

const SCENE_REL_PATHS = [
  'models/ground/hdr-seabed.glb',
  'models/ground/hdr-black.glb',
  'models/ground/hdr-street.glb',
  'models/ground/hdr-vast.glb',
  'models/ground/hdr-cyber_black.glb',
  'models/ground/hdr-green.glb',
  'img/hdr/hdr-seabed.jpg',
  'img/hdr/hdr-black.jpg',
  'img/hdr/hdr-street.jpg',
  'img/hdr/hdr-vast.jpg',
  'img/hdr/hdr-cyber_black.png',
] as const;

const DEFAULT_SCENE_REL_PATHS = [
  'models/ground/hdr-vast.glb',
  'img/hdr/hdr-vast.jpg',
] as const;

const STARTUP_ASSET_REL_PATHS = [
  CHARACTER_REL_PATHS[DEFAULT_CHARACTER_MODEL_INDEX],
  ...DEFAULT_SCENE_REL_PATHS,
] as const;

const ALL_ASSET_REL_PATHS: string[] = [
  ...CHARACTER_REL_PATHS,
  ...SCENE_REL_PATHS,
];

const DEFAULT_API_BASE = 'https://dlp3d.s-s.city';

/** HEAD 探测超时（毫秒）；404 可很快返回，避免傻等 RNFS 两分钟 */
const HEAD_PROBE_MS = 8000;
/** 连接超时；读超时单独设大，便于拉 GLB */
const DOWNLOAD_CONNECT_MS = 15000;
const DOWNLOAD_READ_MS = 180000;
const PACKAGED_WEB_ASSET_ROOT = 'web';

export type NativeAssetManifest = {
  characterByModelIndex: Record<string, string>;
  groundBaseUrl: string;
  hdrBaseUrl: string;
};

export type PreparedNativeAssetManifest = {
  initialManifest: NativeAssetManifest;
  backgroundSync: Promise<NativeAssetManifest> | null;
};

export type PrepareNativeAssetsOptions = {
  apiServerUrl: string;
  characterAssetsBaseUrl: string;
  sceneAssetsBaseUrl: string;
};

export type NativeAssetProgressCallbacks = {
  onStart?: (payload: {
    rows: { rel: string; label: string; group: 'character' | 'scene' }[];
  }) => void;
  onRow?: (payload: { rel: string; status: NativeAssetRowStatus }) => void;
};

function pathToFileUrl(absPath: string): string {
  const p = absPath.startsWith('/') ? absPath : `/${absPath}`;
  return `file://${p}`;
}

async function mkdirp(dirPath: string): Promise<void> {
  const exists = await RNFS.exists(dirPath);
  if (exists) return;
  const parent = dirPath.substring(0, dirPath.lastIndexOf('/'));
  if (parent && parent.length > 0 && parent !== dirPath) {
    await mkdirp(parent);
  }
  await RNFS.mkdir(dirPath);
}

const CHARACTER_FILENAMES = [
  'Ani-default_481.glb',
  'KQ-default_420.glb',
  'HT-default_214.glb',
  'FNN-default_296.glb',
  'KL-default_214.glb',
  'NXD-default_321.glb',
] as const;

function normalizeHttpBase(url: string): string {
  const t = url.trim();
  const base = (t.length > 0 ? t : DEFAULT_API_BASE).replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    return `https://${base}`;
  }
  return base;
}

function staticOriginFromApiUrl(apiUrl: string): string {
  const base = normalizeHttpBase(apiUrl);
  try {
    const u = new URL(base);
    return `${u.protocol}//${u.host}`;
  } catch {
    return base;
  }
}

function pickBaseForRel(
  rel: string,
  characterBase: string,
  sceneBase: string,
): string {
  return rel.startsWith('characters/') ? characterBase : sceneBase;
}

function effectiveBases(options: PrepareNativeAssetsOptions): {
  characterBase: string;
  sceneBase: string;
} {
  const apiOrigin = staticOriginFromApiUrl(options.apiServerUrl);
  const c = options.characterAssetsBaseUrl.trim();
  const s = options.sceneAssetsBaseUrl.trim();
  return {
    characterBase: c.length > 0 ? normalizeHttpBase(c) : apiOrigin,
    sceneBase: s.length > 0 ? normalizeHttpBase(s) : apiOrigin,
  };
}

const ASSET_BASES_META = '.asset_bases.json';

async function invalidateCacheIfBasesChanged(
  destRoot: string,
  characterBase: string,
  sceneBase: string,
): Promise<void> {
  const metaPath = `${destRoot}/${ASSET_BASES_META}`;
  const next = JSON.stringify({ c: characterBase, s: sceneBase });
  let prev: string | null = null;
  try {
    prev = await RNFS.readFile(metaPath, 'utf8');
  } catch {
    prev = null;
  }
  if (prev !== null && prev === next) {
    return;
  }
  await mkdirp(destRoot);
  for (const rel of ALL_ASSET_REL_PATHS) {
    const p = `${destRoot}/${rel}`;
    try {
      if (await RNFS.exists(p)) {
        await RNFS.unlink(p);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    if (await RNFS.exists(metaPath)) {
      await RNFS.unlink(metaPath);
    }
  } catch {
    /* ignore */
  }
}

async function fileExistsNonEmpty(p: string): Promise<boolean> {
  try {
    if (!(await RNFS.exists(p))) return false;
    const st = await RNFS.stat(p);
    return st.size > 0;
  } catch {
    return false;
  }
}

function buildInitialRows(): {
  rel: string;
  label: string;
  group: 'character' | 'scene';
}[] {
  return [
    ...CHARACTER_REL_PATHS.map(rel => ({
      rel,
      label: rel.replace(/^characters\//, ''),
      group: 'character' as const,
    })),
    ...SCENE_REL_PATHS.map(rel => ({
      rel,
      label: rel.startsWith('models/ground/')
        ? `ground/${rel.split('/').pop()}`
        : `hdr/${rel.split('/').pop()}`,
      group: 'scene' as const,
    })),
  ];
}

/** 快速判断 URL 是否可能存在；404/403 立即跳过，不进入 RNFS 长下载 */
async function httpHeadOk(url: string): Promise<'yes' | 'no' | 'unknown'> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_PROBE_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    if (res.status === 404 || res.status === 410) {
      return 'no';
    }
    if (res.status === 403) {
      return 'unknown';
    }
    if (res.ok) return 'yes';
    if (res.status === 405 || res.status === 501) return 'unknown';
    return 'no';
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(t);
  }
}

async function tryDownloadToFile(
  fromUrl: string,
  toPath: string,
  timeouts?: { connectionTimeout: number; readTimeout: number },
): Promise<boolean> {
  const connectionTimeout = timeouts?.connectionTimeout ?? DOWNLOAD_CONNECT_MS;
  const readTimeout = timeouts?.readTimeout ?? DOWNLOAD_READ_MS;
  await mkdirp(toPath.substring(0, toPath.lastIndexOf('/')));
  const exists = await RNFS.exists(toPath);
  if (exists) {
    try {
      const st = await RNFS.stat(toPath);
      if (st.size > 0) {
        return true;
      }
    } catch {
      /* re-download */
    }
  }
  try {
    const { promise } = RNFS.downloadFile({
      fromUrl,
      toFile: toPath,
      connectionTimeout,
      readTimeout,
    });
    const res = await promise;
    const code = res.statusCode ?? 0;
    if (code >= 200 && code < 300) {
      return true;
    }
  } catch {
    /* network error */
  }
  try {
    if (await RNFS.exists(toPath)) {
      await RNFS.unlink(toPath);
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function tryCopyPackagedAssetToFile(
  rel: string,
  toPath: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  await mkdirp(toPath.substring(0, toPath.lastIndexOf('/')));
  try {
    await RNFS.copyFileAssets(`${PACKAGED_WEB_ASSET_ROOT}/${rel}`, toPath);
    return await fileExistsNonEmpty(toPath);
  } catch {
    return false;
  }
}

async function fetchOneAsset(
  rel: string,
  fromUrl: string,
  destPath: string,
  progress?: NativeAssetProgressCallbacks,
): Promise<boolean> {
  progress?.onRow?.({ rel, status: 'running' });
  if (await fileExistsNonEmpty(destPath)) {
    progress?.onRow?.({ rel, status: 'ok' });
    return true;
  }
  const packagedOk = await tryCopyPackagedAssetToFile(rel, destPath);
  if (packagedOk) {
    progress?.onRow?.({ rel, status: 'ok' });
    return true;
  }
  const head = await httpHeadOk(fromUrl);
  if (head === 'no') {
    progress?.onRow?.({ rel, status: 'skipped' });
    return false;
  }
  const ok = await tryDownloadToFile(fromUrl, destPath, {
    connectionTimeout: DOWNLOAD_CONNECT_MS,
    readTimeout: DOWNLOAD_READ_MS,
  });
  progress?.onRow?.({ rel, status: ok ? 'ok' : 'skipped' });
  return ok;
}

async function resolveFallbackCharacterFileUrl(
  destRoot: string,
): Promise<string> {
  const preferredOrder = [1, 0, 2, 3, 4, 5];
  for (const i of preferredOrder) {
    const p = `${destRoot}/characters/${CHARACTER_FILENAMES[i]}`;
    if (await fileExistsNonEmpty(p)) {
      return pathToFileUrl(p);
    }
  }
  throw new Error(
    'No character GLB could be downloaded. Check network and static asset base URLs in Settings.',
  );
}

async function buildManifest(destRoot: string): Promise<NativeAssetManifest> {
  const groundBaseUrl = pathToFileUrl(`${destRoot}/models/ground/`);
  const hdrBaseUrl = pathToFileUrl(`${destRoot}/img/hdr/`);
  const fallbackUrl = await resolveFallbackCharacterFileUrl(destRoot);

  const characterByModelIndex: Record<string, string> = {};
  for (let index = 0; index < CHARACTER_FILENAMES.length; index++) {
    const p = `${destRoot}/characters/${CHARACTER_FILENAMES[index]}`;
    if (await fileExistsNonEmpty(p)) {
      characterByModelIndex[String(index)] = pathToFileUrl(p);
    } else {
      characterByModelIndex[String(index)] = fallbackUrl;
    }
  }

  return {
    characterByModelIndex,
    groundBaseUrl,
    hdrBaseUrl,
  };
}

async function syncAssetList(
  rels: readonly string[],
  characterBase: string,
  sceneBase: string,
  destRoot: string,
  progress: NativeAssetProgressCallbacks | undefined,
  concurrency: number,
): Promise<void> {
  const queue = [...rels];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const rel = queue.shift();
        if (!rel) {
          return;
        }
        const base = pickBaseForRel(rel, characterBase, sceneBase);
        const fromUrl = `${base}/${rel}`;
        const dst = `${destRoot}/${rel}`;
        const ok = await fetchOneAsset(rel, fromUrl, dst, progress);
        if (!ok && __DEV__) {
          console.warn(`[nativeAssets] asset skipped: ${fromUrl}`);
        }
      }
    }),
  );
}

export async function prepareNativeAssetManifest(
  options: PrepareNativeAssetsOptions,
  progress?: NativeAssetProgressCallbacks,
): Promise<PreparedNativeAssetManifest> {
  if (Platform.OS !== 'android') {
    throw new Error('prepareNativeAssetManifest is only used on Android');
  }

  const { characterBase, sceneBase } = effectiveBases(options);
  const destRoot = `${RNFS.DocumentDirectoryPath}/dlp3d`;
  const startupSet = new Set<string>(STARTUP_ASSET_REL_PATHS);
  const backgroundRels = ALL_ASSET_REL_PATHS.filter(
    rel => !startupSet.has(rel),
  );
  const finishPrepare = createStartupSpan('native-assets.prepare-manifest', {
    totalAssetCount: ALL_ASSET_REL_PATHS.length,
    startupAssetCount: STARTUP_ASSET_REL_PATHS.length,
  });

  await invalidateCacheIfBasesChanged(destRoot, characterBase, sceneBase);

  progress?.onStart?.({ rows: buildInitialRows() });

  const finishStartupAssets = createStartupSpan(
    'native-assets.startup-assets',
    {
      assets: STARTUP_ASSET_REL_PATHS,
    },
  );
  await syncAssetList(
    STARTUP_ASSET_REL_PATHS,
    characterBase,
    sceneBase,
    destRoot,
    progress,
    STARTUP_ASSET_CONCURRENCY,
  );
  finishStartupAssets();

  await RNFS.writeFile(
    `${destRoot}/${ASSET_BASES_META}`,
    JSON.stringify({ c: characterBase, s: sceneBase }),
    'utf8',
  );

  const initialManifest = await buildManifest(destRoot);
  logStartupEvent('native-assets.initial-manifest-ready', {
    startupAssetsReady: STARTUP_ASSET_REL_PATHS.length,
  });
  finishPrepare({
    initialCharacterCount: Object.keys(initialManifest.characterByModelIndex)
      .length,
  });

  const backgroundSync =
    backgroundRels.length === 0
      ? null
      : (async () => {
          const finishBackgroundAssets = createStartupSpan(
            'native-assets.background-assets',
            {
              assets: backgroundRels.length,
            },
          );
          await syncAssetList(
            backgroundRels,
            characterBase,
            sceneBase,
            destRoot,
            progress,
            BACKGROUND_ASSET_CONCURRENCY,
          );
          await RNFS.writeFile(
            `${destRoot}/${ASSET_BASES_META}`,
            JSON.stringify({ c: characterBase, s: sceneBase }),
            'utf8',
          );
          const finalManifest = await buildManifest(destRoot);
          finishBackgroundAssets({
            finalCharacterCount: Object.keys(
              finalManifest.characterByModelIndex,
            ).length,
          });
          return finalManifest;
        })();

  return {
    initialManifest,
    backgroundSync,
  };
}
