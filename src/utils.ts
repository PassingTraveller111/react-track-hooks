// 环境判断工具函数
export const isClient = () => {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
};

/**
 * 安全设置 localStorage 数据
 */
export const safeLocalStorageSet = (key: string, data: any) => {
    if(!isClient()) return;
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
    } catch (error) {
        console.error('写入localStorage失败：', error);
    }
};

/**
 * 生成唯一的埋点事件 ID
 * @param eventName 事件名称（用于区分事件类型）
 * @returns 唯一事件 ID（格式：${eventName}_${时间戳}_${固定长度随机串}）
 */
export const getEventId = (eventName: string): string => {
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
    } catch (err) {
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
const generateFixedLengthRandomStr = (length: number = 16): string => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        // 用 Math.floor 保证取整，避免越界
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
};