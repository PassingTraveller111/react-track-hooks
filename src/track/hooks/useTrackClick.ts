import {TrackConfig, TrackType} from "../../types";
import {useTrack} from "./useTrack";
import {useCallback} from "react";

/**
 * 点击埋点 Hook - 封装点击事件的埋点逻辑，返回点击处理函数
 * @param eventName 点击事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选）
 * @returns 点击事件处理函数（支持接收鼠标事件和额外参数）
 */
export const useTrackClick = (
    eventName: string,
    customParams: Record<string, any> = {},
    config: TrackConfig = {}
) => {
    const { triggerTrack } = useTrack(
        { eventName, type: TrackType.CLICK, ...customParams },
        config
    );

    const handleClick = useCallback((e?: React.MouseEvent, extraParams = {}) => {
        const clickParams = { clientX: e?.clientX || 0, clientY: e?.clientY || 0, ...extraParams };
        triggerTrack(clickParams);
    }, [triggerTrack]);

    return handleClick;
};