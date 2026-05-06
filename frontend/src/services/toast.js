/**
 * Toast notification service.
 *
 * Usage:
 *   import { showToast } from './services/toast.js';
 *   showToast('游戏已保存', 'success');
 *   showToast('保存失败', 'error', 5000);
 */

const TOAST_ICONS = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
};

const DEFAULT_DURATION = 4000; // ms

let container = null;

function getContainer() {
    if (!container) {
        container = document.getElementById('toast-container');
    }
    return container;
}

/**
 * Show a toast notification.
 *
 * @param {string} message  – The message to display.
 * @param {'success'|'error'|'info'|'warning'} type – Toast type.
 * @param {number} [duration] – Auto-dismiss duration in ms (default 4000).
 * @returns {{ dismiss: Function }} Handle with a .dismiss() method.
 */
export function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
    const containerEl = getContainer();
    if (!containerEl) {
        // Fallback: alert if container not found
        console.warn('[toast] No #toast-container found; falling back to alert.');
        alert(message);
        return { dismiss() {} };
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtmlSimple(message)}</span>
        <button class="toast-close" type="button">&times;</button>
    `;

    containerEl.appendChild(toast);

    let dismissed = false;

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        toast.classList.add('toast-dismiss');
        toast.addEventListener('animationend', () => {
            toast.remove();
        }, { once: true });
        // Fallback removal
        setTimeout(() => toast.remove(), 400);
    }

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', dismiss);

    // Auto-dismiss
    if (duration > 0) {
        setTimeout(dismiss, duration);
    }

    return { dismiss };
}

/**
 * Minimal HTML escaping to prevent XSS in toast messages.
 */
function escapeHtmlSimple(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
