# 图作AI · 电商详情图生成器

> 上传商品图，填写卖点，AI 自动生成一整套电商详情图（主图、卖点图、场景图、参数卡），打包 zip 直接下载。

由 [gpt-image-2](https://bananarouter.com/docs/gpt-image-2)（OpenAI 兼容接口）驱动。

---

## 功能一览

- **多图融合**：最多上传 5 张商品图，第一张为主图，其余作参考
- **6 类面板**：主图 / 3 张卖点图 / 场景图 / 参数卡，用户可自由勾选 1–6 张
- **平台预设**：内置淘宝 / 天猫 / 京东 / 亚马逊尺寸，一键切换
- **风格预设**：极简 / 活力鲜明 / 高端质感 / 温暖生活感
- **积分计费**：1 积分 = 1 张图；失败自动退款（按张结算）
- **异步生成**：BullMQ 队列 + 独立 worker，并发出图，每张失败自动重试 2 次
- **打包下载**：服务端流式 zip，按 panel 命名（hero.png / feature_1.png / …）
- **支付闭环**：充值 → 微信/支付宝扫码 → 回调发积分（当前接 Mock Provider，留好真实聚合支付的抽象层）

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16 (App Router) + TypeScript |
| 样式 | Tailwind CSS v4 + shadcn/ui（base-ui + lucide-react） |
| 认证 | NextAuth v5（邮箱密码 + Prisma 适配器 + JWT session） |
| 数据库 | PostgreSQL 16 + Prisma 6 |
| 队列 | BullMQ + Redis 7（图片生成异步任务） |
| 图像 | gpt-image-2 via [BananaRouter](https://bananarouter.com) |
| 对象存储 | 阿里云 OSS（浏览器直传 + 服务端签名读取） |
| 支付 | 抽象 `PaymentProvider` 接口 + MockProvider；上线接真实聚合支付/微信支付宝 |
| 部署 | Docker Compose + Nginx + Let's Encrypt（计划） |

---

## 项目结构

```
prisma/
  schema.prisma           # User / Order / CreditEntry / Job / Image 模型
src/
  app/
    (auth)/login,register # NextAuth 邮箱密码登录注册
    dashboard/            # 控制台：余额、最近任务、积分流水
    generate/             # 创建任务表单 + 任务详情/进度页
    pricing/              # 套餐选择 + 付款弹窗
    api/
      auth/...            # NextAuth 接口
      uploads/sign        # OSS 签名 PUT URL
      jobs/...            # 任务创建 / 启动 / 轮询 / 下载
      orders, payments    # 订单创建 + 支付 webhook
  components/
    ui/                   # shadcn 组件
    Nav, Footer, Logo, PanelIllustration
  lib/
    env.ts                # zod 校验的环境变量
    prisma.ts, oss.ts     # 客户端单例
    imageClient.ts        # gpt-image-2 封装（含 stub 模式）
    queue.ts, worker.ts   # BullMQ Queue + 独立 worker 进程
    promptTemplate.ts     # 输入 + panel → prompt
    payment/              # PaymentProvider 抽象 + MockProvider
    downloadHelpers.ts    # zip 打包 / Content-Disposition
docs/
  gpt-image-2.md          # 上游 API 完整规范
docker-compose.yml        # 本地 Postgres + Redis
```

---

## 本地开发

### 0. 前置依赖

- Node ≥ 20
- pnpm ≥ 10
- Docker（用来跑 Postgres + Redis）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 Postgres + Redis

```bash
docker compose up -d
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

填这些：

```bash
# 数据库 + Redis（默认值匹配 docker-compose.yml，不用改）
DATABASE_URL="postgresql://ecom:ecom@localhost:5432/ecom?schema=public"
REDIS_URL="redis://localhost:6379"

# NextAuth：用 openssl 生成
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"

# gpt-image-2（BananaRouter 后台取，必须用 OpenAI 兼容路径）
BANANAROUTER_API_KEY=""
BANANAROUTER_BASE_URL="https://api.bananarouter.com/v1"
BANANAROUTER_MODEL="gpt-image-2"

# 阿里云 OSS（强烈建议用 RAM 子账号，最小权限只给目标 bucket）
ALIYUN_OSS_REGION="oss-cn-hangzhou"
ALIYUN_OSS_BUCKET=""
ALIYUN_OSS_ACCESS_KEY_ID=""
ALIYUN_OSS_ACCESS_KEY_SECRET=""

# 本地开发可选：开启 stub 模式，不烧 API、不依赖 OSS（生成 256×256 色块 PNG）
STUB_IMAGE_MODEL="1"
```

### 4. 初始化数据库

```bash
pnpm db:migrate
```

### 5. 起服务（两个终端）

```bash
# 终端 1：Next.js
pnpm dev

# 终端 2：BullMQ Worker
pnpm worker
```

访问 <http://localhost:3000>。

### 6. OSS Bucket 跨域（CORS）配置

浏览器直传 OSS 需要在 bucket 控制台配置 CORS：

| 项 | 值 |
|---|---|
| 来源 | `http://localhost:3000`（开发）+ 生产域名 |
| 允许 Methods | `PUT, GET` |
| 允许 Headers | `Content-Type, Authorization, Content-Length` |
| 暴露 Headers | `ETag` |
| 缓存时间 | `600` |

否则上传商品图时会被浏览器跨域策略拦截。

---

## 常用命令

```bash
pnpm dev               # Next.js dev server
pnpm worker            # 启动队列 worker（开发，含 watch）
pnpm worker:start      # 启动队列 worker（一次性，生产用）
pnpm build             # 生产构建
pnpm start             # 启动生产 Next.js
pnpm db:migrate        # Prisma 迁移（含生成 Client）
pnpm db:generate       # 仅生成 Prisma Client
pnpm db:studio         # 打开 Prisma Studio 看数据
pnpm lint              # ESLint
```

---

## 计费与积分模型

- **1 积分 = 1 张图**
- **新用户注册自动赠送 10 积分**（够生成 1 整套 6 张图，或 10 张零散）
- **任务启动时预扣**积分；最终成功的张数即最终消耗，**未成功的自动退还**
- **回放安全**：所有金额/积分变动都是原子操作（`updateMany where status='PENDING'`），webhook / 队列回调重复触发不会重复发积分

### 套餐

| 套餐 | 价格 | 积分 | 单价 |
|---|---|---|---|
| 体验包 | ¥9.90 | 60 积分 | 0.17 元/积分 |
| 标准包（推荐）| ¥29.90 | 200 积分 | 0.15 元/积分 |
| 专业包 | ¥99.00 | 800 积分 | 0.12 元/积分 |

价格配置在 `src/lib/payment/packages.ts`，**绝不信任客户端传入的金额**。

---

## 支付集成

当前默认走 `MockProvider`，点击「我已付款（模拟）」会立刻通过 HMAC 签名的 token 模拟 webhook 回调。

接入真实聚合支付/微信/支付宝时，只需实现 `src/lib/payment/provider.ts` 里的 `PaymentProvider` 接口：

```ts
interface PaymentProvider {
  name: string;
  createOrder(input): Promise<CreateOrderResult>;   // 创建订单 + 返回 QR 字符串
  verifyNotify(req: Request): Promise<NotifyEvent | null>;  // 验签 webhook
}
```

写一个新文件 `realProvider.ts`，在 `mockProvider.ts` 的 `paymentProvider()` 工厂里按环境变量切换即可，主流程一行不用动。

---

## 安全注意

- **`.env*` 已 gitignore**。任何场景都不要把真实密钥发到聊天、Slack、截图里。
- **阿里云**必须用 RAM 子账号 + 最小权限策略（建议只读写指定 bucket），不要用主账号 AccessKey。
- **BananaRouter Key 一旦泄露立即去后台轮换**。
- 队列 worker 跑在独立进程，**禁止直接暴露到公网**（只连 Redis 和 OSS）。
- Web 入口走 HTTPS（生产部署阶段配 Let's Encrypt）。

---

## 路线图

| 阶段 | 范围 | 状态 |
|---|---|---|
| 0 | 项目骨架（Next.js + Prisma + Docker） | ✅ |
| 1 | 认证 + 控制台（NextAuth + 邮箱密码） | ✅ |
| 2 | 上传 + 任务表单（OSS 直传 + 客户端压缩） | ✅ |
| 3 | 生成核心（BullMQ + 积分原子扣退） | ✅ |
| 4 | 结果展示 + zip 下载 | ✅ |
| 5 | 支付（Mock + 抽象 Provider） | ✅ |
| 5.5 | 全面 UI 重做（shadcn/ui + 品牌色） | ✅ |
| 6 | VPS 部署（Docker + Nginx + HTTPS） | ⏳ |

---

## 鸣谢

- [BananaRouter](https://bananarouter.com) — gpt-image-2 接入
- [shadcn/ui](https://ui.shadcn.com) — 设计系统
- [Next.js](https://nextjs.org) / [Prisma](https://www.prisma.io) / [BullMQ](https://docs.bullmq.io)
