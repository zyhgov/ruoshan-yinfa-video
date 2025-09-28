// ------------------------------------------------------------------------
// Node.js 批量导入脚本 (batch_importer.cjs)
// 功能：从 import.csv 导入数据，更新 public/video_list.json，并生成带新美化模板的 HTML 文件。
// 文件名规则：gybnx + 两位期数 (e.g., gybnx01.html)
// ------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

// --- 配置区域 ---
const CATEGORY_CODE = 'qjqf'; // 对应的档期分类代码
const CATEGORY_LABEL = '奇酒奇方'; // 分类中文名
const CSV_FILE = 'import.csv'; // 输入的 CSV 文件名
// 使用 __dirname 获取当前脚本所在目录
const JSON_OUTPUT_PATH = path.join(__dirname, 'public', 'video_list.json'); // 列表 JSON 输出路径
const HTML_OUTPUT_DIR = path.join(__dirname, 'public', 'video', CATEGORY_CODE); // HTML 文件输出目录

// ------------------------------------------------------------------------
// HTML 模板 (已集成美化样式并修复变量引用: ${expiryDisplay})
// ------------------------------------------------------------------------
const HTML_TEMPLATE = (title, videoUrl, categoryLabel, expiryDisplay) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | ${categoryLabel}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        /* 全局重置与字体 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body, html {
            height: 100%;
            background-color: #f1f3f5;
            font-family: 'HarmonyOS_Regular', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
            color: #222;
            line-height: 1.6;
            overflow-x: hidden;
        }

        /* ——————— 顶部导航栏 ——————— */
        .top-navbar {
            position: sticky;
            top: 0;
            width: 100%;
            background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%);
            color: white;
            padding: 12px 20px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .top-navbar .logo {
            font-size: 18px;
            font-weight: 700;
            margin-right: 15px;
            color: #60a5fa;
        }
        .top-navbar h2 {
            font-size: 16px;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 80vw;
        }
        @media (max-width: 600px) {
            .top-navbar { padding: 10px 15px; }
            .top-navbar h2 { font-size: 14px; }
            .top-navbar .logo { font-size: 16px; margin-right: 10px; }
        }

        /* ——————— 主内容区 ——————— */
        .main-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 16px;
        }

        /* ——————— 视频播放区域 ——————— */
        .video-player-container {
            position: relative;
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 16px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }
        .video-player {
            width: 100%;
            display: block;
            outline: none;
        }

        /* ——————— 视频信息区 ——————— */
        .video-info-area {
            padding: 24px 0 32px;
        }
        .video-title {
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 12px;
            line-height: 1.4;
        }
        .meta-container {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            color: #64748b;
            font-size: 14px;
        }
        .category-tag {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .expiry-status {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #16a34a; /* 默认显示绿色 */
            font-weight: 600;
        }
        .expiry-status i {
            font-size: 16px;
        }

        /* ——————— 过期遮罩层 ——————— */
        .expired-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.92);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            color: #f87171;
            z-index: 30;
            padding: 20px;
        }
        .expired-overlay h2 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #ef4444;
        }
        .expired-overlay p {
            font-size: 16px;
            margin: 6px 0;
            color: #fca5a5;
            max-width: 500px;
        }
        .expired-overlay .date {
            font-weight: 600;
            color: #fbbf24;
        }

        /* ——————— 自动播放提示（可选） ——————— */
        .autoplay-hint {
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 10;
            display: none;
        }

        /* ——————— 移动端优化 ——————— */
        @media (max-width: 768px) {
            .video-title { font-size: 20px; }
            .meta-container { flex-direction: column; align-items: flex-start; }
            .video-info-area { padding: 16px 0; }
            .main-content { padding: 0 12px; }
        }
        @media (max-width: 480px) {
            .video-title { font-size: 18px; }
            .expired-overlay h2 { font-size: 22px; }
            .expired-overlay p { font-size: 14px; }
        }
    </style>
