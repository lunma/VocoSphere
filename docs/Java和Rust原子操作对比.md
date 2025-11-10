# ☕ Java AtomicBoolean vs 🦀 Rust AtomicBool

## 🎯 核心问题：为什么需要 compareAndSet/compare_exchange？

**答案完全相同**：防止"检查-设置"之间的竞态条件。

## 📊 Java 实现

### ❌ 错误方式：分开的 get 和 set

```java
import java.util.concurrent.atomic.AtomicBoolean;

public class AudioCapture {
    // 全局标志
    private static final AtomicBoolean isRecording = new AtomicBoolean(false);
    
    // ❌ 错误实现
    public void startCapture() {
        // 检查
        if (isRecording.get()) {  // ← 操作 1
            throw new IllegalStateException("已在运行");
        }
        
        // ⚠️ 竞态条件！另一个线程可能在这里插入
        
        // 设置
        isRecording.set(true);    // ← 操作 2
        
        // 启动任务
        new Thread(this::captureAudio).start();
    }
}
```

**问题**：
```
线程 A: get() → false ✅
线程 B: get() → false ✅  (在 A set 之前)
线程 A: set(true) → 启动任务 A
线程 B: set(true) → 启动任务 B
结果：两个任务同时运行！❌
```

### ✅ 正确方式：使用 compareAndSet

```java
import java.util.concurrent.atomic.AtomicBoolean;

public class AudioCapture {
    private static final AtomicBoolean isRecording = new AtomicBoolean(false);
    
    // ✅ 正确实现
    public void startCapture() {
        // 原子化的"检查并设置"
        boolean success = isRecording.compareAndSet(
            false,  // 期望值
            true    // 新值
        );
        
        if (success) {
            // 成功：获得了运行权
            new Thread(this::captureAudio).start();
        } else {
            // 失败：已在运行
            throw new IllegalStateException("已在运行");
        }
    }
    
    public void stopCapture() {
        // 设置为 false 并返回旧值
        boolean wasRecording = isRecording.getAndSet(false);
        
        if (wasRecording) {
            System.out.println("已停止");
        } else {
            throw new IllegalStateException("未在运行");
        }
    }
    
    private void captureAudio() {
        while (isRecording.get()) {
            // 录音循环
        }
    }
}
```

## 🦀 Rust 实现（对应版本）

```rust
use std::sync::atomic::{AtomicBool, Ordering};

// 全局标志
static IS_RECORDING: AtomicBool = AtomicBool::new(false);

// ✅ 正确实现
#[tauri::command]
pub async fn start_audio_capture() -> Result<String, String> {
    // 原子化的"检查并设置"
    match IS_RECORDING.compare_exchange(
        false,              // 期望值
        true,               // 新值
        Ordering::SeqCst,
        Ordering::SeqCst
    ) {
        Ok(_) => {
            // 成功：获得了运行权
            tokio::spawn(async move {
                run_audio_capture().await;
            });
            Ok("已启动".to_string())
        }
        Err(_) => {
            // 失败：已在运行
            Err("已在运行".to_string())
        }
    }
}

#[tauri::command]
pub fn stop_audio_capture() -> Result<String, String> {
    // 设置为 false 并返回旧值
    let was_recording = IS_RECORDING.swap(false, Ordering::SeqCst);
    
    if was_recording {
        Ok("已停止".to_string())
    } else {
        Err("未在运行".to_string())
    }
}

async fn run_audio_capture() -> anyhow::Result<()> {
    while IS_RECORDING.load(Ordering::Relaxed) {
        // 录音循环
    }
    Ok(())
}
```

## 📊 API 对照表

| 操作 | Java AtomicBoolean | Rust AtomicBool | 说明 |
|------|-------------------|-----------------|------|
| **创建** | `new AtomicBoolean(false)` | `AtomicBool::new(false)` | 初始化 |
| **读取** | `get()` | `load(Ordering::...)` | 获取当前值 |
| **设置** | `set(value)` | `store(value, Ordering::...)` | 设置新值 |
| **检查并设置** | `compareAndSet(expect, new)` | `compare_exchange(expect, new, ...)` | 原子化 ✨ |
| **设置并返回旧值** | `getAndSet(new)` | `swap(new, Ordering::...)` | 原子化 ✨ |
| **获取并递增** | `getAndIncrement()` | - | AtomicBool 无此方法 |

## 🔑 关键相似点

### 1. 都需要 compareAndSet/compare_exchange

