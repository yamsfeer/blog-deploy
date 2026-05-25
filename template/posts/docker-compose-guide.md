---
title: Docker Compose 实战指南
date: 2026-05-20
status: published
tags: [docker, devops, infrastructure]
excerpt: 深入理解 Docker Compose 的核心概念与生产环境最佳实践。
---

## 为什么需要 Docker Compose

在现代微服务架构中，一个应用通常由多个服务组成。Docker Compose 允许你通过一个 YAML 文件定义和管理多容器应用。

## 核心概念

### Services

每个 service 对应一个容器，共享同一个网络：

```yaml
version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:3000"
  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
```

### Networks

Compose 默认创建一个网络，所有服务自动加入。你也可以显式定义网络拓扑。

### Volumes

数据持久化是生产环境的关键。合理使用 named volumes 和 bind mounts 可以保证数据安全。

## 生产环境最佳实践

1. **永远不要在生产中使用 `latest` 标签** — 锁定具体版本号
2. **使用 `.env` 文件管理敏感配置** — 不要硬编码密码
3. **配置健康检查** — 确保服务启动顺序正确
4. **限制资源使用** — 防止单容器耗尽宿主机资源

## 总结

Docker Compose 是本地开发和多容器编排的利器，理解其核心概念能够显著提升开发效率。
