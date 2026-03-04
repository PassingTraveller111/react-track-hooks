export declare const isClient: () => boolean;
/**
 * 安全设置 localStorage 数据
 */
export declare const safeLocalStorageSet: (key: string, data: any) => void;
/**
 * 生成唯一的埋点事件 ID
 * @param eventName 事件名称（用于区分事件类型）
 * @returns 唯一事件 ID（格式：${eventName}_${时间戳}_${固定长度随机串}）
 */
export declare const getEventId: (eventName: string) => string;
//# sourceMappingURL=utils.d.ts.map