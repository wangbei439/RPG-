const fs = require('fs');
const path = require('path');
const dbModule = require('../database');

/**
 * ProjectStore - Persistence layer for projects.
 *
 * Previously backed by individual JSON files, now uses SQLite via database.js.
 * The same API is preserved so server.js changes are minimal.
 * JSON file fallback is kept for backward-compatible migration on first load.
 */
class ProjectStore {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.migrated = false;
    }

    /**
     * Ensure the legacy JSON directory exists (used only for migration).
     */
    ensureDir() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Load all projects. Tries SQLite first; if the projects table is empty
     * and legacy JSON files exist, migrates them into the database.
     */
    loadAll() {
        const result = new Map();

        // Load from SQLite
        const projects = dbModule.loadAllProjects();
        for (const project of projects) {
            if (project && project.id) {
                result.set(project.id, project);
            }
        }

        // If the DB has no projects but legacy JSON files exist, migrate them
        if (result.size === 0) {
            this.migrateFromJsonFiles(result);
        } else {
            this.migrated = true;
        }

        return result;
    }

    /**
     * Migrate legacy JSON project files into the SQLite database.
     */
    migrateFromJsonFiles(result) {
        this.ensureDir();

        if (!fs.existsSync(this.baseDir)) {
            this.migrated = true;
            return;
        }

        const files = fs.readdirSync(this.baseDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'));

        if (files.length === 0) {
            this.migrated = true;
            return;
        }

        console.log(`[ProjectStore] Migrating ${files.length} project(s) from JSON files to SQLite...`);

        for (const file of files) {
            const fullPath = path.join(this.baseDir, file.name);
            try {
                const raw = fs.readFileSync(fullPath, 'utf8');
                const project = JSON.parse(raw);
                if (project && project.id) {
                    result.set(project.id, project);
                    dbModule.saveProject(project.id, project);
                }
            } catch (error) {
                console.warn(`[ProjectStore] Failed to migrate ${file.name}: ${error.message}`);
            }
        }

        this.migrated = true;
        console.log(`[ProjectStore] Migration complete. ${result.size} project(s) migrated.`);
    }

    /**
     * Save a project to SQLite.
     */
    save(project) {
        if (!project || !project.id) {
            return;
        }

        dbModule.saveProject(project.id, project);
    }

    /**
     * Remove a project from SQLite.
     */
    remove(projectId) {
        if (!projectId) {
            return;
        }

        dbModule.deleteProject(projectId);
    }
}

module.exports = ProjectStore;
