

// 批量上报定时器
import {TrackConfig, TrackParams} from "../../types";
import {getTrackGlobalConfig} from "../config";
import {getFailedTracks, retryFailedTracks, saveFailedTracks} from "./retryTrack";
import {getEventId} from "../../utils";

// 内存中的批量上报队列
export let BATCH_TRACK_QUEUE: TrackParams[] = [];
// 批量上报定时器
export let BATCH_TIMER: number | null = null;
// 防止并发上报的锁
export let isBatchUploading = false;

/**
 * 批量发送埋点函数
 * @param tracks 埋点数组
 * @param config 配置项
 */
const sendBatchTrack = async (tracks: TrackParams[], config: TrackConfig) => {
    if (tracks.length === 0) return;
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig()
    // 优先级：单个 Hook 配置 > 全局配置
    const finalBatchUrl = config.batchTrackUrl || GLOBAL_TRACK_CONFIG.batchTrackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = config.enable ?? GLOBAL_TRACK_CONFIG.enable;

    if (!isEnable) return;

    try {
        // 补充公共参数
        const tracksWithCommonParams = tracks.map(track => ({
            ...track,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer
        }));

        // 发送批量请求
        const response = await fetch(finalBatchUrl, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracks: tracksWithCommonParams }) // 批量上报格式：{ tracks: [...] }
        });

        if (!response.ok) {
            // 抛出包含状态码的异常
            throw new Error(`HTTP 请求失败，状态码：${response.status}`);
        }

        console.log(`批量上报成功，共${tracks.length}条`, tracks);

        // 批量上报成功后，尝试重试失败的埋点
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => retryFailedTracks(), { timeout: 2000 });
        } else {
            setTimeout(() => retryFailedTracks(), 1000);
        }

        return true;
    } catch (error) {
        return false;
    }
};

/**
 * 处理批量队列（核心调度逻辑）
 */
export const processBatchQueue = async (config: TrackConfig) => {
    // 1. 锁兜底：防止极端并发
    if (isBatchUploading) return;
    isBatchUploading = true;

    // 2. 同步备份+清空队列
    // 浅拷贝备份当前队列数据
    const tracksToUpload = [...BATCH_TRACK_QUEUE];
    // 立即清空队列，新数据会入新队列，不会被重复处理
    BATCH_TRACK_QUEUE = [];

    // 3. 空队列直接释放锁返回
    if (tracksToUpload.length === 0) {
        isBatchUploading = false;
        return;
    }

    try {
        // 4. 执行批量上报
        const success = await sendBatchTrack(tracksToUpload, config);

        // 5. 上报失败：拆分存入失败队列
        if (!success) {
            console.warn(`批量上报失败，${tracksToUpload.length}条数据转入失败队列`);
            const failedTracks = getFailedTracks();
            const newFailedTracks = tracksToUpload.map(track => ({
                id: getEventId(track.eventName),
                ...track,
                retryTime: Date.now(),
                retryCount: 0
            }));
            // 合并失败队列并保存（限制大小，避免localStorage溢出）
            failedTracks.push(...newFailedTracks);
            saveFailedTracks(failedTracks.slice(-100)); // 只保留最新100条
        }
    } catch (error) {
        // 捕获未知异常：同样存入失败队列
        console.error('批量上报异常：', error);
        const failedTracks = getFailedTracks();
        const newFailedTracks = tracksToUpload.map(track => ({
            id: `${track.eventName}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ...track,
            retryTime: Date.now(),
            retryCount: 0
        }));
        failedTracks.push(...newFailedTracks);
        saveFailedTracks(failedTracks.slice(-100));
    } finally {
        // 6. 释放锁（无论成功/失败/异常）
        isBatchUploading = false;

        // 7. 检查是否有新数据入队，有则触发下一次上报
        if (BATCH_TRACK_QUEUE.length > 0) {
            setTimeout(() => processBatchQueue(config), 100);
        }
    }
};

/**
 * 初始化批量上报定时器
 */
export const initBatchTimer = (config: TrackConfig) => {
    // 清除旧定时器
    if (BATCH_TIMER) {
        clearTimeout(BATCH_TIMER);
    }
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig()
    const { batchConfig } = GLOBAL_TRACK_CONFIG;
    if (!GLOBAL_TRACK_CONFIG?.enableBatch) return;

    // 设置新定时器
    BATCH_TIMER = setTimeout(() => {
        processBatchQueue(config);
    }, batchConfig?.batchInterval || 5000);
};
