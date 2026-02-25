import { TrackConfig, TrackParams } from "../../types";
/**
 * 基础埋点 Hook - 封装通用埋点逻辑，返回触发埋点的方法
 * @param params 埋点基础参数（事件名、类型、自定义参数等）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 * @returns 包含触发埋点方法的对象
 */
export declare const useTrack: (params: TrackParams, config?: TrackConfig) => {
    triggerTrack: (customParams?: {}) => void;
};
//# sourceMappingURL=useTrack.d.ts.map