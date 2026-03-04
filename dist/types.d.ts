export declare enum TrackType {
    CLICK = "click",
    EXPOSURE = "exposure",
    PAGE_STAY = "page_stay",
    CUSTOM = "custom",
    FIRST_RENDER = "first_render"
}
export interface TrackParams {
    eventName: string;
    type: TrackType;
    [key: string]: any;
}
export interface TrackGlobalConfig {
    trackUrl: string;
    batchTrackUrl?: string;
    enable?: boolean;
    enableBatch?: boolean;
    retryConfig?: {
        maxRetryTimes: number;
        initialDelay: number;
        delayMultiplier: number;
    };
    batchConfig?: {
        batchSize: number;
        batchInterval: number;
    };
    exposureConfig?: {
        exposureOnce?: boolean;
        exposureThreshold?: number;
    };
    pageStayConfig?: {
        timeout?: number;
        minDuration?: number;
        maxDuration?: number;
        checkInterval?: number;
    };
}
export interface TrackConfig extends Partial<TrackGlobalConfig> {
    exposureOnce?: boolean;
    exposureThreshold?: number;
}
export interface FailedTrackParams extends TrackParams {
    retryTime: number;
    retryCount?: number;
}
//# sourceMappingURL=types.d.ts.map