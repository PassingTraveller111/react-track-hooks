// src/types.ts
export enum TrackType {
    CLICK = 'click',
    EXPOSURE = 'exposure',
    PAGE_STAY = 'page_stay',
    CUSTOM = 'custom'
}

export interface TrackParams {
    eventName: string;
    type: TrackType;
    [key: string]: any;
}

// 新增：全局配置类型
export interface TrackGlobalConfig {
    // 埋点上报接口 URL
    trackUrl: string;
    // 是否开启埋点
    enable?: boolean;
    // 重试配置
    retryConfig?: {
        maxRetryTimes: number;
        initialDelay: number;
        delayMultiplier: number;
    };
}

// 调整：TrackConfig 继承并扩展全局配置，支持单个 Hook 覆盖
export interface TrackConfig extends Partial<TrackGlobalConfig> {
    exposureOnce?: boolean;
    exposureThreshold?: number;
}

export interface FailedTrackParams extends TrackParams {
    retryTime: number;
    retryCount?: number;
}