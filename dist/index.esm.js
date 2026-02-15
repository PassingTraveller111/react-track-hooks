import { useRef, useEffect, useCallback } from 'react';

// src/types.ts
var TrackType;
(function (TrackType) {
    TrackType["CLICK"] = "click";
    TrackType["EXPOSURE"] = "exposure";
    TrackType["PAGE_STAY"] = "page_stay";
    TrackType["CUSTOM"] = "custom";
})(TrackType || (TrackType = {}));

// 环境判断工具函数
const isClient = () => {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
};
/**
 * 安全设置 localStorage 数据
 */
const safeLocalStorageSet = (key, data) => {
    if (!isClient())
        return;
    try {
        // 限制存储大小（示例：最大500KB）
        const str = JSON.stringify(data);
        if (str.length > 500 * 1024) {
            console.warn('localStorage数据超过500KB，截断旧数据');
            // 保留最新的100条失败埋点
            if (key === 'failedTracks' && Array.isArray(data)) {
                localStorage.setItem(key, JSON.stringify(data.slice(-100)));
                return;
            }
            return;
        }
        localStorage.setItem(key, str);
    }
    catch (error) {
        console.error('写入localStorage失败：', error);
    }
};

// src/trackHooks.ts
// 全局配置（默认值），并提供修改全局配置的方法
let GLOBAL_TRACK_CONFIG = {
    trackUrl: '/api/track', // 默认上报地址
    batchTrackUrl: '/api/track/batch', // 批量上报地址
    enable: true,
    enableBatch: true, // 是否开启批量上报
    retryConfig: {
        maxRetryTimes: 3,
        initialDelay: 1000,
        delayMultiplier: 2
    },
    // 批量上报配置
    batchConfig: {
        batchSize: 10, // 队列达到10条时触发上报
        batchInterval: 5000, // 每5秒触发一次上报
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
/**
 * 通用埋点发送函数（支持单个 Hook 覆盖 trackUrl）
 * @param params 埋点参数
 * @param config 单个 Hook 的配置（可覆盖 trackUrl）
 */
const sendTrack = async (params, config) => {
    var _a, _b, _c, _d, _e;
    // 服务端不执行
    if (!isClient())
        return;
    if (!params.eventName) {
        console.warn('埋点缺少必要参数：eventName');
        return;
    }
    // 优先级：单个 Hook 配置 > 全局配置
    const finalTrackUrl = config.trackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = (_a = config.enable) !== null && _a !== void 0 ? _a : GLOBAL_TRACK_CONFIG.enable;
    if (!isEnable)
        return;
    // 判断批量模式（单个Hook配置 > 全局配置）
    const enableBatch = (_c = (_b = config === null || config === void 0 ? void 0 : config.enableBatch) !== null && _b !== void 0 ? _b : GLOBAL_TRACK_CONFIG === null || GLOBAL_TRACK_CONFIG === void 0 ? void 0 : GLOBAL_TRACK_CONFIG.enableBatch) !== null && _c !== void 0 ? _c : true;
    if (enableBatch) {
        // 批量模式：入队 + 触发调度
        BATCH_TRACK_QUEUE.push(params);
        initBatchTimer(config);
        if (BATCH_TRACK_QUEUE.length >= ((_e = (_d = GLOBAL_TRACK_CONFIG.batchConfig) === null || _d === void 0 ? void 0 : _d.batchSize) !== null && _e !== void 0 ? _e : 10)) {
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
        }
        else {
            setTimeout(() => retryFailedTracks(), 1000);
        }
    }
    catch (error) {
        console.error('埋点上报失败：', error);
        const failedTracks = getFailedTracks();
        failedTracks.push({
            id: `${params.eventName}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ...params,
            retryTime: Date.now(),
            retryCount: 0
        });
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
// ---------------------- 重试核心逻辑 ----------------------
// 重试互斥锁，防止同时触发多次重试
let isRetryRunning = false;
const getFailedTracks = () => {
    if (!isClient())
        return [];
    try {
        const rawData = localStorage.getItem('failedTracks');
        // 2. 空值直接返回空数组
        if (!rawData)
            return [];
        const parsedData = JSON.parse(rawData);
        // 3. 解析后不是数组 → 返回空数组
        if (!Array.isArray(parsedData)) {
            console.warn('failedTracks 存储的数据不是数组，已重置为空数组');
            localStorage.setItem('failedTracks', '[]'); // 重置错误数据
            return [];
        }
        return parsedData;
    }
    catch (error) {
        console.error('读取失败埋点数据失败：', error);
        return [];
    }
};
const saveFailedTracks = (tracks) => {
    if (!isClient())
        return;
    try {
        safeLocalStorageSet('failedTracks', tracks);
    }
    catch (error) {
        console.error('保存失败埋点数据失败：', error);
    }
};
/**
 * 重试失败的埋点
 */
const retryFailedTracks = async (force = false) => {
    if (!isClient())
        return;
    if (isRetryRunning) {
        console.debug('已有重试流程在执行，跳过本次触发');
        return;
    }
    isRetryRunning = true;
    try {
        let failedTracks = getFailedTracks();
        if (failedTracks.length === 0)
            return;
        const { retryConfig = { maxRetryTimes: 3, initialDelay: 1000, delayMultiplier: 2 }, trackUrl, batchTrackUrl = trackUrl, // 批量接口默认使用单条接口
        enableBatch = false } = GLOBAL_TRACK_CONFIG;
        // 移除重复的默认值处理（前面已给retryConfig设默认值）
        const maxRetryTimes = retryConfig.maxRetryTimes;
        // 第一步：清理超过最大重试次数的埋点
        const [expiredTracks, validTracks] = failedTracks.reduce((acc, track) => {
            const currentRetryCount = track.retryCount || 0;
            if (currentRetryCount >= maxRetryTimes) {
                acc[0].push(track);
            }
            else {
                acc[1].push(track);
            }
            return acc;
        }, [[], []]);
        failedTracks = validTracks;
        // 第二步：筛选可重试的有效埋点 指数退避算法
        const retryableTracks = failedTracks.filter(track => {
            const currentRetryCount = track.retryCount || 0;
            const backoffTime = retryConfig.initialDelay * Math.pow(retryConfig.delayMultiplier, currentRetryCount);
            const timeCondition = force || Date.now() - track.retryTime >= backoffTime;
            return timeCondition;
        });
        if (retryableTracks.length === 0)
            return;
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
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batchRetryTracks)
                });
                // 检查接口响应状态
                if (!response.ok) {
                    throw new Error(`批量接口返回异常：${response.status} ${response.statusText}`);
                }
                console.log('批量埋点重试成功：', batchRetryTracks.length, '条');
                // 过滤掉重试成功的埋点
                failedTracks = failedTracks.filter(track => !retryableTracks.some(item => item.id === track.id));
            }
            catch (error) {
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
        }
        else { // 单条上报
            for (const track of retryableTracks) {
                try {
                    const response = await fetch(trackUrl, {
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
                    // 检查单条接口响应状态
                    if (!response.ok) {
                        throw new Error(`单条接口返回异常：${response.status} ${response.statusText}`);
                    }
                    console.log('埋点重试成功：', track.eventName, '(ID:', track.id, ')');
                    const index = failedTracks.findIndex(t => t.id === track.id);
                    if (index > -1)
                        failedTracks.splice(index, 1);
                }
                catch (error) {
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
    }
    catch (error) {
        console.error('重试流程整体异常：', error);
    }
    finally {
        isRetryRunning = false;
    }
};
// 单例锁（全局变量）
let isRetryListenerRegistered = false;
const useTrackRetryListener = () => {
    useEffect(() => {
        // 单例拦截：已注册过则直接返回
        if (isRetryListenerRegistered)
            return;
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
        let idleCallbackId = null; // 空闲执行id
        let intervalId = null; // 定时器id
        const checkIdleRetry = () => {
            // 先检查失败队列是否为空
            const failedTracks = getFailedTracks();
            if (failedTracks.length === 0) {
                // 队列为空时，延迟1分钟再预约（减少空跑）
                setTimeout(() => {
                    if (window.requestIdleCallback) {
                        idleCallbackId = window.requestIdleCallback(checkIdleRetry, { timeout: 30000 });
                    }
                }, 60000);
                return;
            }
            // 进行失败重试
            retryFailedTracks();
            // 注册下一次的空闲回调
            if (window.requestIdleCallback) {
                idleCallbackId = window.requestIdleCallback(checkIdleRetry, { timeout: 30000 });
            }
        };
        // 启用首次空闲回调
        if (window.requestIdleCallback) {
            idleCallbackId = window.requestIdleCallback(checkIdleRetry, { timeout: 30000 });
        }
        else { // 防止浏览器不支持requestIdleCallback，兜底。每30秒执行一次
            intervalId = window.setInterval(retryFailedTracks, 30000);
        }
        return () => {
            // 清理首屏定时器
            if (initTimer)
                clearTimeout(initTimer);
            // 清理监听
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // 清理空闲/周期重试
            if (intervalId)
                window.clearInterval(intervalId);
            if (idleCallbackId !== null && window.cancelIdleCallback) {
                window.cancelIdleCallback(idleCallbackId);
            }
        };
    }, []);
};
// ---------------------- 批量上报核心逻辑 ----------------------
// 内存中的批量上报队列
let BATCH_TRACK_QUEUE = [];
// 批量上报定时器
let BATCH_TIMER = null;
// 防止并发上报的锁
let isBatchUploading = false;
/**
 * 批量发送埋点函数
 * @param tracks 埋点数组
 * @param config 配置项
 */
const sendBatchTrack = async (tracks, config) => {
    var _a;
    if (tracks.length === 0)
        return;
    // 优先级：单个 Hook 配置 > 全局配置
    const finalBatchUrl = config.batchTrackUrl || GLOBAL_TRACK_CONFIG.batchTrackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = (_a = config.enable) !== null && _a !== void 0 ? _a : GLOBAL_TRACK_CONFIG.enable;
    if (!isEnable)
        return;
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
        }
        else {
            setTimeout(() => retryFailedTracks(), 1000);
        }
        return true;
    }
    catch (error) {
        return false;
    }
};
/**
 * 处理批量队列（核心调度逻辑）
 */
const processBatchQueue = async (config) => {
    // 1. 锁兜底：防止极端并发
    if (isBatchUploading)
        return;
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
                id: `${track.eventName}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                ...track,
                retryTime: Date.now(),
                retryCount: 0
            }));
            // 合并失败队列并保存（限制大小，避免localStorage溢出）
            failedTracks.push(...newFailedTracks);
            saveFailedTracks(failedTracks.slice(-100)); // 只保留最新100条
        }
    }
    catch (error) {
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
    }
    finally {
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
const initBatchTimer = (config) => {
    // 清除旧定时器
    if (BATCH_TIMER) {
        clearTimeout(BATCH_TIMER);
    }
    const { batchConfig } = GLOBAL_TRACK_CONFIG;
    if (!(GLOBAL_TRACK_CONFIG === null || GLOBAL_TRACK_CONFIG === void 0 ? void 0 : GLOBAL_TRACK_CONFIG.enableBatch))
        return;
    // 设置新定时器
    BATCH_TIMER = setTimeout(() => {
        processBatchQueue(config);
    }, (batchConfig === null || batchConfig === void 0 ? void 0 : batchConfig.batchInterval) || 5000);
};

export { TrackType, getFailedTracks, getMergedDefaultConfig, retryFailedTracks, saveFailedTracks, setTrackGlobalConfig, useTrack, useTrackClick, useTrackCustom, useTrackExposure, useTrackPageStay, useTrackRetryListener };
//# sourceMappingURL=index.esm.js.map
