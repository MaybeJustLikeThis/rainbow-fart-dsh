import { addBreakdown, advanceCombo, classifyActivity, createActivityTracker, initialBreakdown, initialCombo, latestDurableSeq, newDurableEntries, observeActivity, phraseFor, ratingForTurn, reconcileBreakdown, summarizeBreakdown } from './core.js'
import { DEFAULT_SETTINGS, normalizeSettings, shouldTriggerEgg } from './customization.js'

const STYLE = `
  .rf-dsh{position:fixed;inset:0;z-index:70;pointer-events:none;font:600 13px/1.35 system-ui,-apple-system,sans-serif;color:#fff}
  .rf-dsh *{box-sizing:border-box}
  .rf-dsh-toast{position:absolute;z-index:2;top:72px;left:50%;transform:translate(-50%,-12px) scale(.82);opacity:0;min-width:250px;width:min(400px,90vw);padding:15px 18px;border-radius:20px;text-align:center;background:linear-gradient(120deg,#7c3aed,#ec4899 48%,#f59e0b);box-shadow:0 14px 45px #7c3aed55,0 0 0 1px #ffffff77 inset;animation:rf-pop .28s cubic-bezier(.17,.89,.32,1.4) forwards;overflow:hidden}
  .rf-dsh-toast:after{content:'';position:absolute;inset:-50%;background:linear-gradient(110deg,transparent 35%,#ffffff55 48%,transparent 61%);transform:translateX(-80%);animation:rf-shine .65s ease-out .12s both}
  .rf-dsh-toast strong{display:block;font-size:23px;letter-spacing:.05em;text-shadow:0 2px 8px #4c1d9580}
  .rf-dsh-toast>span{display:block;margin-top:3px;font-weight:550}
  .rf-dsh-toast-gain{display:flex;justify-content:center;align-items:baseline;flex-wrap:wrap;gap:5px;margin-top:8px;font-size:12px}.rf-dsh-toast-gain b{color:#fff4a3;font-size:16px}.rf-dsh-toast-gain small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;opacity:.9}
  .rf-dsh-toast-summary{display:grid;gap:4px;margin-top:9px;padding:7px 10px;border:1px solid #ffffff55;border-radius:11px;background:#14213b70;text-align:left}.rf-dsh-toast-row{display:flex;justify-content:space-between;gap:12px;font-size:12px}.rf-dsh-toast-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rf-dsh-toast-row b{flex:none;color:#fff4a3;font-variant-numeric:tabular-nums}
  .rf-dsh-toast[data-tier="super"],.rf-dsh-toast[data-tier="legendary"]{box-shadow:0 18px 60px #f59e0b77,0 0 0 2px #fff8 inset}
  .rf-dsh-confetti{position:absolute;top:90px;left:50%;font-size:20px;animation:rf-burst .8s ease-out forwards;transform-origin:center}
  .rf-dsh-panel{position:absolute;right:18px;bottom:18px;display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;max-width:calc(100vw - 36px);gap:7px;padding:7px 9px 7px 12px;border-radius:18px;background:#241743ed;border:1px solid #b493ff66;box-shadow:0 8px 24px #10062b66;pointer-events:auto;backdrop-filter:blur(14px)}
  .rf-dsh-controls{display:contents}
  .rf-dsh-brand{display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap}.rf-dsh-combo{font-size:11px;color:#e9d5ff;white-space:nowrap}.rf-dsh-combo b{font-weight:700}.rf-dsh-panel button,.rf-dsh-rules summary{border:0;border-radius:999px;min-width:30px;height:30px;padding:0 8px;color:#fff;background:#ffffff1f;cursor:pointer;font:inherit;display:grid;place-items:center}.rf-dsh-panel button[aria-pressed="true"]{background:#a855f7}.rf-dsh-panel button:disabled{opacity:.38;cursor:not-allowed}.rf-dsh-panel button:focus-visible,.rf-dsh-rules summary:focus-visible{outline:2px solid #facc15;outline-offset:2px}
  .rf-dsh-rules summary{list-style:none}.rf-dsh-rules summary::-webkit-details-marker{display:none}.rf-dsh-rules[open] summary{background:#a855f7}.rf-dsh-rules-content{position:absolute;right:0;bottom:calc(100% + 10px);width:min(340px,calc(100vw - 36px));max-height:70vh;overflow:auto;padding:16px;border-radius:16px;background:#241743f5;border:1px solid #b493ff99;box-shadow:0 16px 38px #10062baa;font-size:12px;line-height:1.5}.rf-dsh-rules-content strong{display:block;margin-bottom:7px;color:#facc15;font-size:14px}.rf-dsh-rules-content ul{margin:0;padding-left:18px}.rf-dsh-rules-content li{margin:3px 0}.rf-dsh-rules-content p{margin:9px 0 0;color:#e9d5ff}
  .rf-dsh-breakdown{margin-top:14px;padding:11px 0;border-top:1px solid #ffffff35;border-bottom:1px solid #ffffff35}.rf-dsh-breakdown-head,.rf-dsh-breakdown-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.rf-dsh-breakdown-head{margin-bottom:8px;color:#facc15;font-size:13px}.rf-dsh-breakdown-head strong{margin:0}.rf-dsh-breakdown-row{margin:5px 0;color:#e9d5ff}.rf-dsh-breakdown-row span{min-width:0;overflow-wrap:anywhere}.rf-dsh-breakdown-row b{flex:none;color:#fff;font-variant-numeric:tabular-nums}.rf-dsh-breakdown-title{margin:10px 0 5px;color:#fff4a3;font-size:11px}.rf-dsh-breakdown-note{font-size:11px}
  @keyframes rf-pop{to{opacity:1;transform:translate(-50%,0) scale(1)}}@keyframes rf-shine{to{transform:translateX(80%)}}@keyframes rf-burst{to{opacity:0;transform:translate(var(--rf-x),var(--rf-y)) rotate(var(--rf-r))}}
  @media(prefers-reduced-motion:reduce){.rf-dsh-toast,.rf-dsh-toast:after,.rf-dsh-confetti{animation:none}.rf-dsh-toast{opacity:1;transform:translate(-50%,0)}.rf-dsh-confetti{display:none}}
  .rf-dsh{--rf-panel:#112846;--rf-mid:#06b6d4;--rf-end:#8b5cf6;--rf-accent:#38bdf8;--rf-opacity:94%}
  .rf-dsh[data-theme="aurora"]{--rf-panel:#241743;--rf-mid:#ec4899;--rf-end:#f59e0b}
  .rf-dsh[data-theme="candy"]{--rf-panel:#421d42;--rf-mid:#fb7185;--rf-end:#facc15}
  .rf-dsh[data-theme="minimal"]{--rf-panel:#20242d;--rf-mid:#64748b;--rf-end:#cbd5e1}
  .rf-dsh-toast{background:linear-gradient(120deg,var(--rf-accent),var(--rf-mid) 55%,var(--rf-end))}
  .rf-dsh-panel,.rf-dsh-rules-content,.rf-dsh-settings{background:color-mix(in srgb,var(--rf-panel) var(--rf-opacity),transparent);border-color:color-mix(in srgb,var(--rf-accent) 52%,transparent)}
  .rf-dsh .rf-dsh-rules-content,.rf-dsh .rf-dsh-settings{background:color-mix(in srgb,var(--rf-panel) 92%,#0b1733)}
  .rf-dsh[data-motion="off"] .rf-dsh-toast,.rf-dsh[data-motion="off"] .rf-dsh-toast:after,.rf-dsh[data-motion="off"] .rf-dsh-confetti{animation:none}
  .rf-dsh[data-motion="off"] .rf-dsh-toast{opacity:1;transform:none}
  .rf-dsh[data-motion="off"] .rf-dsh-confetti{display:none}
  .rf-dsh[data-motion="soft"] .rf-dsh-toast:after,.rf-dsh[data-motion="soft"] .rf-dsh-confetti{display:none}
  .rf-dsh[data-toast-animation="fade"] .rf-dsh-toast{animation:rf-fade .35s ease-out forwards}
  .rf-dsh[data-toast-animation="slide"] .rf-dsh-toast{animation:rf-slide .38s ease-out forwards}
  .rf-dsh[data-toast-position="center"] .rf-dsh-toast{top:50%;translate:-50% -50%;left:50%}
  .rf-dsh[data-toast-position="bottom"] .rf-dsh-toast{top:auto;bottom:90px}
  @keyframes rf-fade{from{opacity:0;transform:none}to{opacity:1;transform:none}}
  @keyframes rf-slide{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:none}}
  .rf-dsh-settings{position:absolute;right:18px;bottom:78px;z-index:3;width:min(400px,calc(100vw - 36px));max-height:72vh;overflow:auto;padding:16px;border:1px solid;border-radius:20px;box-shadow:0 18px 50px #09162f88;pointer-events:auto;font-size:12px}
  .rf-dsh[data-docked="true"] .rf-dsh-panel{left:var(--rf-dock-left);right:auto;top:50%;bottom:auto;transform:translateY(-50%);width:var(--rf-dock-width);max-width:none;max-height:calc(100vh - 32px);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;flex-wrap:nowrap;gap:7px;padding:8px 6px;border-radius:18px;box-shadow:0 10px 25px #0b17332e,0 0 0 1px #ffffff12 inset;transition:opacity .2s ease}
  .rf-dsh[data-docked="true"] .rf-dsh-brand{justify-content:center;width:34px;height:24px;font-size:18px}
  .rf-dsh[data-docked="true"] .rf-dsh-brand-name,.rf-dsh[data-docked="true"] .rf-dsh-combo-label{display:none}
  .rf-dsh[data-docked="true"] .rf-dsh-combo{width:34px;padding:3px 0;border-radius:8px;background:#ffffff18;color:#e0f2fe;text-align:center;font-size:10px}
  .rf-dsh[data-docked="true"] .rf-dsh-controls{display:grid;grid-template-columns:34px;gap:5px;padding-top:7px;border-top:1px solid #ffffff35}
  .rf-dsh[data-docked="true"] .rf-dsh-controls button,.rf-dsh[data-docked="true"] .rf-dsh-rules summary{width:34px;min-width:0;height:34px;padding:0;border-radius:10px}
  .rf-dsh[data-docked="true"] .rf-dsh-rules-content{left:calc(100% + 10px);right:auto;top:50%;bottom:auto;transform:translateY(-50%);width:min(340px,calc(100vw - var(--rf-dock-left) - var(--rf-dock-width) - 28px))}
  .rf-dsh[data-docked="true"] .rf-dsh-settings{left:calc(var(--rf-dock-left) + var(--rf-dock-width) + 10px);right:auto;top:50%;bottom:auto;transform:translateY(-50%);width:min(400px,calc(100vw - var(--rf-dock-left) - var(--rf-dock-width) - 28px));max-height:min(760px,calc(100vh - 32px))}
  .rf-dsh[data-docked="true"][data-egg-active="true"] .rf-dsh-panel{opacity:0;pointer-events:none}
  @media(prefers-reduced-motion:reduce){.rf-dsh[data-docked="true"] .rf-dsh-panel{transition:none}}
  .rf-dsh-settings-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.rf-dsh-settings-head strong{font-size:16px}.rf-dsh-settings h3{margin:14px 0 7px;color:#bdefff;font-size:12px}.rf-dsh-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.rf-dsh-field{display:flex;flex-direction:column;gap:4px;min-width:0}.rf-dsh-field span{color:#dbeafe}.rf-dsh-field input,.rf-dsh-field select{width:100%;min-width:0;height:31px;padding:4px 7px;border:1px solid #ffffff55;border-radius:8px;background:#0b1733;color:#fff;font:inherit}.rf-dsh-field input[type="color"]{padding:2px}.rf-dsh-field input[type="range"]{padding:0}.rf-dsh-field input[type="checkbox"]{width:auto;height:auto;accent-color:var(--rf-accent)}.rf-dsh-check{display:flex;align-items:center;gap:7px;margin:6px 0}.rf-dsh-settings button{border:1px solid #ffffff55;border-radius:9px;padding:6px 10px;color:#fff;background:#ffffff1e;cursor:pointer;font:inherit}.rf-dsh-settings-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.rf-dsh-settings-note{margin:6px 0;color:#cbd5e1;font-size:11px}.rf-dsh-settings-error{margin:8px 0;color:#fecaca}.rf-dsh-file{display:block;margin-top:7px}.rf-dsh-file input{margin-top:4px;max-width:100%;font:inherit}
  .rf-dsh-settings button:disabled{opacity:.45;cursor:not-allowed}.rf-dsh-credential{margin:8px 0 10px;padding:11px;border:1px solid #ffffff35;border-radius:12px;background:#09162f88}.rf-dsh-credential-state{margin:0 0 9px;color:#facc15;font-weight:700}.rf-dsh-credential-state[data-ready="true"]{color:#86efac}.rf-dsh-credential .rf-dsh-settings-actions{margin-top:8px}
  .rf-dsh-egg-zone{position:absolute;top:24%;height:59%;overflow:visible;pointer-events:none}.rf-dsh-egg-zone[data-side="right"]{transform:scaleX(-1)}.rf-dsh-firework{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--rf-accent);box-shadow:0 0 12px var(--rf-accent),0 0 25px var(--rf-accent)}.rf-dsh-firework:before{content:'';position:absolute;left:-47px;top:-47px;width:100px;height:100px;border:2px solid var(--rf-accent);border-radius:50%;opacity:0;animation:rf-ring 1.3s ease-out var(--rf-burst-delay) forwards}.rf-dsh-spark{position:absolute;left:0;top:0;width:8px;height:8px;border-radius:50%;background:var(--rf-spark);box-shadow:0 0 10px var(--rf-spark),0 0 20px var(--rf-spark);opacity:0;animation:rf-spark 1.5s ease-out var(--rf-delay) forwards}.rf-dsh-egg-mascot{position:absolute;left:50%;bottom:5%;max-width:90%;height:var(--rf-mascot-size);max-height:55%;object-fit:contain;transform:translateX(-50%);filter:drop-shadow(0 8px 18px #0ea5e966);animation:rf-mascot .65s ease-out both}.rf-dsh-egg-message{position:absolute;left:50%;bottom:57%;translate:-50% 0;width:max-content;max-width:95%;padding:8px 12px;border:1px solid var(--rf-accent);border-radius:16px;background:#0d2449e8;color:#fff;text-align:center;box-shadow:0 7px 20px #0b173366;animation:rf-mascot .55s ease-out both}
  @keyframes rf-spark{0%{opacity:0;transform:translate(0,0) scale(.3)}12%{opacity:1}55%{opacity:1}100%{opacity:0;transform:translate(var(--rf-x),var(--rf-y)) scale(.2)}}
  @keyframes rf-ring{0%{opacity:0;transform:scale(.1)}18%{opacity:.9}65%{opacity:.5}100%{opacity:0;transform:scale(1.6)}}
  @keyframes rf-mascot{from{opacity:0;transform:translate(-50%,25px) scale(.85)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
  .rf-dsh[data-motion="soft"] .rf-dsh-spark{animation-duration:1.8s}.rf-dsh[data-motion="off"] .rf-dsh-spark,.rf-dsh[data-motion="off"] .rf-dsh-firework:before{display:none}.rf-dsh[data-motion="off"] .rf-dsh-egg-mascot,.rf-dsh[data-motion="off"] .rf-dsh-egg-message{animation:none}
  .rf-dsh[data-motion="off"] .rf-dsh-toast,.rf-dsh[data-motion="off"] .rf-dsh-toast:after{animation:none;opacity:1;transform:none}
  @media(prefers-reduced-motion:reduce){.rf-dsh-spark,.rf-dsh-firework:before{display:none}.rf-dsh-egg-mascot,.rf-dsh-egg-message,.rf-dsh-toast,.rf-dsh-toast:after{animation:none!important}.rf-dsh-toast{opacity:1;transform:none}}
  @media(max-width:1100px){.rf-dsh-egg-zone{display:none}}
`

