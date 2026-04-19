use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, codecs::jpeg::JpegEncoder, imageops::FilterType};
use serde::Serialize;
#[cfg(target_os = "windows")]
use once_cell::sync::Lazy;
#[cfg(target_os = "windows")]
use rdev::{listen, Event, EventType, Key};
#[cfg(target_os = "windows")]
use screenshots::Screen;
use tauri::Emitter;
use tauri::Manager;
use tauri::WindowEvent;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::{PlaySoundW, SND_ALIAS, SND_ASYNC, SND_NODEFAULT};
#[cfg(target_os = "windows")]
use windows::core::w;

#[cfg(target_os = "windows")]
use std::sync::Mutex;
#[cfg(target_os = "windows")]
use std::thread;
#[cfg(target_os = "windows")]
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
#[derive(Clone)]
struct FallbackHotkey {
    shortcut: String,
    key: Key,
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
}

#[cfg(target_os = "windows")]
#[derive(Default, Clone, Copy)]
struct ModifierState {
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
}

#[cfg(target_os = "windows")]
#[derive(Default)]
struct FallbackState {
    enabled: bool,
    listener_started: bool,
    shortcut: Option<FallbackHotkey>,
    modifiers: ModifierState,
    last_trigger_at: Option<Instant>,
}

#[cfg(target_os = "windows")]
static FALLBACK_STATE: Lazy<Mutex<FallbackState>> = Lazy::new(|| Mutex::new(FallbackState::default()));

const DEFAULT_TRAY_HOTKEY: &str = "Ctrl+Shift+F8";

struct TrayMenuState {
    hotkey_item: MenuItem<tauri::Wry>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(target_os = "windows")]
