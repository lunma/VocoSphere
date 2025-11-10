# mpsc 通道实现原理

## 概述

`tokio::sync::mpsc` 是一个多生产者单消费者（Multi-Producer Single-Consumer）异步通道。本文档深入解析其内部设计，特别是 Sender 被 drop 后 Receiver 如何知道通道已关闭的机制。

## 核心设计：引用计数 + 共享状态

### 基本结构

```rust
// 简化的概念模型（非实际实现）
pub struct Sender<T> {
    chan: Arc<Channel<T>>,  // 共享的通道对象
}

pub struct Receiver<T> {
    chan: Arc<Channel<T>>,  // 同一个共享通道
}

struct Channel<T> {
    queue: Mutex<VecDeque<T>>,      // 消息队列
    sender_count: AtomicUsize,       // Sender 计数器 ← 关键
    waker: Mutex<Option<Waker>>,     // 唤醒 Receiver 的 Waker
    closed: AtomicBool,              // 通道是否已关闭
}
```

### 关键机制

1. **共享所有权**: Sender 和 Receiver 都持有 `Arc<Channel>`
2. **引用计数**: 通过 `sender_count` 原子计数器追踪活跃的 Sender 数量
3. **唤醒机制**: 使用 `Waker` 在状态变化时唤醒等待的 Receiver

## Sender 的生命周期管理

### 1. 创建通道时

```rust
pub fn channel<T>(buffer: usize) -> (Sender<T>, Receiver<T>) {
    let chan = Arc::new(Channel {
        queue: Mutex::new(VecDeque::with_capacity(buffer)),
        sender_count: AtomicUsize::new(1),  // 初始化为 1
        waker: Mutex::new(None),
        closed: AtomicBool::new(false),
    });
    
    let tx = Sender {
        chan: chan.clone(),  // Arc 引用计数 +1
    };
    
    let rx = Receiver {
        chan,  // Arc 引用计数 +1
    };
    
    (tx, rx)
}
```

**关键点**：
- `sender_count` 初始化为 1（表示有 1 个 Sender）
- `Arc::clone()` 只增加 Arc 的引用计数，不增加 `sender_count`

### 2. 克隆 Sender（多生产者）

```rust
impl<T> Clone for Sender<T> {
    fn clone(&self) -> Self {
        // 原子操作：sender_count += 1
        self.chan.sender_count.fetch_add(1, Ordering::Relaxed);
        
        Sender {
            chan: self.chan.clone(),  // Arc 引用计数 +1
        }
    }
}
```

**关键点**：
- 每 `clone()` 一次，`sender_count` 原子递增
- 支持多个 Sender 同时存在

### 3. Drop Sender ⭐ **核心机制**

```rust
impl<T> Drop for Sender<T> {
    fn drop(&mut self) {
        // 原子操作：sender_count -= 1，并返回旧值
        let prev_count = self.chan.sender_count.fetch_sub(1, Ordering::AcqRel);
        
        // 如果这是最后一个 Sender（从 1 变为 0）
        if prev_count == 1 {
            // 标记通道为已关闭
            self.chan.closed.store(true, Ordering::Release);
            
            // 唤醒正在等待的 Receiver
            if let Some(waker) = self.chan.waker.lock().unwrap().take() {
                waker.wake();  // ← 关键：通知 Receiver
            }
        }
    }
}
```

**关键点**：
1. 使用原子操作 `fetch_sub(1)` 递减计数器
2. 检查是否是最后一个 Sender（`prev_count == 1` 表示减去 1 后变为 0）
3. 如果是最后一个，设置 `closed = true`
4. **唤醒等待中的 Receiver**，让它立即检查状态

## Receiver 的接收机制

### recv() 的实现逻辑

```rust
impl<T> Receiver<T> {
    pub async fn recv(&mut self) -> Option<T> {
        // 创建 Future 来实现异步等待
        poll_fn(|cx| self.poll_recv(cx)).await
    }
    
    fn poll_recv(&mut self, cx: &mut Context<'_>) -> Poll<Option<T>> {
        // 1. 尝试从队列中取出消息
        if let Some(msg) = self.chan.queue.lock().unwrap().pop_front() {
            return Poll::Ready(Some(msg));  // 有消息，立即返回
        }
        
        // 2. 队列为空，检查通道是否已关闭
        if self.chan.closed.load(Ordering::Acquire) {
            return Poll::Ready(None);  // ← 返回 None，循环退出
        }
        
        // 3. 队列空但通道未关闭，注册 Waker 并等待
        *self.chan.waker.lock().unwrap() = Some(cx.waker().clone());
        Poll::Pending  // 挂起，等待被唤醒
    }
}
```

