'use strict';

var react = require('react');

// src/types.ts
exports.TrackType = void 0;
(function (TrackType) {
    TrackType["CLICK"] = "click";
    TrackType["EXPOSURE"] = "exposure";
    TrackType["PAGE_STAY"] = "page_stay";
    TrackType["CUSTOM"] = "custom";
    TrackType["FIRST_RENDER"] = "first_render";
})(exports.TrackType || (exports.TrackType = {}));

// 定义默认配置（私有，不对外暴露）
const DEFAULT_TRACK_CONFIG = {
    trackUrl: '/api/track',
    batchTrackUrl: '/api/track/batch',
    enable: true,
    enableBatch: true,
    retryConfig: {
        maxRetryTimes: 3,
        initialDelay: 1000,
        delayMultiplier: 2
    },
    batchConfig: {
        batchSize: 10,
        batchInterval: 5000,
    },
    exposureConfig: {
        exposureOnce: true,
        exposureThreshold: 0.5,
    },
    pageStayConfig: {
        timeout: 30 * 60 * 1000, // 30分钟无操作超时
        minDuration: 2000, // 最小有效时长2秒（低于则丢弃）
        maxDuration: 60 * 60 * 1000, // 最大单次时长60分钟（防止异常数据）
        checkInterval: 1000, // 每秒检查一次活跃状态
        reportOnHidden: true, // 页面切后台就立即上报，防止数据丢失
    }
};
// 私有全局配置（仅内部可直接访问）
let _GLOBAL_TRACK_CONFIG = { ...DEFAULT_TRACK_CONFIG };
/**
 * 设置全局埋点配置（对外暴露的核心API）
 * @param config 要覆盖的配置（支持部分覆盖）
 * @returns 最新的全局配置（只读副本）
 */
const setTrackGlobalConfig = (config) => {
    if (typeof config !== 'object' || config === null) {
        console.warn('setTrackGlobalConfig 入参必须为对象，已忽略');
        return getTrackGlobalConfig();
    }
    // 分步合并配置，同时做合法性校验
    _GLOBAL_TRACK_CONFIG = {
        ..._GLOBAL_TRACK_CONFIG,
        ...config,
    };
    console.debug('全局埋点配置已更新：', _GLOBAL_TRACK_CONFIG);
    return getTrackGlobalConfig();
};
/**
 * 获取当前全局埋点配置（返回只读副本，防止外部修改）
 * @returns 只读的全局配置对象
 */
const getTrackGlobalConfig = () => {
    // 使用 Object.freeze 冻结对象，防止外部篡改
    return Object.freeze({ ..._GLOBAL_TRACK_CONFIG });
};

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
/**
 * 生成唯一的埋点事件 ID
 * @param eventName 事件名称（用于区分事件类型）
 * @returns 唯一事件 ID（格式：${eventName}_${时间戳}_${固定长度随机串}）
 */
const getEventId = (eventName) => {
    try {
        // 1. 校验入参，避免空值/非法值导致 ID 异常
        if (!eventName || typeof eventName !== 'string') {
            console.warn('getEventId: eventName 必须为非空字符串，已使用默认值');
            eventName = 'unknown_event';
        }
        // 2. 时间戳（精确到毫秒，可升级为微秒提升精度）
        const timestamp = Date.now();
        // 可选：浏览器支持的话，用 performance.now() 拿到微秒级时间戳，降低重复概率
        // const preciseTimestamp = performance.now().toString().replace('.', '');
        // 3. 生成固定长度（16位）的随机字符串，保证唯一性
        const randomStr = generateFixedLengthRandomStr(16);
        // 4. 拼接最终 ID（用下划线分隔，便于解析）
        return `${eventName}_${timestamp}_${randomStr}`;
    }
    catch (err) {
        // 兜底：异常时生成极简 ID，避免埋点流程中断
        console.error('getEventId 生成失败：', err);
        return `fallback_${Date.now()}_${Math.random().toString().slice(2, 10)}`;
    }
};
/**
 * 生成固定长度的随机字符串（数字+字母）
 * @param length 目标长度（默认16位）
 * @returns 固定长度的随机字符串
 */
const generateFixedLengthRandomStr = (length = 16) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        // 用 Math.floor 保证取整，避免越界
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
};

/**
 * 重试流程互斥锁 - 防止同时触发多次重试，避免并发问题
 */
