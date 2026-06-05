# SLA Dashboard

SportLiveAPI 后台原型，基于 `Next.js + Prisma + SQLite`，支持管理员客户管理、客户侧报表查看，以及阿里云 Live OpenAPI 实时数据接入。

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 初始化本地数据库

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. 启动开发环境

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 阿里云 Live 接入

在 `.env` 中填写以下配置：

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
