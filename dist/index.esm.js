import { useRef, useEffect, useCallback } from 'react';

// src/types.ts
var TrackType;
(function (TrackType) {
    TrackType["CLICK"] = "click";
    TrackType["EXPOSURE"] = "exposure";
    TrackType["PAGE_STAY"] = "page_stay";
    TrackType["CUSTOM"] = "custom";
})(TrackType || (TrackType = {}));

// src/trackHooks.ts
// 全局配置（默认值），并提供修改全局配置的方法
let GLOBAL_TRACK_CONFIG = {
    trackUrl: '/api/track', // 默认上报地址
    enable: true,
    retryConfig: {
        maxRetryTimes: 3,
        initialDelay: 1000,
        delayMultiplier: 2
    }
};
/**
 * 设置全局埋点配置（项目初始化时调用一次即可）
 * @param config 全局配置
 */
const setTrackGlobalConfig = (config) => {
    GLOBAL_TRACK_CONFIG = { ...GLOBAL_TRACK_CONFIG, ...config };
};
// 2. 调整默认配置，合并全局配置
const getMergedDefaultConfig = () => ({
    exposureOnce: true,
    exposureThreshold: 0.5,
    ...GLOBAL_TRACK_CONFIG // 继承全局配置（trackUrl、enable、retryConfig）
});
// ---------------------- 埋点发送 & 重试核心逻辑 ----------------------
const getFailedTracks = () => {
    try {
        return JSON.parse(localStorage.getItem('failedTracks') || '[]');
    }
    catch (error) {
        console.error('读取失败埋点数据失败：', error);
        return [];
    }
};
const saveFailedTracks = (tracks) => {
    try {
        localStorage.setItem('failedTracks', JSON.stringify(tracks));
    }
    catch (error) {
        console.error('保存失败埋点数据失败：', error);
    }
};
/**
 * 重试失败的埋点（使用全局配置的 trackUrl）
 */
