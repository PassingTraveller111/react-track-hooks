export declare enum TrackType {
    CLICK = "click",
    EXPOSURE = "exposure",
    PAGE_STAY = "page_stay",
    CUSTOM = "custom"
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