# 🔧 anyhow 错误处理详解

## 🎯 anyhow 是什么？

**anyhow** 是 Rust 中一个流行的错误处理库，简化了错误处理代码。

## 📦 基本概念

### anyhow::Error

**统一的错误类型**，可以包装任何实现了 `std::error::Error` 的类型。

```rust
use anyhow::{Result, Error};

// 函数返回 anyhow::Result
fn process() -> Result<String> {
    // 可以返回任何错误类型
    let file = std::fs::read_to_string("file.txt")?;  // io::Error
    let num: i32 = file.parse()?;                     // ParseIntError
    Ok(format!("结果: {}", num))
}
```

## 🔑 anyhow! 宏的作用

### 1. 创建带消息的错误

```rust
use anyhow::anyhow;

// ❌ 标准库方式（复杂）
return Err(std::io::Error::new(
    std::io::ErrorKind::Other,
    "不支持的格式"
));

// ✅ anyhow 方式（简单）
return Err(anyhow!("不支持的格式"));
```

### 2. 格式化错误消息

```rust
// 支持类似 format! 的语法
let format_type = "MP3";
return Err(anyhow!("不支持的格式：{}", format_type));

// 更复杂的格式化
let rate = 48000;
let expected = 16000;
return Err(anyhow!(
    "采样率不匹配：期望 {}Hz，实际 {}Hz",
    expected, rate
));
```

### 3. 添加上下文信息

```rust
use anyhow::Context;

// 添加上下文
let file = std::fs::read_to_string("config.toml")
    .context("无法读取配置文件")?;

// 添加格式化上下文
let num: i32 = file.parse()
    .context(format!("无法解析为数字: {}", file))?;
```

## 💡 在我们项目中的使用

### 示例 1：创建自定义错误

```rust
// audio_capture.rs 中
match default_input_config.sample_format() {
    cpal::SampleFormat::F32 => { /* ... */ }
    cpal::SampleFormat::I16 => { /* ... */ }
    cpal::SampleFormat::U16 => { /* ... */ }
    _ => return Err(anyhow!("不支持的采样格式：{:?}", sample_format)),
    //              ^^^^^^^ 
    //              创建一个包含详细信息的错误
}
```

**效果**：
- 如果遇到不支持的格式（如 I8），会返回：
- `Error: 不支持的采样格式：I8`

### 示例 2：函数返回类型

```rust
use anyhow::Result;

// ❌ 标准库方式
async fn run_audio_capture() -> std::result::Result<(), Box<dyn std::error::Error>> {
    // ...
}

// ✅ anyhow 方式
async fn run_audio_capture() -> anyhow::Result<()> {
    // 可以返回任何错误类型
    let device = audio::find_loopback_device()?;     // 任意错误
    std::fs::create_dir_all(output_dir)?;            // io::Error
    let writer = create_wav_writer(path, spec)?;     // hound::Error
    Ok(())
}
```

### 示例 3：添加上下文

```rust
use anyhow::Context;

// 创建重采样器
let resampler = SincFixedIn::<f32>::new(
    resample_ratio,
    1.2,
    parameters,
    frame_size,
    channels,
)
.context("无法创建重采样器")?;
//^^^^^^^ 如果失败，错误消息会是：
// "无法创建重采样器: 原始错误消息"
```

## 📊 anyhow vs 标准库 Result

### 标准库 Result

```rust
// 需要具体的错误类型
fn read_file() -> Result<String, std::io::Error> {
    std::fs::read_to_string("file.txt")
}

fn parse_number(s: &str) -> Result<i32, std::num::ParseIntError> {
    s.parse()
}

// ❌ 问题：无法在一个函数中同时返回这两种错误
fn process() -> Result<i32, ???> {  // 用什么错误类型？
    let content = read_file()?;     // io::Error
    let num = parse_number(&content)?;  // ParseIntError
    Ok(num)
}
```

### anyhow Result

```rust
use anyhow::Result;

// ✅ 统一的错误类型
fn read_file() -> Result<String> {
    Ok(std::fs::read_to_string("file.txt")?)
}

fn parse_number(s: &str) -> Result<i32> {
    Ok(s.parse()?)
}

// ✅ 可以返回任何错误
fn process() -> Result<i32> {
    let content = read_file()?;      // 自动转换
    let num = parse_number(&content)?;  // 自动转换
    Ok(num)
}
```

## 🔧 常用 API

### 1. `anyhow!` 宏

```rust
// 创建错误
Err(anyhow!("简单错误"))
Err(anyhow!("格式化错误: {}", value))
```

### 2. `Context` trait

```rust
use anyhow::Context;

// 添加上下文
some_operation()
    .context("操作失败")?;

// 添加格式化上下文
some_operation()
    .with_context(|| format!("处理 {} 时失败", filename))?;
```

### 3. `Result<T>` 类型别名

