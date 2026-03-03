import {TrackConfig, TrackType} from "../../types";
import {getTrackGlobalConfig} from "../config";
import {useTrack} from "./useTrack";
import {useEffect, useRef} from "react";

/**
 * 曝光埋点 Hook - 封装元素曝光埋点逻辑，返回需要监听的 DOM 引用
 * @template T 目标元素类型（默认：HTMLElement）
 * @param eventName 曝光事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，支持曝光阈值、是否只上报一次等）
 * @returns 需绑定到目标元素的 Ref 对象
 */
export const useTrackExposure = <T extends HTMLElement = HTMLElement>(
    eventName: string,
    customParams: Record<string, any> = {},
    config: TrackConfig = {}
) => {
    const mergedConfig = { ...getTrackGlobalConfig(), ...config };
    const { triggerTrack } = useTrack(
        { eventName, type: TrackType.EXPOSURE, ...customParams },
        mergedConfig
    );

    const latestConfigRef = useRef(mergedConfig)

    const targetRef = useRef<T>(null);
    const hasReported = useRef(false);

    useEffect(() => {
        if (!latestConfigRef.current.enable) return;

        const observer = new IntersectionObserver(
            (entries) => {
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
            },
            { threshold: latestConfigRef.current.exposureThreshold }
        );

        const target = targetRef.current;
        if (target) observer.observe(target);

        return () => {
            if (target) observer.unobserve(target);
            observer.disconnect();
        };
    }, [triggerTrack]);

    return targetRef;
};