# const fn 详解：编译时函数

## 核心区别

### const fn - 编译时可计算

```rust
pub const fn new(level: LevelFilter) -> Self {
    Self {
        app_handle: OnceLock::new(),
        level,
    }
}
```

**特点：**
- ✅ 可以在**编译时**执行
- ✅ 可以在**运行时**执行
- ✅ 可以用于 const 上下文（static、const）
- ❌ 有很多限制

### fn - 普通函数（运行时）

```rust
pub fn new(level: LevelFilter) -> Self {
    Self {
        app_handle: OnceLock::new(),
        level,
    }
}
```

**特点：**
- ❌ 只能在**运行时**执行
- ✅ 没有限制，可以做任何事
- ❌ 不能用于 const 上下文

## 使用场景对比

### 场景 1：静态变量初始化

```rust
// ✅ const fn：可以用于 static 初始化
pub const fn new(level: LevelFilter) -> Self {
    Self { level }
}

static LOGGER: TauriLogger = TauriLogger::new(LevelFilter::Debug);
// 在编译时完成初始化，直接写入二进制文件


// ❌ 普通 fn：不能用于 static 初始化
pub fn new(level: LevelFilter) -> Self {
    Self { level }
}

static LOGGER: TauriLogger = TauriLogger::new(LevelFilter::Debug);
//                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// 编译错误：calls in statics are limited to constant functions
```

### 场景 2：const 常量定义

```rust
// ✅ const fn：可以定义编译时常量
const fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

const RESULT: i32 = multiply(10, 20);  // 编译时计算 = 200


// ❌ 普通 fn：不能用于 const
fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

const RESULT: i32 = multiply(10, 20);
//                  ^^^^^^^^^^^^^^^^^
// 编译错误：calls in constants are limited to constant functions
```

### 场景 3：数组大小

```rust
// ✅ const fn：可以用于定义数组大小
const fn calculate_size() -> usize {
    128 * 1024
}

static BUFFER: [u8; calculate_size()] = [0; calculate_size()];


// ❌ 普通 fn：不能用于数组大小
fn calculate_size() -> usize {
    128 * 1024
}

static BUFFER: [u8; calculate_size()] = [0; calculate_size()];
//                  ^^^^^^^^^^^^^^^^^
// 编译错误：calls in constants are limited to constant functions
```

## const fn 的限制

### ✅ 可以使用的功能

#### 1. 基本运算

```rust
const fn add(a: i32, b: i32) -> i32 {
    a + b  // ✅ 算术运算
}

const fn compare(a: i32, b: i32) -> bool {
    a > b  // ✅ 比较运算
}

const fn bitwise(a: i32) -> i32 {
    a << 2 | a >> 2  // ✅ 位运算
}
```

#### 2. 控制流

```rust
const fn max(a: i32, b: i32) -> i32 {
    // ✅ if-else
    if a > b {
        a
    } else {
        b
    }
}

const fn factorial(n: i32) -> i32 {
    // ✅ while 循环
    let mut result = 1;
    let mut i = 1;
    while i <= n {
        result *= i;
        i += 1;
    }
    result
}

const fn sum_array(arr: &[i32]) -> i32 {
    // ✅ loop
    let mut sum = 0;
    let mut i = 0;
    loop {
        if i >= arr.len() {
            break;
        }
        sum += arr[i];
        i += 1;
    }
    sum
}
```

#### 3. 模式匹配

```rust
const fn describe(n: i32) -> &'static str {
    // ✅ match
    match n {
        0 => "zero",
        1 => "one",
        2 => "two",
        _ => "many",
    }
}
```

#### 4. 结构体和元组

```rust
struct Point {
    x: i32,
    y: i32,
}

const fn new_point(x: i32, y: i32) -> Point {
    // ✅ 创建结构体
    Point { x, y }
}

const fn make_tuple(a: i32, b: i32) -> (i32, i32) {
    // ✅ 创建元组
    (a, b)
}

const fn get_x(p: &Point) -> i32 {
    // ✅ 访问字段
    p.x
}
```

#### 5. 引用和解引用

```rust
const fn get_value(r: &i32) -> i32 {
    // ✅ 解引用
    *r
}

const fn make_ref(x: &i32) -> &i32 {
    // ✅ 返回引用
    x
}
```

#### 6. 调用其他 const fn

```rust
const fn add(a: i32, b: i32) -> i32 {
    a + b
}

const fn complex_calc(x: i32) -> i32 {
    // ✅ 调用其他 const fn
    add(x, 10) + add(x, 20)
}
```

### ❌ 不能使用的功能

#### 1. 堆分配

```rust
const fn create_vec() -> Vec<i32> {
    // ❌ 不能分配堆内存
    Vec::new()
    // 错误：cannot call non-const fn `Vec::<i32>::new` in const fn
}

const fn create_string() -> String {
    // ❌ 不能创建 String
    String::from("hello")
    // 错误：cannot call non-const fn
}

const fn box_value(x: i32) -> Box<i32> {
    // ❌ 不能使用 Box
    Box::new(x)
    // 错误：cannot call non-const fn
}
```

