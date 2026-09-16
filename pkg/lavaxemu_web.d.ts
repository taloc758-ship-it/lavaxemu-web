/* tslint:disable */
/* eslint-disable */

export class WebEmu {
    free(): void;
    [Symbol.dispose](): void;
    clear_pointer(): void;
    /**
     * Runs one frame and writes RGBA8 pixels into `buf`
     * (must be `width * height * 4` bytes).
     * Returns 1 once the guest program has halted, else 0.
     */
    frame(buf: Uint8Array): number;
    height(): number;
    /**
     * Imports a companion file into the virtual file system,
     * e.g. `/LavaData/RPGSource.dat`.
     */
    import_file(path: string, data: Uint8Array): void;
    /**
     * Loads a `.lav` program image.
     */
    constructor(program: Uint8Array);
    /**
     * Returns guest-modified files as `[[name, bytes], ...]` and clears
     * their dirty flags, so the host can persist them (e.g. localStorage).
     */
    poll_dirty_files(): any[];
    reset(): void;
    /**
     * Replaces the set of currently pressed guest key codes.
     */
    set_keys(keys: Uint8Array): void;
    set_pointer(x: number, y: number, pressed: boolean): void;
    width(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_webemu_free: (a: number, b: number) => void;
    readonly webemu_clear_pointer: (a: number) => void;
    readonly webemu_frame: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly webemu_height: (a: number) => number;
    readonly webemu_import_file: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly webemu_new: (a: number, b: number, c: number) => void;
    readonly webemu_poll_dirty_files: (a: number, b: number) => void;
    readonly webemu_reset: (a: number) => void;
    readonly webemu_set_keys: (a: number, b: number, c: number) => void;
    readonly webemu_set_pointer: (a: number, b: number, c: number, d: number) => void;
    readonly webemu_width: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
