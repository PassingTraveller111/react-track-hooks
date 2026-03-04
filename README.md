```markdown
# react-track-hooks

[![npm version](https://img.shields.io/npm/v/react-track-hooks.svg)](https://www.npmjs.com/package/react-track-hooks)
[![license](https://img.shields.io/npm/l/react-track-hooks.svg)](https://github.com/PassingTraveller111/react-track-hooks/blob/main/LICENSE)

一个轻量、易用的 React 埋点 Hooks 库，支持点击埋点、曝光埋点、页面停留时长埋点、组件首次渲染埋点、自定义埋点，内置**智能批量上报**和**增强型失败重试**机制，适配 React/Next.js 项目。

## 特性
- 🚀 开箱即用：提供常用埋点场景的 Hooks，无需重复封装
- 📦 智能批量上报：支持埋点批量入队、定时/定量触发上报，减少网络请求
- 🔄 增强型失败重试：内置 localStorage 缓存 + 指数退避算法，批量/单条自适应重试，确保埋点不丢失
- 🎯 精准控制：曝光埋点支持可见比例、单次触发配置
- ⏱ 精准页面停留时长：自动监听用户活跃、无操作超时、页面显隐，统计真实有效停留时长
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
       trackUrl: '/api/track',
       batchTrackUrl: '/api/track/batch',
       enable: true,
       enableBatch: true,
       retryConfig: {
          maxRetryTimes: 3,
          initialDelay: 1000,
          delayMultiplier: 2
       },
       batchConfig: {
          batchSize: 10,
          batchInterval: 5000,
       },
       exposureConfig: {
          exposureOnce: true,
          exposureThreshold: 0.5,
       },
       pageStayConfig: {
          timeout: 30 * 1000, // 用户不活跃时间
          minDuration: 2 * 1000, // 最短有效时间
          maxDuration: 2 * 60 * 1000, // 最长活跃时间
          checkInterval: 1000, // 检查用户是否活跃计时器
          reportOnHidden: true, // 页面隐藏就触发上报
       }
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
      trackUrl: '/api/track',
      batchTrackUrl: '/api/track/batch',
      enable: true,
      enableBatch: true,
      retryConfig: {
         maxRetryTimes: 3,
         initialDelay: 1000,
         delayMultiplier: 2
      },
      batchConfig: {
         batchSize: 5, // 队列满5条触发批量上报
         batchInterval: 5000, // 3秒触发一次批量上报
      },
      pageStayConfig: {
         timeout: 30 * 1000, // 用户不活跃时间
         minDuration: 2 * 1000, // 最短有效时间
         maxDuration: 2 * 60 * 1000, // 最长活跃时间
         checkInterval: 1000, // 检查用户是否活跃计时器
      }
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
        { 
            enable: true,
            enableBatch: false // 单个埋点关闭批量上报（覆盖全局配置）
        }
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
    const exposureRef = useTrackExposure<HTMLDivElement>(
        'card_exposure', // 埋点事件名
        { card_id: '123456', card_type: 'product' }, // 基础参数
        {
            exposureThreshold: 0.8, // 元素可见比例≥80%时触发
            exposureOnce: true, // 仅触发一次曝光
            enableBatch: true // 启用批量上报
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
        { page_path: '/home', platform: 'web' }, // 基础参数
        { enableBatch: true } // 启用批量上报
    );

    return <div>首页内容</div>;
}
```

#### 组件首次渲染埋点
```tsx
import { useTrackFirstRender } from '@/track/hooks/useTrackFirstRender';

const MyComponent = () => {
   // 组件首次渲染时触发埋点
   useTrackFirstRender(
           'my_component_first_render', // 事件名
           { componentName: 'MyComponent' }, // 自定义参数
           { enableBatch: false } // 配置（比如关闭批量，立即上报）
   );

   return <div>我的组件</div>;
};
```

