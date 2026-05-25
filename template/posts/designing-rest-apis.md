---
title: RESTful API 设计原则
date: 2026-05-10
status: published
tags: [api, rest, web, design]
excerpt: 好的 API 设计是开发者体验的核心，本文梳理 RESTful 设计的关键准则。
---

## 资源导向

REST 的核心思想是把一切视为资源。一个好的 URL 设计应该像这样：

```
GET    /articles          # 列表
GET    /articles/42       # 详情
POST   /articles          # 创建
PUT    /articles/42       # 完整更新
PATCH  /articles/42       # 部分更新
DELETE /articles/42       # 删除
```

## 状态码的正确使用

不要总是返回 200。每个响应都应该有准确的语义：

- `201 Created` — 资源创建成功
- `204 No Content` — 删除成功，无需返回体
- `400 Bad Request` — 客户端数据校验失败
- `409 Conflict` — 资源冲突（如重复创建）

## 分页与过滤

对于列表接口，必须提供分页支持：

```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "total_pages": 5,
    "per_page": 20
  }
}
```

## 版本管理

API 版本推荐通过 URL 前缀管理：`/v1/articles`、`/v2/articles`。避免使用自定义 Header 传递版本号，这会增加调试成本。

## 总结

好的 API 设计遵循一致性原则。当你的 API 行为可预测时，开发者的心智负担会大幅降低。
