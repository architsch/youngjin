import { useCallback, useRef, useState } from "react";

// A run of edits to one field (a slider drag, typing) within this long of each other is one undo step.
const COALESCE_WINDOW_MS = 1000;
const MAX_UNDO_STEPS = 500;

// Undoable state. An update is given the present rather than capturing it, so edits made in one tick
// don't overwrite each other.
export default function useHistory<T>(initial: T)
{
    const [state, setState] = useState({past: [] as T[], present: initial, future: [] as T[]});
    const lastCommit = useRef<{coalesceKey?: string, time: number}>({time: 0});

    const commit = useCallback((update: (present: T) => T, coalesceKey?: string) => {
        const now = performance.now();
        const coalesce = coalesceKey != undefined && coalesceKey == lastCommit.current.coalesceKey
            && now - lastCommit.current.time < COALESCE_WINDOW_MS;
        lastCommit.current = {coalesceKey, time: now};
        setState(s => {
            const next = update(s.present);
            if (next === s.present)
                return s;
            return {
                past: coalesce ? s.past : [...s.past, s.present].slice(-MAX_UNDO_STEPS),
                present: next,
                future: [],
            };
        });
    }, []);

    const undo = useCallback(() => {
        lastCommit.current = {time: 0};
        setState(s => (s.past.length == 0) ? s : {
            past: s.past.slice(0, -1),
            present: s.past[s.past.length - 1],
            future: [s.present, ...s.future],
        });
    }, []);

    const redo = useCallback(() => {
        lastCommit.current = {time: 0};
        setState(s => (s.future.length == 0) ? s : {
            past: [...s.past, s.present],
            present: s.future[0],
            future: s.future.slice(1),
        });
    }, []);

    const reset = useCallback((value: T) => {
        lastCommit.current = {time: 0};
        setState({past: [], present: value, future: []});
    }, []);

    return {
        present: state.present,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
        commit, undo, redo, reset,
    };
}
