import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';


// 固定的档期分类列表 (复制自 AdminDashboard.jsx)
const CATEGORY_MAP = {
    "百岁健康班": "bsjkb",
    "大道仁医": "ddry",
    "防危度健": "fwdj",
    "国医伴你行": "gybnx",
    "美食每刻": "msmk",
    "奇酒奇方": "qjqf",
};

// 异步加载视频列表数据 (复制自 AdminDashboard.jsx)
const loadVideos = async () => {
    try {
        const response = await fetch('/video_list.json');
        if (!response.ok) {
            console.error("无法加载 /video_list.json 文件。");
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("加载 video_list.json 失败:", error);
        return [];
    }
};

const PlayerPage = () => {
    const [searchParams] = useSearchParams();
    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 从 URL 获取参数
    const category = searchParams.get('category');
    const name = searchParams.get('name');

    useEffect(() => {
        const fetchVideo = async () => {
            if (!category || !name) {
                setError("URL 参数缺失。请检查链接是否包含 category 和 name。");
                setLoading(false);
                return;
            }

            try {
                const allVideos = await loadVideos();
                
                // 根据 URL 参数查找对应的视频
                const foundVideo = allVideos.find(v => 
                    v.category === category && v.htmlName === name
                );

                if (foundVideo) {
                    setVideoData(foundVideo);
                } else {
                    setError(`未找到匹配的视频信息：分类=${category}, 链接名=${name}`);
                }
            } catch (error) { // <-- 这里的 'error' 变量
        console.error("加载 video_list.json 失败:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVideo();
    }, [category, name]);

    // ----------------------------------------
    // 视频信息计算 (与 AdminDashboard 中的逻辑保持一致)
    // ----------------------------------------
    const videoInfo = useMemo(() => {
        if (!videoData) return {};
        
        const categoryLabel = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === videoData.category) || videoData.category;
        const expiryDateStr = videoData.expiryDate;
        
        // 检查是否过期
        let isExpired = false;
        if (expiryDateStr) {
            // 加一天容错
            const expiryTimestamp = new Date(expiryDateStr).getTime() + (24 * 60 * 60 * 1000); 
            const now = new Date().getTime();
            if (now > expiryTimestamp) {
                isExpired = true;
            }
        }
        
        const expiryDisplay = expiryDateStr 
            ? `有效截止: ${expiryDateStr}` 
            : '永久有效';

        return {
            categoryLabel,
            isExpired,
            expiryDisplay,
            videoUrl: videoData.videoUrl,
            title: videoData.title,
        };
    }, [videoData]);

    // ----------------------------------------
    // 渲染加载中、错误或播放页
    // ----------------------------------------
    if (loading) {
        return <div style={{ textAlign: 'center', padding: '50px' }}>视频列表加载中...</div>;
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545', border: '1px solid #dc3545', margin: '20px', borderRadius: '8px' }}>
                <h2>视频加载错误</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (!videoData) {
        // 通常被 error 捕获，但作为最终保障
        return <div style={{ textAlign: 'center', padding: '50px' }}>未找到视频。</div>;
    }

return (
  <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f1f3f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    {/* 顶部导航栏 */}
    <nav className="top-navbar" style={styles.topNavbar}>
      <div style={styles.logo}>您正在观看</div>
      <h2 style={styles.navTitle}>{videoInfo.title}</h2>
    </nav>

    {/* 主内容区：可滚动 */}
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={styles.mainContent}>
        <div style={styles.videoPlayerContainer}>
          <video 
            id="videoPlayer"
            src={videoInfo.videoUrl}
            controls
            autoPlay={!videoInfo.isExpired} 
            playsInline
            preload="metadata"
            controlsList="nodownload nofullscreen noremoteplayback"
            onContextMenu={(e) => e.preventDefault()}
            disablePictureInPicture
            style={{ ...styles.videoPlayer, visibility: videoInfo.isExpired ? 'hidden' : 'visible' }}
          >
            您的浏览器不支持 HTML5 视频。
          </video>
          
          {videoInfo.isExpired && (
            <div style={styles.expiredOverlay}>
              <h2 style={styles.expiredOverlayH2}>⚠️ 内容已过期</h2>
              <p style={styles.expiredOverlayP}>
                该视频的有效期截止于：
                <span style={styles.expiredOverlayDate}>{videoInfo.expiryDateStr}</span>
              </p>
              <p style={styles.expiredOverlayP}>如需继续观看，请联系管理员获取最新内容。</p>
            </div>
          )}
        </div>

        <div style={styles.videoInfoArea}>
          <h1 style={styles.videoTitle}>{videoInfo.title}</h1>
          <div style={styles.metaContainer}>
            <span style={styles.categoryTag}>
              🎬 {videoInfo.categoryLabel}
            </span>
            <span style={{ ...styles.expiryStatus, color: videoInfo.isExpired ? '#dc2626' : '#16a34a' }}>
              📅 {videoInfo.expiryDisplay}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* 👇 举报区域：固定在页面底部（文档流最后） */}
    <div style={styles.reportFooter}>
      <a
        href="https://forms.office.com/r/7ipB7GPS9T"
        target="_blank"
        rel="noopener noreferrer"
        style={styles.reportLink}
      >
        <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>
        举报违规内容
      </a>
    </div>
  </div>
);
};

// ----------------------------------------
// 样式定义 (模仿原 HTML 中的样式)
// ----------------------------------------
const styles = {
  topNavbar: {
    position: 'sticky',
    top: 0,
    width: '100%', // 确保宽度为100%
    background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
    color: 'white',
    padding: '12px 20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.18)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    // 核心修复：内边距包含在宽度内，防止溢出
    boxSizing: 'border-box', 
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    marginRight: '15px',
    color: '#60a5fa',
  },
  navTitle: {
    fontSize: '16px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '80vw',
  },
  mainContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 16px',
    // 核心修复：内边距包含在宽度内，防止溢出
    boxSizing: 'border-box', 
  },
  videoPlayerContainer: {
    position: 'relative',
    background: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    marginTop: '16px',
    maxWidth: '100%',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
    // 保持 16:9 比例 (这是正确的响应式视频比例设置)
    paddingBottom: '56.25%', 
    height: 0,
  },
  // 👇 举报页脚容器
  reportFooter: {
    padding: '12px 0',
    backgroundColor: 'white',
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
    zIndex: 100,
  },

  // 👇 举报链接样式
  reportLink: {
    color: '#dc2626',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    outline: 'none',
  },
  expiredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(15, 23, 42, 0.92)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    color: '#f87171',
    zIndex: 30,
    padding: '20px',
  },
  expiredOverlayH2: {
    fontSize: '28px',
    fontWeight: 700,
    marginBottom: '16px',
    color: '#ef4444',
  },
  expiredOverlayP: {
    fontSize: '16px',
    margin: '6px 0',
    color: '#fca5a5',
    maxWidth: '500px',
  },
  expiredOverlayDate: {
    fontWeight: 600,
    color: '#fbbf24',
  },
  videoInfoArea: {
    padding: '24px 0 32px',
  },
  videoTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '12px',
    lineHeight: 1.4,
  },
  metaContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
  categoryTag: {
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontWeight: 600,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  expiryStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600,
    fontSize: '14px',
  },
};

export default PlayerPage;