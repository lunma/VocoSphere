# LazyLock 和 OnceLock 对比详解

## 概述

`LazyLock` 和 `OnceLock` 都是 Rust 标准库提供的延迟初始化工具，但它们的使用场景和特点不同。

## 核心区别

| 特性 | LazyLock | OnceLock |
|------|----------|----------|
| 初始化方式 | **自动**：首次访问时自动执行 | **手动**：需要显式调用方法初始化 |
| 初始化函数 | 在声明时提供 | 在运行时提供 |
| 访问返回值 | 直接返回 `&T` | 返回 `Option<&T>` |
| 适用场景 | 初始化逻辑在编译时确定 | 初始化逻辑需要运行时参数 |
| 线程安全 | ✅ | ✅ |
| 性能开销 | 首次访问时有初始化开销 | 首次初始化时有开销 |

## 详细对比

### 1. LazyLock - 自动延迟初始化

```rust
use std::sync::LazyLock;

// 在声明时提供初始化函数
static LOGGER: LazyLock<MyLogger> = LazyLock::new(|| {
    MyLogger::new()  // 初始化逻辑在编译时确定
});

fn use_logger() {
    // 直接使用，首次访问时自动初始化
    LOGGER.log("Hello");  // 自动解引用
    
    // 或者显式解引用
    (&*LOGGER).log("World");
}
```

**优点：**
- ✅ 使用简单，无需手动初始化
- ✅ 可以直接解引用，不需要处理 `Option`
- ✅ 适合"声明即定义"的场景

**缺点：**
- ❌ 初始化逻辑必须在编译时确定
- ❌ 无法传递运行时参数

### 2. OnceLock - 手动延迟初始化

```rust
use std::sync::OnceLock;

// 声明时不提供初始化函数
static CONFIG: OnceLock<Config> = OnceLock::new();

fn init_config(path: &str) {
    // 运行时手动初始化，可以使用运行时参数
    CONFIG.get_or_init(|| {
        Config::load(path)  // 可以使用运行时参数 path
    });
}

fn use_config() {
    // 访问时返回 Option
    if let Some(config) = CONFIG.get() {
        println!("{}", config.value);
    }
    
    // 或者使用 get_or_init
    let config = CONFIG.get_or_init(|| Config::default());
}
```

**优点：**
- ✅ 可以在运行时提供初始化参数
- ✅ 更灵活的初始化时机控制
- ✅ 可以使用 `set()` 直接设置值

**缺点：**
- ❌ 访问时返回 `Option`，需要处理
- ❌ 需要手动调用初始化

## 在日志系统中的应用

### 为什么选择 LazyLock？

在我们的日志系统中，有以下需求：

```rust
// 需要传递给 log::set_logger，它要求 &'static dyn Log
log::set_logger(&*LOGGER).is_ok()
```

#### 使用 LazyLock（推荐）✅

```rust
static LOGGER: LazyLock<TauriLogger> = LazyLock::new(|| {
    TauriLogger::new(LevelFilter::Debug)
});

pub fn init_logger(app_handle: AppHandle) {
    LOGGER.set_app_handle(app_handle);
    log::set_logger(&*LOGGER).ok();  // 直接解引用
}
```

#### 如果使用 OnceLock（不推荐）❌

```rust
static LOGGER: OnceLock<TauriLogger> = OnceLock::new();

pub fn init_logger(app_handle: AppHandle) {
    // 必须先初始化
    let logger = LOGGER.get_or_init(|| {
        TauriLogger::new(LevelFilter::Debug)
    });
    
    // 需要处理 Option
    logger.set_app_handle(app_handle);
    
    // get() 返回 Option，需要解包
    if let Some(logger) = LOGGER.get() {
        log::set_logger(logger).ok();
    }
}
```

**问题：**
1. 代码更冗长
2. 需要额外的 Option 处理
3. 没有实际好处（我们的初始化逻辑在编译时就确定了）

## 实际使用场景对比

### LazyLock 适用场景

```rust
// 1. 全局配置（编译时确定）
static DEFAULT_CONFIG: LazyLock<Config> = LazyLock::new(|| {
    Config {
        max_connections: 100,
        timeout: Duration::from_secs(30),
    }
});

// 2. 单例模式
static INSTANCE: LazyLock<MyService> = LazyLock::new(|| {
    MyService::new()
});

// 3. 正则表达式缓存
static EMAIL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap()
});
```

### OnceLock 适用场景

```rust
// 1. 需要运行时参数的配置
static CONFIG: OnceLock<AppConfig> = OnceLock::new();

fn main() {
    let args = parse_args();
    CONFIG.set(AppConfig::from_args(args)).ok();
}

// 2. 动态加载的资源
static PLUGIN: OnceLock<Plugin> = OnceLock::new();

fn load_plugin(path: &Path) {
    PLUGIN.get_or_init(|| Plugin::load(path));
}

// 3. 需要在特定时机初始化
static DATABASE: OnceLock<Database> = OnceLock::new();

async fn connect_db(connection_string: &str) {
    DATABASE.get_or_init(|| {
        Database::connect(connection_string).await
    });
}
```

## 历史演变

### 1. once_cell crate（外部库）

```rust
// 曾经需要使用外部 crate
use once_cell::sync::Lazy;

static VALUE: Lazy<String> = Lazy::new(|| "hello".to_string());
```

### 2. std::sync::LazyLock（Rust 1.80+）✅

```rust
// 现在已经在标准库中稳定
use std::sync::LazyLock;

static VALUE: LazyLock<String> = LazyLock::new(|| "hello".to_string());
```

### 3. std::sync::OnceLock（Rust 1.70+）

```rust
// 更早稳定的版本
use std::sync::OnceLock;

static VALUE: OnceLock<String> = OnceLock::new();
```

## 性能对比

### LazyLock

```rust
// 首次访问
static DATA: LazyLock<Vec<u8>> = LazyLock::new(|| vec![0; 1000]);

fn access() {
    // 第一次访问：执行初始化 + 返回引用
    let data = &*DATA;  // ~初始化时间
    
    // 后续访问：直接返回引用
    let data = &*DATA;  // ~0 开销
}
```

### OnceLock

```rust
static DATA: OnceLock<Vec<u8>> = OnceLock::new();

fn access() {
    // 第一次访问：需要初始化
    let data = DATA.get_or_init(|| vec![0; 1000]);  // ~初始化时间
    
    // 后续访问：直接返回 Option
    let data = DATA.get().unwrap();  // ~0 开销
}
```

**结论：** 性能基本相同，主要区别在于使用方式。

## 最佳实践建议

### 选择 LazyLock 如果：
- ✅ 初始化逻辑在编译时就能确定
- ✅ 不需要运行时参数
- ✅ 想要简洁的代码
- ✅ 需要实现 trait（如 `log::Log`）

### 选择 OnceLock 如果：
- ✅ 需要运行时参数进行初始化
- ✅ 初始化时机需要精确控制
- ✅ 可能需要延迟很久才初始化
- ✅ 需要在多个地方尝试初始化（使用 `set()`）

## 总结

在我们的日志系统中：
- **之前使用** `once_cell::sync::Lazy`（外部依赖）
- **现在使用** `std::sync::LazyLock`（标准库，Rust 1.80+）
- **不适合用** `OnceLock`，因为：
  1. 初始化逻辑在编译时就确定了
  2. 不需要运行时参数
  3. 需要直接解引用传给 `log::set_logger`
  4. 使用 `OnceLock` 会增加代码复杂度而没有实际好处

这就是为什么选择 `LazyLock` 而不是 `OnceLock` 的原因！ 🎯

