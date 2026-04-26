(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function n(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(r){if(r.ep)return;r.ep=!0;const o=n(r);fetch(r.href,o)}})();const Bt=`${window.location.origin}/api`,Pt=window.localStorage.getItem("rpg_generator_api_base")||"",tt=(Pt||Bt).replace(/\/$/,"");async function nt(e){try{const t=await e.json();return(t==null?void 0:t.error)||(t==null?void 0:t.message)||`${e.status} ${e.statusText}`}catch{return`${e.status} ${e.statusText}`}}async function y(e,t={}){const n=await fetch(`${tt}${e}`,t);if(!n.ok)throw new Error(await nt(n));return n.json()}async function Lt(e,t={},n=null){const a=await fetch(`${tt}${e}`,t);if(!a.ok)throw new Error(await nt(a));const r=a.headers.get("content-type");return r&&r.includes("text/event-stream")?await jt(a,n):a.json()}async function jt(e,t){const n=e.body.getReader(),a=new TextDecoder;let r="",o=null;for(;;){const{done:l,value:u}=await n.read();if(l)break;r+=a.decode(u,{stream:!0});const m=r.split(`
`);r=m.pop()||"";for(const c of m)if(!(!c.trim()||!c.startsWith("data: ")))try{const d=JSON.parse(c.slice(6));if(d.type==="progress"&&t)t(d.percent,d.message);else if(d.type==="complete")o=d;else if(d.type==="error")throw new Error(d.message||"解析失败")}catch(d){throw d.message!=="解析失败"&&console.warn("Failed to parse SSE message:",c,d),d}}if(!o)throw new Error("未收到完整的响应数据");return o}function v(e,t){return{method:e,headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}}const at={openai:{apiUrl:{id:"openai-url",fallback:"https://api.openai.com/v1"},apiKey:{id:"openai-key"},model:{id:"openai-model",fallback:"gpt-4o"}},anthropic:{apiKey:{id:"anthropic-key"},model:{id:"anthropic-model",fallback:"claude-3-5-sonnet-20241022"}},local:{apiUrl:{id:"ollama-url",fallback:"http://localhost:11434"},model:{id:"ollama-model",fallback:"llama3"}},custom:{apiUrl:{id:"custom-url"},apiKey:{id:"custom-key"},model:{id:"custom-model"}}},it={difficulty:{id:"game-difficulty",fallback:"normal"},length:{id:"game-length",fallback:"medium"},enableImages:{id:"enable-images",type:"checkbox",fallback:!0},imageSource:{id:"image-source",fallback:"comfyui"},imageGenerationMode:{id:"image-generation-mode",fallback:"manual"},comfyuiUrl:{id:"comfyui-url",fallback:"http://127.0.0.1:8000"},comfyuiImageCount:{id:"comfyui-image-count",fallback:"1"},comfyuiModel:{id:"comfyui-model",fallback:""},comfyuiSampler:{id:"comfyui-sampler",fallback:"euler"},comfyuiScheduler:{id:"comfyui-scheduler",fallback:"normal"},comfyuiWidth:{id:"comfyui-width",fallback:"768"},comfyuiHeight:{id:"comfyui-height",fallback:"512"},comfyuiSteps:{id:"comfyui-steps",fallback:"20"},comfyuiCfg:{id:"comfyui-cfg",fallback:"7.5"},comfyuiSeed:{id:"comfyui-seed",fallback:"-1"},comfyuiTimeoutMs:{id:"comfyui-timeout-ms",fallback:"180000"},comfyuiPromptPrefix:{id:"comfyui-prompt-prefix",fallback:"RPG game scene"},comfyuiPromptSuffix:{id:"comfyui-prompt-suffix",fallback:"high quality, detailed, fantasy art style"},comfyuiNegativePrompt:{id:"comfyui-negative-prompt",fallback:"low quality, blurry, deformed, ugly, bad anatomy, watermark, text"},comfyuiFilenamePrefix:{id:"comfyui-filename-prefix",fallback:"rpg_scene"},comfyuiWorkflowMode:{id:"comfyui-workflow-mode",fallback:"custom"},comfyuiWorkflowFile:{id:"comfyui-workflow-file",fallback:""},comfyuiWorkflowJson:{id:"comfyui-workflow-json",fallback:""},imageApiUrl:{id:"image-api-url",fallback:""},imageApiKey:{id:"image-api-key",fallback:""}};function xt(e,t){var n;return((n=t.getElementById(e))==null?void 0:n.value)||""}function Tt(e,t){const n=t.getElementById(e.id);return n?e.type==="checkbox"?n.checked:n.value||e.fallback||"":e.fallback}function Ct(e,t,n){const a=n.getElementById(e);a&&t!==void 0&&(a.value=t)}function At(e,t,n){const a=n.getElementById(e.id);if(!(!a||t===void 0)){if(e.type==="checkbox"){a.checked=!!t;return}a.value=t}}function Y(e=null,t=document){const n=e||t.getElementById("llm-source").value,a=at[n]||{},r={llmSource:n};for(const[o,l]of Object.entries(a))r[o]=xt(l.id,t)||l.fallback||"";return r}function Gt(e,t=document){const n=e.llmSource||"openai";t.getElementById("llm-source").value=n,t.getElementById("llm-source").dispatchEvent(new Event("change"));const a=at[n]||{};for(const[r,o]of Object.entries(a))Ct(o.id,e[r]||o.fallback||"",t)}function _(e=document){const t={settings:Y(null,e)};for(const[n,a]of Object.entries(it))t[n]=Tt(a,e);return t}function Ve(e={},t=document){for(const[n,a]of Object.entries(it))At(a,e[n]??a.fallback,t)}const Dt="/api",i={currentGameType:null,currentProjectId:null,currentProjectData:null,currentGameId:null,currentGameData:null,gameState:null,currentGenerationConfig:null,currentSessionId:null,currentStepId:null,allSteps:[],stepStates:{},sceneImages:[],selectedSceneImageIndex:0,lastSuggestedImagePrompt:"",activeSceneImage:"",transitioningSceneImage:"",currentVisualSignature:"",sceneImageTransitionToken:0,runtimeSnapshotTimer:null,runtimeSnapshotSaving:!1},rt="rpg_generator_settings",X="rpg_generator_generation_settings",J={adventure:"冒险 RPG",dungeon:"地牢探索",romance:"恋爱模拟",mystery:"推理解谜",fantasy:"奇幻魔法",scifi:"科幻星际",survival:"生存挑战",kingdom:"王国建设",cultivation:"修仙问道",custom:"自定义 RPG"},Mt={faithful:"忠于原著",balanced:"平衡改编",free:"高自由互动"},H={worldview:{icon:"世",name:"世界观",desc:"先确定世界背景、主要势力、地点与规则。"},coreCharacters:{icon:"核",name:"核心角色",desc:"生成推动主线的关键角色。"},secondaryCharacters:{icon:"辅",name:"次要角色",desc:"补充世界细节与互动节点。"},items:{icon:"物",name:"物品道具",desc:"生成装备、任务物品和关键奖励。"},puzzles:{icon:"谜",name:"谜题挑战",desc:"设计挑战、机关和探索障碍。"},mainPlot:{icon:"主",name:"主线剧情",desc:"组织章节推进与核心冲突。"},sidePlots:{icon:"支",name:"支线剧情",desc:"补充可选故事和人物支线。"},fragments:{icon:"碎",name:"碎片内容",desc:"生成可探索的世界细节与传闻。"},integration:{icon:"整",name:"整合方案",desc:"把已确认内容整合成最终可玩的方案。"}};document.addEventListener("DOMContentLoaded",()=>{_t(),Ut(),qt(),Vt(),Kt(),Xt(),gn(),jn(),Ft(),ct()});function T(e){return i.stepStates[e]||(i.stepStates[e]={candidates:[],selectedIndex:-1,status:"idle",history:[]}),i.stepStates[e]}function E(e){var t;document.querySelectorAll(".screen").forEach(n=>n.classList.remove("active")),(t=document.getElementById(e))==null||t.classList.add("active")}function $(e,t){const n=document.getElementById("api-status-dot"),a=document.getElementById("api-status-text");n&&(n.className="status-dot",n.classList.add(`status-${e}`)),a&&(a.textContent=t)}function re(){const e=document.getElementById("image-source").value;document.getElementById("comfyui-settings").style.display=e==="comfyui"?"block":"none",document.getElementById("api-settings").style.display=e==="api"?"block":"none",ot()}function Nt(){const e=document.getElementById("comfyui-settings");!e||e.dataset.enhanced==="true"||(e.innerHTML=`
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
    `,e.dataset.enhanced="true")}function Ot(){const e=document.getElementById("live-image-config");!e||e.dataset.enhanced==="true"||(e.innerHTML=`
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
    `,e.dataset.enhanced="true")}function Ht(){const e=document.getElementById("live-comfyui-workflow-mode"),t=document.getElementById("live-comfyui-custom-workflow");!e||!t||(t.style.display=e.value==="custom"?"block":"none")}function ot(){const e=document.getElementById("comfyui-workflow-mode"),t=document.getElementById("comfyui-custom-workflow"),n=document.getElementById("comfyui-default-workflow-fields");if(!e||!t||!n)return;const a=e.value==="custom";t.style.display=a?"block":"none",n.style.display=a?"none":"block"}function Z(){var e,t,n,a,r,o,l,u,m,c,d,g,f,b,h,S,O,I;return{imageSource:k().imageSource,imageGenerationMode:k().imageGenerationMode,comfyuiUrl:((e=document.getElementById("live-comfyui-url"))==null?void 0:e.value)||"http://127.0.0.1:8000",comfyuiImageCount:((t=document.getElementById("scene-image-count"))==null?void 0:t.value)||"1",comfyuiModel:((n=document.getElementById("live-comfyui-model"))==null?void 0:n.value)||"",comfyuiSampler:((a=document.getElementById("live-comfyui-sampler"))==null?void 0:a.value)||"euler",comfyuiScheduler:((r=document.getElementById("live-comfyui-scheduler"))==null?void 0:r.value)||"normal",comfyuiWidth:((o=document.getElementById("live-comfyui-width"))==null?void 0:o.value)||"768",comfyuiHeight:((l=document.getElementById("live-comfyui-height"))==null?void 0:l.value)||"512",comfyuiSteps:((u=document.getElementById("live-comfyui-steps"))==null?void 0:u.value)||"20",comfyuiCfg:((m=document.getElementById("live-comfyui-cfg"))==null?void 0:m.value)||"7.5",comfyuiSeed:((c=document.getElementById("live-comfyui-seed"))==null?void 0:c.value)||"-1",comfyuiTimeoutMs:((d=document.getElementById("live-comfyui-timeout-ms"))==null?void 0:d.value)||"180000",comfyuiPromptPrefix:((g=document.getElementById("live-comfyui-prompt-prefix"))==null?void 0:g.value)||"",comfyuiPromptSuffix:((f=document.getElementById("live-comfyui-prompt-suffix"))==null?void 0:f.value)||"",comfyuiNegativePrompt:((b=document.getElementById("live-comfyui-negative-prompt"))==null?void 0:b.value)||"",comfyuiFilenamePrefix:((h=document.getElementById("live-comfyui-filename-prefix"))==null?void 0:h.value)||"",comfyuiWorkflowMode:((S=document.getElementById("live-comfyui-workflow-mode"))==null?void 0:S.value)||"custom",comfyuiWorkflowFile:((O=document.getElementById("live-comfyui-workflow-file"))==null?void 0:O.value)||"",comfyuiWorkflowJson:((I=document.getElementById("live-comfyui-workflow-json"))==null?void 0:I.value)||""}}function oe(e,t=""){const n=document.getElementById("comfyui-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function B(e={}){const t={...e};return(!t.comfyuiUrl||t.comfyuiUrl==="http://127.0.0.1:8188")&&(t.comfyuiUrl="http://127.0.0.1:8000"),t.imageGenerationMode||(t.imageGenerationMode="manual"),t.comfyuiWorkflowMode||(t.comfyuiWorkflowMode="custom"),t.comfyuiImageCount||(t.comfyuiImageCount="1"),t}function ce(){const e=document.getElementById("llm-source").value;document.querySelectorAll(".api-config").forEach(n=>{n.style.display="none"});const t=document.getElementById(`${e}-config`);t&&(t.style.display="block")}function _t(){var e,t,n;document.querySelectorAll(".type-card").forEach(a=>{a.addEventListener("click",()=>{i.currentGameType=a.dataset.type,i.currentProjectId=null,i.currentProjectData=null,document.querySelectorAll(".type-card").forEach(r=>r.classList.remove("selected")),a.classList.add("selected"),document.getElementById("config-title").textContent=`配置你的${J[i.currentGameType]||"RPG"}游戏`,E("config-screen")})}),document.getElementById("back-to-home").addEventListener("click",()=>{ae()}),(e=document.getElementById("back-from-import"))==null||e.addEventListener("click",()=>{ae()}),(t=document.getElementById("back-to-import-edit"))==null||t.addEventListener("click",()=>E("import-screen")),(n=document.getElementById("confirm-import-preview"))==null||n.addEventListener("click",async()=>{await mn()}),document.getElementById("gen-back-to-config").addEventListener("click",()=>{E(i.currentProjectId?"import-screen":"config-screen")}),document.getElementById("exit-game").addEventListener("click",()=>{confirm("确定退出当前游戏吗？未保存进度将会丢失。")&&(i.currentGameId=null,i.gameState=null,ae())})}function ae(){E("home-screen"),document.getElementById("game-types-section").style.display="block",document.getElementById("examples-section").style.display="none"}function Ft(){var t,n,a,r;const e=[{id:"example-fantasy",title:"魔法学院：新生之旅",type:"fantasy",icon:"🧙",description:"进入神秘的魔法学院，学习咒语，结交朋友，揭开学院隐藏的秘密。",stats:{chapters:8,characters:12,duration:"2-3小时"}},{id:"example-scifi",title:"星际迷航：未知星域",type:"scifi",icon:"🚀",description:"驾驶飞船探索未知星系，与外星种族交流，解决星际危机。",stats:{chapters:10,characters:15,duration:"3-4小时"}},{id:"example-mystery",title:"侦探事务所：失踪案",type:"mystery",icon:"🔍",description:"调查一起离奇失踪案，收集线索，推理真相，找出幕后黑手。",stats:{chapters:6,characters:10,duration:"2小时"}}];(t=document.getElementById("quick-start-btn"))==null||t.addEventListener("click",()=>{document.getElementById("game-types-section").style.display="block",document.getElementById("examples-section").style.display="none",document.getElementById("game-types-section").scrollIntoView({behavior:"smooth"})}),(n=document.getElementById("browse-examples-btn"))==null||n.addEventListener("click",()=>{Rt(e),document.getElementById("game-types-section").style.display="none",document.getElementById("examples-section").style.display="block",document.getElementById("examples-section").scrollIntoView({behavior:"smooth"})}),(a=document.getElementById("import-novel-btn"))==null||a.addEventListener("click",()=>{w("导入后会自动创建项目，并预填到现有生成流程中。"),E("import-screen")}),(r=document.getElementById("close-examples"))==null||r.addEventListener("click",()=>{document.getElementById("game-types-section").style.display="block",document.getElementById("examples-section").style.display="none",window.scrollTo({top:0,behavior:"smooth"})})}function Rt(e){const t=document.getElementById("examples-grid");t&&(t.innerHTML=e.map(n=>`
        <div class="example-card" data-example-id="${n.id}" data-type="${n.type}">
            <div class="example-cover">
                <span style="position: relative; z-index: 1;">${n.icon}</span>
            </div>
            <div class="example-content">
                <h3 class="example-title">${n.title}</h3>
                <span class="example-type">${J[n.type]}</span>
                <p class="example-description">${n.description}</p>
                <div class="example-stats">
                    <span class="example-stat">📖 ${n.stats.chapters} 章节</span>
                    <span class="example-stat">👥 ${n.stats.characters} 角色</span>
                    <span class="example-stat">⏱️ ${n.stats.duration}</span>
                </div>
            </div>
        </div>
    `).join(""),t.querySelectorAll(".example-card").forEach(n=>{n.addEventListener("click",()=>{const a=n.dataset.type;i.currentGameType=a,i.currentProjectId=null,i.currentProjectData=null,document.getElementById("config-title").textContent=`配置你的${J[a]||"RPG"}游戏`;const r=n.dataset.exampleId,o=e.find(l=>l.id===r);o&&(document.getElementById("game-name").value=o.title,document.getElementById("game-description").value=o.description),E("config-screen")})}))}function Ut(){const e=document.getElementById("load-saved-games-btn"),t=document.getElementById("close-saved-games");e==null||e.addEventListener("click",()=>{zt();const n=document.getElementById("saved-games-section");n&&(n.style.display="block")}),t==null||t.addEventListener("click",()=>{const n=document.getElementById("saved-games-section");n&&(n.style.display="none")})}function qt(){var n,a,r,o,l,u,m;const e=document.getElementById("settings-modal"),t=document.getElementById("game-menu-modal");Nt(),document.getElementById("settings-btn").addEventListener("click",()=>{e.classList.add("active"),ct()}),e.querySelector(".modal-close").addEventListener("click",()=>{e.classList.remove("active")}),t.querySelector(".modal-close").addEventListener("click",()=>{t.classList.remove("active")}),document.getElementById("save-settings").addEventListener("click",()=>{Jt(),e.classList.remove("active")}),document.getElementById("llm-source").addEventListener("change",ce),document.getElementById("image-source").addEventListener("change",async()=>{re(),A(),document.getElementById("image-source").value==="comfyui"&&await refreshComfyUIOptions(!1)}),(n=document.getElementById("comfyui-workflow-mode"))==null||n.addEventListener("change",()=>{ot(),A()}),(a=document.getElementById("refresh-comfyui-btn"))==null||a.addEventListener("click",async()=>{await refreshComfyUIOptions(!0)}),(r=document.getElementById("refresh-workflow-files-btn"))==null||r.addEventListener("click",async()=>{await refreshComfyWorkflowFiles(!0)}),(o=document.getElementById("load-workflow-file-btn"))==null||o.addEventListener("click",async()=>{await loadSelectedComfyWorkflowFile(!0)}),(l=document.getElementById("test-comfyui-btn"))==null||l.addEventListener("click",async()=>{await testComfyUIConnection()}),(u=document.getElementById("validate-workflow-btn"))==null||u.addEventListener("click",async()=>{await validateComfyUIWorkflow()}),(m=document.getElementById("comfyui-workflow-file"))==null||m.addEventListener("change",c=>{var f;const d=((f=c.target)==null?void 0:f.value)||"",g=document.getElementById("comfyui-workflow-file");g&&(g.dataset.selectedWorkflow=d),A(),d&&oe(`Selected workflow: ${d}`,"success")}),document.getElementById("test-openai-btn").addEventListener("click",()=>Q("openai")),document.getElementById("test-anthropic-btn").addEventListener("click",()=>Q("anthropic")),document.getElementById("test-local-btn").addEventListener("click",()=>Q("local")),document.getElementById("test-custom-btn").addEventListener("click",()=>Q("custom")),document.querySelectorAll('[data-generation-setting="true"]').forEach(c=>{c.addEventListener("change",()=>{A(),z()})}),document.getElementById("enable-images").addEventListener("change",()=>{A(),z()}),ce(),re()}function Jt(){localStorage.setItem(rt,JSON.stringify(Y())),A()}function ct(){const e=localStorage.getItem(rt),t=localStorage.getItem(X);try{e&&Gt(JSON.parse(e)),Ve(B(t?JSON.parse(t):{})),i.currentGenerationConfig=_(),ce(),re(),z(),i.currentGenerationConfig.imageSource==="comfyui"&&i.currentGenerationConfig.enableImages!==!1&&(refreshComfyUIOptions(!1).catch(n=>{oe(n.message,"error")}),refreshComfyWorkflowFiles(!1).then(()=>{var r;const n=(r=i.currentGenerationConfig)==null?void 0:r.comfyuiWorkflowFile,a=document.getElementById("comfyui-workflow-json");return n&&a&&!a.value.trim()?loadSelectedComfyWorkflowFile(!1,n):null}).catch(n=>{oe(n.message,"error")}))}catch(n){console.error("Load settings error:",n)}}function A(){const e=B(_());i.currentGenerationConfig=e,localStorage.setItem(X,JSON.stringify(e))}function Ke(e,t,n={}){return{version:1,gameId:e,title:n.title||(t==null?void 0:t.name)||"未命名存档",type:n.type||i.currentGameType||(t==null?void 0:t.type)||"custom",savedAt:new Date().toISOString(),gameData:n.gameData||i.currentGameData||null,generationConfig:B(n.generationConfig||i.currentGenerationConfig||_()),gameState:t}}function de(e){var n,a;const t=localStorage.getItem(e);if(!t)return null;try{const r=JSON.parse(t),o=e.replace(/^rpg_save_/,"");return r&&r.version===1&&r.gameState?{gameId:r.gameId||o,title:r.title||((n=r.gameState)==null?void 0:n.name)||"未命名存档",type:r.type||((a=r.gameState)==null?void 0:a.type)||"custom",savedAt:r.savedAt||null,gameData:r.gameData||null,generationConfig:r.generationConfig?B(r.generationConfig):null,gameState:r.gameState}:{gameId:o,title:(r==null?void 0:r.name)||"旧版存档",type:(r==null?void 0:r.type)||"custom",savedAt:null,gameData:null,generationConfig:null,gameState:r}}catch(r){return console.error("Read saved game error:",r),null}}function Wt(){return Object.keys(localStorage).filter(e=>e.startsWith("rpg_save_")).map(e=>de(e)).filter(Boolean).sort((e,t)=>{const n=e.savedAt?new Date(e.savedAt).getTime():0;return(t.savedAt?new Date(t.savedAt).getTime():0)-n})}function zt(){const e=document.getElementById("saved-games-list");if(!e)return;const t=Wt();if(!t.length){e.innerHTML='<p class="empty-hint">暂无存档</p>';return}e.innerHTML=t.map(n=>`
        <button type="button" class="saved-game-card" data-saved-game-id="${s(n.gameId)}">
            <div class="saved-game-header">
                <span class="saved-game-name">${s(n.title||"未命名存档")}</span>
                <span class="saved-game-type">${s(J[n.type]||n.type||"存档")}</span>
            </div>
            <div class="saved-game-info">ID: ${s(n.gameId)}</div>
            <div class="saved-game-time">${s(n.savedAt?new Date(n.savedAt).toLocaleString():"旧版存档")}</div>
        </button>
    `).join(""),e.querySelectorAll("[data-saved-game-id]").forEach(n=>{n.addEventListener("click",async()=>{await st(n.dataset.savedGameId)})})}async function st(e){const t=de(`rpg_save_${e}`);if(!(t!=null&&t.gameState)){alert("没有找到可读取的存档。");return}let n=!1;try{const r=await y(`/games/${t.gameId}`);i.currentGameData=r.game||t.gameData||null,n=!0}catch{if(t.gameData&&t.generationConfig)try{const o=await y("/games/restore",v("POST",{gameId:t.gameId,gameData:t.gameData,gameState:t.gameState,config:B(t.generationConfig)}));t.gameId=o.gameId||t.gameId,t.gameState=o.gameState||t.gameState,i.currentGameData=t.gameData,n=!0}catch(o){console.error("Restore saved game error:",o)}}i.currentGameId=t.gameId,i.currentGameType=t.type||i.currentGameType,i.gameState=t.gameState,i.sceneImages=[],i.selectedSceneImageIndex=0,t.generationConfig&&(i.currentGenerationConfig=B(t.generationConfig),localStorage.setItem(X,JSON.stringify(i.currentGenerationConfig))),E("game-screen"),K(t.gameState),V([]),n||alert("这个存档已载入画面，但后端运行态未成功恢复。请重新开始后再保存一次，之后即可正常续玩。");const a=document.getElementById("saved-games-section");a&&(a.style.display="none")}function Vt(){document.getElementById("game-config-form").addEventListener("submit",async e=>{if(e.preventDefault(),!i.currentGameType){alert("请先选择一个游戏类型。"),E("home-screen");return}await Yt()})}function Kt(){var e,t,n;(e=document.getElementById("import-project-form"))==null||e.addEventListener("submit",async a=>{a.preventDefault(),await dn()}),(t=document.getElementById("import-package-btn"))==null||t.addEventListener("click",async()=>{await Qt()}),(n=document.getElementById("refresh-import-projects"))==null||n.addEventListener("click",async()=>{await W()}),W().catch(a=>{console.error("Load imported projects error:",a)})}function lt(e){return Mt[e]||e||"未设置"}async function Qt(){var n,a,r;const e=document.getElementById("import-package-file"),t=(n=e==null?void 0:e.files)==null?void 0:n[0];if(!t){w("请先选择一个项目包 JSON 文件。","error");return}w("正在解析并导入项目包...","pending");try{const o=await t.text(),l=JSON.parse(o),u=await y("/projects/import-package",v("POST",{package:l}));i.currentProjectId=((a=u.project)==null?void 0:a.id)||null,i.currentProjectData=u.project||null,i.currentGameType=((r=u.project)==null?void 0:r.gameType)||i.currentGameType||"custom",i.currentProjectData&&(document.getElementById("import-title").value=i.currentProjectData.title||""),C(i.currentProjectData),await W(),E("import-preview-screen"),w("项目包导入成功。","success"),p("项目包已恢复，可以继续调整后进入工作台。","success")}catch(o){w(`导入失败：${o.message}`,"error")}}function w(e,t=""){const n=document.getElementById("import-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}async function dt(e){var t;i.currentSessionId=e.sessionId,i.allSteps=e.steps||[],i.currentStepId=e.firstStep||((t=i.allSteps[0])==null?void 0:t.id)||null,i.stepStates={},E("generation-workbench"),R(),await ue(),N(i.currentStepId),ht(),$("idle","已创建生成会话，点击“生成”开始当前步骤。")}async function Yt(){const e=B(_());i.currentGenerationConfig=e,A();const t={userInput:document.getElementById("game-description").value.trim()||"暂无额外描述",gameType:i.currentGameType,config:e};try{const n=await y("/generate/init",v("POST",t));i.currentProjectId=null,i.currentProjectData=null,await dt(n);return}catch(n){console.error("Session init error:",n),alert(`初始化失败：${n.message}`),E("config-screen")}}function Xt(){var e,t,n,a,r,o,l,u,m;(e=document.getElementById("save-import-preview"))==null||e.addEventListener("click",async()=>{await me()}),(t=document.getElementById("optimize-project-btn"))==null||t.addEventListener("click",async()=>{await se()}),(n=document.getElementById("resume-project-play"))==null||n.addEventListener("click",async()=>{await mt()}),(a=document.getElementById("generate-base-assets"))==null||a.addEventListener("click",async()=>{await ut()}),(r=document.getElementById("rebuild-adaptation-btn"))==null||r.addEventListener("click",async()=>{await gt()}),(o=document.getElementById("rebuild-visual-bible-btn"))==null||o.addEventListener("click",async()=>{await yt()}),(l=document.getElementById("apply-project-refinement-btn"))==null||l.addEventListener("click",async()=>{await ft()}),(u=document.getElementById("export-project-package-btn"))==null||u.addEventListener("click",async()=>{await vt()}),(m=document.getElementById("import-preview-screen"))==null||m.addEventListener("click",c=>{const d=c.target.closest("[data-preview-action]");d&&rn(d.dataset.previewAction,d)})}function p(e,t=""){const n=document.getElementById("import-preview-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function Zt(e){return JSON.parse(JSON.stringify(e||{}))}function en(e=0){return{id:`draft_char_${Date.now()}_${e}`,name:"",role:"",description:""}}function tn(e=0){return{id:`draft_chapter_${Date.now()}_${e}`,title:`新章节 ${e+1}`,summary:""}}function nn(e=0){return{id:`draft_location_${Date.now()}_${e}`,name:"",description:""}}function an(){const e=Zt(i.currentProjectData),t=ee();return e.storyBible=e.storyBible||{},e.source=e.source||{},e.title=t.title||e.title||"",e.storyBible.summary=t.summary||e.storyBible.summary||"",e.storyBible.characters=t.characters,e.storyBible.chapters=t.chapters,e.storyBible.locations=t.locations,e.source.title=e.title||e.source.title||"",e}function rn(e,t){if(!e||!i.currentProjectData)return;const n=an();if(n.storyBible=n.storyBible||{},e==="add-character"){const a=Array.isArray(n.storyBible.characters)?n.storyBible.characters:[];a.push(en(a.length)),n.storyBible.characters=a}if(e==="remove-character"){const a=t.closest('[data-preview-item="character"]'),r=Number((a==null?void 0:a.dataset.index)??-1);n.storyBible.characters=(n.storyBible.characters||[]).filter((o,l)=>l!==r)}if(e==="add-chapter"){const a=Array.isArray(n.storyBible.chapters)?n.storyBible.chapters:[];a.push(tn(a.length)),n.storyBible.chapters=a}if(e==="remove-chapter"){const a=t.closest('[data-preview-item="chapter"]'),r=Number((a==null?void 0:a.dataset.index)??-1);n.storyBible.chapters=(n.storyBible.chapters||[]).filter((o,l)=>l!==r)}if(e==="add-location"){const a=Array.isArray(n.storyBible.locations)?n.storyBible.locations:[];a.push(nn(a.length)),n.storyBible.locations=a}if(e==="remove-location"){const a=t.closest('[data-preview-item="location"]'),r=Number((a==null?void 0:a.dataset.index)??-1);n.storyBible.locations=(n.storyBible.locations||[]).filter((o,l)=>l!==r)}i.currentProjectData=n,C(n),p("本地预览已更新，记得保存后再进入工作台。","pending")}function ie(e,t){return Array.from(document.querySelectorAll(`[data-preview-collection="${e}"] [data-preview-item="${e}"]`)).map((n,a)=>t(n,a))}function ee(){var e,t,n,a,r,o,l,u,m;return{title:((e=document.getElementById("import-preview-title"))==null?void 0:e.value.trim())||((t=i.currentProjectData)==null?void 0:t.title)||"",summary:((n=document.getElementById("import-preview-summary-input"))==null?void 0:n.value.trim())||((r=(a=i.currentProjectData)==null?void 0:a.storyBible)==null?void 0:r.summary)||"",adaptationMode:((o=document.getElementById("import-preview-adaptation-mode"))==null?void 0:o.value)||((l=i.currentProjectData)==null?void 0:l.adaptationMode)||"balanced",gameType:((u=document.getElementById("import-preview-game-type"))==null?void 0:u.value)||((m=i.currentProjectData)==null?void 0:m.gameType)||i.currentGameType||"custom",characters:ie("character",(c,d)=>{var g,f,b;return{id:c.dataset.itemId||`import_char_${d+1}`,name:((g=c.querySelector('[data-field="name"]'))==null?void 0:g.value.trim())||"",role:((f=c.querySelector('[data-field="role"]'))==null?void 0:f.value.trim())||"",description:((b=c.querySelector('[data-field="description"]'))==null?void 0:b.value.trim())||""}}).filter(c=>c.name||c.role||c.description),chapters:ie("chapter",(c,d)=>{var g,f;return{id:c.dataset.itemId||`chapter_${d+1}`,title:((g=c.querySelector('[data-field="title"]'))==null?void 0:g.value.trim())||`章节 ${d+1}`,summary:((f=c.querySelector('[data-field="summary"]'))==null?void 0:f.value.trim())||""}}).filter(c=>c.title||c.summary),locations:ie("location",(c,d)=>{var g,f;return{id:c.dataset.itemId||`import_loc_${d+1}`,name:((g=c.querySelector('[data-field="name"]'))==null?void 0:g.value.trim())||"",description:((f=c.querySelector('[data-field="description"]'))==null?void 0:f.value.trim())||""}}).filter(c=>c.name||c.description)}}function C(e=i.currentProjectData){var pe,ge,ye,fe,ve,be,he,Ie,we,Ee,Se,$e,ke,Be,Pe,Le,je,xe,Te,Ce,Ae,Ge,De,Me,Ne,Oe,He,_e,Fe,Re,Ue,qe,Je,We;if(!e)return;const t=document.getElementById("import-preview-summary"),n=document.getElementById("import-preview-characters"),a=document.getElementById("import-preview-chapters"),r=document.getElementById("import-preview-visuals"),o=((pe=e.storyBible)==null?void 0:pe.summary)||((ge=e.source)==null?void 0:ge.excerpt)||"",l=Array.isArray((ye=e.storyBible)==null?void 0:ye.themes)&&e.storyBible.themes.length?e.storyBible.themes.join("、"):"待补充",u=Array.isArray((fe=e.storyBible)==null?void 0:fe.characters)?e.storyBible.characters:[],m=Array.isArray((ve=e.storyBible)==null?void 0:ve.chapters)?e.storyBible.chapters:[],c=Array.isArray((be=e.storyBible)==null?void 0:be.locations)?e.storyBible.locations:[],d=c.slice(0,5).map(P=>P.name).filter(Boolean).join("、"),g=u.slice(0,4).map(P=>P.name).filter(Boolean).join("、"),f=c.slice(0,4).map(P=>P.name).filter(Boolean).join("、"),b=((Ie=(he=e.visualBible)==null?void 0:he.styleProfile)==null?void 0:Ie.atmosphere)||"待确认",h=((we=e.buildArtifacts)==null?void 0:we.latestPlayable)||null,S=!!((Se=(Ee=e.runtimeSnapshot)==null?void 0:Ee.history)!=null&&Se.length||(($e=e.runtimeSnapshot)==null?void 0:$e.plotBeatId)!=null),O=h!=null&&h.updatedAt?`最近可玩版本：${new Date(h.updatedAt).toLocaleString()}`:"当前还没有可试玩版本",I=e.optimizationReport||null;if(t&&(t.innerHTML=`
            <div class="preview-summary-block">
                <div class="preview-field">
                    <label for="import-preview-title">项目标题</label>
                    <input id="import-preview-title" type="text" value="${x(e.title||"")}" placeholder="输入项目标题" />
                </div>
                <div class="preview-field">
                    <label for="import-preview-summary-input">剧情摘要</label>
                    <textarea id="import-preview-summary-input" rows="6" placeholder="补充导入项目的剧情摘要">${s(o)}</textarea>
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
                    <p>主题：${s(l)}</p>
                    <p>主要地点：${s(d||"待补充")}</p>
                    <p>${s(O)}</p>
                    <p>${s(S?"检测到运行快照，可继续试玩。":"当前没有运行快照，将从开场开始试玩。")}</p>
                </div>
                <div class="preview-item-actions">
                    <button id="optimize-project-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                    <button id="resume-project-play" type="button" class="preview-inline-btn" ${h?"":"disabled"}>${S?"继续试玩":"试玩当前版本"}</button>
                </div>
            </div>
        `,(ke=document.getElementById("optimize-project-btn"))==null||ke.addEventListener("click",async()=>{await se()}),(Be=document.getElementById("resume-project-play"))==null||Be.addEventListener("click",async()=>{await mt()})),n){const P=u.length?u.map((L,U)=>`
                <article class="preview-edit-item" data-preview-item="character" data-index="${U}" data-item-id="${x(L.id||"")}">
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label>角色名</label>
                            <input type="text" data-field="name" value="${x(L.name||"")}" placeholder="角色名称" />
                        </div>
                        <div class="preview-field">
                            <label>角色定位</label>
                            <input type="text" data-field="role" value="${x(L.role||"")}" placeholder="主角 / 配角 / 阵营人物" />
                        </div>
                    </div>
                    <div class="preview-field">
                        <label>角色描述</label>
                        <textarea data-field="description" rows="4" placeholder="补充角色外观、气质、动机">${s(L.description||"")}</textarea>
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
                ${P}
            </div>
        `}if(a){const P=m.length?m.map((L,U)=>`
                <article class="preview-edit-item" data-preview-item="chapter" data-index="${U}" data-item-id="${x(L.id||"")}">
                    <div class="preview-field">
                        <label>章节标题</label>
                        <input type="text" data-field="title" value="${x(L.title||L.name||"")}" placeholder="章节标题" />
                    </div>
                    <div class="preview-field">
                        <label>章节摘要</label>
                        <textarea data-field="summary" rows="5" placeholder="这一章的主要事件与冲突">${s(L.summary||"")}</textarea>
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
                ${P}
            </div>
        `}if(r){const P=c.length?c.map((q,kt)=>`
                <article class="preview-edit-item" data-preview-item="location" data-index="${kt}" data-item-id="${x(q.id||"")}">
                    <div class="preview-field">
                        <label>地点名称</label>
                        <input type="text" data-field="name" value="${x(q.name||"")}" placeholder="地点名称" />
                    </div>
                    <div class="preview-field">
                        <label>地点描述</label>
                        <textarea data-field="description" rows="4" placeholder="地点外观、氛围、功能">${s(q.description||"")}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-location">删除地点</button>
                    </div>
                </article>
            `).join(""):'<p class="empty-hint">地点越准，后面的场景基准图就越稳。</p>',L=((Le=(Pe=e.visualBible)==null?void 0:Pe.styleProfile)==null?void 0:Le.stylePreset)||"国风电影叙事",U=((je=e.config)==null?void 0:je.refinement)||{},ze=((xe=e.gameDesign)==null?void 0:xe.branchingPolicy)||{},wt=`每章分支上限 ${ze.maxBranchPerChapter||"-"}，锚点保留率 ${ze.mustKeepAnchorRate||"-"}`,Et=cn(I==null?void 0:I.relationshipGraph),St=sn(I==null?void 0:I.playableChapters),$t=I?`
                <article class="preview-edit-item">
                    <strong>项目优化诊断</strong>
                    <div class="preview-content">
                        <p>总评分：${s(String(I.overallScore||0))}</p>
                        <p>故事完整度：${s(String(((Te=I.readiness)==null?void 0:Te.story)||0))}</p>
                        <p>改编完整度：${s(String(((Ce=I.readiness)==null?void 0:Ce.adaptation)||0))}</p>
                        <p>视觉完整度：${s(String(((Ae=I.readiness)==null?void 0:Ae.visual)||0))}</p>
                        <p>试玩完整度：${s(String(((Ge=I.readiness)==null?void 0:Ge.playable)||0))}</p>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">优化建议</div>
                        <div class="candidate-paragraph">${s((I.recommendations||[]).join("；")||"当前没有明显阻塞项。")}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">当前优势</div>
                        <div class="candidate-paragraph">${s((I.strengths||[]).join("；")||"继续丰富内容即可。")}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">建议下一步</div>
                        <div class="candidate-paragraph">${s((I.nextActions||[]).map(q=>q.label).join("；")||"当前没有明显阻塞项。")}</div>
                    </div>
                    ${Et}
                    ${St}
                </article>
            `:"";r.innerHTML=`
            <div class="preview-card-header">
                <p class="helper-text">先确认后续要做视觉建档的主要地点。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-location">新增地点</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="location">
                ${P}
            </div>

            <div class="preview-card-header">
                <h3>改编导演与视觉重建</h3>
            </div>
            <div class="preview-edit-stack">
                <article class="preview-edit-item">
                    <div class="preview-field">
                        <label for="preview-style-preset">风格预设</label>
                        <input id="preview-style-preset" type="text" value="${x(L)}" placeholder="例如：国风电影叙事 / 水墨奇幻" />
                    </div>
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label for="preview-pacing">节奏倾向</label>
                            <select id="preview-pacing">
                                <option value="slow" ${((De=e.config)==null?void 0:De.pacing)==="slow"?"selected":""}>慢节奏</option>
                                <option value="balanced" ${!((Me=e.config)!=null&&Me.pacing)||((Ne=e.config)==null?void 0:Ne.pacing)==="balanced"?"selected":""}>平衡</option>
                                <option value="fast" ${((Oe=e.config)==null?void 0:Oe.pacing)==="fast"?"selected":""}>快节奏</option>
                            </select>
                        </div>
                        <div class="preview-field">
                            <label for="preview-adaptation-strength">改编强度 (0-1)</label>
                            <input id="preview-adaptation-strength" type="number" min="0" max="1" step="0.1" value="${Number(U.adaptationStrength??.5)}" />
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
            <div id="project-optimization-report" class="preview-edit-stack">${$t}</div>
            <div class="preview-content">
                <p>角色基准图建议：${s(g||"先确认角色后再生成")}</p>
                <p>场景基准图建议：${s(f||"先确认地点后再生成")}</p>
                <p>视觉氛围：${s(b)}</p>
                <p>改编策略：${s(((He=e.gameDesign)==null?void 0:He.adaptationProfile)||lt(e.adaptationMode||"balanced"))} · ${s(wt)}</p>
            </div>
        `,on(((_e=e.visualBible)==null?void 0:_e.assetIndex)||[]),(Fe=document.getElementById("optimize-project-inline-btn"))==null||Fe.addEventListener("click",async()=>{await se()}),(Re=document.getElementById("generate-base-assets"))==null||Re.addEventListener("click",async()=>{await ut()}),(Ue=document.getElementById("rebuild-adaptation-btn"))==null||Ue.addEventListener("click",async()=>{await gt()}),(qe=document.getElementById("rebuild-visual-bible-btn"))==null||qe.addEventListener("click",async()=>{await yt()}),(Je=document.getElementById("apply-project-refinement-btn"))==null||Je.addEventListener("click",async()=>{await ft()}),(We=document.getElementById("export-project-package-btn"))==null||We.addEventListener("click",async()=>{await vt()})}}async function se(){var e,t,n;if(!i.currentProjectId){p("请先导入并保存项目。","error");return}p("正在分析并优化项目结构...","pending");try{if(!await me({showStatus:!1}))return;const r=await y(`/projects/${i.currentProjectId}/optimize`,v("POST",{preserveAssets:!0}));i.currentProjectData=r.project||i.currentProjectData,C(i.currentProjectData);const o=((e=r.optimizationReport)==null?void 0:e.overallScore)??((n=(t=i.currentProjectData)==null?void 0:t.optimizationReport)==null?void 0:n.overallScore)??0;p(`项目优化完成，当前综合评分 ${o}。`,"success")}catch(a){p(`项目优化失败：${a.message}`,"error")}}async function mt(e=!1){if(!i.currentProjectId){p("请先导入并保存项目。","error");return}p(e?"正在重启试玩版本...":"正在恢复试玩版本...","pending");try{const t=k(),n=await y(`/projects/${i.currentProjectId}/play`,v("POST",{restart:e,config:t.imageSource==="comfyui"?{...t,...Z()}:t}));i.currentGameId=n.gameId,i.sceneImages=[],i.selectedSceneImageIndex=0,i.activeSceneImage="",i.transitioningSceneImage="",i.currentVisualSignature="",document.getElementById("game-log").innerHTML="",ne([]),V([]),E("game-screen"),K(n.gameState),p(n.resumed?"已恢复到上次试玩进度。":"已载入试玩版本。","success")}catch(t){p(`试玩恢复失败：${t.message}`,"error")}}function on(e=[]){const t=document.getElementById("project-asset-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML='<p class="empty-hint">暂无视觉资产，可先生成基准图。</p>';return}t.innerHTML=e.slice(0,8).map(n=>`
        <article class="preview-edit-item">
            <strong>${s(n.targetName||n.type||"未命名资产")}</strong>
            <span class="helper-text">${s(n.type||"asset")} · ${s(n.status||"planned")}</span>
            ${n.imageUrl?`<img src="${n.imageUrl}" alt="${x(n.targetName||"资产图")}" style="width:100%;border-radius:8px;" />`:""}
        </article>
    `).join("")}}function cn(e={}){const t=Array.isArray(e==null?void 0:e.nodes)?e.nodes:[],n=Array.isArray(e==null?void 0:e.edges)?e.edges:[],a=Array.isArray(e==null?void 0:e.hubs)?e.hubs:[];return`
        <div class="candidate-block">
            <div class="candidate-label">关系图</div>
            <div class="relation-graph">
                <div class="relation-graph-nodes">
                    ${t.length?t.map(r=>`
                            <div class="relation-node">
                                <strong>${s(r.name||"未命名角色")}</strong>
                                <span>${s(r.role||"角色")}</span>
                            </div>
                        `).join(""):'<div class="relation-empty">当前还没有足够清晰的人物节点。</div>'}
                </div>
                <div class="relation-graph-edges">
                    ${n.length?n.map(r=>`
                            <div class="relation-edge">
                                <div class="relation-edge-main">${s(r.source||"未知")} → ${s(r.target||"未知")}</div>
                                <div class="relation-edge-meta">${s(r.relation||"待确认")} · 张力 ${s(r.tension||"中")}</div>
                            </div>
                        `).join(""):'<div class="relation-empty">当前还没有识别到稳定关系。</div>'}
                </div>
                <div class="relation-graph-hubs">
                    <div class="relation-subtitle">关系中心</div>
                    ${a.length?a.map((r,o)=>`
                            <div class="relation-hub">
                                <span>#${o+1}</span>
                                <strong>${s(r.name||"未命名角色")}</strong>
                                <em>连接数 ${s(String(r.degree||0))}</em>
                            </div>
                        `).join(""):'<div class="relation-empty">暂无明显中心人物。</div>'}
                </div>
            </div>
        </div>
    `}function sn(e=[]){const t=Array.isArray(e)?e:[];return`
        <div class="candidate-block">
            <div class="candidate-label">章节可玩点树</div>
            <div class="chapter-play-tree">
                ${t.length?t.map((n,a)=>`
                        <article class="chapter-play-card">
                            <div class="chapter-play-header">
                                <span class="chapter-play-index">CH ${a+1}</span>
                                <strong>${s(n.title||`章节 ${a+1}`)}</strong>
                            </div>
                            <div class="chapter-play-body">
                                <p><span>冲突</span>${s(n.conflict||"待补充")}</p>
                                <p><span>风险</span>${s(n.stakes||"待补充")}</p>
                                <p><span>互动类型</span>${s((n.interactiveTypes||[]).join("、")||"待补充")}</p>
                                <p><span>关键节点</span>${s((n.keyNodes||[]).join("、")||"待补充")}</p>
                                <p><span>分支槽位</span>${s(String(n.branchSlotCount||0))}</p>
                            </div>
                        </article>
                    `).join(""):'<div class="relation-empty">当前还没有足够的章节可玩点。</div>'}
            </div>
        </div>
    `}async function ut(){var t,n;if(!i.currentProjectId){p("请先导入并保存项目。","error");return}const e=k();!e.enableImages||e.imageSource==="none"?p("当前图像生成未启用，将先以规划模式创建资产索引。","pending"):p("正在生成角色/地点基准图，请稍候...","pending");try{const a={dryRun:!e.enableImages||e.imageSource==="none",characterLimit:4,locationLimit:4,imageConfig:e.imageSource==="comfyui"?{...e,...Z()}:e},r=await y(`/projects/${i.currentProjectId}/assets/generate-base`,v("POST",a)),o=await y(`/projects/${i.currentProjectId}`);i.currentProjectData=o.project||i.currentProjectData,C(i.currentProjectData),p(a.dryRun?`已创建 ${((t=r.generatedAssets)==null?void 0:t.length)||0} 条资产规划。`:`已生成 ${((n=r.generatedAssets)==null?void 0:n.length)||0} 个基准资产。`,"success")}catch(a){p(`基准图生成失败：${a.message}`,"error")}}function pt(){var a,r,o;const e=((a=document.getElementById("preview-style-preset"))==null?void 0:a.value.trim())||"",t=((r=document.getElementById("preview-pacing"))==null?void 0:r.value)||"balanced",n=Number(((o=document.getElementById("preview-adaptation-strength"))==null?void 0:o.value)??.5);return{pacing:t,refinement:{adaptationStrength:Number.isFinite(n)?Math.max(0,Math.min(1,n)):.5},styleProfile:e?{stylePreset:e}:{}}}async function gt(){if(!i.currentProjectId){p("请先导入并保存项目。","error");return}p("正在重算改编结构...","pending");try{const e=ee(),t=await y(`/projects/${i.currentProjectId}/adaptation/rebuild`,v("POST",{gameType:e.gameType,adaptationMode:e.adaptationMode}));i.currentProjectData=t.project||i.currentProjectData,C(i.currentProjectData),p("改编结构已重算。","success")}catch(e){p(`重算失败：${e.message}`,"error")}}async function yt(){if(!i.currentProjectId){p("请先导入并保存项目。","error");return}p("正在重建视觉圣经...","pending");try{const e=pt(),t=await y(`/projects/${i.currentProjectId}/visual-bible/rebuild`,v("POST",{styleProfile:e.styleProfile}));i.currentProjectData=t.project||i.currentProjectData,C(i.currentProjectData),p("视觉圣经已重建。","success")}catch(e){p(`重建失败：${e.message}`,"error")}}async function ft(){if(!i.currentProjectId){p("请先导入并保存项目。","error");return}p("正在应用校正参数...","pending");try{const e=ee(),t=pt(),n=await y(`/projects/${i.currentProjectId}/refine`,v("POST",{...t,adaptationMode:e.adaptationMode}));i.currentProjectData=n.project||i.currentProjectData,C(i.currentProjectData),p("校正参数已应用。","success")}catch(e){p(`应用失败：${e.message}`,"error")}}function ln(e,t){const n=new Blob([JSON.stringify(t,null,2)],{type:"application/json;charset=utf-8"}),a=URL.createObjectURL(n),r=document.createElement("a");r.href=a,r.download=e,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(a)}async function vt(){var e;if(!i.currentProjectId){p("请先导入并保存项目。","error");return}p("正在导出项目包...","pending");try{const n=(await y(`/projects/${i.currentProjectId}/export-package`)).package||{},a=`${(((e=i.currentProjectData)==null?void 0:e.title)||"project").replace(/[\\/:*?"<>|]/g,"_")}_package.json`;ln(a,n),p("项目包导出成功。","success")}catch(t){p(`导出失败：${t.message}`,"error")}}async function me(e={}){if(!i.currentProjectId)return p("当前没有可保存的导入项目，请重新导入。","error"),null;const t=e.showStatus!==!1;t&&p("正在保存导入项目修改...","pending");try{const n=await y(`/projects/${i.currentProjectId}/update`,v("POST",{edits:ee()}));return i.currentProjectData=n.project||i.currentProjectData,i.currentProjectData&&(document.getElementById("import-title").value=i.currentProjectData.title||""),C(i.currentProjectData),t&&p(e.successMessage||"导入项目修改已保存。","success"),i.currentProjectData}catch(n){return console.error("Save imported project edits error:",n),t&&p(n.message,"error"),null}}async function dn(){var u,m,c,d,g,f,b;const e=((u=document.getElementById("import-content"))==null?void 0:u.value.trim())||"";if(!e){w("请先粘贴要导入的长文本内容。","error");return}if(e.length<100){w("文本内容过短，至少需要 100 字。","error");return}const t=B(_());i.currentGenerationConfig=t,A();const n=((m=document.getElementById("use-smart-parse"))==null?void 0:m.checked)!==!1,a=document.getElementById("import-submit-btn"),r=document.getElementById("import-progress"),o=document.getElementById("import-progress-fill"),l=document.getElementById("import-progress-text");a&&(a.disabled=!0);try{const h={title:((c=document.getElementById("import-title"))==null?void 0:c.value.trim())||"",content:e,gameType:((d=document.getElementById("import-game-type"))==null?void 0:d.value)||"custom",adaptationMode:((g=document.getElementById("adaptation-mode"))==null?void 0:g.value)||"balanced",useSmart:n,settings:n?Y():void 0};if(n){r&&(r.style.display="block"),w("正在使用 AI 智能解析文本...","pending");const S=await Lt("/projects/import-text",v("POST",h),(O,I)=>{o&&(o.style.width=`${O}%`),l&&(l.textContent=I||`解析中... ${O}%`)});i.currentProjectId=((f=S.project)==null?void 0:f.id)||null,i.currentProjectData=S.project||null,i.currentGameType=h.gameType,C(S.project),w("AI 智能解析完成！请检查提取结果。","success"),p("AI 已智能识别章节、角色和关系，可以轻量修改后进入工作台。","success")}else{w("正在快速解析文本...","pending");const S=await y("/projects/import-text",v("POST",h));i.currentProjectId=((b=S.project)==null?void 0:b.id)||null,i.currentProjectData=S.project||null,i.currentGameType=h.gameType,C(S.project),w("快速解析完成，请检查提取结果。","success"),p("可以先轻量修改角色、章节和地点，再确认进入工作台。")}await W(),E("import-preview-screen")}catch(h){console.error("Imported project init error:",h),w(`导入失败：${h.message}`,"error")}finally{a&&(a.disabled=!1),r&&(r.style.display="none")}}async function mn(){var t,n;if(!i.currentProjectId){w("当前没有可用的导入项目，请重新导入。","error"),E("import-screen");return}const e=B(_());i.currentGenerationConfig=e,A();try{const a=await me({successMessage:"修改已保存，正在进入生成工作台..."});if(!a)return;const r=await y(`/projects/${i.currentProjectId}/init-session`,v("POST",{config:e,gameType:a.gameType||i.currentGameType||"custom",userInput:((t=a.storyBible)==null?void 0:t.summary)||((n=a.source)==null?void 0:n.excerpt)||""}));await dt(r),w("导入项目已进入生成工作台。","success")}catch(a){console.error("Start imported project session error:",a),w(a.message,"error"),p(a.message,"error"),E("import-screen")}}async function W(){const e=document.getElementById("import-project-list");if(e){e.innerHTML='<p class="empty-hint">正在加载项目列表...</p>';try{const t=await y("/projects"),n=Array.isArray(t.projects)?t.projects:[];if(!n.length){e.innerHTML='<p class="empty-hint">还没有导入项目。</p>';return}e.innerHTML=n.map(a=>`
            <article class="import-project-card" data-project-id="${x(a.id)}">
                <div class="import-project-main">
                    <strong>${s(a.title||"未命名项目")}</strong>
                    <p>${s(a.summary||"暂无摘要")}</p>
                    <div class="import-project-meta">
                        <span>${s(J[a.gameType]||"自定义 RPG")}</span>
                        <span>${s(lt(a.adaptationMode||"balanced"))}</span>
                        <span>${s(new Date(a.updatedAt||a.createdAt||Date.now()).toLocaleString())}</span>
                    </div>
                </div>
                <div class="import-project-actions">
                    <button type="button" class="preview-inline-btn" data-action="open">继续编辑</button>
                    <button type="button" class="preview-inline-btn danger" data-action="delete">删除</button>
                </div>
            </article>
        `).join(""),e.querySelectorAll('[data-action="open"]').forEach(a=>{a.addEventListener("click",async()=>{const r=a.closest("[data-project-id]"),o=r==null?void 0:r.getAttribute("data-project-id");o&&await un(o)})}),e.querySelectorAll('[data-action="delete"]').forEach(a=>{a.addEventListener("click",async()=>{const r=a.closest("[data-project-id]"),o=r==null?void 0:r.getAttribute("data-project-id");o&&await pn(o)})})}catch(t){e.innerHTML=`<p class="empty-hint">项目列表加载失败：${s(t.message)}</p>`}}}async function un(e){var t,n;try{const a=await y(`/projects/${e}`);i.currentProjectId=((t=a.project)==null?void 0:t.id)||e,i.currentProjectData=a.project||null,i.currentGameType=((n=a.project)==null?void 0:n.gameType)||i.currentGameType,i.currentProjectData&&(document.getElementById("import-title").value=i.currentProjectData.title||"",i.currentGameType=i.currentProjectData.gameType||i.currentGameType),C(i.currentProjectData),w("已加载导入项目，你可以继续修改。","success"),p("项目已加载，可直接修改并继续进入工作台。"),E("import-preview-screen")}catch(a){w(`加载项目失败：${a.message}`,"error")}}async function pn(e){if(confirm("确定删除这个导入项目吗？删除后不可恢复。"))try{await y(`/projects/${e}`,v("DELETE",{})),i.currentProjectId===e&&(i.currentProjectId=null,i.currentProjectData=null),await W(),w("项目已删除。","success")}catch(t){w(`删除项目失败：${t.message}`,"error")}}function gn(){document.getElementById("generate-only-btn").addEventListener("click",async()=>{i.currentStepId&&await fn(i.currentStepId)}),document.getElementById("regenerate-btn").addEventListener("click",async()=>{await Xe(prompt("请输入重生成补充要求（可留空）：")||"")}),document.getElementById("modify-btn").addEventListener("click",()=>{document.getElementById("custom-input-area").style.display="block",document.getElementById("custom-feedback").focus()}),document.getElementById("apply-custom-btn").addEventListener("click",async()=>{const e=document.getElementById("custom-feedback").value.trim();e&&(await Xe(e),document.getElementById("custom-feedback").value="",document.getElementById("custom-input-area").style.display="none")}),document.getElementById("confirm-btn").addEventListener("click",async()=>{await wn()}),document.getElementById("skip-btn").addEventListener("click",async()=>{await En()}),document.getElementById("gen-finalize-btn").addEventListener("click",async()=>{await Bn()})}function R(){const e=document.getElementById("step-navigation");e.innerHTML="",i.allSteps.forEach(t=>{const n=T(t.id),a=H[t.id]||{icon:"?",name:t.name||t.id},r=document.createElement("button");r.type="button",r.className="step",t.id===i.currentStepId&&r.classList.add("active"),n.status==="confirmed"&&r.classList.add("completed"),n.status==="loading"&&r.classList.add("generating"),r.innerHTML=`<span class="step-icon">${a.icon}</span><span class="step-label">${t.name||a.name}</span>`,r.addEventListener("click",async()=>{await yn(t.id)}),e.appendChild(r)})}async function yn(e,t){i.currentStepId=e,R(),T(e);{N(e);return}}function N(e){const t=H[e]||{name:e,desc:""},n=T(e);document.getElementById("current-step-name").textContent=t.name,document.getElementById("current-step-desc").textContent=t.desc,document.getElementById("step-loading").style.display=n.status==="loading"?"flex":"none",document.getElementById("action-buttons").style.display="flex",bt(e),ht(),te(e)}async function fn(e){var n;const t=T(e);t.status="loading",N(e),$("calling",`正在生成 ${((n=H[e])==null?void 0:n.name)||e}...`);try{const a=await y("/generate/step",v("POST",{sessionId:i.currentSessionId,stepId:e,options:{candidateCount:2}}));t.candidates=a.candidates||[],t.selectedIndex=-1,t.status="generated",t.history.push({id:Date.now(),timestamp:new Date,candidates:t.candidates.map(r=>structuredClone(r))}),$("success",`已生成 ${t.candidates.length} 个候选方案。`)}catch(a){console.error("Load step error:",a),t.status="error",$("error",a.message)}N(e)}function bt(e){const t=document.getElementById("candidates-container"),n=T(e);if(t.innerHTML="",n.status!=="loading"){if(!n.candidates.length){t.innerHTML='<div class="candidate-card"><div class="candidate-empty">当前步骤还没有生成内容。点击下方“生成”开始。</div></div>';return}n.candidates.forEach((a,r)=>{const o=document.createElement("button");o.type="button",o.className="candidate-card",n.selectedIndex===r&&o.classList.add("selected"),o.innerHTML=`
            <div class="candidate-card-header">
                <strong>${s(vn(e,a,r))}</strong>
                <span>方案 ${r+1}</span>
            </div>
            <div class="candidate-card-content">${bn(e,a)}</div>
        `,o.addEventListener("click",()=>{n.selectedIndex=r,bt(e),te(e)}),t.appendChild(o)})}}function te(e){const t=T(e),n=t.candidates.length>0;document.getElementById("confirm-btn").disabled=t.selectedIndex<0,document.getElementById("regenerate-btn").disabled=!n,document.getElementById("modify-btn").disabled=!n,document.getElementById("gen-finalize-btn").style.display=i.allSteps.every(a=>T(a.id).status==="confirmed")?"inline-block":"none"}function vn(e,t,n){var a,r;return e==="worldview"?t.worldName||`世界观方案 ${n+1}`:e==="mainPlot"?t.title||`主线方案 ${n+1}`:e==="integration"?t.gameName||`整合方案 ${n+1}`:Array.isArray(t)?`${((a=H[e])==null?void 0:a.name)||e} · ${t.length} 项`:t.name||t.title||`${((r=H[e])==null?void 0:r.name)||e} 方案 ${n+1}`}function bn(e,t){var n,a,r,o,l,u;if(t!=null&&t.error)return j("解析提示",t.error||"AI 响应暂时无法解析，请尝试重新生成。");if(typeof t=="string")return j("方案内容",t);switch(e){case"worldview":return[F("世界名称",t.worldName),F("时代背景",t.era),j("世界描述",t.description),Qe("世界规则",t.rules),Ye("主要势力",t.factions,["name","description"]),Ye("重要地点",t.locations,["name","description"])].join("");case"mainPlot":return[F("主线标题",t.title),F("核心主题",t.theme),j("剧情概览",t.summary),j("引发事件",t.incitingIncident),In("章节结构",(t.chapters||[]).map(m=>({title:m.name||m.title,body:`${m.goal||""}${m.description?`：${m.description}`:""}`}))),j("高潮",t.climax),j("结局说明",t.resolution)].join("");case"integration":return[F("游戏名称",t.gameName),j("玩法设计",t.gameplayDesign),F("战斗类型",(a=(n=t.gameSystems)==null?void 0:n.combatSystem)==null?void 0:a.type),Qe("战斗机制",(o=(r=t.gameSystems)==null?void 0:r.combatSystem)==null?void 0:o.mechanics),j("开场场景",(l=t.openingScene)==null?void 0:l.description),j("开场旁白",(u=t.openingScene)==null?void 0:u.narration),j("平衡性说明",t.balancingNotes)].join("");default:return hn(t,e)}}function hn(e,t){const n=Array.isArray(e)?e:e?[e]:[];return n.length?n.map((a,r)=>{var m;const o=a.name||a.title||`${((m=H[t])==null?void 0:m.name)||"条目"} ${r+1}`,l=a.description||a.summary||a.role||a.type||"",u=[a.role?`<span class="candidate-chip">${s(a.role)}</span>`:"",a.location?`<span class="candidate-chip">${s(a.location)}</span>`:"",a.type?`<span class="candidate-chip">${s(a.type)}</span>`:"",a.rarity?`<span class="candidate-chip">${s(a.rarity)}</span>`:""].join("");return`
            <div class="candidate-item">
                <div class="candidate-item-title">${s(o)}</div>
                ${u?`<div class="candidate-chip-row">${u}</div>`:""}
                ${l?`<div class="candidate-item-body">${s(l)}</div>`:""}
            </div>
        `}).join(""):'<div class="candidate-empty">当前方案没有可展示的条目。</div>'}function F(e,t){return t?`<div class="candidate-field"><span class="candidate-label">${s(e)}</span><span class="candidate-value">${s(t)}</span></div>`:""}function j(e,t){return t?`
        <div class="candidate-block">
            <div class="candidate-label">${s(e)}</div>
            <div class="candidate-paragraph">${s(t).replaceAll(`
`,"<br>")}</div>
        </div>
    `:""}function Qe(e,t){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${s(e)}</div>
            <div class="candidate-chip-row">${t.map(n=>`<span class="candidate-chip">${s(n)}</span>`).join("")}</div>
        </div>
    `}function Ye(e,t,n){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${s(e)}</div>
            ${t.map(a=>`
                <div class="candidate-item">
                    <div class="candidate-item-title">${s(a[n[0]]||"未命名")}</div>
                    ${a[n[1]]?`<div class="candidate-item-body">${s(a[n[1]])}</div>`:""}
                </div>
            `).join("")}
        </div>
    `}function In(e,t){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${s(e)}</div>
            ${t.map(n=>`
                <div class="candidate-item">
                    <div class="candidate-item-title">${s(n.title||"未命名")}</div>
                    ${n.body?`<div class="candidate-item-body">${s(n.body)}</div>`:""}
                </div>
            `).join("")}
        </div>
    `}async function Xe(e){var n;if(!i.currentStepId)return;const t=T(i.currentStepId);t.status="loading",N(i.currentStepId),$("calling",`正在重新生成 ${((n=H[i.currentStepId])==null?void 0:n.name)||i.currentStepId}...`);try{const a=await y("/generate/regenerate",v("POST",{sessionId:i.currentSessionId,stepId:i.currentStepId,feedback:e}));t.candidates=a.candidates||[],t.selectedIndex=-1,t.status="generated",t.history.push({id:Date.now(),timestamp:new Date,candidates:t.candidates.map(r=>structuredClone(r))}),$("success","已完成重新生成。")}catch(a){console.error("Regenerate error:",a),t.status="error",$("error",a.message)}N(i.currentStepId)}async function wn(){const e=T(i.currentStepId),t=e.candidates[e.selectedIndex];if(t)try{const n=await y("/generate/confirm",v("POST",{sessionId:i.currentSessionId,stepId:i.currentStepId,candidate:t}));e.status="confirmed",await ue(),R(),n.nextStep?(i.currentStepId=n.nextStep,R(),N(n.nextStep),$("success","已确认当前步骤。下一步不会自动生成，请按需点击“生成”。")):($("success","所有步骤都已确认，可以整合生成游戏了。"),te(i.currentStepId))}catch(n){console.error("Confirm step error:",n),alert(`确认失败：${n.message}`)}}async function En(){try{const e=await y("/generate/confirm",v("POST",{sessionId:i.currentSessionId,stepId:i.currentStepId,candidate:{skipped:!0}}));T(i.currentStepId).status="confirmed",await ue(),R(),e.nextStep?(i.currentStepId=e.nextStep,R(),N(e.nextStep)):te(i.currentStepId)}catch(e){console.error("Skip step error:",e),alert(`跳过失败：${e.message}`)}}async function ue(){var t,n,a,r,o,l,u;const e=document.getElementById("confirmed-elements");try{const c=(await y(`/generate/${i.currentSessionId}/status`)).memory||{},d=[];c.worldview&&d.push(G("世界观",c.worldview.worldName||"已确认")),(t=c.coreCharacters)!=null&&t.length&&d.push(G("核心角色",`${c.coreCharacters.length} 名`)),(n=c.secondaryCharacters)!=null&&n.length&&d.push(G("次要角色",`${c.secondaryCharacters.length} 名`)),(a=c.items)!=null&&a.length&&d.push(G("物品道具",`${c.items.length} 项`)),(r=c.puzzles)!=null&&r.length&&d.push(G("谜题挑战",`${c.puzzles.length} 项`)),c.mainPlot&&d.push(G("主线剧情",c.mainPlot.title||"已确认")),(o=c.sidePlots)!=null&&o.length&&d.push(G("支线剧情",`${c.sidePlots.length} 条`)),(l=c.fragments)!=null&&l.length&&d.push(G("碎片内容",`${c.fragments.length} 条`)),(u=c.integration)!=null&&u.gameName&&d.push(G("整合方案",c.integration.gameName)),e.innerHTML=d.join("")||'<p class="empty-hint">尚未确认任何内容。</p>'}catch(m){console.error("Render confirmed elements error:",m),e.innerHTML='<p class="empty-hint">获取已确认内容失败。</p>'}}function G(e,t){return`<div class="confirmed-item"><span class="confirmed-label">${e}</span><span class="confirmed-value">${t}</span></div>`}function ht(){const e=document.getElementById("history-panel");if(!e)return;const t=[];for(const n of i.allSteps){const a=T(n.id);if(!a.history.length)continue;const r=a.history.slice().reverse().map(o=>`<div class="history-entry">${n.name||n.id} · ${o.timestamp.toLocaleTimeString()}</div>`).join("");t.push(`<div class="history-step">${r}</div>`)}e.innerHTML=t.join("")||'<p class="empty-hint">暂无生成记录。</p>'}function k(){if(i.currentGenerationConfig)return B(i.currentGenerationConfig);const e=B(_());return i.currentGenerationConfig=e,e}function D(e,t,n=""){const a=document.getElementById("game-log");if(!a)return null;const r=document.createElement("div");if(r.className=`log-entry ${e}`,n){const l=document.createElement("div");l.className="speaker",l.textContent=n,r.appendChild(l)}const o=document.createElement("div");return o.className="content",o.textContent=t,r.appendChild(o),a.appendChild(r),a.scrollTop=a.scrollHeight,o}function ne(e=[]){const t=document.getElementById("choices-container");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="";return}t.innerHTML=e.map((n,a)=>`
        <button type="button" class="choice-btn" data-choice-index="${a}">
            ${s(n.text||n.action||`选项 ${a+1}`)}
        </button>
    `).join(""),t.querySelectorAll("[data-choice-index]").forEach(n=>{n.addEventListener("click",async()=>{const a=Number(n.getAttribute("data-choice-index")),r=e[a];r&&await le(r.action||r.text||"")})})}}function Sn(e={}){const t=document.getElementById("player-stats");if(!t)return;const n=Object.entries(e||{});if(!n.length){t.innerHTML='<p class="empty-hint">暂无属性信息</p>';return}t.innerHTML=n.map(([a,r])=>{if(r&&typeof r=="object"&&Number.isFinite(r.current)&&Number.isFinite(r.max)){const o=r.max>0?Math.max(0,Math.min(100,r.current/r.max*100)):0;return`
                <div class="stat-item">
                    <div style="width:100%">
                        <span class="stat-name">${s(a)}</span>
                        <span class="stat-value" style="float:right">${r.current}/${r.max}</span>
                        <div class="stat-bar"><div class="stat-bar-fill hp" style="width:${o}%"></div></div>
                    </div>
                </div>
            `}return`
            <div class="stat-item">
                <span class="stat-name">${s(a)}</span>
                <span class="stat-value">${s(String(r))}</span>
            </div>
        `}).join("")}function $n(e=[]){const t=document.getElementById("inventory-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="<li>暂无物品</li>";return}t.innerHTML=e.map(n=>`<li>${s(n.name||String(n))}</li>`).join("")}}function kn(e=[]){const t=document.getElementById("quest-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="<li>暂无任务</li>";return}t.innerHTML=e.map(n=>`
        <li class="${n.completed?"completed":""}">
            ${s(n.name||n.description||"未命名任务")}
            ${n.progress?` · ${s(n.progress)}`:""}
        </li>
    `).join("")}}async function It(e=i.currentGameId){if(e)try{const t=await y(`/games/${e}/start`,v("POST",{}));i.currentGameId=e,i.gameState=t.gameState||null,i.sceneImages=[],i.selectedSceneImageIndex=0,i.activeSceneImage="",i.transitioningSceneImage="",i.currentVisualSignature="",document.getElementById("game-log").innerHTML="",ne([]),V([]),E("game-screen"),K(i.gameState)}catch(t){alert(`启动游戏失败：${t.message}`)}}async function Bn(){var e;if(!i.currentSessionId){alert("当前没有生成会话。");return}$("calling","正在整合并生成最终游戏...");try{const t=await y(`/generate/${i.currentSessionId}/finalize`,v("POST",{config:k()}));i.currentGameId=t.gameId,i.currentGameData=t.gameData||null,i.currentGameType=((e=t.gameData)==null?void 0:e.type)||i.currentGameType,await It(i.currentGameId),$("success","游戏已生成并启动。")}catch(t){$("error",t.message),alert(`整合失败：${t.message}`)}}async function le(e=""){var r;if(!i.currentGameId)return;const t=document.getElementById("player-input"),n=document.getElementById("send-btn"),a=e||(t==null?void 0:t.value.trim())||"";if(a){t&&(t.value=""),n&&(n.disabled=!0),D("player",a,"你");try{const o=k(),l=o.imageSource==="comfyui"?{...o,...Z()}:o;((r=i.settings)==null?void 0:r.enableStreaming)!==!1?await Pn(a,l):await Ln(a,l)}catch(o){D("system",`行动处理失败：${o.message}`)}finally{n&&(n.disabled=!1)}}}async function Pn(e,t){var m;const n=await fetch(`${Dt}/games/${i.currentGameId}/action`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:e,imageConfig:t,streaming:!0})});if(!n.ok)throw new Error(`HTTP ${n.status}`);const a=n.body.getReader(),r=new TextDecoder;let o="",l="",u=null;for(;;){const{done:c,value:d}=await a.read();if(c)break;o+=r.decode(d,{stream:!0});const g=o.split(`
`);o=g.pop()||"";for(const f of g)if(!(!f.trim()||f==="data: [DONE]")&&f.startsWith("data: "))try{const b=JSON.parse(f.slice(6));b.type==="narration"?(u||(u=D("narrator","")),l=b.text,u.textContent=l):b.type==="complete"&&(Array.isArray((m=b.gameState)==null?void 0:m.lastDialogues)&&b.gameState.lastDialogues.forEach(h=>{h!=null&&h.content&&D("narrator",h.content,h.speaker||"角色")}),b.gameOver&&b.gameOverMessage&&D("system",b.gameOverMessage),ne(b.choices||[]),K(b.gameState||i.gameState))}catch(b){console.error("解析流式数据失败:",b)}}}async function Ln(e,t){var a,r;const n=await y(`/games/${i.currentGameId}/action`,v("POST",{action:e,imageConfig:t}));Array.isArray((a=n.gameState)==null?void 0:a.lastDialogues)&&n.gameState.lastDialogues.forEach(o=>{o!=null&&o.content&&D("narrator",o.content,o.speaker||"角色")}),n.response&&D("narrator",n.response),n.gameOver&&n.gameOverMessage&&D("system",n.gameOverMessage),ne(n.choices||[]),K(n.gameState||i.gameState),n.sceneImage&&V([n.sceneImage],((r=n.visualState)==null?void 0:r.prompt)||n.sceneDescription||n.response)}function jn(){var e,t,n,a,r,o,l,u,m;Ot(),document.getElementById("send-btn").addEventListener("click",le),document.getElementById("player-input").addEventListener("keydown",c=>{c.key==="Enter"&&le()}),(e=document.getElementById("generate-scene-image-btn"))==null||e.addEventListener("click",async()=>{await xn()}),(t=document.getElementById("scene-image-count"))==null||t.addEventListener("change",()=>{const c=document.getElementById("scene-image-count"),d=document.getElementById("comfyui-image-count"),g=String(Math.max(1,Math.min(8,Number(c.value)||1)));c.value=g,d&&(d.value=g),A()}),(n=document.getElementById("live-comfyui-workflow-mode"))==null||n.addEventListener("change",()=>{Ht(),syncLiveImageConfigState()}),(a=document.getElementById("live-refresh-comfyui-btn"))==null||a.addEventListener("click",async()=>{await refreshLiveComfyUIOptions(!0)}),(r=document.getElementById("live-refresh-workflow-files-btn"))==null||r.addEventListener("click",async()=>{await refreshLiveComfyWorkflowFiles(!0)}),(o=document.getElementById("live-load-workflow-btn"))==null||o.addEventListener("click",async()=>{await loadSelectedLiveWorkflowFile(!0)}),(l=document.getElementById("live-test-comfyui-btn"))==null||l.addEventListener("click",async()=>{await testLiveComfyUIConnection()}),(u=document.getElementById("live-validate-workflow-btn"))==null||u.addEventListener("click",async()=>{await validateLiveComfyUIWorkflow()}),(m=document.getElementById("live-comfyui-workflow-file"))==null||m.addEventListener("change",()=>{syncLiveImageConfigState()}),document.querySelectorAll("#live-image-config input, #live-image-config select, #live-image-config textarea").forEach(c=>{c.addEventListener("change",()=>{syncLiveImageConfigState()})}),document.getElementById("game-menu-btn").addEventListener("click",()=>{document.getElementById("game-menu-modal").classList.add("active")}),document.getElementById("save-game").addEventListener("click",async()=>{var c,d;if(i.gameState&&i.currentGameId)try{const g=await y(`/games/${i.currentGameId}`),f=Ke(i.currentGameId,g.state||i.gameState,{gameData:g.game||i.currentGameData,generationConfig:k(),type:i.currentGameType||((c=g.game)==null?void 0:c.type)||((d=i.gameState)==null?void 0:d.type)||"custom"});i.currentGameData=g.game||i.currentGameData,localStorage.setItem(`rpg_save_${i.currentGameId}`,JSON.stringify(f)),alert("游戏进度已保存。")}catch(g){console.error("Save game error:",g);const f=Ke(i.currentGameId,i.gameState,{generationConfig:k()});localStorage.setItem(`rpg_save_${i.currentGameId}`,JSON.stringify(f)),alert("游戏进度已保存，但这次没有拿到完整后端快照。若服务重启后要续玩，建议重新保存一次。")}document.getElementById("game-menu-modal").classList.remove("active")}),document.getElementById("load-game").addEventListener("click",async()=>{if(!i.currentGameId){document.getElementById("game-menu-modal").classList.remove("active");return}de(`rpg_save_${i.currentGameId}`)?await st(i.currentGameId):alert("没有找到存档。"),document.getElementById("game-menu-modal").classList.remove("active")}),document.getElementById("restart-game").addEventListener("click",async()=>{i.currentGameId&&await It(i.currentGameId),document.getElementById("game-menu-modal").classList.remove("active")}),z(),syncLiveImageConfigPanel()}async function xn(){var l,u;if(!i.currentGameId){M("Start the game before generating images.","error");return}const e=document.getElementById("scene-image-prompt"),t=document.getElementById("scene-image-count"),n=document.getElementById("comfyui-image-count"),a=(e==null?void 0:e.value.trim())||((l=i.gameState)==null?void 0:l.sceneDescription)||((u=i.gameState)==null?void 0:u.initialLog)||"",r=Math.max(1,Math.min(8,Number(t==null?void 0:t.value)||1));if(!a){M("No scene prompt available yet.","error");return}t&&(t.value=String(r)),n&&(n.value=String(r));const o=k().imageSource==="comfyui"?{...k(),...Z(),comfyuiImageCount:r}:{...k(),comfyuiImageCount:r};i.currentGenerationConfig=o,localStorage.setItem(X,JSON.stringify(o)),Ze(!0),M("Generating images with ComfyUI...","pending");try{const m=await y(`/games/${i.currentGameId}/generate-image`,v("POST",{prompt:a,count:r,comfyuiImageCount:r,...o}));i.selectedSceneImageIndex=0,V(m.images||[],m.prompt||a),M(`Generated ${m.count||(m.images||[]).length} image(s).`,"success")}catch(m){console.error("Generate scene image error:",m),M(m.message,"error")}finally{Ze(!1)}}function M(e,t=""){const n=document.getElementById("scene-image-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function Ze(e){const t=document.getElementById("generate-scene-image-btn");t&&(t.disabled=!!e,t.textContent=e?"生成中...":"生成场景图")}function z(){var l,u;const e=document.getElementById("scene-image-controls"),t=document.getElementById("scene-image-prompt"),n=document.getElementById("scene-image-count"),a=document.getElementById("live-image-config"),r=k(),o=r.enableImages&&r.imageSource!=="none";if(e&&(e.style.display=o?"block":"none"),!o){M("当前未启用图像生成。","pending");return}if(t){const m=i.lastSuggestedImagePrompt||((l=i.gameState)==null?void 0:l.sceneDescription)||((u=i.gameState)==null?void 0:u.initialLog)||"";(!t.value.trim()||t.value===i.lastSuggestedImagePrompt)&&(t.value=m),i.lastSuggestedImagePrompt=m}n&&(n.value=String(Math.max(1,Math.min(8,Number(r.comfyuiImageCount)||1)))),a&&(a.style.display=r.imageSource==="comfyui"?"block":"none"),r.imageGenerationMode==="auto"?M("当前为自动生图模式：视觉场景变化时会自动更新。","pending"):M("当前为手动生图模式：点击按钮后才会生成。","pending")}function V(e=[],t=""){i.sceneImages=Array.isArray(e)?e:[],i.selectedSceneImageIndex=0,t&&(i.lastSuggestedImagePrompt=t);const n=document.getElementById("scene-image-gallery");n&&(i.sceneImages.length?(n.innerHTML=i.sceneImages.map((r,o)=>`
                    <button
                        type="button"
                        class="scene-thumb ${o===i.selectedSceneImageIndex?"active":""}"
                        data-scene-thumb="${o}"
                    >
                        <img src="${r}" alt="场景候选图 ${o+1}" />
                    </button>
                `).join(""),n.querySelectorAll("[data-scene-thumb]").forEach(r=>{r.addEventListener("click",()=>{const o=Number(r.getAttribute("data-scene-thumb"));Number.isNaN(o)||(i.selectedSceneImageIndex=o,et(i.sceneImages[o]||""),n.querySelectorAll("[data-scene-thumb]").forEach(l=>{l.classList.toggle("active",Number(l.getAttribute("data-scene-thumb"))===o)}))})})):n.innerHTML=""),et(i.sceneImages[i.selectedSceneImageIndex]||"");const a=document.getElementById("scene-image-prompt");a&&i.lastSuggestedImagePrompt&&!a.value.trim()&&(a.value=i.lastSuggestedImagePrompt)}function et(e=""){const t=document.getElementById("scene-image");if(!t)return;if(!e){i.activeSceneImage="",i.transitioningSceneImage="",t.innerHTML='<div class="placeholder">场景图像将在这里显示</div>';return}if(!i.activeSceneImage){i.activeSceneImage=e,i.transitioningSceneImage="",t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${e}" alt="场景图" />
            </div>
        `;return}if(i.activeSceneImage===e){t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${e}" alt="场景图" />
            </div>
        `;return}i.transitioningSceneImage=e,i.sceneImageTransitionToken+=1;const n=i.sceneImageTransitionToken,a=new Image;a.onload=()=>{if(i.sceneImageTransitionToken!==n)return;t.innerHTML=`
            <div class="scene-image-layer scene-image-layer-back is-active">
                <img src="${i.activeSceneImage}" alt="当前场景图" />
            </div>
            <div class="scene-image-layer scene-image-layer-front">
                <img src="${e}" alt="下一场景图" />
            </div>
        `;const r=t.querySelector(".scene-image-layer-front");requestAnimationFrame(()=>{r==null||r.classList.add("is-active")}),window.setTimeout(()=>{i.sceneImageTransitionToken===n&&(i.activeSceneImage=e,i.transitioningSceneImage="",t.innerHTML=`
                <div class="scene-image-layer is-active">
                    <img src="${e}" alt="场景图" />
                </div>
            `)},420)},a.onerror=()=>{i.sceneImageTransitionToken===n&&(i.activeSceneImage=e,i.transitioningSceneImage="",t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${e}" alt="场景图" />
            </div>
        `)},a.src=e}function Tn(e=i.gameState){return e?{chapterId:e.currentChapter??null,sceneNodeId:e.currentScene||null,plotBeatId:e.turn??null,playerState:e.player||{},worldState:e.worldState||{},relationshipState:e.characterStates||[],inventory:e.inventory||[],activeQuests:(e.quests||[]).filter(t=>t&&t.completed!==!0),visualState:e.visualState||null,history:(e.history||[]).slice(-20)}:null}function Cn(){!i.currentProjectId||!i.gameState||i.runtimeSnapshotSaving||(i.runtimeSnapshotTimer&&window.clearTimeout(i.runtimeSnapshotTimer),i.runtimeSnapshotTimer=window.setTimeout(async()=>{i.runtimeSnapshotSaving=!0;try{await y(`/projects/${i.currentProjectId}/runtime-snapshot`,v("POST",{runtimeSnapshot:Tn(i.gameState)}))}catch(e){console.warn("Runtime snapshot save failed:",e.message)}finally{i.runtimeSnapshotSaving=!1}},800))}function K(e=i.gameState){var n,a;if(!e)return;i.gameState=e,i.currentVisualSignature=((n=e.visualState)==null?void 0:n.signature)||i.currentVisualSignature,document.getElementById("game-title").textContent=e.name||"AI 生成 RPG",document.getElementById("scene-description").textContent=e.sceneDescription||"";const t=document.getElementById("game-log");e.initialLog&&!t.children.length&&D("narrator",e.initialLog),Sn(((a=e.player)==null?void 0:a.stats)||{}),$n(e.inventory||[]),kn(e.quests||[]),z(),Cn()}async function Q(e){const t=document.getElementById(`test-${e}-result`),n=document.getElementById(`test-${e}-btn`);n.disabled=!0,t.textContent="测试中...",t.className="test-result";try{const a=await y("/test-connection",v("POST",Y(e)));t.textContent=a.success?"连接成功":a.error||"连接失败",t.className=`test-result ${a.success?"success":"error"}`}catch(a){t.textContent=a.message,t.className="test-result error"}finally{n.disabled=!1}}function x(e){return s(e).replaceAll('"',"&quot;").replaceAll("'","&#39;")}function s(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
