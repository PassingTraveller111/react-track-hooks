import { TrackConfig, TrackParams } from "../../types";
import { isClient } from "../../utils";
import { getTrackGlobalConfig } from "../config";

/**
 * 页面卸载时专用上报方法（使用 navigator.sendBeacon）
 * 不会进入批量队列，不会丢失，浏览器保证发送
 */
export const sendBeaconTrack = async (
    params: TrackParams,
    config: TrackConfig = {}
) => {
    // 服务端不执行
    if (!isClient()) return;
    if (!params.eventName) {
        console.warn(" Beacon 埋点缺少必要参数：eventName");
        return;
    }

    const GLOBAL_TRACK_CONFIG = getTrackGlobalConfig();
    const finalTrackUrl = config.trackUrl || GLOBAL_TRACK_CONFIG.trackUrl;
    const isEnable = config.enable ?? GLOBAL_TRACK_CONFIG.enable;

    if (!isEnable) return;

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
        } else {
            // 浏览器不支持 sendBeacon，跳过上报
        }
    } catch (err) {
        console.error(" Beacon 埋点发送失败：", err);
    }
};