let isRetryRunning = false;
/**
 * 从 localStorage 中读取失败的埋点数据
 * @returns 失败埋点数组（解析失败/数据异常时返回空数组）
 */
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
/**
 * 将失败的埋点数据保存到 localStorage
 * @param tracks 待保存的失败埋点数组
 */
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
 * 重试失败的埋点数据（核心重试逻辑）
 * @param force 是否强制重试（忽略指数退避时间，默认：false）
 * @returns Promise<void> 重试流程的异步结果
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
        const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig();
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
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig();
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
                id: getEventId(track.eventName),
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
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig();
    const { batchConfig } = GLOBAL_TRACK_CONFIG;
    if (!(GLOBAL_TRACK_CONFIG === null || GLOBAL_TRACK_CONFIG === void 0 ? void 0 : GLOBAL_TRACK_CONFIG.enableBatch))
        return;
    // 设置新定时器
    BATCH_TIMER = setTimeout(() => {
        processBatchQueue(config);
    }, (batchConfig === null || batchConfig === void 0 ? void 0 : batchConfig.batchInterval) || 5000);
};

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
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig();
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
            id: getEventId(params.eventName),
            ...params,
            retryTime: Date.now(),
            retryCount: 0
        });
        saveFailedTracks(failedTracks);
    }
};

/**
 * 基础埋点 Hook - 封装通用埋点逻辑，返回触发埋点的方法
 * @param params 埋点基础参数（事件名、类型、自定义参数等）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 * @returns 包含触发埋点方法的对象
 */
const useTrack = (params, config = {}) => {
    const latestConfigRef = react.useRef(config);
    const trackRef = react.useRef(params);
    latestConfigRef.current = config;
    trackRef.current = params;
    // 触发时可以覆盖定义时的params
    const triggerTrack = react.useCallback((customParams = {}) => {
        // 合并默认配置（含全局配置）和单个 Hook 配置
        const mergedConfig = { ...getTrackGlobalConfig(), ...latestConfigRef.current };
        const finalParams = {
            ...trackRef.current,
            ...customParams
        };
        // 把 mergedConfig 传给 sendTrack，支持覆盖 trackUrl
        sendTrack(finalParams, mergedConfig);
    }, []);
    return { triggerTrack };
};

/**
 * 点击埋点 Hook - 封装点击事件的埋点逻辑，返回点击处理函数
 * @param eventName 点击事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 * @returns 点击事件处理函数（支持接收鼠标事件和额外参数）
 */
const useTrackClick = (eventName, customParams = {}, config = {}) => {
    const { triggerTrack } = useTrack({ eventName, type: exports.TrackType.CLICK, ...customParams }, config);
    const handleClick = react.useCallback((e, extraParams = {}) => {
        const clickParams = { clientX: (e === null || e === void 0 ? void 0 : e.clientX) || 0, clientY: (e === null || e === void 0 ? void 0 : e.clientY) || 0, ...extraParams };
        triggerTrack(clickParams);
    }, [triggerTrack]);
    return handleClick;
};

/**
 * 自定义埋点 Hook - 简化自定义类型埋点的调用，直接返回触发方法
 * @param eventName 自定义事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 * @returns 触发自定义埋点的方法
 */
const useTrackCustom = (eventName, customParams = {}, config = {}) => {
    const { triggerTrack } = useTrack({ eventName, type: exports.TrackType.CUSTOM, ...customParams }, config);
    return triggerTrack;
};

/**
 * 曝光埋点 Hook - 封装元素曝光埋点逻辑，返回需要监听的 DOM 引用
 * @template T 目标元素类型（默认：HTMLElement）
 * @param eventName 曝光事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，支持曝光阈值、是否只上报一次等）
 * @returns 需绑定到目标元素的 Ref 对象
 */
const useTrackExposure = (eventName, customParams = {}, config = {}) => {
    const mergedConfig = { ...getTrackGlobalConfig(), ...config };
    const { triggerTrack } = useTrack({ eventName, type: exports.TrackType.EXPOSURE, ...customParams }, mergedConfig);
    const latestConfigRef = react.useRef(mergedConfig);
    const targetRef = react.useRef(null);
    const hasReported = react.useRef(false);
    react.useEffect(() => {
        if (!latestConfigRef.current.enable)
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
                    if (latestConfigRef.current.exposureOnce) {
                        hasReported.current = true;
                        observer.unobserve(entry.target);
                    }
                }
            });
        }, { threshold: latestConfigRef.current.exposureThreshold });
        const target = targetRef.current;
        if (target)
            observer.observe(target);
        return () => {
            if (target)
                observer.unobserve(target);
            observer.disconnect();
        };
    }, [triggerTrack]);
    return targetRef;
};

/**
 * 页面卸载时专用上报方法（使用 navigator.sendBeacon）
 * 不会进入批量队列，不会丢失，浏览器保证发送
 */
