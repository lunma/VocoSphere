# TypeScript Enum vs Rust Enum 对比

## 核心答案

**不一样！** TypeScript 的 `enum` 和 Rust 的 `enum` 也是完全不同的概念。

但 TypeScript 有 **Discriminated Unions（判别联合类型）** 可以实现类似 Rust enum 的效果。

## TypeScript Enum：数字/字符串常量

### TypeScript Enum 是什么

```typescript
// 数字枚举（默认）
enum Status {
    Pending,    // = 0
    Running,    // = 1
    Completed   // = 2
}

// 字符串枚举
enum Color {
    Red = "RED",
    Green = "GREEN",
    Blue = "BLUE"
}

// 使用
let status: Status = Status.Running
let color: Color = Color.Red
```

### 编译后的 JavaScript

```javascript
// TypeScript enum 编译后变成：
var Status;
(function (Status) {
    Status[Status["Pending"] = 0] = "Pending";
    Status[Status["Running"] = 1] = "Running";
    Status[Status["Completed"] = 2] = "Completed";
})(Status || (Status = {}));

// 实际上是一个对象：
// Status = { 0: "Pending", Pending: 0, 1: "Running", Running: 1, ... }
```

### ❌ TypeScript Enum 不能做的事

```typescript
// ❌ 无法携带不同类型的数据
enum AsrModelConfig {
    Gummy(GummyConfig),       // ❌ 语法错误！
    Paraformer(ParaformerConfig)  // ❌ 语法错误！
}

// ❌ TypeScript enum 只能是简单的值
enum ModelType {
    GUMMY = "gummy",          // ✅ 可以
    PARAFORMER = "paraformer" // ✅ 可以
}

// 但不能携带复杂数据！
```

## Rust Enum：代数数据类型

### Rust Enum 可以做的事

```rust
// ✅ 可以携带不同类型的数据
pub enum AsrModelConfig {
    Gummy(GummyConfig),        // 携带 GummyConfig 结构体
    Paraformer(ParaformerConfig), // 携带 ParaformerConfig 结构体
}

// ✅ 每个变体携带完全不同的数据
pub enum Message {
    Quit,                       // 无数据
    Move { x: i32, y: i32 },   // 结构体数据
    Write(String),              // 字符串
    ChangeColor(i32, i32, i32), // 三个整数
}
```

## TypeScript 如何实现类似 Rust Enum 的效果？

### ⭐ 使用 Discriminated Unions（判别联合类型）

这就是**我们项目中使用的方式**！

```typescript
// 定义类型（类似 Rust enum）
type AsrModelConfig = GummyConfig | ParaformerConfig

interface GummyConfig {
    type: 'gummy'      // ← 判别器（discriminator）
    server_config: ServerConfig
    translation_enabled: boolean
    translation_target_languages: string[]
    // ... Gummy 特有的字段
}

interface ParaformerConfig {
    type: 'paraformer' // ← 判别器
    server_config: ServerConfig
    emotion_enabled: boolean
    disfluency_removal_enabled: boolean
    // ... Paraformer 特有的字段（完全不同）
}

// 使用（类型守卫）
function handleConfig(config: AsrModelConfig) {
    if (config.type === 'gummy') {
        // TypeScript 自动推断这里是 GummyConfig
        console.log(config.translation_enabled) // ✅ 类型安全
        // console.log(config.emotion_enabled)  // ❌ 编译错误！
    } else {
        // TypeScript 自动推断这里是 ParaformerConfig
        console.log(config.emotion_enabled) // ✅ 类型安全
        // console.log(config.translation_enabled) // ❌ 编译错误！
    }
}

// 或者使用 switch
function handleConfig2(config: AsrModelConfig) {
    switch (config.type) {
        case 'gummy':
            // config 是 GummyConfig
            console.log(config.translation_enabled)
            break
        case 'paraformer':
            // config 是 ParaformerConfig
            console.log(config.emotion_enabled)
            break
        // ✅ TypeScript 确保所有情况都处理了（启用严格模式）
    }
}
```

### 这就是我们项目中的实现！