#### 2. 浮点数运算（部分）

```rust
const fn add_floats(a: f64, b: f64) -> f64 {
    // ✅ 简单运算可以（Rust 1.61+）
    a + b
}

const fn sqrt(x: f64) -> f64 {
    // ❌ 复杂运算不行
    x.sqrt()
    // 错误：cannot call non-const fn
}
```

#### 3. 动态分发

```rust
const fn create_logger() -> Box<dyn Log> {
    // ❌ 不能使用 trait 对象
    Box::new(MyLogger)
    // 错误：cannot call non-const fn
}
```

#### 4. 外部函数调用

```rust
use std::fs;

const fn read_file() -> String {
    // ❌ 不能进行 IO 操作
    fs::read_to_string("file.txt").unwrap()
    // 错误：cannot call non-const fn
}

use std::time::SystemTime;

const fn get_time() -> u64 {
    // ❌ 不能获取系统时间
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs()
    // 错误：cannot call non-const fn
}
```

#### 5. 可变静态变量

```rust
static mut COUNTER: i32 = 0;

const fn increment() -> i32 {
    unsafe {
        // ❌ 不能访问可变静态变量
        COUNTER += 1;
        COUNTER
    }
    // 错误：mutation of layout constrained field is unsafe
}
```

#### 6. 裸指针解引用（部分限制）

```rust
const fn deref_ptr(ptr: *const i32) -> i32 {
    unsafe {
        // ❌ 某些情况下不允许
        *ptr
    }
    // 限制很多，通常不建议在 const fn 中使用
}
```

## 编译时 vs 运行时

### 编译时执行

```rust
const fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => {
            let mut a = 0;
            let mut b = 1;
            let mut i = 2;
            while i <= n {
                let temp = a + b;
                a = b;
                b = temp;
                i += 1;
            }
            b
        }
    }
}

// 编译时计算，结果直接写入二进制
const FIB_10: u32 = fibonacci(10);  // 在编译时计算 = 55

// 生成的汇编代码：
// mov eax, 55  ; 直接使用计算好的值

fn main() {
    println!("{}", FIB_10);  // 无任何计算，直接使用 55
}
```

### 运行时执行

```rust
fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => {
            let mut a = 0;
            let mut b = 1;
            for _ in 2..=n {
                let temp = a + b;
                a = b;
                b = temp;
            }
            b
        }
    }
}

fn main() {
    let result = fibonacci(10);  // 运行时计算
    println!("{}", result);
}

// 生成的汇编代码包含完整的循环逻辑
```

## const fn 的演进

### Rust 1.31（稳定）

```rust
// ✅ 基本功能
const fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

### Rust 1.46（更多功能）

```rust
// ✅ if、match、loop、while
const fn factorial(n: i32) -> i32 {
    let mut result = 1;
    let mut i = 1;
    while i <= n {
        result *= i;
        i += 1;
    }
    result
}
```

### Rust 1.57（泛型）

```rust
// ✅ 泛型 const fn
const fn max<T: ~const PartialOrd>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

### Rust 1.61（浮点数）

```rust
// ✅ 浮点数基本运算
const fn add_floats(a: f64, b: f64) -> f64 {
    a + b
}
```

## 实际应用示例

### 示例 1：配置常量

```rust
pub struct Config {
    pub max_connections: usize,
    pub timeout_seconds: u64,
    pub buffer_size: usize,
}

impl Config {
    pub const fn new() -> Self {
        Self {
            max_connections: 100,
            timeout_seconds: 30,
            buffer_size: 1024 * 1024,  // 1MB
        }
    }
    
    pub const fn with_connections(mut self, n: usize) -> Self {
        self.max_connections = n;
        self
    }
}

// 编译时创建配置
static CONFIG: Config = Config::new()
    .with_connections(200);
```

### 示例 2：类型安全的单位

```rust
pub struct Bytes(usize);

impl Bytes {
    pub const fn new(n: usize) -> Self {
        Self(n)
    }
    
    pub const fn kb(n: usize) -> Self {
        Self(n * 1024)
    }
    
    pub const fn mb(n: usize) -> Self {
        Self(n * 1024 * 1024)
    }
    
    pub const fn value(&self) -> usize {
        self.0
    }
}

// 编译时计算
const BUFFER_SIZE: usize = Bytes::mb(10).value();  // 10MB
static BUFFER: [u8; BUFFER_SIZE] = [0; BUFFER_SIZE];
```

### 示例 3：位标志

