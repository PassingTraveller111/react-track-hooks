import { TrackConfig, TrackParams } from "../../types";
/**
 * 通用埋点发送函数（支持单个 Hook 覆盖 trackUrl）
 * @param params 埋点参数
 * @param config 单个 Hook 的配置（可覆盖 trackUrl）
 */
export declare const sendTrack: (params: TrackParams, config: TrackConfig) => Promise<void>;
//# sourceMappingURL=sendTrack.d.ts.map