</head>
<body>
    <nav class="top-navbar">
        <div class="logo">您正在观看</div>
        <h2>${title}</h2>
    </nav>

    <div class="main-content">
        <div class="video-player-container" id="videoArea">
            <video 
                class="video-player" 
                id="videoPlayer"
                src="${videoUrl}"
                controls
                autoplay
                playsinline
                preload="metadata"
                controlsList="nodownload nofullscreen noremoteplayback"
                oncontextmenu="return false;"
                disablePictureInPicture
            >
                您的浏览器不支持 HTML5 视频。
            </video>
            <div class="autoplay-hint" id="autoplayHint">自动播放已启用</div>
            <div class="expired-overlay" id="expiredOverlay">
                <h2><i class="fas fa-exclamation-triangle"></i> 内容已过期</h2>
                <p>该视频的有效期截止于：<span class="date">${expiryDisplay}</span></p>
                <p>如需继续观看，请联系管理员获取最新内容。</p>
            </div>
        </div>

        <div class="video-info-area">
            <h1 class="video-title">${title}</h1>
            <div class="meta-container">
                <span class="category-tag">
                    <i class="fas fa-video"></i> ${categoryLabel}
                </span>
                <span class="expiry-status">
                    <i class="far fa-calendar-alt"></i> ${expiryDisplay}
                </span>
            </div>
        </div>
    </div>

    <script>
        // ——————— 过期检查 ———————
        const expiryDateStr = "${expiryDisplay}"; 
        const video = document.getElementById('videoPlayer');
        const expiredOverlay = document.getElementById('expiredOverlay');
        const videoArea = document.getElementById('videoArea');
        const autoplayHint = document.getElementById('autoplayHint');

        if (expiryDateStr && expiryDateStr !== '永久有效') {
            const expiryDate = new Date(expiryDateStr);
            // 确保日期是有效的，并且加上一天的容错期
            const expiryTimestamp = expiryDate.getTime() + (24 * 60 * 60 * 1000); 
            const now = new Date().getTime();

            if (now > expiryTimestamp) {
                if (video) video.pause();
                if (expiredOverlay) expiredOverlay.style.display = 'flex';
                if (video) video.style.visibility = 'hidden';
            }
        }

        // ——————— 自动播放 & 防下载 ———————
        if (video) {
            // 尝试自动播放
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        if (autoplayHint) autoplayHint.style.display = 'block';
                        setTimeout(() => {
                            if (autoplayHint) autoplayHint.style.display = 'none';
                        }, 3000);
                    })
                    .catch(() => {
                        console.log('自动播放被阻止，需用户交互');
                    });
            }

            // 阻止常见下载方式
            video.addEventListener('contextmenu', e => e.preventDefault());
            video.addEventListener('dragstart', e => e.preventDefault());

            // 阻止 Ctrl+S / Cmd+S
            document.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                }
            });

            // 隐藏右键菜单（额外保险）
            document.addEventListener('contextmenu', e => {
                if (e.target === video) e.preventDefault();
            });
        }
    </script>