**TypeScript 端**（`src/components/AsrConfig.tsx`）：

```typescript
// 使用 Discriminated Unions
export interface GummyConfig {
    type: 'gummy'  // ← 判别器
    server_config: ServerConfig
    source_language: string
    translation_enabled: boolean
    // ...
}

export interface ParaformerConfig {
    type: 'paraformer'  // ← 判别器
    server_config: ServerConfig
    source_language: string
    emotion_enabled: boolean
    // ...
}

export type AsrModelConfig = GummyConfig | ParaformerConfig
```

**Rust 端**（`src-tauri/src/asr/config.rs`）：

```rust
// 使用真正的 enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]  // ← 对应 TypeScript 的 type 字段
pub enum AsrModelConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}
```

**序列化后的 JSON（两边都兼容）**：

```json
{
    "type": "gummy",  // ← TypeScript 用这个判别，Rust 也用这个判别
    "server_config": { ... },
    "translation_enabled": true,
    ...
}
```

## 三语言完整对比

### 场景：表示不同类型的配置

#### Rust（最强大、最简洁）

```rust
// 定义
pub enum AsrModelConfig {
    Gummy(GummyConfig),
    Paraformer(ParaformerConfig),
}

// 使用
match config {
    AsrModelConfig::Gummy(g) => handle_gummy(g),
    AsrModelConfig::Paraformer(p) => handle_paraformer(p),
}
```

**特点**：
- ✅ 语法最简洁
- ✅ 零运行时开销
- ✅ 强制穷尽性检查
- ✅ 强大的模式匹配

#### TypeScript（灵活、类型安全）

```typescript
// 定义（使用 Discriminated Unions，不是 enum）
type AsrModelConfig = GummyConfig | ParaformerConfig

interface GummyConfig {
    type: 'gummy'  // ← 判别器
    // ... 字段
}

interface ParaformerConfig {
    type: 'paraformer'  // ← 判别器
    // ... 完全不同的字段
}

// 使用
if (config.type === 'gummy') {
    handleGummy(config)  // config 自动推断为 GummyConfig
} else {
    handleParaformer(config)  // config 自动推断为 ParaformerConfig
}
```

**特点**：
- ✅ 类型安全
- ✅ 自动类型推断（类型守卫）
- ⚠️ 穷尽性检查需要配置（`strict` 模式）
- ⚠️ 运行时是普通对象

#### Java（冗长，但类型安全）

```java
// 定义（Java 17+）
public sealed interface AsrModelConfig 
    permits GummyConfig, ParaformerConfig {}

public record GummyConfig(
    ServerConfig serverConfig,
    boolean translationEnabled,
    // ...
) implements AsrModelConfig {}

public record ParaformerConfig(
    ServerConfig serverConfig,
    boolean emotionEnabled,
    // ...
) implements AsrModelConfig {}

// 使用（Java 21+）
switch (config) {
    case GummyConfig g -> handleGummy(g);
    case ParaformerConfig p -> handleParaformer(p);
}
```

**特点**：
- ✅ 类型安全
- ✅ 穷尽性检查（Java 21+）
- ❌ 代码冗长
- ⚠️ 运行时开销（虚表）

## 对比总结表

| 特性 | Rust Enum | TypeScript Enum | TypeScript Union | Java Sealed |
|------|-----------|-----------------|------------------|-------------|
| **携带不同类型** | ✅✅✅ | ❌ | ✅✅ | ✅ |
| **类型安全** | ✅✅✅ | ✅ | ✅✅✅ | ✅✅ |
| **穷尽性检查** | ✅ 强制 | ❌ | ⚠️ 可选 | ✅ (21+) |
| **模式匹配** | ✅✅✅ | ❌ | ⚠️ 手动 | ⚠️ (21+) |
| **语法简洁** | ✅✅✅ | ✅✅ | ✅✅ | ⚠️ |
| **运行时开销** | 零 ✅ | 小 | 零 ✅ | 有 |
| **适用场景** | 类型联合 | 固定常量 | 类型联合 | 类型联合 |

## 我们项目中的实际对应

