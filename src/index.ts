// src/index.ts
// 导出类型
export * from './types';

// 导出核心函数（新增 setTrackGlobalConfig）
export { getFailedTracks, saveFailedTracks, retryFailedTracks, setTrackGlobalConfig } from './trackHooks';

// 导出所有 Hooks
export {
    useTrack,
    useTrackClick,
    useTrackExposure,
    useTrackPageStay,
    useTrackCustom,
    useTrackRetryListener
} from './trackHooks';