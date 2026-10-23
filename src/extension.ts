// Firefox's browser namespace provides promises; its chrome namespace uses callbacks.
// Chrome 120+ provides promises directly through chrome.storage.
export const extensionStorage = (typeof browser === 'undefined' ? chrome : browser).storage;