```rust
pub struct Flags(u32);

impl Flags {
    pub const NONE: Self = Self(0);
    pub const READ: Self = Self(1 << 0);
    pub const WRITE: Self = Self(1 << 1);
    pub const EXECUTE: Self = Self(1 << 2);
    
    pub const fn new(bits: u32) -> Self {
        Self(bits)
    }
    
    pub const fn or(self, other: Self) -> Self {
        Self(self.0 | other.0)
    }
    
    pub const fn contains(self, other: Self) -> bool {
        (self.0 & other.0) == other.0
    }
}

// 编译时组合标志
const READ_WRITE: Flags = Flags::READ.or(Flags::WRITE);
```

### 示例 4：我们的日志系统

```rust
pub struct TauriLogger {
    app_handle: OnceLock<AppHandle>,
    level: LevelFilter,
}

impl TauriLogger {
    // const fn 允许在编译时创建实例
    pub const fn new(level: LevelFilter) -> Self {
        Self {
            app_handle: OnceLock::new(),  // OnceLock::new 是 const fn
            level,
        }
    }
}

// 编译时初始化，零运行时开销
static LOGGER: TauriLogger = TauriLogger::new(LevelFilter::Debug);
```

## 性能对比

### const fn 版本

```rust
const fn compute() -> i32 {
    let mut sum = 0;
    let mut i = 0;
    while i < 1000 {
        sum += i * i;
        i += 1;
    }
    sum
}

const RESULT: i32 = compute();  // 编译时计算

fn main() {
    println!("{}", RESULT);  // 直接使用，0 CPU 周期
}

// 生成的汇编（简化）：
// mov eax, 332833500  ; 直接使用预计算的值
```

### 普通 fn 版本

```rust
fn compute() -> i32 {
    let mut sum = 0;
    let mut i = 0;
    while i < 1000 {
        sum += i * i;
        i += 1;
    }
    sum
}

fn main() {
    let result = compute();  // 运行时计算
    println!("{}", result);
}

// 生成的汇编包含完整的循环代码：
// xor eax, eax        ; sum = 0
// xor ecx, ecx        ; i = 0
// .loop:
//   imul edx, ecx, ecx  ; i * i
//   add eax, edx        ; sum += i * i
//   inc ecx             ; i += 1
//   cmp ecx, 1000       ; i < 1000?
//   jl .loop            ; 如果是，继续循环
```

**性能差异：**
- const fn：0 CPU 周期（编译时完成）
- 普通 fn：~1000 次循环 = 几千 CPU 周期

## 何时使用 const fn？

### ✅ 应该使用 const fn

1. **静态变量初始化**
   ```rust
   static CONFIG: Config = Config::new();
   ```

2. **常量计算**
   ```rust
   const BUFFER_SIZE: usize = 1024 * 1024;
   ```

3. **编译时优化**
   ```rust
   const PRECOMPUTED: [i32; 100] = precompute_values();
   ```

4. **简单的纯函数**
   ```rust
   const fn min(a: i32, b: i32) -> i32 {
       if a < b { a } else { b }
   }
   ```

### ❌ 不应该使用 const fn

1. **需要 IO 操作**
   ```rust
   fn load_config() -> Config {
       fs::read_to_string("config.json")...
   }
   ```

2. **需要堆分配**
   ```rust
   fn create_collection() -> Vec<i32> {
       vec![1, 2, 3]
   }
   ```

3. **需要系统调用**
   ```rust
   fn get_timestamp() -> u64 {
       SystemTime::now()...
   }
   ```

4. **复杂的运行时逻辑**
   ```rust
   fn process_data(data: &[u8]) -> Result<Data, Error> {
       // 复杂的解析逻辑
   }
   ```

## 总结

### 核心区别

| 特性 | const fn | fn |
|------|----------|-----|
| **执行时机** | 编译时 + 运行时 | 仅运行时 |
| **用于 const/static** | ✅ 可以 | ❌ 不可以 |
| **堆分配** | ❌ 不可以 | ✅ 可以 |
| **IO 操作** | ❌ 不可以 | ✅ 可以 |
| **限制** | 很多 | 无 |
| **性能** | 零运行时开销 | 有运行时开销 |

### 选择建议

```
需要在编译时计算？
├─ 是
│  ├─ 逻辑简单？
│  │  ├─ 是 → 使用 const fn ✅
│  │  └─ 否 → 考虑宏或构建脚本
│  └─ 需要 IO/堆分配？
│     └─ 是 → 不能用 const fn
└─ 否 → 使用普通 fn
```

### 最佳实践

1. **优先考虑 const fn**
   - 如果可以写成 const fn，就写成 const fn
   - 即使暂时不需要，未来可能有用

2. **从简单开始**
   - 先写普通 fn
   - 如果需要编译时计算，再加 const

3. **使用工具检查**
   - 编译器会告诉你能否使用 const fn
   - 尝试添加 const，看看编译器的反馈

这就是 `const fn` 和普通 `fn` 的完整对比！🎯

