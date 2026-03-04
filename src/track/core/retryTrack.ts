// 重试互斥锁，防止同时触发多次重试
import {FailedTrackParams} from "../../types";
import {isClient, safeLocalStorageSet} from "../../utils";
import {getTrackGlobalConfig} from "../config";

/**
 * 重试流程互斥锁 - 防止同时触发多次重试，避免并发问题
 */
let isRetryRunning = false;

/**
 * 从 localStorage 中读取失败的埋点数据
 * @returns 失败埋点数组（解析失败/数据异常时返回空数组）
 */
export const getFailedTracks = (): FailedTrackParams[] => {
    if (!isClient()) return [];
    try {
        const rawData = localStorage.getItem('failedTracks');
        // 2. 空值直接返回空数组
        if (!rawData) return [];

        const parsedData = JSON.parse(rawData);
        // 3. 解析后不是数组 → 返回空数组
        if (!Array.isArray(parsedData)) {
            console.warn('failedTracks 存储的数据不是数组，已重置为空数组');
            localStorage.setItem('failedTracks', '[]'); // 重置错误数据
            return [];
        }
        return parsedData;
    } catch (error) {
        console.error('读取失败埋点数据失败：', error);
        return [];
    }
};

/**
 * 将失败的埋点数据保存到 localStorage
 * @param tracks 待保存的失败埋点数组
 */
export const saveFailedTracks = (tracks: FailedTrackParams[]) => {
    if (!isClient()) return;
    try {
        safeLocalStorageSet('failedTracks', tracks);
    } catch (error) {
        console.error('保存失败埋点数据失败：', error);
    }
};

/**
 * 重试失败的埋点数据（核心重试逻辑）
 * @param force 是否强制重试（忽略指数退避时间，默认：false）
 * @returns Promise<void> 重试流程的异步结果
 */
export const retryFailedTracks = async (force = false) => {
    if (!isClient()) return;
    if (isRetryRunning) {
        console.debug('已有重试流程在执行，跳过本次触发');
        return;
    }
    isRetryRunning = true;

    try {
        let failedTracks = getFailedTracks();
        if (failedTracks.length === 0) return;
        const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig()
        const {
            retryConfig = { maxRetryTimes: 3, initialDelay: 1000, delayMultiplier: 2 },
            trackUrl,
            batchTrackUrl = trackUrl, // 批量接口默认使用单条接口
            enableBatch = false
        } = GLOBAL_TRACK_CONFIG;
        // 移除重复的默认值处理（前面已给retryConfig设默认值）
        const maxRetryTimes = retryConfig.maxRetryTimes;

        // 第一步：清理超过最大重试次数的埋点
        const [expiredTracks, validTracks] = failedTracks.reduce(
            (acc, track) => {
                const currentRetryCount = track.retryCount || 0;
                if (currentRetryCount >= maxRetryTimes) {
                    acc[0].push(track);
                } else {
                    acc[1].push(track);
                }
                return acc;
            },
            [[], []] as [FailedTrackParams[], FailedTrackParams[]]
        );
        failedTracks = validTracks;

        // 第二步：筛选可重试的有效埋点 指数退避算法
        const retryableTracks = failedTracks.filter(track => {
            const currentRetryCount = track.retryCount || 0;
            const backoffTime = retryConfig.initialDelay * Math.pow(retryConfig.delayMultiplier, currentRetryCount);
            const timeCondition = force || Date.now() - track.retryTime >= backoffTime;
            return timeCondition;
        });

        if (retryableTracks.length === 0) return;

        // 第三步：执行重试逻辑
        if (enableBatch) { // 批量上报
            const batchRetryTracks = retryableTracks.map(track => ({
                ...track,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                referrer: document.referrer,
                retryCount: (track.retryCount || 0) + 1
            }));

            try {
                const response = await fetch(batchTrackUrl, {
                    keepalive: true,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batchRetryTracks)
                });

                // 检查接口响应状态
                if (!response.ok) {
                    throw new Error(`批量接口返回异常：${response.status} ${response.statusText}`);
                }

                console.log('批量埋点重试成功：', batchRetryTracks.length, '条', batchRetryTracks);
                // 过滤掉重试成功的埋点
                failedTracks = failedTracks.filter(track =>
                    !retryableTracks.some(item => item.id === track.id)
                );
            } catch (error) {
                console.error('批量埋点重试失败：', error);
                // 批量失败时更新重试次数和时间
                retryableTracks.forEach(track => {
                    const index = failedTracks.findIndex(t => t.id === track.id);
                    if (index > -1) {
                        failedTracks[index].retryCount = (failedTracks[index].retryCount || 0) + 1;
                        failedTracks[index].retryTime = Date.now();
                    }
                });
            }
        } else { // 单条上报
            for (const track of retryableTracks) {
                try {
                    const response = await fetch(trackUrl, {
                        method: 'POST',
                        keepalive: true,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...track,
                            timestamp: Date.now(),
                            userAgent: navigator.userAgent,
                            url: window.location.href,
                            referrer: document.referrer,
                            retryCount: (track.retryCount || 0) + 1
                        })
                    });

                    // 检查单条接口响应状态
                    if (!response.ok) {
                        throw new Error(`单条接口返回异常：${response.status} ${response.statusText}`);
                    }

                    console.log('埋点重试成功：', track.eventName, '(ID:', track.id, ')');
                    const index = failedTracks.findIndex(t => t.id === track.id);
                    if (index > -1) failedTracks.splice(index, 1);
                } catch (error) {
                    console.error('埋点重试失败：', track.eventName, '(ID:', track.id, ')', error);
                    const index = failedTracks.findIndex(t => t.id === track.id);
                    if (index > -1) {
                        failedTracks[index].retryCount = (failedTracks[index].retryCount || 0) + 1;
                        failedTracks[index].retryTime = Date.now();
                    }
                }
            }
        }

        // 第四步：保存最终的失败队列
        saveFailedTracks(failedTracks);
    } catch (error) {
        console.error('重试流程整体异常：', error);
    } finally {
        isRetryRunning = false;
    }
};

