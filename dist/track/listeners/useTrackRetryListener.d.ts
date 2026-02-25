/**
 * 埋点重试监听 Hook - 自动注册多场景的失败埋点重试触发逻辑
 * 核心能力：
 * 1. 首屏渲染完成3秒后，触发一次失败埋点重试
 * 2. 监听页面可见性变化（从不可见→可见），触发重试
 * 3. 利用浏览器空闲时间周期性重试（兜底：每30秒执行一次）
 * 注意：该 Hook 全局仅会注册一次监听，重复调用不会重复绑定事件
 */
export declare const useTrackRetryListener: () => void;
//# sourceMappingURL=useTrackRetryListener.d.ts.map