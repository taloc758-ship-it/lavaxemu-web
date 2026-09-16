//! Browser (WASM) frontend for the LavaX emulator core.
//!
//! Exposes a minimal machine interface: load a `.lav` program, import
//! companion data files into the virtual file system, run frames into an
//! RGBA buffer, feed keyboard/pointer input, and poll guest-written files
//! (saves) back to JavaScript for persistence.

use lavaxemu_core::{Emulator, FrameStatus, PointerState, Program};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WebEmu {
    emu: Emulator,
    width: usize,
    height: usize,
}

#[wasm_bindgen]
impl WebEmu {
    /// Loads a `.lav` program image.
    #[wasm_bindgen(constructor)]
    pub fn new(program: Vec<u8>) -> Result<WebEmu, JsError> {
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));
        let program = Program::load(&program).map_err(|e| JsError::new(&e.to_string()))?;
        let emu = Emulator::new(program);
        let width = usize::from(emu.display().width());
        let height = usize::from(emu.display().height());
        Ok(WebEmu { emu, width, height })
    }

    /// Imports a companion file into the virtual file system,
    /// e.g. `/LavaData/RPGSource.dat`.
    pub fn import_file(&mut self, path: String, data: Vec<u8>) {
        self.emu.files_mut().import_file(&path, data);
    }

    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    /// Runs one frame and writes RGBA8 pixels into `buf`
    /// (must be `width * height * 4` bytes).
    /// Returns 1 once the guest program has halted, else 0.
    pub fn frame(&mut self, buf: &mut [u8]) -> Result<i32, JsError> {
        let result = self.emu.run_frame().map_err(|e| JsError::new(&e.to_string()))?;
        let display = self.emu.display();
        let indexed = display.indexed_frame();
        let palette = display.palette();
        for (i, &color_index) in indexed.iter().enumerate() {
            let rgb = palette[usize::from(color_index)];
            let o = i * 4;
            buf[o] = rgb[0];
            buf[o + 1] = rgb[1];
            buf[o + 2] = rgb[2];
            buf[o + 3] = 0xFF;
        }
        Ok(matches!(result.status, FrameStatus::Halted(_)) as i32)
    }

    /// Replaces the set of currently pressed guest key codes.
    pub fn set_keys(&mut self, keys: Vec<u8>) {
        self.emu.input_mut().set_keys(keys);
    }

    pub fn set_pointer(&mut self, x: i16, y: i16, pressed: bool) {
        self.emu
            .input_mut()
            .set_pointer(Some(PointerState { x, y, pressed }));
    }

    pub fn clear_pointer(&mut self) {
        self.emu.input_mut().set_pointer(None);
    }

    pub fn reset(&mut self) {
        self.emu.reset();
    }

    /// Returns guest-modified files as `[[name, bytes], ...]` and clears
    /// their dirty flags, so the host can persist them (e.g. localStorage).
    pub fn poll_dirty_files(&mut self) -> Vec<JsValue> {
        self.emu
            .files_mut()
            .take_dirty_files()
            .into_iter()
            .map(|(name, data)| {
                let pair = js_sys::Array::new();
                pair.push(&JsValue::from_str(&name));
                pair.push(&js_sys::Uint8Array::from(data.as_slice()));
                pair.into()
            })
            .collect()
    }
}