#### 自定义埋点
```tsx
import { useTrackCustom } from 'react-track-hooks';

function FormComponent() {
    // 初始化自定义埋点
    const triggerCustomTrack = useTrackCustom(
        'form_submit', // 埋点事件名
        { form_id: 'login_form' }, // 基础参数
        { enableBatch: true } // 启用批量上报
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
        // 手动触发失败埋点重试（force: true 强制立即重试，忽略指数退避时间）
        await retryFailedTracks(true);
        alert('失败埋点重试流程已执行！');
    };

    return <button onClick={handleRetry}>重试失败埋点</button>;
}
```

## API 文档

### 全局配置
#### setTrackGlobalConfig(config: TrackGlobalConfig)
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| trackUrl | string | 是 | - | 单条埋点上报接口地址 |
| batchTrackUrl | string | 否 | /api/track/batch | 批量埋点上报接口地址 |
| enable | boolean | 否 | true | 是否开启埋点 |
| enableBatch | boolean | 否 | true | 是否开启批量上报 |
| retryConfig | RetryConfig | 否 | 见下方 | 重试配置 |
| batchConfig | BatchConfig | 否 | 见下方 | 批量上报配置 |
| exposureConfig | ExposureConfig | 否 | 见下方 | 曝光配置 |
| pageStayConfig | PageStayConfig | 否 | 见下方 | 页面停留时长配置 |

#### RetryConfig 类型
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxRetryTimes | number | 3 | 最大重试次数（超过则清理埋点） |
| initialDelay | number | 1000 | 初始重试延迟（ms） |
| delayMultiplier | number | 2 | 延迟倍数（指数退避算法） |

#### BatchConfig 类型
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| batchSize | number | 10 | 触发批量上报的队列容量上限 |
| batchInterval | number | 5000 | 触发批量上报的时间间隔（ms） |

#### ExposureConfig 类型
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| exposureOnce | boolean | true | 曝光埋点是否只触发一次 |
| exposureThreshold | number | 0.5 | 元素可见比例（0~1）达到多少触发曝光 |

#### PageStayConfig 类型
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| timeout | number | 1800000 | 无操作超时时间（ms），超时后暂停计时 |
| minDuration | number | 2000 | 最小有效时长（ms），低于该值不上报 |
| maxDuration | number | 3600000 | 最大单页时长（ms），防止异常超长数据 |
| checkInterval | number | 1000 | 定时检查用户活跃状态的间隔（ms） |

### Hooks
#### useTrackRetryListener()
- 作用：全局监听页面状态（初始化/切回标签页/浏览器空闲），自动触发失败埋点重试
- 特性：内置防并发机制，避免重复执行重试流程
- 注意：全局只需调用一次，建议放在项目入口

#### useTrackClick(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackConfig | 否 | 单个埋点配置（可覆盖全局批量/重试配置） |
| 返回值 | (e?, extraParams?) => void | - | 点击事件处理函数，可追加动态参数 |

#### useTrackExposure<T extends HTMLElement>(eventName, baseParams?, config?)
通用曝光埋点 Hook，返回泛型 ref，可绑定到任意 DOM 元素，元素进入视口时触发埋点上报。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数，会和曝光自动采集参数合并上报 |
| config | TrackConfig | 否 | 曝光配置 + 批量/重试配置 |
| 泛型 T | T extends HTMLElement | 否 | 可选，指定 ref 绑定的 DOM 元素类型（默认 `HTMLElement`） |
| 返回值 | React.RefObject<T> | - | 需绑定到目标元素的 ref，类型与泛型 T 一致 |

#### useTrackPageStay(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackConfig | 否 | 单个埋点配置（可覆盖全局批量/重试配置） |

- 自动监听：页面显隐、用户操作（鼠标/键盘/滚动/触摸）、无操作超时、组件卸载、页面关闭
- 只统计**真实有效活跃时长**，超时、切后台时不计入
- 页面关闭/刷新时使用 `keepalive: true` 保证上报不丢失
- 上报自动携带字段：`stayTime: 有效时长(ms)`

