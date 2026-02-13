import { TrackParams, TrackConfig, TrackGlobalConfig, FailedTrackParams } from './types';
/**
 * 设置全局埋点配置（项目初始化时调用一次即可）
 * @param config 全局配置
 */
export declare const setTrackGlobalConfig: (config: Partial<TrackGlobalConfig>) => void;
export declare const getFailedTracks: () => FailedTrackParams[];
export declare const saveFailedTracks: (tracks: FailedTrackParams[]) => void;
/**
 * 重试失败的埋点（使用全局配置的 trackUrl）
 */
export declare const retryFailedTracks: (force?: boolean) => Promise<void>;
export declare const useTrack: (params: TrackParams, config?: TrackConfig) => {
    triggerTrack: (customParams?: {}) => void;
};
export declare const useTrackClick: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (e?: React.MouseEvent, extraParams?: {}) => void;
export declare const useTrackExposure: <T extends HTMLElement = HTMLElement>(eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => import("react").RefObject<T>;
export declare const useTrackPageStay: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => void;
export declare const useTrackCustom: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (customParams?: {}) => void;
export declare const useTrackRetryListener: () => void;
//# sourceMappingURL=trackHooks.d.ts.map