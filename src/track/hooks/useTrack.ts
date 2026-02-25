import {TrackConfig, TrackParams} from "../../types";
import {useCallback, useEffect, useRef} from "react";
import {sendTrack} from "../core/sendTrack";
import {getTrackGlobalConfig} from "../config";

/**
 * 基础埋点 Hook - 封装通用埋点逻辑，返回触发埋点的方法
 * @param params 埋点基础参数（事件名、类型、自定义参数等）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 * @returns 包含触发埋点方法的对象
 */
export const useTrack = (params: TrackParams, config: TrackConfig = {}) => {
    // 合并默认配置（含全局配置）和单个 Hook 配置
    const mergedConfig = { ...getTrackGlobalConfig(), ...config };
    const trackRef = useRef(params);

    useEffect(() => {
        trackRef.current = params;
    }, [params]);

    const triggerTrack = useCallback((customParams = {}) => {
        const finalParams = {
            ...trackRef.current,
            ...customParams
        };
        // 把 mergedConfig 传给 sendTrack，支持覆盖 trackUrl
        sendTrack(finalParams, mergedConfig);
    }, [mergedConfig]);

    return { triggerTrack };
};
