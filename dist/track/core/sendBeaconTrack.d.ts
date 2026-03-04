import { TrackConfig, TrackParams } from "../../types";
/**
 * 页面卸载时专用上报方法（使用 navigator.sendBeacon）
 * 不会进入批量队列，不会丢失，浏览器保证发送
 */
export declare const sendBeaconTrack: (params: TrackParams, config?: TrackConfig) => Promise<void>;
//# sourceMappingURL=sendBeaconTrack.d.ts.map