# 🔒 OnceLock 和 LazyLock 详解

## 📚 概述

`OnceLock` 和 `LazyLock` 是 Rust 1.70+ 标准库中的类型，用于**延迟初始化**。

## 🎯 OnceLock

### 定义

```rust
pub struct OnceLock<T> { /* ... */ }
```

**特点**：
- 只能初始化**一次**（Once）
- 初始化后值不可变
- **手动**提供初始化值
- 线程安全

### 基本用法

```rust
use std::sync::OnceLock;

static CONFIG: OnceLock<String> = OnceLock::new();

fn main() {
    // 第一次设置（成功）
    CONFIG.set("hello".to_string()).unwrap();
    
    // 第二次设置（失败）
    CONFIG.set("world".to_string()).unwrap_err();  // ❌ 已经设置过
    
    // 获取值
    let value = CONFIG.get().unwrap();  // "hello"
}
```

### get_or_init 方法

```rust
static CONFIG: OnceLock<String> = OnceLock::new();

fn get_config() -> &'static String {
    CONFIG.get_or_init(|| {
        // 只在第一次调用时执行
        "default config".to_string()
    })
}
```

## 🔄 LazyLock

### 定义

```rust
pub struct LazyLock<T> { /* ... */ }
```

**特点**：
- 只能初始化**一次**
- 初始化后值不可变
- **自动**在首次访问时初始化
- 线程安全
- 初始化逻辑在定义时提供

### 基本用法

```rust
use std::sync::LazyLock;

static CONFIG: LazyLock<String> = LazyLock::new(|| {
    // 在首次访问时自动执行
    "default config".to_string()
});

fn main() {
    // 首次访问，触发初始化
    let value = &*CONFIG;  // "default config"
    
    // 后续访问直接返回
    let value2 = &*CONFIG;  // 不会重新初始化
}
```

## 📊 OnceLock vs LazyLock 对比

| 特性 | OnceLock | LazyLock |
|------|----------|----------|
| **初始化时机** | 手动调用 `set()` 或 `get_or_init()` | 首次访问时自动 |
| **初始化方式** | 外部提供值 | 构造时提供闭包 |
| **是否需要闭包** | 可选（`get_or_init`） | 必需 |
| **使用场景** | 需要外部控制何时初始化 | 固定的初始化逻辑 |
| **API** | `set()`, `get()`, `get_or_init()` | 直接解引用 `*` |
| **Rust 版本** | 1.70+ | 1.80+ |

## 🎯 使用场景

### 场景 1：固定初始化逻辑 → LazyLock

```rust
use std::sync::LazyLock;

// 配置只在首次使用时加载
static CONFIG: LazyLock<Config> = LazyLock::new(|| {
    Config::load_from_file("config.toml")
});

// 数据库连接池
static DB_POOL: LazyLock<Pool> = LazyLock::new(|| {
    Pool::new("postgres://...")
});

fn main() {
    // 首次访问时自动初始化
    let config = &*CONFIG;
}
```

**适用**：
- ✅ 初始化逻辑固定
- ✅ 不需要外部参数
- ✅ 类似 `lazy_static!` 的场景

### 场景 2：动态初始化 → OnceLock

```rust
use std::sync::OnceLock;

// 需要从外部设置的值
static CONFIG: OnceLock<Config> = OnceLock::new();

fn main() {
    // 从命令行参数读取配置
    let args = std::env::args();
    let config = Config::from_args(args);
    
    // 手动设置
    CONFIG.set(config).unwrap();
}

fn use_config() {
    // 获取值
    let config = CONFIG.get().expect("配置未初始化");
}
```

**适用**：
- ✅ 需要外部参数
- ✅ 初始化时机不确定
- ✅ 可能初始化失败

## 🔄 lazy_static vs OnceLock vs LazyLock

### lazy_static（老方式，需要外部 crate）

```rust
use lazy_static::lazy_static;

lazy_static! {
    static ref CONFIG: String = "hello".to_string();
}

// 依赖
// Cargo.toml: lazy_static = "1.4.0"
```

### LazyLock（新方式，标准库，Rust 1.80+）

```rust
use std::sync::LazyLock;

static CONFIG: LazyLock<String> = LazyLock::new(|| {
    "hello".to_string()
});

// 无需额外依赖 ✅
```

### OnceLock（新方式，标准库，Rust 1.70+）

```rust
use std::sync::OnceLock;

static CONFIG: OnceLock<String> = OnceLock::new();

fn init() {
    CONFIG.set("hello".to_string()).unwrap();
}
```

