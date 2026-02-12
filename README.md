# react-track-hooks

[![npm version](https://img.shields.io/npm/v/react-track-hooks.svg)](https://www.npmjs.com/package/react-track-hooks)
[![license](https://img.shields.io/npm/l/react-track-hooks.svg)](https://github.com/PassingTraveller111/react-track-hooks/blob/main/LICENSE)

一个轻量、易用的 React 埋点 Hooks 库，支持点击埋点、曝光埋点、页面停留时长埋点、自定义埋点，内置失败重试机制，适配 React/Next.js 项目。

## 特性
- 🚀 开箱即用：提供常用埋点场景的 Hooks，无需重复封装
- 🔄 失败重试：内置 localStorage 缓存 + 指数退避重试，确保埋点不丢失
- 🎯 精准控制：曝光埋点支持可见比例、单次触发配置
- ⚡ 轻量无依赖：体积小，不引入额外冗余依赖
- 📝 完整 TypeScript 类型：提供完善的类型声明，开发更友好
- 🌐 框架适配：兼容 React 16+、Next.js（App Router/Pages Router）

## 安装
```bash
# npm
npm install react-track-hooks --save

# yarn
yarn add react-track-hooks

# pnpm
pnpm add react-track-hooks
```


## 快速开始

### 1. 全局配置（项目入口）
在 React/Next.js 项目的入口文件（如 `App.tsx`/`layout.tsx`）中配置全局参数：

#### React 项目
```tsx
import { setTrackGlobalConfig, useTrackRetryListener } from 'react-track-hooks';

function App() {
    // 全局埋点配置（只执行一次）
    setTrackGlobalConfig({
        trackUrl: 'https://api.yourdomain.com/track', // 替换为你的埋点接口地址
        enable: process.env.NODE_ENV === 'production', // 生产环境开启
        retryConfig: {
            maxRetryTimes: 5, // 最大重试次数
            initialDelay: 1000, // 初始重试延迟（ms）
            delayMultiplier: 2, // 延迟倍数（指数退避）
        },
    });

    // 启用失败埋点自动重试监听（全局只执行一次）
    useTrackRetryListener();

    return <>{/* 你的应用内容 */}</>;
}
```

#### Next.js App Router
```tsx
// app/components/TrackProvider.tsx (客户端组件)
'use client';
import { setTrackGlobalConfig, useTrackRetryListener } from 'react-track-hooks';

export const TrackProvider = () => {
    setTrackGlobalConfig({
        trackUrl: 'https://api.yourdomain.com/track',
        enable: process.env.NODE_ENV === 'production',
    });

    useTrackRetryListener();
    return null;
};

// app/layout.tsx (根布局)
import { TrackProvider } from './components/TrackProvider';

export default function RootLayout({ children }) {
    return (
        <html>
        <body>
        <TrackProvider />
        {children}
        </body>
        </html>
    );
}
```

### 2. 业务组件中使用埋点 Hooks

#### 点击埋点
```tsx
import { useTrackClick } from 'react-track-hooks';

function ButtonComponent() {
    // 初始化点击埋点
    const handleClick = useTrackClick(
        'button_click', // 埋点事件名
        { button_type: 'primary', page: 'home' }, // 基础参数
        { enable: true } // 单个埋点开关（可选）
    );

    return (
        // 点击时可追加动态参数
        <button onClick={(e) => handleClick(e, { click_pos: 'top' })}>
            测试点击埋点
        </button>
    );
}
```

#### 曝光埋点
```tsx
import { useTrackExposure } from 'react-track-hooks';

function CardComponent() {
    // 初始化曝光埋点（返回 ref 绑定到目标元素）
    const exposureRef = useTrackExposure(
        'card_exposure', // 埋点事件名
        { card_id: '123456', card_type: 'product' }, // 基础参数
        {
            exposureThreshold: 0.8, // 元素可见比例≥80%时触发
            exposureOnce: true, // 仅触发一次曝光
        }
    );

    return (
        <div ref={exposureRef} style={{ width: '300px', height: '200px' }}>
            这是一个曝光埋点卡片
        </div>
    );
}
```

#### 页面停留时长埋点
```tsx
import { useTrackPageStay } from 'react-track-hooks';

function HomePage() {
    // 初始化页面停留埋点（组件挂载时自动监听）
    useTrackPageStay(
        'page_stay', // 埋点事件名
        { page_path: '/home', platform: 'web' } // 基础参数
    );

    return <div>首页内容</div>;
}
```

#### 自定义埋点
```tsx
import { useTrackCustom } from 'react-track-hooks';

function FormComponent() {
    // 初始化自定义埋点
    const triggerCustomTrack = useTrackCustom(
        'form_submit', // 埋点事件名
        { form_id: 'login_form' } // 基础参数
    );

    const handleSubmit = () => {
        // 手动触发自定义埋点，可追加动态参数
        triggerCustomTrack({ submit_time: Date.now(), status: 'success' });
    };

    return <button onClick={handleSubmit}>提交表单</button>;
}
```

### 3. 手动重试失败埋点
```tsx
import { retryFailedTracks } from 'react-track-hooks';

function RetryButton() {
    const handleRetry = async () => {
        // 手动触发失败埋点重试（force: true 强制立即重试）
        const success = await retryFailedTracks(true);
        if (success) {
            alert('失败埋点重试完成！');
        }
    };

    return <button onClick={handleRetry}>重试失败埋点</button>;
}
```

## API 文档

### 全局配置
#### setTrackGlobalConfig(config: TrackGlobalConfig)
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| trackUrl | string | 是 | - | 埋点上报接口地址 |
| enable | boolean | 否 | true | 是否开启埋点 |
| retryConfig | RetryConfig | 否 | 见下方 | 重试配置 |

#### RetryConfig 类型
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxRetryTimes | number | 3 | 最大重试次数 |
| initialDelay | number | 1000 | 初始重试延迟（ms） |
| delayMultiplier | number | 2 | 延迟倍数（指数退避） |

### Hooks
#### useTrackRetryListener()
- 作用：全局监听页面状态（初始化/切回标签页），自动重试失败埋点
- 注意：全局只需调用一次，建议放在项目入口

#### useTrackClick(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackItemConfig | 否 | 单个埋点配置 |
| 返回值 | (e?, extraParams?) => void | - | 点击事件处理函数，可追加动态参数 |

#### useTrackExposure(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackExposureConfig | 否 | 曝光配置 |
| 返回值 | React.RefObject<HTMLElement> | - | 需绑定到目标元素的 ref |

#### TrackExposureConfig 类型
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| exposureThreshold | number | 0.5 | 触发曝光的可见比例（0-1） |
| exposureOnce | boolean | true | 是否仅触发一次曝光 |

#### useTrackPageStay(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackItemConfig | 否 | 单个埋点配置 |

#### useTrackCustom(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackItemConfig | 否 | 单个埋点配置 |
| 返回值 | (extraParams?) => Promise<void> | - | 手动触发埋点的函数 |

### 工具函数
#### retryFailedTracks(force?: boolean): Promise<boolean>
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| force | boolean | false | 是否强制立即重试（忽略退避时间） |
| 返回值 | Promise<boolean> | - | 重试是否成功 |

### 通用类型
#### TrackParams
```ts
interface TrackParams {
    [key: string]: any; // 自定义业务参数
}
```

#### TrackItemConfig
```ts
interface TrackItemConfig {
    enable?: boolean; // 单个埋点开关，覆盖全局配置
}
```

## 适配说明
- React 版本：支持 React 16.8+（Hooks 最低兼容版本）
- Next.js 版本：支持 Next.js 13+（App Router/Pages Router）
- 浏览器兼容：支持所有现代浏览器，IE 需自行兼容 Promise/IntersectionObserver

## 常见问题
### Q1: TS7016 类型声明找不到？
A: 确保安装的是最新版本，若仍报错，可在项目中添加类型声明文件：
```ts
// types/react-track-hooks.d.ts
declare module 'react-track-hooks';
```

### Q2: 曝光埋点不触发？
A: 检查：
1. 元素是否绑定 ref；
2. 可见比例是否达到 `exposureThreshold`；
3. 元素是否为固定定位/脱离文档流（需确保 IntersectionObserver 能检测到）。

### Q3: 埋点上报失败不重试？
A: 确保已调用 `useTrackRetryListener()`，且重试次数未超过 `maxRetryTimes`。

## 许可证
MIT © [liujingmin](https://github.com/PassingTraveller111)
