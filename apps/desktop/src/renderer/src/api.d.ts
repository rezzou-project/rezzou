import type {
  IpcApi,
  HistoryEntry as SharedHistoryEntry,
  HistoryEntryResult as SharedHistoryEntryResult
} from "../../shared/ipc-channels.ts";

declare global {
  type HistoryEntry = SharedHistoryEntry;
  type HistoryEntryResult = SharedHistoryEntryResult;

  interface Window {
    api: IpcApi;
  }
}
