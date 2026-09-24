# Rainbow Fart-DSH 🌈

给 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) Web 会话添加轻量的连击、积分、轮次评价和可选彩蛋。插件只呈现趣味反馈，不改变 Agent 的工具执行或会话日志；积分和评价不代表代码质量、测试或部署结果。

> 当前版本：0.5.4。针对 DSH 0.1.7-rc.1 验证。DSH 仍处于开发预览，后续版本可能调整插件接口。

## 功能

- 成功工具调用和无失败的完成轮次计分；失败打断连击。? 面板展示规则、总分、最近评价和按工具汇总的实际得分。
- 宽屏左侧窄竖条；空间不足时自动回退右下角横条。支持深海、极光、糖果、极简主题，以及颜色、透明度和动画设置。
- 默认静音；可选三种合成音或上传音频。支持预览、双侧烟花与鲸鱼娘彩蛋，也可更换角色图。
- 可选的 Jev 轮次判断。没有 TypeSafe 凭据时，本地计分、评价和预览仍可使用。

## 安装

需要 Node.js 和 DSH。DSH 安装及 Web 使用方式见[官方说明](https://github.com/deepseek-ai/deepseek-harness#run)。本项目直接从 GitHub 安装，未发布到 npm 插件市场。

~~~sh
npm install -g @deepseek-ai/dsh@0.1.7-rc.1
dsh plugin --profile web add github:MaybeJustLikeThis/rainbow-fart-dsh#v0.5.4
dsh --profile web --dump-config
dsh web
~~~

--dump-config 输出中应出现 rainbow-fart-dsh。启动 DSH Web 后，在会话界面寻找彩虹图标与连击栏。已打开的页面需要刷新；新安装的插件不会给安装前的历史事件补分。

本地源码安装：

~~~sh
git clone https://github.com/MaybeJustLikeThis/rainbow-fart-dsh.git
cd rainbow-fart-dsh
npm run check
dsh plugin --profile web add .
~~~

在 Windows PowerShell 中，cd 到仓库目录后执行同样的命令即可。也可以将 . 换成 npm pack 生成的 .tgz 路径。使用 dsh plugin --profile web remove rainbow-fart-dsh 卸载。DSH 的[官方 bundle 安装文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md#install-into-a-profile)说明了 profile 与加载顺序。

## 计分与评价

| 事件 | 基础分 |
| --- | ---: |
| 成功工具调用 | +10 |
| 无失败的完成轮次 | +20 |

每次得分按**计分后的**连击数乘倍率：1–2 次 ×1，3–4 次 ×2，5–7 次 ×3，8 次及以上 ×4。90 秒内的连续成功延续连击；超时重新从 1 开始。失败清空连击但不扣除已得积分；本轮发生过失败时，完成轮次不加分。开始事件、助手摘要和预览均不计分。

轮次评价只看**本轮积分**：0「蓄势待发」、1–29「小试牛刀」、30–79「渐入佳境」、80–159「鬼斧神工」、160–279「巅峰之作」、280 及以上「惊世骇俗」。失败轮次显示「重整旗鼓」。Jev 开启后可以调整评价档位，但不改变积分。

积分、明细、最近评价和设置保存在当前浏览器的 localStorage；积分和明细按会话隔离。刷新后连击从 0 开始，积分保留。升级前没有明细的积分列为「此前累计」，不会反推工具来源。清除站点数据会删除这些记录。自定义素材也存于浏览器，可能受存储配额限制。

## 自定义与彩蛋

点击 ⚙ 调整主题、动效、音效、面板布局、彩蛋条件及素材。自定义音频支持 MP3、WAV、OGG、WebM，文件不超过 500 KB；上传后会自动选择「自定义音频」，但不会自行开启音效。角色图支持 PNG、JPEG、WebP、GIF，文件不超过 1 MB。音频播放仍受浏览器自动播放策略影响。系统启用「减少动态效果」时，粒子和弹入动效会停用。✦、★ 和「预览彩蛋」不计分，也不消耗彩蛋冷却时间。

默认彩蛋仅在新轮次成功结束时检查：本轮无失败、曾达到至少 8 连击、本轮至少 200 分，并且距上次触发至少 10 分钟。可选再要求 Jev 返回概率至少 0.75 的 breakthrough。窄窗口隐藏双侧效果，避免遮挡内容。

## 可选 Jev

在 DSH Host 进程设置 TYPESAFE_API_KEY 或 TYPESAFE_API_KEY_FILE。也可以在插件 patch 行的 config 中设置 apiKeyFile、model（默认 jev-1.13.0）和 timeoutMs（默认 2500）。密钥只由 Host 读取，不发送给浏览器。开启 Jev 后，插件最多发送最近一条助手文本的 500 字符摘要给 TypeSafe；不想发送时保持关闭即可。

## 开发与验证

~~~sh
npm run check
npm pack --dry-run
~~~

client.source.js、core.js 和 customization.js 是客户端源码；npm run build 生成并校验提交到仓库的 client.js。index.js 提供 Host 插件及受 DSH 身份验证保护的路由；cordis.patch.yml 是安装用 bundle 层，local.patch.yml 可用于源码调试。规则测试见 test/，详细需求及历史验收见 [PRD.md](./PRD.md)。

## 开源

仓库文件按 [MIT License](./LICENSE) 开放；仓库公开状态、版本提交与许可信息见 [开源记录](./OPEN_SOURCE.md)。DSH 及其依赖仍遵守各自许可证。本项目与 DeepSeek AI、TypeSafe 无官方关联。
