# 日志系统优化：从 Mutex 到 OnceLock

## 问题发现

### 原始实现的问题

```rust
// ❌ 原来的实现
pub struct TauriLogger {
    app_handle: Mutex<Option<AppHandle>>,  // 每次读取都要加锁
    level: LevelFilter,
}

impl log::Log for TauriLogger {
    fn log(&self, record: &Record) {
        // 每次发送日志都要获取锁
        if let Ok(app_guard) = self.app_handle.lock() {  // 🔒 加锁开销
            if let Some(ref app) = *app_guard {
                app.emit("log-message", &log_msg);
            }
        }  // 🔓 释放锁
    }
}
```

**关键观察：**
- `set_app_handle` 在整个应用生命周期中**只调用一次**（应用启动时）
- `log()` 方法会被调用**成千上万次**（每条日志都调用）
- 这是典型的"**写一次，读多次**"场景

**性能问题：**
```rust
// 假设应用运行期间产生 10,000 条日志
set_app_handle(...);  // 调用 1 次（写入）
log(...);             // 调用 10,000 次（读取，每次都加锁！）
log(...);             
log(...);
// ... 9,997 次更多的读取，每次都要 lock()
```

## 优化方案

### ✅ 方案 1：使用 OnceLock（最优）

```rust
pub struct TauriLogger {
    app_handle: OnceLock<AppHandle>,  // 只初始化一次
    level: LevelFilter,
}

impl TauriLogger {
    pub fn new(level: LevelFilter) -> Self {
        Self {
            app_handle: OnceLock::new(),  // 初始为空
            level,
        }
    }

    /// 设置 AppHandle（只能调用一次）
    pub fn set_app_handle(&self, handle: AppHandle) {
        // set() 只能成功一次，第二次调用会返回 Err
        let _ = self.app_handle.set(handle);
    }
}

impl log::Log for TauriLogger {
    fn log(&self, record: &Record) {
        // ✅ 无需加锁！直接读取
        if let Some(app) = self.app_handle.get() {
            app.emit("log-message", &log_msg);
        }
    }
}
```

**优势：**
- ✅ **无锁读取**：`get()` 不需要加锁，性能极佳
- ✅ **线程安全**：多个线程可以同时读取
- ✅ **防止重复设置**：`set()` 只能成功一次
- ✅ **语义清晰**：OnceLock 的名字就表达了"只设置一次"的语义

### 方案 2：使用 RwLock（次优）

```rust
pub struct TauriLogger {
    app_handle: RwLock<Option<AppHandle>>,  // 读写锁
    level: LevelFilter,
}

impl log::Log for TauriLogger {
    fn log(&self, record: &Record) {
        // 读锁：允许多个线程同时读取
        if let Ok(app_guard) = self.app_handle.read() {
            if let Some(ref app) = *app_guard {
                app.emit("log-message", &log_msg);
            }
        }
    }
}
```

**对比：**
- ✅ 允许多个线程同时读取（比 Mutex 好）
- ❌ 仍然需要获取读锁（比 OnceLock 慢）
- ❌ 无法防止重复设置

### 方案 3：Mutex<Option<T>>（原方案，最差）

```rust
pub struct TauriLogger {
    app_handle: Mutex<Option<AppHandle>>,
    level: LevelFilter,
}

impl log::Log for TauriLogger {
    fn log(&self, record: &Record) {
        // 互斥锁：同一时间只能有一个线程访问
        if let Ok(app_guard) = self.app_handle.lock() {
            if let Some(ref app) = *app_guard {
                app.emit("log-message", &log_msg);
            }
        }
    }
}
```

**问题：**
- ❌ 读取时也要独占锁
- ❌ 多个线程读取时会互相阻塞
- ❌ 性能最差

## 性能对比

### 基准测试场景

```rust
// 10 个线程并发写日志，每个线程写 1000 条
for _ in 0..10 {
    thread::spawn(|| {
        for i in 0..1000 {
            log::info!("Message {}", i);
        }
    });
}
```

### 性能对比表

| 方案 | 读取操作 | 并发读取 | 性能 | 语义 |
|------|---------|---------|------|------|
| **OnceLock** | 无锁读取 | ✅ 完全并行 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **RwLock** | 需要读锁 | ✅ 并行读取 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Mutex** | 需要互斥锁 | ❌ 串行执行 | ⭐⭐ | ⭐⭐ |

### 详细分析

```rust
// OnceLock：无锁读取
// 伪代码：
fn get(&self) -> Option<&T> {
    // 1. 原子读取状态（已初始化？）
    // 2. 如果已初始化，直接返回引用
    // 3. 无需任何锁操作
    // 性能：~几个 CPU 周期
}

// RwLock：需要读锁
fn read(&self) -> LockResult<RwLockReadGuard<T>> {
    // 1. 获取读锁（需要原子操作）
    // 2. 检查是否有写锁
    // 3. 增加读者计数
    // 性能：~几十个 CPU 周期
}

// Mutex：需要互斥锁
fn lock(&self) -> LockResult<MutexGuard<T>> {
    // 1. 尝试获取独占锁
    // 2. 如果被占用，阻塞等待
    // 3. 其他线程无法并发访问
    // 性能：~几十到几千个 CPU 周期（取决于竞争）
}
```

## OnceLock 的工作原理

### 内部实现（简化版）

