/**
 * Serialises writes and coalesces queued values to the newest snapshot.
 * Every caller waiting on the active drain receives the final attempted result.
 */
export function createLatestWriteQueue<T, R>(write: (value: T) => Promise<R>) {
    let queued: T | undefined;
    let active: Promise<R> | null = null;

    return (value: T): Promise<R> => {
        queued = value;
        if (!active) {
            active = (async () => {
                let result: R | undefined;
                let lastError: unknown;
                while (queued !== undefined) {
                    const next = queued;
                    queued = undefined;
                    try {
                        result = await write(next);
                        lastError = undefined;
                    } catch (error) {
                        lastError = error;
                        // A newer snapshot may have arrived while this write was
                        // in flight. Keep draining so that transient failures do
                        // not strand the user's latest state in memory.
                        if (queued === undefined) throw error;
                    }
                }
                if (lastError !== undefined) throw lastError;
                return result as R;
            })().finally(() => {
                active = null;
            });
        }
        return active;
    };
}
