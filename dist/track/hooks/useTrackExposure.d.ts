import { TrackConfig } from "../../types";
/**
 * 曝光埋点 Hook - 封装元素曝光埋点逻辑，返回需要监听的 DOM 引用
 * @template T 目标元素类型（默认：HTMLElement）
 * @param eventName 曝光事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，支持曝光阈值、是否只上报一次等）
 * @returns 需绑定到目标元素的 Ref 对象
 */
export declare const useTrackExposure: <T extends HTMLElement = HTMLElement>(eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => import("react").RefObject<T>;
//# sourceMappingURL=useTrackExposure.d.ts.map