import * as react from 'react';

declare enum TrackType {
    CLICK = "click",
    EXPOSURE = "exposure",
    PAGE_STAY = "page_stay",
    CUSTOM = "custom",
    FIRST_RENDER = "first_render"
}
interface TrackParams {
    eventName: string;
    type: TrackType;
    [key: string]: any;
}
interface TrackGlobalConfig {
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
interface TrackConfig extends Partial<TrackGlobalConfig> {
    exposureOnce?: boolean;
    exposureThreshold?: number;
}
interface FailedTrackParams extends TrackParams {
    retryTime: number;
    retryCount?: number;
}

/**
 * 设置全局埋点配置（对外暴露的核心API）
 * @param config 要覆盖的配置（支持部分覆盖）
 * @returns 最新的全局配置（只读副本）
 */
declare const setTrackGlobalConfig: (config: Partial<TrackGlobalConfig>) => Readonly<TrackGlobalConfig>;
/**
 * 获取当前全局埋点配置（返回只读副本，防止外部修改）
 * @returns 只读的全局配置对象
 */
declare const getTrackGlobalConfig: () => Readonly<TrackGlobalConfig>;

/**
 * 从 localStorage 中读取失败的埋点数据
 * @returns 失败埋点数组（解析失败/数据异常时返回空数组）
 */
declare const getFailedTracks: () => FailedTrackParams[];
/**
 * 将失败的埋点数据保存到 localStorage
 * @param tracks 待保存的失败埋点数组
 */
declare const saveFailedTracks: (tracks: FailedTrackParams[]) => void;
/**
 * 重试失败的埋点数据（核心重试逻辑）
 * @param force 是否强制重试（忽略指数退避时间，默认：false）
 * @returns Promise<void> 重试流程的异步结果
 */
declare const retryFailedTracks: (force?: boolean) => Promise<void>;

/**
 * 基础埋点 Hook - 封装通用埋点逻辑，返回触发埋点的方法
 * @param params 埋点基础参数（事件名、类型、自定义参数等）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 * @returns 包含触发埋点方法的对象
 */
declare const useTrack: (params: TrackParams, config?: TrackConfig) => {
    triggerTrack: (customParams?: {}) => void;
};

/**
 * 点击埋点 Hook - 封装点击事件的埋点逻辑，返回点击处理函数
 * @param eventName 点击事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 * @returns 点击事件处理函数（支持接收鼠标事件和额外参数）
 */
declare const useTrackClick: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (e?: React.MouseEvent, extraParams?: {}) => void;

/**
 * 自定义埋点 Hook - 简化自定义类型埋点的调用，直接返回触发方法
 * @param eventName 自定义事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 * @returns 触发自定义埋点的方法
 */
declare const useTrackCustom: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => (customParams?: {}) => void;

/**
 * 曝光埋点 Hook - 封装元素曝光埋点逻辑，返回需要监听的 DOM 引用
 * @template T 目标元素类型（默认：HTMLElement）
 * @param eventName 曝光事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，支持曝光阈值、是否只上报一次等）
 * @returns 需绑定到目标元素的 Ref 对象
 */
declare const useTrackExposure: <T extends HTMLElement = HTMLElement>(eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => react.RefObject<T>;

/**
 * 页面停留时长埋点 Hook - 自动监听页面/组件的停留时长并上报
 * @param eventName 停留时长事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 */
declare const useTrackPageStay: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => void;

/**
 * 埋点重试监听 Hook - 自动注册多场景的失败埋点重试触发逻辑
 * 核心能力：
 * 1. 首屏渲染完成3秒后，触发一次失败埋点重试
 * 2. 监听页面可见性变化（从不可见→可见），触发重试
 * 3. 利用浏览器空闲时间周期性重试（兜底：每30秒执行一次）
 * 注意：该 Hook 全局仅会注册一次监听，重复调用不会重复绑定事件
 */
declare const useTrackRetryListener: () => void;

/**
 * 组件首次渲染埋点 Hook - 仅在组件挂载（首次渲染）时触发一次埋点
 * @param eventName 埋点事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 */
declare const useTrackFirstRender: (eventName: string, customParams?: Record<string, any>, config?: TrackConfig) => void;

/**
 * 埋点初始化 Hook
 * @param config 全局埋点配置
 */
declare const useTrackInit: (config: TrackGlobalConfig) => void;

export { TrackType, getFailedTracks, getTrackGlobalConfig, retryFailedTracks, saveFailedTracks, setTrackGlobalConfig, useTrack, useTrackClick, useTrackCustom, useTrackExposure, useTrackFirstRender, useTrackInit, useTrackPageStay, useTrackRetryListener };
export type { FailedTrackParams, TrackConfig, TrackGlobalConfig, TrackParams };
