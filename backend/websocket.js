const { WebSocketServer } = require('ws');

/**
 * WebSocket 服务器模块
 * 用于向前端推送实时事件（如图像生成完成通知）
 */

let wss = null;

// gameId -> Set<WebSocket>
const gameSubscriptions = new Map();

// WebSocket -> Set<gameId>
const clientSubscriptions = new Map();

/**
 * 初始化 WebSocket 服务器，挂载到已有 HTTP server 上
 * @param {import('http').Server} server
 */
function initWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
        clientSubscriptions.set(ws, new Set());

        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());

                if (msg.type === 'subscribe' && msg.gameId) {
                    subscribeClient(ws, msg.gameId);
                } else if (msg.type === 'unsubscribe' && msg.gameId) {
                    unsubscribeClient(ws, msg.gameId);
                }
            } catch (err) {
                console.warn('WebSocket 收到无效消息:', err.message);
            }
        });

        ws.on('close', () => {
            cleanupClient(ws);
        });

        ws.on('error', (err) => {
            console.warn('WebSocket 连接错误:', err.message);
            cleanupClient(ws);
        });

        // 发送连接成功确认
        ws.send(JSON.stringify({ type: 'connected' }));
    });

    console.log('WebSocket 服务器已初始化 (/ws)');
}

/**
 * 将客户端订阅到指定游戏
 */
function subscribeClient(ws, gameId) {
    if (!gameSubscriptions.has(gameId)) {
        gameSubscriptions.set(gameId, new Set());
    }
    gameSubscriptions.get(gameId).add(ws);

    const subs = clientSubscriptions.get(ws);
    if (subs) {
        subs.add(gameId);
    }

    ws.send(JSON.stringify({ type: 'subscribed', gameId }));
}

/**
 * 取消客户端对指定游戏的订阅
 */
function unsubscribeClient(ws, gameId) {
    const subscribers = gameSubscriptions.get(gameId);
    if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
            gameSubscriptions.delete(gameId);
        }
    }

    const subs = clientSubscriptions.get(ws);
    if (subs) {
        subs.delete(gameId);
    }

    ws.send(JSON.stringify({ type: 'unsubscribed', gameId }));
}

/**
 * 客户端断开时清理所有订阅
 */
function cleanupClient(ws) {
    const subs = clientSubscriptions.get(ws);
    if (subs) {
        for (const gameId of subs) {
            const subscribers = gameSubscriptions.get(gameId);
            if (subscribers) {
                subscribers.delete(ws);
                if (subscribers.size === 0) {
                    gameSubscriptions.delete(gameId);
                }
            }
        }
        clientSubscriptions.delete(ws);
    }
}

/**
 * 向订阅了指定游戏的所有客户端广播消息
 * @param {string} gameId
 * @param {object} message
 */
function broadcastToGame(gameId, message) {
    const subscribers = gameSubscriptions.get(gameId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const payload = JSON.stringify(message);

    for (const ws of subscribers) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(payload);
        }
    }
}

/**
 * 广播图像生成完成通知
 * @param {string} gameId
 * @param {object} imageData - { imageUrl, prompt, visualState }
 */
function broadcastImageReady(gameId, imageData) {
    broadcastToGame(gameId, {
        type: 'image_ready',
        gameId,
        data: imageData
    });
}

/**
 * 广播游戏状态更新
 * @param {string} gameId
 * @param {object} updateData
 */
function broadcastGameUpdate(gameId, updateData) {
    broadcastToGame(gameId, {
        type: 'game_update',
        gameId,
        data: updateData
    });
}

/**
 * 获取当前 WebSocket 统计信息
 */
function getStats() {
    return {
        connectedClients: wss ? wss.clients.size : 0,
        activeGameSubscriptions: gameSubscriptions.size,
        subscriptions: Object.fromEntries(
            [...gameSubscriptions.entries()].map(([gameId, subs]) => [gameId, subs.size])
        )
    };
}

module.exports = {
    initWebSocket,
    broadcastToGame,
    broadcastImageReady,
    broadcastGameUpdate,
    getStats
};