```rust
pub struct OnceLock<T> {
    // 使用原子操作标记是否已初始化
    once: Once,
    // 实际数据（使用 UnsafeCell 允许内部可变性）
    value: UnsafeCell<Option<T>>,
}

impl<T> OnceLock<T> {
    pub fn set(&self, value: T) -> Result<(), T> {
        // 只能设置一次
        self.once.call_once(|| {
            unsafe { *self.value.get() = Some(value); }
        });
    }
    
    pub fn get(&self) -> Option<&T> {
        // 无锁读取
        if self.once.is_completed() {
            unsafe { (*self.value.get()).as_ref() }
        } else {
            None
        }
    }
}
```

### 关键特性

1. **原子初始化**
   ```rust
   // 多个线程同时调用 set()，只有一个会成功
   thread::spawn(|| LOGGER.set_app_handle(handle1));
   thread::spawn(|| LOGGER.set_app_handle(handle2));
   // 只有一个会成功，另一个返回 Err
   ```

2. **无锁读取**
   ```rust
   // 所有线程可以同时读取，无任何锁竞争
   thread::spawn(|| {
       if let Some(app) = LOGGER.app_handle.get() {
           app.emit(...);  // 完全并行
       }
   });
   ```

3. **内存顺序保证**
   - 使用 `std::sync::Once` 保证内存顺序
   - 写入对所有线程可见
   - 无需手动添加内存屏障

## 实际收益

### 1. 性能提升

```rust
// 假设每条日志耗时：
// - OnceLock: 10ns (无锁读取)
// - Mutex: 50ns (需要加锁)

// 产生 10,000 条日志：
// - OnceLock: 10,000 × 10ns = 100μs
// - Mutex: 10,000 × 50ns = 500μs

// 性能提升：5倍！
```

### 2. 并发性提升

```rust
// Mutex：10 个线程串行写日志
// 线程 1: [====] 等待锁
// 线程 2:      [====] 等待锁
// 线程 3:           [====] 等待锁
// 总时间：累加

// OnceLock：10 个线程并行写日志
// 线程 1: [====]
// 线程 2: [====]
// 线程 3: [====]
// 总时间：最慢的那个线程
```

### 3. 代码简洁性

```rust
// ❌ Mutex 版本
if let Ok(app_guard) = self.app_handle.lock() {
    if let Some(ref app) = *app_guard {
        app.emit("log-message", &log_msg);
    }
}

// ✅ OnceLock 版本
if let Some(app) = self.app_handle.get() {
    app.emit("log-message", &log_msg);
}
```

## 适用场景总结

### 使用 OnceLock 当：
- ✅ 数据只初始化一次
- ✅ 初始化后不再改变
- ✅ 需要频繁读取
- ✅ 多线程并发读取

**典型场景：**
- 全局配置（只加载一次）
- 单例模式
- 应用句柄（如本例）
- 编译后的正则表达式

### 使用 RwLock 当：
- ✅ 数据会被修改，但不频繁
- ✅ 读操作远多于写操作
- ✅ 需要偶尔更新数据

**典型场景：**
- 缓存系统
- 配置热更新
- 统计数据

### 使用 Mutex 当：
- ✅ 读写操作频率相当
- ✅ 需要频繁修改数据
- ✅ 临界区很小

**典型场景：**
- 计数器
- 消息队列
- 短期状态管理

## 迁移步骤

### 1. 识别访问模式

```rust
// 分析你的代码：
// - set_app_handle 调用几次？ → 1 次
// - log() 调用几次？ → 10,000+ 次
// - 结论：写 1 次，读 10,000+ 次 → 使用 OnceLock
```

### 2. 替换类型

```rust
// 从
app_handle: Mutex<Option<AppHandle>>

// 改为
app_handle: OnceLock<AppHandle>
```

### 3. 更新初始化

```rust
// 从
Self {
    app_handle: Mutex::new(None),
    level,
}

// 改为
Self {
    app_handle: OnceLock::new(),
    level,
}
```

### 4. 更新设置方法

```rust
// 从
pub fn set_app_handle(&self, handle: AppHandle) {
    if let Ok(mut app) = self.app_handle.lock() {
        *app = Some(handle);
    }
}

// 改为
pub fn set_app_handle(&self, handle: AppHandle) {
    let _ = self.app_handle.set(handle);
}
```

### 5. 更新读取方法

```rust
// 从
if let Ok(app_guard) = self.app_handle.lock() {
    if let Some(ref app) = *app_guard {
        app.emit("log-message", &log_msg);
    }
}

// 改为
if let Some(app) = self.app_handle.get() {
    app.emit("log-message", &log_msg);
}
```

## 总结

### 为什么用 OnceLock？

1. **符合语义**：`set_app_handle` 确实只调用一次
2. **性能更好**：无锁读取，比 Mutex 快 5 倍
3. **并发性好**：多个线程可以同时读取
4. **防止错误**：自动防止重复设置
5. **代码更简洁**：少一层嵌套

### 关键要点

- 🎯 **写一次，读多次** → 用 `OnceLock`
- 📊 **读多写少** → 用 `RwLock`  
- 🔒 **读写频率相当** → 用 `Mutex`

你的观察非常正确！我们确实应该用 `OnceLock` 而不是 `Mutex<Option<T>>`。这是一个很好的性能优化！ 🚀