### Rust 端

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AsrModelConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}
```

### TypeScript 端（完美对应！）

```typescript
// 不使用 TypeScript enum！
// 使用 Discriminated Unions
export type AsrModelConfig = GummyConfig | ParaformerConfig

export interface GummyConfig {
  type: 'gummy'  // ← 对应 Rust 的 #[serde(tag = "type")]
  server_config: ServerConfig
  translation_enabled: boolean
  // ...
}

export interface ParaformerConfig {
  type: 'paraformer'
  server_config: ServerConfig
  emotion_enabled: boolean
  // ...
}
```

### JSON 数据（完全兼容）

```json
{
  "type": "gummy",
  "server_config": { ... },
  "translation_enabled": true,
  ...
}
```

**Rust 和 TypeScript 可以无缝交互！** ✅

## 为什么 TypeScript 不用 enum？

### ❌ 如果用 TypeScript enum：

```typescript
// 这样定义不行
enum AsrModelType {
    Gummy = "gummy",
    Paraformer = "paraformer"
}

// 然后呢？如何携带不同的数据？
// ❌ 做不到！
```

### ✅ 应该用 Discriminated Unions：

```typescript
// 这才是正确的方式
type AsrModelConfig = 
    | { type: 'gummy', translation_enabled: boolean, ... }
    | { type: 'paraformer', emotion_enabled: boolean, ... }

// 类型安全地使用
function handle(config: AsrModelConfig) {
    if (config.type === 'gummy') {
        // TypeScript 知道这里是 GummyConfig
        config.translation_enabled  // ✅ 可访问
        // config.emotion_enabled   // ❌ 编译错误
    } else {
        // TypeScript 知道这里是 ParaformerConfig
        config.emotion_enabled      // ✅ 可访问
        // config.translation_enabled // ❌ 编译错误
    }
}
```

## 三语言 Enum 对比

| 特性 | Rust `enum` | TypeScript `enum` | TypeScript Union |
|------|-------------|-------------------|------------------|
| **本质** | 代数数据类型 | 常量映射 | 类型联合 |
| **携带数据** | ✅ 不同类型 | ❌ 不能 | ✅ 不同类型 |
| **类型安全** | ✅✅✅ | ✅ | ✅✅✅ |
| **模式匹配** | ✅✅✅ | ❌ | ⚠️ 类型守卫 |
| **穷尽性检查** | ✅ 强制 | ❌ | ⚠️ 可选 |
| **运行时** | 高效内存布局 | 数字/字符串 | 普通对象 |
| **编译输出** | 机器码 | JavaScript 对象 | JavaScript 对象 |

## 详细示例对比

### 场景：表示不同类型的消息

#### Rust Enum

```rust
pub enum Message {
    Text(String),
    Image { url: String, width: u32, height: u32 },
    Video { url: String, duration: u32 },
}

// 使用
fn handle(msg: Message) {
    match msg {
        Message::Text(content) => {
            println!("文本: {}", content);
        }
        Message::Image { url, width, height } => {
            println!("图片: {} ({}x{})", url, width, height);
        }
        Message::Video { url, duration } => {
            println!("视频: {} ({}s)", url, duration);
        }
    }
}

// 创建
let msg1 = Message::Text("Hello".to_string());
let msg2 = Message::Image { 
    url: "pic.jpg".to_string(), 
    width: 800, 
    height: 600 
};
```

#### TypeScript Enum（❌ 不能这样用）

```typescript
// ❌ TypeScript enum 无法携带数据
enum Message {
    Text("Hello"),        // ❌ 语法错误
    Image({ url: "..." }) // ❌ 语法错误
}
```

#### TypeScript Discriminated Unions（✅ 正确方式）

```typescript
// ✅ 使用 Discriminated Unions
type Message = 
    | { type: 'text', content: string }
    | { type: 'image', url: string, width: number, height: number }
    | { type: 'video', url: string, duration: number }