```rust
use anyhow::Result;

// 等价于 Result<T, anyhow::Error>
fn my_function() -> Result<String> {
    Ok("success".to_string())
}
```

### 4. `bail!` 宏（提前返回错误）

```rust
use anyhow::bail;

fn check_value(x: i32) -> Result<()> {
    if x < 0 {
        bail!("值不能为负数：{}", x);
        // 等价于：
        // return Err(anyhow!("值不能为负数：{}", x));
    }
    Ok(())
}
```

### 5. `ensure!` 宏（断言）

```rust
use anyhow::ensure;

fn validate(x: i32) -> Result<()> {
    ensure!(x > 0, "值必须大于0，实际值: {}", x);
    // 等价于：
    // if !(x > 0) {
    //     return Err(anyhow!("值必须大于0，实际值: {}", x));
    // }
    Ok(())
}
```

## 📝 实际例子

### 例子 1：文件操作

```rust
use anyhow::{Result, Context};

fn load_config() -> Result<Config> {
    // 读取文件
    let content = std::fs::read_to_string("config.toml")
        .context("无法读取配置文件 config.toml")?;
    
    // 解析 TOML
    let config: Config = toml::from_str(&content)
        .context("配置文件格式错误")?;
    
    Ok(config)
}

// 错误输出示例：
// Error: 无法读取配置文件 config.toml
// 
// Caused by:
//     No such file or directory (os error 2)
```

### 例子 2：多步骤操作

```rust
use anyhow::{Result, anyhow, bail};

fn process_audio(path: &str) -> Result<Vec<f32>> {
    // 检查文件是否存在
    if !std::path::Path::new(path).exists() {
        bail!("文件不存在: {}", path);
    }
    
    // 读取文件
    let data = std::fs::read(path)
        .context("读取音频文件失败")?;
    
    // 检查文件大小
    if data.len() < 100 {
        return Err(anyhow!("文件太小: {} 字节", data.len()));
    }
    
    // 解码音频
    let samples = decode_audio(&data)
        .context("解码音频失败")?;
    
    Ok(samples)
}
```

### 例子 3：我们项目中的实际使用

```rust
// audio_capture.rs

async fn run_audio_capture() -> anyhow::Result<()> {
//                              ^^^^^^^^^^^^^^
//                              anyhow::Result<()> = Result<(), anyhow::Error>
    
    // 查找设备（任何错误都会被包装）
    let device = audio::find_loopback_device()
        .expect("找不到环回设备");
    
    // 创建目录（io::Error 自动转换为 anyhow::Error）
    std::fs::create_dir_all(output_dir)?;
    
    // 创建文件（hound::Error 自动转换为 anyhow::Error）
    let writer = utils::file::create_wav_writer(path, spec)?;
    
    // 构建音频流（cpal::BuildStreamError 自动转换）
    let stream = device.build_input_stream(...)?;
    
    // 播放音频流（cpal::PlayStreamError 自动转换）
    stream.play()?;
    
    // 自定义错误
    if some_condition {
        return Err(anyhow!("不支持的采样格式：{:?}", format));
    }
    
    Ok(())
}
```

## 🎓 为什么使用 anyhow？

### 优点

1. **简化代码**
   ```rust
   // ❌ 没有 anyhow
   fn process() -> Result<String, Box<dyn std::error::Error>> {
       // ...
   }
   
   // ✅ 有 anyhow
   fn process() -> anyhow::Result<String> {
       // ...
   }
   ```

2. **统一错误类型**
   ```rust
   // 可以在一个函数中返回各种错误
   fn process() -> Result<()> {
       let file = std::fs::read(...)?;      // io::Error
       let parsed = serde_json::from_str(...)?;  // serde Error
       let num: i32 = text.parse()?;        // ParseIntError
       Ok(())
   }
   ```

3. **更好的错误消息**
   ```rust
   .context("在执行 XXX 操作时")
   // 错误链：
   // Error: 在执行 XXX 操作时
   // Caused by: 原始错误消息
   ```

4. **零成本抽象**
   - 性能与手写错误处理相同
   - 编译后无运行时开销

### 缺点

1. **不适合库**
   - 应用程序：✅ 推荐使用
   - 库（library）：❌ 不推荐（应该用 `thiserror`）

2. **丢失具体错误类型**
   ```rust
   // 无法模式匹配具体的错误类型
   match result {
       Err(e) if e.is::<io::Error>() => { /* 需要 downcast */ }
   }
   ```

## 📊 对比表

| 特性 | 标准库 Result | anyhow | thiserror |
|------|--------------|--------|-----------|
| **用途** | 基础错误处理 | 应用程序 | 库 |
| **错误类型** | 需要指定 | 统一 | 自定义 |
| **上下文** | 手动 | `context()` | 手动 |
| **简洁度** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **类型安全** | ✅ | ⚠️ | ✅ |

## 💡 我们项目中的用法

### 当前代码

