use std::collections::{BTreeSet, VecDeque};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PointerState {
    pub x: i16,
    pub y: i16,
    pub pressed: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InputState {
    pressed: BTreeSet<u8>,
    queued: VecDeque<u8>,
    pointer: Option<PointerState>,
    #[serde(default)]
    repeat_phase: u32,
}

/// Firmware-style key auto-repeat: real devices re-deliver a held key.
const REPEAT_DELAY_FRAMES: u32 = 12; // ~200 ms before repeats start
const REPEAT_RATE_FRAMES: u32 = 5; // ~83 ms between repeats

impl InputState {
    pub fn set_key(&mut self, key: u8, pressed: bool) {
        let key = key & 0x7f;
        if pressed {
            if self.pressed.insert(key) {
                self.queued.push_back(key);
                self.repeat_phase = 0;
            }
        } else {
            if self.pressed.remove(&key) {
                self.repeat_phase = 0;
            }
        }
    }

    pub fn set_keys(&mut self, keys: impl IntoIterator<Item = u8>) {
        let next: BTreeSet<u8> = keys.into_iter().map(|key| key & 0x7f).collect();
        let changed = next != self.pressed;
        for &key in next.difference(&self.pressed) {
            self.queued.push_back(key);
        }
        self.pressed = next;
        if changed {
            self.repeat_phase = 0;
        }
    }

    /// Auto-repeat pump, called once per emulated frame: while keys are
    /// held, re-deliver them into the event queue like real firmware.
    pub fn tick_repeat(&mut self) {
        if self.pressed.is_empty() {
            self.repeat_phase = 0;
            return;
        }
        self.repeat_phase = self.repeat_phase.saturating_add(1);
        if self.repeat_phase >= REPEAT_DELAY_FRAMES
            && (self.repeat_phase - REPEAT_DELAY_FRAMES) % REPEAT_RATE_FRAMES == 0
        {
            for &key in &self.pressed {
                self.queued.push_back(key);
            }
        }
    }

    /// Remove one queued press of `key` if present (event-style check).
    pub fn drain_key(&mut self, key: u8) -> bool {
        if let Some(pos) = self.queued.iter().position(|&k| k == key) {
            self.queued.remove(pos);
            true
        } else {
            false
        }
    }

    /// Pop the oldest queued press regardless of which key it is.
    pub fn pop_any_key(&mut self) -> Option<u8> {
        self.queued.pop_front()
    }

    pub fn is_pressed(&self, key: u8) -> bool {
        self.pressed.contains(&(key & 0x7f))
    }

    pub fn first_pressed(&self) -> Option<u8> {
        self.pressed.first().copied()
    }

    pub fn pop_key(&mut self) -> Option<u8> {
        self.queued.pop_front()
    }

    pub fn release(&mut self, key: u8) {
        self.pressed.remove(&(key & 0x7f));
    }

    pub fn release_all(&mut self) {
        self.pressed.clear();
        self.queued.clear();
    }

    pub fn set_pointer(&mut self, pointer: Option<PointerState>) {
        self.pointer = pointer;
    }

    pub const fn pointer(&self) -> Option<PointerState> {
        self.pointer
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queues_only_new_key_presses() {
        let mut input = InputState::default();
        input.set_keys(*b"AB");
        assert_eq!(input.pop_key(), Some(b'A'));
        assert_eq!(input.pop_key(), Some(b'B'));
        input.set_keys(*b"AB");
        assert_eq!(input.pop_key(), None);
        input.set_keys(*b"BC");
        assert_eq!(input.pop_key(), Some(b'C'));
    }
}