const retryFailedTracks = async (force = false) => {
    const failedTracks = getFailedTracks();
    if (failedTracks.length === 0)
        return;
    const { retryConfig, trackUrl } = GLOBAL_TRACK_CONFIG;
    const retryableTracks = failedTracks.filter(track => {
        const currentRetryCount = track.retryCount || 0;
        const timeCondition = force || Date.now() - track.retryTime >= retryConfig.initialDelay * Math.pow(retryConfig.delayMultiplier, currentRetryCount);
        return currentRetryCount < retryConfig.maxRetryTimes && timeCondition;
    });
    if (retryableTracks.length === 0)
        return;
    for (const track of retryableTracks) {
        try {
            // 使用全局配置的 trackUrl
            await fetch(trackUrl, {
                method: 'POST',
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
            console.log('埋点重试成功：', track.eventName);
            const index = failedTracks.findIndex(t => t.retryTime === track.retryTime && t.eventName === track.eventName);
            if (index > -1)
                failedTracks.splice(index, 1);
        }
        catch (error) {
            console.error('埋点重试失败：', track.eventName, error);
            const index = failedTracks.findIndex(t => t.retryTime === track.retryTime && t.eventName === track.eventName);
            if (index > -1) {
                failedTracks[index].retryCount = (failedTracks[index].retryCount || 0) + 1;
                failedTracks[index].retryTime = Date.now();
            }
        }
    }
    saveFailedTracks(failedTracks);
};
/**
 * 通用埋点发送函数（支持单个 Hook 覆盖 trackUrl）
 * @param params 埋点参数
 * @param config 单个 Hook 的配置（可覆盖 trackUrl）
 */
const sendTrack = async (params, config) => {
    var _a;
    if (!params.eventName) {
        console.warn('埋点缺少必要参数：eventName');
        return;
    }
    // 优先级：单个 Hook 配置 > 全局配置
    const finalTrackUrl = config.trackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = (_a = config.enable) !== null && _a !== void 0 ? _a : GLOBAL_TRACK_CONFIG.enable;
    if (!isEnable)
        return;
    try {
        // 使用最终确定的 trackUrl 发送请求
        await fetch(finalTrackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                referrer: document.referrer
            })
        });
        console.log('埋点上报成功：', params);
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => retryFailedTracks(), { timeout: 2000 });
        }
        else {
            setTimeout(() => retryFailedTracks(), 1000);
        }
    }
    catch (error) {
        console.error('埋点上报失败：', error);
        const failedTracks = getFailedTracks();
        failedTracks.push({ ...params, retryTime: Date.now(), retryCount: 0 });
        saveFailedTracks(failedTracks);
    }
};
// ---------------------- 核心 Hooks 实现 ----------------------
const useTrack = (params, config = {}) => {
    // 合并默认配置（含全局配置）和单个 Hook 配置
    const mergedConfig = { ...getMergedDefaultConfig(), ...config };
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
// 以下 Hooks 代码无需修改（useTrackClick/useTrackExposure 等），因为它们基于 useTrack 封装
const useTrackClick = (eventName, customParams = {}, config = {}) => {
    const { triggerTrack } = useTrack({ eventName, type: TrackType.CLICK, ...customParams }, config);
    const handleClick = useCallback((e, extraParams = {}) => {
        const clickParams = { clientX: (e === null || e === void 0 ? void 0 : e.clientX) || 0, clientY: (e === null || e === void 0 ? void 0 : e.clientY) || 0, ...extraParams };
        triggerTrack(clickParams);
    }, [triggerTrack]);
    return handleClick;
};
const useTrackExposure = (eventName, customParams = {}, config = {}) => {
    const mergedConfig = { ...getMergedDefaultConfig(), ...config };
    const { triggerTrack } = useTrack({ eventName, type: TrackType.EXPOSURE, ...customParams }, mergedConfig);
    const targetRef = useRef(null);
    const hasReported = useRef(false);
    useEffect(() => {
        if (!mergedConfig.enable)
            return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && !hasReported.current) {
                    const exposureParams = {
                        intersectionRatio: entry.intersectionRatio,
                        boundingClientRect: entry.boundingClientRect,
                        exposureTime: Date.now()
                    };
                    triggerTrack(exposureParams);
                    if (mergedConfig.exposureOnce) {
                        hasReported.current = true;
                        observer.unobserve(entry.target);
                    }
                }
            });
        }, { threshold: mergedConfig.exposureThreshold });
        const target = targetRef.current;
        if (target)
            observer.observe(target);
        return () => {
            if (target)
                observer.unobserve(target);
            observer.disconnect();
        };
    }, [mergedConfig, triggerTrack]);
    return targetRef;
};
const useTrackPageStay = (eventName, customParams = {}, config = {}) => {
    const { triggerTrack } = useTrack({ eventName, type: TrackType.PAGE_STAY, ...customParams }, config);
    const startTime = useRef(Date.now());
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                const stayTime = Date.now() - startTime.current;
                triggerTrack({ stayTime });
            }
            else {
                startTime.current = Date.now();
            }
        };
        const handleBeforeUnload = () => {
            const stayTime = Date.now() - startTime.current;
            triggerTrack({ stayTime });
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [triggerTrack]);
};
const useTrackCustom = (eventName, customParams = {}, config = {}) => {
    const { triggerTrack } = useTrack({ eventName, type: TrackType.CUSTOM, ...customParams }, config);
    return triggerTrack;
};
const useTrackRetryListener = () => {
    useEffect(() => {
        const initTimer = setTimeout(() => retryFailedTracks(), 3000);
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                retryFailedTracks();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        let idleCallbackId = null;
        const checkIdleRetry = () => {
            retryFailedTracks();
            idleCallbackId = window.requestIdleCallback(checkIdleRetry, { timeout: 30000 });
        };
        if (window.requestIdleCallback) {
            idleCallbackId = window.requestIdleCallback(checkIdleRetry, { timeout: 30000 });
        }
        return () => {
            clearTimeout(initTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (idleCallbackId !== null && window.cancelIdleCallback) {
                window.cancelIdleCallback(idleCallbackId);
            }
        };
    }, []);
};

export { TrackType, getFailedTracks, retryFailedTracks, saveFailedTracks, setTrackGlobalConfig, useTrack, useTrackClick, useTrackCustom, useTrackExposure, useTrackPageStay, useTrackRetryListener };
//# sourceMappingURL=index.esm.js.map
