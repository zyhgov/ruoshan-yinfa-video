import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// -------------------------------------------------------------------------
// 核心配置与常量
// -------------------------------------------------------------------------

// 【核心配置】视频列表的 Cloudflare 完整加载链接
const CLOUDFLARE_VIDEO_LIST_URL = 'https://rsa.zyhorg.cn/video_list.json';
// const CLOUDFLARE_VIDEO_LIST_URL = 'http://localhost:5173/video_list.json';

// 固定的档期分类列表 (复制自 AdminDashboard.jsx)
const CATEGORY_MAP = {
    "第1频道": "bsjkb",
    "第2频道": "ddry",
    "第3频道": "fwdj",
    "第4频道": "gybnx",
    "第5频道": "msmk",
    "第6频道": "qjqf",
};

// 异步加载视频列表数据
const loadVideos = async () => {
    try {
        // **【缓存穿透修复】**：添加时间戳查询参数，强制 Cloudflare 每次都拉取最新文件
        const cacheBustingUrl = `${CLOUDFLARE_VIDEO_LIST_URL}?t=${new Date().getTime()}`;
        
        const response = await fetch(cacheBustingUrl); 
        
        if (!response.ok) {
            // 错误信息仍使用原 URL
            console.error(`❌ 无法加载 ${CLOUDFLARE_VIDEO_LIST_URL} 文件。状态码: ${response.status}`);
            throw new Error(`无法从 Cloudflare 加载列表: 状态码 ${response.status}。请检查 CORS 配置！`);
        }
        
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("加载 video_list.json 失败:", error);
        throw new Error("加载视频列表数据失败，请检查网络或 CORS 配置。");
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

    // **【新增状态】** 用于实时强制更新过期状态
    const [isExpiredLive, setIsExpiredLive] = useState(false);

    useEffect(() => {
        const fetchVideo = async () => {
            if (!category || !name) {
                setError("URL 参数缺失。请检查链接是否包含 category 和 name。");
                setLoading(false);
                return;
            }

            try {
                // 确保 loadVideos 抛出的错误被捕获
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
            } catch (err) {
                // 捕获 loadVideos 抛出的错误信息
                setError(err.message); 
            } finally {
                setLoading(false);
            }
        };

        fetchVideo();
    }, [category, name]);

    // ----------------------------------------
    // 视频信息计算 (已修复日期解析逻辑和显示格式)
    // ----------------------------------------
    const videoInfo = useMemo(() => {
        if (!videoData) return {};
        
        const categoryLabel = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === videoData.category) || videoData.category;
        const expiryDateStr = videoData.expiryDate; // e.g., "2025-10-31 23:38:00"
        
        // 检查是否过期（仅用于初始化判断）
        let isExpired = false;
        let expiryTimestamp = null;

        if (expiryDateStr) {
            // 【日期解析修复】确保使用本地时区解析 YYYY-MM-DD HH:MM:SS
            // 兼容性更好的手动解析
            const [datePart, timePart] = expiryDateStr.split(' ');
            
            if (datePart && timePart) {
                // 处理 YYYY-MM-DD HH:MM:SS 格式
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute, second] = timePart.split(':').map(Number);
                
                // 使用 new Date(year, monthIndex, day, hours, minutes, seconds) 构造本地日期
                // month - 1 是因为 JavaScript 月份从 0 开始 (10月是 9)
                const expiryDate = new Date(year, month - 1, day, hour, minute, second || 0);

                if (!isNaN(expiryDate.getTime())) {
                    expiryTimestamp = expiryDate.getTime();
                    
                    const now = new Date().getTime();
                    // 检查当前时间是否大于或等于过期时间
                    if (now >= expiryTimestamp) {
                        isExpired = true;
                    }
                }
            } else if (datePart && datePart.length === 10) {
                // 兼容 AdminDashboard 可能只返回日期的情况（只包含 YYYY-MM-DD）
                const [year, month, day] = datePart.split('-').map(Number);
                const expiryDate = new Date(year, month - 1, day);
                // 确保在当天的最后一毫秒过期
                expiryTimestamp = expiryDate.getTime() + (24 * 60 * 60 * 1000) - 1; 

                const now = new Date().getTime();
                if (now > expiryTimestamp) {
                    isExpired = true;
                }
            }
        }
        
        // 【格式化展示】只保留到分钟
        const formattedExpiryStr = expiryDateStr ? expiryDateStr.substring(0, 16) : '永久有效';

        const expiryDisplay = expiryDateStr 
            ? `有效截止: ${formattedExpiryStr}` 
            : '永久有效';

        // **【重要】** 将 useMemo 计算出的过期状态同步到 Live 状态
        // 初始状态下 isExpiredLive 依赖这个计算结果
        setIsExpiredLive(isExpired);

        return {
            categoryLabel,
            isExpired,
            expiryDisplay,
            videoUrl: videoData.videoUrl,
            title: videoData.title,
            expiryDateStr: formattedExpiryStr, // 使用格式化后的字符串
            // **【新增】** 暴露计算出的时间戳，供 Live Check 使用
            expiryTimestamp: expiryTimestamp 
        };
    }, [videoData]);
    
    // 👇 动态设置页面标题
    useEffect(() => {
        if (videoInfo.title && videoInfo.categoryLabel) {
            document.title = `${videoInfo.title} | ${videoInfo.categoryLabel}`;
        }
    }, [videoInfo.title, videoInfo.categoryLabel]);


    // ----------------------------------------
    // 【核心 BUG 修复】实时过期检查和强制停止
    // ----------------------------------------
    useEffect(() => {
        if (!videoInfo.expiryTimestamp) {
            // 如果永久有效，则无需设置定时器
            return;
        }

        const checkExpiration = () => {
            const now = new Date().getTime();
            
            // 检查当前时间是否超过过期时间戳
            if (now >= videoInfo.expiryTimestamp) {
                // 如果过期，更新状态，这将触发 UI 重新渲染
                setIsExpiredLive(true); 
                
                // 强制停止视频播放
                const videoElement = document.getElementById('videoPlayer');
                if (videoElement) {
                    // 停止播放
                    if (!videoElement.paused) {
                        videoElement.pause();
                    }
                    // 清空 src 属性阻止任何进一步加载
                    videoElement.src = '';
                    videoElement.load();
                }
            }
        };

        // 设置定时器，每 5 秒（5000 毫秒）检查一次
        const intervalId = setInterval(checkExpiration, 5000); 

        // 组件卸载时或依赖项变化时清除定时器
        return () => clearInterval(intervalId);

    }, [videoInfo.expiryTimestamp]); // 依赖于计算出的过期时间戳


    // ----------------------------------------
    // 渲染加载中、错误或播放页
    // ----------------------------------------

    // **【重要】** 渲染时使用实时状态 isExpiredLive
    const finalIsExpired = videoInfo.isExpired || isExpiredLive; 

    const renderMessage = (title, message, isError = false) => (
        <div style={{ 
            maxWidth: '600px', 
            margin: '50px auto', 
            padding: '30px', 
            borderRadius: '10px', 
            backgroundColor: isError ? '#f8d7da' : '#fff3cd', 
            border: isError ? '1px solid #f5c6cb' : '1px solid #ffeeba',
            color: isError ? '#721c24' : '#856404',
            textAlign: 'center',
            fontFamily: 'sans-serif'
        }}>
            <h2 style={{ fontSize: '24px', marginBottom: '15px' }}>{title}</h2>
            <p style={{ fontSize: '16px' }}>{message}</p>
        </div>
    );
    
    if (loading) {
        return renderMessage("📺 数据加载中...", "正在动态加载视频信息，请稍候...");
    }

    if (error) {
        return renderMessage("视频加载错误", error, true);
    }

    if (!videoData) {
        return renderMessage("未找到视频", "未找到匹配的视频信息，请检查 URL 参数。", true);
    }

    return (
        <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f1f3f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* 顶部导航栏 */}
            <nav className="top-navbar" style={styles.topNavbar}>
            {/* Logo 容器 */}
            <div style={styles.navLogoWrapper}>
                <img 
                // src="/rsv-b.svg" 
                src="rsvideo.svg"
                alt="RSV Logo" 
                style={styles.navLogo}
                />
            </div>
            <div style={styles.logo}>您正在观看</div>
            <h2 style={styles.navTitle}>{videoInfo.title}</h2>
            </nav>
            {/* 主内容区：可滚动 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={styles.mainContent}>
                    <div style={styles.videoPlayerContainer}>
                        <video 
                            id="videoPlayer"
                            // 仅在未过期时设置 src
                            src={!finalIsExpired ? videoInfo.videoUrl : undefined} 
                            controls
                            // 使用 finalIsExpired 来决定是否自动播放
                            autoPlay={!finalIsExpired} 
                            playsInline
                            preload="metadata"
                            controlsList="nodownload nofullscreen noremoteplayback"
                            onContextMenu={(e) => e.preventDefault()}
                            disablePictureInPicture
                            // 使用 finalIsExpired 来决定可见性
                            style={{ ...styles.videoPlayer, visibility: finalIsExpired ? 'hidden' : 'visible' }}
                        >
                            您的浏览器不支持 HTML5 视频。
                        </video>
                        
                        {finalIsExpired && (
                            <div style={styles.expiredOverlay}>
                                <h2 style={styles.expiredOverlayH2}>⚠️ 视频已过期 ⚠️</h2>
                                <p style={styles.expiredOverlayP}>
                                    该视频的有效期截止于：
                                    <span style={styles.expiredOverlayDate}>{videoInfo.expiryDateStr}</span>
                                </p>
                                <p style={styles.expiredOverlayP}>如需继续观看，请联系运维获取最新内容。</p>
                            </div>
                        )}
                    </div>

                    <div style={styles.videoInfoArea}>
                        <h1 style={styles.videoTitle}>{videoInfo.title}</h1>
                        <div style={styles.metaContainer}>
                            <span style={styles.categoryTag}>
                                🎬 {videoInfo.categoryLabel}
                            </span>
                            <span style={{ ...styles.expiryStatus, color: finalIsExpired ? '#dc2626' : '#16a34a' }}>
                                📅 {videoInfo.expiryDisplay}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 👇 举报区域：固定在页面底部（文档流最后） */}
            <div style={styles.reportFooter}>
                <a href="https://jsj.top/f/eA7DUc" target="_blank" rel="noopener noreferrer" style={styles.reportLink}>
                    网络违法违规内容举报
                </a>
            </div>
        </div>
    );
};

// ----------------------------------------
// 样式定义
// ----------------------------------------
const styles = {
    // === 导航栏 Logo 样式 ===
    navLogoWrapper: {
    position: 'absolute',
    left: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '45px', // 可根据实际 SVG 调整
    },
    navLogo: {
    height: '100%',
    width: 'auto',
    objectFit: 'contain',
    display: 'block',
    },
    topNavbar: {
        position: 'sticky',
        top: 0,
        width: '100%', 
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
        paddingBottom: '56.25%', 
        height: 0,
    },
    reportFooter: {
        padding: '12px 0',
        backgroundColor: 'white',
        borderTop: '1px solid #e2e8f0',
        textAlign: 'center',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
        zIndex: 100,
    },
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
        fontSize: '30px',
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