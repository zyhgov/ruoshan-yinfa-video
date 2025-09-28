import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// -------------------------------------------------------------------------
// 核心配置与常量
// -------------------------------------------------------------------------
const BASE_PATH = ''; 
const isReadOnlyMode = !window.location.host.includes('localhost');
const STORAGE_KEY = 'rsvideo_video_list';

// 固定的档期分类列表
const CATEGORY_MAP = {
    "百岁健康班": "bsjkb",
    "大道仁医": "ddry",
    "防危度健": "fwdj",
    "国医伴你行": "gybnx",
    "美食每刻": "msmk",
    "奇酒奇方": "qjqf",
};
const CATEGORY_OPTIONS = [
    { label: "所有分类", value: "" },
    ...Object.entries(CATEGORY_MAP).map(([label, value]) => ({ label, value }))
];

// ----------------------------------------------------
// 辅助函数：Local Storage 数据读写
// ----------------------------------------------------
const loadVideos = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsedData = data ? JSON.parse(data) : [];
    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    console.error("Error loading videos from localStorage:", error);
    return []; 
  }
};

const saveVideos = (videos) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch (error) {
    console.error("Error saving videos to localStorage:", error);
    alert("警告：本地存储失败，您的数据可能未保存！");
  }
};


// ----------------------------------------------------
// 核心组件：AdminDashboard
// ----------------------------------------------------

