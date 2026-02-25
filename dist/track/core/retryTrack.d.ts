import { FailedTrackParams } from "../../types";
/**
 * 从 localStorage 中读取失败的埋点数据
 * @returns 失败埋点数组（解析失败/数据异常时返回空数组）
 */
export declare const getFailedTracks: () => FailedTrackParams[];
/**
 * 将失败的埋点数据保存到 localStorage
 * @param tracks 待保存的失败埋点数组
 */
export declare const saveFailedTracks: (tracks: FailedTrackParams[]) => void;
/**
 * 重试失败的埋点数据（核心重试逻辑）
 * @param force 是否强制重试（忽略指数退避时间，默认：false）
 * @returns Promise<void> 重试流程的异步结果
 */
export declare const retryFailedTracks: (force?: boolean) => Promise<void>;
//# sourceMappingURL=retryTrack.d.ts.map