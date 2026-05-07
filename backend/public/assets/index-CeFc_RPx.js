(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&a(s)}).observe(document,{childList:!0,subtree:!0});function n(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(i){if(i.ep)return;i.ep=!0;const o=n(i);fetch(i.href,o)}})();const dn="/api",It="rpg_generator_settings",ue="rpg_generator_generation_settings",r={currentGameType:null,currentProjectId:null,currentProjectData:null,currentGameId:null,currentGameData:null,gameState:null,currentGenerationConfig:null,currentSessionId:null,currentStepId:null,allSteps:[],stepStates:{},sceneImages:[],selectedSceneImageIndex:0,lastSuggestedImagePrompt:"",activeSceneImage:"",transitioningSceneImage:"",currentVisualSignature:"",sceneImageTransitionToken:0,runtimeSnapshotTimer:null,runtimeSnapshotSaving:!1},pe={adventure:"冒险 RPG",dungeon:"地牢探索",romance:"恋爱模拟",mystery:"推理解谜",fantasy:"奇幻魔法",scifi:"科幻星际",survival:"生存挑战",kingdom:"王国建设",cultivation:"修仙问道",custom:"自定义 RPG"},mn={faithful:"忠于原著",balanced:"平衡改编",free:"高自由互动"},K={worldview:{icon:"世",name:"世界观",desc:"先确定世界背景、主要势力、地点与规则。"},coreCharacters:{icon:"核",name:"核心角色",desc:"生成推动主线的关键角色。"},secondaryCharacters:{icon:"辅",name:"次要角色",desc:"补充世界细节与互动节点。"},items:{icon:"物",name:"物品道具",desc:"生成装备、任务物品和关键奖励。"},puzzles:{icon:"谜",name:"谜题挑战",desc:"设计挑战、机关和探索障碍。"},mainPlot:{icon:"主",name:"主线剧情",desc:"组织章节推进与核心冲突。"},sidePlots:{icon:"支",name:"支线剧情",desc:"补充可选故事和人物支线。"},fragments:{icon:"碎",name:"碎片内容",desc:"生成可探索的世界细节与传闻。"},integration:{icon:"整",name:"整合方案",desc:"把已确认内容整合成最终可玩的方案。"}};function M(e){return r.stepStates[e]||(r.stepStates[e]={candidates:[],selectedIndex:-1,status:"idle",history:[]}),r.stepStates[e]}const un="modulepreload",pn=function(e){return"/"+e},pt={},L=function(t,n,a){let i=Promise.resolve();if(n&&n.length>0){document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),d=(s==null?void 0:s.nonce)||(s==null?void 0:s.getAttribute("nonce"));i=Promise.allSettled(n.map(m=>{if(m=pn(m),m in pt)return;pt[m]=!0;const c=m.endsWith(".css"),u=c?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${m}"]${u}`))return;const g=document.createElement("link");if(g.rel=c?"stylesheet":un,c||(g.as="script"),g.crossOrigin="",g.href=m,d&&g.setAttribute("nonce",d),document.head.appendChild(g),c)return new Promise((h,b)=>{g.addEventListener("load",h),g.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${m}`)))})}))}function o(s){const d=new Event("vite:preloadError",{cancelable:!0});if(d.payload=s,window.dispatchEvent(d),!d.defaultPrevented)throw s}return i.then(s=>{for(const d of s||[])d.status==="rejected"&&o(d.reason);return t().catch(o)})};class fn{constructor(){this.ws=null,this.gameId=null,this.connected=!1,this.reconnectTimer=null,this.reconnectAttempts=0,this.maxReconnectAttempts=10,this.reconnectBaseDelay=1e3,this._imageReadyCallbacks=[],this._gameUpdateCallbacks=[],this._onConnectCallbacks=[],this._onDisconnectCallbacks=[]}_buildUrl(){return`${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/ws`}connect(){if(!(this.ws&&(this.ws.readyState===WebSocket.CONNECTING||this.ws.readyState===WebSocket.OPEN)))try{const t=this._buildUrl();this.ws=new WebSocket(t),this.ws.onopen=()=>{this.connected=!0,this.reconnectAttempts=0,console.log("[WebSocket] 已连接"),this.gameId&&this.subscribe(this.gameId),this._onConnectCallbacks.forEach(n=>{try{n()}catch(a){console.warn("[WebSocket] onConnect callback error:",a)}})},this.ws.onmessage=n=>{try{const a=JSON.parse(n.data);this._handleMessage(a)}catch(a){console.warn("[WebSocket] 消息解析失败:",a)}},this.ws.onclose=()=>{this.connected=!1,console.log("[WebSocket] 连接关闭"),this._onDisconnectCallbacks.forEach(n=>{try{n()}catch(a){console.warn("[WebSocket] onDisconnect callback error:",a)}}),this._scheduleReconnect()},this.ws.onerror=n=>{console.warn("[WebSocket] 连接错误:",n)}}catch(t){console.warn("[WebSocket] 连接创建失败:",t),this._scheduleReconnect()}}_handleMessage(t){switch(t.type){case"connected":break;case"subscribed":console.log(`[WebSocket] 已订阅游戏: ${t.gameId}`);break;case"unsubscribed":console.log(`[WebSocket] 已取消订阅游戏: ${t.gameId}`);break;case"image_ready":this._imageReadyCallbacks.forEach(n=>{try{n(t.data,t.gameId)}catch(a){console.warn("[WebSocket] imageReady callback error:",a)}});break;case"game_update":this._gameUpdateCallbacks.forEach(n=>{try{n(t.data,t.gameId)}catch(a){console.warn("[WebSocket] gameUpdate callback error:",a)}});break}}subscribe(t){this.gameId=t,this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify({type:"subscribe",gameId:t}))}onImageReady(t){typeof t=="function"&&this._imageReadyCallbacks.push(t)}onGameUpdate(t){typeof t=="function"&&this._gameUpdateCallbacks.push(t)}onConnect(t){typeof t=="function"&&this._onConnectCallbacks.push(t)}onDisconnect(t){typeof t=="function"&&this._onDisconnectCallbacks.push(t)}_scheduleReconnect(){if(this.reconnectTimer)return;if(this.reconnectAttempts>=this.maxReconnectAttempts){console.log("[WebSocket] 达到最大重连次数，停止重连");return}const t=this.reconnectBaseDelay*Math.pow(2,this.reconnectAttempts);this.reconnectAttempts++,console.log(`[WebSocket] ${t}ms 后尝试第 ${this.reconnectAttempts} 次重连...`),this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null,this.connect()},t)}disconnect(){this.reconnectTimer&&(clearTimeout(this.reconnectTimer),this.reconnectTimer=null),this.reconnectAttempts=this.maxReconnectAttempts,this.ws&&(this.ws.onclose=null,this.ws.onerror=null,this.ws.close(),this.ws=null),this.connected=!1,this.gameId=null,this._imageReadyCallbacks=[],this._gameUpdateCallbacks=[],this._onConnectCallbacks=[],this._onDisconnectCallbacks=[]}clearCallbacks(){this._imageReadyCallbacks=[],this._gameUpdateCallbacks=[],this._onConnectCallbacks=[],this._onDisconnectCallbacks=[]}}let we=null;function _e(){return we||(we=new fn),we}function k(e){var t;document.querySelectorAll(".screen").forEach(n=>n.classList.remove("active")),(t=document.getElementById(e))==null||t.classList.add("active")}function le(){k("home-screen"),document.getElementById("game-types-section").style.display="block",document.getElementById("examples-section").style.display="none"}function j(e,t){const n=document.getElementById("api-status-dot"),a=document.getElementById("api-status-text");n&&(n.className="status-dot",n.classList.add(`status-${e}`)),a&&(a.textContent=t)}function Se(e,t,n=""){const a=document.getElementById("progress-fill"),i=document.getElementById("loading-status"),o=document.getElementById("loading-details");a&&(a.style.width=`${e}%`),i&&(i.textContent=t),o&&(o.textContent=n)}function Et(){var e,t,n;document.querySelectorAll(".type-card").forEach(a=>{a.addEventListener("click",()=>{r.currentGameType=a.dataset.type,r.currentProjectId=null,r.currentProjectData=null,document.querySelectorAll(".type-card").forEach(i=>i.classList.remove("selected")),a.classList.add("selected"),document.getElementById("config-title").textContent=`配置你的${pe[r.currentGameType]||"RPG"}游戏`,k("config-screen")})}),document.getElementById("back-to-home").addEventListener("click",()=>{le()}),(e=document.getElementById("back-from-import"))==null||e.addEventListener("click",()=>{le()}),(t=document.getElementById("back-to-import-edit"))==null||t.addEventListener("click",()=>k("import-screen")),(n=document.getElementById("confirm-import-preview"))==null||n.addEventListener("click",async()=>{const{startImportedProjectSession:a}=await L(async()=>{const{startImportedProjectSession:i}=await Promise.resolve().then(()=>Kt);return{startImportedProjectSession:i}},void 0);await a()}),document.getElementById("gen-back-to-config").addEventListener("click",()=>{k(r.currentProjectId?"import-screen":"config-screen")}),document.getElementById("exit-game").addEventListener("click",()=>{if(confirm("确定退出当前游戏吗？未保存进度将会丢失。")){L(()=>Promise.resolve().then(()=>se),void 0).then(i=>{i.stopAutoSaveTimer&&i.stopAutoSaveTimer()}).catch(()=>{});const a=_e();a.clearCallbacks(),a.disconnect(),r.currentGameId=null,r.gameState=null,le()}})}const gn=Object.freeze(Object.defineProperty({__proto__:null,initNavigation:Et,setApiStatus:j,showHomeScreen:le,showScreen:k,updateProgress:Se},Symbol.toStringTag,{value:"Module"})),yn=`${window.location.origin}/api`,vn=window.localStorage.getItem("rpg_generator_api_base")||"",St=(vn||yn).replace(/\/$/,""),bn="rpg_auth_token";function hn(){return window.localStorage.getItem(bn)||""}function Ce(e={}){const t=hn();if(t){const n={...e.headers||{},Authorization:`Bearer ${t}`};return{...e,headers:n}}return e}async function kt(e){try{const t=await e.json();return(t==null?void 0:t.error)||(t==null?void 0:t.message)||`${e.status} ${e.statusText}`}catch{return`${e.status} ${e.statusText}`}}async function p(e,t={}){const n=await fetch(`${St}${e}`,Ce(t));if(!n.ok)throw new Error(await kt(n));return n.json()}async function wn(e,t={},n=null){const a=await fetch(`${St}${e}`,Ce(t));if(!a.ok)throw new Error(await kt(a));const i=a.headers.get("content-type");return i&&i.includes("text/event-stream")?await In(a,n):a.json()}async function In(e,t){const n=e.body.getReader(),a=new TextDecoder;let i="",o=null;for(;;){const{done:s,value:d}=await n.read();if(s)break;i+=a.decode(d,{stream:!0});const m=i.split(`
`);i=m.pop()||"";for(const c of m)if(!(!c.trim()||!c.startsWith("data: ")))try{const u=JSON.parse(c.slice(6));if(u.type==="progress"&&t)t(u.percent,u.message);else if(u.type==="complete")o=u;else if(u.type==="error")throw new Error(u.message||"解析失败")}catch(u){throw u.message!=="解析失败"&&console.warn("Failed to parse SSE message:",c,u),u}}if(!o)throw new Error("未收到完整的响应数据");return o}function v(e,t){const n={method:e,headers:{"Content-Type":"application/json"},body:JSON.stringify(t)};return Ce(n)}const Bt={openai:{apiUrl:{id:"openai-url",fallback:"https://api.openai.com/v1"},apiKey:{id:"openai-key"},model:{id:"openai-model",fallback:"gpt-4o"}},anthropic:{apiKey:{id:"anthropic-key"},model:{id:"anthropic-model",fallback:"claude-3-5-sonnet-20241022"}},local:{apiUrl:{id:"ollama-url",fallback:"http://localhost:11434"},model:{id:"ollama-model",fallback:"llama3"}},custom:{apiUrl:{id:"custom-url"},apiKey:{id:"custom-key"},model:{id:"custom-model"}}},je={difficulty:{id:"game-difficulty",fallback:"normal"},length:{id:"game-length",fallback:"medium"},enableImages:{id:"enable-images",type:"checkbox",fallback:!0},imageSource:{id:"image-source",fallback:"comfyui"},imageGenerationMode:{id:"image-generation-mode",fallback:"manual"},comfyuiUrl:{id:"comfyui-url",fallback:"http://127.0.0.1:8000"},comfyuiImageCount:{id:"comfyui-image-count",fallback:"1"},comfyuiModel:{id:"comfyui-model",fallback:""},comfyuiSampler:{id:"comfyui-sampler",fallback:"euler"},comfyuiScheduler:{id:"comfyui-scheduler",fallback:"normal"},comfyuiWidth:{id:"comfyui-width",fallback:"768"},comfyuiHeight:{id:"comfyui-height",fallback:"512"},comfyuiSteps:{id:"comfyui-steps",fallback:"20"},comfyuiCfg:{id:"comfyui-cfg",fallback:"7.5"},comfyuiSeed:{id:"comfyui-seed",fallback:"-1"},comfyuiTimeoutMs:{id:"comfyui-timeout-ms",fallback:"180000"},comfyuiPromptPrefix:{id:"comfyui-prompt-prefix",fallback:"RPG game scene"},comfyuiPromptSuffix:{id:"comfyui-prompt-suffix",fallback:"high quality, detailed, fantasy art style"},comfyuiNegativePrompt:{id:"comfyui-negative-prompt",fallback:"low quality, blurry, deformed, ugly, bad anatomy, watermark, text"},comfyuiFilenamePrefix:{id:"comfyui-filename-prefix",fallback:"rpg_scene"},comfyuiWorkflowMode:{id:"comfyui-workflow-mode",fallback:"custom"},comfyuiWorkflowFile:{id:"comfyui-workflow-file",fallback:""},comfyuiWorkflowJson:{id:"comfyui-workflow-json",fallback:""},imageApiUrl:{id:"image-api-url",fallback:""},imageApiKey:{id:"image-api-key",fallback:""}};function En(e,t){var n;return((n=t.getElementById(e))==null?void 0:n.value)||""}function Sn(e,t){const n=t.getElementById(e.id);return n?e.type==="checkbox"?n.checked:n.value||e.fallback||"":e.fallback}function kn(e,t,n){const a=n.getElementById(e);a&&t!==void 0&&(a.value=t)}function Bn(e,t,n){const a=n.getElementById(e.id);if(!(!a||t===void 0)){if(e.type==="checkbox"){a.checked=!!t;return}a.value=t}}function q(e=null,t=document){const n=e||t.getElementById("llm-source").value,a=Bt[n]||{},i={llmSource:n};for(const[o,s]of Object.entries(a))i[o]=En(s.id,t)||s.fallback||"";return i}function $n(e,t=document){const n=e.llmSource||"openai";t.getElementById("llm-source").value=n,t.getElementById("llm-source").dispatchEvent(new Event("change"));const a=Bt[n]||{};for(const[i,o]of Object.entries(a))kn(o.id,e[i]||o.fallback||"",t)}function Z(e=document){const t={settings:q(null,e)};for(const[n,a]of Object.entries(je))t[n]=Sn(a,e);return t}function ft(e={},t=document){for(const[n,a]of Object.entries(je))Bn(a,e[n]??a.fallback,t)}function Ln(e={}){const t={};for(const[n,a]of Object.entries(je))t[n]=e[n]??a.fallback;return e.settings&&(t.settings=e.settings),t}function l(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}function B(e){return l(e).replaceAll('"',"&quot;").replaceAll("'","&#39;")}function $t(e){return JSON.parse(JSON.stringify(e||{}))}function x(e={}){const t=Ln(e);return(!t.comfyuiUrl||t.comfyuiUrl==="http://127.0.0.1:8188")&&(t.comfyuiUrl="http://127.0.0.1:8000"),t.imageGenerationMode||(t.imageGenerationMode="manual"),t.comfyuiWorkflowMode||(t.comfyuiWorkflowMode="custom"),t.comfyuiImageCount||(t.comfyuiImageCount="1"),t}function J(e,t,n){const a=document.getElementById(e);if(!a||!Array.isArray(t)||t.length===0)return;const i=n||a.value;a.innerHTML=t.map(o=>`<option value="${l(o)}">${l(o)}</option>`).join(""),t.includes(i)&&(a.value=i)}function _(){if(r.currentGenerationConfig)return x(r.currentGenerationConfig);const e=x({});return r.currentGenerationConfig=e,e}function Pn(e,t){const n=new Blob([JSON.stringify(t,null,2)],{type:"application/json;charset=utf-8"}),a=URL.createObjectURL(n),i=document.createElement("a");i.href=a,i.download=e,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(a)}function Lt(e=0){return{id:`draft_char_${Date.now()}_${e}`,name:"",role:"",description:""}}function Pt(e=0){return{id:`draft_chapter_${Date.now()}_${e}`,title:`新章节 ${e+1}`,summary:""}}function Tt(e=0){return{id:`draft_location_${Date.now()}_${e}`,name:"",description:""}}const Tn=Object.freeze(Object.defineProperty({__proto__:null,cloneJson:$t,createEmptyPreviewChapter:Pt,createEmptyPreviewCharacter:Lt,createEmptyPreviewLocation:Tt,downloadJsonFile:Pn,escapeAttribute:B,escapeHtml:l,getEffectiveGenerationConfig:_,normalizeGenerationConfig:x,populateSelect:J},Symbol.toStringTag,{value:"Module"}));function _n(){const e=document.getElementById("comfyui-settings");!e||e.dataset.enhanced==="true"||(e.innerHTML=`
        <div class="sub-config-row">
            <input type="text" id="comfyui-url" data-generation-setting="true" placeholder="ComfyUI 地址（默认：http://127.0.0.1:8000）" value="http://127.0.0.1:8000" />
            <button type="button" id="refresh-comfyui-btn" class="test-btn">刷新模型</button>
            <button type="button" id="test-comfyui-btn" class="test-btn">测试连接</button>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="image-generation-mode">生图模式</label>
                <select id="image-generation-mode" data-generation-setting="true">
                    <option value="manual">手动点击生成</option>
                    <option value="auto">每次行动后自动生成</option>
                </select>
            </div>
            <div>
                <label for="comfyui-image-count">出图数量</label>
                <input type="number" id="comfyui-image-count" data-generation-setting="true" value="1" min="1" max="8" />
            </div>
            <div>
                <label for="comfyui-workflow-mode">工作流模式</label>
                <select id="comfyui-workflow-mode" data-generation-setting="true">
                    <option value="custom">自定义 JSON</option>
                    <option value="default">默认模板</option>
                </select>
            </div>
        </div>
        <div class="helper-text">
            建议优先使用 <strong>自定义 JSON</strong>。系统只会把提示词和出图数量注入到你现有的 ComfyUI 工作流里。
        </div>
        <div id="comfyui-default-workflow-fields" style="display:none">
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-model">模型检查点</label>
                    <select id="comfyui-model" data-generation-setting="true">
                        <option value="">刷新后加载模型</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-sampler">采样器</label>
                    <select id="comfyui-sampler" data-generation-setting="true">
                        <option value="euler">euler</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-scheduler">调度器</label>
                    <select id="comfyui-scheduler" data-generation-setting="true">
                        <option value="normal">标准</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-width">宽度</label>
                    <input type="number" id="comfyui-width" data-generation-setting="true" value="768" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-height">高度</label>
                    <input type="number" id="comfyui-height" data-generation-setting="true" value="512" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-steps">采样步数</label>
                    <input type="number" id="comfyui-steps" data-generation-setting="true" value="20" min="1" max="150" />
                </div>
                <div>
                    <label for="comfyui-cfg">CFG</label>
                    <input type="number" id="comfyui-cfg" data-generation-setting="true" value="7.5" min="0.1" max="30" step="0.1" />
                </div>
                <div>
                    <label for="comfyui-seed">随机种子</label>
                    <input type="number" id="comfyui-seed" data-generation-setting="true" value="-1" />
                </div>
            </div>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="comfyui-timeout-ms">超时时间（毫秒）</label>
                <input type="number" id="comfyui-timeout-ms" data-generation-setting="true" value="180000" min="5000" step="1000" />
            </div>
            <div>
                <label for="comfyui-filename-prefix">文件名前缀</label>
                <input type="text" id="comfyui-filename-prefix" data-generation-setting="true" placeholder="输出文件名前缀" value="rpg_scene" />
            </div>
        </div>
        <div id="comfyui-custom-workflow">
            <div class="sub-config-row">
                <select id="comfyui-workflow-file" data-generation-setting="true">
                    <option value="">从工作流目录中选择文件</option>
                </select>
                <button type="button" id="refresh-workflow-files-btn" class="test-btn">刷新工作流</button>
                <button type="button" id="load-workflow-file-btn" class="test-btn">载入所选文件</button>
            </div>
            <textarea id="comfyui-workflow-json" data-generation-setting="true" rows="10" placeholder="在这里粘贴 ComfyUI 工作流 JSON。如果你的工作流已经带有 CLIPTextEncode 文本节点，后端会自动注入当前提示词。你也可以使用 {{prompt}}、{{raw_prompt}}、{{negative_prompt}}、{{batch_size}}、{{ckpt_name}} 等占位符。"></textarea>
            <div class="sub-config-actions">
                <button type="button" id="validate-workflow-btn" class="test-btn">校验工作流</button>
            </div>
        </div>
        <details id="comfyui-prompt-overrides">
            <summary>提示词辅助项</summary>
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-prompt-prefix">正向前缀</label>
                    <input type="text" id="comfyui-prompt-prefix" data-generation-setting="true" placeholder="例如：国风互动叙事场景" value="中文互动叙事场景" />
                </div>
                <div>
                    <label for="comfyui-prompt-suffix">正向后缀</label>
                    <input type="text" id="comfyui-prompt-suffix" data-generation-setting="true" placeholder="例如：高质量、细节丰富、电影感插画" value="高质量，细节丰富，电影感插画" />
                </div>
                <div>
                    <label for="comfyui-negative-prompt">反向提示词</label>
                    <input type="text" id="comfyui-negative-prompt" data-generation-setting="true" placeholder="不希望出现的内容" value="低质量，模糊，畸形，崩坏人体，水印，文字" />
                </div>
            </div>
        </details>
        <div id="comfyui-status" class="helper-text">尚未检查 ComfyUI 配置。</div>
    `,e.dataset.enhanced="true")}function Cn(){const e=document.getElementById("live-image-config");!e||e.dataset.enhanced==="true"||(e.innerHTML=`
        <div class="live-image-config-card">
            <div class="sub-config-row">
                <select id="live-comfyui-model">
                    <option value="">选择模型</option>
                </select>
                <select id="live-comfyui-workflow-file">
                    <option value="">选择工作流文件</option>
                </select>
                <button type="button" id="live-load-workflow-btn" class="test-btn">载入工作流</button>
            </div>
            <div class="sub-config-row">
                <button type="button" id="live-refresh-comfyui-btn" class="test-btn">刷新模型</button>
                <button type="button" id="live-refresh-workflow-files-btn" class="test-btn">刷新工作流</button>
                <button type="button" id="live-test-comfyui-btn" class="test-btn">测试 ComfyUI</button>
            </div>
            <details id="live-comfyui-settings">
                <summary>ComfyUI 实时配置</summary>
                <div class="sub-config-grid" style="margin-top:0.75rem">
                    <div>
                        <label for="live-comfyui-url">ComfyUI 地址</label>
                        <input type="text" id="live-comfyui-url" value="http://127.0.0.1:8000" />
                    </div>
                    <div>
                        <label for="live-comfyui-workflow-mode">工作流模式</label>
                        <select id="live-comfyui-workflow-mode">
                            <option value="custom">自定义工作流</option>
                            <option value="default">默认模板</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-sampler">采样器</label>
                        <select id="live-comfyui-sampler">
                            <option value="euler">euler</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-scheduler">调度器</label>
                        <select id="live-comfyui-scheduler">
                            <option value="normal">标准</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-width">宽度</label>
                        <input type="number" id="live-comfyui-width" value="768" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-height">高度</label>
                        <input type="number" id="live-comfyui-height" value="512" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-steps">采样步数</label>
                        <input type="number" id="live-comfyui-steps" value="20" min="1" max="150" />
                    </div>
                    <div>
                        <label for="live-comfyui-cfg">CFG</label>
                        <input type="number" id="live-comfyui-cfg" value="7.5" min="0.1" max="30" step="0.1" />
                    </div>
                    <div>
                        <label for="live-comfyui-seed">随机种子</label>
                        <input type="number" id="live-comfyui-seed" value="-1" />
                    </div>
                    <div>
                        <label for="live-comfyui-timeout-ms">超时时间（毫秒）</label>
                        <input type="number" id="live-comfyui-timeout-ms" value="180000" min="5000" step="1000" />
                    </div>
                </div>
                <div class="sub-config-grid">
                    <div>
                        <label for="live-comfyui-prompt-prefix">正向前缀</label>
                        <input type="text" id="live-comfyui-prompt-prefix" value="中文互动叙事场景" />
                    </div>
                    <div>
                        <label for="live-comfyui-prompt-suffix">正向后缀</label>
                        <input type="text" id="live-comfyui-prompt-suffix" value="高质量，细节丰富，电影感插画" />
                    </div>
                    <div>
                        <label for="live-comfyui-negative-prompt">反向提示词</label>
                        <input type="text" id="live-comfyui-negative-prompt" value="低质量，模糊，畸形，崩坏人体，水印，文字" />
                    </div>
                    <div>
                        <label for="live-comfyui-filename-prefix">文件名前缀</label>
                        <input type="text" id="live-comfyui-filename-prefix" value="rpg_scene" />
                    </div>
                </div>
                <div id="live-comfyui-custom-workflow" style="margin-top:0.75rem">
                    <textarea id="live-comfyui-workflow-json" rows="8" placeholder="这里会载入自定义工作流 JSON。"></textarea>
                    <div class="sub-config-actions">
                        <button type="button" id="live-validate-workflow-btn" class="test-btn">校验工作流</button>
                    </div>
                </div>
            </details>
            <div id="live-comfyui-status" class="helper-text">当前在接口出图模式下会直接调用生成按钮。切换到 ComfyUI 后，可以在这里细调模型和工作流。</div>
        </div>
    `,e.dataset.enhanced="true")}function _t(){const e=document.getElementById("comfyui-workflow-mode"),t=document.getElementById("comfyui-custom-workflow"),n=document.getElementById("comfyui-default-workflow-fields");if(!e||!t||!n)return;const a=e.value==="custom";t.style.display=a?"block":"none",n.style.display=a?"none":"block"}function jn(){const e=document.getElementById("live-comfyui-workflow-mode"),t=document.getElementById("live-comfyui-custom-workflow");!e||!t||(t.style.display=e.value==="custom"?"block":"none")}function fe(){var e,t,n,a,i,o,s,d,m,c,u,g,h,b,w,P,N,I;return{imageSource:_().imageSource,imageGenerationMode:_().imageGenerationMode,comfyuiUrl:((e=document.getElementById("live-comfyui-url"))==null?void 0:e.value)||"http://127.0.0.1:8000",comfyuiImageCount:((t=document.getElementById("scene-image-count"))==null?void 0:t.value)||"1",comfyuiModel:((n=document.getElementById("live-comfyui-model"))==null?void 0:n.value)||"",comfyuiSampler:((a=document.getElementById("live-comfyui-sampler"))==null?void 0:a.value)||"euler",comfyuiScheduler:((i=document.getElementById("live-comfyui-scheduler"))==null?void 0:i.value)||"normal",comfyuiWidth:((o=document.getElementById("live-comfyui-width"))==null?void 0:o.value)||"768",comfyuiHeight:((s=document.getElementById("live-comfyui-height"))==null?void 0:s.value)||"512",comfyuiSteps:((d=document.getElementById("live-comfyui-steps"))==null?void 0:d.value)||"20",comfyuiCfg:((m=document.getElementById("live-comfyui-cfg"))==null?void 0:m.value)||"7.5",comfyuiSeed:((c=document.getElementById("live-comfyui-seed"))==null?void 0:c.value)||"-1",comfyuiTimeoutMs:((u=document.getElementById("live-comfyui-timeout-ms"))==null?void 0:u.value)||"180000",comfyuiPromptPrefix:((g=document.getElementById("live-comfyui-prompt-prefix"))==null?void 0:g.value)||"",comfyuiPromptSuffix:((h=document.getElementById("live-comfyui-prompt-suffix"))==null?void 0:h.value)||"",comfyuiNegativePrompt:((b=document.getElementById("live-comfyui-negative-prompt"))==null?void 0:b.value)||"",comfyuiFilenamePrefix:((w=document.getElementById("live-comfyui-filename-prefix"))==null?void 0:w.value)||"",comfyuiWorkflowMode:((P=document.getElementById("live-comfyui-workflow-mode"))==null?void 0:P.value)||"custom",comfyuiWorkflowFile:((N=document.getElementById("live-comfyui-workflow-file"))==null?void 0:N.value)||"",comfyuiWorkflowJson:((I=document.getElementById("live-comfyui-workflow-json"))==null?void 0:I.value)||""}}function E(e,t=""){const n=document.getElementById("comfyui-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function S(e,t=""){const n=document.getElementById("live-comfyui-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}async function ke(e=!0){var n,a;const t=(n=document.getElementById("comfyui-url"))==null?void 0:n.value;if(!t){E("请先填写 ComfyUI 地址。","error");return}e&&E("正在刷新模型列表...","pending");try{const i=await p("/comfyui/models",v("POST",{url:t})),o=i.models||[];J("comfyui-model",o,(a=r.currentGenerationConfig)==null?void 0:a.comfyuiModel),J("comfyui-sampler",i.samplers||["euler"]),J("comfyui-scheduler",i.schedulers||["normal"]),E(`已刷新模型列表，共 ${o.length} 个模型。`,"success")}catch(i){E(`刷新失败：${i.message}`,"error")}}async function Ct(e=!0){var n,a;const t=(n=document.getElementById("comfyui-url"))==null?void 0:n.value;if(!t){E("请先填写 ComfyUI 地址。","error");return}e&&E("正在刷新工作流文件...","pending");try{const i=await p("/comfyui/workflows",v("POST",{url:t})),o=i.files||i.workflows||[];J("comfyui-workflow-file",o,(a=r.currentGenerationConfig)==null?void 0:a.comfyuiWorkflowFile),E(`已刷新工作流列表，共 ${o.length} 个文件。`,"success")}catch(i){E(`刷新工作流失败：${i.message}`,"error")}}async function jt(e=!0,t=""){var o;const n=(o=document.getElementById("comfyui-url"))==null?void 0:o.value,a=document.getElementById("comfyui-workflow-file"),i=t||(a==null?void 0:a.value);if(!n||!i){e&&E("请先选择一个工作流文件。","error");return}e&&E("正在载入工作流...","pending");try{const s=await p("/comfyui/workflow/load",v("POST",{url:n,file:i})),d=document.getElementById("comfyui-workflow-json");d&&s.workflow&&(d.value=typeof s.workflow=="string"?s.workflow:JSON.stringify(s.workflow,null,2)),E(`已载入工作流：${i}`,"success")}catch(s){E(`载入工作流失败：${s.message}`,"error")}}async function xn(){var t;const e=(t=document.getElementById("comfyui-url"))==null?void 0:t.value;if(!e){E("请先填写 ComfyUI 地址。","error");return}E("正在测试 ComfyUI 连接...","pending");try{const n=await p("/comfyui/test",v("POST",{url:e}));E(n.success?"ComfyUI 连接成功！":n.error||"连接失败",n.success?"success":"error")}catch(n){E(`连接失败：${n.message}`,"error")}}async function An(){var n,a;const e=(n=document.getElementById("comfyui-url"))==null?void 0:n.value,t=(a=document.getElementById("comfyui-workflow-json"))==null?void 0:a.value;if(!t){E("请先输入工作流 JSON。","error");return}E("正在校验工作流...","pending");try{let i;try{i=JSON.parse(t)}catch{throw new Error("工作流 JSON 格式无效。")}const o=await p("/comfyui/validate",v("POST",{url:e,workflow:i}));E(o.valid?"工作流校验通过！":o.error||"工作流校验失败",o.valid?"success":"error")}catch(i){E(`校验失败：${i.message}`,"error")}}async function Gn(e=!0){var n;const t=(n=document.getElementById("live-comfyui-url"))==null?void 0:n.value;if(!t){S("请先填写 ComfyUI 地址。","error");return}e&&S("正在刷新实时模型列表...","pending");try{const a=await p("/comfyui/models",v("POST",{url:t})),i=a.models||[];J("live-comfyui-model",i),J("live-comfyui-sampler",a.samplers||["euler"]),J("live-comfyui-scheduler",a.schedulers||["normal"]),S(`已刷新模型列表，共 ${i.length} 个模型。`,"success")}catch(a){S(`刷新失败：${a.message}`,"error")}}async function On(e=!0){var n;const t=(n=document.getElementById("live-comfyui-url"))==null?void 0:n.value;if(!t){S("请先填写 ComfyUI 地址。","error");return}e&&S("正在刷新实时工作流文件...","pending");try{const a=await p("/comfyui/workflows",v("POST",{url:t})),i=a.files||a.workflows||[];J("live-comfyui-workflow-file",i),S(`已刷新工作流列表，共 ${i.length} 个文件。`,"success")}catch(a){S(`刷新工作流失败：${a.message}`,"error")}}async function Dn(e=!0){var a,i;const t=(a=document.getElementById("live-comfyui-url"))==null?void 0:a.value,n=(i=document.getElementById("live-comfyui-workflow-file"))==null?void 0:i.value;if(!t||!n){e&&S("请先选择一个工作流文件。","error");return}e&&S("正在载入实时工作流...","pending");try{const o=await p("/comfyui/workflow/load",v("POST",{url:t,file:n})),s=document.getElementById("live-comfyui-workflow-json");s&&o.workflow&&(s.value=typeof o.workflow=="string"?o.workflow:JSON.stringify(o.workflow,null,2)),S(`已载入实时工作流：${n}`,"success")}catch(o){S(`载入工作流失败：${o.message}`,"error")}}async function Mn(){var t;const e=(t=document.getElementById("live-comfyui-url"))==null?void 0:t.value;if(!e){S("请先填写 ComfyUI 地址。","error");return}S("正在测试 ComfyUI 连接...","pending");try{const n=await p("/comfyui/test",v("POST",{url:e}));S(n.success?"ComfyUI 连接成功！":n.error||"连接失败",n.success?"success":"error")}catch(n){S(`连接失败：${n.message}`,"error")}}async function Nn(){var n,a;const e=(n=document.getElementById("live-comfyui-url"))==null?void 0:n.value,t=(a=document.getElementById("live-comfyui-workflow-json"))==null?void 0:a.value;if(!t){S("请先输入工作流 JSON。","error");return}S("正在校验实时工作流...","pending");try{let i;try{i=JSON.parse(t)}catch{throw new Error("工作流 JSON 格式无效。")}const o=await p("/comfyui/validate",v("POST",{url:e,workflow:i}));S(o.valid?"工作流校验通过！":o.error||"工作流校验失败",o.valid?"success":"error")}catch(i){S(`校验失败：${i.message}`,"error")}}function Be(){const e=document.getElementById("image-source").value;document.getElementById("comfyui-settings").style.display=e==="comfyui"?"block":"none",document.getElementById("api-settings").style.display=e==="api"?"block":"none",_t()}function ae(){var s,d;const e=document.getElementById("scene-image-controls"),t=document.getElementById("scene-image-prompt"),n=document.getElementById("scene-image-count"),a=document.getElementById("live-image-config"),i=_(),o=i.enableImages&&i.imageSource!=="none";if(e&&(e.style.display=o?"block":"none"),!o){W("当前未启用图像生成。","pending");return}if(t){const m=r.lastSuggestedImagePrompt||((s=r.gameState)==null?void 0:s.sceneDescription)||((d=r.gameState)==null?void 0:d.initialLog)||"";(!t.value.trim()||t.value===r.lastSuggestedImagePrompt)&&(t.value=m),r.lastSuggestedImagePrompt=m}n&&(n.value=String(Math.max(1,Math.min(8,Number(i.comfyuiImageCount)||1)))),a&&(a.style.display=i.imageSource==="comfyui"?"block":"none"),i.imageGenerationMode==="auto"?W("当前为自动生图模式：视觉场景变化时会自动更新。","pending"):W("当前为手动生图模式：点击按钮后才会生成。","pending")}function W(e,t=""){const n=document.getElementById("scene-image-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function gt(e){const t=document.getElementById("generate-scene-image-btn");t&&(t.disabled=!!e,t.textContent=e?"生成中...":"生成场景图")}function $e(){const e=document.getElementById("llm-source").value;document.querySelectorAll(".api-config").forEach(n=>{n.style.display="none"});const t=document.getElementById(`${e}-config`);t&&(t.style.display="block")}async function ce(e){const t=document.getElementById(`test-${e}-result`),n=document.getElementById(`test-${e}-btn`);n.disabled=!0,t.textContent="测试中...",t.className="test-result";try{const a=await p("/test-connection",v("POST",q(e)));t.textContent=a.success?"连接成功":a.error||"连接失败",t.className=`test-result ${a.success?"success":"error"}`}catch(a){t.textContent=a.message,t.className="test-result error"}finally{n.disabled=!1}}function Rn(){var n,a,i,o,s,d,m;const e=document.getElementById("settings-modal"),t=document.getElementById("game-menu-modal");_n(),document.getElementById("settings-btn").addEventListener("click",()=>{e.classList.add("active"),L(async()=>{const{loadSettings:c}=await Promise.resolve().then(()=>V);return{loadSettings:c}},void 0).then(({loadSettings:c})=>c())}),e.querySelector(".modal-close").addEventListener("click",()=>{e.classList.remove("active")}),t.querySelector(".modal-close").addEventListener("click",()=>{t.classList.remove("active")}),document.getElementById("save-settings").addEventListener("click",()=>{L(async()=>{const{saveSettings:c}=await Promise.resolve().then(()=>V);return{saveSettings:c}},void 0).then(({saveSettings:c})=>{c(),e.classList.remove("active")})}),document.getElementById("llm-source").addEventListener("change",$e),document.getElementById("image-source").addEventListener("change",async()=>{Be();const{saveGenerationSettings:c}=await L(async()=>{const{saveGenerationSettings:u}=await Promise.resolve().then(()=>V);return{saveGenerationSettings:u}},void 0);c(),document.getElementById("image-source").value==="comfyui"&&await ke(!1)}),(n=document.getElementById("comfyui-workflow-mode"))==null||n.addEventListener("change",()=>{_t(),L(async()=>{const{saveGenerationSettings:c}=await Promise.resolve().then(()=>V);return{saveGenerationSettings:c}},void 0).then(({saveGenerationSettings:c})=>c())}),(a=document.getElementById("refresh-comfyui-btn"))==null||a.addEventListener("click",async()=>{await ke(!0)}),(i=document.getElementById("refresh-workflow-files-btn"))==null||i.addEventListener("click",async()=>{await Ct(!0)}),(o=document.getElementById("load-workflow-file-btn"))==null||o.addEventListener("click",async()=>{await jt(!0)}),(s=document.getElementById("test-comfyui-btn"))==null||s.addEventListener("click",async()=>{await xn()}),(d=document.getElementById("validate-workflow-btn"))==null||d.addEventListener("click",async()=>{await An()}),(m=document.getElementById("comfyui-workflow-file"))==null||m.addEventListener("change",c=>{var h;const u=((h=c.target)==null?void 0:h.value)||"",g=document.getElementById("comfyui-workflow-file");g&&(g.dataset.selectedWorkflow=u),L(async()=>{const{saveGenerationSettings:b}=await Promise.resolve().then(()=>V);return{saveGenerationSettings:b}},void 0).then(({saveGenerationSettings:b})=>b()),u&&E(`Selected workflow: ${u}`,"success")}),document.getElementById("test-openai-btn").addEventListener("click",()=>ce("openai")),document.getElementById("test-anthropic-btn").addEventListener("click",()=>ce("anthropic")),document.getElementById("test-local-btn").addEventListener("click",()=>ce("local")),document.getElementById("test-custom-btn").addEventListener("click",()=>ce("custom")),document.querySelectorAll('[data-generation-setting="true"]').forEach(c=>{c.addEventListener("change",()=>{L(async()=>{const{saveGenerationSettings:u}=await Promise.resolve().then(()=>V);return{saveGenerationSettings:u}},void 0).then(({saveGenerationSettings:u})=>{u(),ae()})})}),document.getElementById("enable-images").addEventListener("change",()=>{L(async()=>{const{saveGenerationSettings:c}=await Promise.resolve().then(()=>V);return{saveGenerationSettings:c}},void 0).then(({saveGenerationSettings:c})=>{c(),ae()})}),$e(),Be()}function Hn(){const e=q();localStorage.setItem(It,JSON.stringify(e)),Un(e).catch(t=>{console.warn("Failed to persist LLM settings to backend:",t.message)}),ee()}async function Un(e){if(!e||!e.llmSource)return;const t={llm_source:e.llmSource};e.llmSource==="openai"?(t.openai_url=e.apiUrl||"",t.openai_api_key=e.apiKey||"",t.openai_model=e.model||""):e.llmSource==="anthropic"?(t.anthropic_api_key=e.apiKey||"",t.anthropic_model=e.model||""):e.llmSource==="local"?(t.ollama_url=e.apiUrl||"",t.ollama_model=e.model||""):e.llmSource==="custom"&&(t.custom_url=e.apiUrl||"",t.custom_api_key=e.apiKey||"",t.custom_model=e.model||""),await p("/settings/batch",v("POST",t))}function xt(){const e=localStorage.getItem(It),t=localStorage.getItem(ue);try{e&&$n(JSON.parse(e)),ft(x(t?JSON.parse(t):{})),r.currentGenerationConfig=Z(),$e(),Be(),ae(),r.currentGenerationConfig.imageSource==="comfyui"&&r.currentGenerationConfig.enableImages!==!1&&(ke(!1).catch(n=>{E(n.message,"error")}),Ct(!1).then(()=>{var i;const n=(i=r.currentGenerationConfig)==null?void 0:i.comfyuiWorkflowFile,a=document.getElementById("comfyui-workflow-json");return n&&a&&!a.value.trim()?jt(!1,n):null}).catch(n=>{E(n.message,"error")}))}catch(n){console.error("Load settings error:",n)}}function ee(){const e=x(Z());r.currentGenerationConfig=e,localStorage.setItem(ue,JSON.stringify(e))}function me(e,t,n={}){return{version:1,gameId:e,title:n.title||(t==null?void 0:t.name)||"未命名存档",type:n.type||r.currentGameType||(t==null?void 0:t.type)||"custom",savedAt:new Date().toISOString(),gameData:n.gameData||r.currentGameData||null,generationConfig:x(n.generationConfig||r.currentGenerationConfig||Z()),gameState:t}}function ge(e){var n,a;const t=localStorage.getItem(e);if(!t)return null;try{const i=JSON.parse(t),o=e.replace(/^rpg_save_/,"");return i&&i.version===1&&i.gameState?{gameId:i.gameId||o,title:i.title||((n=i.gameState)==null?void 0:n.name)||"未命名存档",type:i.type||((a=i.gameState)==null?void 0:a.type)||"custom",savedAt:i.savedAt||null,gameData:i.gameData||null,generationConfig:i.generationConfig?x(i.generationConfig):null,gameState:i.gameState}:{gameId:o,title:(i==null?void 0:i.name)||"旧版存档",type:(i==null?void 0:i.type)||"custom",savedAt:null,gameData:null,generationConfig:null,gameState:i}}catch(i){return console.error("Read saved game error:",i),null}}function At(){return Object.keys(localStorage).filter(e=>e.startsWith("rpg_save_")).map(e=>ge(e)).filter(Boolean).sort((e,t)=>{const n=e.savedAt?new Date(e.savedAt).getTime():0;return(t.savedAt?new Date(t.savedAt).getTime():0)-n})}function Gt(){const e=document.getElementById("saved-games-list");if(!e)return;const t=At();if(!t.length){e.innerHTML='<p class="empty-hint">暂无存档</p>';return}e.innerHTML=t.map(n=>`
        <button type="button" class="saved-game-card" data-saved-game-id="${l(n.gameId)}">
            <div class="saved-game-header">
                <span class="saved-game-name">${l(n.title||"未命名存档")}</span>
                <span class="saved-game-type">${l(pe[n.type]||n.type||"存档")}</span>
            </div>
            <div class="saved-game-info">ID: ${l(n.gameId)}</div>
            <div class="saved-game-time">${l(n.savedAt?new Date(n.savedAt).toLocaleString():"旧版存档")}</div>
        </button>
    `).join(""),e.querySelectorAll("[data-saved-game-id]").forEach(n=>{n.addEventListener("click",async()=>{await xe(n.dataset.savedGameId)})})}async function xe(e){const t=ge(`rpg_save_${e}`);if(!(t!=null&&t.gameState)){alert("没有找到可读取的存档。");return}let n=!1;try{const o=await p(`/games/${t.gameId}`);r.currentGameData=o.game||t.gameData||null,n=!0}catch{if(t.gameData&&t.generationConfig)try{const s=await p("/games/restore",v("POST",{gameId:t.gameId,gameData:t.gameData,gameState:t.gameState,config:x(t.generationConfig)}));t.gameId=s.gameId||t.gameId,t.gameState=s.gameState||t.gameState,r.currentGameData=t.gameData,n=!0}catch(s){console.error("Restore saved game error:",s)}}r.currentGameId=t.gameId,r.currentGameType=t.type||r.currentGameType,r.gameState=t.gameState,r.sceneImages=[],r.selectedSceneImageIndex=0,t.generationConfig&&(r.currentGenerationConfig=x(t.generationConfig),localStorage.setItem(ue,JSON.stringify(r.currentGenerationConfig)));const a=await L(()=>Promise.resolve().then(()=>se),void 0);k("game-screen"),a.renderGameState(t.gameState),a.renderSceneImages([]),n||alert("这个存档已载入画面，但后端运行态未成功恢复。请重新开始后再保存一次，之后即可正常续玩。");const i=document.getElementById("saved-games-section");i&&(i.style.display="none")}function Ot(){const e=document.getElementById("load-saved-games-btn"),t=document.getElementById("close-saved-games");e==null||e.addEventListener("click",()=>{Gt();const n=document.getElementById("saved-games-section");n&&(n.style.display="block")}),t==null||t.addEventListener("click",()=>{const n=document.getElementById("saved-games-section");n&&(n.style.display="none")})}const V=Object.freeze(Object.defineProperty({__proto__:null,buildSavedGameRecord:me,getSavedGames:At,initSavedGames:Ot,loadSavedGame:xe,loadSettings:xt,readSavedGameRecord:ge,renderSavedGamesList:Gt,saveGenerationSettings:ee,saveSettings:Hn},Symbol.toStringTag,{value:"Module"}));function Wn(){var e,t,n,a;(e=document.getElementById("quick-start-btn"))==null||e.addEventListener("click",()=>{document.getElementById("game-types-section").style.display="block",document.getElementById("examples-section").style.display="none",document.getElementById("game-types-section").scrollIntoView({behavior:"smooth"})}),(t=document.getElementById("browse-examples-btn"))==null||t.addEventListener("click",async()=>{await Jn(),document.getElementById("game-types-section").style.display="none",document.getElementById("examples-section").style.display="block",document.getElementById("examples-section").scrollIntoView({behavior:"smooth"})}),(n=document.getElementById("import-novel-btn"))==null||n.addEventListener("click",async()=>{const{setImportStatus:i}=await L(async()=>{const{setImportStatus:o}=await Promise.resolve().then(()=>Kt);return{setImportStatus:o}},void 0);i("导入后会自动创建项目，并预填到现有生成流程中。"),k("import-screen")}),(a=document.getElementById("close-examples"))==null||a.addEventListener("click",()=>{document.getElementById("game-types-section").style.display="block",document.getElementById("examples-section").style.display="none",window.scrollTo({top:0,behavior:"smooth"})})}async function Jn(){const e=document.getElementById("examples-grid");if(e){e.innerHTML='<div class="loading">加载示例游戏中...</div>';try{const t=await p("/examples"),n={fantasy:"🧙",scifi:"🚀",mystery:"🔍",adventure:"⚔️",romance:"💕"};Fn(t.map(a=>({...a,icon:n[a.type]||"🎮",title:a.name})))}catch(t){console.error("加载示例游戏失败:",t),e.innerHTML='<div class="error">加载失败，请稍后重试</div>'}}}function Fn(e){const t=document.getElementById("examples-grid");t&&(t.innerHTML=e.map(n=>`
        <div class="example-card" data-example-id="${n.id}" data-type="${n.type}">
            <div class="example-cover">
                <span style="position: relative; z-index: 1;">${n.icon}</span>
            </div>
            <div class="example-content">
                <h3 class="example-title">${n.title}</h3>
                <span class="example-type">${pe[n.type]}</span>
                <p class="example-description">${n.description}</p>
                <div class="example-actions">
                    <button class="btn-primary btn-play-example" data-example-id="${n.id}">
                        ▶️ 立即试玩
                    </button>
                </div>
            </div>
        </div>
    `).join(""),t.querySelectorAll(".btn-play-example").forEach(n=>{n.addEventListener("click",async a=>{a.stopPropagation();const i=n.dataset.exampleId;await zn(i)})}))}async function zn(e){try{const t=q();k("loading-screen"),Se(10,"正在启动示例游戏...","");const n=await p(`/examples/${e}/start`,v("POST",{settings:t}));Se(100,"启动完成！",""),r.currentGameId=n.gameId,r.gameState=n.gameState;const{renderGameState:a}=await L(async()=>{const{renderGameState:i}=await Promise.resolve().then(()=>se);return{renderGameState:i}},void 0);a(n.gameState),k("game-screen"),console.log("示例游戏已启动:",n.message)}catch(t){console.error("启动示例游戏失败:",t),alert("启动失败: "+t.message),k("home-screen")}}const yt={success:"✅",error:"❌",info:"ℹ️",warning:"⚠️"},qn=4e3;let Ie=null;function Vn(){return Ie||(Ie=document.getElementById("toast-container")),Ie}function U(e,t="info",n=qn){const a=Vn();if(!a)return console.warn("[toast] No #toast-container found; falling back to alert."),alert(e),{dismiss(){}};const i=document.createElement("div");i.className=`toast toast-${t}`;const o=yt[t]||yt.info;i.innerHTML=`
        <span class="toast-icon">${o}</span>
        <span class="toast-message">${Kn(e)}</span>
        <button class="toast-close" type="button">&times;</button>
    `,a.appendChild(i);let s=!1;function d(){s||(s=!0,i.classList.add("toast-dismiss"),i.addEventListener("animationend",()=>{i.remove()},{once:!0}),setTimeout(()=>i.remove(),400))}return i.querySelector(".toast-close").addEventListener("click",d),n>0&&setTimeout(d,n),{dismiss:d}}function Kn(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Dt(){document.getElementById("game-config-form").addEventListener("submit",async e=>{if(e.preventDefault(),!r.currentGameType){U("请先选择一个游戏类型","warning"),k("home-screen");return}const t=e.target.querySelector(".generate-btn");t&&t.classList.add("btn-loading");try{await Mt()}finally{t&&t.classList.remove("btn-loading")}})}async function Mt(){const e=x(Z());r.currentGenerationConfig=e,ee();const t={userInput:document.getElementById("game-description").value.trim()||"暂无额外描述",gameType:r.currentGameType,config:e};try{const n=await p("/generate/init",v("POST",t));r.currentProjectId=null,r.currentProjectData=null,await Nt(n);return}catch(n){console.error("Session init error:",n),U(`初始化失败：${n.message}`,"error"),k("config-screen")}}async function Nt(e){var n;r.currentSessionId=e.sessionId,r.allSteps=e.steps||[],r.currentStepId=e.firstStep||((n=r.allSteps[0])==null?void 0:n.id)||null,r.stepStates={};const t=await L(()=>Promise.resolve().then(()=>ya),void 0);k("generation-workbench"),t.renderStepNavigation(),await t.renderConfirmedElements(),t.renderCurrentStep(r.currentStepId),t.renderHistoryPanel(),j("idle",'已创建生成会话，点击"生成"开始当前步骤。')}const Yn=Object.freeze(Object.defineProperty({__proto__:null,beginGenerationWorkbench:Nt,initConfigForm:Dt,initGenerationSession:Mt},Symbol.toStringTag,{value:"Module"}));function Ae(e){return mn[e]||e||"未设置"}function $(e,t=""){const n=document.getElementById("import-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function f(e,t=""){const n=document.getElementById("import-preview-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function Rt(){var e,t,n;(e=document.getElementById("import-project-form"))==null||e.addEventListener("submit",async a=>{a.preventDefault(),await Xn()}),(t=document.getElementById("import-package-btn"))==null||t.addEventListener("click",async()=>{await Qn()}),(n=document.getElementById("refresh-import-projects"))==null||n.addEventListener("click",async()=>{await ie()}),ie().catch(a=>{console.error("Load imported projects error:",a)})}function Ht(){var e,t,n,a,i,o,s,d,m;(e=document.getElementById("save-import-preview"))==null||e.addEventListener("click",async()=>{await Ge()}),(t=document.getElementById("optimize-project-btn"))==null||t.addEventListener("click",async()=>{await Le()}),(n=document.getElementById("resume-project-play"))==null||n.addEventListener("click",async()=>{await Ut()}),(a=document.getElementById("generate-base-assets"))==null||a.addEventListener("click",async()=>{await Wt()}),(i=document.getElementById("rebuild-adaptation-btn"))==null||i.addEventListener("click",async()=>{await Ft()}),(o=document.getElementById("rebuild-visual-bible-btn"))==null||o.addEventListener("click",async()=>{await zt()}),(s=document.getElementById("apply-project-refinement-btn"))==null||s.addEventListener("click",async()=>{await qt()}),(d=document.getElementById("export-project-package-btn"))==null||d.addEventListener("click",async()=>{await Vt()}),(m=document.getElementById("import-preview-screen"))==null||m.addEventListener("click",c=>{const u=c.target.closest("[data-preview-action]");u&&ta(u.dataset.previewAction,u)})}async function Qn(){var n,a,i;const e=document.getElementById("import-package-file"),t=(n=e==null?void 0:e.files)==null?void 0:n[0];if(!t){$("请先选择一个项目包 JSON 文件。","error");return}$("正在解析并导入项目包...","pending");try{const o=await t.text(),s=JSON.parse(o),d=await p("/projects/import-package",v("POST",{package:s}));r.currentProjectId=((a=d.project)==null?void 0:a.id)||null,r.currentProjectData=d.project||null,r.currentGameType=((i=d.project)==null?void 0:i.gameType)||r.currentGameType||"custom",r.currentProjectData&&(document.getElementById("import-title").value=r.currentProjectData.title||""),A(r.currentProjectData),await ie(),k("import-preview-screen"),$("项目包导入成功。","success"),f("项目包已恢复，可以继续调整后进入工作台。","success")}catch(o){$(`导入失败：${o.message}`,"error")}}async function Xn(){var d,m,c,u,g,h,b;const e=((d=document.getElementById("import-content"))==null?void 0:d.value.trim())||"";if(!e){$("请先粘贴要导入的长文本内容。","error");return}if(e.length<100){$("文本内容过短，至少需要 100 字。","error");return}const t=x(Z());r.currentGenerationConfig=t,ee();const n=((m=document.getElementById("use-smart-parse"))==null?void 0:m.checked)!==!1,a=document.getElementById("import-submit-btn"),i=document.getElementById("import-progress"),o=document.getElementById("import-progress-fill"),s=document.getElementById("import-progress-text");a&&(a.disabled=!0);try{const w={title:((c=document.getElementById("import-title"))==null?void 0:c.value.trim())||"",content:e,gameType:((u=document.getElementById("import-game-type"))==null?void 0:u.value)||"custom",adaptationMode:((g=document.getElementById("adaptation-mode"))==null?void 0:g.value)||"balanced",useSmart:n,settings:n?q():void 0};if(n){i&&(i.style.display="block"),$("正在使用 AI 智能解析文本...","pending");const P=await wn("/projects/import-text",v("POST",w),(N,I)=>{o&&(o.style.width=`${N}%`),s&&(s.textContent=I||`解析中... ${N}%`)});r.currentProjectId=((h=P.project)==null?void 0:h.id)||null,r.currentProjectData=P.project||null,r.currentGameType=w.gameType,A(P.project),$("AI 智能解析完成！请检查提取结果。","success"),f("AI 已智能识别章节、角色和关系，可以轻量修改后进入工作台。","success")}else{$("正在快速解析文本...","pending");const P=await p("/projects/import-text",v("POST",w));r.currentProjectId=((b=P.project)==null?void 0:b.id)||null,r.currentProjectData=P.project||null,r.currentGameType=w.gameType,A(P.project),$("快速解析完成，请检查提取结果。","success"),f("可以先轻量修改角色、章节和地点，再确认进入工作台。")}await ie(),k("import-preview-screen")}catch(w){console.error("Imported project init error:",w),$(`导入失败：${w.message}`,"error")}finally{a&&(a.disabled=!1),i&&(i.style.display="none")}}async function Zn(){var t,n;if(!r.currentProjectId){$("当前没有可用的导入项目，请重新导入。","error"),k("import-screen");return}const e=x(Z());r.currentGenerationConfig=e,ee();try{const a=await Ge({successMessage:"修改已保存，正在进入生成工作台..."});if(!a)return;const i=await p(`/projects/${r.currentProjectId}/init-session`,v("POST",{config:e,gameType:a.gameType||r.currentGameType||"custom",userInput:((t=a.storyBible)==null?void 0:t.summary)||((n=a.source)==null?void 0:n.excerpt)||""})),{beginGenerationWorkbench:o}=await L(async()=>{const{beginGenerationWorkbench:s}=await Promise.resolve().then(()=>Yn);return{beginGenerationWorkbench:s}},void 0);await o(i),$("导入项目已进入生成工作台。","success")}catch(a){console.error("Start imported project session error:",a),$(a.message,"error"),f(a.message,"error"),k("import-screen")}}function ea(){const e=$t(r.currentProjectData),t=ye();return e.storyBible=e.storyBible||{},e.source=e.source||{},e.title=t.title||e.title||"",e.storyBible.summary=t.summary||e.storyBible.summary||"",e.storyBible.characters=t.characters,e.storyBible.chapters=t.chapters,e.storyBible.locations=t.locations,e.source.title=e.title||e.source.title||"",e}function ta(e,t){if(!e||!r.currentProjectData)return;const n=ea();if(n.storyBible=n.storyBible||{},e==="add-character"){const a=Array.isArray(n.storyBible.characters)?n.storyBible.characters:[];a.push(Lt(a.length)),n.storyBible.characters=a}if(e==="remove-character"){const a=t.closest('[data-preview-item="character"]'),i=Number((a==null?void 0:a.dataset.index)??-1);n.storyBible.characters=(n.storyBible.characters||[]).filter((o,s)=>s!==i)}if(e==="add-chapter"){const a=Array.isArray(n.storyBible.chapters)?n.storyBible.chapters:[];a.push(Pt(a.length)),n.storyBible.chapters=a}if(e==="remove-chapter"){const a=t.closest('[data-preview-item="chapter"]'),i=Number((a==null?void 0:a.dataset.index)??-1);n.storyBible.chapters=(n.storyBible.chapters||[]).filter((o,s)=>s!==i)}if(e==="add-location"){const a=Array.isArray(n.storyBible.locations)?n.storyBible.locations:[];a.push(Tt(a.length)),n.storyBible.locations=a}if(e==="remove-location"){const a=t.closest('[data-preview-item="location"]'),i=Number((a==null?void 0:a.dataset.index)??-1);n.storyBible.locations=(n.storyBible.locations||[]).filter((o,s)=>s!==i)}r.currentProjectData=n,A(n),f("本地预览已更新，记得保存后再进入工作台。","pending")}function Ee(e,t){return Array.from(document.querySelectorAll(`[data-preview-collection="${e}"] [data-preview-item="${e}"]`)).map((n,a)=>t(n,a))}function ye(){var e,t,n,a,i,o,s,d,m;return{title:((e=document.getElementById("import-preview-title"))==null?void 0:e.value.trim())||((t=r.currentProjectData)==null?void 0:t.title)||"",summary:((n=document.getElementById("import-preview-summary-input"))==null?void 0:n.value.trim())||((i=(a=r.currentProjectData)==null?void 0:a.storyBible)==null?void 0:i.summary)||"",adaptationMode:((o=document.getElementById("import-preview-adaptation-mode"))==null?void 0:o.value)||((s=r.currentProjectData)==null?void 0:s.adaptationMode)||"balanced",gameType:((d=document.getElementById("import-preview-game-type"))==null?void 0:d.value)||((m=r.currentProjectData)==null?void 0:m.gameType)||r.currentGameType||"custom",characters:Ee("character",(c,u)=>{var g,h,b;return{id:c.dataset.itemId||`import_char_${u+1}`,name:((g=c.querySelector('[data-field="name"]'))==null?void 0:g.value.trim())||"",role:((h=c.querySelector('[data-field="role"]'))==null?void 0:h.value.trim())||"",description:((b=c.querySelector('[data-field="description"]'))==null?void 0:b.value.trim())||""}}).filter(c=>c.name||c.role||c.description),chapters:Ee("chapter",(c,u)=>{var g,h;return{id:c.dataset.itemId||`chapter_${u+1}`,title:((g=c.querySelector('[data-field="title"]'))==null?void 0:g.value.trim())||`章节 ${u+1}`,summary:((h=c.querySelector('[data-field="summary"]'))==null?void 0:h.value.trim())||""}}).filter(c=>c.title||c.summary),locations:Ee("location",(c,u)=>{var g,h;return{id:c.dataset.itemId||`import_loc_${u+1}`,name:((g=c.querySelector('[data-field="name"]'))==null?void 0:g.value.trim())||"",description:((h=c.querySelector('[data-field="description"]'))==null?void 0:h.value.trim())||""}}).filter(c=>c.name||c.description)}}function A(e=r.currentProjectData){var y,T,C,R,Y,De,Me,Ne,Re,He,Ue,We,Je,Fe,ze,qe,Ve,Ke,Ye,Qe,Xe,Ze,et,tt,nt,at,it,rt,ot,st,ct,lt,dt,mt;if(!e)return;const t=document.getElementById("import-preview-summary"),n=document.getElementById("import-preview-characters"),a=document.getElementById("import-preview-chapters"),i=document.getElementById("import-preview-visuals"),o=((y=e.storyBible)==null?void 0:y.summary)||((T=e.source)==null?void 0:T.excerpt)||"",s=Array.isArray((C=e.storyBible)==null?void 0:C.themes)&&e.storyBible.themes.length?e.storyBible.themes.join("、"):"待补充",d=Array.isArray((R=e.storyBible)==null?void 0:R.characters)?e.storyBible.characters:[],m=Array.isArray((Y=e.storyBible)==null?void 0:Y.chapters)?e.storyBible.chapters:[],c=Array.isArray((De=e.storyBible)==null?void 0:De.locations)?e.storyBible.locations:[],u=c.slice(0,5).map(G=>G.name).filter(Boolean).join("、"),g=d.slice(0,4).map(G=>G.name).filter(Boolean).join("、"),h=c.slice(0,4).map(G=>G.name).filter(Boolean).join("、"),b=((Ne=(Me=e.visualBible)==null?void 0:Me.styleProfile)==null?void 0:Ne.atmosphere)||"待确认",w=((Re=e.buildArtifacts)==null?void 0:Re.latestPlayable)||null,P=!!((Ue=(He=e.runtimeSnapshot)==null?void 0:He.history)!=null&&Ue.length||((We=e.runtimeSnapshot)==null?void 0:We.plotBeatId)!=null),N=w!=null&&w.updatedAt?`最近可玩版本：${new Date(w.updatedAt).toLocaleString()}`:"当前还没有可试玩版本",I=e.optimizationReport||null;if(t&&(t.innerHTML=`
            <div class="preview-summary-block">
                <div class="preview-field">
                    <label for="import-preview-title">项目标题</label>
                    <input id="import-preview-title" type="text" value="${B(e.title||"")}" placeholder="输入项目标题" />
                </div>
                <div class="preview-field">
                    <label for="import-preview-summary-input">剧情摘要</label>
                    <textarea id="import-preview-summary-input" rows="6" placeholder="补充导入项目的剧情摘要">${l(o)}</textarea>
                </div>
                <div class="preview-meta-row">
                    <div class="preview-field">
                        <label for="import-preview-adaptation-mode">改编模式</label>
                        <select id="import-preview-adaptation-mode">
                            <option value="faithful" ${e.adaptationMode==="faithful"?"selected":""}>忠于原著</option>
                            <option value="balanced" ${e.adaptationMode==="balanced"?"selected":""}>平衡改编</option>
                            <option value="free" ${e.adaptationMode==="free"?"selected":""}>高自由互动</option>
                        </select>
                    </div>
                    <div class="preview-field">
                        <label for="import-preview-game-type">游戏类型</label>
                        <select id="import-preview-game-type">
                            <option value="custom" ${e.gameType==="custom"?"selected":""}>自定义</option>
                            <option value="adventure" ${e.gameType==="adventure"?"selected":""}>冒险</option>
                            <option value="mystery" ${e.gameType==="mystery"?"selected":""}>推理</option>
                            <option value="romance" ${e.gameType==="romance"?"selected":""}>恋爱</option>
                            <option value="fantasy" ${e.gameType==="fantasy"?"selected":""}>奇幻</option>
                            <option value="scifi" ${e.gameType==="scifi"?"selected":""}>科幻</option>
                            <option value="kingdom" ${e.gameType==="kingdom"?"selected":""}>王国</option>
                            <option value="cultivation" ${e.gameType==="cultivation"?"selected":""}>修仙</option>
                        </select>
                    </div>
                </div>
                <div class="preview-content">
                    <p>主题：${l(s)}</p>
                    <p>主要地点：${l(u||"待补充")}</p>
                    <p>${l(N)}</p>
                    <p>${l(P?"检测到运行快照，可继续试玩。":"当前没有运行快照，将从开场开始试玩。")}</p>
                </div>
                <div class="preview-item-actions">
                    <button id="optimize-project-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                    <button id="resume-project-play" type="button" class="preview-inline-btn" ${w?"":"disabled"}>${P?"继续试玩":"试玩当前版本"}</button>
                </div>
            </div>
        `,(Je=document.getElementById("optimize-project-btn"))==null||Je.addEventListener("click",async()=>{await Le()}),(Fe=document.getElementById("resume-project-play"))==null||Fe.addEventListener("click",async()=>{await Ut()})),n){const G=d.length?d.map((O,te)=>`
                <article class="preview-edit-item" data-preview-item="character" data-index="${te}" data-item-id="${B(O.id||"")}">
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label>角色名</label>
                            <input type="text" data-field="name" value="${B(O.name||"")}" placeholder="角色名称" />
                        </div>
                        <div class="preview-field">
                            <label>角色定位</label>
                            <input type="text" data-field="role" value="${B(O.role||"")}" placeholder="主角 / 配角 / 阵营人物" />
                        </div>
                    </div>
                    <div class="preview-field">
                        <label>角色描述</label>
                        <textarea data-field="description" rows="4" placeholder="补充角色外观、气质、动机">${l(O.description||"")}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-character">删除角色</button>
                    </div>
                </article>
            `).join(""):'<p class="empty-hint">暂未提取到明显角色，可以手动补一个再继续。</p>';n.innerHTML=`
            <div class="preview-card-header">
                <p class="helper-text">这里只做轻量纠偏，确认后会直接带入后续生成。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-character">新增角色</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="character">
                ${G}
            </div>
        `}if(a){const G=m.length?m.map((O,te)=>`
                <article class="preview-edit-item" data-preview-item="chapter" data-index="${te}" data-item-id="${B(O.id||"")}">
                    <div class="preview-field">
                        <label>章节标题</label>
                        <input type="text" data-field="title" value="${B(O.title||O.name||"")}" placeholder="章节标题" />
                    </div>
                    <div class="preview-field">
                        <label>章节摘要</label>
                        <textarea data-field="summary" rows="5" placeholder="这一章的主要事件与冲突">${l(O.summary||"")}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-chapter">删除章节</button>
                    </div>
                </article>
            `).join(""):'<p class="empty-hint">还没识别到章节结构，可以先加几个关键情节节点。</p>';a.innerHTML=`
            <div class="preview-card-header">
                <p class="helper-text">保留关键章节就够，后续工作台还会继续细化。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-chapter">新增章节</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="chapter">
                ${G}
            </div>
        `}if(i){const G=c.length?c.map((ne,ln)=>`
                <article class="preview-edit-item" data-preview-item="location" data-index="${ln}" data-item-id="${B(ne.id||"")}">
                    <div class="preview-field">
                        <label>地点名称</label>
                        <input type="text" data-field="name" value="${B(ne.name||"")}" placeholder="地点名称" />
                    </div>
                    <div class="preview-field">
                        <label>地点描述</label>
                        <textarea data-field="description" rows="4" placeholder="地点外观、氛围、功能">${l(ne.description||"")}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-location">删除地点</button>
                    </div>
                </article>
            `).join(""):'<p class="empty-hint">地点越准，后面的场景基准图就越稳。</p>',O=((qe=(ze=e.visualBible)==null?void 0:ze.styleProfile)==null?void 0:qe.stylePreset)||"国风电影叙事",te=((Ve=e.config)==null?void 0:Ve.refinement)||{},ut=((Ke=e.gameDesign)==null?void 0:Ke.branchingPolicy)||{},rn=`每章分支上限 ${ut.maxBranchPerChapter||"-"}，锚点保留率 ${ut.mustKeepAnchorRate||"-"}`,on=ra(I==null?void 0:I.relationshipGraph),sn=oa(I==null?void 0:I.playableChapters),cn=I?`
                <article class="preview-edit-item">
                    <strong>项目优化诊断</strong>
                    <div class="preview-content">
                        <p>总评分：${l(String(I.overallScore||0))}</p>
                        <p>故事完整度：${l(String(((Ye=I.readiness)==null?void 0:Ye.story)||0))}</p>
                        <p>改编完整度：${l(String(((Qe=I.readiness)==null?void 0:Qe.adaptation)||0))}</p>
                        <p>视觉完整度：${l(String(((Xe=I.readiness)==null?void 0:Xe.visual)||0))}</p>
                        <p>试玩完整度：${l(String(((Ze=I.readiness)==null?void 0:Ze.playable)||0))}</p>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">优化建议</div>
                        <div class="candidate-paragraph">${l((I.recommendations||[]).join("；")||"当前没有明显阻塞项。")}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">当前优势</div>
                        <div class="candidate-paragraph">${l((I.strengths||[]).join("；")||"继续丰富内容即可。")}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">建议下一步</div>
                        <div class="candidate-paragraph">${l((I.nextActions||[]).map(ne=>ne.label).join("；")||"当前没有明显阻塞项。")}</div>
                    </div>
                    ${on}
                    ${sn}
                </article>
            `:"";i.innerHTML=`
            <div class="preview-card-header">
                <p class="helper-text">先确认后续要做视觉建档的主要地点。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-location">新增地点</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="location">
                ${G}
            </div>

            <div class="preview-card-header">
                <h3>改编导演与视觉重建</h3>
            </div>
            <div class="preview-edit-stack">
                <article class="preview-edit-item">
                    <div class="preview-field">
                        <label for="preview-style-preset">风格预设</label>
                        <input id="preview-style-preset" type="text" value="${B(O)}" placeholder="例如：国风电影叙事 / 水墨奇幻" />
                    </div>
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label for="preview-pacing">节奏倾向</label>
                            <select id="preview-pacing">
                                <option value="slow" ${((et=e.config)==null?void 0:et.pacing)==="slow"?"selected":""}>慢节奏</option>
                                <option value="balanced" ${!((tt=e.config)!=null&&tt.pacing)||((nt=e.config)==null?void 0:nt.pacing)==="balanced"?"selected":""}>平衡</option>
                                <option value="fast" ${((at=e.config)==null?void 0:at.pacing)==="fast"?"selected":""}>快节奏</option>
                            </select>
                        </div>
                        <div class="preview-field">
                            <label for="preview-adaptation-strength">改编强度 (0-1)</label>
                            <input id="preview-adaptation-strength" type="number" min="0" max="1" step="0.1" value="${Number(te.adaptationStrength??.5)}" />
                        </div>
                    </div>
                    <div class="preview-item-actions preview-actions-grid">
                        <button id="rebuild-adaptation-btn" type="button" class="preview-inline-btn">重算改编结构</button>
                        <button id="rebuild-visual-bible-btn" type="button" class="preview-inline-btn">重建视觉圣经</button>
                        <button id="apply-project-refinement-btn" type="button" class="preview-inline-btn">应用校正参数</button>
                        <button id="export-project-package-btn" type="button" class="preview-inline-btn">导出项目包</button>
                    </div>
                </article>
            </div>

            <div class="preview-item-actions preview-actions-grid">
                <button id="optimize-project-inline-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                <button id="generate-base-assets" type="button" class="preview-inline-btn">生成角色/地点基准图</button>
            </div>
            <div id="project-asset-list" class="preview-edit-stack"></div>
            <div id="project-optimization-report" class="preview-edit-stack">${cn}</div>
            <div class="preview-content">
                <p>角色基准图建议：${l(g||"先确认角色后再生成")}</p>
                <p>场景基准图建议：${l(h||"先确认地点后再生成")}</p>
                <p>视觉氛围：${l(b)}</p>
                <p>改编策略：${l(((it=e.gameDesign)==null?void 0:it.adaptationProfile)||Ae(e.adaptationMode||"balanced"))} · ${l(rn)}</p>
            </div>
        `,ia(((rt=e.visualBible)==null?void 0:rt.assetIndex)||[]),(ot=document.getElementById("optimize-project-inline-btn"))==null||ot.addEventListener("click",async()=>{await Le()}),(st=document.getElementById("generate-base-assets"))==null||st.addEventListener("click",async()=>{await Wt()}),(ct=document.getElementById("rebuild-adaptation-btn"))==null||ct.addEventListener("click",async()=>{await Ft()}),(lt=document.getElementById("rebuild-visual-bible-btn"))==null||lt.addEventListener("click",async()=>{await zt()}),(dt=document.getElementById("apply-project-refinement-btn"))==null||dt.addEventListener("click",async()=>{await qt()}),(mt=document.getElementById("export-project-package-btn"))==null||mt.addEventListener("click",async()=>{await Vt()})}}async function Le(){var e,t,n;if(!r.currentProjectId){f("请先导入并保存项目。","error");return}f("正在分析并优化项目结构...","pending");try{if(!await Ge({showStatus:!1}))return;const i=await p(`/projects/${r.currentProjectId}/optimize`,v("POST",{preserveAssets:!0}));r.currentProjectData=i.project||r.currentProjectData,A(r.currentProjectData);const o=((e=i.optimizationReport)==null?void 0:e.overallScore)??((n=(t=r.currentProjectData)==null?void 0:t.optimizationReport)==null?void 0:n.overallScore)??0;f(`项目优化完成，当前综合评分 ${o}。`,"success")}catch(a){f(`项目优化失败：${a.message}`,"error")}}async function Ut(e=!1){if(!r.currentProjectId){f("请先导入并保存项目。","error");return}f(e?"正在重启试玩版本...":"正在恢复试玩版本...","pending");try{const t=_(),n=await p(`/projects/${r.currentProjectId}/play`,v("POST",{restart:e,config:t.imageSource==="comfyui"?{...t,...fe()}:t}));r.currentGameId=n.gameId,r.sceneImages=[],r.selectedSceneImageIndex=0,r.activeSceneImage="",r.transitioningSceneImage="",r.currentVisualSignature="",document.getElementById("game-log").innerHTML="";const a=await L(()=>Promise.resolve().then(()=>se),void 0);a.showChoices([]),a.renderSceneImages([]),k("game-screen"),a.renderGameState(n.gameState),f(n.resumed?"已恢复到上次试玩进度。":"已载入试玩版本。","success")}catch(t){f(`试玩恢复失败：${t.message}`,"error")}}async function Wt(){var t,n;if(!r.currentProjectId){f("请先导入并保存项目。","error");return}const e=_();!e.enableImages||e.imageSource==="none"?f("当前图像生成未启用，将先以规划模式创建资产索引。","pending"):f("正在生成角色/地点基准图，请稍候...","pending");try{const a={dryRun:!e.enableImages||e.imageSource==="none",characterLimit:4,locationLimit:4,imageConfig:e.imageSource==="comfyui"?{...e,...fe()}:e},i=await p(`/projects/${r.currentProjectId}/assets/generate-base`,v("POST",a)),o=await p(`/projects/${r.currentProjectId}`);r.currentProjectData=o.project||r.currentProjectData,A(r.currentProjectData),f(a.dryRun?`已创建 ${((t=i.generatedAssets)==null?void 0:t.length)||0} 条资产规划。`:`已生成 ${((n=i.generatedAssets)==null?void 0:n.length)||0} 个基准资产。`,"success")}catch(a){f(`基准图生成失败：${a.message}`,"error")}}function Jt(){var a,i,o;const e=((a=document.getElementById("preview-style-preset"))==null?void 0:a.value.trim())||"",t=((i=document.getElementById("preview-pacing"))==null?void 0:i.value)||"balanced",n=Number(((o=document.getElementById("preview-adaptation-strength"))==null?void 0:o.value)??.5);return{pacing:t,refinement:{adaptationStrength:Number.isFinite(n)?Math.max(0,Math.min(1,n)):.5},styleProfile:e?{stylePreset:e}:{}}}async function Ft(){if(!r.currentProjectId){f("请先导入并保存项目。","error");return}f("正在重算改编结构...","pending");try{const e=ye(),t=await p(`/projects/${r.currentProjectId}/adaptation/rebuild`,v("POST",{gameType:e.gameType,adaptationMode:e.adaptationMode}));r.currentProjectData=t.project||r.currentProjectData,A(r.currentProjectData),f("改编结构已重算。","success")}catch(e){f(`重算失败：${e.message}`,"error")}}async function zt(){if(!r.currentProjectId){f("请先导入并保存项目。","error");return}f("正在重建视觉圣经...","pending");try{const e=Jt(),t=await p(`/projects/${r.currentProjectId}/visual-bible/rebuild`,v("POST",{styleProfile:e.styleProfile}));r.currentProjectData=t.project||r.currentProjectData,A(r.currentProjectData),f("视觉圣经已重建。","success")}catch(e){f(`重建失败：${e.message}`,"error")}}async function qt(){if(!r.currentProjectId){f("请先导入并保存项目。","error");return}f("正在应用校正参数...","pending");try{const e=ye(),t=Jt(),n=await p(`/projects/${r.currentProjectId}/refine`,v("POST",{...t,adaptationMode:e.adaptationMode}));r.currentProjectData=n.project||r.currentProjectData,A(r.currentProjectData),f("校正参数已应用。","success")}catch(e){f(`应用失败：${e.message}`,"error")}}async function Vt(){var e;if(!r.currentProjectId){f("请先导入并保存项目。","error");return}f("正在导出项目包...","pending");try{const n=(await p(`/projects/${r.currentProjectId}/export-package`)).package||{},{downloadJsonFile:a}=await L(async()=>{const{downloadJsonFile:o}=await Promise.resolve().then(()=>Tn);return{downloadJsonFile:o}},void 0),i=`${(((e=r.currentProjectData)==null?void 0:e.title)||"project").replace(/[\\/:*?"<>|]/g,"_")}_package.json`;a(i,n),f("项目包导出成功。","success")}catch(t){f(`导出失败：${t.message}`,"error")}}async function Ge(e={}){if(!r.currentProjectId)return f("当前没有可保存的导入项目，请重新导入。","error"),null;const t=e.showStatus!==!1;t&&f("正在保存导入项目修改...","pending");try{const n=await p(`/projects/${r.currentProjectId}/update`,v("POST",{edits:ye()}));return r.currentProjectData=n.project||r.currentProjectData,r.currentProjectData&&(document.getElementById("import-title").value=r.currentProjectData.title||""),A(r.currentProjectData),t&&f(e.successMessage||"导入项目修改已保存。","success"),r.currentProjectData}catch(n){return console.error("Save imported project edits error:",n),t&&f(n.message,"error"),null}}async function ie(){const e=document.getElementById("import-project-list");if(e){e.innerHTML='<p class="empty-hint">正在加载项目列表...</p>';try{const t=await p("/projects"),n=Array.isArray(t.projects)?t.projects:[];if(!n.length){e.innerHTML='<p class="empty-hint">还没有导入项目。</p>';return}e.innerHTML=n.map(a=>`
            <article class="import-project-card" data-project-id="${B(a.id)}">
                <div class="import-project-main">
                    <strong>${l(a.title||"未命名项目")}</strong>
                    <p>${l(a.summary||"暂无摘要")}</p>
                    <div class="import-project-meta">
                        <span>${l(pe[a.gameType]||"自定义 RPG")}</span>
                        <span>${l(Ae(a.adaptationMode||"balanced"))}</span>
                        <span>${l(new Date(a.updatedAt||a.createdAt||Date.now()).toLocaleString())}</span>
                    </div>
                </div>
                <div class="import-project-actions">
                    <button type="button" class="preview-inline-btn" data-action="open">继续编辑</button>
                    <button type="button" class="preview-inline-btn danger" data-action="delete">删除</button>
                </div>
            </article>
        `).join(""),e.querySelectorAll('[data-action="open"]').forEach(a=>{a.addEventListener("click",async()=>{const i=a.closest("[data-project-id]"),o=i==null?void 0:i.getAttribute("data-project-id");o&&await na(o)})}),e.querySelectorAll('[data-action="delete"]').forEach(a=>{a.addEventListener("click",async()=>{const i=a.closest("[data-project-id]"),o=i==null?void 0:i.getAttribute("data-project-id");o&&await aa(o)})})}catch(t){e.innerHTML=`<p class="empty-hint">项目列表加载失败：${l(t.message)}</p>`}}}async function na(e){var t,n;try{const a=await p(`/projects/${e}`);r.currentProjectId=((t=a.project)==null?void 0:t.id)||e,r.currentProjectData=a.project||null,r.currentGameType=((n=a.project)==null?void 0:n.gameType)||r.currentGameType,r.currentProjectData&&(document.getElementById("import-title").value=r.currentProjectData.title||"",r.currentGameType=r.currentProjectData.gameType||r.currentGameType),A(r.currentProjectData),$("已加载导入项目，你可以继续修改。","success"),f("项目已加载，可直接修改并继续进入工作台。"),k("import-preview-screen")}catch(a){$(`加载项目失败：${a.message}`,"error")}}async function aa(e){if(confirm("确定删除这个导入项目吗？删除后不可恢复。"))try{await p(`/projects/${e}`,v("DELETE",{})),r.currentProjectId===e&&(r.currentProjectId=null,r.currentProjectData=null),await ie(),$("项目已删除。","success")}catch(t){$(`删除项目失败：${t.message}`,"error")}}function ia(e=[]){const t=document.getElementById("project-asset-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML='<p class="empty-hint">暂无视觉资产，可先生成基准图。</p>';return}t.innerHTML=e.slice(0,8).map(n=>`
        <article class="preview-edit-item">
            <strong>${l(n.targetName||n.type||"未命名资产")}</strong>
            <span class="helper-text">${l(n.type||"asset")} · ${l(n.status||"planned")}</span>
            ${n.imageUrl?`<img src="${n.imageUrl}" alt="${B(n.targetName||"资产图")}" style="width:100%;border-radius:8px;" />`:""}
        </article>
    `).join("")}}function ra(e={}){const t=Array.isArray(e==null?void 0:e.nodes)?e.nodes:[],n=Array.isArray(e==null?void 0:e.edges)?e.edges:[],a=Array.isArray(e==null?void 0:e.hubs)?e.hubs:[];return`
        <div class="candidate-block">
            <div class="candidate-label">关系图</div>
            <div class="relation-graph">
                <div class="relation-graph-nodes">
                    ${t.length?t.map(i=>`
                            <div class="relation-node">
                                <strong>${l(i.name||"未命名角色")}</strong>
                                <span>${l(i.role||"角色")}</span>
                            </div>
                        `).join(""):'<div class="relation-empty">当前还没有足够清晰的人物节点。</div>'}
                </div>
                <div class="relation-graph-edges">
                    ${n.length?n.map(i=>`
                            <div class="relation-edge">
                                <div class="relation-edge-main">${l(i.source||"未知")} → ${l(i.target||"未知")}</div>
                                <div class="relation-edge-meta">${l(i.relation||"待确认")} · 张力 ${l(i.tension||"中")}</div>
                            </div>
                        `).join(""):'<div class="relation-empty">当前还没有识别到稳定关系。</div>'}
                </div>
                <div class="relation-graph-hubs">
                    <div class="relation-subtitle">关系中心</div>
                    ${a.length?a.map((i,o)=>`
                            <div class="relation-hub">
                                <span>#${o+1}</span>
                                <strong>${l(i.name||"未命名角色")}</strong>
                                <em>连接数 ${l(String(i.degree||0))}</em>
                            </div>
                        `).join(""):'<div class="relation-empty">暂无明显中心人物。</div>'}
                </div>
            </div>
        </div>
    `}function oa(e=[]){const t=Array.isArray(e)?e:[];return`
        <div class="candidate-block">
            <div class="candidate-label">章节可玩点树</div>
            <div class="chapter-play-tree">
                ${t.length?t.map((n,a)=>`
                        <article class="chapter-play-card">
                            <div class="chapter-play-header">
                                <span class="chapter-play-index">CH ${a+1}</span>
                                <strong>${l(n.title||`章节 ${a+1}`)}</strong>
                            </div>
                            <div class="chapter-play-body">
                                <p><span>冲突</span>${l(n.conflict||"待补充")}</p>
                                <p><span>风险</span>${l(n.stakes||"待补充")}</p>
                                <p><span>互动类型</span>${l((n.interactiveTypes||[]).join("、")||"待补充")}</p>
                                <p><span>关键节点</span>${l((n.keyNodes||[]).join("、")||"待补充")}</p>
                                <p><span>分支槽位</span>${l(String(n.branchSlotCount||0))}</p>
                            </div>
                        </article>
                    `).join(""):'<div class="relation-empty">当前还没有足够的章节可玩点。</div>'}
            </div>
        </div>
    `}const Kt=Object.freeze(Object.defineProperty({__proto__:null,getAdaptationModeLabel:Ae,initImportForm:Rt,initImportPreviewEditor:Ht,renderImportedProjectPreview:A,setImportPreviewStatus:f,setImportStatus:$,startImportedProjectSession:Zn},Symbol.toStringTag,{value:"Module"}));function Yt(){document.getElementById("generate-only-btn").addEventListener("click",async()=>{r.currentStepId&&await ca(r.currentStepId)}),document.getElementById("regenerate-btn").addEventListener("click",async()=>{await ht(prompt("请输入重生成补充要求（可留空）：")||"")}),document.getElementById("modify-btn").addEventListener("click",()=>{document.getElementById("custom-input-area").style.display="block",document.getElementById("custom-feedback").focus()}),document.getElementById("apply-custom-btn").addEventListener("click",async()=>{const e=document.getElementById("custom-feedback").value.trim();e&&(await ht(e),document.getElementById("custom-feedback").value="",document.getElementById("custom-input-area").style.display="none")}),document.getElementById("confirm-btn").addEventListener("click",async()=>{await pa()}),document.getElementById("skip-btn").addEventListener("click",async()=>{await fa()}),document.getElementById("gen-finalize-btn").addEventListener("click",async()=>{await ga()})}function X(){const e=document.getElementById("step-navigation");e.innerHTML="",r.allSteps.forEach(t=>{const n=M(t.id),a=K[t.id]||{icon:"?",name:t.name||t.id},i=document.createElement("button");i.type="button",i.className="step",t.id===r.currentStepId&&i.classList.add("active"),n.status==="confirmed"&&i.classList.add("completed"),n.status==="loading"&&i.classList.add("generating"),i.innerHTML=`<span class="step-icon">${a.icon}</span><span class="step-label">${t.name||a.name}</span>`,i.addEventListener("click",async()=>{await sa(t.id)}),e.appendChild(i)})}async function sa(e,t){r.currentStepId=e,X(),M(e);{z(e);return}}function z(e){const t=K[e]||{name:e,desc:""},n=M(e);document.getElementById("current-step-name").textContent=t.name,document.getElementById("current-step-desc").textContent=t.desc,document.getElementById("step-loading").style.display=n.status==="loading"?"flex":"none",document.getElementById("action-buttons").style.display="flex",Qt(e),Xt(),ve(e)}async function ca(e){var n;const t=M(e);t.status="loading",z(e),j("calling",`正在生成 ${((n=K[e])==null?void 0:n.name)||e}...`);try{const a=await p("/generate/step",v("POST",{sessionId:r.currentSessionId,stepId:e,options:{candidateCount:2}}));t.candidates=a.candidates||[],t.selectedIndex=-1,t.status="generated",t.history.push({id:Date.now(),timestamp:new Date,candidates:t.candidates.map(i=>structuredClone(i))}),j("success",`已生成 ${t.candidates.length} 个候选方案。`)}catch(a){console.error("Load step error:",a),t.status="error",j("error",a.message)}z(e)}function Qt(e){const t=document.getElementById("candidates-container"),n=M(e);if(t.innerHTML="",n.status!=="loading"){if(!n.candidates.length){t.innerHTML='<div class="candidate-card"><div class="candidate-empty">当前步骤还没有生成内容。点击下方"生成"开始。</div></div>';return}n.candidates.forEach((a,i)=>{const o=document.createElement("button");o.type="button",o.className="candidate-card",n.selectedIndex===i&&o.classList.add("selected"),o.innerHTML=`
            <div class="candidate-card-header">
                <strong>${l(la(e,a,i))}</strong>
                <span>方案 ${i+1}</span>
            </div>
            <div class="candidate-card-content">${da(e,a)}</div>
        `,o.addEventListener("click",()=>{n.selectedIndex=i,Qt(e),ve(e)}),t.appendChild(o)})}}function ve(e){const t=M(e),n=t.candidates.length>0;document.getElementById("confirm-btn").disabled=t.selectedIndex<0,document.getElementById("regenerate-btn").disabled=!n,document.getElementById("modify-btn").disabled=!n,document.getElementById("gen-finalize-btn").style.display=r.allSteps.every(a=>M(a.id).status==="confirmed")?"inline-block":"none"}function la(e,t,n){var a,i;return e==="worldview"?t.worldName||`世界观方案 ${n+1}`:e==="mainPlot"?t.title||`主线方案 ${n+1}`:e==="integration"?t.gameName||`整合方案 ${n+1}`:Array.isArray(t)?`${((a=K[e])==null?void 0:a.name)||e} · ${t.length} 项`:t.name||t.title||`${((i=K[e])==null?void 0:i.name)||e} 方案 ${n+1}`}function da(e,t){var n,a,i,o,s,d;if(t!=null&&t.error)return D("解析提示",t.error||"AI 响应暂时无法解析，请尝试重新生成。");if(typeof t=="string")return D("方案内容",t);switch(e){case"worldview":return[Q("世界名称",t.worldName),Q("时代背景",t.era),D("世界描述",t.description),vt("世界规则",t.rules),bt("主要势力",t.factions,["name","description"]),bt("重要地点",t.locations,["name","description"])].join("");case"mainPlot":return[Q("主线标题",t.title),Q("核心主题",t.theme),D("剧情概览",t.summary),D("引发事件",t.incitingIncident),ua("章节结构",(t.chapters||[]).map(m=>({title:m.name||m.title,body:`${m.goal||""}${m.description?`：${m.description}`:""}`}))),D("高潮",t.climax),D("结局说明",t.resolution)].join("");case"integration":return[Q("游戏名称",t.gameName),D("玩法设计",t.gameplayDesign),Q("战斗类型",(a=(n=t.gameSystems)==null?void 0:n.combatSystem)==null?void 0:a.type),vt("战斗机制",(o=(i=t.gameSystems)==null?void 0:i.combatSystem)==null?void 0:o.mechanics),D("开场场景",(s=t.openingScene)==null?void 0:s.description),D("开场旁白",(d=t.openingScene)==null?void 0:d.narration),D("平衡性说明",t.balancingNotes)].join("");default:return ma(t,e)}}function ma(e,t){const n=Array.isArray(e)?e:e?[e]:[];return n.length?n.map((a,i)=>{var m;const o=a.name||a.title||`${((m=K[t])==null?void 0:m.name)||"条目"} ${i+1}`,s=a.description||a.summary||a.role||a.type||"",d=[a.role?`<span class="candidate-chip">${l(a.role)}</span>`:"",a.location?`<span class="candidate-chip">${l(a.location)}</span>`:"",a.type?`<span class="candidate-chip">${l(a.type)}</span>`:"",a.rarity?`<span class="candidate-chip">${l(a.rarity)}</span>`:""].join("");return`
            <div class="candidate-item">
                <div class="candidate-item-title">${l(o)}</div>
                ${d?`<div class="candidate-chip-row">${d}</div>`:""}
                ${s?`<div class="candidate-item-body">${l(s)}</div>`:""}
            </div>
        `}).join(""):'<div class="candidate-empty">当前方案没有可展示的条目。</div>'}function Q(e,t){return t?`<div class="candidate-field"><span class="candidate-label">${l(e)}</span><span class="candidate-value">${l(t)}</span></div>`:""}function D(e,t){return t?`
        <div class="candidate-block">
            <div class="candidate-label">${l(e)}</div>
            <div class="candidate-paragraph">${l(t).replaceAll(`
`,"<br>")}</div>
        </div>
    `:""}function vt(e,t){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${l(e)}</div>
            <div class="candidate-chip-row">${t.map(n=>`<span class="candidate-chip">${l(n)}</span>`).join("")}</div>
        </div>
    `}function bt(e,t,n){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${l(e)}</div>
            ${t.map(a=>`
                <div class="candidate-item">
                    <div class="candidate-item-title">${l(a[n[0]]||"未命名")}</div>
                    ${a[n[1]]?`<div class="candidate-item-body">${l(a[n[1]])}</div>`:""}
                </div>
            `).join("")}
        </div>
    `}function ua(e,t){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${l(e)}</div>
            ${t.map(n=>`
                <div class="candidate-item">
                    <div class="candidate-item-title">${l(n.title||"未命名")}</div>
                    ${n.body?`<div class="candidate-item-body">${l(n.body)}</div>`:""}
                </div>
            `).join("")}
        </div>
    `}async function ht(e){var n;if(!r.currentStepId)return;const t=M(r.currentStepId);t.status="loading",z(r.currentStepId),j("calling",`正在重新生成 ${((n=K[r.currentStepId])==null?void 0:n.name)||r.currentStepId}...`);try{const a=await p("/generate/regenerate",v("POST",{sessionId:r.currentSessionId,stepId:r.currentStepId,feedback:e}));t.candidates=a.candidates||[],t.selectedIndex=-1,t.status="generated",t.history.push({id:Date.now(),timestamp:new Date,candidates:t.candidates.map(i=>structuredClone(i))}),j("success","已完成重新生成。")}catch(a){console.error("Regenerate error:",a),t.status="error",j("error",a.message)}z(r.currentStepId)}async function pa(){const e=M(r.currentStepId),t=e.candidates[e.selectedIndex];if(t)try{const n=await p("/generate/confirm",v("POST",{sessionId:r.currentSessionId,stepId:r.currentStepId,candidate:t}));e.status="confirmed",await Oe(),X(),n.nextStep?(r.currentStepId=n.nextStep,X(),z(n.nextStep),j("success",'已确认当前步骤。下一步不会自动生成，请按需点击"生成"。')):(j("success","所有步骤都已确认，可以整合生成游戏了。"),ve(r.currentStepId))}catch(n){console.error("Confirm step error:",n),alert(`确认失败：${n.message}`)}}async function fa(){try{const e=await p("/generate/confirm",v("POST",{sessionId:r.currentSessionId,stepId:r.currentStepId,candidate:{skipped:!0}}));M(r.currentStepId).status="confirmed",await Oe(),X(),e.nextStep?(r.currentStepId=e.nextStep,X(),z(e.nextStep)):ve(r.currentStepId)}catch(e){console.error("Skip step error:",e),alert(`跳过失败：${e.message}`)}}async function Oe(){var t,n,a,i,o,s,d;const e=document.getElementById("confirmed-elements");try{const c=(await p(`/generate/${r.currentSessionId}/status`)).memory||{},u=[];c.worldview&&u.push(H("世界观",c.worldview.worldName||"已确认")),(t=c.coreCharacters)!=null&&t.length&&u.push(H("核心角色",`${c.coreCharacters.length} 名`)),(n=c.secondaryCharacters)!=null&&n.length&&u.push(H("次要角色",`${c.secondaryCharacters.length} 名`)),(a=c.items)!=null&&a.length&&u.push(H("物品道具",`${c.items.length} 项`)),(i=c.puzzles)!=null&&i.length&&u.push(H("谜题挑战",`${c.puzzles.length} 项`)),c.mainPlot&&u.push(H("主线剧情",c.mainPlot.title||"已确认")),(o=c.sidePlots)!=null&&o.length&&u.push(H("支线剧情",`${c.sidePlots.length} 条`)),(s=c.fragments)!=null&&s.length&&u.push(H("碎片内容",`${c.fragments.length} 条`)),(d=c.integration)!=null&&d.gameName&&u.push(H("整合方案",c.integration.gameName)),e.innerHTML=u.join("")||'<p class="empty-hint">尚未确认任何内容。</p>'}catch(m){console.error("Render confirmed elements error:",m),e.innerHTML='<p class="empty-hint">获取已确认内容失败。</p>'}}function H(e,t){return`<div class="confirmed-item"><span class="confirmed-label">${e}</span><span class="confirmed-value">${t}</span></div>`}function Xt(){const e=document.getElementById("history-panel");if(!e)return;const t=[];for(const n of r.allSteps){const a=M(n.id);if(!a.history.length)continue;const i=a.history.slice().reverse().map(o=>`<div class="history-entry">${n.name||n.id} · ${o.timestamp.toLocaleTimeString()}</div>`).join("");t.push(`<div class="history-step">${i}</div>`)}e.innerHTML=t.join("")||'<p class="empty-hint">暂无生成记录。</p>'}async function ga(){var e;if(!r.currentSessionId){alert("当前没有生成会话。");return}j("calling","正在整合并生成最终游戏...");try{const t=await p(`/generate/${r.currentSessionId}/finalize`,v("POST",{config:_()}));r.currentGameId=t.gameId,r.currentGameData=t.gameData||null,r.currentGameType=((e=t.gameData)==null?void 0:e.type)||r.currentGameType,await(await L(()=>Promise.resolve().then(()=>se),void 0)).startGame(r.currentGameId),j("success","游戏已生成并启动。")}catch(t){j("error",t.message),alert(`整合失败：${t.message}`)}}const ya=Object.freeze(Object.defineProperty({__proto__:null,initWorkbench:Yt,renderConfirmedElements:Oe,renderCurrentStep:z,renderHistoryPanel:Xt,renderStepNavigation:X},Symbol.toStringTag,{value:"Module"})),Zt="rpg_autosave_enabled",va=6e4;let de=null;function Pe(){return localStorage.getItem(Zt)!=="false"}function ba(e){localStorage.setItem(Zt,String(e)),e?en():re()}function en(){re(),!(!Pe()||!r.currentGameId||!r.gameState)&&(de=window.setInterval(async()=>{if(!r.currentGameId||!r.gameState){re();return}await tn()},va))}function re(){de!==null&&(window.clearInterval(de),de=null)}async function tn(){var n,a;if(!r.currentGameId||!r.gameState)return;const e=document.getElementById("autosave-indicator"),t=document.getElementById("autosave-text");e&&(e.classList.add("visible","saving"),e.classList.remove("saved")),t&&(t.textContent="正在自动保存...");try{let i=null;try{i=await p(`/games/${r.currentGameId}`)}catch{}const o=me(r.currentGameId,(i==null?void 0:i.state)||r.gameState,{gameData:(i==null?void 0:i.game)||r.currentGameData,generationConfig:_(),type:r.currentGameType||((n=i==null?void 0:i.game)==null?void 0:n.type)||((a=r.gameState)==null?void 0:a.type)||"custom"});if(i!=null&&i.game&&(r.currentGameData=i.game),localStorage.setItem(`rpg_save_${r.currentGameId}`,JSON.stringify(o)),e&&(e.classList.remove("saving"),e.classList.add("saved")),t){const s=new Date;t.textContent=`已自动保存 ${s.getHours().toString().padStart(2,"0")}:${s.getMinutes().toString().padStart(2,"0")}`}setTimeout(()=>{e&&e.classList.remove("visible")},3e3)}catch(i){console.warn("Auto-save failed:",i),e&&e.classList.remove("saving","visible")}}function nn(){var n,a,i,o,s,d,m,c,u,g,h,b,w,P,N,I;Cn(),document.getElementById("send-btn").addEventListener("click",()=>Te()),document.getElementById("player-input").addEventListener("keydown",y=>{y.key==="Enter"&&Te()}),(n=document.getElementById("generate-scene-image-btn"))==null||n.addEventListener("click",async()=>{await Ta()}),(a=document.getElementById("scene-image-count"))==null||a.addEventListener("change",()=>{const y=document.getElementById("scene-image-count"),T=document.getElementById("comfyui-image-count"),C=String(Math.max(1,Math.min(8,Number(y.value)||1)));y.value=C,T&&(T.value=C),ee()}),(i=document.getElementById("live-comfyui-workflow-mode"))==null||i.addEventListener("change",()=>{jn()}),(o=document.getElementById("live-refresh-comfyui-btn"))==null||o.addEventListener("click",async()=>{await Gn(!0)}),(s=document.getElementById("live-refresh-workflow-files-btn"))==null||s.addEventListener("click",async()=>{await On(!0)}),(d=document.getElementById("live-load-workflow-btn"))==null||d.addEventListener("click",async()=>{await Dn(!0)}),(m=document.getElementById("live-test-comfyui-btn"))==null||m.addEventListener("click",async()=>{await Mn()}),(c=document.getElementById("live-validate-workflow-btn"))==null||c.addEventListener("click",async()=>{await Nn()}),(u=document.getElementById("live-comfyui-workflow-file"))==null||u.addEventListener("change",()=>{}),document.querySelectorAll("#live-image-config input, #live-image-config select, #live-image-config textarea").forEach(y=>{y.addEventListener("change",()=>{})}),document.getElementById("game-menu-btn").addEventListener("click",()=>{document.getElementById("game-menu-modal").classList.add("active")}),document.getElementById("save-game").addEventListener("click",async()=>{var T,C;const y=document.getElementById("save-game");if(r.gameState&&r.currentGameId){y&&y.classList.add("btn-loading");try{const R=await p(`/games/${r.currentGameId}`),Y=me(r.currentGameId,R.state||r.gameState,{gameData:R.game||r.currentGameData,generationConfig:_(),type:r.currentGameType||((T=R.game)==null?void 0:T.type)||((C=r.gameState)==null?void 0:C.type)||"custom"});r.currentGameData=R.game||r.currentGameData,localStorage.setItem(`rpg_save_${r.currentGameId}`,JSON.stringify(Y)),U("游戏进度已保存","success")}catch(R){console.error("Save game error:",R);const Y=me(r.currentGameId,r.gameState,{generationConfig:_()});localStorage.setItem(`rpg_save_${r.currentGameId}`,JSON.stringify(Y)),U("游戏进度已保存（未获取完整快照）","warning")}finally{y&&y.classList.remove("btn-loading")}}else U("没有可保存的游戏状态","warning");document.getElementById("game-menu-modal").classList.remove("active")}),document.getElementById("load-game").addEventListener("click",async()=>{if(!r.currentGameId){document.getElementById("game-menu-modal").classList.remove("active");return}ge(`rpg_save_${r.currentGameId}`)?(await xe(r.currentGameId),U("存档已加载","success")):U("没有找到存档","error"),document.getElementById("game-menu-modal").classList.remove("active")}),document.getElementById("restart-game").addEventListener("click",async()=>{r.currentGameId&&await an(r.currentGameId),document.getElementById("game-menu-modal").classList.remove("active")});const e=document.getElementById("autosave-toggle"),t=document.getElementById("autosave-toggle-switch");e&&t&&(Pe()?t.classList.add("active"):t.classList.remove("active"),e.addEventListener("click",()=>{const y=!Pe();ba(y),t.classList.toggle("active",y),U(y?"自动保存已开启":"自动保存已关闭","info")})),(g=document.getElementById("mobile-status-fab"))==null||g.addEventListener("click",()=>{const y=document.getElementById("mobile-status-overlay");y&&(ha(),y.classList.add("active"))}),(h=document.getElementById("mobile-status-close"))==null||h.addEventListener("click",()=>{var y;(y=document.getElementById("mobile-status-overlay"))==null||y.classList.remove("active")}),(b=document.getElementById("mobile-status-overlay"))==null||b.addEventListener("click",y=>{y.target.id==="mobile-status-overlay"&&y.target.classList.remove("active")}),(w=document.getElementById("mobile-nav-home"))==null||w.addEventListener("click",async()=>{var y,T;if((y=document.getElementById("game-menu-modal"))==null||y.classList.remove("active"),(T=document.getElementById("mobile-status-overlay"))==null||T.classList.remove("active"),r.currentGameId&&r.gameState&&confirm("确定退出当前游戏吗？未保存进度将会丢失。")){re(),Ea(),r.currentGameId=null,r.gameState=null;const C=await L(()=>Promise.resolve().then(()=>gn),void 0);C.showHomeScreen&&C.showHomeScreen()}}),(P=document.getElementById("mobile-nav-settings"))==null||P.addEventListener("click",()=>{var y;(y=document.getElementById("game-menu-modal"))==null||y.classList.add("active")}),(N=document.getElementById("mobile-nav-save"))==null||N.addEventListener("click",async()=>{r.gameState&&r.currentGameId&&(await tn(),U("游戏已保存","success"))}),(I=document.getElementById("scene-toggle-btn"))==null||I.addEventListener("click",()=>{const y=document.getElementById("scene-panel"),T=document.getElementById("scene-toggle-btn");if(!y||!T)return;const C=y.classList.toggle("collapsed");T.textContent=C?"▶ 展开场景图":"▼ 收起场景图"}),wa(),ae()}function ha(){if(!r.gameState)return;const t=document.getElementById("mobile-player-stats"),n=document.getElementById("player-stats");t&&n&&(t.innerHTML=n.innerHTML);const a=document.getElementById("mobile-inventory-list"),i=document.getElementById("inventory-list");a&&i&&(a.innerHTML=i.innerHTML);const o=document.getElementById("mobile-quest-list"),s=document.getElementById("quest-list");o&&s&&(o.innerHTML=s.innerHTML)}function wa(){const e=document.getElementById("swipe-back-zone");if(!e)return;let t=0,n=0,a=!1;e.addEventListener("touchstart",i=>{const o=i.touches[0];t=o.clientX,n=o.clientY,a=!0},{passive:!0}),e.addEventListener("touchmove",i=>{if(!a)return;const o=i.touches[0],s=o.clientX-t,d=Math.abs(o.clientY-n);if(s>80&&d<40){a=!1;const m=document.getElementById("exit-game");m&&m.click()}},{passive:!0}),e.addEventListener("touchend",()=>{a=!1},{passive:!0})}function Ia(e){const t=_e();t.clearCallbacks(),t.onImageReady(n=>{n!=null&&n.imageUrl&&(oe([n.imageUrl],n.prompt||r.lastSuggestedImagePrompt),W("场景图已自动更新。","success"))}),t.onGameUpdate(n=>{console.log("[Game] Received game update:",n)}),t.connect(),t.subscribe(e)}function Ea(){const e=_e();e.clearCallbacks(),e.disconnect()}async function an(e=r.currentGameId){if(e)try{const t=await p(`/games/${e}/start`,v("POST",{settings:q()}));r.currentGameId=e,r.gameState=t.gameState||null,r.sceneImages=[],r.selectedSceneImageIndex=0,r.activeSceneImage="",r.transitioningSceneImage="",r.currentVisualSignature="",document.getElementById("game-log").innerHTML="",be([]),oe([]),k("game-screen"),he(r.gameState),Ia(e)}catch(t){alert(`启动游戏失败：${t.message}`)}}async function Te(e=""){var o;if(!r.currentGameId)return;const t=document.getElementById("player-input"),n=document.getElementById("send-btn"),i=(typeof e=="string"?e:"")||(t==null?void 0:t.value.trim())||"";if(i){t&&(t.value=""),n&&(n.disabled=!0,n.classList.add("btn-loading")),F("player",i,"你"),Ba("player",i,"你");try{const s=_(),d=s.imageSource==="comfyui"?{...s,...fe()}:s;((o=r.settings)==null?void 0:o.enableStreaming)!==!1?await Sa(i,d):await ka(i,d)}catch(s){F("system",`行动处理失败：${s.message}`)}finally{n&&(n.disabled=!1,n.classList.remove("btn-loading"))}}}async function Sa(e,t){var m;const n=await fetch(`${dn}/games/${r.currentGameId}/action`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:e,imageConfig:t,streaming:!0,settings:q()})});if(!n.ok){let c=`HTTP ${n.status}`;try{const u=await n.json();c=u.error||u.message||c}catch{try{const g=(await n.text()).match(/"error"\s*:\s*"([^"]+)"/);g&&(c=g[1])}catch{}}throw new Error(c)}const a=n.body.getReader(),i=new TextDecoder;let o="",s="",d=null;for(;;){const{done:c,value:u}=await a.read();if(c)break;o+=i.decode(u,{stream:!0});const g=o.split(`
`);o=g.pop()||"";for(const h of g)if(!(!h.trim()||h==="data: [DONE]")&&h.startsWith("data: "))try{const b=JSON.parse(h.slice(6));b.type==="narration"?(d||(d=F("narrator","")),s=b.text,d.textContent=s):b.type==="complete"&&(Array.isArray((m=b.gameState)==null?void 0:m.lastDialogues)&&b.gameState.lastDialogues.forEach(w=>{w!=null&&w.content&&F("narrator",w.content,w.speaker||"角色")}),b.gameOver&&b.gameOverMessage&&F("system",b.gameOverMessage),be(b.choices||[]),he(b.gameState||r.gameState))}catch(b){console.error("解析流式数据失败:",b)}}}async function ka(e,t){var a,i;const n=await p(`/games/${r.currentGameId}/action`,v("POST",{action:e,imageConfig:t,settings:q()}));Array.isArray((a=n.gameState)==null?void 0:a.lastDialogues)&&n.gameState.lastDialogues.forEach(o=>{o!=null&&o.content&&F("narrator",o.content,o.speaker||"角色")}),n.response&&F("narrator",n.response),n.gameOver&&n.gameOverMessage&&F("system",n.gameOverMessage),be(n.choices||[]),he(n.gameState||r.gameState),n.sceneImage&&oe([n.sceneImage],((i=n.visualState)==null?void 0:i.prompt)||n.sceneDescription||n.response)}function F(e,t,n=""){const a=document.getElementById("game-log");if(!a)return null;const i=document.createElement("div");if(i.className=`log-entry ${e}`,n){const s=document.createElement("div");s.className="speaker",s.textContent=n,i.appendChild(s)}const o=document.createElement("div");return o.className="content",o.textContent=t,i.appendChild(o),a.appendChild(i),a.scrollTop=a.scrollHeight,o}function Ba(e,t,n=""){const a=document.getElementById("mobile-game-log");if(!a)return;const i=document.createElement("div");if(i.className=`log-entry ${e}`,n){const s=document.createElement("div");s.className="speaker",s.textContent=n,i.appendChild(s)}const o=document.createElement("div");for(o.className="content",o.textContent=t,i.appendChild(o),a.appendChild(i),a.scrollTop=a.scrollHeight;a.children.length>4;)a.removeChild(a.firstChild)}function be(e=[]){const t=document.getElementById("choices-container");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="";return}t.innerHTML=e.map((n,a)=>`
        <button type="button" class="choice-btn" data-choice-index="${a}">
            ${l(n.text||n.action||`选项 ${a+1}`)}
        </button>
    `).join(""),t.querySelectorAll("[data-choice-index]").forEach(n=>{n.addEventListener("click",async()=>{const a=Number(n.getAttribute("data-choice-index")),i=e[a];i&&await Te(i.action||i.text||"")})})}}function $a(e={}){const t=document.getElementById("player-stats");if(!t)return;const n=Object.entries(e||{});if(!n.length){t.innerHTML='<p class="empty-hint">暂无属性信息</p>';return}t.innerHTML=n.map(([a,i])=>{if(i&&typeof i=="object"&&Number.isFinite(i.current)&&Number.isFinite(i.max)){const o=i.max>0?Math.max(0,Math.min(100,i.current/i.max*100)):0;return`
                <div class="stat-item">
                    <div style="width:100%">
                        <span class="stat-name">${l(a)}</span>
                        <span class="stat-value" style="float:right">${i.current}/${i.max}</span>
                        <div class="stat-bar"><div class="stat-bar-fill hp" style="width:${o}%"></div></div>
                    </div>
                </div>
            `}return`
            <div class="stat-item">
                <span class="stat-name">${l(a)}</span>
                <span class="stat-value">${l(String(i))}</span>
            </div>
        `}).join("")}function La(e=[]){const t=document.getElementById("inventory-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="<li>暂无物品</li>";return}t.innerHTML=e.map(n=>`<li>${l(n.name||String(n))}</li>`).join("")}}function Pa(e=[]){const t=document.getElementById("quest-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="<li>暂无任务</li>";return}t.innerHTML=e.map(n=>`
        <li class="${n.completed?"completed":""}">
            ${l(n.name||n.description||"未命名任务")}
            ${n.progress?` · ${l(n.progress)}`:""}
        </li>
    `).join("")}}async function Ta(){var s,d;if(!r.currentGameId){W("Start the game before generating images.","error");return}const e=document.getElementById("scene-image-prompt"),t=document.getElementById("scene-image-count"),n=document.getElementById("comfyui-image-count"),a=(e==null?void 0:e.value.trim())||((s=r.gameState)==null?void 0:s.sceneDescription)||((d=r.gameState)==null?void 0:d.initialLog)||"",i=Math.max(1,Math.min(8,Number(t==null?void 0:t.value)||1));if(!a){W("No scene prompt available yet.","error");return}t&&(t.value=String(i)),n&&(n.value=String(i));const o=_().imageSource==="comfyui"?{..._(),...fe(),comfyuiImageCount:i}:{..._(),comfyuiImageCount:i};r.currentGenerationConfig=o,localStorage.setItem(ue,JSON.stringify(o)),gt(!0),W("Generating images with ComfyUI...","pending");try{const m=await p(`/games/${r.currentGameId}/generate-image`,v("POST",{prompt:a,count:i,comfyuiImageCount:i,...o}));r.selectedSceneImageIndex=0,oe(m.images||[],m.prompt||a),W(`Generated ${m.count||(m.images||[]).length} image(s).`,"success")}catch(m){console.error("Generate scene image error:",m),W(m.message,"error")}finally{gt(!1)}}function oe(e=[],t=""){r.sceneImages=Array.isArray(e)?e:[],r.selectedSceneImageIndex=0,t&&(r.lastSuggestedImagePrompt=t);const n=document.getElementById("scene-image-gallery");n&&(r.sceneImages.length?(n.innerHTML=r.sceneImages.map((i,o)=>`
                    <button
                        type="button"
                        class="scene-thumb ${o===r.selectedSceneImageIndex?"active":""}"
                        data-scene-thumb="${o}"
                    >
                        <img src="${B(i)}" alt="场景候选图 ${o+1}" />
                    </button>
                `).join(""),n.querySelectorAll("[data-scene-thumb]").forEach(i=>{i.addEventListener("click",()=>{const o=Number(i.getAttribute("data-scene-thumb"));Number.isNaN(o)||(r.selectedSceneImageIndex=o,wt(r.sceneImages[o]||""),n.querySelectorAll("[data-scene-thumb]").forEach(s=>{s.classList.toggle("active",Number(s.getAttribute("data-scene-thumb"))===o)}))})})):n.innerHTML=""),wt(r.sceneImages[r.selectedSceneImageIndex]||"");const a=document.getElementById("scene-image-prompt");a&&r.lastSuggestedImagePrompt&&!a.value.trim()&&(a.value=r.lastSuggestedImagePrompt)}function wt(e=""){const t=document.getElementById("scene-image");if(!t)return;if(!e){r.activeSceneImage="",r.transitioningSceneImage="",t.innerHTML='<div class="placeholder">场景图像将在这里显示</div>';return}if(!r.activeSceneImage){r.activeSceneImage=e,r.transitioningSceneImage="",t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${B(e)}" alt="场景图" />
            </div>
        `;return}if(r.activeSceneImage===e){t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${B(e)}" alt="场景图" />
            </div>
        `;return}r.transitioningSceneImage=e,r.sceneImageTransitionToken+=1;const n=r.sceneImageTransitionToken,a=new Image;a.onload=()=>{if(r.sceneImageTransitionToken!==n)return;t.innerHTML=`
            <div class="scene-image-layer scene-image-layer-back is-active">
                <img src="${B(r.activeSceneImage)}" alt="当前场景图" />
            </div>
            <div class="scene-image-layer scene-image-layer-front">
                <img src="${B(e)}" alt="下一场景图" />
            </div>
        `;const i=t.querySelector(".scene-image-layer-front");requestAnimationFrame(()=>{i==null||i.classList.add("is-active")}),window.setTimeout(()=>{r.sceneImageTransitionToken===n&&(r.activeSceneImage=e,r.transitioningSceneImage="",t.innerHTML=`
                <div class="scene-image-layer is-active">
                    <img src="${B(e)}" alt="场景图" />
                </div>
            `)},420)},a.onerror=()=>{r.sceneImageTransitionToken===n&&(r.activeSceneImage=e,r.transitioningSceneImage="",t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${B(e)}" alt="场景图" />
            </div>
        `)},a.src=e}function _a(e=r.gameState){return e?{chapterId:e.currentChapter??null,sceneNodeId:e.currentScene||null,plotBeatId:e.turn??null,playerState:e.player||{},worldState:e.worldState||{},relationshipState:e.characterStates||[],inventory:e.inventory||[],activeQuests:(e.quests||[]).filter(t=>t&&t.completed!==!0),visualState:e.visualState||null,history:(e.history||[]).slice(-20)}:null}function Ca(){!r.currentProjectId||!r.gameState||r.runtimeSnapshotSaving||(r.runtimeSnapshotTimer&&window.clearTimeout(r.runtimeSnapshotTimer),r.runtimeSnapshotTimer=window.setTimeout(async()=>{r.runtimeSnapshotSaving=!0;try{await p(`/projects/${r.currentProjectId}/runtime-snapshot`,v("POST",{runtimeSnapshot:_a(r.gameState)}))}catch(e){console.warn("Runtime snapshot save failed:",e.message)}finally{r.runtimeSnapshotSaving=!1}},800))}function he(e=r.gameState){var n,a;if(!e)return;r.gameState=e,r.currentVisualSignature=((n=e.visualState)==null?void 0:n.signature)||r.currentVisualSignature,document.getElementById("game-title").textContent=e.name||"AI 生成 RPG",document.getElementById("scene-description").textContent=e.sceneDescription||"";const t=document.getElementById("game-log");e.initialLog&&!t.children.length&&F("narrator",e.initialLog),$a(((a=e.player)==null?void 0:a.stats)||{}),La(e.inventory||[]),Pa(e.quests||[]),ae(),Ca(),en()}const se=Object.freeze(Object.defineProperty({__proto__:null,initGameScreen:nn,renderGameState:he,renderSceneImages:oe,showChoices:be,startGame:an,stopAutoSaveTimer:re},Symbol.toStringTag,{value:"Module"}));document.addEventListener("DOMContentLoaded",()=>{Et(),Ot(),Rn(),Dt(),Rt(),Ht(),Yt(),nn(),Wn(),xt()});