function AdminDashboard() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState(loadVideos);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(''); 
  const [formData, setFormData] = useState({
    id: null,
    htmlName: '',
    category: '', 
    title: '', 
    videoUrl: '', 
    expiryDate: '',
  });

  // ----------------------------------------
  // 业务逻辑函数 (省略不变的代码块)
  // ----------------------------------------
  
  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    navigate('/admin', { replace: true });
  }, [navigate]);

  const resetForm = useCallback(() => {
    setFormData({
      id: null, htmlName: '', category: '', title: '', videoUrl: '', expiryDate: '',
    });
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleCategoryFilterChange = useCallback((e) => {
    setSelectedCategory(e.target.value);
  }, []);
  
  const handleEdit = useCallback((video) => {
    if (isReadOnlyMode) return;
    setFormData(video);
  }, []);


  // 文件下载生成逻辑 (重点更新部分：全宽视频 + 顶部导航栏)
  const downloadHtmlFile = useCallback((data) => {
    const { title, videoUrl, htmlName, category, expiryDate } = data;

    // 获取分类中文名
    const categoryLabel = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === category) || category;
    
    // 格式化过期日期显示
    const expiryDisplay = expiryDate 
        ? `有效截止: ${expiryDate}` 
        : '永久有效';

const htmlContent = `<!DOCTYPE html>
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
            color: #dc2626;
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
    <!-- 顶部导航栏 -->
    <nav class="top-navbar">
        <div class="logo">您正在观看</div>
        <h2>${title}</h2>
    </nav>

    <div class="main-content">
        <!-- 视频播放器 -->
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
                <p>该视频的有效期截止于：<span class="date">${expiryDate}</span></p>
                <p>如需继续观看，请联系管理员获取最新内容。</p>
            </div>
        </div>

        <!-- 视频信息 -->
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
        const expiryDateStr = "${expiryDate}";
        const video = document.getElementById('videoPlayer');
        const expiredOverlay = document.getElementById('expiredOverlay');
        const videoArea = document.getElementById('videoArea');
        const autoplayHint = document.getElementById('autoplayHint');

        if (expiryDateStr) {
            const expiryDate = new Date(expiryDateStr);
            const expiryTimestamp = expiryDate.getTime() + (24 * 60 * 60 * 1000); // 加一天容错
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

    // 触发浏览器下载
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = `${htmlName}.html`; 

    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`
        ✅ 文件已生成并下载: ${fileName}。

        👉 **请手动操作 (由于浏览器安全限制，无法自动创建文件夹):**
        1. 确保 Git 仓库根目录有 \`video\` 文件夹。
        2. 如果 \`video/${category}/\` 不存在，请手动创建。
        3. 将下载的 \`${fileName}\` 移动到本地 \`video/${category}/\` 文件夹中。
        4. 最后，使用 Git 提交并推送。
    `);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (isReadOnlyMode) return;

    const { htmlName, category, title, videoUrl } = formData;
    if (!htmlName || !category || !title || !videoUrl) {
        alert('请填写所有必填字段！');
        return;
    }
    
    // 检查 category 是否在常量列表中
    if (!Object.values(CATEGORY_MAP).includes(category)) {
        alert(`档期分类代码 ${category} 无效！请使用预设的分类代码。`);
        return;
    }

    const generatedLink = `${BASE_PATH}/video/${category}/${htmlName}.html`;

    let updatedVideos;

    if (formData.id) {
        updatedVideos = videos.map(v => 
            v.id === formData.id ? { ...formData, generatedLink } : v
        );
        alert('视频信息已更新！请重新下载文件。');
    } else {
        const newVideo = { 
            ...formData, 
            id: uuidv4(),
            generatedLink 
        };
        updatedVideos = [...videos, newVideo];
        alert('视频信息已新增！');
    }

    setVideos(updatedVideos);
    saveVideos(updatedVideos);
    
    downloadHtmlFile({ ...formData, generatedLink });
    resetForm();
  }, [formData, videos, downloadHtmlFile, resetForm]);


  const handleDelete = useCallback((id) => {
    if (isReadOnlyMode) return;

    if (window.confirm('确定要删除这条链接吗？\n\n警告：这只会删除本地记录，你需要手动从您的 Git 仓库中删除对应的 HTML 文件！')) {
        const updatedVideos = videos.filter(v => v.id !== id);
        setVideos(updatedVideos);
        saveVideos(updatedVideos);
        alert('✅ 链接已删除！请记得手动删除本地文件并提交 Git。');
    }
  }, [videos]);

  const handleCopy = useCallback((link) => {
    let fullLink = `${window.location.origin}${link}`;

    navigator.clipboard.writeText(fullLink)
      .then(() => alert(`✅ 链接已复制（${isReadOnlyMode ? '线上' : '本地'}完整链接）：${fullLink}`))
      .catch(err => console.error('复制失败:', err));
  }, []);

  // ----------------------------------------
  // 数据计算与渲染 (保持不变)
  // ----------------------------------------
  
  const filteredVideos = useMemo(() => {
    let result = videos;
    if (selectedCategory) {
        result = result.filter(video => video.category === selectedCategory);
    }
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        result = result.filter(video => 
            video.title.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }
    return result;
  }, [videos, searchTerm, selectedCategory]);

  // 渲染表单
  const renderForm = () => (
    <form onSubmit={handleSubmit} style={{ 
        border: '1px solid #ddd', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '30px', 
        backgroundColor: isReadOnlyMode ? '#f9f9f9' : '#fff', 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
    }}>
      <h3 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom: '20px', color: '#333' }}>{formData.id ? '编辑视频信息' : '新增视频信息'}</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <input name="htmlName" value={formData.htmlName} onChange={handleChange} placeholder="HTML链接名 (如: movie-001)" required disabled={isReadOnlyMode} style={inputStyle} />
        
        <select 
            name="category" 
            value={formData.category} 
            onChange={handleChange} 
            required 
            disabled={isReadOnlyMode} 
            style={inputStyle}
        >
            <option value="" disabled>选择档期分类代码 *</option>
            {Object.entries(CATEGORY_MAP).map(([label, value]) => (
                <option key={value} value={value}>{label} ({value})</option>
            ))}
        </select>
        
        <input name="title" value={formData.title} onChange={handleChange} placeholder="视频标题" required disabled={isReadOnlyMode} style={inputStyle} />
        <input name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="视频链接 (MP4/M3U8直接链接)" required disabled={isReadOnlyMode} style={inputStyle} />
        <input name="expiryDate" value={formData.expiryDate} onChange={handleChange} type="date" placeholder="页面有效过期时间" disabled={isReadOnlyMode} style={inputStyle} />
      </div>
      
      {!isReadOnlyMode && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <button type="submit" style={{ ...buttonStyle, backgroundColor: formData.id ? '#ffc107' : '#28a745' }}>
                {formData.id ? '更新并下载文件' : '新增并下载文件'}
            </button>
            {formData.id && (
                <button type="button" onClick={resetForm} style={{ ...buttonStyle, backgroundColor: '#6c757d', marginLeft: '10px' }}>
                    取消编辑
                </button>
            )}
        </div>
      )}
      
      {isReadOnlyMode && <p style={{color: '#dc3545', marginTop: '10px', fontWeight: 'bold'}}>**当前为只读模式（上线环境），无法编辑或新增。请在本地开发环境 (`localhost`) 操作。**</p>}
    </form>
  );

  // 渲染列表
  const renderList = () => (
    <div>
      <h3 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px', color: '#333' }}>已生成的 HTML 链接列表 ({filteredVideos.length} / {videos.length} 条)</h3>
      
      {/* 搜索过滤区域 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {/* 档期分类下拉框 */}
        <select
            value={selectedCategory}
            onChange={handleCategoryFilterChange}
            style={{ ...inputStyle, flex: 'none', width: '200px', cursor: 'pointer' }}
        >
            {CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>

        {/* 搜索输入框 */}
        <input 
          type="text"
          placeholder="🔍 搜索视频标题..."
          value={searchTerm}
          onChange={handleSearchChange}
          style={{ ...inputStyle, flex: '1' }}
        />
      </div>


      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
            <th style={tableHeaderStyle}>标题</th>
            <th style={tableHeaderStyle}>链接 (相对路径)</th>
            <th style={tableHeaderStyle}>档期分类</th>
            <th style={tableHeaderStyle}>过期日</th>
            <th style={tableHeaderStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredVideos.map(video => (
            <tr key={video.id} style={{ backgroundColor: '#fff', borderBottom: '1px solid #eee', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
              <td style={tableCellStyle}>{video.title}</td>
              <td style={{ ...tableCellStyle, fontSize: '11px', wordBreak: 'break-all' }}>
                <a href={video.generatedLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none' }}>{video.generatedLink}</a>
              </td>
              <td style={tableCellStyle}>
                  {Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === video.category) || video.category}
              </td>
              <td style={{ ...tableCellStyle, color: video.expiryDate && new Date(video.expiryDate) < new Date() ? '#dc3545' : '#28a745' }}>
                {video.expiryDate || '永久'}
              </td>
              <td style={tableCellStyle}>
                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                    {!isReadOnlyMode && (
                        <>
                            <button onClick={() => handleEdit(video)} style={{ ...actionButtonStyle, backgroundColor: '#17a2b8' }}>编辑</button>
                            <button onClick={() => handleDelete(video.id)} style={{ ...actionButtonStyle, backgroundColor: '#dc3545' }}>删除</button>
                        </>
                    )}
                    <button onClick={() => handleCopy(video.generatedLink)} style={{ ...actionButtonStyle, backgroundColor: '#007bff' }}>复制</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredVideos.length === 0 && (
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#6c757d' }}>
            {searchTerm || selectedCategory ? `未找到匹配结果。` : '当前列表为空。'}
        </p>
      )}
    </div>
  );

  // ----------------------------------------
  // 样式定义
  // ----------------------------------------
  const inputStyle = {
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
    width: '100%'
  };

  const buttonStyle = {
    padding: '10px 15px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  };
  
  const tableHeaderStyle = { 
      borderBottom: '2px solid #ddd', 
      padding: '12px 8px', 
      textAlign: 'center', 
      fontSize: '14px', 
      color: '#333' 
  };
  
  const tableCellStyle = { 
      padding: '12px 8px', 
      textAlign: 'center', 
      fontSize: '14px',
      borderLeft: 'none', 
      borderRight: 'none',
  };

  const actionButtonStyle = {
      padding: '5px 10px',
      color: 'white',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '12px',
  };


  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#f4f7f9', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
          <h1 style={{ color: '#333' }}>视频管理后台 <span style={{fontSize: '16px', fontWeight: 'normal', color: '#6c757d'}}>({isReadOnlyMode ? '上线只读模式' : '本地开发模式'})</span></h1>
          <button onClick={handleLogout} style={{ ...buttonStyle, backgroundColor: '#dc3545' }}>
            退出登录
          </button>
      </div>

      {renderForm()}
      {renderList()}
      
      <p style={{ marginTop: '50px', padding: '15px', borderLeft: '3px solid #007bff', backgroundColor: '#e9f7ff', color: '#333' }}>
        **部署与链接指南：**
        <br/> 1. **分类代码列表:** 请确保新增/编辑时使用以下代码：
            <ul style={{ paddingLeft: '20px', marginTop: '5px', fontSize: '14px' }}>
                {Object.entries(CATEGORY_MAP).map(([label, value]) => (
                    <li key={value}>{label} 对应代码: **{value}**</li>
                ))}
            </ul>
      </p>
    </div>
  );
}
export default AdminDashboard;