/**
 * WebSocket 客户端模块
 * 用于接收后端实时推送事件（如图像生成完成通知）
 */

export class GameWebSocket {
    constructor() {
        /** @type {WebSocket|null} */
        this.ws = null;
        this.gameId = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectBaseDelay = 1000; // 1s

        // 回调注册
        this._imageReadyCallbacks = [];
        this._gameUpdateCallbacks = [];
        this._onConnectCallbacks = [];
        this._onDisconnectCallbacks = [];
    }

    /**
     * 构建 WebSocket URL
     */
    _buildUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    /**
     * 连接到 WebSocket 服务器
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        try {
            const url = this._buildUrl();
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                console.log('[WebSocket] 已连接');

                // 重新订阅当前游戏
                if (this.gameId) {
                    this.subscribe(this.gameId);
                }

                this._onConnectCallbacks.forEach(cb => {
                    try { cb(); } catch (e) { console.warn('[WebSocket] onConnect callback error:', e); }
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this._handleMessage(msg);
                } catch (err) {
                    console.warn('[WebSocket] 消息解析失败:', err);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('[WebSocket] 连接关闭');

                this._onDisconnectCallbacks.forEach(cb => {
                    try { cb(); } catch (e) { console.warn('[WebSocket] onDisconnect callback error:', e); }
                });

                this._scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.warn('[WebSocket] 连接错误:', err);
                // onclose 会随后触发，处理重连
            };
        } catch (err) {
            console.warn('[WebSocket] 连接创建失败:', err);
            this._scheduleReconnect();
        }
    }

    /**
     * 处理收到的消息
     */
    _handleMessage(msg) {
        switch (msg.type) {
            case 'connected':
                // 连接确认
                break;

            case 'subscribed':
                console.log(`[WebSocket] 已订阅游戏: ${msg.gameId}`);
                break;

            case 'unsubscribed':
                console.log(`[WebSocket] 已取消订阅游戏: ${msg.gameId}`);
                break;

            case 'image_ready':
                this._imageReadyCallbacks.forEach(cb => {
                    try { cb(msg.data, msg.gameId); } catch (e) { console.warn('[WebSocket] imageReady callback error:', e); }
                });
                break;

            case 'game_update':
                this._gameUpdateCallbacks.forEach(cb => {
                    try { cb(msg.data, msg.gameId); } catch (e) { console.warn('[WebSocket] gameUpdate callback error:', e); }
                });
                break;

            default:
                // 未知消息类型，忽略
                break;
        }
    }

    /**
     * 订阅游戏更新
     * @param {string} gameId
     */
    subscribe(gameId) {
        this.gameId = gameId;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'subscribe', gameId }));
        }
    }

    /**
     * 注册图像生成完成回调
     * @param {function} callback - (imageData, gameId) => void
     */
    onImageReady(callback) {
        if (typeof callback === 'function') {
            this._imageReadyCallbacks.push(callback);
        }
    }

    /**
     * 注册游戏状态更新回调
     * @param {function} callback - (updateData, gameId) => void
     */
    onGameUpdate(callback) {
        if (typeof callback === 'function') {
            this._gameUpdateCallbacks.push(callback);
        }
    }

    /**
     * 注册连接成功回调
     * @param {function} callback
     */
    onConnect(callback) {
        if (typeof callback === 'function') {
            this._onConnectCallbacks.push(callback);
        }
    }

    /**
     * 注册断开连接回调
     * @param {function} callback
     */
    onDisconnect(callback) {
        if (typeof callback === 'function') {
            this._onDisconnectCallbacks.push(callback);
        }
    }

    /**
     * 自动重连
     */
    _scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WebSocket] 达到最大重连次数，停止重连');
            return;
        }

        const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`[WebSocket] ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.reconnectAttempts = this.maxReconnectAttempts; // 阻止自动重连

        if (this.ws) {
            this.ws.onclose = null; // 防止触发重连
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }

        this.connected = false;
        this.gameId = null;
        this._imageReadyCallbacks = [];
        this._gameUpdateCallbacks = [];
        this._onConnectCallbacks = [];
        this._onDisconnectCallbacks = [];
    }

    /**
     * 清理所有回调（不断开连接）
     */
    clearCallbacks() {
        this._imageReadyCallbacks = [];
        this._gameUpdateCallbacks = [];
        this._onConnectCallbacks = [];
        this._onDisconnectCallbacks = [];
    }
}

// 全局单例
let instance = null;

/**
 * 获取 WebSocket 客户端单例
 * @returns {GameWebSocket}
 */
export function getGameWebSocket() {
    if (!instance) {
        instance = new GameWebSocket();
    }
    return instance;
}
