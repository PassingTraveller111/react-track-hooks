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