**流程图**：

```
recv() 被调用
    ↓
┌──────────────────────┐
│ 队列中有消息？        │ ──Yes──> 返回 Some(msg)
└──────────────────────┘
    │ No
    ↓
┌──────────────────────┐
│ closed == true?      │ ──Yes──> 返回 None (循环退出)
└──────────────────────┘
    │ No
    ↓
┌──────────────────────┐
│ 注册 Waker 并挂起     │ ──────> Poll::Pending
└──────────────────────┘
    │
    ↓
等待 Sender drop 时唤醒
```

## 完整的工作流程

### 场景：正常发送和接收

```rust
let (tx, mut rx) = mpsc::channel(10);

// Sender 发送消息
tx.send(data).await;  // 消息进入队列，唤醒 Receiver

// Receiver 接收消息
while let Some(msg) = rx.recv().await {
    // 处理消息
}
```

### 场景：Sender 被 drop

```rust
{
    let (tx, mut rx) = mpsc::channel(10);
    
    // 发送几条消息
    tx.send(1).await;
    tx.send(2).await;
    
    // tx 在这里 drop
} // ← drop(tx) 被自动调用

// Receiver 继续接收
while let Some(msg) = rx.recv().await {
    println!("{}", msg);  // 输出: 1, 2
}
// 队列清空后，recv() 返回 None，循环退出
```

**详细步骤**：

```
步骤 1: drop(tx) 被调用
  ├─> sender_count: 1 -> 0
  ├─> closed: false -> true
  └─> waker.wake() 唤醒 Receiver

步骤 2: Receiver 被唤醒，调用 poll_recv()
  ├─> 检查队列：有 2 条消息
  └─> 返回 Some(1)

步骤 3: 再次调用 recv()
  ├─> 检查队列：有 1 条消息
  └─> 返回 Some(2)

步骤 4: 再次调用 recv()
  ├─> 检查队列：空
  ├─> 检查 closed：true ← 关键
  └─> 返回 None ← while let 循环退出
```

## 原子操作的内存顺序

### 为什么使用 AcqRel 和 Acquire？

```rust
// Sender::drop
let prev_count = self.chan.sender_count.fetch_sub(1, Ordering::AcqRel);
self.chan.closed.store(true, Ordering::Release);

// Receiver::poll_recv
if self.chan.closed.load(Ordering::Acquire) {
    return Poll::Ready(None);
}
```

**内存顺序保证**：

1. **Release**（Sender drop 时）:
   - 保证之前的所有写操作对其他线程可见
   - 包括发送到队列的消息

2. **Acquire**（Receiver 检查时）:
   - 保证看到 Release 之前的所有写操作
   - 确保能看到队列中的所有消息

3. **AcqRel**（原子递减时）:
   - 既有 Acquire 又有 Release 语义
   - 保证多个 Sender 之间的同步

**为什么重要**：
```rust
// 线程 1 (Sender)
tx.send(msg).await;  // 写入队列
drop(tx);            // Release: 保证 send 对其他线程可见

// 线程 2 (Receiver)
while let Some(msg) = rx.recv().await {  // Acquire: 能看到所有消息
    // 保证能接收到 msg
}
```

## 多个 Sender 的场景

```rust
let (tx1, mut rx) = mpsc::channel(10);
let tx2 = tx1.clone();
let tx3 = tx1.clone();

// 此时 sender_count = 3

drop(tx1);  // sender_count: 3 -> 2, closed 仍为 false
drop(tx2);  // sender_count: 2 -> 1, closed 仍为 false
drop(tx3);  // sender_count: 1 -> 0, closed 变为 true, 唤醒 Receiver

// rx.recv().await 现在会返回 None
```

**状态变化**：

