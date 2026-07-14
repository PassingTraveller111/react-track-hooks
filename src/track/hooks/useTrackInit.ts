import { useEffect, useRef } from 'react';
import {TrackGlobalConfigInput} from "../../types";
import {setTrackGlobalConfig} from "../config";
import {DestroyBatchTracker, InitBatchTracker} from "../core/sendBatchTrack";
import {useTrackRetryListener} from "../listeners/useTrackRetryListener";

/**
 * 埋点初始化 Hook
 * @param config 全局埋点配置
 */
export const useTrackInit = (config: TrackGlobalConfigInput) => {
    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current) return;
        // 1. 设置配置
        setTrackGlobalConfig(config);

        // 2. 初始化批量上报调度系统（包含定时器和生命周期监听）
        const shouldInitBatchTracker = config.enableBatch ?? true;
        if (shouldInitBatchTracker) {
            InitBatchTracker(config);
        }

        isInitialized.current = true;
        // console.log("埋点系统初始化完成");
        return () => {
            // 3. 清理批量埋点上报系统
            if (shouldInitBatchTracker) {
                DestroyBatchTracker();
            }
        }
    }, [config]);

    // 4. 启用失败重试监听（内部已做单例防重复处理）
    useTrackRetryListener();
};
