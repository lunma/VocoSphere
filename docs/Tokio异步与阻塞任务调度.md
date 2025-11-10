# Tokio 异步与阻塞任务调度说明

## 背景问题
- `run_audio_capture` 最初通过 `tokio::spawn` 启动，内部包含 `thread::sleep` 轮询、音频重采样等同步逻辑。
- 由于函数体无 `await`，会持续占用 Tokio 的 **worker 线程**，导致其它异步任务（WebSocket 读取、日志输出）无法及时被调度。
- 观察到的现象：识别过程中后台持续收到 `result-generated` 事件，但日志要等停止录音后才一次性倾倒。

## Worker 线程的作用
- Tokio 的运行时包含一组 worker 线程，负责轮询和执行所有挂载的 Future。
- Future 只有在 `await` 时才会“主动让出”执行权，调度器才能切换到其他任务，这是一种协作式调度。
- 如果某个 Future 中执行长时间的阻塞计算或 `thread::sleep`，就会独占当前 worker，其他任务即使已就绪也无法运行。

## 原因分析
1. `run_audio_capture` 通过 `tokio::spawn` 运行在 worker 线程。
2. 函数内部是同步循环 + `thread::sleep`，没有任何 `await`。
3. 结果是该 Future 持续占着 worker 线程，调度器无机会轮询 WebSocket 解析任务。
4. 负责处理 `result-generated` 事件的异步任务被延迟执行，只能在 `run_audio_capture` 结束后才统一输出日志。

## 解决方案
- 使用 `tauri::async_runtime::spawn_blocking` 启动 `run_audio_capture`。
- 该 API 内部调用 `tokio::task::spawn_blocking`，把阻塞任务转交给专门的阻塞线程池执行。
- 这样就不会占用 Tokio 的异步 worker，异步任务（WebSocket 消息、日志）可以实时被轮询。

```rust
tauri::async_runtime::spawn_blocking(move || {
    let result = tauri::async_runtime::block_on(run_audio_capture(config));
    // 处理结果...
});
```

## 实际效果
- 录音循环仍可以保持原有同步实现，不需要重写为异步。
- WebSocket 读取任务获得及时调度，在录音过程中即可实时记录 `result-generated` 日志。
- 任务结束或异常时，阻塞线程池中的逻辑也会复位 `IS_RECORDING` 状态，流程依旧安全。

## 结论
将阻塞型的录音循环迁移到 `spawn_blocking`，是解决“日志堆到后台才输出”问题的根本原因。  
关键点在于：区分“阻塞任务”和“异步任务”的运行位置，避免在协作式调度系统里让阻塞逻辑占用 worker 线程。***

