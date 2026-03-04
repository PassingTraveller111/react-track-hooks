import { TrackConfig, TrackType } from "../../types";
import { useTrack } from "./useTrack";
import { useEffect, useRef } from "react";
import { getTrackGlobalConfig } from "../config";
import { sendBeaconTrack } from "../core/sendBeaconTrack";

// 默认配置（兜底值，全局配置可覆盖）
const DEFAULT_PAGE_STAY_CONFIG = {
    timeout: 30 * 60 * 1000,      // 30分钟无操作 → 暂停计时
    minDuration: 2000,            // 最小有效时长2秒，低于不上报
    maxDuration: 60 * 60 * 1000,   // 最大单页时长60分钟，防止异常数据
    checkInterval: 1000,          // 每秒检查一次活跃状态
};

/**
 * 页面停留时长埋点 Hook - 自动监听页面/组件的停留时长并上报
 * @param eventName 停留时长事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 */
export const useTrackPageStay = (
    eventName: string,
    customParams: Record<string, any> = {},
    config: TrackConfig = {}
) => {
    // 初始化埋点上报方法
    const { triggerTrack } = useTrack(
        { eventName, type: TrackType.PAGE_STAY, ...customParams },
        config
    );

    // ===================== 持久化状态（不受渲染/闭包影响） =====================
    // 当前计时片段的开始时间
    const startTimeRef = useRef<number | null>(null);
    // 用户最后一次活跃时间
    const lastActiveRef = useRef<number>(Date.now());
    // 累计有效停留总时长
    const totalValidDurationRef = useRef<number>(0);
    // 定时检查器引用
    const timerRef = useRef<number | null>(null);
    // 是否正在计时中
    const isTrackingRef = useRef(false);


    // ===================== 副作用：监听页面状态 & 用户行为 =====================
    useEffect(() => {
        const getLastPageStayConfig = () => {
            // 合并配置：默认 < 全局 < 入参（优先级从低到高）
            const globalConfig = getTrackGlobalConfig();
            return {
                ...DEFAULT_PAGE_STAY_CONFIG,
                ...globalConfig.pageStayConfig,
                ...config.pageStayConfig,
            };
        }
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
            if (!startTimeRef.current || !isTrackingRef.current) return;
            const now = Date.now();
            const currentSegmentDuration = now - startTimeRef.current;
            const { timeout } = getLastPageStayConfig()

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
                    type: TrackType.PAGE_STAY,
                    stayTime: finalStayTime,
                    ...customParams,
                };

                if (isUnload) {
                    // 卸载场景：sendBeacon 保证送达
                    sendBeaconTrack(trackParams, config);
                } else {
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
                console.log('页面可见，重新开始计时')
                // 页面可见：重新开始计时
                startTimeRef.current = Date.now();
                lastActiveRef.current = Date.now();
                isTrackingRef.current = true;
            } else {
                // 页面隐藏：立即暂停
                stopTracking();
                if (reportOnHidden) { // 页面隐藏时是否触发上报
                    console.log('页面隐藏，触发上报')
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
            if (!isTrackingRef.current) return;

            const now = Date.now();
            const { timeout } = getLastPageStayConfig();
            // 超过超时时间未操作 → 停止并上报
            if (now - lastActiveRef.current >= timeout) {
                console.log('用户不活跃，停止计时并进行上报')
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
            clearInterval(timerRef.current!);
            activeEvents.forEach(evt => window.removeEventListener(evt, markUserActive));
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);

            reportValidStayTime(true); // 组件卸载进行上报
        };

    }, [triggerTrack, eventName, customParams, config]);
};