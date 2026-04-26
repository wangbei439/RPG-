const fs = require('fs');
const path = require('path');

class ProjectStore {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.ensureDir();
    }

    ensureDir() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    getFilePath(projectId) {
        return path.join(this.baseDir, `${projectId}.json`);
    }

    loadAll() {
        this.ensureDir();
        const result = new Map();
        const files = fs.readdirSync(this.baseDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'));

        for (const file of files) {
            const fullPath = path.join(this.baseDir, file.name);
            try {
                const raw = fs.readFileSync(fullPath, 'utf8');
                const project = JSON.parse(raw);
                if (project && project.id) {
                    result.set(project.id, project);
                }
            } catch (error) {
                console.warn(`项目文件加载失败，已跳过：${file.name} (${error.message})`);
            }
        }

        return result;
    }

    save(project) {
        if (!project || !project.id) {
            return;
        }

        this.ensureDir();
        fs.writeFileSync(
            this.getFilePath(project.id),
            JSON.stringify(project, null, 2),
            'utf8'
        );
    }

    remove(projectId) {
        if (!projectId) {
            return;
        }

        const filePath = this.getFilePath(projectId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

module.exports = ProjectStore;
