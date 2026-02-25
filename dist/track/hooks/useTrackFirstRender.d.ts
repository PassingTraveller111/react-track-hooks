import { TrackConfig } from '../../types';
/**
 * 组件首次渲染埋点 Hook - 仅在组件挂载（首次渲染）时触发一次埋点
 * @param eventName 埋点事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 */
export declare const useTrackFirstRender: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => void;
//# sourceMappingURL=useTrackFirstRender.d.ts.map