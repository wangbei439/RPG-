/**
 * 预测引擎 - 预生成可能的选项分支
 */
class PredictiveEngine {
    constructor(gameEngine) {
        this.engine = gameEngine;
        this.predictedBranches = new Map();
        this.predictionQueue = [];
        this.isProcessing = false;
    }

    /**
     * 预生成选项结果
     */
    async pregenerateChoices(currentState, choices) {
        if (!choices || choices.length === 0) return;

        // 清空旧的预测
        this.predictedBranches.clear();

        // 为每个选项创建预测任务
        for (const choice of choices) {
            this.predictionQueue.push({
                choice,
                state: JSON.parse(JSON.stringify(currentState))
            });
        }

        // 开始处理队列
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * 处理预测队列
     */
    async processQueue() {
        this.isProcessing = true;

        while (this.predictionQueue.length > 0) {
            const task = this.predictionQueue.shift();

            try {
                // 创建临时引擎实例
                const tempEngine = this.cloneEngine(task.state);

                // 生成结果
                const result = await tempEngine.processAction(task.choice);

                // 存储预测结果
                this.predictedBranches.set(task.choice, {
                    result,
                    timestamp: Date.now()
                });

                console.log(`预生成完成: ${task.choice}`);
            } catch (error) {
                console.error(`预生成失败: ${task.choice}`, error);
            }
        }

        this.isProcessing = false;
    }

    /**
     * 获取预测结果
     */
    getPrediction(choice) {
        const prediction = this.predictedBranches.get(choice);

        if (!prediction) return null;

        // 检查是否过期（超过5分钟）
        const age = Date.now() - prediction.timestamp;
        if (age > 5 * 60 * 1000) {
            this.predictedBranches.delete(choice);
            return null;
        }

        return prediction.result;
    }

    /**
     * 克隆引擎实例
     */
    cloneEngine(state) {
        const GameEngine = require('./GameEngine');
        const tempEngine = new GameEngine(
            this.engine.gameData,
            this.engine.config,
            {
                gameId: this.engine.gameId,
                memoryService: this.engine.memoryService
            }
        );

        tempEngine.state = JSON.parse(JSON.stringify(state));
        tempEngine.llm = this.engine.llm;

        return tempEngine;
    }

    /**
     * 清空预测缓存
     */
    clear() {
        this.predictedBranches.clear();
        this.predictionQueue = [];
    }
}

module.exports = PredictiveEngine;
