import { TrackConfig, TrackParams } from "../../types";
export declare let BATCH_TRACK_QUEUE: TrackParams[];
export declare let BATCH_TIMER: number | null;
export declare let isBatchUploading: boolean;
/**
 * 处理批量队列（核心调度逻辑）
 */
export declare const processBatchQueue: (config: TrackConfig) => Promise<void>;
/**
 * 初始化批量上报定时器
 */
export declare const initBatchTimer: (config: TrackConfig) => void;
//# sourceMappingURL=sendBatchTrack.d.ts.map