fn parse_key_token(token: &str) -> Option<Key> {
    match token.to_ascii_uppercase().as_str() {
        "A" => Some(Key::KeyA),
        "B" => Some(Key::KeyB),
        "C" => Some(Key::KeyC),
        "D" => Some(Key::KeyD),
        "E" => Some(Key::KeyE),
        "F" => Some(Key::KeyF),
        "G" => Some(Key::KeyG),
        "H" => Some(Key::KeyH),
        "I" => Some(Key::KeyI),
        "J" => Some(Key::KeyJ),
        "K" => Some(Key::KeyK),
        "L" => Some(Key::KeyL),
        "M" => Some(Key::KeyM),
        "N" => Some(Key::KeyN),
        "O" => Some(Key::KeyO),
        "P" => Some(Key::KeyP),
        "Q" => Some(Key::KeyQ),
        "R" => Some(Key::KeyR),
        "S" => Some(Key::KeyS),
        "T" => Some(Key::KeyT),
        "U" => Some(Key::KeyU),
        "V" => Some(Key::KeyV),
        "W" => Some(Key::KeyW),
        "X" => Some(Key::KeyX),
        "Y" => Some(Key::KeyY),
        "Z" => Some(Key::KeyZ),
        "0" => Some(Key::Num0),
        "1" => Some(Key::Num1),
        "2" => Some(Key::Num2),
        "3" => Some(Key::Num3),
        "4" => Some(Key::Num4),
        "5" => Some(Key::Num5),
        "6" => Some(Key::Num6),
        "7" => Some(Key::Num7),
        "8" => Some(Key::Num8),
        "9" => Some(Key::Num9),
        "F1" => Some(Key::F1),
        "F2" => Some(Key::F2),
        "F3" => Some(Key::F3),
        "F4" => Some(Key::F4),
        "F5" => Some(Key::F5),
        "F6" => Some(Key::F6),
        "F7" => Some(Key::F7),
        "F8" => Some(Key::F8),
        "F9" => Some(Key::F9),
        "F10" => Some(Key::F10),
        "F11" => Some(Key::F11),
        "F12" => Some(Key::F12),
        "PRINTSCREEN" | "PRTSC" => Some(Key::PrintScreen),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
fn parse_shortcut(shortcut: &str) -> Result<FallbackHotkey, String> {
    let parts: Vec<&str> = shortcut
        .split('+')
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .collect();
    if parts.is_empty() {
        return Err("Shortcut cannot be empty.".to_string());
    }

    let mut ctrl = false;
    let mut alt = false;
    let mut shift = false;
    let mut meta = false;
    let mut key: Option<Key> = None;

    for part in parts {
        match part.to_ascii_uppercase().as_str() {
            "CTRL" | "CONTROL" | "COMMANDORCONTROL" => ctrl = true,
            "ALT" => alt = true,
            "SHIFT" => shift = true,
            "META" | "WIN" | "SUPER" => meta = true,
            _ => {
                if key.is_some() {
                    return Err("Shortcut can only contain one non-modifier key.".to_string());
                }
                key = parse_key_token(part);
                if key.is_none() {
                    return Err(format!("Unsupported key in shortcut: {part}"));
                }
            }
        }
    }

    let Some(final_key) = key else {
        return Err("Shortcut must include a key like F8 or P.".to_string());
    };
    if !ctrl && !alt && !shift && !meta {
        return Err("Shortcut must include at least one modifier key.".to_string());
    }

    Ok(FallbackHotkey {
        shortcut: shortcut.to_string(),
        key: final_key,
        ctrl,
        alt,
        shift,
        meta,
    })
}

#[cfg(target_os = "windows")]
fn update_modifier_state(modifiers: &mut ModifierState, key: Key, pressed: bool) {
    match key {
        Key::ControlLeft | Key::ControlRight => modifiers.ctrl = pressed,
        Key::ShiftLeft | Key::ShiftRight => modifiers.shift = pressed,
        Key::Alt | Key::AltGr => modifiers.alt = pressed,
        Key::MetaLeft | Key::MetaRight => modifiers.meta = pressed,
        _ => {}
    }
}

#[cfg(target_os = "windows")]
fn trigger_if_matches(event: Event, app: &tauri::AppHandle) {
    let EventType::KeyPress(key) = event.event_type else {
        return;
    };

    let mut guard = match FALLBACK_STATE.lock() {
        Ok(lock) => lock,
        Err(_) => return,
    };

    if !guard.enabled {
        return;
    }
    let Some(shortcut) = guard.shortcut.clone() else {
        return;
    };
    if key != shortcut.key {
        return;
    }

    let mods = guard.modifiers;
    if (shortcut.ctrl && !mods.ctrl)
        || (shortcut.alt && !mods.alt)
        || (shortcut.shift && !mods.shift)
        || (shortcut.meta && !mods.meta)
    {
        return;
    }

    let now = Instant::now();
    if let Some(last_trigger_at) = guard.last_trigger_at {
        if now.duration_since(last_trigger_at) < Duration::from_millis(1200) {
            return;
        }
    }
    guard.last_trigger_at = Some(now);
    let payload = shortcut.shortcut;
    drop(guard);

    let _ = app.emit("desktop://fallback-hotkey", payload);
}

#[cfg(target_os = "windows")]
fn ensure_fallback_listener(app: tauri::AppHandle) {
    let mut state = match FALLBACK_STATE.lock() {
        Ok(lock) => lock,
        Err(_) => return,
    };
    if state.listener_started {
        return;
    }
    state.listener_started = true;
    drop(state);

    thread::spawn(move || {
        let app_handle = app.clone();
        let listener_result = listen(move |event| {
            match event.event_type {
                EventType::KeyPress(key) => {
                    if let Ok(mut lock) = FALLBACK_STATE.lock() {
                        update_modifier_state(&mut lock.modifiers, key, true);
                    }
                    trigger_if_matches(event, &app_handle);
                }
                EventType::KeyRelease(key) => {
                    if let Ok(mut lock) = FALLBACK_STATE.lock() {
                        update_modifier_state(&mut lock.modifiers, key, false);
                    }
                }
                _ => {}
            }
        });

        if let Err(error) = listener_result {
            eprintln!("fallback keyboard listener failed: {error:?}");
        }
    });
}

#[tauri::command]
fn set_fallback_hotkey(
    app: tauri::AppHandle,
    tray_menu_state: tauri::State<'_, TrayMenuState>,
    shortcut: String,
    enabled: bool,
) -> Result<(), String> {
    let hotkey_label = if enabled {
        format!("Hotkey: {shortcut}")
    } else {
        "Hotkey: Disabled".to_string()
    };
    let _ = tray_menu_state.hotkey_item.set_text(hotkey_label);

    #[cfg(target_os = "windows")]
    {
        let parsed = if enabled {
            Some(parse_shortcut(&shortcut)?)
        } else {
            None
        };
        if let Ok(mut lock) = FALLBACK_STATE.lock() {
            lock.enabled = enabled;
            lock.shortcut = parsed;
            lock.last_trigger_at = None;
            lock.modifiers = ModifierState::default();
        } else {
            return Err("Failed to access keyboard fallback state.".to_string());
        }
        ensure_fallback_listener(app);
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Fallback hotkey listener is only supported on Windows.".to_string())
}

#[tauri::command]
fn play_feedback_sound(kind: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match kind.as_str() {
            "capture" => unsafe {
                let _ = PlaySoundW(
                    w!("SystemDefault"),
                    None,
                    SND_ALIAS | SND_ASYNC | SND_NODEFAULT,
                );
            },
            "success" => unsafe {
                let _ = PlaySoundW(
                    w!("SystemAsterisk"),
                    None,
                    SND_ALIAS | SND_ASYNC | SND_NODEFAULT,
                );
            },
            "failure" => unsafe {
                let _ = PlaySoundW(
                    w!("SystemHand"),
                    None,
                    SND_ALIAS | SND_ASYNC | SND_NODEFAULT,
                );
            },
            _ => return Err(format!("Unsupported feedback sound kind: {kind}")),
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Feedback sounds are only supported on Windows.".to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureScreenshotResponse {
    image_base64: String,
    monitor_index: usize,
    monitor_name: String,
    saved_path: Option<String>,
    encoded_format: String,
    output_width: u32,
    output_height: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureMonitorDto {
    index: usize,
    id: u32,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    is_primary: bool,
    label: String,
}

#[tauri::command]
fn capture_monitor_png_base64(
    monitor_index: Option<usize>,
    save_debug_copy: Option<bool>,
) -> Result<CaptureScreenshotResponse, String> {
    #[cfg(target_os = "windows")]
    {
        let screens = Screen::all().map_err(|error| format!("Failed to enumerate screens: {error}"))?;
        if screens.is_empty() {
            return Err("No available screen was found for screenshot capture.".to_string());
        }

        let selected_monitor_index = monitor_index
            .or_else(|| {
                screens
                    .iter()
                    .position(|screen| screen.display_info.is_primary)
            })
            .unwrap_or(0);
        let Some(screen) = screens.get(selected_monitor_index) else {
            return Err(format!(
                "Invalid monitor index {selected_monitor_index}. Available monitors: {}",
                screens.len()
            ));
        };

        let captured = screen
            .capture()
            .map_err(|error| format!("Failed to capture screenshot: {error}"))?;

        let width = captured.width();
        let height = captured.height();
        let bgra = captured.into_raw();
        let mut rgba = Vec::with_capacity(bgra.len());
        for chunk in bgra.chunks_exact(4) {
            rgba.extend_from_slice(&[chunk[2], chunk[1], chunk[0], chunk[3]]);
        }

        let image: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(width, height, rgba)
            .ok_or_else(|| "Failed to construct PNG image buffer.".to_string())?;
        let dynamic = DynamicImage::ImageRgba8(image);
        let (source_width, source_height) = dynamic.dimensions();
        let max_dimension = 2560u32;
        let processed = if source_width > max_dimension || source_height > max_dimension {
            let ratio = if source_width >= source_height {
                max_dimension as f32 / source_width as f32
            } else {
                max_dimension as f32 / source_height as f32
            };
            let output_width = ((source_width as f32 * ratio).round() as u32).max(1);
            let output_height = ((source_height as f32 * ratio).round() as u32).max(1);
            dynamic.resize_exact(output_width, output_height, FilterType::Triangle)
        } else {
            dynamic
        };
        let (output_width, output_height) = processed.dimensions();
        let mut encoded_jpeg = Vec::<u8>::new();
        let mut encoder = JpegEncoder::new_with_quality(&mut encoded_jpeg, 88);
        encoder
            .encode_image(&processed)
            .map_err(|error| format!("Failed to encode screenshot to JPEG: {error}"))?;

        let save_debug_copy = save_debug_copy.unwrap_or(false);
        let saved_path = if save_debug_copy {
            let user_profile =
                std::env::var("USERPROFILE").map_err(|_| "USERPROFILE is missing".to_string())?;
            let save_dir = std::path::PathBuf::from(user_profile)
                .join("Desktop")
                .join("DFStashCaptures");
            std::fs::create_dir_all(&save_dir)
                .map_err(|error| format!("Failed to create debug capture folder: {error}"))?;
            let file_name = format!(
                "capture-monitor{}-{}.jpg",
                selected_monitor_index,
                chrono_like_timestamp()
            );
            let file_path = save_dir.join(file_name);
            std::fs::write(&file_path, &encoded_jpeg)
                .map_err(|error| format!("Failed to write debug screenshot: {error}"))?;
            Some(file_path.to_string_lossy().to_string())
        } else {
            None
        };

        return Ok(CaptureScreenshotResponse {
            image_base64: BASE64_STANDARD.encode(encoded_jpeg),
            monitor_index: selected_monitor_index,
            monitor_name: format!(
                "id={} {}x{} @{},{}{}",
                screen.display_info.id,
                screen.display_info.width,
                screen.display_info.height,
                screen.display_info.x,
                screen.display_info.y,
                if screen.display_info.is_primary {
                    " (primary)"
                } else {
                    ""
                }
            ),
            saved_path,
            encoded_format: "image/jpeg".to_string(),
            output_width,
            output_height,
        });
    }

    #[allow(unreachable_code)]
    Err("Screenshot capture is only supported on Windows.".to_string())
}

#[tauri::command]
fn list_capture_monitors() -> Result<Vec<CaptureMonitorDto>, String> {
    #[cfg(target_os = "windows")]
    {
        let screens = Screen::all().map_err(|error| format!("Failed to enumerate screens: {error}"))?;
        let list = screens
            .iter()
            .enumerate()
            .map(|(index, screen)| CaptureMonitorDto {
                index,
                id: screen.display_info.id,
                width: screen.display_info.width,
                height: screen.display_info.height,
                x: screen.display_info.x,
                y: screen.display_info.y,
                is_primary: screen.display_info.is_primary,
                label: format!(
                    "#{index} · {}x{} @{},{}{}",
                    screen.display_info.width,
                    screen.display_info.height,
                    screen.display_info.x,
                    screen.display_info.y,
                    if screen.display_info.is_primary {
                        " · primary"
                    } else {
                        ""
                    }
                ),
            })
            .collect::<Vec<_>>();
        return Ok(list);
    }

    #[allow(unreachable_code)]
    Err("Monitor listing is only supported on Windows.".to_string())
}

fn chrono_like_timestamp() -> String {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_else(|_| std::time::Duration::from_secs(0));
    format!("{}", duration.as_millis())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link()
                    .register_all()
                    .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            }

            #[cfg(desktop)]
            {
                let hotkey_item = MenuItem::with_id(
                    app,
                    "hotkey_info",
                    format!("Hotkey: {DEFAULT_TRAY_HOTKEY}"),
                    false,
                    None::<&str>,
                )?;
                let show_item = MenuItem::with_id(app, "show", "Show app", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let tray_menu = Menu::with_items(app, &[&hotkey_item, &show_item, &quit_item])?;

                app.manage(TrayMenuState {
                    hotkey_item: hotkey_item.clone(),
                });

                let tray_icon_rgba = image::load_from_memory(include_bytes!("../icons/32x32.png"))
                    .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?
                    .to_rgba8();
                let (tray_icon_width, tray_icon_height) = tray_icon_rgba.dimensions();
                let tray_icon =
                    Image::new_owned(tray_icon_rgba.into_raw(), tray_icon_width, tray_icon_height);

                TrayIconBuilder::with_id("main-tray")
                    .icon(tray_icon)
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            set_fallback_hotkey,
            play_feedback_sound,
            capture_monitor_png_base64,
            list_capture_monitors
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
