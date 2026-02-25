import { TrackConfig } from "../../types";
/**
 * 页面停留时长埋点 Hook - 自动监听页面/组件的停留时长并上报
 * @param eventName 停留时长事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 */
export declare const useTrackPageStay: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => void;
//# sourceMappingURL=useTrackPageStay.d.ts.map