use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;

/// 创建 WAV 文件写入器
///
/// # 参数
/// - `path`: 文件路径
/// - `spec`: WAV 文件规格
///
/// # 返回
/// 创建成功的 WavWriter 或错误
pub fn create_wav_writer(
    path: &str,
    spec: WavSpec,
) -> Result<WavWriter<BufWriter<File>>, hound::Error> {
    let writer = WavWriter::create(path, spec)?;
    println!("音频文件 {} 已创建 ({:?})", path, spec);
    Ok(writer)
}

/// 保存并关闭 WAV 文件
///
/// # 参数
/// - `writer`: WAV 文件写入器
///
/// # 返回
/// 保存成功或错误
pub fn save_wav_writer(writer: WavWriter<BufWriter<File>>) -> Result<(), hound::Error> {
    writer.finalize()?;
    println!("音频文件已保存");
    Ok(())
}
