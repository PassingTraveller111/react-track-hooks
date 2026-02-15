// src/index.ts
// 导出类型
export * from './types';

// 导出核心函数
export { getFailedTracks, saveFailedTracks, retryFailedTracks, setTrackGlobalConfig, getMergedDefaultConfig } from './trackHooks';

// 导出所有 Hooks
export {
    useTrack,
    useTrackClick,
    useTrackExposure,
    useTrackPageStay,
    useTrackCustom,
    useTrackRetryListener,
} from './trackHooks';