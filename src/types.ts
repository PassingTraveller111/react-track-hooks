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

// 全局配置类型
export interface TrackGlobalConfig {
    // 埋点上报接口 URL
    trackUrl: string;
    // 批量上报接口 URL
    batchTrackUrl?: string;
    // 是否开启埋点
    enable?: boolean;
    // 是否开启批量上报
    enableBatch?: boolean
    // 重试配置
    retryConfig?: {
        maxRetryTimes: number;
        initialDelay: number;
        delayMultiplier: number;
    };
    // 批量上报配置
    batchConfig?: {
        batchSize: number, // 队列容量上限
        batchInterval: number, // 触发上报间隔
    }
}

// TrackConfig 继承并扩展全局配置，支持单个 Hook 覆盖
export interface TrackConfig extends Partial<TrackGlobalConfig> {
    exposureOnce?: boolean; // 曝光埋点仅生效一次
    exposureThreshold?: number; // 曝光埋点的阈值
}

export interface FailedTrackParams extends TrackParams {
    retryTime: number; // 上次重试时间
    retryCount?: number; // 重试次数
}