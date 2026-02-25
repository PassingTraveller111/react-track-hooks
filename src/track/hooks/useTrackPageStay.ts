import {TrackConfig, TrackType} from "../../types";
import {useTrack} from "./useTrack";
import {useEffect, useRef} from "react";

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
    const { triggerTrack } = useTrack(
        { eventName, type: TrackType.PAGE_STAY, ...customParams },
        config
    );

    const startTime = useRef(Date.now());

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                const stayTime = Date.now() - startTime.current;
                triggerTrack({ stayTime });
            } else {
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