```
初始状态:
  sender_count = 3
  closed = false

drop(tx1):
  sender_count = 2  ← prev_count = 3, 不是最后一个
  closed = false    ← 不改变

drop(tx2):
  sender_count = 1  ← prev_count = 2, 不是最后一个
  closed = false    ← 不改变

drop(tx3):
  sender_count = 0  ← prev_count = 1, 是最后一个！
  closed = true     ← 设置为 true
  waker.wake()      ← 唤醒 Receiver
```

## 与 Java BlockingQueue 的对比

### Java BlockingQueue

```java
// Java 需要手动标记结束
BlockingQueue<String> queue = new LinkedBlockingQueue<>();

// 生产者
queue.put("msg");
// 如何通知消费者结束？需要特殊标记
queue.put("POISON_PILL");  // 毒丸模式

// 消费者
while (true) {
    String msg = queue.take();
    if (msg.equals("POISON_PILL")) break;  // 手动检查
    // 处理消息
}
```

### Rust mpsc

```rust
// Rust 通过所有权自动管理
let (tx, mut rx) = mpsc::channel(10);

// 生产者
tx.send("msg").await;
drop(tx);  // 自动通知结束，无需特殊标记

// 消费者
while let Some(msg) = rx.recv().await {
    // recv() 自动返回 None，无需手动检查
}
```

**优势对比**：

| 特性 | Java BlockingQueue | Rust mpsc |
|------|-------------------|-----------|
| 结束通知 | 手动（毒丸模式） | 自动（Drop trait） |
| 类型安全 | 需要特殊值 | 编译时保证 |
| 内存安全 | 运行时检查 | 编译时保证 |
| 引用计数 | 无（需手动管理） | 自动（Arc + AtomicUsize） |
| 唤醒机制 | Condition Variable | Waker（零成本抽象） |

## 实现要点总结

### 1. 引用计数管理

```rust
sender_count: AtomicUsize
  ├─> 创建时初始化为 1
  ├─> clone() 时递增
  ├─> drop() 时递减
  └─> 减到 0 时关闭通道
```

### 2. 状态同步

```rust
closed: AtomicBool
  ├─> Sender drop 时设置为 true (Release)
  └─> Receiver recv 时检查 (Acquire)
```

### 3. 异步唤醒

```rust
waker: Mutex<Option<Waker>>
  ├─> Receiver 等待时注册
  └─> Sender drop 时调用 wake()
```

### 4. 消息队列

```rust
queue: Mutex<VecDeque<T>>
  ├─> Sender send 时入队
  ├─> Receiver recv 时出队
  └─> 通道关闭后仍可清空剩余消息
```

## 关键设计模式

### RAII (Resource Acquisition Is Initialization)

```rust
impl<T> Drop for Sender<T> {
    fn drop(&mut self) {
        // 资源释放时自动执行清理逻辑
    }
}
```

### 零成本抽象

- 引用计数使用原子操作，无锁设计
- Waker 机制利用 async/await，无额外开销
- 编译时优化，运行时性能接近手写代码

### 类型状态模式

```rust
// Sender 和 Receiver 是不同类型
// 编译时保证 Sender 可以 clone，Receiver 不能
impl<T> Clone for Sender<T> { ... }
// impl<T> Clone for Receiver<T> { ... }  ← 不存在
```

## 源码位置

完整实现可以在 Tokio 源码中查看：
- [`tokio/src/sync/mpsc/mod.rs`](https://github.com/tokio-rs/tokio/blob/master/tokio/src/sync/mpsc/mod.rs)
- [`tokio/src/sync/mpsc/bounded.rs`](https://github.com/tokio-rs/tokio/blob/master/tokio/src/sync/mpsc/bounded.rs)

## 总结

`mpsc::channel` 通过以下机制实现 Sender drop 后 Receiver 自动退出：

1. ✅ **引用计数**: 使用 `AtomicUsize` 追踪 Sender 数量
2. ✅ **Drop trait**: 最后一个 Sender drop 时设置 `closed = true`
3. ✅ **Waker 唤醒**: 立即唤醒等待的 Receiver
4. ✅ **原子操作**: 使用 Acquire/Release 保证内存可见性
5. ✅ **零成本抽象**: 编译时优化，运行时无额外开销

这是 Rust 类型系统、所有权系统和异步机制的完美结合，展示了如何在保证安全的同时实现高性能的并发编程。

