export const BEFORE_PROJECT_NAVIGATION = "constructa:before-project-navigation";

/** Let the active editor cancel before the picker changes URL or selection. */
export function requestProjectNavigation(): boolean {
    return window.dispatchEvent(new Event(BEFORE_PROJECT_NAVIGATION, { cancelable: true }));
}
