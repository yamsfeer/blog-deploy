---
title: Rust 异步编程内部机制
date: 2026-05-15
status: published
tags: [rust, async, systems]
excerpt: 从 Future trait 到 Pin，深入剖析 Rust 异步运行时的核心设计。
---

## Future 与状态机

Rust 的 `async fn` 在编译时被转换为一个状态机。每个 `.await` 点对应状态机中的一个状态：

```rust
async fn fetch_data(url: &str) -> Result<String, Error> {
    let resp = reqwest::get(url).await?;
    resp.text().await
}
```

编译器会为这个函数生成类似这样的结构体：

```rust
enum FetchDataFuture {
    Start { url: &str },
    AwaitingResponse { ... },
    AwaitingBody { ... },
    Done,
}
```

## Pin 与自引用

由于 Future 状态机可能包含自引用结构，Rust 引入了 `Pin` 类型来保证内存在固定地址上。理解 `Pin` 是掌握 Rust 异步编程的关键。

## Waker 机制

当一个 Future 被 poll 并返回 `Poll::Pending` 时，运行时会注册一个 Waker。当就绪事件发生时，Waker 被调用，通知运行时重新 poll 该 Future。

## 运行时对比

| 运行时 | 特点 |
|--------|------|
| tokio | 多线程 work-stealing，生态最丰富 |
| async-std | 类标准库 API 设计 |
| smol | 轻量级，可组合 |

## 总结

Rust 的异步模型以零成本抽象为核心，Future、Pin、Waker 三者共同构成了高效的异步运行时基础。