const sendBeaconTrack = async (params, config = {}) => {
    var _a;
    // 服务端不执行
    if (!isClient())
        return;
    if (!params.eventName) {
        console.warn(" Beacon 埋点缺少必要参数：eventName");
        return;
    }
    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig();
    const finalTrackUrl = config.trackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = (_a = config.enable) !== null && _a !== void 0 ? _a : GLOBAL_TRACK_CONFIG.enable;
    if (!isEnable)
        return;
    try {
        const data = JSON.stringify({
            ...params,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer,
        });
        if (navigator.sendBeacon) {
            // 发送 Blob 格式，兼容性最好，服务端解析最稳
            const blob = new Blob([data], { type: "application/json" });
            navigator.sendBeacon(finalTrackUrl, blob);
        }
        else {
            // 浏览器不支持 sendBeacon，跳过上报
        }
    }
    catch (err) {
        console.error(" Beacon 埋点发送失败：", err);
    }
};

// 默认配置（兜底值，全局配置可覆盖）
const DEFAULT_PAGE_STAY_CONFIG = {
    timeout: 30 * 60 * 1000, // 30分钟无操作 → 暂停计时
    minDuration: 2000, // 最小有效时长2秒，低于不上报
    maxDuration: 60 * 60 * 1000, // 最大单页时长60分钟，防止异常数据
    checkInterval: 1000, // 每秒检查一次活跃状态
};
/**
 * 页面停留时长埋点 Hook - 自动监听页面/组件的停留时长并上报
 * @param eventName 停留时长事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 */
