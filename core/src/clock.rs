use chrono::Local;

/// Local wall-clock "now" as ISO-8601 text WITHOUT any timezone offset
/// (spec §1, §6.5). Everything the app stores as a datetime uses this shape.
pub fn now_local_iso() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}