// 使用
function handle(msg: Message) {
    switch (msg.type) {
        case 'text':
            // msg 自动推断为 text 类型
            console.log(`文本: ${msg.content}`)
            break
        case 'image':
            // msg 自动推断为 image 类型
            console.log(`图片: ${msg.url} (${msg.width}x${msg.height})`)
            break
        case 'video':
            // msg 自动推断为 video 类型
            console.log(`视频: ${msg.url} (${msg.duration}s)`)
            break
    }
}

// 创建
const msg1: Message = { type: 'text', content: 'Hello' }
const msg2: Message = { 
    type: 'image', 
    url: 'pic.jpg', 
    width: 800, 
    height: 600 
}
```

## 我们项目中的实际应用

### Rust 端（使用 enum）

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AsrModelConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}
```

### TypeScript 端（使用 Discriminated Unions）

```typescript
// 我们的实现（AsrConfig.tsx）
export interface GummyConfig {
  type: 'gummy'  // ← 对应 Rust 的 tag
  server_config: ServerConfig
  source_language: string
  translation_enabled: boolean
  translation_target_languages: string[]
  vocabulary_id?: string
  punctuation_prediction_enabled: boolean
  itn_enabled: boolean
}

export interface ParaformerConfig {
  type: 'paraformer'  // ← 对应 Rust 的 tag
  server_config: ServerConfig
  source_language: string
  vocabulary_id?: string
  disfluency_removal_enabled: boolean
  punctuation_prediction_enabled: boolean
  itn_enabled: boolean
  dialect?: string
  emotion_enabled: boolean
}

export type AsrModelConfig = GummyConfig | ParaformerConfig
```

### JSON 交互（完美匹配）

```json
{
  "type": "gummy",           // ← Rust 序列化添加，TypeScript 用于判别
  "server_config": { ... },
  "translation_enabled": true,
  ...
}
```

## TypeScript Enum 的正确用途

TypeScript enum 适合用于**简单的常量定义**：

```typescript
// ✅ 好的用法
enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3
}

enum HttpMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE"
}

// 使用
function log(level: LogLevel, message: string) {
    if (level >= LogLevel.Warn) {
        console.warn(message)
    }
}
```

**不适合**用于复杂的数据类型！

## 最佳实践建议

### Rust 端

```rust
// ✅ 使用 enum
pub enum AsrModelConfig {
    Gummy(GummyConfig),
    Paraformer(ParaformerConfig),
}
```

### TypeScript 端

```typescript
// ❌ 不要用 enum
enum ModelType { Gummy, Paraformer }

// ✅ 使用 Discriminated Unions
type AsrModelConfig = GummyConfig | ParaformerConfig

interface GummyConfig {
    type: 'gummy'  // 字符串字面量类型
    // ...
}

interface ParaformerConfig {
    type: 'paraformer'  // 字符串字面量类型
    // ...
}
```

### 为什么 TypeScript 不用 enum？

1. **TypeScript enum 编译后变成运行时对象**，增加包体积
2. **不能携带复杂数据**
3. **const enum 在某些场景有问题**
4. **Discriminated Unions 更符合 TypeScript 的类型系统**

## 快速记忆卡

| 语言 | 常量集合 | 类型联合（携带不同数据） |
|------|---------|------------------------|
| **Rust** | `enum Color { Red, Green, Blue }` | `enum Message { Text(String), Image(Data) }` |
| **TypeScript** | `enum Color { Red, Green, Blue }` | `type Message = {type:'text',...} \| {type:'image',...}` |
| **Java** | `enum Color { RED, GREEN, BLUE }` | `sealed interface + record`（Java 17+）|

## 结论

### 问题：TypeScript enum 和 Rust enum 一样吗？

**答案**：❌ **完全不一样！**

- **TypeScript enum** = 常量集合（类似 Java enum）
- **Rust enum** = 类型联合（代数数据类型）
- **TypeScript Discriminated Unions** ≈ **Rust enum**（最接近）

### 我们项目的方案

✅ **Rust 端**：使用 `enum`
✅ **TypeScript 端**：使用 `Discriminated Unions`（不是 `enum`）
✅ **JSON 交互**：通过 `type` 字段完美对接

这就是为什么我们的前后端可以无缝交互！🎉

