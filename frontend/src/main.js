/**
 * 叙游工坊 (RPG Generator) – Application entry point.
 *
 * This file is a thin orchestrator that imports and initializes all modules.
 * All business logic lives in ./modules/* and ./services/*.
 */

import './styles/main.css';

// State & constants
import { state, API_BASE } from './modules/state.js';

// Navigation
import { initNavigation, showScreen } from './modules/navigation.js';

// ComfyUI & settings
import { initSettings } from './modules/comfyui.js';

// Settings & saved games
import { initSavedGames, loadSettings } from './modules/saved-games.js';

// Home screen
import { initHeroSection } from './modules/home.js';

// Config form
import { initConfigForm } from './modules/config.js';

// Import
import { initImportForm, initImportPreviewEditor } from './modules/import.js';

// Workbench
import { initWorkbench } from './modules/workbench.js';

// Game screen
import { initGameScreen } from './modules/game.js';

// Phase 4 – Achievements, Review, Share, Templates
import { initPhase4 } from './modules/phase4.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSavedGames();
    initSettings();
    initConfigForm();
    initImportForm();
    initImportPreviewEditor();
    initWorkbench();
    initGameScreen();
    initHeroSection();
    initPhase4();
    loadSettings();
});
