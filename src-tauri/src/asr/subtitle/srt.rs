use crate::asr::events::{AsrResultEvent, AsrResultKind};
use std::fmt::Write as FmtWrite;
use std::path::Path;

/// 毫秒 → SRT 时间格式 HH:MM:SS,mmm
fn format_srt_time(ms: u64) -> String {
    let hours = ms / 3_600_000;
    let minutes = (ms % 3_600_000) / 60_000;
    let seconds = (ms % 60_000) / 1_000;
    let millis = ms % 1_000;
    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, seconds, millis)
}

/// 将识别结果写出为 SRT 字幕文件
/// 只写 is_final=true 的结果；end_time 缺失时用 begin_time + 2000ms 补全
pub fn write_srt(events: &[AsrResultEvent], path: &Path) -> anyhow::Result<()> {
    let mut content = String::new();
    let finals: Vec<&AsrResultEvent> = events.iter().filter(|e| e.is_final).collect();
    for (idx, event) in finals.iter().enumerate() {
        let begin = format_srt_time(event.begin_time);
        let end = format_srt_time(event.end_time.unwrap_or(event.begin_time + 2000));
        writeln!(content, "{}", idx + 1).unwrap();
        writeln!(content, "{} --> {}", begin, end).unwrap();
        writeln!(content, "{}", event.text).unwrap();
        writeln!(content).unwrap();
    }
    std::fs::write(path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_zero() {
        assert_eq!(format_srt_time(0), "00:00:00,000");
    }

    #[test]
    fn test_format_millis() {
        assert_eq!(format_srt_time(1200), "00:00:01,200");
    }

    #[test]
    fn test_format_hour() {
        assert_eq!(format_srt_time(3_661_500), "01:01:01,500");
    }

    #[test]
    fn test_write_srt_basic() {
        let events = vec![
            AsrResultEvent {
                sentence_id: 0,
                begin_time: 1200,
                end_time: Some(3820),
                text: "你好世界".to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
            AsrResultEvent {
                sentence_id: 1,
                begin_time: 4000,
                end_time: None,
                text: "第二句".to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
        ];
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.srt");
        write_srt(&events, &path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("00:00:01,200 --> 00:00:03,820"));
        assert!(content.contains("你好世界"));
        assert!(content.contains("00:00:04,000 --> 00:00:06,000"));
        assert!(content.contains("第二句"));
    }

    #[test]
    fn test_write_srt_skips_non_final() {
        let events = vec![
            AsrResultEvent {
                sentence_id: 0,
                begin_time: 0,
                end_time: None,
                text: "临时结果".to_string(),
                is_final: false,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
            AsrResultEvent {
                sentence_id: 0,
                begin_time: 0,
                end_time: Some(1000),
                text: "最终结果".to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
        ];
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.srt");
        write_srt(&events, &path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(!content.contains("临时结果"));
        assert!(content.contains("最终结果"));
    }
}