window.__ModuleLoader__.load({
  id: 'rainbow-fart-dsh',
  factory(require) {
    const React = require('react')
    const { createElement: h, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = React
    const path = 'api/rainbow-fart.judge'
    const noop = () => {}
    const empty = { revision: -1, change: { kind: 'replace', entries: [] } }
    const labels = {
      zh: { name: '彩虹屁', points: '积分', combo: '连击', rules: '计分与评价规则', ruleTool: '成功工具调用：基础 +10 分', ruleTurn: '完成轮次：基础 +20 分；本轮有失败则不加这项', ruleMultiplier: '按本次计分后的连击数乘倍率：1–2 连击 ×1，3–4 ×2，5–7 ×3，8+ ×4', ruleReset: '90 秒内连续成功才延续连击；失败清空连击，不扣已得积分', ruleOther: '摘要、开始事件和预览不计分。积分按会话保存在此浏览器，刷新后保留。', ruleRating: '每轮结束都会评价本轮积分：0 蓄势待发，1–29 小试牛刀，30–79 渐入佳境，80–159 鬼斧神工，160–279 巅峰之作，280+ 惊世骇俗。失败则显示重整旗鼓。', ruleJev: '开启 Jev 后：none 最高小试牛刀，steady 最高渐入佳境，breakthrough 且概率 ≥0.6 升一档。评价是趣味反馈，不代表代码质量。', latestReview: '最近评价', turnReview: '本轮评价', ready: '蓄势待发', firstStep: '小试牛刀', warming: '渐入佳境', craft: '鬼斧神工', masterpiece: '巅峰之作', astonishing: '惊世骇俗', recover: '重整旗鼓', sound: '音效', jev: 'Jev 判断', jevMissing: '配置 Jev API 密钥', soundOff: '开启音效', soundOn: '关闭音效', preview: '预览连击', previewMessage: '预览效果：节奏起来了！', previewReview: '预览评价' },
      en: { name: 'Rainbow Fart', points: 'Points', combo: 'Combo', rules: 'Scoring and rating rules', ruleTool: 'Successful tool call: 10 base points', ruleTurn: 'Completed turn: 20 base points, unless the turn had a failure', ruleMultiplier: 'Multiplier uses the new streak: 1–2 ×1, 3–4 ×2, 5–7 ×3, 8+ ×4', ruleReset: 'Successes within 90 seconds keep the streak. Failure resets it without deducting points.', ruleOther: 'Summaries, starts and previews score zero. Points are saved per session in this browser and survive refresh.', ruleRating: 'Each turn gets a rating from its points: 0 Ready, 1–29 First step, 30–79 Finding your stride, 80–159 Masterful, 160–279 Peak form, 280+ Astonishing. Failed turns say Regroup.', ruleJev: 'With Jev on: none caps at First step; steady caps at Finding your stride; breakthrough with probability ≥0.6 raises one tier. Ratings are playful feedback, not a code quality verdict.', latestReview: 'Latest rating', turnReview: 'Turn rating', ready: 'Ready to go', firstStep: 'First step', warming: 'Finding your stride', craft: 'Masterful', masterpiece: 'Peak form', astonishing: 'Astonishing', recover: 'Regroup', sound: 'Sound', jev: 'Jev judgment', jevMissing: 'Configure Jev API key', soundOff: 'Turn sound on', soundOn: 'Turn sound off', preview: 'Preview combo', previewMessage: 'Preview: feel the rhythm!', previewReview: 'Preview rating' },
    }
    const scoreText = {
      zh: { total: '当前总分', previous: '此前累计（无逐项记录）', complete: '完成轮次', unknown: '未识别工具', other: '其他工具', groups: '活动分类', tools: '原始工具明细', note: '各项为实际得分，已计入连击倍率；旧积分无法准确反推工具来源。', empty: '新得分将在这里按活动与工具汇总；预览不计分。' },
      en: { total: 'Current total', previous: 'Earlier points (no itemized history)', complete: 'Completed turns', unknown: 'Unknown tool', other: 'Other tools', groups: 'Activity categories', tools: 'Exact tool names', note: 'Amounts include combo multipliers. Earlier points cannot be reliably attributed to tools.', empty: 'New points will be grouped by activity and tool. Previews do not score.' },
    }
    const activityText = {
      zh: { web: 'Web 检索', skill: 'Skill', files: '文件操作', terminal: '终端命令', browser: '浏览器', complete: '完成轮次', other: '其他工具', unknown: '未识别工具', gain: '本次得分', turnGain: '本轮积分', preview: '示例明细 · 不计分', turnSummary: '本轮明细' },
      en: { web: 'Web search', skill: 'Skill', files: 'Files', terminal: 'Terminal', browser: 'Browser', complete: 'Turn completed', other: 'Other tools', unknown: 'Unknown tool', gain: 'This gain', turnGain: 'Turn points', preview: 'Example · no points earned', turnSummary: 'This turn' },
    }
    const previewRows = [
      { category: 'web', count: 1, points: 20 },
      { category: 'skill', count: 1, points: 10 },
      { category: 'files', count: 1, points: 10 },
    ]
    const settingsText = {
      zh: {
        settings: '自定义设置', close: '关闭', appearance: '外观与动效', theme: '主题', ocean: '深海', aurora: '极光', candy: '糖果', minimal: '极简', panelPlacement: '面板布局', leftDock: '左侧竖栏', bottomBar: '右下角横条', accent: '点缀色', opacity: '面板不透明度', motion: '动效强度', off: '关闭', soft: '轻柔', full: '完整', toastAnimation: '弹窗动效', pop: '弹出', slide: '滑入', fade: '淡入', toastPosition: '提示位置', top: '顶部', center: '中央', bottom: '底部',
        sound: '音效', soundEnabled: '开启音效', soundPack: '音色', chime: '清脆音阶', arcade: '街机', oceanSound: '海浪和弦', custom: '自定义音频', volume: '音量', uploadSound: '上传音效（最大 500 KB）', removeSound: '移除自定义音效',
        judgment: '语义判断', jevEnabled: '启用 Jev 辅助判断', jevUnavailable: '未配置 Jev 时，本地计分和评价照常可用。', jevKey: 'TypeSafe API 密钥', jevKeyPlaceholder: '粘贴 API 密钥', jevChecking: '正在检查 Jev 配置…', jevConfigured: '检测到 API 密钥（未验证）', jevNotConfigured: '尚未配置 API 密钥', jevReadOnly: '凭据由 DSH 启动环境提供，请在启动环境中修改。', jevKeyNote: '在此保存的密钥写入本机 DSH 凭据库，不存入浏览器设置；保存后可手动开启 Jev。', jevSave: '保存密钥', jevRemove: '删除密钥', jevSaved: '密钥已保存，可开启 Jev。', jevRemoved: '密钥已删除。', jevStillConfigured: '已删除本机密钥，另有外部凭据仍在生效。', jevSaveError: '保存失败，请检查 DSH 凭据服务。', jevRemoveError: '删除失败，请检查 DSH 凭据服务。', jevStatusError: '无法读取 Jev 配置状态。',
        egg: '双侧彩蛋', eggEnabled: '启用彩蛋', eggStyle: '效果样式', fireworks: '双侧烟花', whale: '鲸鱼娘鼓励', both: '鲸鱼娘 + 烟花', eggMinCombo: '本轮最高连击门槛', eggMinTurnPoints: '本轮最低积分', eggCooldownMin: '冷却时间（分钟）', eggRequiresJev: '同时要求 Jev 突破判断（≥0.75）', eggDurationSec: '展示秒数', eggBursts: '每侧烟花数量', eggMessage: '鼓励语', mascotSize: '角色大小', uploadMascot: '替换鲸鱼娘图片（PNG / JPEG / WebP / GIF，最大 1 MB）', removeMascot: '恢复默认角色', previewEgg: '预览彩蛋', reset: '恢复默认设置', storageError: '设置已临时生效，但浏览器存储失败；刷新后可能丢失。', fileError: '文件类型或大小不符合要求。', eggNote: '默认需本轮曾达 8 连击、本轮 200 分且 10 分钟内未触发；预览不计分，也不消耗冷却。',
      },
      en: {
        settings: 'Customize', close: 'Close', appearance: 'Appearance and motion', theme: 'Theme', ocean: 'Ocean', aurora: 'Aurora', candy: 'Candy', minimal: 'Minimal', panelPlacement: 'Panel layout', leftDock: 'Left vertical dock', bottomBar: 'Bottom right bar', accent: 'Accent color', opacity: 'Panel opacity', motion: 'Motion', off: 'Off', soft: 'Soft', full: 'Full', toastAnimation: 'Toast animation', pop: 'Pop', slide: 'Slide', fade: 'Fade', toastPosition: 'Toast position', top: 'Top', center: 'Center', bottom: 'Bottom',
        sound: 'Sound', soundEnabled: 'Enable sound', soundPack: 'Sound pack', chime: 'Chime', arcade: 'Arcade', oceanSound: 'Ocean chords', custom: 'Custom audio', volume: 'Volume', uploadSound: 'Upload sound (max 500 KB)', removeSound: 'Remove custom sound',
        judgment: 'Judgment', jevEnabled: 'Use Jev judgment', jevUnavailable: 'Local scoring and ratings work without Jev.', jevKey: 'TypeSafe API key', jevKeyPlaceholder: 'Paste API key', jevChecking: 'Checking Jev configuration…', jevConfigured: 'API key present (not verified)', jevNotConfigured: 'No API key configured', jevReadOnly: 'This credential comes from the DSH launch environment; change it there.', jevKeyNote: 'Keys saved here go to the local DSH credential store, not browser settings. Enable Jev separately after saving.', jevSave: 'Save key', jevRemove: 'Remove key', jevSaved: 'Key saved. You can enable Jev now.', jevRemoved: 'Key removed.', jevStillConfigured: 'Local key removed; another external credential is still active.', jevSaveError: 'Could not save the key. Check the DSH credential service.', jevRemoveError: 'Could not remove the key. Check the DSH credential service.', jevStatusError: 'Could not read Jev configuration status.',
        egg: 'Side surprise', eggEnabled: 'Enable surprise', eggStyle: 'Effect style', fireworks: 'Side fireworks', whale: 'Whale girl encouragement', both: 'Whale girl + fireworks', eggMinCombo: 'Peak combo threshold', eggMinTurnPoints: 'Minimum turn points', eggCooldownMin: 'Cooldown (minutes)', eggRequiresJev: 'Also require Jev breakthrough (≥0.75)', eggDurationSec: 'Duration (seconds)', eggBursts: 'Fireworks per side', eggMessage: 'Encouragement text', mascotSize: 'Mascot size', uploadMascot: 'Replace mascot image (PNG / JPEG / WebP / GIF, max 1 MB)', removeMascot: 'Restore default mascot', previewEgg: 'Preview surprise', reset: 'Restore defaults', storageError: 'Settings work for now, but browser storage failed; refresh may lose them.', fileError: 'Unsupported file type or size.', eggNote: 'Default: peak combo of 8 this turn, 200 turn points, and a 10-minute cooldown. Preview does not score or use cooldown.',
      },
    }

    function preference(name) {
      try { return localStorage.getItem(`rainbow-fart-dsh.${name}`) === 'true' } catch { return false }
    }
    function save(name, value) {
      try { localStorage.setItem(`rainbow-fart-dsh.${name}`, String(value)) } catch { /* private mode */ }
    }
    function readPoints(sessionId) {
      try {
        const value = Number(localStorage.getItem(`rainbow-fart-dsh.points.${sessionId}`))
        return Number.isSafeInteger(value) && value >= 0 ? value : 0
      } catch { return 0 }
    }
    function readBreakdown(sessionId, points) {
      try {
        const saved = localStorage.getItem(`rainbow-fart-dsh.breakdown.${sessionId}`)
        return saved ? reconcileBreakdown(JSON.parse(saved), points) : initialBreakdown(points)
      } catch { return initialBreakdown(points) }
    }
    function saveBreakdown(sessionId, value) {
      try { localStorage.setItem(`rainbow-fart-dsh.breakdown.${sessionId}`, JSON.stringify(value)) } catch { /* private mode */ }
    }
    const ratingKeys = new Set(['ready', 'firstStep', 'warming', 'craft', 'masterpiece', 'astonishing', 'recover'])
    function readReview(sessionId) {
      try {
        const value = localStorage.getItem(`rainbow-fart-dsh.review.${sessionId}`)
        return ratingKeys.has(value) ? value : null
      } catch { return null }
    }
    function readSettings() {
      try {
        const saved = localStorage.getItem('rainbow-fart-dsh.settings.v1')
        if (saved) return normalizeSettings(JSON.parse(saved))
      } catch { /* use defaults */ }
      return normalizeSettings({ soundEnabled: preference('sound'), jevEnabled: preference('jev') })
    }
    function readLastEggAt() {
      try {
        const value = Number(localStorage.getItem('rainbow-fart-dsh.egg.lastAt'))
        return Number.isSafeInteger(value) && value >= 0 ? value : 0
      } catch { return 0 }
    }
    function play(tier, audioRef, settings) {
      if (!settings.soundEnabled || settings.volume <= 0) return
      if (settings.soundPack === 'custom' && settings.customSound) {
        try {
          const sound = new Audio(settings.customSound)
          sound.volume = settings.volume
          void sound.play().catch(noop)
        } catch { /* optional sound */ }
        return
      }
      const AudioContextType = window.AudioContext || window.webkitAudioContext
      if (!AudioContextType) return
      try {
        const audio = audioRef.current || new AudioContextType()
        audioRef.current = audio
        if (audio.state === 'suspended') void audio.resume()
        const notes = settings.soundPack === 'arcade' ? [330, 494, 659, 988]
          : settings.soundPack === 'ocean' ? [262, 330, 392, 523]
            : tier === 'legendary' ? [523, 659, 784, 1047] : tier === 'super' ? [440, 554, 659] : tier === 'combo' ? [392, 494, 587] : [440, 554]
        notes.forEach((frequency, index) => {
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = settings.soundPack === 'arcade' ? 'square' : 'sine'
          oscillator.frequency.value = frequency
          gain.gain.setValueAtTime(0.001, audio.currentTime + index * .08)
          gain.gain.exponentialRampToValueAtTime(Math.max(.001, .12 * settings.volume), audio.currentTime + index * .08 + .015)
          gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + index * .08 + .16)
          oscillator.connect(gain).connect(audio.destination)
          oscillator.start(audio.currentTime + index * .08)
          oscillator.stop(audio.currentTime + index * .08 + .17)
        })
      } catch { /* audio is optional */ }
    }

    function RollingNumber({ value, enabled = true, fromZero = false }) {
      const canAnimate = enabled && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      const [displayed, setDisplayed] = useState(() => fromZero && canAnimate ? 0 : value)
      const current = useRef(displayed)
      useEffect(() => {
        if (!canAnimate) { current.current = value; setDisplayed(value); return }
        const startValue = current.current
        if (startValue === value) return
        const start = performance.now()
        let frame = 0
        const tick = now => {
          const progress = Math.min(1, (now - start) / 420)
          const eased = 1 - (1 - progress) ** 3
          current.current = Math.round(startValue + (value - startValue) * eased)
          setDisplayed(current.current)
          if (progress < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
      }, [value, canAnimate])
      return displayed
    }

    function RainbowSession({ sessionId, source, t }) {
      const [settings, setSettings] = useState(readSettings)
      const [settingsOpen, setSettingsOpen] = useState(false)
      const [rulesOpen, setRulesOpen] = useState(false)
      const [settingsError, setSettingsError] = useState('')
      const [available, setAvailable] = useState(false)
      const [credentialLoaded, setCredentialLoaded] = useState(false)
      const [credentialWritable, setCredentialWritable] = useState(false)
      const [credentialValue, setCredentialValue] = useState('')
      const [credentialBusy, setCredentialBusy] = useState(false)
      const [credentialFeedback, setCredentialFeedback] = useState(null)
      const [toast, setToast] = useState(null)
      const [egg, setEgg] = useState(null)
      const [zones, setZones] = useState({ left: null, right: null, dock: null, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight })
      const [count, setCount] = useState(0)
      const [review, setReview] = useState(() => readReview(sessionId))
      const combo = useRef(null)
      const activityTracker = useRef(null)
      const breakdown = useRef(null)
      const turnBreakdown = useRef(initialBreakdown())
      if (combo.current === null) {
        const entries = source?.getSnapshot().entries || []
        const baseline = initialCombo(readPoints(sessionId))
        // Opening an existing Session must not celebrate old history.
        baseline.seenSeq = latestDurableSeq(entries)
        combo.current = baseline
        activityTracker.current = createActivityTracker(entries)
        breakdown.current = readBreakdown(sessionId, baseline.points)
      }
      const [points, setPoints] = useState(() => combo.current.points)
      const [scoreBreakdown, setScoreBreakdown] = useState(() => breakdown.current)
      const activitySummary = useMemo(() => summarizeBreakdown(scoreBreakdown), [scoreBreakdown])
      const summary = useRef('')
      const reviewRequest = useRef(0)
      const audio = useRef(null)
      const credentialInput = useRef(null)
      const timer = useRef(null)
      const eggTimer = useRef(null)
      const eggShownSeq = useRef(-1)
      const lastEggAt = useRef(readLastEggAt())
      const overlay = useRef(null)
      const live = useRef(true)
      const lastRevision = useRef(source?.getSnapshot().revision ?? -1)
      const subscribe = useMemo(() => source ? callback => source.subscribe(callback) : noop, [source])
      const getSnapshot = useMemo(() => source ? () => source.getSnapshot() : () => empty, [source])
      const snapshot = useSyncExternalStore(subscribe, getSnapshot)
      const language = () => document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'
      const S = key => settingsText[language()][key]
      const B = key => scoreText[language()][key]
      const A = key => activityText[language()][key]
      const sound = settings.soundEnabled
      const jev = settings.jevEnabled
      const validCredential = credentialValue.trim().length > 0 && credentialValue.trim().length <= 2048 && !/\s/u.test(credentialValue.trim())

      const applyCredentialStatus = data => {
        setAvailable(data.jevAvailable === true)
        setCredentialWritable(data.writable === true)
        setCredentialLoaded(true)
      }

      const updateSettings = patch => {
        const next = normalizeSettings({ ...settings, ...patch })
        setSettings(next)
        try {
          localStorage.setItem('rainbow-fart-dsh.settings.v1', JSON.stringify(next))
          setSettingsError('')
        } catch { setSettingsError(S('storageError')) }
      }

      const closeSettings = () => {
        setCredentialValue('')
        setCredentialFeedback(null)
        setSettingsOpen(false)
      }

      const changeCredential = async method => {
        if (credentialBusy) return
        setCredentialBusy(true)
        setCredentialFeedback(null)
        try {
          const response = await fetch(path, { method,
            ...(method === 'PUT' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: credentialValue.trim() }) } : {}) })
          if (!response.ok) throw new Error('credential operation failed')
          const data = await response.json()
          applyCredentialStatus(data)
          setCredentialValue('')
          if (!data.jevAvailable && jev) updateSettings({ jevEnabled: false, eggRequiresJev: false })
          setCredentialFeedback({ error: false, message: S(method === 'PUT' ? 'jevSaved'
            : data.jevAvailable ? 'jevStillConfigured' : 'jevRemoved') })
        } catch {
          setCredentialFeedback({ error: true, message: S(method === 'PUT' ? 'jevSaveError' : 'jevRemoveError') })
        } finally { setCredentialBusy(false) }
      }

      const upload = (event, key, types, maxBytes) => {
        const file = event.target.files?.[0]
        if (!file) return
        event.target.value = ''
        if (!types.includes(file.type) || file.size > maxBytes) {
          setSettingsError(S('fileError'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => updateSettings(key === 'customSound'
          ? { customSound: reader.result, soundPack: 'custom' }
          : { [key]: reader.result })
        reader.onerror = () => setSettingsError(S('fileError'))
        reader.readAsDataURL(file)
      }

      useEffect(() => {
        live.current = true
        const controller = new AbortController()
        fetch(path, { signal: controller.signal }).then(response => response.json()).then(data => {
          if (live.current) applyCredentialStatus(data)
        }).catch(() => {
          if (live.current && !controller.signal.aborted) {
            setCredentialLoaded(true)
            setCredentialFeedback({ error: true, message: S('jevStatusError') })
          }
        })
        return () => {
          live.current = false
          controller.abort()
          clearTimeout(timer.current)
          clearTimeout(eggTimer.current)
          if (audio.current) { void audio.current.close(); audio.current = null }
        }
      }, [])

      useLayoutEffect(() => {
        const element = overlay.current
        if (!element) return
        let narrow = null
        let wide = null
        for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
          const rect = node.getBoundingClientRect()
          if (rect.width < 300 || rect.width >= window.innerWidth) continue
          if (!narrow) narrow = node
          else if (rect.width > narrow.getBoundingClientRect().width + 120) { wide = node; break }
        }
        const commit = next => setZones(previous => {
          const measured = { ...next, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }
          const same = previous.viewportWidth === measured.viewportWidth && previous.viewportHeight === measured.viewportHeight && ['left', 'right', 'dock'].every(side => {
            const before = previous[side]
            const after = measured[side]
            return (!before && !after) || (before && after && before.left === after.left && before.width === after.width)
          })
          return same ? previous : measured
        })
        const measure = () => {
          if (!narrow || !wide) return commit({ left: null, right: null, dock: null })
          const inner = narrow.getBoundingClientRect()
          const outer = wide.getBoundingClientRect()
          const leftGap = inner.left - outer.left - 60
          const rightGap = outer.right - inner.right
          const leftWidth = Math.min(280, leftGap - 20)
          const rightWidth = Math.min(280, rightGap - 20)
          const dockLeft = Math.round(outer.left + 8)
          const dockWidth = Math.floor(Math.min(48, inner.left - dockLeft - 20))
          commit({
            left: leftWidth >= 100 ? { left: Math.round(inner.left - leftWidth - 10), width: Math.round(leftWidth) } : null,
            right: rightWidth >= 100 ? { left: Math.round(inner.right + 10), width: Math.round(rightWidth) } : null,
            dock: dockWidth >= 48 ? { left: dockLeft, width: dockWidth } : null,
          })
        }
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
        if (observer) for (const node of [narrow, wide]) if (node) observer.observe(node)
        window.addEventListener('resize', measure)
        measure()
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
      }, [])

      const show = ({ message, tier, value, earned = 0, isReview = false, reviewSeq = null,
        activity = null, name = '', summary = [], preview = false }) => {
        setToast({ id: Date.now() + Math.random(), message, tier, value, earned, isReview, reviewSeq, activity, name, summary, preview })
        play(tier, audio, settings)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => { if (live.current) setToast(null) }, 2700)
      }

      const showEgg = (preview = false) => {
        const now = Date.now()
        if (!preview) {
          lastEggAt.current = now
          save('egg.lastAt', now)
        }
        setEgg({ id: now + Math.random(), ...settings })
        if (sound) play('legendary', audio, settings)
        clearTimeout(eggTimer.current)
        eggTimer.current = setTimeout(() => { if (live.current) setEgg(null) }, settings.eggDurationSec * 1000)
      }

      useEffect(() => {
        if (snapshot.revision === lastRevision.current) return
        const previousRevision = lastRevision.current
        lastRevision.current = snapshot.revision
        if (snapshot.change.kind === 'replace') {
          combo.current.seenSeq = latestDurableSeq(snapshot.entries, combo.current.seenSeq)
          activityTracker.current = createActivityTracker(snapshot.entries)
          return
        }
        const entries = newDurableEntries(snapshot, previousRevision, combo.current.seenSeq)
        for (const entry of entries) {
          if (entry.type !== 'event') continue
          const observed = observeActivity(activityTracker.current, entry.event)
          if (!observed) continue
          const { candidate, name: toolName } = observed
          if (candidate.kind === 'start') {
            summary.current = ''
            reviewRequest.current += 1
            turnBreakdown.current = initialBreakdown()
          }
          if (candidate.kind === 'summary') summary.current = candidate.text
          const result = advanceCombo(combo.current, candidate, Date.now())
          combo.current = result.state
          setCount(result.state.count)
          if (result.earned > 0) {
            setPoints(result.state.points)
            save(`points.${sessionId}`, result.state.points)
            breakdown.current = addBreakdown(breakdown.current, candidate.kind, toolName, result.earned)
            setScoreBreakdown(breakdown.current)
            saveBreakdown(sessionId, breakdown.current)
            turnBreakdown.current = addBreakdown(turnBreakdown.current, candidate.kind, toolName, result.earned)
          }
          if (entry.event.type === 'turn/end') {
            const requestId = ++reviewRequest.current
            const turnSummary = summary.current
            const turnSummaryRows = summarizeBreakdown(turnBreakdown.current).slice(0, 3)
            summary.current = ''
            let shownRating = null
            const finishReview = (answer, announce = false) => {
              if (!live.current || requestId !== reviewRequest.current) return
              if (eggShownSeq.current !== candidate.seq && shouldTriggerEgg({
                completed: candidate.kind === 'complete',
                failed: result.state.hadFailure,
                combo: result.state.turnMaxCombo,
                turnPoints: result.state.turnPoints,
                now: Date.now(),
                lastEggAt: lastEggAt.current,
                jevChoice: answer?.choice,
                probability: answer?.probability,
              }, settings)) {
                eggShownSeq.current = candidate.seq
                showEgg()
              }
              const rating = ratingForTurn({
                points: result.state.turnPoints,
                completed: candidate.kind === 'complete',
                failed: result.state.hadFailure,
                jevChoice: answer?.choice,
                probability: answer?.probability,
              })
              if (rating.key === shownRating) return
              shownRating = rating.key
              setReview(rating.key)
              save(`review.${sessionId}`, rating.key)
              if (announce) show({ message: t(rating.key), tier: rating.tier, value: result.state.count,
                earned: result.state.turnPoints, isReview: true, reviewSeq: candidate.seq, summary: turnSummaryRows })
              else setToast(current => current?.reviewSeq === candidate.seq
                ? { ...current, message: t(rating.key), tier: rating.tier } : current)
            }
            finishReview(null, true)
            if (candidate.kind === 'complete' && jev && available && turnSummary) {
              fetch(path, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ kind: 'complete', text: turnSummary }),
              }).then(response => response.ok ? response.json() : null)
                .then(answer => finishReview(answer)).catch(noop)
            }
            continue
          }
          if (!result.show) continue
          show({ message: phraseFor(candidate.kind, result.tier, result.state.count, language()),
            tier: result.tier, value: result.state.count, earned: result.earned,
            activity: classifyActivity(candidate.kind, toolName), name: toolName,
            summary: summarizeBreakdown(turnBreakdown.current).slice(0, 3) })
        }
      }, [snapshot, jev, available, sound])

      const select = (label, key, options) => h('label', { className: 'rf-dsh-field', key },
        h('span', null, S(label)),
        h('select', { value: settings[key], onChange: event => updateSettings({ [key]: event.target.value }) },
          options.map(([value, text]) => h('option', { value, key: value }, S(text)))))
      const number = (label, key, min, max, step = 1) => h('label', { className: 'rf-dsh-field', key },
        h('span', null, S(label)),
        h('input', { type: 'number', min, max, step, value: settings[key], onChange: event => updateSettings({ [key]: Number(event.target.value) }) }))
      const check = (label, key, disabled = false) => h('label', { className: 'rf-dsh-check', key },
        h('input', { type: 'checkbox', checked: settings[key], disabled,
          onChange: event => updateSettings({ [key]: event.target.checked }) }), S(label))
      const renderZone = (side, box) => {
        if (!egg || !box) return null
        const fireworks = egg.eggStyle !== 'whale' && egg.motion !== 'off'
          ? Array.from({ length: egg.eggBursts }, (_, burst) => h('div', {
            key: burst, className: 'rf-dsh-firework', 'aria-hidden': 'true',
            style: { left: `${25 + (burst % 2) * 50}%`, top: `${18 + burst * 22}%`, '--rf-burst-delay': `${(burst * .38).toFixed(2)}s` },
          }, Array.from({ length: egg.motion === 'soft' ? 8 : 12 }, (_, ray) => {
            const angle = ray * 2 * Math.PI / (egg.motion === 'soft' ? 8 : 12)
            const distance = 70 + burst * 13
            return h('span', { key: ray, className: 'rf-dsh-spark', style: {
              '--rf-x': `${Math.round(Math.cos(angle) * distance)}px`,
              '--rf-y': `${Math.round(Math.sin(angle) * distance)}px`,
              '--rf-delay': `${(burst * .38).toFixed(2)}s`,
              '--rf-spark': [egg.accent, '#facc15', '#f9a8d4', '#a5f3fc'][ray % 4],
            } })
          }))) : null
        const mascot = side === 'left' && egg.eggStyle !== 'fireworks'
          ? h('div', null,
            h('span', { className: 'rf-dsh-egg-message' }, egg.eggMessage),
            h('img', { className: 'rf-dsh-egg-mascot', src: egg.customMascot || 'api/rainbow-fart.mascot?asset=sailor-20260924', alt: language() === 'zh' ? '鲸鱼娘鼓励' : 'Whale girl cheering' })) : null
        return h('div', { key: side, className: 'rf-dsh-egg-zone', 'data-side': side,
          style: { left: `${box.left}px`, width: `${box.width}px`, '--rf-mascot-size': `${egg.mascotSize}px` } }, fireworks, mascot)
      }
      const dockZone = settings.panelPlacement === 'left' && zones.viewportWidth > 1100 && zones.viewportHeight >= 560 ? zones.dock : null
      const dockWidth = dockZone?.width || 0
      const dockLeft = dockZone?.left || 0
      const settingsPanel = settingsOpen && h('div', { className: 'rf-dsh-settings', role: 'dialog', 'aria-label': S('settings') },
        h('div', { className: 'rf-dsh-settings-head' }, h('strong', null, `🌈 ${S('settings')}`),
          h('button', { type: 'button', 'aria-label': S('close'), onClick: closeSettings }, '×')),
        h('h3', null, S('appearance')),
        h('div', { className: 'rf-dsh-settings-grid' },
          select('theme', 'theme', [['ocean', 'ocean'], ['aurora', 'aurora'], ['candy', 'candy'], ['minimal', 'minimal']]),
          select('panelPlacement', 'panelPlacement', [['left', 'leftDock'], ['bottom', 'bottomBar']]),
          h('label', { className: 'rf-dsh-field' }, h('span', null, S('accent')),
            h('input', { type: 'color', value: settings.accent, onChange: event => updateSettings({ accent: event.target.value }) })),
          h('label', { className: 'rf-dsh-field' }, h('span', null, S('opacity')),
            h('input', { type: 'range', min: .65, max: 1, step: .05, value: settings.panelOpacity, onChange: event => updateSettings({ panelOpacity: Number(event.target.value) }) })),
          select('motion', 'motion', [['off', 'off'], ['soft', 'soft'], ['full', 'full']]),
          select('toastAnimation', 'toastAnimation', [['pop', 'pop'], ['slide', 'slide'], ['fade', 'fade']]),
          select('toastPosition', 'toastPosition', [['top', 'top'], ['center', 'center'], ['bottom', 'bottom']])),
        h('h3', null, S('sound')),
        check('soundEnabled', 'soundEnabled'),
        h('div', { className: 'rf-dsh-settings-grid' },
          select('soundPack', 'soundPack', [['chime', 'chime'], ['arcade', 'arcade'], ['ocean', 'oceanSound'], ['custom', 'custom']]),
          h('label', { className: 'rf-dsh-field' }, h('span', null, S('volume')),
            h('input', { type: 'range', min: 0, max: 1, step: .05, value: settings.volume, onChange: event => updateSettings({ volume: Number(event.target.value) }) }))),
        h('label', { className: 'rf-dsh-file' }, S('uploadSound'),
          h('input', { type: 'file', accept: '.mp3,.wav,.ogg,.webm,audio/mpeg,audio/wav,audio/ogg,audio/webm',
            onChange: event => upload(event, 'customSound', ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'], 500_000) })),
        settings.customSound && h('button', { type: 'button', onClick: () => updateSettings({ customSound: '', soundPack: 'chime' }) }, S('removeSound')),
        h('h3', null, S('judgment')),
        h('div', { className: 'rf-dsh-credential' },
          h('p', { className: 'rf-dsh-credential-state', 'data-ready': available, 'aria-live': 'polite' },
            S(!credentialLoaded ? 'jevChecking' : available ? 'jevConfigured' : 'jevNotConfigured')),
          credentialWritable && h('label', { className: 'rf-dsh-field' }, h('span', null, S('jevKey')),
            h('input', { ref: credentialInput, type: 'password', autoComplete: 'new-password',
              placeholder: S('jevKeyPlaceholder'), maxLength: 2048, value: credentialValue,
              disabled: credentialBusy, onChange: event => setCredentialValue(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter' && validCredential && !credentialBusy) {
                  event.preventDefault()
                  void changeCredential('PUT')
                }
              } })),
          credentialWritable && h('div', { className: 'rf-dsh-settings-actions' },
            h('button', { type: 'button', disabled: !validCredential || credentialBusy,
              onClick: () => void changeCredential('PUT') }, S('jevSave')),
            available && h('button', { type: 'button', disabled: credentialBusy,
              onClick: () => void changeCredential('DELETE') }, S('jevRemove'))),
          credentialLoaded && !credentialWritable && h('p', { className: 'rf-dsh-settings-note' }, S('jevReadOnly')),
          h('p', { className: 'rf-dsh-settings-note' }, S('jevKeyNote')),
          credentialFeedback && h('p', { className: credentialFeedback.error ? 'rf-dsh-settings-error' : 'rf-dsh-settings-note',
            role: credentialFeedback.error ? 'alert' : 'status' }, credentialFeedback.message)),
        check('jevEnabled', 'jevEnabled', !available),
        !available && h('p', { className: 'rf-dsh-settings-note' }, S('jevUnavailable')),
        h('h3', null, S('egg')),
        check('eggEnabled', 'eggEnabled'),
        h('p', { className: 'rf-dsh-settings-note' }, S('eggNote')),
        h('div', { className: 'rf-dsh-settings-grid' },
          select('eggStyle', 'eggStyle', [['fireworks', 'fireworks'], ['whale', 'whale'], ['both', 'both']]),
          number('eggMinCombo', 'eggMinCombo', 3, 30),
          number('eggMinTurnPoints', 'eggMinTurnPoints', 40, 600, 10),
          number('eggCooldownMin', 'eggCooldownMin', 1, 120),
          number('eggDurationSec', 'eggDurationSec', 3, 10),
          number('eggBursts', 'eggBursts', 1, 5),
          number('mascotSize', 'mascotSize', 120, 260, 10)),
        check('eggRequiresJev', 'eggRequiresJev', !available || !settings.jevEnabled),
        h('label', { className: 'rf-dsh-field' }, h('span', null, S('eggMessage')),
          h('input', { type: 'text', maxLength: 60, value: settings.eggMessage,
            onChange: event => updateSettings({ eggMessage: event.target.value }) })),
        h('label', { className: 'rf-dsh-file' }, S('uploadMascot'),
          h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif',
            onChange: event => upload(event, 'customMascot', ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], 1_000_000) })),
        settings.customMascot && h('button', { type: 'button', onClick: () => updateSettings({ customMascot: '' }) }, S('removeMascot')),
        settingsError && h('p', { className: 'rf-dsh-settings-error', role: 'alert' }, settingsError),
        h('div', { className: 'rf-dsh-settings-actions' },
          h('button', { type: 'button', onClick: () => { setSettingsOpen(false); showEgg(true) } }, S('previewEgg')),
          h('button', { type: 'button', onClick: () => updateSettings(DEFAULT_SETTINGS) }, S('reset'))))

      return h('div', { ref: overlay, className: 'rf-dsh', 'data-rainbow-fart-dsh': '',
        'data-theme': settings.theme, 'data-motion': settings.motion,
        'data-docked': dockZone ? 'true' : 'false', 'data-egg-active': egg ? 'true' : 'false', 'data-rf-points': points,
        'data-toast-animation': settings.toastAnimation, 'data-toast-position': settings.toastPosition,
        style: { '--rf-accent': settings.accent, '--rf-opacity': `${Math.round(settings.panelOpacity * 100)}%`,
          '--rf-dock-left': `${dockLeft}px`, '--rf-dock-width': `${dockWidth}px` } },
        egg && h('div', { className: 'rf-dsh-egg-layer', 'data-rf-egg': egg.eggStyle, role: 'status', 'aria-live': 'polite' },
          renderZone('left', zones.left), renderZone('right', zones.right)),
        toast && h('div', { key: toast.id, className: 'rf-dsh-toast', 'data-tier': toast.tier, role: 'status', 'aria-live': 'polite' },
          h('strong', null, toast.isReview ? toast.message : toast.value >= 3 ? `${toast.value}× COMBO` : '✨ NICE!'),
          h('span', null, toast.isReview ? t('turnReview') : toast.message),
          (toast.earned > 0 || toast.preview) && h('div', { className: 'rf-dsh-toast-gain' },
            h('span', null, toast.preview ? A('preview') : toast.isReview ? A('turnGain') : A('gain')),
            !toast.preview && h('b', null, `+${toast.earned}`),
            !toast.preview && toast.activity && h('small', { title: toast.name },
              `· ${A(toast.activity)}${toast.name ? ` (${toast.name})` : ''}`)),
          toast.summary.length > 0 && h('div', { className: 'rf-dsh-toast-summary', 'aria-label': A('turnSummary') },
            toast.summary.map(row => h('div', { className: 'rf-dsh-toast-row', key: row.category },
              h('span', null, `${A(row.category)} ×${row.count}`), h('b', null, `+${row.points}`))))),
        toast && toast.value >= 3 && Array.from({ length: 8 }, (_, i) => h('span', {
          key: `${toast.id}-${i}`, className: 'rf-dsh-confetti', 'aria-hidden': 'true',
          style: { '--rf-x': `${(i - 3.5) * 36}px`, '--rf-y': `${-25 - (i % 3) * 36}px`, '--rf-r': `${i * 57}deg`, color: ['#facc15', '#4ade80', '#38bdf8', '#fb7185'][i % 4] },
        }, ['✦', '◆', '●'][i % 3])),
        settingsPanel,
        h('div', { className: 'rf-dsh-panel' },
          h('span', { className: 'rf-dsh-brand', title: t('name') }, h('span', { 'aria-hidden': 'true' }, '🌈'), h('span', { className: 'rf-dsh-brand-name' }, t('name'))),
          h('span', { className: 'rf-dsh-combo', 'aria-label': `${count} ${t('combo')}`, title: `${count} ${t('combo')}` }, h('b', null, `${count}×`), h('span', { className: 'rf-dsh-combo-label' }, ` ${t('combo')}`)),
          h('div', { className: 'rf-dsh-controls' },
          h('details', { className: 'rf-dsh-rules', onToggle: event => setRulesOpen(event.currentTarget.open) },
            h('summary', { 'aria-label': t('rules'), title: t('rules') }, '?'),
            h('div', { className: 'rf-dsh-rules-content' },
              h('strong', null, t('rules')),
              rulesOpen && h('section', { className: 'rf-dsh-breakdown', 'data-rf-breakdown': '' },
                h('div', { className: 'rf-dsh-breakdown-head' }, h('strong', null, B('total')), h('strong', null, h(RollingNumber, { value: points, enabled: settings.motion !== 'off', fromZero: true }))),
                review && h('div', { className: 'rf-dsh-breakdown-row' }, h('span', null, t('latestReview')), h('b', null, t(review))),
                scoreBreakdown.previousPoints > 0 && h('div', { className: 'rf-dsh-breakdown-row' }, h('span', null, B('previous')), h('b', null, h(RollingNumber, { value: scoreBreakdown.previousPoints, enabled: settings.motion !== 'off', fromZero: true }))),
                activitySummary.length > 0 && h('div', { className: 'rf-dsh-breakdown-title' }, B('groups')),
                activitySummary.map(row => h('div', { className: 'rf-dsh-breakdown-row', key: row.category },
                  h('span', null, `${A(row.category)} ×${row.count}`),
                  h('b', null, `+`, h(RollingNumber, { value: row.points, enabled: settings.motion !== 'off', fromZero: true })))),
                scoreBreakdown.rows.length > 0 && h('div', { className: 'rf-dsh-breakdown-title' }, B('tools')),
                scoreBreakdown.rows.map(row => h('div', { className: 'rf-dsh-breakdown-row', key: `${row.kind}:${row.name}` },
                  h('span', null, `${row.kind === 'complete' ? B('complete') : row.name === 'unknown' || row.name === 'other' ? B(row.name) : row.name} ×${row.count}`),
                  h('b', null, `+`, h(RollingNumber, { value: row.points, enabled: settings.motion !== 'off', fromZero: true })))),
                scoreBreakdown.rows.length === 0 && h('p', { className: 'rf-dsh-breakdown-note' }, B('empty')),
                h('p', { className: 'rf-dsh-breakdown-note' }, B('note'))),
              h('ul', null, ['ruleTool', 'ruleTurn', 'ruleMultiplier', 'ruleReset'].map(key => h('li', { key }, t(key)))),
              h('p', null, t('ruleOther')),
              h('p', null, t('ruleRating')),
              h('p', null, t('ruleJev')))),
          h('button', {
            type: 'button', 'aria-label': t('preview'), title: t('preview'),
            onClick: () => show({ message: t('previewMessage'), tier: 'combo', value: 3,
              preview: true, summary: previewRows }),
          }, '✦'),
          h('button', {
            type: 'button', 'aria-label': t('previewReview'), title: t('previewReview'),
            onClick: () => show({ message: t('craft'), tier: 'super', value: 0,
              isReview: true, preview: true, summary: previewRows }),
          }, '★'),
          h('button', {
            type: 'button', 'aria-label': sound ? t('soundOn') : t('soundOff'),
            title: t('sound'), 'aria-pressed': sound,
            onClick: () => {
              updateSettings({ soundEnabled: !sound })
              if (!sound) play('spark', audio, { ...settings, soundEnabled: true })
            },
          }, sound ? '♫' : '♪̸'),
          h('button', {
            type: 'button', 'aria-label': available ? t('jev') : t('jevMissing'),
            title: available ? t('jev') : t('jevMissing'), 'aria-pressed': jev && available,
            onClick: () => {
              if (!available) {
                setSettingsOpen(true)
                requestAnimationFrame(() => credentialInput.current?.focus())
                return
              }
              updateSettings({ jevEnabled: !jev, eggRequiresJev: !jev && settings.eggRequiresJev })
            },
          }, 'J'),
          h('button', { type: 'button', 'aria-label': S('settings'), title: S('settings'),
            'aria-expanded': settingsOpen, onClick: () => settingsOpen ? closeSettings() : setSettingsOpen(true) }, '⚙'))))
    }

    function Rainbow(props) {
      return h(RainbowSession, { ...props, key: props.sessionId })
    }

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        const style = document.createElement('style')
        style.dataset.plugin = 'rainbow-fart-dsh'
        style.textContent = STYLE
        document.head.append(style)
        ctx.effect(() => () => style.remove())
        ctx.effect(() => ctx.locale.register('rainbowFart', { zh: labels.zh, en: labels.en }))
        ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
          name: 'conversation.input.overlay', id: 'rainbow-fart-dsh', order: 999,
          locale: 'rainbowFart',
          inject: sessionId => ({ sessionId, source: ctx.sessions.binding(sessionId)?.eventSource }),
        }, Rainbow))
      },
    }
  },
})
