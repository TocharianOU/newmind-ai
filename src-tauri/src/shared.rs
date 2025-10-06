use std::{path::PathBuf, sync::LazyLock};

pub fn get_oap_root_url() -> String {
    std::env::var("OAP_ROOT_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

pub static PROJECT_DIRS: LazyLock<Dirs> = LazyLock::new(|| {
    let home = dirs::home_dir().unwrap();
    Dirs {
        root: home.join(".newmind"),
        cache: home.join(".newmind/host_cache"),
        bus: home.join(".newmind/host_cache/bus"),
        log: home.join(".newmind/log"),
        bin: home.join(".newmind/bin"),
        script: home.join(".newmind/scripts"),

        #[cfg(debug_assertions)]
        config: std::env::current_dir().unwrap().join("../.config"),
        #[cfg(not(debug_assertions))]
        config: home.join(".newmind/config"),
    }
});

#[derive(Debug, Clone)]
pub struct Dirs {
    pub root: PathBuf,
    pub config: PathBuf,
    pub cache: PathBuf,
    pub bus: PathBuf,
    pub log: PathBuf,
    pub bin: PathBuf,
    pub script: PathBuf,
}