#### useTrackFirstRender(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数（如组件名称、页面标识等固定参数） |
| config | TrackConfig | 否 | 单个埋点配置（可覆盖全局批量/重试/上报地址等配置） |
| 返回值 | void | - | 无返回值，Hook 内部自动触发埋点，无需手动调用 |

#### useTrackCustom(eventName, baseParams?, config?)
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventName | string | 是 | 埋点事件名 |
| baseParams | TrackParams | 否 | 基础业务参数 |
| config | TrackConfig | 否 | 单个埋点配置（可覆盖全局批量/重试配置） |
| 返回值 | (extraParams?) => void | - | 手动触发埋点的函数 |

### 工具函数
#### retryFailedTracks(force?: boolean): Promise<void>
增强型失败埋点重试函数，支持批量/单条自适应重试，内置指数退避算法和防并发机制。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| force | boolean | false | 是否强制立即重试（忽略指数退避时间） |
| 返回值 | Promise<void> | - | 重试流程完成的 Promise |

### 通用类型
#### TrackParams
```ts
interface TrackParams {
    eventName: string;
    type: 'click' | 'exposure' | 'page_stay' | 'custom';
    [key: string]: any; // 自定义业务参数
}
```

#### TrackConfig
```ts
interface TrackConfig extends Partial<TrackGlobalConfig> {
    exposureOnce?: boolean; // 曝光埋点仅生效一次（默认 true）
    exposureThreshold?: number; // 曝光埋点触发阈值（0-1，默认 0.5）
}
```

#### TrackGlobalConfig（完整类型定义）
```ts
export interface TrackGlobalConfig {
    // 埋点上报接口 URL
    trackUrl: string;
    // 批量上报接口 URL
    batchTrackUrl?: string;
    // 是否开启埋点
    enable?: boolean;
    // 是否开启批量上报
    enableBatch?: boolean
    // 重试配置
    retryConfig?: {
        maxRetryTimes: number;
        initialDelay: number;
        delayMultiplier: number;
    };
    // 批量上报配置
    batchConfig?: {
        batchSize: number, // 队列容量上限
        batchInterval: number, // 触发上报间隔
    };
   exposureConfig?: {
      exposureOnce?: boolean; // 暴露是否只触发一次
      exposureThreshold: number; // 元素暴露多少部分（0-1）触发
   }
   pageStayConfig?: {
      timeout: number;        // 无操作超时时间，超时暂停计时，并进行上报
      minDuration: number;    // 最小有效时长，低于该值不上报
      maxDuration: number;    // 最大单页时长，防止异常数据
      checkInterval: number;  // 活跃检查间隔
   };
}
```

## 核心能力说明
### 批量上报机制
1. **入队规则**：开启批量上报后，埋点参数先进入内存队列，而非直接发送请求
2. **触发条件**：满足以下任一条件即触发批量上报：
   - 队列长度达到 `batchSize`（默认 10）
   - 距离上次上报超过 `batchInterval`（默认 5000ms）
3. **异常处理**：批量上报失败时，所有埋点会自动转入失败队列，参与重试逻辑
4. **优先级**：单个埋点配置的 `enableBatch` 优先级高于全局配置

### 增强型失败重试机制
#### 核心流程
1. **失败存储**：上报失败的埋点会存入 localStorage，避免页面刷新丢失
2. **前置清理**：重试前自动清理超过 `maxRetryTimes` 的过期埋点，避免内存膨胀
3. **智能筛选**：基于**指数退避算法**筛选可重试埋点：
   ```
   重试延迟时间 = initialDelay * (delayMultiplier ^ 当前重试次数)
   ```
   例如：初始延迟 1s，倍数 2 → 第1次重试延迟 1s，第2次 2s，第3次 4s...
4. **自适应重试**：
   - 开启批量时：调用 `batchTrackUrl` 一次性重试所有符合条件的埋点
   - 关闭批量时：逐条调用 `trackUrl` 重试，失败单条不影响其他
