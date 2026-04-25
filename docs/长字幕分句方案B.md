# 长字幕分句方案 B：Rust Handler 标点分句

## 问题背景

Gummy 模型以"静音检测"为句子边界，`sentence_end=true` 只在停顿时触发。
连续讲话 30 秒不停顿时，整段归为一个 `sentence_id`，字幕一次性显示全文，导致字幕过长。

示例：sentence_id=0，0.00s–30.02s，文本约 200 字。

---

## 方案选型对比

| 方案 | 实现位置 | 优点 | 缺点 |
|---|---|---|---|
| A：模型参数 | API 参数 | 零代码 | Gummy 不暴露分句粒度参数 |
| **B：Rust Handler 标点分句** | `handler.rs` | 数据层干净，前端零改动 | 需维护分句状态 |
| C：前端显示截断 | `SubtitleOverlay.tsx` | 5 分钟实现 | 仅视觉截断，历史数据仍是全文 |
| D：开源工具 | 离线后处理 | 精度高 | 不适用实时流式场景 |

**选择方案 B**：在 Rust handler 层用 `words[].fixed + words[].punctuation` 实现虚拟分句，对前端完全透明。

---

## 核心思路

Gummy 每次推送的 `Transcription` 包含 `words: Vec<Word>`，每个 Word 有：
- `text: String` — 词文本
- `punctuation: String` — 词后标点
- `fixed: bool` — 是否已确定（`true` 表示不再变化）

策略：
1. 跟踪每个 model sentence 已"提交"的 word 数量（`committed_word_count`）
2. 每次收到非 final 更新时，扫描新增的 `fixed=true` 的词
3. 遇到句末标点（`。！？!?`）且积累字数 ≥ 阈值时，虚拟 emit 一个 `is_final=true` 分句
4. 剩余未提交的词继续以 `is_final=false` 流式显示
5. model `sentence_end=true` 时，把剩余尾段作为最后一个 final emit

---

## 虚拟 sentence_id 设计

model sentence_id 从 0 开始递增。若用固定偏移（如 10_000），长时间运行后（约 3 小时/1句每秒）会发生冲突。

**解法：使用高位 bit 作为虚拟分句的命名空间标志**

```rust
const VIRTUAL_ID_BASE: u32 = 0x8000_0000; // bit31 置 1
```

- model ID：`0x0000_0000` ~ `0x7FFF_FFFF`（bit31=0）
- 虚拟 ID：`0x8000_0000` ~ `0xFFFF_FFFF`（bit31=1）

即使每秒一句跑 68 年，model ID 也无法到达 `0x8000_0000`（约 21 亿）。
两个空间永不相交，无需动态调整。

---

## TODO 清单

### 文件 1：`src-tauri/src/asr/websocket/gummy/handler.rs`

**TODO 1** — 文件顶部添加常量

```rust
const MIN_SEGMENT_CHARS: usize = 20;
const TERMINAL_PUNCTS: &[char] = &['。', '！', '？', '!', '?'];
const VIRTUAL_ID_BASE: u32 = 0x8000_0000;
```

**TODO 2** — 新增 `SentenceState` struct

```rust
struct SentenceState {
    committed_word_count: usize, // 已提交为 final 的 words 数量
    segment_begin_time: u64,     // 当前未提交片段的起始时间
}
```

**TODO 3** — `process_result` 函数签名新增两个参数

```rust
pub(crate) fn process_result(
    output: Option<Output>,
    temp_results: &mut HashMap<u32, String>,
    last_sentence_id: &mut u32,
    last_end_time: &mut Option<u64>,
    source_language: Option<&str>,
    sentence_states: &mut HashMap<u32, SentenceState>,  // 新增
    next_virtual_id: &mut u32,                          // 新增
)
```

**TODO 4** — 非 final 分支（`sentence_end=false`）替换分句逻辑

步骤：
1. 获取或初始化 `SentenceState`：
   - `committed_word_count = 0`
   - `segment_begin_time = words[0].begin_time`（若 words 非空）
2. 遍历 `words[committed_word_count..]`，跳过 `fixed=false` 的词
3. 拼接 `word.text + word.punctuation`，统计字符数
4. 遇到 `TERMINAL_PUNCTS` 且已积累 `>= MIN_SEGMENT_CHARS` 个字时：
   - 拼接 `words[committed_word_count..=split_idx]` 的文本
   - emit `is_final=true, sentence_id=*next_virtual_id, begin_time=state.segment_begin_time, end_time=words[split_idx].end_time`
   - `*next_virtual_id += 1`
   - `state.committed_word_count = split_idx + 1`
   - `state.segment_begin_time = words[split_idx + 1].begin_time`（若存在）
   - 重置字符计数，继续扫描后续 fixed 词
5. 扫描结束后，拼接 `words[committed_word_count..]` 的文本（含 fixed=false 的当前词）
6. emit `is_final=false, sentence_id=original_sentence_id`（流式显示剩余部分）

**TODO 5** — final 分支（`sentence_end=true`）处理尾段

1. 从 `sentence_states` 取出该句的 `committed_word_count` 和 `segment_begin_time`
2. 若有未提交文本（`words[committed_word_count..].len() > 0`）：
   - 拼接文本，emit `is_final=true, sentence_id=original_sentence_id`，`begin_time=state.segment_begin_time`
3. 从 `sentence_states` 移除该句状态

---

### 文件 2：`src-tauri/src/asr/websocket/gummy/impl_.rs`

**TODO 6** — `recognize_results` 中新增状态变量

```rust
let mut sentence_states: HashMap<u32, SentenceState> = HashMap::new();
let mut next_virtual_id: u32 = VIRTUAL_ID_BASE;
```

**TODO 7** — 更新 `process_result` 调用

```rust
process_result(
    event.payload.output,
    &mut temp_results,
    &mut last_sentence_id,
    &mut last_end_time,
    source_language.as_deref(),
    &mut sentence_states,   // 新增
    &mut next_virtual_id,   // 新增
);
```

---

## 前端兼容性说明

`addAsrResult`（`asrStore.ts`）按 `sentence_id + kind` 聚合，按 `begin_time` 排序。
虚拟 ID（`0x8000_0000+`）与 model ID（`0~N`）天然不冲突，字幕窗口直接受益，无需任何前端改动。