## 💡 在我们项目中的应用

### 当前代码（已简化）

```rust
// ✅ 最简单：直接用 static
static IS_RECORDING: AtomicBool = AtomicBool::new(false);
```

**为什么不需要 OnceLock/LazyLock**：
- `AtomicBool::new()` 是 `const fn`
- 可以编译时初始化
- 不需要延迟初始化

### 如果要用 OnceLock（可选）

```rust
use std::sync::OnceLock;

static IS_RECORDING: OnceLock<AtomicBool> = OnceLock::new();

pub async fn start_audio_capture() -> Result<String, String> {
    // 获取或初始化
    let flag = IS_RECORDING.get_or_init(|| AtomicBool::new(false));
    
    match flag.compare_exchange(false, true, ...) {
        Ok(_) => { /* 启动 */ }
        Err(_) => { /* 已在运行 */ }
    }
}
```

**但这没必要**，因为：
- 多了一层包装
- 没有实际好处
- 代码更复杂

### 如果要用 LazyLock（不推荐）

```rust
use std::sync::LazyLock;

static IS_RECORDING: LazyLock<AtomicBool> = LazyLock::new(|| {
    AtomicBool::new(false)
});

// 问题：每次访问都需要解引用
(*IS_RECORDING).compare_exchange(...)  // ← 需要 *
```

**不推荐**，因为：
- 语法更啰嗦
- 没有必要

## 🎓 实际例子

### 例子 1：配置文件（LazyLock 适用）

```rust
use std::sync::LazyLock;
use serde::Deserialize;

#[derive(Deserialize)]
struct Config {
    api_key: String,
    timeout: u64,
}

// ✅ 首次访问时自动加载
static CONFIG: LazyLock<Config> = LazyLock::new(|| {
    let content = std::fs::read_to_string("config.toml").unwrap();
    toml::from_str(&content).unwrap()
});

fn main() {
    // 首次访问，自动加载文件
    println!("API Key: {}", CONFIG.api_key);
}
```

### 例子 2：应用设置（OnceLock 适用）

```rust
use std::sync::OnceLock;

static APP_NAME: OnceLock<String> = OnceLock::new();

fn main() {
    // 从命令行参数获取
    let name = std::env::args().nth(1).unwrap_or_else(|| "默认名称".to_string());
    
    // 设置一次
    APP_NAME.set(name).unwrap();
}

fn use_app_name() {
    let name = APP_NAME.get().expect("应用名称未设置");
    println!("应用名称: {}", name);
}
```

### 例子 3：简单标志（直接 static，我们的方式）

```rust
use std::sync::atomic::AtomicBool;

// ✅ 最简单，无需 OnceLock/LazyLock
static IS_READY: AtomicBool = AtomicBool::new(false);

fn main() {
    IS_READY.store(true, Ordering::SeqCst);
    
    if IS_READY.load(Ordering::SeqCst) {
        println!("就绪");
    }
}
```

## 📝 选择指南

```
需要延迟初始化？
│
├─ 是 → 值的类型支持 const 初始化？
│      │
│      ├─ 是（如 AtomicBool, AtomicU32 等）
│      │  └─> ✅ 直接用 static
│      │      static FLAG: AtomicBool = AtomicBool::new(false);
│      │
│      └─ 否 → 初始化逻辑固定？
│             │
│             ├─ 是 → ✅ 用 LazyLock
│             │   static CONFIG: LazyLock<T> = LazyLock::new(|| { ... });
│             │
│             └─ 否 → ✅ 用 OnceLock
│                 static CONFIG: OnceLock<T> = OnceLock::new();
│                 CONFIG.set(value);
│
└─ 否 → ✅ 直接用 static 或 const
```

## 🎯 总结

### OnceLock
- 📦 **手动初始化**一次
- 🔧 需要外部提供值
- 📍 `set()` / `get_or_init()`

### LazyLock  
- 🤖 **自动初始化**（首次访问）
- 🔧 构造时提供闭包
- 📍 直接解引用 `*`

### 直接 static（我们的方式）
- ⚡ **编译时初始化**
- 🎯 最简单、最快
- 📍 适用于 const fn

### lazy_static（旧方式）
- 📦 需要外部 crate
- 🔧 Rust 1.80 后不推荐
- 📍 被 `LazyLock` 替代

---

**对于我们的项目**：
```rust
// ✅ 最佳选择：直接 static
static IS_RECORDING: AtomicBool = AtomicBool::new(false);

// 不需要 OnceLock/LazyLock，因为 AtomicBool::new 是 const fn
```

