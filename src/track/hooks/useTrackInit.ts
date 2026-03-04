import { useEffect, useRef } from 'react';
import {TrackGlobalConfig} from "../../types";
import {setTrackGlobalConfig} from "../config";
import {DestroyBatchTracker, InitBatchTracker} from "../core/sendBatchTrack";
import {useTrackRetryListener} from "../listeners/useTrackRetryListener";

/**
 * 埋点初始化 Hook
 * @param config 全局埋点配置
 */
export const useTrackInit = (config: TrackGlobalConfig) => {
    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current) return;
        if (!config.enableBatch) return; // 开启批量上报
        // 1. 设置配置
        setTrackGlobalConfig(config);

        // 2. 初始化批量上报调度系统（包含定时器和生命周期监听）
        InitBatchTracker(config);

        isInitialized.current = true;
        // console.log("埋点系统初始化完成");
        return () => {
            // 3. 清理批量埋点上报系统
            DestroyBatchTracker();
        }
    }, [config]);

    // 4. 启用失败重试监听（内部已做单例防重复处理）
    useTrackRetryListener();
};