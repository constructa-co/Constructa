"use client";

import { useMemo, useRef, useState } from "react";

/**
 * A reducer whose latest state can be read straight after a dispatch.
 *
 * Save and AI controllers run across awaits; they need the state as it is
 * when a reply arrives, not as it was when the request was sent.
 */
export function useReducerStore<S, A>(reducer: (state: S, action: A) => S, initial: () => S) {
    const [state, setState] = useState(initial);
    const latest = useRef(state);

    const store = useMemo(
        () => ({
            getState: () => latest.current,
            dispatch: (action: A) => {
                latest.current = reducer(latest.current, action);
                setState(latest.current);
            },
        }),
        [reducer],
    );

    return [state, store] as const;
}
