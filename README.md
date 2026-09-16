# 文曲星游戏馆 · LavaX Web

A browser (WebAssembly) port of [AloysHF/LavaXEmu](https://github.com/AloysHF/LavaXEmu) —
a LavaX virtual machine for 文曲星 (Wenquxing) e-dictionary games — with gameplay fixes
and a multi-game web frontend with per-game saves.

**Play:** https://taloc758-ship-it.github.io/lavaxemu-web/

## Games included

13 classic Wenquxing Lava games (boot-tested in CI-like local run): 魔法纪元 / 新英雄坛说 /
易码事件簿 / 仙剑后传 / 三国志 / 勇者传说 / 冒险岛IV / 口袋·灰度版 / WarCraft / CS蓝色行动 /
坦克2004 / 俄罗斯方块·灰 / 五子连珠.

Game data files come from the community archive
[sbhhbs/lava_collection](https://github.com/sbhhbs/lava_collection); all rights belong to
their original authors.

## Patches over upstream LavaXEmu

1. **System timer (syscall 59)** — was derived from `frame_index`, so guest busy-wait
   loops never saw it advance and froze forever (e.g. 魔法纪元 after its loading screen).
   Now wall-clock based.
2. **Extended GetTickCount (syscall 83 / function 31)** — same frame-based problem, now
   wall-clock, matching the reference implementation (`GetTickCount()*0.256`).
3. **GetPID (extended function 0)** — returned 0; real hardware returns the platform
   signature `('L'<<24)|1 = 0x4C000001`. Games use it to detect the machine and silently
   `exit(0)` when it is wrong (魔法纪元 quit right after "Press Enter").
4. **minifb mouse panic (standalone)** — `get_mouse_pos(MouseMode::Clamp)` panics on a
   transient zero-size window during resize/minimize (`clamp(0.0, -1.0)`); guarded.
5. **WASM clock** — `std::time::Instant` is unimplemented on `wasm32-unknown-unknown`;
   the core now uses `js_sys::Date::now()` (via u64 to keep wrapping semantics) when
   built for wasm.

## Resource file layout (learned along the way)

Games look for companion data under `/LavaData/<name>.dat` in the virtual file system —
the emulator imports everything next to the `.lav` file, so keep the `LavaData/` folder
beside the program (or drop the whole game folder in).

## Run locally

```bash
python -m http.server 8014   # from this directory
# open http://127.0.0.1:8014/
```

Rebuild the WASM core:

```bash
cd src
cargo build --release -p lavaxemu-web --target wasm32-unknown-unknown
wasm-bindgen --out-dir ../pkg --target web target/wasm32-unknown-unknown/release/lavaxemu_web.wasm
```

## Layout

- `index.html`, `app.js`, `games.json` — web frontend (game list, canvas, per-game saves in localStorage)
- `games/<id>/` — game programs (`Lava/*.lav`) and data (`LavaData/*`)
- `pkg/` — wasm-bindgen output
- `src/` — patched emulator source (GPL-2.0-or-later, same as upstream)

## License

Emulator code: GPL-2.0-or-later (inherited from LavaXEmu). Game files belong to their
original authors and are provided via the community archive for preservation.
