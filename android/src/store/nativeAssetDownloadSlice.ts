import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type NativeAssetRowGroup = 'character' | 'scene';

export type NativeAssetRowStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'skipped'
  | 'error';

export interface NativeAssetDownloadRow {
  rel: string;
  label: string;
  group: NativeAssetRowGroup;
  status: NativeAssetRowStatus;
}

export interface NativeAssetDownloadState {
  phase: 'idle' | 'running' | 'done' | 'error';
  errorMessage: string | null;
  rows: NativeAssetDownloadRow[];
}

const initialState: NativeAssetDownloadState = {
  phase: 'idle',
  errorMessage: null,
  rows: [],
};

export const nativeAssetDownloadSlice = createSlice({
  name: 'nativeAssetDownload',
  initialState,
  reducers: {
    downloadStarted: (
      state,
      {
        payload,
      }: PayloadAction<{
        rows: Omit<NativeAssetDownloadRow, 'status'>[];
      }>,
    ) => {
      state.phase = 'running';
      state.errorMessage = null;
      state.rows = payload.rows.map(r => ({ ...r, status: 'pending' as const }));
    },
    setRow: (
      state,
      {
        payload,
      }: PayloadAction<{ rel: string; status: NativeAssetRowStatus }>,
    ) => {
      const row = state.rows.find(x => x.rel === payload.rel);
      if (row) row.status = payload.status;
    },
    downloadFinished: state => {
      state.phase = 'done';
      state.errorMessage = null;
    },
    downloadFailed: (state, { payload }: PayloadAction<string>) => {
      state.phase = 'error';
      state.errorMessage = payload;
    },
    downloadReset: () => initialState,
  },
});

export const {
  downloadStarted,
  setRow: setNativeAssetRow,
  downloadFinished,
  downloadFailed,
  downloadReset,
} = nativeAssetDownloadSlice.actions;