**Java**：
```java
if (!isRecording.compareAndSet(false, true)) {
    throw new Exception("已在运行");
}
```

**Rust**：
```rust
if IS_RECORDING.compare_exchange(false, true, ...).is_err() {
    return Err("已在运行");
}
```

### 2. 都可以用 getAndSet/swap

**Java**：
```java
boolean wasRunning = isRecording.getAndSet(false);
```

**Rust**：
```rust
let was_running = IS_RECORDING.swap(false, Ordering::SeqCst);
```

### 3. 循环检查可以用 get/load

**Java**：
```java
while (isRecording.get()) {
    // 循环
}
```

**Rust**：
```rust
while IS_RECORDING.load(Ordering::Relaxed) {
    // 循环
}
```

## 🎓 为什么需要 compareAndSet？

### 场景：防止重复启动（两种语言相同）

```
时刻    线程 A                线程 B               标志值
────────────────────────────────────────────────────────

T1     get() → false       -                    false
T2     -                   get() → false        false
T3     set(true)           -                    true
T4     启动任务 A          -                    true
T5     -                   set(true)            true
T6     -                   启动任务 B           true

结果：❌ 两个任务同时运行！
```

```
使用 compareAndSet/compare_exchange：

T1     compareAndSet       -                    false
       (false, true)
       → 成功 ✅           -                    true
T2     启动任务 A          -                    true
T3     -                   compareAndSet        true
                           (false, true)
                           → 失败 ❌            true
T4     -                   返回错误             true

结果：✅ 只有一个任务运行！
```

## 📝 最佳实践对比

### Java 最佳实践

```java
public class Service {
    private static final AtomicBoolean running = new AtomicBoolean(false);
    
    public void start() {
        if (running.compareAndSet(false, true)) {
            new Thread(this::doWork).start();
        } else {
            throw new IllegalStateException("已在运行");
        }
    }
    
    public void stop() {
        if (running.getAndSet(false)) {
            // 之前在运行，已停止
        } else {
            // 之前未运行
        }
    }
    
    private void doWork() {
        while (running.get()) {
            // 工作循环
        }
    }
}
```

### Rust 最佳实践（我们的代码）

```rust
static IS_RECORDING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn start_audio_capture() -> Result<String, String> {
    match IS_RECORDING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst) {
        Ok(_) => {
            tokio::spawn(async { run_audio_capture().await; });
            Ok("已启动".to_string())
        }
        Err(_) => Err("已在运行".to_string())
    }
}

#[tauri::command]
pub fn stop_audio_capture() -> Result<String, String> {
    if IS_RECORDING.swap(false, Ordering::SeqCst) {
        Ok("已停止".to_string())
    } else {
        Err("未在运行".to_string())
    }
}

async fn run_audio_capture() -> anyhow::Result<()> {
    while IS_RECORDING.load(Ordering::Relaxed) {
        // 工作循环
    }
    Ok(())
}
```

## 🔍 主要差异

| 特性 | Java | Rust |
|------|------|------|
| **返回类型** | `boolean` | `Result<(), bool>` |
| **内存顺序** | 隐式（自动） | 显式（必须指定） |
| **语法** | `compareAndSet(a, b)` | `compare_exchange(a, b, ord1, ord2)` |
| **成功判断** | `if (success)` | `match Ok(_) / Err(_)` |

## 🎯 答案总结

### 是的！Java 也需要 compareAndSet

**原因完全相同**：

1. **防止竞态条件**
   - ❌ `get()` + `set()` 不是原子操作
   - ✅ `compareAndSet()` 是原子操作

2. **防止重复启动**
   - 多个线程可能同时调用 `start()`
   - 只有一个能成功

3. **单个操作是安全的，复合操作不安全**
   - `get()` 是线程安全的 ✅
   - `set()` 是线程安全的 ✅
   - `get() + set()` 不是线程安全的 ❌
   - `compareAndSet()` 是线程安全的 ✅

### 跨语言通用规则

```
任何需要"检查并设置"的场景，都必须用原子操作：

Java:  compareAndSet()
Rust:  compare_exchange()
C++:   compare_exchange()
Go:    CompareAndSwap()
C#:    CompareExchange()

原理完全相同！
```

---

**核心答案**：是的，Java 的 `AtomicBoolean` 也需要用 `compareAndSet`，原因和 Rust 中的 `compare_exchange` 完全一样——防止"检查-设置"之间的竞态条件！

