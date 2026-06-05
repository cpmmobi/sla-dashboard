# SLA Dashboard

SportLiveAPI 后台原型，基于 `Next.js + Prisma + Vercel Postgres`，支持管理员客户管理、客户侧报表查看，以及阿里云 Live OpenAPI 实时数据接入。

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 配置数据库连接

- 生产环境：在 Vercel 项目里直接连接 `Vercel Postgres`
- 本地环境：把 Vercel Postgres 提供的 `POSTGRES_PRISMA_URL` 和 `POSTGRES_URL_NON_POOLING` 填到 `.env`

4. 初始化数据库

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

5. 启动开发环境

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 导入该仓库
3. 在 Vercel 项目里连接 `Vercel Postgres`
4. 在项目环境变量里补充阿里云 Live 的几个配置项
5. 首次上线前，使用生产库连接执行一次：

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

说明：

- 项目会自动兼容 Vercel 注入的 `POSTGRES_PRISMA_URL` 和 `POSTGRES_URL_NON_POOLING`
- 代码运行在 `Vercel`，不需要单独购买传统服务器
- 现有本地 `SQLite` 数据不会自动迁移到 `Vercel Postgres`，如需迁移要单独导出/导入

## 阿里云 Live 接入

在 `.env` 或 Vercel 项目环境变量中填写以下配置：

```bash
ALIYUN_LIVE_ACCESS_KEY_ID="你的 RAM AccessKey ID"
ALIYUN_LIVE_ACCESS_KEY_SECRET="你的 RAM AccessKey Secret"
ALIYUN_LIVE_SECURITY_TOKEN=""
ALIYUN_LIVE_REGION_ID="cn-shanghai"
```

说明：

- 建议使用 RAM 子账号，只授予直播数据查询权限
- 当前报表页优先调用阿里云 Live OpenAPI，失败或未配置时自动回退到本地 mock 数据
- 已接入的查询能力：
  - `DescribeDomainUsageData`：下行流量、下行带宽
  - `DescribeLiveDomainPvUvData`：PV / UV

## 常用命令

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:push
npm run db:seed
```
