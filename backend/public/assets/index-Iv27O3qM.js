(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function n(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(r){if(r.ep)return;r.ep=!0;const o=n(r);fetch(r.href,o)}})();const nt="http://localhost:3000/api";async function at(e){try{const t=await e.json();return(t==null?void 0:t.error)||(t==null?void 0:t.message)||`${e.status} ${e.statusText}`}catch{return`${e.status} ${e.statusText}`}}async function f(e,t={}){const n=await fetch(`${nt}${e}`,t);if(!n.ok)throw new Error(await at(n));return n.json()}function v(e,t){return{method:e,headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}}const De={openai:{apiUrl:{id:"openai-url",fallback:"https://api.openai.com/v1"},apiKey:{id:"openai-key"},model:{id:"openai-model",fallback:"gpt-4o"}},anthropic:{apiKey:{id:"anthropic-key"},model:{id:"anthropic-model",fallback:"claude-3-5-sonnet-20241022"}},local:{apiUrl:{id:"ollama-url",fallback:"http://localhost:11434"},model:{id:"ollama-model",fallback:"llama3"}},custom:{apiUrl:{id:"custom-url"},apiKey:{id:"custom-key"},model:{id:"custom-model"}}},Me={difficulty:{id:"game-difficulty",fallback:"normal"},length:{id:"game-length",fallback:"medium"},enableImages:{id:"enable-images",type:"checkbox",fallback:!0},imageSource:{id:"image-source",fallback:"comfyui"},imageGenerationMode:{id:"image-generation-mode",fallback:"manual"},comfyuiUrl:{id:"comfyui-url",fallback:"http://127.0.0.1:8000"},comfyuiImageCount:{id:"comfyui-image-count",fallback:"1"},comfyuiModel:{id:"comfyui-model",fallback:""},comfyuiSampler:{id:"comfyui-sampler",fallback:"euler"},comfyuiScheduler:{id:"comfyui-scheduler",fallback:"normal"},comfyuiWidth:{id:"comfyui-width",fallback:"768"},comfyuiHeight:{id:"comfyui-height",fallback:"512"},comfyuiSteps:{id:"comfyui-steps",fallback:"20"},comfyuiCfg:{id:"comfyui-cfg",fallback:"7.5"},comfyuiSeed:{id:"comfyui-seed",fallback:"-1"},comfyuiTimeoutMs:{id:"comfyui-timeout-ms",fallback:"180000"},comfyuiPromptPrefix:{id:"comfyui-prompt-prefix",fallback:"RPG game scene"},comfyuiPromptSuffix:{id:"comfyui-prompt-suffix",fallback:"high quality, detailed, fantasy art style"},comfyuiNegativePrompt:{id:"comfyui-negative-prompt",fallback:"low quality, blurry, deformed, ugly, bad anatomy, watermark, text"},comfyuiFilenamePrefix:{id:"comfyui-filename-prefix",fallback:"rpg_scene"},comfyuiWorkflowMode:{id:"comfyui-workflow-mode",fallback:"custom"},comfyuiWorkflowFile:{id:"comfyui-workflow-file",fallback:""},comfyuiWorkflowJson:{id:"comfyui-workflow-json",fallback:""},imageApiUrl:{id:"image-api-url",fallback:""},imageApiKey:{id:"image-api-key",fallback:""}};function it(e,t){var n;return((n=t.getElementById(e))==null?void 0:n.value)||""}function rt(e,t){const n=t.getElementById(e.id);return n?e.type==="checkbox"?n.checked:n.value||e.fallback||"":e.fallback}function ot(e,t,n){const i=n.getElementById(e);i&&t!==void 0&&(i.value=t)}function ct(e,t,n){const i=n.getElementById(e.id);if(!(!i||t===void 0)){if(e.type==="checkbox"){i.checked=!!t;return}i.value=t}}function ae(e=null,t=document){const n=e||t.getElementById("llm-source").value,i=De[n]||{},r={llmSource:n};for(const[o,s]of Object.entries(i))r[o]=it(s.id,t)||s.fallback||"";return r}function st(e,t=document){const n=e.llmSource||"openai";t.getElementById("llm-source").value=n,t.getElementById("llm-source").dispatchEvent(new Event("change"));const i=De[n]||{};for(const[r,o]of Object.entries(i))ot(o.id,e[r]||o.fallback||"",t)}function D(e=document){const t={settings:ae(null,e)};for(const[n,i]of Object.entries(Me))t[n]=rt(i,e);return t}function Pe(e={},t=document){for(const[n,i]of Object.entries(Me))ct(i,e[n]??i.fallback,t)}const a={currentGameType:null,currentProjectId:null,currentProjectData:null,currentGameId:null,currentGameData:null,gameState:null,currentGenerationConfig:null,currentSessionId:null,currentStepId:null,allSteps:[],stepStates:{},sceneImages:[],selectedSceneImageIndex:0,lastSuggestedImagePrompt:"",activeSceneImage:"",transitioningSceneImage:"",currentVisualSignature:"",sceneImageTransitionToken:0,runtimeSnapshotTimer:null,runtimeSnapshotSaving:!1},Ne="rpg_generator_settings",z="rpg_generator_generation_settings",Oe={adventure:"冒险 RPG",dungeon:"地牢探索",romance:"恋爱模拟",mystery:"推理解谜",fantasy:"奇幻魔法",scifi:"科幻星际",survival:"生存挑战",kingdom:"王国建设",cultivation:"修仙问道",custom:"自定义 RPG"},A={worldview:{icon:"世",name:"世界观",desc:"先确定世界背景、主要势力、地点与规则。"},coreCharacters:{icon:"核",name:"核心角色",desc:"生成推动主线的关键角色。"},secondaryCharacters:{icon:"辅",name:"次要角色",desc:"补充世界细节与互动节点。"},items:{icon:"物",name:"物品道具",desc:"生成装备、任务物品和关键奖励。"},puzzles:{icon:"谜",name:"谜题挑战",desc:"设计挑战、机关和探索障碍。"},mainPlot:{icon:"主",name:"主线剧情",desc:"组织章节推进与核心冲突。"},sidePlots:{icon:"支",name:"支线剧情",desc:"补充可选故事和人物支线。"},fragments:{icon:"碎",name:"碎片内容",desc:"生成可探索的世界细节与传闻。"},integration:{icon:"整",name:"整合方案",desc:"把已确认内容整合成最终可玩的方案。"}};document.addEventListener("DOMContentLoaded",()=>{ut(),pt(),ft(),bt(),ht(),It(),At(),zt(),He()});function L(e){return a.stepStates[e]||(a.stepStates[e]={candidates:[],selectedIndex:-1,status:"idle",history:[]}),a.stepStates[e]}function b(e){var t;document.querySelectorAll(".screen").forEach(n=>n.classList.remove("active")),(t=document.getElementById(e))==null||t.classList.add("active")}function w(e,t){const n=document.getElementById("api-status-dot"),i=document.getElementById("api-status-text");n&&(n.className="status-dot",n.classList.add(`status-${e}`)),i&&(i.textContent=t)}function Z(){const e=document.getElementById("image-source").value;document.getElementById("comfyui-settings").style.display=e==="comfyui"?"block":"none",document.getElementById("api-settings").style.display=e==="api"?"block":"none",_e()}function lt(){const e=document.getElementById("comfyui-settings");!e||e.dataset.enhanced==="true"||(e.innerHTML=`
        <div class="sub-config-row">
            <input type="text" id="comfyui-url" data-generation-setting="true" placeholder="ComfyUI URL (default: http://127.0.0.1:8000)" value="http://127.0.0.1:8000" />
            <button type="button" id="refresh-comfyui-btn" class="test-btn">Refresh models</button>
            <button type="button" id="test-comfyui-btn" class="test-btn">Test connection</button>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="image-generation-mode">Image generation mode</label>
                <select id="image-generation-mode" data-generation-setting="true">
                    <option value="manual">Manual button</option>
                    <option value="auto">Auto after each action</option>
                </select>
            </div>
            <div>
                <label for="comfyui-image-count">Image count</label>
                <input type="number" id="comfyui-image-count" data-generation-setting="true" value="1" min="1" max="8" />
            </div>
            <div>
                <label for="comfyui-workflow-mode">Workflow</label>
                <select id="comfyui-workflow-mode" data-generation-setting="true">
                    <option value="custom">Custom JSON</option>
                    <option value="default">Default template</option>
                </select>
            </div>
        </div>
        <div class="helper-text">
            Recommended: keep this on <strong>Custom JSON</strong>. We only inject the prompt and image count into your existing ComfyUI workflow.
        </div>
        <div id="comfyui-default-workflow-fields" style="display:none">
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-model">Checkpoint</label>
                    <select id="comfyui-model" data-generation-setting="true">
                        <option value="">Refresh to load models</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-sampler">Sampler</label>
                    <select id="comfyui-sampler" data-generation-setting="true">
                        <option value="euler">euler</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-scheduler">Scheduler</label>
                    <select id="comfyui-scheduler" data-generation-setting="true">
                        <option value="normal">normal</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-width">Width</label>
                    <input type="number" id="comfyui-width" data-generation-setting="true" value="768" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-height">Height</label>
                    <input type="number" id="comfyui-height" data-generation-setting="true" value="512" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-steps">Steps</label>
                    <input type="number" id="comfyui-steps" data-generation-setting="true" value="20" min="1" max="150" />
                </div>
                <div>
                    <label for="comfyui-cfg">CFG</label>
                    <input type="number" id="comfyui-cfg" data-generation-setting="true" value="7.5" min="0.1" max="30" step="0.1" />
                </div>
                <div>
                    <label for="comfyui-seed">Seed</label>
                    <input type="number" id="comfyui-seed" data-generation-setting="true" value="-1" />
                </div>
            </div>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="comfyui-timeout-ms">Timeout (ms)</label>
                <input type="number" id="comfyui-timeout-ms" data-generation-setting="true" value="180000" min="5000" step="1000" />
            </div>
            <div>
                <label for="comfyui-filename-prefix">Filename prefix</label>
                <input type="text" id="comfyui-filename-prefix" data-generation-setting="true" placeholder="Filename prefix" value="rpg_scene" />
            </div>
        </div>
        <div id="comfyui-custom-workflow">
            <div class="sub-config-row">
                <select id="comfyui-workflow-file" data-generation-setting="true">
                    <option value="">Select a workflow file from G:\\comfy\\wenjian\\user\\default\\workflows</option>
                </select>
                <button type="button" id="refresh-workflow-files-btn" class="test-btn">Refresh workflows</button>
                <button type="button" id="load-workflow-file-btn" class="test-btn">Load selected</button>
            </div>
            <textarea id="comfyui-workflow-json" data-generation-setting="true" rows="10" placeholder="Paste a ComfyUI workflow JSON here. If your workflow already contains CLIPTextEncode text nodes, the backend will inject the current prompt automatically. You can also use placeholders like {{prompt}}, {{raw_prompt}}, {{negative_prompt}}, {{batch_size}}, {{ckpt_name}}."></textarea>
            <div class="sub-config-actions">
                <button type="button" id="validate-workflow-btn" class="test-btn">Validate workflow</button>
            </div>
        </div>
        <details id="comfyui-prompt-overrides">
            <summary>Optional prompt helpers</summary>
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-prompt-prefix">Prompt prefix</label>
                    <input type="text" id="comfyui-prompt-prefix" data-generation-setting="true" placeholder="Positive prefix" value="RPG game scene" />
                </div>
                <div>
                    <label for="comfyui-prompt-suffix">Prompt suffix</label>
                    <input type="text" id="comfyui-prompt-suffix" data-generation-setting="true" placeholder="Positive suffix" value="high quality, detailed, fantasy art style" />
                </div>
                <div>
                    <label for="comfyui-negative-prompt">Negative prompt</label>
                    <input type="text" id="comfyui-negative-prompt" data-generation-setting="true" placeholder="Negative prompt" value="low quality, blurry, deformed, ugly, bad anatomy, watermark, text" />
                </div>
            </div>
        </details>
        <div id="comfyui-status" class="helper-text">ComfyUI settings have not been checked yet.</div>
    `,e.dataset.enhanced="true")}function dt(){const e=document.getElementById("live-image-config");!e||e.dataset.enhanced==="true"||(e.innerHTML=`
        <div class="live-image-config-card">
            <div class="sub-config-row">
                <select id="live-comfyui-model">
                    <option value="">Select model</option>
                </select>
                <select id="live-comfyui-workflow-file">
                    <option value="">Select workflow file</option>
                </select>
                <button type="button" id="live-load-workflow-btn" class="test-btn">Load workflow</button>
            </div>
            <div class="sub-config-row">
                <button type="button" id="live-refresh-comfyui-btn" class="test-btn">Refresh models</button>
                <button type="button" id="live-refresh-workflow-files-btn" class="test-btn">Refresh workflows</button>
                <button type="button" id="live-test-comfyui-btn" class="test-btn">Test ComfyUI</button>
            </div>
            <details id="live-comfyui-settings">
                <summary>ComfyUI live settings</summary>
                <div class="sub-config-grid" style="margin-top:0.75rem">
                    <div>
                        <label for="live-comfyui-url">ComfyUI URL</label>
                        <input type="text" id="live-comfyui-url" value="http://127.0.0.1:8000" />
                    </div>
                    <div>
                        <label for="live-comfyui-workflow-mode">Workflow mode</label>
                        <select id="live-comfyui-workflow-mode">
                            <option value="custom">Custom workflow</option>
                            <option value="default">Default template</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-sampler">Sampler</label>
                        <select id="live-comfyui-sampler">
                            <option value="euler">euler</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-scheduler">Scheduler</label>
                        <select id="live-comfyui-scheduler">
                            <option value="normal">normal</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-width">Width</label>
                        <input type="number" id="live-comfyui-width" value="768" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-height">Height</label>
                        <input type="number" id="live-comfyui-height" value="512" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-steps">Steps</label>
                        <input type="number" id="live-comfyui-steps" value="20" min="1" max="150" />
                    </div>
                    <div>
                        <label for="live-comfyui-cfg">CFG</label>
                        <input type="number" id="live-comfyui-cfg" value="7.5" min="0.1" max="30" step="0.1" />
                    </div>
                    <div>
                        <label for="live-comfyui-seed">Seed</label>
                        <input type="number" id="live-comfyui-seed" value="-1" />
                    </div>
                    <div>
                        <label for="live-comfyui-timeout-ms">Timeout (ms)</label>
                        <input type="number" id="live-comfyui-timeout-ms" value="180000" min="5000" step="1000" />
                    </div>
                </div>
                <div class="sub-config-grid">
                    <div>
                        <label for="live-comfyui-prompt-prefix">Prompt prefix</label>
                        <input type="text" id="live-comfyui-prompt-prefix" value="RPG game scene" />
                    </div>
                    <div>
                        <label for="live-comfyui-prompt-suffix">Prompt suffix</label>
                        <input type="text" id="live-comfyui-prompt-suffix" value="high quality, detailed, fantasy art style" />
                    </div>
                    <div>
                        <label for="live-comfyui-negative-prompt">Negative prompt</label>
                        <input type="text" id="live-comfyui-negative-prompt" value="low quality, blurry, deformed, ugly, bad anatomy, watermark, text" />
                    </div>
                    <div>
                        <label for="live-comfyui-filename-prefix">Filename prefix</label>
                        <input type="text" id="live-comfyui-filename-prefix" value="rpg_scene" />
                    </div>
                </div>
                <div id="live-comfyui-custom-workflow" style="margin-top:0.75rem">
                    <textarea id="live-comfyui-workflow-json" rows="8" placeholder="Custom workflow JSON will load here."></textarea>
                    <div class="sub-config-actions">
                        <button type="button" id="live-validate-workflow-btn" class="test-btn">Validate workflow</button>
                    </div>
                </div>
            </details>
            <div id="live-comfyui-status" class="helper-text">API mode uses the generate button directly. Switch to ComfyUI to adjust model and workflow here.</div>
        </div>
    `,e.dataset.enhanced="true")}function mt(){const e=document.getElementById("live-comfyui-workflow-mode"),t=document.getElementById("live-comfyui-custom-workflow");!e||!t||(t.style.display=e.value==="custom"?"block":"none")}function _e(){const e=document.getElementById("comfyui-workflow-mode"),t=document.getElementById("comfyui-custom-workflow"),n=document.getElementById("comfyui-default-workflow-fields");if(!e||!t||!n)return;const i=e.value==="custom";t.style.display=i?"block":"none",n.style.display=i?"none":"block"}function ie(){var e,t,n,i,r,o,s,m,l,c,u,g,y,G,_,H,R,U;return{imageSource:$().imageSource,imageGenerationMode:$().imageGenerationMode,comfyuiUrl:((e=document.getElementById("live-comfyui-url"))==null?void 0:e.value)||"http://127.0.0.1:8000",comfyuiImageCount:((t=document.getElementById("scene-image-count"))==null?void 0:t.value)||"1",comfyuiModel:((n=document.getElementById("live-comfyui-model"))==null?void 0:n.value)||"",comfyuiSampler:((i=document.getElementById("live-comfyui-sampler"))==null?void 0:i.value)||"euler",comfyuiScheduler:((r=document.getElementById("live-comfyui-scheduler"))==null?void 0:r.value)||"normal",comfyuiWidth:((o=document.getElementById("live-comfyui-width"))==null?void 0:o.value)||"768",comfyuiHeight:((s=document.getElementById("live-comfyui-height"))==null?void 0:s.value)||"512",comfyuiSteps:((m=document.getElementById("live-comfyui-steps"))==null?void 0:m.value)||"20",comfyuiCfg:((l=document.getElementById("live-comfyui-cfg"))==null?void 0:l.value)||"7.5",comfyuiSeed:((c=document.getElementById("live-comfyui-seed"))==null?void 0:c.value)||"-1",comfyuiTimeoutMs:((u=document.getElementById("live-comfyui-timeout-ms"))==null?void 0:u.value)||"180000",comfyuiPromptPrefix:((g=document.getElementById("live-comfyui-prompt-prefix"))==null?void 0:g.value)||"",comfyuiPromptSuffix:((y=document.getElementById("live-comfyui-prompt-suffix"))==null?void 0:y.value)||"",comfyuiNegativePrompt:((G=document.getElementById("live-comfyui-negative-prompt"))==null?void 0:G.value)||"",comfyuiFilenamePrefix:((_=document.getElementById("live-comfyui-filename-prefix"))==null?void 0:_.value)||"",comfyuiWorkflowMode:((H=document.getElementById("live-comfyui-workflow-mode"))==null?void 0:H.value)||"custom",comfyuiWorkflowFile:((R=document.getElementById("live-comfyui-workflow-file"))==null?void 0:R.value)||"",comfyuiWorkflowJson:((U=document.getElementById("live-comfyui-workflow-json"))==null?void 0:U.value)||""}}function ee(e,t=""){const n=document.getElementById("comfyui-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function I(e={}){const t={...e};return(!t.comfyuiUrl||t.comfyuiUrl==="http://127.0.0.1:8188")&&(t.comfyuiUrl="http://127.0.0.1:8000"),t.imageGenerationMode||(t.imageGenerationMode="manual"),t.comfyuiWorkflowMode||(t.comfyuiWorkflowMode="custom"),t.comfyuiImageCount||(t.comfyuiImageCount="1"),t}function te(){const e=document.getElementById("llm-source").value;document.querySelectorAll(".api-config").forEach(n=>{n.style.display="none"});const t=document.getElementById(`${e}-config`);t&&(t.style.display="block")}function ut(){var e,t,n,i;document.querySelectorAll(".type-card").forEach(r=>{r.addEventListener("click",()=>{a.currentGameType=r.dataset.type,a.currentProjectId=null,a.currentProjectData=null,document.querySelectorAll(".type-card").forEach(o=>o.classList.remove("selected")),r.classList.add("selected"),document.getElementById("config-title").textContent=`配置你的${Oe[a.currentGameType]||"RPG"}游戏`,b("config-screen")})}),document.getElementById("back-to-home").addEventListener("click",()=>b("home-screen")),(e=document.getElementById("open-import-screen"))==null||e.addEventListener("click",()=>{h("导入后会自动创建项目，并预填到现有生成流程中。"),b("import-screen")}),(t=document.getElementById("back-from-import"))==null||t.addEventListener("click",()=>b("home-screen")),(n=document.getElementById("back-to-import-edit"))==null||n.addEventListener("click",()=>b("import-screen")),(i=document.getElementById("confirm-import-preview"))==null||i.addEventListener("click",async()=>{await Tt()}),document.getElementById("gen-back-to-config").addEventListener("click",()=>{b(a.currentProjectId?"import-screen":"config-screen")}),document.getElementById("exit-game").addEventListener("click",()=>{confirm("确定退出当前游戏吗？未保存进度将会丢失。")&&(a.currentGameId=null,a.gameState=null,b("home-screen"))})}function pt(){const e=document.getElementById("load-saved-games-btn"),t=document.getElementById("close-saved-games");e==null||e.addEventListener("click",()=>{vt();const n=document.getElementById("saved-games-section");n&&(n.style.display="block")}),t==null||t.addEventListener("click",()=>{const n=document.getElementById("saved-games-section");n&&(n.style.display="none")})}function ft(){var n,i,r,o,s,m,l;const e=document.getElementById("settings-modal"),t=document.getElementById("game-menu-modal");lt(),document.getElementById("settings-btn").addEventListener("click",()=>{e.classList.add("active"),He()}),e.querySelector(".modal-close").addEventListener("click",()=>{e.classList.remove("active")}),t.querySelector(".modal-close").addEventListener("click",()=>{t.classList.remove("active")}),document.getElementById("save-settings").addEventListener("click",()=>{gt(),e.classList.remove("active")}),document.getElementById("llm-source").addEventListener("change",te),document.getElementById("image-source").addEventListener("change",async()=>{Z(),P(),document.getElementById("image-source").value==="comfyui"&&await refreshComfyUIOptions(!1)}),(n=document.getElementById("comfyui-workflow-mode"))==null||n.addEventListener("change",()=>{_e(),P()}),(i=document.getElementById("refresh-comfyui-btn"))==null||i.addEventListener("click",async()=>{await refreshComfyUIOptions(!0)}),(r=document.getElementById("refresh-workflow-files-btn"))==null||r.addEventListener("click",async()=>{await refreshComfyWorkflowFiles(!0)}),(o=document.getElementById("load-workflow-file-btn"))==null||o.addEventListener("click",async()=>{await loadSelectedComfyWorkflowFile(!0)}),(s=document.getElementById("test-comfyui-btn"))==null||s.addEventListener("click",async()=>{await testComfyUIConnection()}),(m=document.getElementById("validate-workflow-btn"))==null||m.addEventListener("click",async()=>{await validateComfyUIWorkflow()}),(l=document.getElementById("comfyui-workflow-file"))==null||l.addEventListener("change",c=>{var y;const u=((y=c.target)==null?void 0:y.value)||"",g=document.getElementById("comfyui-workflow-file");g&&(g.dataset.selectedWorkflow=u),P(),u&&ee(`Selected workflow: ${u}`,"success")}),document.getElementById("test-openai-btn").addEventListener("click",()=>W("openai")),document.getElementById("test-anthropic-btn").addEventListener("click",()=>W("anthropic")),document.getElementById("test-local-btn").addEventListener("click",()=>W("local")),document.getElementById("test-custom-btn").addEventListener("click",()=>W("custom")),document.querySelectorAll('[data-generation-setting="true"]').forEach(c=>{c.addEventListener("change",()=>{P(),q()})}),document.getElementById("enable-images").addEventListener("change",()=>{P(),q()}),te(),Z()}function gt(){localStorage.setItem(Ne,JSON.stringify(ae())),P()}function He(){const e=localStorage.getItem(Ne),t=localStorage.getItem(z);try{e&&st(JSON.parse(e)),Pe(I(t?JSON.parse(t):{})),a.currentGenerationConfig=D(),te(),Z(),q(),a.currentGenerationConfig.imageSource==="comfyui"&&a.currentGenerationConfig.enableImages!==!1&&(refreshComfyUIOptions(!1).catch(n=>{ee(n.message,"error")}),refreshComfyWorkflowFiles(!1).then(()=>{var r;const n=(r=a.currentGenerationConfig)==null?void 0:r.comfyuiWorkflowFile,i=document.getElementById("comfyui-workflow-json");return n&&i&&!i.value.trim()?loadSelectedComfyWorkflowFile(!1,n):null}).catch(n=>{ee(n.message,"error")}))}catch(n){console.error("Load settings error:",n)}}function P(){const e=I(D());a.currentGenerationConfig=e,localStorage.setItem(z,JSON.stringify(e))}function xe(e,t,n={}){return{version:1,gameId:e,title:n.title||(t==null?void 0:t.name)||"未命名存档",type:n.type||a.currentGameType||(t==null?void 0:t.type)||"custom",savedAt:new Date().toISOString(),gameData:n.gameData||a.currentGameData||null,generationConfig:I(n.generationConfig||a.currentGenerationConfig||D()),gameState:t}}function re(e){var n,i;const t=localStorage.getItem(e);if(!t)return null;try{const r=JSON.parse(t),o=e.replace(/^rpg_save_/,"");return r&&r.version===1&&r.gameState?{gameId:r.gameId||o,title:r.title||((n=r.gameState)==null?void 0:n.name)||"未命名存档",type:r.type||((i=r.gameState)==null?void 0:i.type)||"custom",savedAt:r.savedAt||null,gameData:r.gameData||null,generationConfig:r.generationConfig?I(r.generationConfig):null,gameState:r.gameState}:{gameId:o,title:(r==null?void 0:r.name)||"旧版存档",type:(r==null?void 0:r.type)||"custom",savedAt:null,gameData:null,generationConfig:null,gameState:r}}catch(r){return console.error("Read saved game error:",r),null}}function yt(){return Object.keys(localStorage).filter(e=>e.startsWith("rpg_save_")).map(e=>re(e)).filter(Boolean).sort((e,t)=>{const n=e.savedAt?new Date(e.savedAt).getTime():0;return(t.savedAt?new Date(t.savedAt).getTime():0)-n})}function vt(){const e=document.getElementById("saved-games-list");if(!e)return;const t=yt();if(!t.length){e.innerHTML='<p class="empty-hint">暂无存档</p>';return}e.innerHTML=t.map(n=>`
        <button type="button" class="saved-game-card" data-saved-game-id="${d(n.gameId)}">
            <div class="saved-game-header">
                <span class="saved-game-name">${d(n.title||"未命名存档")}</span>
                <span class="saved-game-type">${d(Oe[n.type]||n.type||"存档")}</span>
            </div>
            <div class="saved-game-info">ID: ${d(n.gameId)}</div>
            <div class="saved-game-time">${d(n.savedAt?new Date(n.savedAt).toLocaleString():"旧版存档")}</div>
        </button>
    `).join(""),e.querySelectorAll("[data-saved-game-id]").forEach(n=>{n.addEventListener("click",async()=>{await Re(n.dataset.savedGameId)})})}async function Re(e){const t=re(`rpg_save_${e}`);if(!(t!=null&&t.gameState)){alert("没有找到可读取的存档。");return}let n=!1;try{const r=await f(`/games/${t.gameId}`);a.currentGameData=r.game||t.gameData||null,n=!0}catch{if(t.gameData&&t.generationConfig)try{const o=await f("/games/restore",v("POST",{gameId:t.gameId,gameData:t.gameData,gameState:t.gameState,config:I(t.generationConfig)}));t.gameId=o.gameId||t.gameId,t.gameState=o.gameState||t.gameState,a.currentGameData=t.gameData,n=!0}catch(o){console.error("Restore saved game error:",o)}}a.currentGameId=t.gameId,a.currentGameType=t.type||a.currentGameType,a.gameState=t.gameState,a.sceneImages=[],a.selectedSceneImageIndex=0,t.generationConfig&&(a.currentGenerationConfig=I(t.generationConfig),localStorage.setItem(z,JSON.stringify(a.currentGenerationConfig))),b("game-screen"),ce(t.gameState),Y([]),n||alert("这个存档已载入画面，但后端运行态未成功恢复。请重新开始后再保存一次，之后即可正常续玩。");const i=document.getElementById("saved-games-section");i&&(i.style.display="none")}function bt(){document.getElementById("game-config-form").addEventListener("submit",async e=>{if(e.preventDefault(),!a.currentGameType){alert("请先选择一个游戏类型。"),b("home-screen");return}await wt()})}function ht(){var e,t;(e=document.getElementById("import-project-form"))==null||e.addEventListener("submit",async n=>{n.preventDefault(),await Ct()}),(t=document.getElementById("refresh-import-projects"))==null||t.addEventListener("click",async()=>{await J()}),J().catch(n=>{console.error("Load imported projects error:",n)})}function h(e,t=""){const n=document.getElementById("import-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}async function Ue(e){var t;a.currentSessionId=e.sessionId,a.allSteps=e.steps||[],a.currentStepId=e.firstStep||((t=a.allSteps[0])==null?void 0:t.id)||null,a.stepStates={},b("generation-workbench"),O(),await oe(),T(a.currentStepId),Qe(),w("idle","已创建生成会话，点击“生成”开始当前步骤。")}async function wt(){const e=I(D());a.currentGenerationConfig=e,P();const t={userInput:document.getElementById("game-description").value.trim()||"暂无额外描述",gameType:a.currentGameType,config:e};try{const n=await f("/generate/init",v("POST",t));a.currentProjectId=null,a.currentProjectData=null,await Ue(n);return}catch(n){console.error("Session init error:",n),alert(`初始化失败：${n.message}`),b("config-screen")}}function It(){var e,t,n,i,r,o,s;(e=document.getElementById("save-import-preview"))==null||e.addEventListener("click",async()=>{await Ke()}),(t=document.getElementById("generate-base-assets"))==null||t.addEventListener("click",async()=>{await Fe()}),(n=document.getElementById("rebuild-adaptation-btn"))==null||n.addEventListener("click",async()=>{await We()}),(i=document.getElementById("rebuild-visual-bible-btn"))==null||i.addEventListener("click",async()=>{await Je()}),(r=document.getElementById("apply-project-refinement-btn"))==null||r.addEventListener("click",async()=>{await ze()}),(o=document.getElementById("export-project-package-btn"))==null||o.addEventListener("click",async()=>{await Ve()}),(s=document.getElementById("import-preview-screen"))==null||s.addEventListener("click",m=>{const l=m.target.closest("[data-preview-action]");l&&Lt(l.dataset.previewAction,l)})}function p(e,t=""){const n=document.getElementById("import-preview-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function Et(e){return JSON.parse(JSON.stringify(e||{}))}function St(e=0){return{id:`draft_char_${Date.now()}_${e}`,name:"",role:"",description:""}}function kt(e=0){return{id:`draft_chapter_${Date.now()}_${e}`,title:`新章节 ${e+1}`,summary:""}}function Bt(e=0){return{id:`draft_location_${Date.now()}_${e}`,name:"",description:""}}function $t(){const e=Et(a.currentProjectData),t=V();return e.storyBible=e.storyBible||{},e.source=e.source||{},e.title=t.title||e.title||"",e.storyBible.summary=t.summary||e.storyBible.summary||"",e.storyBible.characters=t.characters,e.storyBible.chapters=t.chapters,e.storyBible.locations=t.locations,e.source.title=e.title||e.source.title||"",e}function Lt(e,t){if(!e||!a.currentProjectData)return;const n=$t();if(n.storyBible=n.storyBible||{},e==="add-character"){const i=Array.isArray(n.storyBible.characters)?n.storyBible.characters:[];i.push(St(i.length)),n.storyBible.characters=i}if(e==="remove-character"){const i=t.closest('[data-preview-item="character"]'),r=Number((i==null?void 0:i.dataset.index)??-1);n.storyBible.characters=(n.storyBible.characters||[]).filter((o,s)=>s!==r)}if(e==="add-chapter"){const i=Array.isArray(n.storyBible.chapters)?n.storyBible.chapters:[];i.push(kt(i.length)),n.storyBible.chapters=i}if(e==="remove-chapter"){const i=t.closest('[data-preview-item="chapter"]'),r=Number((i==null?void 0:i.dataset.index)??-1);n.storyBible.chapters=(n.storyBible.chapters||[]).filter((o,s)=>s!==r)}if(e==="add-location"){const i=Array.isArray(n.storyBible.locations)?n.storyBible.locations:[];i.push(Bt(i.length)),n.storyBible.locations=i}if(e==="remove-location"){const i=t.closest('[data-preview-item="location"]'),r=Number((i==null?void 0:i.dataset.index)??-1);n.storyBible.locations=(n.storyBible.locations||[]).filter((o,s)=>s!==r)}a.currentProjectData=n,j(n),p("本地预览已更新，记得保存后再进入工作台。","pending")}function X(e,t){return Array.from(document.querySelectorAll(`[data-preview-collection="${e}"] [data-preview-item="${e}"]`)).map((n,i)=>t(n,i))}function V(){var e,t,n,i,r,o,s,m,l;return{title:((e=document.getElementById("import-preview-title"))==null?void 0:e.value.trim())||((t=a.currentProjectData)==null?void 0:t.title)||"",summary:((n=document.getElementById("import-preview-summary-input"))==null?void 0:n.value.trim())||((r=(i=a.currentProjectData)==null?void 0:i.storyBible)==null?void 0:r.summary)||"",adaptationMode:((o=document.getElementById("import-preview-adaptation-mode"))==null?void 0:o.value)||((s=a.currentProjectData)==null?void 0:s.adaptationMode)||"balanced",gameType:((m=document.getElementById("import-preview-game-type"))==null?void 0:m.value)||((l=a.currentProjectData)==null?void 0:l.gameType)||a.currentGameType||"custom",characters:X("character",(c,u)=>{var g,y,G;return{id:c.dataset.itemId||`import_char_${u+1}`,name:((g=c.querySelector('[data-field="name"]'))==null?void 0:g.value.trim())||"",role:((y=c.querySelector('[data-field="role"]'))==null?void 0:y.value.trim())||"",description:((G=c.querySelector('[data-field="description"]'))==null?void 0:G.value.trim())||""}}).filter(c=>c.name||c.role||c.description),chapters:X("chapter",(c,u)=>{var g,y;return{id:c.dataset.itemId||`chapter_${u+1}`,title:((g=c.querySelector('[data-field="title"]'))==null?void 0:g.value.trim())||`章节 ${u+1}`,summary:((y=c.querySelector('[data-field="summary"]'))==null?void 0:y.value.trim())||""}}).filter(c=>c.title||c.summary),locations:X("location",(c,u)=>{var g,y;return{id:c.dataset.itemId||`import_loc_${u+1}`,name:((g=c.querySelector('[data-field="name"]'))==null?void 0:g.value.trim())||"",description:((y=c.querySelector('[data-field="description"]'))==null?void 0:y.value.trim())||""}}).filter(c=>c.name||c.description)}}function j(e=a.currentProjectData){var _,H,R,U,se,le,de,me,ue,pe,fe,ge,ye,ve,be,he,we,Ie,Ee,Se,ke,Be,$e;if(!e)return;const t=document.getElementById("import-preview-summary"),n=document.getElementById("import-preview-characters"),i=document.getElementById("import-preview-chapters"),r=document.getElementById("import-preview-visuals"),o=((_=e.storyBible)==null?void 0:_.summary)||((H=e.source)==null?void 0:H.excerpt)||"",s=Array.isArray((R=e.storyBible)==null?void 0:R.themes)&&e.storyBible.themes.length?e.storyBible.themes.join("、"):"待补充",m=Array.isArray((U=e.storyBible)==null?void 0:U.characters)?e.storyBible.characters:[],l=Array.isArray((se=e.storyBible)==null?void 0:se.chapters)?e.storyBible.chapters:[],c=Array.isArray((le=e.storyBible)==null?void 0:le.locations)?e.storyBible.locations:[],u=c.slice(0,5).map(E=>E.name).filter(Boolean).join("、"),g=m.slice(0,4).map(E=>E.name).filter(Boolean).join("、"),y=c.slice(0,4).map(E=>E.name).filter(Boolean).join("、"),G=((me=(de=e.visualBible)==null?void 0:de.styleProfile)==null?void 0:me.atmosphere)||"待确认";if(t&&(t.innerHTML=`
            <div class="preview-summary-block">
                <div class="preview-field">
                    <label for="import-preview-title">项目标题</label>
                    <input id="import-preview-title" type="text" value="${B(e.title||"")}" placeholder="输入项目标题" />
                </div>
                <div class="preview-field">
                    <label for="import-preview-summary-input">剧情摘要</label>
                    <textarea id="import-preview-summary-input" rows="6" placeholder="补充导入项目的剧情摘要">${d(o)}</textarea>
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
                    <p>主题：${d(s)}</p>
                    <p>主要地点：${d(u||"待补充")}</p>
                </div>
            </div>
        `),n){const E=m.length?m.map((S,F)=>`
                <article class="preview-edit-item" data-preview-item="character" data-index="${F}" data-item-id="${B(S.id||"")}">
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label>角色名</label>
                            <input type="text" data-field="name" value="${B(S.name||"")}" placeholder="角色名称" />
                        </div>
                        <div class="preview-field">
                            <label>角色定位</label>
                            <input type="text" data-field="role" value="${B(S.role||"")}" placeholder="主角 / 配角 / 阵营人物" />
                        </div>
                    </div>
                    <div class="preview-field">
                        <label>角色描述</label>
                        <textarea data-field="description" rows="4" placeholder="补充角色外观、气质、动机">${d(S.description||"")}</textarea>
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
                ${E}
            </div>
        `}if(i){const E=l.length?l.map((S,F)=>`
                <article class="preview-edit-item" data-preview-item="chapter" data-index="${F}" data-item-id="${B(S.id||"")}">
                    <div class="preview-field">
                        <label>章节标题</label>
                        <input type="text" data-field="title" value="${B(S.title||S.name||"")}" placeholder="章节标题" />
                    </div>
                    <div class="preview-field">
                        <label>章节摘要</label>
                        <textarea data-field="summary" rows="5" placeholder="这一章的主要事件与冲突">${d(S.summary||"")}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-chapter">删除章节</button>
                    </div>
                </article>
            `).join(""):'<p class="empty-hint">还没识别到章节结构，可以先加几个关键情节节点。</p>';i.innerHTML=`
            <div class="preview-card-header">
                <p class="helper-text">保留关键章节就够，后续工作台还会继续细化。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-chapter">新增章节</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="chapter">
                ${E}
            </div>
        `}if(r){const E=c.length?c.map((Q,tt)=>`
                <article class="preview-edit-item" data-preview-item="location" data-index="${tt}" data-item-id="${B(Q.id||"")}">
                    <div class="preview-field">
                        <label>地点名称</label>
                        <input type="text" data-field="name" value="${B(Q.name||"")}" placeholder="地点名称" />
                    </div>
                    <div class="preview-field">
                        <label>地点描述</label>
                        <textarea data-field="description" rows="4" placeholder="地点外观、氛围、功能">${d(Q.description||"")}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-location">删除地点</button>
                    </div>
                </article>
            `).join(""):'<p class="empty-hint">地点越准，后面的场景基准图就越稳。</p>',S=((pe=(ue=e.visualBible)==null?void 0:ue.styleProfile)==null?void 0:pe.stylePreset)||"cinematic_cn_rpg",F=((fe=e.config)==null?void 0:fe.refinement)||{},Le=((ge=e.gameDesign)==null?void 0:ge.branchingPolicy)||{},et=`每章分支上限 ${Le.maxBranchPerChapter||"-"}，锚点保留率 ${Le.mustKeepAnchorRate||"-"}`;r.innerHTML=`
            <div class="preview-card-header">
                <p class="helper-text">先确认后续要做视觉建档的主要地点。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-location">新增地点</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="location">
                ${E}
            </div>

            <div class="preview-card-header">
                <h3>改编导演与视觉重建</h3>
            </div>
            <div class="preview-edit-stack">
                <article class="preview-edit-item">
                    <div class="preview-field">
                        <label for="preview-style-preset">风格预设</label>
                        <input id="preview-style-preset" type="text" value="${B(S)}" placeholder="如 cinematic_cn_rpg / ink_fantasy" />
                    </div>
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label for="preview-pacing">节奏倾向</label>
                            <select id="preview-pacing">
                                <option value="slow" ${((ye=e.config)==null?void 0:ye.pacing)==="slow"?"selected":""}>慢节奏</option>
                                <option value="balanced" ${!((ve=e.config)!=null&&ve.pacing)||((be=e.config)==null?void 0:be.pacing)==="balanced"?"selected":""}>平衡</option>
                                <option value="fast" ${((he=e.config)==null?void 0:he.pacing)==="fast"?"selected":""}>快节奏</option>
                            </select>
                        </div>
                        <div class="preview-field">
                            <label for="preview-adaptation-strength">改编强度 (0-1)</label>
                            <input id="preview-adaptation-strength" type="number" min="0" max="1" step="0.1" value="${Number(F.adaptationStrength??.5)}" />
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
                <button id="generate-base-assets" type="button" class="preview-inline-btn">生成角色/地点基准图</button>
            </div>
            <div id="project-asset-list" class="preview-edit-stack"></div>
            <div class="preview-content">
                <p>角色基准图建议：${d(g||"先确认角色后再生成")}</p>
                <p>场景基准图建议：${d(y||"先确认地点后再生成")}</p>
                <p>视觉氛围：${d(G)}</p>
                <p>改编策略：${d(((we=e.gameDesign)==null?void 0:we.adaptationProfile)||e.adaptationMode||"balanced")} · ${d(et)}</p>
            </div>
        `,Pt(((Ie=e.visualBible)==null?void 0:Ie.assetIndex)||[]),(Ee=document.getElementById("generate-base-assets"))==null||Ee.addEventListener("click",async()=>{await Fe()}),(Se=document.getElementById("rebuild-adaptation-btn"))==null||Se.addEventListener("click",async()=>{await We()}),(ke=document.getElementById("rebuild-visual-bible-btn"))==null||ke.addEventListener("click",async()=>{await Je()}),(Be=document.getElementById("apply-project-refinement-btn"))==null||Be.addEventListener("click",async()=>{await ze()}),($e=document.getElementById("export-project-package-btn"))==null||$e.addEventListener("click",async()=>{await Ve()})}}function Pt(e=[]){const t=document.getElementById("project-asset-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML='<p class="empty-hint">暂无视觉资产，可先生成基准图。</p>';return}t.innerHTML=e.slice(0,8).map(n=>`
        <article class="preview-edit-item">
            <strong>${d(n.targetName||n.type||"未命名资产")}</strong>
            <span class="helper-text">${d(n.type||"asset")} · ${d(n.status||"planned")}</span>
            ${n.imageUrl?`<img src="${n.imageUrl}" alt="${B(n.targetName||"资产图")}" style="width:100%;border-radius:8px;" />`:""}
        </article>
    `).join("")}}async function Fe(){var t,n;if(!a.currentProjectId){p("请先导入并保存项目。","error");return}const e=$();!e.enableImages||e.imageSource==="none"?p("当前图像生成未启用，将先以规划模式创建资产索引。","pending"):p("正在生成角色/地点基准图，请稍候...","pending");try{const i={dryRun:!e.enableImages||e.imageSource==="none",characterLimit:4,locationLimit:4,imageConfig:e.imageSource==="comfyui"?{...e,...ie()}:e},r=await f(`/projects/${a.currentProjectId}/assets/generate-base`,v("POST",i)),o=await f(`/projects/${a.currentProjectId}`);a.currentProjectData=o.project||a.currentProjectData,j(a.currentProjectData),p(i.dryRun?`已创建 ${((t=r.generatedAssets)==null?void 0:t.length)||0} 条资产规划。`:`已生成 ${((n=r.generatedAssets)==null?void 0:n.length)||0} 个基准资产。`,"success")}catch(i){p(`基准图生成失败：${i.message}`,"error")}}function qe(){var i,r,o;const e=((i=document.getElementById("preview-style-preset"))==null?void 0:i.value.trim())||"",t=((r=document.getElementById("preview-pacing"))==null?void 0:r.value)||"balanced",n=Number(((o=document.getElementById("preview-adaptation-strength"))==null?void 0:o.value)??.5);return{pacing:t,refinement:{adaptationStrength:Number.isFinite(n)?Math.max(0,Math.min(1,n)):.5},styleProfile:e?{stylePreset:e}:{}}}async function We(){if(!a.currentProjectId){p("请先导入并保存项目。","error");return}p("正在重算改编结构...","pending");try{const e=V(),t=await f(`/projects/${a.currentProjectId}/adaptation/rebuild`,v("POST",{gameType:e.gameType,adaptationMode:e.adaptationMode}));a.currentProjectData=t.project||a.currentProjectData,j(a.currentProjectData),p("改编结构已重算。","success")}catch(e){p(`重算失败：${e.message}`,"error")}}async function Je(){if(!a.currentProjectId){p("请先导入并保存项目。","error");return}p("正在重建视觉圣经...","pending");try{const e=qe(),t=await f(`/projects/${a.currentProjectId}/visual-bible/rebuild`,v("POST",{styleProfile:e.styleProfile}));a.currentProjectData=t.project||a.currentProjectData,j(a.currentProjectData),p("视觉圣经已重建。","success")}catch(e){p(`重建失败：${e.message}`,"error")}}async function ze(){if(!a.currentProjectId){p("请先导入并保存项目。","error");return}p("正在应用校正参数...","pending");try{const e=V(),t=qe(),n=await f(`/projects/${a.currentProjectId}/refine`,v("POST",{...t,adaptationMode:e.adaptationMode}));a.currentProjectData=n.project||a.currentProjectData,j(a.currentProjectData),p("校正参数已应用。","success")}catch(e){p(`应用失败：${e.message}`,"error")}}function xt(e,t){const n=new Blob([JSON.stringify(t,null,2)],{type:"application/json;charset=utf-8"}),i=URL.createObjectURL(n),r=document.createElement("a");r.href=i,r.download=e,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(i)}async function Ve(){var e;if(!a.currentProjectId){p("请先导入并保存项目。","error");return}p("正在导出项目包...","pending");try{const n=(await f(`/projects/${a.currentProjectId}/export-package`)).package||{},i=`${(((e=a.currentProjectData)==null?void 0:e.title)||"project").replace(/[\\/:*?"<>|]/g,"_")}_package.json`;xt(i,n),p("项目包导出成功。","success")}catch(t){p(`导出失败：${t.message}`,"error")}}async function Ke(e={}){if(!a.currentProjectId)return p("当前没有可保存的导入项目，请重新导入。","error"),null;const t=e.showStatus!==!1;t&&p("正在保存导入项目修改...","pending");try{const n=await f(`/projects/${a.currentProjectId}/update`,v("POST",{edits:V()}));return a.currentProjectData=n.project||a.currentProjectData,a.currentProjectData&&(document.getElementById("import-title").value=a.currentProjectData.title||""),j(a.currentProjectData),t&&p(e.successMessage||"导入项目修改已保存。","success"),a.currentProjectData}catch(n){return console.error("Save imported project edits error:",n),t&&p(n.message,"error"),null}}async function Ct(){var n,i,r,o,s;const e=((n=document.getElementById("import-content"))==null?void 0:n.value.trim())||"";if(!e){h("请先粘贴要导入的长文本内容。","error");return}const t=I(D());a.currentGenerationConfig=t,P(),h("正在解析长文本并创建项目...","pending");try{const m={title:((i=document.getElementById("import-title"))==null?void 0:i.value.trim())||"",content:e,gameType:((r=document.getElementById("import-game-type"))==null?void 0:r.value)||"custom",adaptationMode:((o=document.getElementById("adaptation-mode"))==null?void 0:o.value)||"balanced"},l=await f("/projects/import-text",v("POST",m));a.currentProjectId=((s=l.project)==null?void 0:s.id)||null,a.currentProjectData=l.project||null,a.currentGameType=m.gameType,j(l.project),h("导入成功，请先检查提取结果，再决定是否进入工作台。","success"),p("可以先轻量修改角色、章节和地点，再确认进入工作台。"),await J(),b("import-preview-screen")}catch(m){console.error("Imported project init error:",m),h(m.message,"error")}}async function Tt(){var t,n;if(!a.currentProjectId){h("当前没有可用的导入项目，请重新导入。","error"),b("import-screen");return}const e=I(D());a.currentGenerationConfig=e,P();try{const i=await Ke({successMessage:"修改已保存，正在进入生成工作台..."});if(!i)return;const r=await f(`/projects/${a.currentProjectId}/init-session`,v("POST",{config:e,gameType:i.gameType||a.currentGameType||"custom",userInput:((t=i.storyBible)==null?void 0:t.summary)||((n=i.source)==null?void 0:n.excerpt)||""}));await Ue(r),h("导入项目已进入生成工作台。","success")}catch(i){console.error("Start imported project session error:",i),h(i.message,"error"),p(i.message,"error"),b("import-screen")}}async function J(){const e=document.getElementById("import-project-list");if(e){e.innerHTML='<p class="empty-hint">正在加载项目列表...</p>';try{const t=await f("/projects"),n=Array.isArray(t.projects)?t.projects:[];if(!n.length){e.innerHTML='<p class="empty-hint">还没有导入项目。</p>';return}e.innerHTML=n.map(i=>`
            <article class="import-project-card" data-project-id="${B(i.id)}">
                <div class="import-project-main">
                    <strong>${d(i.title||"未命名项目")}</strong>
                    <p>${d(i.summary||"暂无摘要")}</p>
                    <div class="import-project-meta">
                        <span>${d(i.gameType||"custom")}</span>
                        <span>${d(i.adaptationMode||"balanced")}</span>
                        <span>${d(new Date(i.updatedAt||i.createdAt||Date.now()).toLocaleString())}</span>
                    </div>
                </div>
                <div class="import-project-actions">
                    <button type="button" class="preview-inline-btn" data-action="open">继续编辑</button>
                    <button type="button" class="preview-inline-btn danger" data-action="delete">删除</button>
                </div>
            </article>
        `).join(""),e.querySelectorAll('[data-action="open"]').forEach(i=>{i.addEventListener("click",async()=>{const r=i.closest("[data-project-id]"),o=r==null?void 0:r.getAttribute("data-project-id");o&&await jt(o)})}),e.querySelectorAll('[data-action="delete"]').forEach(i=>{i.addEventListener("click",async()=>{const r=i.closest("[data-project-id]"),o=r==null?void 0:r.getAttribute("data-project-id");o&&await Gt(o)})})}catch(t){e.innerHTML=`<p class="empty-hint">项目列表加载失败：${d(t.message)}</p>`}}}async function jt(e){var t,n;try{const i=await f(`/projects/${e}`);a.currentProjectId=((t=i.project)==null?void 0:t.id)||e,a.currentProjectData=i.project||null,a.currentGameType=((n=i.project)==null?void 0:n.gameType)||a.currentGameType,a.currentProjectData&&(document.getElementById("import-title").value=a.currentProjectData.title||"",a.currentGameType=a.currentProjectData.gameType||a.currentGameType),j(a.currentProjectData),h("已加载导入项目，你可以继续修改。","success"),p("项目已加载，可直接修改并继续进入工作台。"),b("import-preview-screen")}catch(i){h(`加载项目失败：${i.message}`,"error")}}async function Gt(e){if(confirm("确定删除这个导入项目吗？删除后不可恢复。"))try{await f(`/projects/${e}`,v("DELETE",{})),a.currentProjectId===e&&(a.currentProjectId=null,a.currentProjectData=null),await J(),h("项目已删除。","success")}catch(t){h(`删除项目失败：${t.message}`,"error")}}function At(){document.getElementById("generate-only-btn").addEventListener("click",async()=>{a.currentStepId&&await Mt(a.currentStepId)}),document.getElementById("regenerate-btn").addEventListener("click",async()=>{await je(prompt("请输入重生成补充要求（可留空）：")||"")}),document.getElementById("modify-btn").addEventListener("click",()=>{document.getElementById("custom-input-area").style.display="block",document.getElementById("custom-feedback").focus()}),document.getElementById("apply-custom-btn").addEventListener("click",async()=>{const e=document.getElementById("custom-feedback").value.trim();e&&(await je(e),document.getElementById("custom-feedback").value="",document.getElementById("custom-input-area").style.display="none")}),document.getElementById("confirm-btn").addEventListener("click",async()=>{await Rt()}),document.getElementById("skip-btn").addEventListener("click",async()=>{await Ut()}),document.getElementById("gen-finalize-btn").addEventListener("click",async()=>{await Jt()})}function O(){const e=document.getElementById("step-navigation");e.innerHTML="",a.allSteps.forEach(t=>{const n=L(t.id),i=A[t.id]||{icon:"?",name:t.name||t.id},r=document.createElement("button");r.type="button",r.className="step",t.id===a.currentStepId&&r.classList.add("active"),n.status==="confirmed"&&r.classList.add("completed"),n.status==="loading"&&r.classList.add("generating"),r.innerHTML=`<span class="step-icon">${i.icon}</span><span class="step-label">${t.name||i.name}</span>`,r.addEventListener("click",async()=>{await Dt(t.id)}),e.appendChild(r)})}async function Dt(e,t){a.currentStepId=e,O(),L(e);{T(e);return}}function T(e){const t=A[e]||{name:e,desc:""},n=L(e);document.getElementById("current-step-name").textContent=t.name,document.getElementById("current-step-desc").textContent=t.desc,document.getElementById("step-loading").style.display=n.status==="loading"?"flex":"none",document.getElementById("action-buttons").style.display="flex",Ye(e),Qe(),K(e)}async function Mt(e){var n;const t=L(e);t.status="loading",T(e),w("calling",`正在生成 ${((n=A[e])==null?void 0:n.name)||e}...`);try{const i=await f("/generate/step",v("POST",{sessionId:a.currentSessionId,stepId:e,options:{candidateCount:2}}));t.candidates=i.candidates||[],t.selectedIndex=-1,t.status="generated",t.history.push({id:Date.now(),timestamp:new Date,candidates:t.candidates.map(r=>structuredClone(r))}),w("success",`已生成 ${t.candidates.length} 个候选方案。`)}catch(i){console.error("Load step error:",i),t.status="error",w("error",i.message)}T(e)}function Ye(e){const t=document.getElementById("candidates-container"),n=L(e);if(t.innerHTML="",n.status!=="loading"){if(!n.candidates.length){t.innerHTML='<div class="candidate-card"><div class="candidate-empty">当前步骤还没有生成内容。点击下方“生成”开始。</div></div>';return}n.candidates.forEach((i,r)=>{const o=document.createElement("button");o.type="button",o.className="candidate-card",n.selectedIndex===r&&o.classList.add("selected"),o.innerHTML=`
            <div class="candidate-card-header">
                <strong>${d(Nt(e,i,r))}</strong>
                <span>方案 ${r+1}</span>
            </div>
            <div class="candidate-card-content">${Ot(e,i)}</div>
        `,o.addEventListener("click",()=>{n.selectedIndex=r,Ye(e),K(e)}),t.appendChild(o)})}}function K(e){const t=L(e),n=t.candidates.length>0;document.getElementById("confirm-btn").disabled=t.selectedIndex<0,document.getElementById("regenerate-btn").disabled=!n,document.getElementById("modify-btn").disabled=!n,document.getElementById("gen-finalize-btn").style.display=a.allSteps.every(i=>L(i.id).status==="confirmed")?"inline-block":"none"}function Nt(e,t,n){var i,r;return e==="worldview"?t.worldName||`世界观方案 ${n+1}`:e==="mainPlot"?t.title||`主线方案 ${n+1}`:e==="integration"?t.gameName||`整合方案 ${n+1}`:Array.isArray(t)?`${((i=A[e])==null?void 0:i.name)||e} · ${t.length} 项`:t.name||t.title||`${((r=A[e])==null?void 0:r.name)||e} 方案 ${n+1}`}function Ot(e,t){var n,i,r,o,s,m;if(t!=null&&t.error)return k("解析提示",t.error||"AI 响应暂时无法解析，请尝试重新生成。");if(typeof t=="string")return k("方案内容",t);switch(e){case"worldview":return[M("世界名称",t.worldName),M("时代背景",t.era),k("世界描述",t.description),Ce("世界规则",t.rules),Te("主要势力",t.factions,["name","description"]),Te("重要地点",t.locations,["name","description"])].join("");case"mainPlot":return[M("主线标题",t.title),M("核心主题",t.theme),k("剧情概览",t.summary),k("引发事件",t.incitingIncident),Ht("章节结构",(t.chapters||[]).map(l=>({title:l.name||l.title,body:`${l.goal||""}${l.description?`：${l.description}`:""}`}))),k("高潮",t.climax),k("结局说明",t.resolution)].join("");case"integration":return[M("游戏名称",t.gameName),k("玩法设计",t.gameplayDesign),M("战斗类型",(i=(n=t.gameSystems)==null?void 0:n.combatSystem)==null?void 0:i.type),Ce("战斗机制",(o=(r=t.gameSystems)==null?void 0:r.combatSystem)==null?void 0:o.mechanics),k("开场场景",(s=t.openingScene)==null?void 0:s.description),k("开场旁白",(m=t.openingScene)==null?void 0:m.narration),k("平衡性说明",t.balancingNotes)].join("");default:return _t(t,e)}}function _t(e,t){const n=Array.isArray(e)?e:e?[e]:[];return n.length?n.map((i,r)=>{var l;const o=i.name||i.title||`${((l=A[t])==null?void 0:l.name)||"条目"} ${r+1}`,s=i.description||i.summary||i.role||i.type||"",m=[i.role?`<span class="candidate-chip">${d(i.role)}</span>`:"",i.location?`<span class="candidate-chip">${d(i.location)}</span>`:"",i.type?`<span class="candidate-chip">${d(i.type)}</span>`:"",i.rarity?`<span class="candidate-chip">${d(i.rarity)}</span>`:""].join("");return`
            <div class="candidate-item">
                <div class="candidate-item-title">${d(o)}</div>
                ${m?`<div class="candidate-chip-row">${m}</div>`:""}
                ${s?`<div class="candidate-item-body">${d(s)}</div>`:""}
            </div>
        `}).join(""):'<div class="candidate-empty">当前方案没有可展示的条目。</div>'}function M(e,t){return t?`<div class="candidate-field"><span class="candidate-label">${d(e)}</span><span class="candidate-value">${d(t)}</span></div>`:""}function k(e,t){return t?`
        <div class="candidate-block">
            <div class="candidate-label">${d(e)}</div>
            <div class="candidate-paragraph">${d(t).replaceAll(`
`,"<br>")}</div>
        </div>
    `:""}function Ce(e,t){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${d(e)}</div>
            <div class="candidate-chip-row">${t.map(n=>`<span class="candidate-chip">${d(n)}</span>`).join("")}</div>
        </div>
    `}function Te(e,t,n){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${d(e)}</div>
            ${t.map(i=>`
                <div class="candidate-item">
                    <div class="candidate-item-title">${d(i[n[0]]||"未命名")}</div>
                    ${i[n[1]]?`<div class="candidate-item-body">${d(i[n[1]])}</div>`:""}
                </div>
            `).join("")}
        </div>
    `}function Ht(e,t){return!Array.isArray(t)||!t.length?"":`
        <div class="candidate-block">
            <div class="candidate-label">${d(e)}</div>
            ${t.map(n=>`
                <div class="candidate-item">
                    <div class="candidate-item-title">${d(n.title||"未命名")}</div>
                    ${n.body?`<div class="candidate-item-body">${d(n.body)}</div>`:""}
                </div>
            `).join("")}
        </div>
    `}async function je(e){var n;if(!a.currentStepId)return;const t=L(a.currentStepId);t.status="loading",T(a.currentStepId),w("calling",`正在重新生成 ${((n=A[a.currentStepId])==null?void 0:n.name)||a.currentStepId}...`);try{const i=await f("/generate/regenerate",v("POST",{sessionId:a.currentSessionId,stepId:a.currentStepId,feedback:e}));t.candidates=i.candidates||[],t.selectedIndex=-1,t.status="generated",t.history.push({id:Date.now(),timestamp:new Date,candidates:t.candidates.map(r=>structuredClone(r))}),w("success","已完成重新生成。")}catch(i){console.error("Regenerate error:",i),t.status="error",w("error",i.message)}T(a.currentStepId)}async function Rt(){const e=L(a.currentStepId),t=e.candidates[e.selectedIndex];if(t)try{const n=await f("/generate/confirm",v("POST",{sessionId:a.currentSessionId,stepId:a.currentStepId,candidate:t}));e.status="confirmed",await oe(),O(),n.nextStep?(a.currentStepId=n.nextStep,O(),T(n.nextStep),w("success","已确认当前步骤。下一步不会自动生成，请按需点击“生成”。")):(w("success","所有步骤都已确认，可以整合生成游戏了。"),K(a.currentStepId))}catch(n){console.error("Confirm step error:",n),alert(`确认失败：${n.message}`)}}async function Ut(){try{const e=await f("/generate/confirm",v("POST",{sessionId:a.currentSessionId,stepId:a.currentStepId,candidate:{skipped:!0}}));L(a.currentStepId).status="confirmed",await oe(),O(),e.nextStep?(a.currentStepId=e.nextStep,O(),T(e.nextStep)):K(a.currentStepId)}catch(e){console.error("Skip step error:",e),alert(`跳过失败：${e.message}`)}}async function oe(){var t,n,i,r,o,s,m;const e=document.getElementById("confirmed-elements");try{const c=(await f(`/generate/${a.currentSessionId}/status`)).memory||{},u=[];c.worldview&&u.push(x("世界观",c.worldview.worldName||"已确认")),(t=c.coreCharacters)!=null&&t.length&&u.push(x("核心角色",`${c.coreCharacters.length} 名`)),(n=c.secondaryCharacters)!=null&&n.length&&u.push(x("次要角色",`${c.secondaryCharacters.length} 名`)),(i=c.items)!=null&&i.length&&u.push(x("物品道具",`${c.items.length} 项`)),(r=c.puzzles)!=null&&r.length&&u.push(x("谜题挑战",`${c.puzzles.length} 项`)),c.mainPlot&&u.push(x("主线剧情",c.mainPlot.title||"已确认")),(o=c.sidePlots)!=null&&o.length&&u.push(x("支线剧情",`${c.sidePlots.length} 条`)),(s=c.fragments)!=null&&s.length&&u.push(x("碎片内容",`${c.fragments.length} 条`)),(m=c.integration)!=null&&m.gameName&&u.push(x("整合方案",c.integration.gameName)),e.innerHTML=u.join("")||'<p class="empty-hint">尚未确认任何内容。</p>'}catch(l){console.error("Render confirmed elements error:",l),e.innerHTML='<p class="empty-hint">获取已确认内容失败。</p>'}}function x(e,t){return`<div class="confirmed-item"><span class="confirmed-label">${e}</span><span class="confirmed-value">${t}</span></div>`}function Qe(){const e=document.getElementById("history-panel");if(!e)return;const t=[];for(const n of a.allSteps){const i=L(n.id);if(!i.history.length)continue;const r=i.history.slice().reverse().map(o=>`<div class="history-entry">${n.name||n.id} · ${o.timestamp.toLocaleTimeString()}</div>`).join("");t.push(`<div class="history-step">${r}</div>`)}e.innerHTML=t.join("")||'<p class="empty-hint">暂无生成记录。</p>'}function $(){if(a.currentGenerationConfig)return I(a.currentGenerationConfig);const e=I(D());return a.currentGenerationConfig=e,e}function N(e,t,n=""){const i=document.getElementById("game-log");if(!i||!t)return;const r=document.createElement("div");if(r.className=`log-entry ${e}`,n){const s=document.createElement("div");s.className="speaker",s.textContent=n,r.appendChild(s)}const o=document.createElement("div");o.className="content",o.textContent=t,r.appendChild(o),i.appendChild(r),i.scrollTop=i.scrollHeight}function Xe(e=[]){const t=document.getElementById("choices-container");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="";return}t.innerHTML=e.map((n,i)=>`
        <button type="button" class="choice-btn" data-choice-index="${i}">
            ${d(n.text||n.action||`选项 ${i+1}`)}
        </button>
    `).join(""),t.querySelectorAll("[data-choice-index]").forEach(n=>{n.addEventListener("click",async()=>{const i=Number(n.getAttribute("data-choice-index")),r=e[i];r&&await ne(r.action||r.text||"")})})}}function Ft(e={}){const t=document.getElementById("player-stats");if(!t)return;const n=Object.entries(e||{});if(!n.length){t.innerHTML='<p class="empty-hint">暂无属性信息</p>';return}t.innerHTML=n.map(([i,r])=>{if(r&&typeof r=="object"&&Number.isFinite(r.current)&&Number.isFinite(r.max)){const o=r.max>0?Math.max(0,Math.min(100,r.current/r.max*100)):0;return`
                <div class="stat-item">
                    <div style="width:100%">
                        <span class="stat-name">${d(i)}</span>
                        <span class="stat-value" style="float:right">${r.current}/${r.max}</span>
                        <div class="stat-bar"><div class="stat-bar-fill hp" style="width:${o}%"></div></div>
                    </div>
                </div>
            `}return`
            <div class="stat-item">
                <span class="stat-name">${d(i)}</span>
                <span class="stat-value">${d(String(r))}</span>
            </div>
        `}).join("")}function qt(e=[]){const t=document.getElementById("inventory-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="<li>暂无物品</li>";return}t.innerHTML=e.map(n=>`<li>${d(n.name||String(n))}</li>`).join("")}}function Wt(e=[]){const t=document.getElementById("quest-list");if(t){if(!Array.isArray(e)||!e.length){t.innerHTML="<li>暂无任务</li>";return}t.innerHTML=e.map(n=>`
        <li class="${n.completed?"completed":""}">
            ${d(n.name||n.description||"未命名任务")}
            ${n.progress?` · ${d(n.progress)}`:""}
        </li>
    `).join("")}}async function Ze(e=a.currentGameId){if(e)try{const t=await f(`/games/${e}/start`,v("POST",{}));a.currentGameId=e,a.gameState=t.gameState||null,a.sceneImages=[],a.selectedSceneImageIndex=0,a.activeSceneImage="",a.transitioningSceneImage="",a.currentVisualSignature="",document.getElementById("game-log").innerHTML="",Xe([]),Y([]),b("game-screen"),ce(a.gameState)}catch(t){alert(`启动游戏失败：${t.message}`)}}async function Jt(){var e;if(!a.currentSessionId){alert("当前没有生成会话。");return}w("calling","正在整合并生成最终游戏...");try{const t=await f(`/generate/${a.currentSessionId}/finalize`,v("POST",{config:$()}));a.currentGameId=t.gameId,a.currentGameData=t.gameData||null,a.currentGameType=((e=t.gameData)==null?void 0:e.type)||a.currentGameType,await Ze(a.currentGameId),w("success","游戏已生成并启动。")}catch(t){w("error",t.message),alert(`整合失败：${t.message}`)}}async function ne(e=""){var r,o;if(!a.currentGameId)return;const t=document.getElementById("player-input"),n=document.getElementById("send-btn"),i=e||(t==null?void 0:t.value.trim())||"";if(i){t&&(t.value=""),n&&(n.disabled=!0),N("player",i,"你");try{const s=$(),m=s.imageSource==="comfyui"?{...s,...ie()}:s,l=await f(`/games/${a.currentGameId}/action`,v("POST",{action:i,imageConfig:m}));Array.isArray((r=l.gameState)==null?void 0:r.lastDialogues)&&l.gameState.lastDialogues.forEach(c=>{c!=null&&c.content&&N("narrator",c.content,c.speaker||"角色")}),l.response&&N("narrator",l.response),l.gameOver&&l.gameOverMessage&&N("system",l.gameOverMessage),Xe(l.choices||[]),ce(l.gameState||a.gameState),l.sceneImage&&Y([l.sceneImage],((o=l.visualState)==null?void 0:o.prompt)||l.sceneDescription||l.response)}catch(s){N("system",`行动处理失败：${s.message}`)}finally{n&&(n.disabled=!1)}}}function zt(){var e,t,n,i,r,o,s,m,l;dt(),document.getElementById("send-btn").addEventListener("click",ne),document.getElementById("player-input").addEventListener("keydown",c=>{c.key==="Enter"&&ne()}),(e=document.getElementById("generate-scene-image-btn"))==null||e.addEventListener("click",async()=>{await Vt()}),(t=document.getElementById("scene-image-count"))==null||t.addEventListener("change",()=>{const c=document.getElementById("scene-image-count"),u=document.getElementById("comfyui-image-count"),g=String(Math.max(1,Math.min(8,Number(c.value)||1)));c.value=g,u&&(u.value=g),P()}),(n=document.getElementById("live-comfyui-workflow-mode"))==null||n.addEventListener("change",()=>{mt(),syncLiveImageConfigState()}),(i=document.getElementById("live-refresh-comfyui-btn"))==null||i.addEventListener("click",async()=>{await refreshLiveComfyUIOptions(!0)}),(r=document.getElementById("live-refresh-workflow-files-btn"))==null||r.addEventListener("click",async()=>{await refreshLiveComfyWorkflowFiles(!0)}),(o=document.getElementById("live-load-workflow-btn"))==null||o.addEventListener("click",async()=>{await loadSelectedLiveWorkflowFile(!0)}),(s=document.getElementById("live-test-comfyui-btn"))==null||s.addEventListener("click",async()=>{await testLiveComfyUIConnection()}),(m=document.getElementById("live-validate-workflow-btn"))==null||m.addEventListener("click",async()=>{await validateLiveComfyUIWorkflow()}),(l=document.getElementById("live-comfyui-workflow-file"))==null||l.addEventListener("change",()=>{syncLiveImageConfigState()}),document.querySelectorAll("#live-image-config input, #live-image-config select, #live-image-config textarea").forEach(c=>{c.addEventListener("change",()=>{syncLiveImageConfigState()})}),document.getElementById("game-menu-btn").addEventListener("click",()=>{document.getElementById("game-menu-modal").classList.add("active")}),document.getElementById("save-game").addEventListener("click",async()=>{var c,u;if(a.gameState&&a.currentGameId)try{const g=await f(`/games/${a.currentGameId}`),y=xe(a.currentGameId,g.state||a.gameState,{gameData:g.game||a.currentGameData,generationConfig:$(),type:a.currentGameType||((c=g.game)==null?void 0:c.type)||((u=a.gameState)==null?void 0:u.type)||"custom"});a.currentGameData=g.game||a.currentGameData,localStorage.setItem(`rpg_save_${a.currentGameId}`,JSON.stringify(y)),alert("游戏进度已保存。")}catch(g){console.error("Save game error:",g);const y=xe(a.currentGameId,a.gameState,{generationConfig:$()});localStorage.setItem(`rpg_save_${a.currentGameId}`,JSON.stringify(y)),alert("游戏进度已保存，但这次没有拿到完整后端快照。若服务重启后要续玩，建议重新保存一次。")}document.getElementById("game-menu-modal").classList.remove("active")}),document.getElementById("load-game").addEventListener("click",async()=>{if(!a.currentGameId){document.getElementById("game-menu-modal").classList.remove("active");return}re(`rpg_save_${a.currentGameId}`)?await Re(a.currentGameId):alert("没有找到存档。"),document.getElementById("game-menu-modal").classList.remove("active")}),document.getElementById("restart-game").addEventListener("click",async()=>{a.currentGameId&&await Ze(a.currentGameId),document.getElementById("game-menu-modal").classList.remove("active")}),q(),syncLiveImageConfigPanel()}async function Vt(){var s,m;if(!a.currentGameId){C("Start the game before generating images.","error");return}const e=document.getElementById("scene-image-prompt"),t=document.getElementById("scene-image-count"),n=document.getElementById("comfyui-image-count"),i=(e==null?void 0:e.value.trim())||((s=a.gameState)==null?void 0:s.sceneDescription)||((m=a.gameState)==null?void 0:m.initialLog)||"",r=Math.max(1,Math.min(8,Number(t==null?void 0:t.value)||1));if(!i){C("No scene prompt available yet.","error");return}t&&(t.value=String(r)),n&&(n.value=String(r));const o=$().imageSource==="comfyui"?{...$(),...ie(),comfyuiImageCount:r}:{...$(),comfyuiImageCount:r};a.currentGenerationConfig=o,localStorage.setItem(z,JSON.stringify(o)),Ge(!0),C("Generating images with ComfyUI...","pending");try{const l=await f(`/games/${a.currentGameId}/generate-image`,v("POST",{prompt:i,count:r,comfyuiImageCount:r,...o}));a.selectedSceneImageIndex=0,Y(l.images||[],l.prompt||i),C(`Generated ${l.count||(l.images||[]).length} image(s).`,"success")}catch(l){console.error("Generate scene image error:",l),C(l.message,"error")}finally{Ge(!1)}}function C(e,t=""){const n=document.getElementById("scene-image-status");n&&(n.textContent=e,n.className=`helper-text ${t}`.trim())}function Ge(e){const t=document.getElementById("generate-scene-image-btn");t&&(t.disabled=!!e,t.textContent=e?"生成中...":"生成场景图")}function q(){var s,m;const e=document.getElementById("scene-image-controls"),t=document.getElementById("scene-image-prompt"),n=document.getElementById("scene-image-count"),i=document.getElementById("live-image-config"),r=$(),o=r.enableImages&&r.imageSource!=="none";if(e&&(e.style.display=o?"block":"none"),!o){C("当前未启用图像生成。","pending");return}if(t){const l=a.lastSuggestedImagePrompt||((s=a.gameState)==null?void 0:s.sceneDescription)||((m=a.gameState)==null?void 0:m.initialLog)||"";(!t.value.trim()||t.value===a.lastSuggestedImagePrompt)&&(t.value=l),a.lastSuggestedImagePrompt=l}n&&(n.value=String(Math.max(1,Math.min(8,Number(r.comfyuiImageCount)||1)))),i&&(i.style.display=r.imageSource==="comfyui"?"block":"none"),r.imageGenerationMode==="auto"?C("当前为自动生图模式：视觉场景变化时会自动更新。","pending"):C("当前为手动生图模式：点击按钮后才会生成。","pending")}function Y(e=[],t=""){a.sceneImages=Array.isArray(e)?e:[],a.selectedSceneImageIndex=0,t&&(a.lastSuggestedImagePrompt=t);const n=document.getElementById("scene-image-gallery");n&&(a.sceneImages.length?(n.innerHTML=a.sceneImages.map((r,o)=>`
                    <button
                        type="button"
                        class="scene-thumb ${o===a.selectedSceneImageIndex?"active":""}"
                        data-scene-thumb="${o}"
                    >
                        <img src="${r}" alt="场景候选图 ${o+1}" />
                    </button>
                `).join(""),n.querySelectorAll("[data-scene-thumb]").forEach(r=>{r.addEventListener("click",()=>{const o=Number(r.getAttribute("data-scene-thumb"));Number.isNaN(o)||(a.selectedSceneImageIndex=o,Ae(a.sceneImages[o]||""),n.querySelectorAll("[data-scene-thumb]").forEach(s=>{s.classList.toggle("active",Number(s.getAttribute("data-scene-thumb"))===o)}))})})):n.innerHTML=""),Ae(a.sceneImages[a.selectedSceneImageIndex]||"");const i=document.getElementById("scene-image-prompt");i&&a.lastSuggestedImagePrompt&&!i.value.trim()&&(i.value=a.lastSuggestedImagePrompt)}function Ae(e=""){const t=document.getElementById("scene-image");if(!t)return;if(!e){a.activeSceneImage="",a.transitioningSceneImage="",t.innerHTML='<div class="placeholder">场景图像将在这里显示</div>';return}if(!a.activeSceneImage){a.activeSceneImage=e,a.transitioningSceneImage="",t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${e}" alt="场景图" />
            </div>
        `;return}if(a.activeSceneImage===e){t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${e}" alt="场景图" />
            </div>
        `;return}a.transitioningSceneImage=e,a.sceneImageTransitionToken+=1;const n=a.sceneImageTransitionToken,i=new Image;i.onload=()=>{if(a.sceneImageTransitionToken!==n)return;t.innerHTML=`
            <div class="scene-image-layer scene-image-layer-back is-active">
                <img src="${a.activeSceneImage}" alt="当前场景图" />
            </div>
            <div class="scene-image-layer scene-image-layer-front">
                <img src="${e}" alt="下一场景图" />
            </div>
        `;const r=t.querySelector(".scene-image-layer-front");requestAnimationFrame(()=>{r==null||r.classList.add("is-active")}),window.setTimeout(()=>{a.sceneImageTransitionToken===n&&(a.activeSceneImage=e,a.transitioningSceneImage="",t.innerHTML=`
                <div class="scene-image-layer is-active">
                    <img src="${e}" alt="场景图" />
                </div>
            `)},420)},i.onerror=()=>{a.sceneImageTransitionToken===n&&(a.activeSceneImage=e,a.transitioningSceneImage="",t.innerHTML=`
            <div class="scene-image-layer is-active">
                <img src="${e}" alt="场景图" />
            </div>
        `)},i.src=e}function Kt(e=a.gameState){return e?{chapterId:e.currentChapter??null,sceneNodeId:e.currentScene||null,plotBeatId:e.turn??null,playerState:e.player||{},worldState:e.worldState||{},relationshipState:e.characterStates||[],inventory:e.inventory||[],activeQuests:(e.quests||[]).filter(t=>t&&t.completed!==!0),visualState:e.visualState||null,history:(e.history||[]).slice(-20)}:null}function Yt(){!a.currentProjectId||!a.gameState||a.runtimeSnapshotSaving||(a.runtimeSnapshotTimer&&window.clearTimeout(a.runtimeSnapshotTimer),a.runtimeSnapshotTimer=window.setTimeout(async()=>{a.runtimeSnapshotSaving=!0;try{await f(`/projects/${a.currentProjectId}/runtime-snapshot`,v("POST",{runtimeSnapshot:Kt(a.gameState)}))}catch(e){console.warn("Runtime snapshot save failed:",e.message)}finally{a.runtimeSnapshotSaving=!1}},800))}function ce(e=a.gameState){var n,i;if(!e)return;a.gameState=e,a.currentVisualSignature=((n=e.visualState)==null?void 0:n.signature)||a.currentVisualSignature,document.getElementById("game-title").textContent=e.name||"AI 生成 RPG",document.getElementById("scene-description").textContent=e.sceneDescription||"";const t=document.getElementById("game-log");e.initialLog&&!t.children.length&&N("narrator",e.initialLog),Ft(((i=e.player)==null?void 0:i.stats)||{}),qt(e.inventory||[]),Wt(e.quests||[]),q(),Yt()}async function W(e){const t=document.getElementById(`test-${e}-result`),n=document.getElementById(`test-${e}-btn`);n.disabled=!0,t.textContent="测试中...",t.className="test-result";try{const i=await f("/test-connection",v("POST",ae(e)));t.textContent=i.success?"连接成功":i.error||"连接失败",t.className=`test-result ${i.success?"success":"error"}`}catch(i){t.textContent=i.message,t.className="test-result error"}finally{n.disabled=!1}}function B(e){return d(e).replaceAll('"',"&quot;").replaceAll("'","&#39;")}function d(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
