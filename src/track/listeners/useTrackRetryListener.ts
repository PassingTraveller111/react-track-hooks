// 单例锁（全局变量）
import {useEffect} from "react";
import {getFailedTracks, retryFailedTracks} from "../core/retryTrack";

/**
 * 重试监听注册状态锁 - 确保全局仅注册一次重试监听，避免重复绑定事件
 */
let isRetryListenerRegistered = false;


/**
 * 埋点重试监听 Hook - 自动注册多场景的失败埋点重试触发逻辑
 * 核心能力：
 * 1. 首屏渲染完成3秒后，触发一次失败埋点重试
 * 2. 监听页面可见性变化（从不可见→可见），触发重试
 * 3. 利用浏览器空闲时间周期性重试（兜底：每30秒执行一次）
 * 注意：该 Hook 全局仅会注册一次监听，重复调用不会重复绑定事件
 */
export const useTrackRetryListener = () => {
    useEffect(() => {
        // 单例拦截：已注册过则直接返回
        if (isRetryListenerRegistered) return;
        isRetryListenerRegistered = true;

        // 1.首屏渲染3秒后进行重试
        const initTimer = setTimeout(() => retryFailedTracks(), 3000);

        // 2.页面切换监听 不可见->可见 进行重试
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                retryFailedTracks();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 3.周期性进行浏览器空闲重试，最迟30秒也会执行一次
        let idleCallbackId: number | null = null; // 空闲执行id
        let intervalId: number | null = null; // 定时器id

        const checkIdleRetry = () => {
            // 先检查失败队列是否为空
            const failedTracks = getFailedTracks();
            if (failedTracks.length === 0) {
                // 队列为空时，延迟1分钟再预约（减少空跑）
                setTimeout(() => {
                    if (window.requestIdleCallback) {
                        idleCallbackId = window.requestIdleCallback(checkIdleRetry, {timeout: 30000});
                    }
                }, 60000);
                return;
            }

            // 进行失败重试
            retryFailedTracks();
            // 注册下一次的空闲回调
            if (window.requestIdleCallback) {
                idleCallbackId = window.requestIdleCallback(checkIdleRetry, {timeout: 30000});
            }
        };
        // 启用首次空闲回调
        if (window.requestIdleCallback) {
            idleCallbackId = window.requestIdleCallback(checkIdleRetry, { timeout: 30000 });
        } else{ // 防止浏览器不支持requestIdleCallback，兜底。每30秒执行一次
            intervalId = window.setInterval(retryFailedTracks, 30000);
        }

        return () => {
            // 清理首屏定时器
            if (initTimer) clearTimeout(initTimer);
            // 清理监听
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // 清理空闲/周期重试
            if (intervalId) window.clearInterval(intervalId);
            if (idleCallbackId !== null && window.cancelIdleCallback) {
                window.cancelIdleCallback(idleCallbackId);
            }
        };
    }, []);
};