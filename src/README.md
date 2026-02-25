```plaintext
src/
├── track/                  # 埋点相关核心模块（独立目录）
│   ├── config.ts           # 全局配置相关（默认配置、修改配置方法）
│   ├── hooks/              # 核心Hook拆分（按功能拆分文件）
│   │   ├── index.ts        # Hook聚合导出
│   │   ├── useTrack.ts     # 基础埋点Hook
│   │   ├── useTrackClick.ts # 点击埋点Hook
│   │   ├── useTrackExposure.ts # 曝光埋点Hook
│   │   ├── useTrackPageStay.ts # 页面停留Hook
│   │   ├── useFirstRender.ts # 组件首次渲染Hook
│   │   └── useTrackCustom.ts # 自定义埋点Hook
│   ├── core/               # 核心逻辑（非Hook的底层逻辑）
│   │   ├── index.ts        # 核心逻辑聚合导出
│   │   ├── sendTrack.ts    # 单条上报核心逻辑
│   │   ├── batchTrack.ts   # 批量上报核心逻辑
│   │   └── retryTrack.ts   # 失败重试核心逻辑
│   └── listeners/          # 监听相关（如重试监听、页面可见性监听）
│       └── useTrackRetryListener.ts # 重试监听Hook
├── index.ts            # 对外暴露的统一入口（聚合导出）
├── types.ts            # 所有埋点相关类型定义（统一管理）
└── utils.ts                  # 全局工具函数

```