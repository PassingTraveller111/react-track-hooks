import * as react from 'react';

declare enum TrackType {
    CLICK = "click",
    EXPOSURE = "exposure",
    PAGE_STAY = "page_stay",
    CUSTOM = "custom"
}
interface TrackParams {
    eventName: string;
    type: TrackType;
    [key: string]: any;
}
interface TrackGlobalConfig {
    trackUrl: string;
    enable?: boolean;
    retryConfig?: {
        maxRetryTimes: number;
        initialDelay: number;
        delayMultiplier: number;
    };
}
interface TrackConfig extends Partial<TrackGlobalConfig> {
    exposureOnce?: boolean;
    exposureThreshold?: number;
}
interface FailedTrackParams extends TrackParams {
    retryTime: number;
    retryCount?: number;
}

/**
 * 设置全局埋点配置（项目初始化时调用一次即可）
 * @param config 全局配置
 */
declare const setTrackGlobalConfig: (config: Partial<TrackGlobalConfig>) => void;
declare const getFailedTracks: () => FailedTrackParams[];
declare const saveFailedTracks: (tracks: FailedTrackParams[]) => void;
/**
 * 重试失败的埋点（使用全局配置的 trackUrl）
 */
declare const retryFailedTracks: (force?: boolean) => Promise<void>;
declare const useTrack: (params: TrackParams, config?: TrackConfig) => {
    triggerTrack: (customParams?: {}) => void;
};
declare const useTrackClick: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (e?: React.MouseEvent, extraParams?: {}) => void;
declare const useTrackExposure: <T extends HTMLElement = HTMLElement>(eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => react.RefObject<T>;
declare const useTrackPageStay: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => void;
declare const useTrackCustom: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (customParams?: {}) => void;
declare const useTrackRetryListener: () => void;

export { TrackType, getFailedTracks, retryFailedTracks, saveFailedTracks, setTrackGlobalConfig, useTrack, useTrackClick, useTrackCustom, useTrackExposure, useTrackPageStay, useTrackRetryListener };
export type { FailedTrackParams, TrackConfig, TrackGlobalConfig, TrackParams };
