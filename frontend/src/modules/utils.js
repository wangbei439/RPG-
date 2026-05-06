/**
 * Shared utility functions.
 */

import { normalizeGenerationConfig as normalizeFromSettings } from '../services/settings.js';
import { state } from './state.js';

export function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function escapeAttribute(value) {
    return escapeHtml(value)
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

/**
 * Normalize a generation config object.
 * Delegates to the settings service for field-level defaults,
 * then applies legacy compatibility patches.
 */
export function normalizeGenerationConfig(config = {}) {
    const normalized = normalizeFromSettings(config);

    if (!normalized.comfyuiUrl || normalized.comfyuiUrl === 'http://127.0.0.1:8188') {
        normalized.comfyuiUrl = 'http://127.0.0.1:8000';
    }

    if (!normalized.imageGenerationMode) {
        normalized.imageGenerationMode = 'manual';
    }

    if (!normalized.comfyuiWorkflowMode) {
        normalized.comfyuiWorkflowMode = 'custom';
    }

    if (!normalized.comfyuiImageCount) {
        normalized.comfyuiImageCount = '1';
    }

    return normalized;
}

export function populateSelect(selectId, values, preferredValue) {
    const select = document.getElementById(selectId);
    if (!select || !Array.isArray(values) || values.length === 0) {
        return;
    }

    const currentValue = preferredValue || select.value;
    select.innerHTML = values
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join('');

    if (values.includes(currentValue)) {
        select.value = currentValue;
    }
}

export function getEffectiveGenerationConfig() {
    if (state.currentGenerationConfig) {
        return normalizeGenerationConfig(state.currentGenerationConfig);
    }

    const collected = normalizeGenerationConfig({});
    state.currentGenerationConfig = collected;
    return collected;
}

export function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Empty preview item creators (used by import.js)
// ---------------------------------------------------------------------------

export function createEmptyPreviewCharacter(index = 0) {
    return {
        id: `draft_char_${Date.now()}_${index}`,
        name: '',
        role: '',
        description: ''
    };
}

export function createEmptyPreviewChapter(index = 0) {
    return {
        id: `draft_chapter_${Date.now()}_${index}`,
        title: `新章节 ${index + 1}`,
        summary: ''
    };
}

export function createEmptyPreviewLocation(index = 0) {
    return {
        id: `draft_location_${Date.now()}_${index}`,
        name: '',
        description: ''
    };
}
