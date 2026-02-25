import { TrackGlobalConfig } from "../types";
/**
 * 设置全局埋点配置（对外暴露的核心API）
 * @param config 要覆盖的配置（支持部分覆盖）
 * @returns 最新的全局配置（只读副本）
 */
export declare const setTrackGlobalConfig: (config: Partial<TrackGlobalConfig>) => Readonly<TrackGlobalConfig>;
/**
 * 获取当前全局埋点配置（返回只读副本，防止外部修改）
 * @returns 只读的全局配置对象
 */
export declare const getTrackGlobalConfig: () => Readonly<TrackGlobalConfig>;
/**
 * 重置全局配置为默认值（便于测试/场景重置）
 * @returns 重置后的默认配置（只读副本）
 */
export declare const resetTrackGlobalConfig: () => Readonly<TrackGlobalConfig>;
/**
 * （内部工具函数）获取可修改的原始配置（仅内部核心逻辑使用）
 * 注意：此函数仅暴露给 track 模块内部，不对外导出！
 */
export declare const _getRawGlobalConfig: () => TrackGlobalConfig;
//# sourceMappingURL=config.d.ts.map