const useTrackPageStay = (eventName, customParams = {}, config = {}) => {
    // 初始化埋点上报方法
    const { triggerTrack } = useTrack({ eventName, type: exports.TrackType.PAGE_STAY, ...customParams }, config);
    // ===================== 持久化状态（不受渲染/闭包影响） =====================
    // 当前计时片段的开始时间
    const startTimeRef = react.useRef(null);
    // 用户最后一次活跃时间
    const lastActiveRef = react.useRef(Date.now());
    // 累计有效停留总时长
    const totalValidDurationRef = react.useRef(0);
    // 定时检查器引用
    const timerRef = react.useRef(null);
    // 是否正在计时中
    const isTrackingRef = react.useRef(false);
    // ===================== 副作用：监听页面状态 & 用户行为 =====================
    react.useEffect(() => {
        const getLastPageStayConfig = () => {
            // 合并配置：默认 < 全局 < 入参（优先级从低到高）
            const globalConfig = getTrackGlobalConfig();
            return {
                ...DEFAULT_PAGE_STAY_CONFIG,
                ...globalConfig.pageStayConfig,
                ...config.pageStayConfig,
            };
        };
        /**
         * 标记用户活跃
         * 触发条件：鼠标移动/点击/滚动/键盘/触屏
         * 作用：刷新最后活跃时间；若已暂停则恢复计时
         */
        const markUserActive = () => {
            lastActiveRef.current = Date.now();
            // 若当前未计时 + 页面可见 → 重新开始计时
            if (!isTrackingRef.current && document.visibilityState === "visible") {
                startTimeRef.current = Date.now();
                isTrackingRef.current = true;
            }
        };
        /**
         * 停止当前计时片段
         * 作用：计算本次片段时长 → 累加到总有效时长 → 重置计时状态
         */
        const stopTracking = () => {
            // 未开始计时则直接返回
            if (!startTimeRef.current || !isTrackingRef.current)
                return;
            const now = Date.now();
            const currentSegmentDuration = now - startTimeRef.current;
            const { timeout } = getLastPageStayConfig();
            // 只有在【超时时间内有操作】的片段才计入有效时长
            if (now - lastActiveRef.current < timeout && currentSegmentDuration > 0) {
                totalValidDurationRef.current += currentSegmentDuration;
            }
            // 重置当前计时状态
            startTimeRef.current = null;
            isTrackingRef.current = false;
        };
        /**
         * 上报最终有效停留时长
         * isUnload：是否页面卸载（卸载使用 sendBeacon）
         */
        const reportValidStayTime = (isUnload = false) => {
            // 先确保停止当前计时
            stopTracking();
            const { minDuration, maxDuration } = getLastPageStayConfig();
            // 限制最大时长，防止异常数据
            const finalStayTime = Math.min(totalValidDurationRef.current, maxDuration);
            if (finalStayTime >= minDuration) {
                const trackParams = {
                    eventName,
                    type: exports.TrackType.PAGE_STAY,
                    stayTime: finalStayTime,
                    ...customParams,
                };
                if (isUnload) {
                    // 卸载场景：sendBeacon 保证送达
                    sendBeaconTrack(trackParams, config);
                }
                else {
                    // 正常场景：进入批量队列
                    triggerTrack({ stayTime: finalStayTime });
                }
            }
            // 重置累计时长，避免重复上报
            totalValidDurationRef.current = 0;
        };
        /**
         * 页面可见性变化监听
         * 显示 → 开始/恢复计时
         * 隐藏 → 暂停计时
         */
        const handleVisibilityChange = () => {
            const { reportOnHidden } = getLastPageStayConfig();
            if (document.visibilityState === "visible") {
                console.log('页面可见，重新开始计时');
                // 页面可见：重新开始计时
                startTimeRef.current = Date.now();
                lastActiveRef.current = Date.now();
                isTrackingRef.current = true;
            }
            else {
                // 页面隐藏：立即暂停
                stopTracking();
                if (reportOnHidden) { // 页面隐藏时是否触发上报
                    console.log('页面隐藏，触发上报');
                    reportValidStayTime();
                }
            }
        };
        /**
         * 定时检查用户活跃状态
         * 每秒执行一次
         * 超过配置的无操作时间 → 停止计时并上报
         */
        const checkActiveStatus = () => {
            if (!isTrackingRef.current)
                return;
            const now = Date.now();
            const { timeout } = getLastPageStayConfig();
            // 超过超时时间未操作 → 停止并上报
            if (now - lastActiveRef.current >= timeout) {
                console.log('用户不活跃，停止计时并进行上报');
                stopTracking();
                reportValidStayTime(); // 正常队列
            }
        };
        // ===================== 绑定事件监听 =====================
        // 用户活跃行为事件列表
        const activeEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
        activeEvents.forEach(evt => window.addEventListener(evt, markUserActive));
        // 页面显隐切换
        document.addEventListener("visibilitychange", handleVisibilityChange);
        // ===================== 初始化计时 =====================
        if (document.visibilityState === "visible") {
            startTimeRef.current = Date.now();
            lastActiveRef.current = Date.now();
            isTrackingRef.current = true;
        }
        // ===================== 启动活跃检查定时器 =====================
        const { checkInterval } = getLastPageStayConfig();
        timerRef.current = setInterval(checkActiveStatus, checkInterval);
        // ===================== 页面关闭/刷新时上报（使用 Beacon） =====================
        const handleBeforeUnload = () => {
            reportValidStayTime(true);
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        // ===================== 清理副作用（组件卸载/页面离开） =====================
        return () => {
            clearInterval(timerRef.current);
            activeEvents.forEach(evt => window.removeEventListener(evt, markUserActive));
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            reportValidStayTime(true); // 组件卸载进行上报
        };
    }, [triggerTrack, eventName, customParams, config]);
};

// 单例锁（全局变量）
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
const useTrackRetryListener = () => {
    react.useEffect(() => {
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

/**
 * 组件首次渲染埋点 Hook - 仅在组件挂载（首次渲染）时触发一次埋点
 * @param eventName 埋点事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 */
const useTrackFirstRender = (eventName, customParams = {}, config = {}) => {
    // 复用基础埋点 Hook，指定事件类型为 FIRST_RENDER
    const { triggerTrack } = useTrack({ eventName, type: exports.TrackType.FIRST_RENDER, ...customParams }, config);
    // 标记是否已触发埋点，防止重复执行
    const hasTriggered = react.useRef(false);
    react.useEffect(() => {
        // 非首次渲染/已触发过 → 直接返回
        if (hasTriggered.current)
            return;
        // 标记为已触发
        hasTriggered.current = true;
        // 触发埋点（补充首次渲染专属参数）
        triggerTrack({
            renderTime: Date.now(), // 首次渲染时间戳
            trackType: 'component_first_render', // 便于区分埋点类型
        });
        // 空依赖数组 → 仅组件挂载时执行一次
    }, []);
};

exports.getFailedTracks = getFailedTracks;
exports.getTrackGlobalConfig = getTrackGlobalConfig;
exports.retryFailedTracks = retryFailedTracks;
exports.saveFailedTracks = saveFailedTracks;
exports.setTrackGlobalConfig = setTrackGlobalConfig;
exports.useTrack = useTrack;
exports.useTrackClick = useTrackClick;
exports.useTrackCustom = useTrackCustom;
exports.useTrackExposure = useTrackExposure;
exports.useTrackFirstRender = useTrackFirstRender;
exports.useTrackPageStay = useTrackPageStay;
exports.useTrackRetryListener = useTrackRetryListener;
//# sourceMappingURL=index.cjs.js.map
