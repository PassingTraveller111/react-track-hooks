// 全局配置（默认值），并提供修改全局配置的方法
import { TrackGlobalConfig } from "../types";

// 定义默认配置（私有，不对外暴露）
const DEFAULT_TRACK_CONFIG: TrackGlobalConfig = {
    trackUrl: '/api/track',
    batchTrackUrl: '/api/track/batch',
    enable: true,
    enableBatch: true,
    retryConfig: {
    maxRetryTimes: 3,
        initialDelay: 1000,
        delayMultiplier: 2
    },
    batchConfig: {
        batchSize: 10,
        batchInterval: 5000,
    },
    exposureConfig: {
        exposureOnce: true,
        exposureThreshold: 0.5,
    },
    pageStayConfig: {
        timeout: 30 * 60 * 1000, // 30分钟无操作超时
        minDuration: 2000,       // 最小有效时长2秒（低于则丢弃）
        maxDuration: 60 * 60 * 1000, // 最大单次时长60分钟（防止异常数据）
        checkInterval: 1000,     // 每秒检查一次活跃状态
    }
};

// 私有全局配置（仅内部可直接访问）
let _GLOBAL_TRACK_CONFIG: TrackGlobalConfig = { ...DEFAULT_TRACK_CONFIG };

/**
 * 设置全局埋点配置（对外暴露的核心API）
 * @param config 要覆盖的配置（支持部分覆盖）
 * @returns 最新的全局配置（只读副本）
 */
export const setTrackGlobalConfig = (config: Partial<TrackGlobalConfig>): Readonly<TrackGlobalConfig> => {
    if (typeof config !== 'object' || config === null) {
        console.warn('setTrackGlobalConfig 入参必须为对象，已忽略');
        return getTrackGlobalConfig();
    }

    // 分步合并配置，同时做合法性校验
    _GLOBAL_TRACK_CONFIG = {
        ..._GLOBAL_TRACK_CONFIG,
        ...config,
    };

    console.debug('全局埋点配置已更新：', _GLOBAL_TRACK_CONFIG);
    return getTrackGlobalConfig();
};

/**
 * 获取当前全局埋点配置（返回只读副本，防止外部修改）
 * @returns 只读的全局配置对象
 */
export const getTrackGlobalConfig = (): Readonly<TrackGlobalConfig> => {
    // 使用 Object.freeze 冻结对象，防止外部篡改
    return Object.freeze({ ..._GLOBAL_TRACK_CONFIG });
};

/**
 * 重置全局配置为默认值（便于测试/场景重置）
 * @returns 重置后的默认配置（只读副本）
 */
export const resetTrackGlobalConfig = (): Readonly<TrackGlobalConfig> => {
    _GLOBAL_TRACK_CONFIG = { ...DEFAULT_TRACK_CONFIG };
    console.debug('全局埋点配置已重置为默认值');
    return getTrackGlobalConfig();
};

/**
 * （内部工具函数）获取可修改的原始配置（仅内部核心逻辑使用）
 * 注意：此函数仅暴露给 track 模块内部，不对外导出！
 */
export const _getRawGlobalConfig = (): TrackGlobalConfig => {
    return _GLOBAL_TRACK_CONFIG;
};