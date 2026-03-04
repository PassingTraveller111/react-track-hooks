import {TrackConfig, TrackParams} from "../../types";
import {getEventId, isClient} from "../../utils";
import {getTrackGlobalConfig} from "../config";
import {BATCH_TRACK_QUEUE, initBatchTimer, processBatchQueue} from "./sendBatchTrack";
import {getFailedTracks, retryFailedTracks, saveFailedTracks} from "./retryTrack";

/**
 * 通用埋点发送函数（支持单个 Hook 覆盖 trackUrl）
 * @param params 埋点参数
 * @param config 单个 Hook 的配置（可覆盖 trackUrl）
 */
export const sendTrack = async (params: TrackParams, config: TrackConfig) => {
    // 服务端不执行
    if (!isClient()) return;
    if (!params.eventName) {
        console.warn('埋点缺少必要参数：eventName');
        return;
    }
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig()
    // 优先级：单个 Hook 配置 > 全局配置
    const finalTrackUrl = config.trackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = config.enable ?? GLOBAL_TRACK_CONFIG.enable;

    if (!isEnable) return;


    // 判断批量模式（单个Hook配置 > 全局配置）
    const enableBatch = config?.enableBatch ?? GLOBAL_TRACK_CONFIG?.enableBatch ?? true;

    if (enableBatch) {
        // 批量模式：入队 + 触发调度
        BATCH_TRACK_QUEUE.push(params);
        initBatchTimer(config);
        if (BATCH_TRACK_QUEUE.length >= (GLOBAL_TRACK_CONFIG.batchConfig?.batchSize ?? 10)) {
            processBatchQueue(config);
        }
        return;
    }

    try {
        // 使用最终确定的 trackUrl 发送请求
        const response = await fetch(finalTrackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                keepalive: true,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                referrer: document.referrer
            })
        });

        if (!response.ok) {
            // 抛出包含状态码的异常，便于调试
            throw new Error(`HTTP 请求失败，状态码：${response.status}`);
        }

        console.log('埋点上报成功：', params);

        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => retryFailedTracks(), { timeout: 2000 });
        } else {
            setTimeout(() => retryFailedTracks(), 1000);
        }
    } catch (error) {
        console.error('埋点上报失败：', error);
        const failedTracks = getFailedTracks();
        failedTracks.push({
            id: getEventId(params.eventName),
            ...params,
            retryTime: Date.now(),
            retryCount: 0
        });
        saveFailedTracks(failedTracks);
    }
};
