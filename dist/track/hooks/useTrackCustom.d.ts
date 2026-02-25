import { TrackConfig } from "../../types";
/**
 * 自定义埋点 Hook - 简化自定义类型埋点的调用，直接返回触发方法
 * @param eventName 自定义事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 * @returns 触发自定义埋点的方法
 */
export declare const useTrackCustom: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (customParams?: {}) => void;
//# sourceMappingURL=useTrackCustom.d.ts.map