import { useEffect, useRef } from 'react';
import { TrackConfig, TrackType } from '../../types';
import { useTrack } from './useTrack';

/**
 * 组件首次渲染埋点 Hook - 仅在组件挂载（首次渲染）时触发一次埋点
 * @param eventName 埋点事件名称（必填）
 * @param customParams 自定义埋点参数（可选）
 * @param config 埋点配置项（可选，会合并全局默认配置）
 */
export const useTrackFirstRender = (
    eventName: string,
    customParams: Record<string, any> = {},
    config: TrackConfig = {}
) => {
    // 复用基础埋点 Hook，指定事件类型为 FIRST_RENDER
    const { triggerTrack } = useTrack(
        { eventName, type: TrackType.FIRST_RENDER, ...customParams },
        config
    );

    // 标记是否已触发埋点，防止重复执行
    const hasTriggered = useRef(false);

    useEffect(() => {
        // 非首次渲染/已触发过 → 直接返回
        if (hasTriggered.current) return;

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