```rust
use anyhow::{Context, anyhow};

// 1. 函数返回类型
async fn run_audio_capture() -> anyhow::Result<()> {
//                              ^^^^^^^^^^^^^^^^
//                              = Result<(), anyhow::Error>
    
    // 2. 自动转换各种错误
    std::fs::create_dir_all(dir)?;     // io::Error → anyhow::Error
    let writer = create_wav_writer()?; // hound::Error → anyhow::Error
    stream.play()?;                    // cpal::Error → anyhow::Error
    
    // 3. 创建自定义错误
    return Err(anyhow!("不支持的采样格式：{:?}", format));
    
    // 4. 添加上下文
    let resampler = SincFixedIn::new(...)
        .context("无法创建重采样器")?;
    
    Ok(())
}
```

## 🔧 常用模式

### 模式 1：简单错误

```rust
if !is_valid {
    return Err(anyhow!("无效的输入"));
}
```

### 模式 2：格式化错误

```rust
if value < 0 {
    return Err(anyhow!("值必须非负，当前值: {}", value));
}
```

### 模式 3：使用 bail!（提前返回）

```rust
use anyhow::bail;

if !condition {
    bail!("条件不满足");
    // 等价于 return Err(anyhow!("条件不满足"));
}
```

### 模式 4：使用 ensure!（断言）

```rust
use anyhow::ensure;

ensure!(x > 0, "x 必须大于 0");
// 等价于：
// if !(x > 0) {
//     return Err(anyhow!("x 必须大于 0"));
// }
```

### 模式 5：添加上下文

```rust
use anyhow::Context;

let file = std::fs::read_to_string(path)
    .context("读取配置文件失败")?;

// 或动态上下文
let file = std::fs::read_to_string(path)
    .with_context(|| format!("读取文件 {} 失败", path))?;
```

## 📝 完整示例

### 复杂的错误处理

```rust
use anyhow::{Result, Context, anyhow, bail, ensure};

fn process_audio_file(path: &str) -> Result<Vec<f32>> {
    // 1. 检查文件是否存在
    ensure!(
        std::path::Path::new(path).exists(),
        "文件不存在: {}",
        path
    );
    
    // 2. 读取文件（添加上下文）
    let data = std::fs::read(path)
        .with_context(|| format!("无法读取音频文件: {}", path))?;
    
    // 3. 检查文件大小
    if data.len() < 44 {
        bail!("文件太小（{}字节），不是有效的 WAV 文件", data.len());
    }
    
    // 4. 解析 WAV 头
    let header = parse_wav_header(&data)
        .context("解析 WAV 头失败")?;
    
    // 5. 验证采样率
    if header.sample_rate != 16000 {
        return Err(anyhow!(
            "不支持的采样率: {}Hz，要求 16000Hz",
            header.sample_rate
        ));
    }
    
    // 6. 解码音频
    let samples = decode_samples(&data)
        .context("解码音频数据失败")?;
    
    Ok(samples)
}
```

**错误输出示例**：
```
Error: 无法读取音频文件: test.wav

Caused by:
    No such file or directory (os error 2)
```

## 🆚 anyhow vs thiserror

### anyhow（应用程序）

```rust
// ✅ 适合应用程序的顶层错误处理
use anyhow::Result;

#[tauri::command]
pub async fn start_audio_capture() -> Result<String, String> {
    match run_audio_capture().await {
        Ok(_) => Ok("成功".to_string()),
        Err(e) => Err(format!("错误: {}", e)),  // anyhow::Error → String
    }
}
```

### thiserror（库）

```rust
// ✅ 适合库定义自己的错误类型
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AudioError {
    #[error("设备未找到")]
    DeviceNotFound,
    
    #[error("不支持的采样率: {0}Hz")]
    UnsupportedSampleRate(u32),
    
    #[error("IO 错误")]
    Io(#[from] std::io::Error),
}
```

## 🎯 总结

### anyhow! 的作用

**快速创建带消息的错误**

```rust
Err(anyhow!("错误消息"))
Err(anyhow!("格式化消息: {}", value))
```

### 何时使用 anyhow

- ✅ **应用程序**（如我们的 Tauri 应用）
- ✅ 需要快速原型开发
- ✅ 错误类型不重要，只需要错误消息
- ✅ 需要在一个函数中处理多种错误

### 何时不使用 anyhow

- ❌ **开发库**（供他人使用）
- ❌ 需要调用者匹配具体错误类型
- ❌ 需要定义自己的错误枚举

---

**在我们的项目中**：

```rust
use anyhow::{Result, anyhow};

// ✅ 完美的选择
async fn run_audio_capture() -> Result<()> {
    // 可以返回任何错误
    // 错误消息清晰
    // 代码简洁
}
```

**Cargo.toml**：
```toml
[dependencies]
anyhow = "1.0.98"  # 已添加
```

**一句话总结**：
> `anyhow!` 用于快速创建带格式化消息的错误，让错误处理代码更简洁！