5. **状态更新**：
   - 重试成功：从失败队列移除对应埋点
   - 重试失败：自动更新 `retryCount` 和 `retryTime`，等待下次重试
6. **重试时机**：
   - 首屏渲染 3 秒后自动重试
   - 页面从不可见变为可见时重试
   - 浏览器空闲时周期性重试（最迟 30 秒一次）
   - 埋点上报成功后自动触发重试
   - 可通过 `retryFailedTracks` 手动触发

#### 防并发保护
- 内置 `isRetryRunning` 状态标记，避免同时执行多个重试流程
- 所有异常被统一捕获，确保 `isRetryRunning` 能正常重置

### 页面停留时长逻辑
1. **活跃检测**：监听鼠标、键盘、滚动、点击、touch 事件，实时标记用户活跃
2. **有效时长规则**：
   - 低于 `minDuration` 不上报
   - 高于 `maxDuration` 按上限截断
   - 只累计用户真正活跃的时间段
3. **三种触发上报时机**：
   - **无操作超时**：超过 `timeout` 无操作 → 暂停计时并进行上报（走默认上报逻辑，根据你的配置，如果配置了批量上报，那么将走批量上报的逻辑）
   - **组件卸载**： 组件卸载 → 暂停计时并进行上报（走默认上报逻辑）
   - **页面可见性**：页面隐藏/关闭 → 绕过默认上报逻辑，直接单独进行上报
4. **触发保障**：
   - **用兼容性更强visibilitychange替代beforeunload**: visibilitychange的兼容性更强，beforeunload在safari浏览器不兼容
   - **用keepalive：true替代sendBeacon**: 保证页面关闭的情况下也能触发失败缓存的回调

## 适配说明
- React 版本：支持 React 16.8+（Hooks 最低兼容版本）
- Next.js 版本：支持 Next.js 13+（App Router/Pages Router）
- 浏览器兼容：支持所有现代浏览器，IE 需自行兼容 Promise/IntersectionObserver/requestIdleCallback

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
3. 元素是否为固定定位/脱离文档流（需确保 IntersectionObserver 能检测到）；
4. 全局/单个埋点的 `enable` 是否为 `true`。

### Q3: 批量上报不生效？
A: 检查：
1. 全局/单个埋点的 `enableBatch` 是否为 `true`；
2. `batchTrackUrl` 是否配置正确；
3. 队列长度是否未达到 `batchSize` 且未到 `batchInterval` 时间。

### Q4: 埋点上报失败不重试？
A: 确保：
1. 已调用 `useTrackRetryListener()`；
2. 重试次数未超过 `maxRetryTimes`；
3. localStorage 未被禁用（失败埋点依赖 localStorage 存储）；
4. 重试时间未到（可通过 `retryFailedTracks(true)` 强制重试验证）。

### Q5: 批量重试后部分埋点仍显示失败？
A: 批量重试为原子操作：
- 接口返回 2xx → 所有埋点视为成功，从失败队列移除
- 接口返回非 2xx/网络错误 → 所有埋点视为失败，更新重试次数

### Q6: 页面停留时长不准？
A: 本 Hook 统计的是**有效活跃时长**：
- 用户无操作超时 → 暂停计时
- 页面切后台 → 进行上报
- 重新操作 → 恢复计时
  并非从打开到关闭的自然时间。

### Q7: 页面关闭/刷新时停留时长会丢失吗？
A: 不会。当触发页面隐藏（hidden）时，Hook 会自动执行 stopTracking 计算最后一段有效时长，并立即调用 triggerSingleTrack。通过 fetch 的 keepalive: true 属性，浏览器会将该请求标记为“后台独立任务”，确保即便页面文档对象（Document）被销毁，请求依然能在后台成功发出。

### Q8: 如何控制多久无操作算“离开”？
A: 配置 `pageStayConfig.timeout`，默认 30 分钟。

## 许可证
MIT © [liujingmin](https://github.com/PassingTraveller111)
```