</body>
</html>`;


/**
 * 根据标题严格生成 HTML 文件名: CATEGORY_CODE + 两位期数 (e.g., gybnx01, gybnx20)
 * @param {string} title 视频标题 (e.g., "国医伴你行 第1期")
 * @param {number} index 记录在CSV中的索引
 * @returns {string} 严格格式的 HTML 文件名
 */
function generateHtmlName(title, index) {
    // 1. 尝试匹配标题中的期数数字。支持 "第1期", "第 1 期", "第01期" 等格式。
    const match = title.match(/第\s*(\d+)\s*期/);

    if (match && match[1]) {
        const episodeNumber = parseInt(match[1], 10);
        // 确保数字是两位数，不足前面补 0
        const paddedNumber = String(episodeNumber).padStart(2, '0');
        return `${CATEGORY_CODE}${paddedNumber}`;
    } else {
        // 如果无法匹配到期数，则使用索引号作为后备，并给出警告
        const paddedNumber = String(index + 1).padStart(2, '0');
        console.warn(`⚠️ 警告: 标题 "${title}" 中未检测到期数。将使用索引号作为期数: ${paddedNumber}`);
        return `${CATEGORY_CODE}${paddedNumber}`;
    }
}

/**
 * 核心执行函数
 */
async function runImporter() {
    console.log(`--- 🎥 视频批量导入脚本启动 ---`);
    console.log(`分类: ${CATEGORY_LABEL} (${CATEGORY_CODE})`);
    
    // 确保 HTML 目标目录存在
    if (!fs.existsSync(HTML_OUTPUT_DIR)) {
        fs.mkdirSync(HTML_OUTPUT_DIR, { recursive: true });
        console.log(`✅ 创建目录: ${HTML_OUTPUT_DIR}`);
    }

    const videosToImport = [];

    // 1. 读取并解析 CSV 文件
    console.log(`▶️ 正在读取 CSV 文件: ${CSV_FILE}...`);
    try {
        await new Promise((resolve, reject) => {
            fs.createReadStream(path.join(__dirname, CSV_FILE))
                .pipe(csv())
                .on('data', (row) => {
                    videosToImport.push(row);
                })
                .on('end', () => {
                    resolve();
                })
                .on('error', reject);
        });
    } catch (e) {
        console.error(`❌ 错误: 无法读取或解析 ${CSV_FILE} 文件。请检查文件是否存在且格式正确。`, e.message);
        return;
    }
    
    if (videosToImport.length === 0) {
        console.log("⚠️ 警告: CSV 文件中没有找到任何数据行。脚本终止。");
        return;
    }
    
    console.log(`✅ 成功读取 ${videosToImport.length} 条记录。`);
    
    // 2. 遍历数据并生成文件
    const finalVideoList = [];
    
    videosToImport.forEach((video, index) => {
        const title = video.name.trim();
        const videoUrl = video.url.trim();
        
        if (!title || !videoUrl) {
            console.warn(`⚠️ 跳过第 ${index + 1} 行: 标题或链接为空。`);
            return;
        }

        // 默认将过期日期设置为 '永久有效'
        const expiryDate = ''; 
        const expiryDisplay = '永久有效'; 

        const htmlName = generateHtmlName(title, index);

        const htmlFileName = `${htmlName}.html`;
        const htmlFilePath = path.join(HTML_OUTPUT_DIR, htmlFileName);
        const generatedLink = `/video/${CATEGORY_CODE}/${htmlFileName}`;
        

        // A. 生成 HTML 文件内容
        const htmlContent = HTML_TEMPLATE(title, videoUrl, CATEGORY_LABEL, expiryDisplay);
        
        // B. 写入 HTML 文件
        try {
            fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
        } catch (e) {
            console.error(`❌ 写入 HTML 文件失败: ${htmlFileName}`, e.message);
            return;
        }

        // C. 构建 JSON 列表数据
        finalVideoList.push({
            id: uuidv4(),
            htmlName: htmlName,
            category: CATEGORY_CODE,
            title: title,
            videoUrl: videoUrl,
            expiryDate: expiryDate, 
            generatedLink: generatedLink
        });
        
        console.log(`  - 成功生成: ${title} -> ${htmlFileName}`);
    });
    
    // 3. 更新并写入 video_list.json
    try {
        const jsonContent = JSON.stringify(finalVideoList, null, 2);
        fs.writeFileSync(JSON_OUTPUT_PATH, jsonContent, 'utf8');
        console.log(`\n🎉 批量处理完成!`);
        console.log(`✅ ${finalVideoList.length} 条记录已写入: ${path.basename(JSON_OUTPUT_PATH)}`);
    } catch (e) {
        console.error(`\n❌ 错误: 写入 JSON 文件失败!`, e.message);
        return;
    }
    
    console.log(`\n--- 🚀 下一步操作 ---`);
    console.log(`1. 检查 'public/video/${CATEGORY_CODE}' 目录下是否生成了正确的 HTML 文件名。`);
    console.log(`2. **提交所有更改!** 执行 'git add .'、'git commit' 和 'git push'。`);
}

runImporter();