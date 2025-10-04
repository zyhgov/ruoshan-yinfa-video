import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// -------------------------------------------------------------------------
// 核心配置与常量
// -------------------------------------------------------------------------
const CLOUDFLARE_VIDEO_LIST_URL = 'https://rsa.zyhorg.cn/video_list.json';
const CATEGORY_MAP = {
    "第1频道": "bsjkb",
    "第2频道": "ddry",
    "第3频道": "fwdj",
    "第4频道": "gybnx",
    "第5频道": "msmk",
    "第6频道": "qjqf",
};

const loadVideos = async () => {
    try {
        const cacheBustingUrl = `${CLOUDFLARE_VIDEO_LIST_URL}?t=${new Date().getTime()}`;
        const response = await fetch(cacheBustingUrl);
        if (!response.ok) {
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
    // ---------------------- 所有 Hooks 必须在顶部 ----------------------
    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const category = searchParams.get('category');
    const name = searchParams.get('name');
    const [isExpiredLive, setIsExpiredLive] = useState(false);

    /**
     * 【修复点 1】将 CSS 注入的 useEffect 移动到顶层。
     * 无论组件处于何种状态（loading 或 not loading），这个 Hook 都必须被调用。
     */
    useEffect(() => {
        const styleId = 'cube-loader-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
.loader {
    margin: 0 auto;
    display: flex;
    width: 12rem;
    height: 12rem;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    border-radius: 50%;
    border: 0.4rem solid #52c5ff;
}
.container[class*="1"] { animation-delay: 1s; }
.container[class*="2"] { animation-delay: 1.3s; }
.container[class*="3"] { animation-delay: 1.6s; }
.container[class*="4"] { animation-delay: 1.9s; }
.tars {
    z-index: 0;
    position: absolute;
    height: 100px;
    width: 130px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    transform-style: preserve-3d;
    animation: rotateX3D 6s ease-in-out infinite;
}
.container {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    animation: rotateY3D 3s ease-in infinite both;
}
.shape {
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    position: relative;
    z-index: -1;
}
.shape div {
    display: block;
    position: absolute;
    text-align: center;
}
.container:nth-child(2) .f::after,
.container:nth-child(3) .f::after {
    position: absolute;
    content: '';
    width: 100%;
    z-index: -1;
    height: 20px;
    background-image: radial-gradient(#54ff6e 2px, transparent 1%);
    background-size: 20px 5px;
    left: 0;
    top: 20%;
    border: 0;
    animation: animMove 2s linear infinite alternate-reverse;
    overflow: hidden;
}
.container:nth-child(2) .f::before,
.container:nth-child(3) .f::before {
    position: absolute;
    content: '';
    width: 85%;
    z-index: -1;
    height: 20px;
    left: 0;
    top: 20%;
    border: 0;
    background: #181818;
    border: 2px solid #52c5ff;
    overflow: hidden;
}
.container:nth-child(1) .f::before,
.container:nth-child(1) .r::before,
.container:nth-child(1) .l::before,
.container:nth-child(4) .f::before,
.container:nth-child(4) .r::before,
.container:nth-child(4) .l::before {
    position: absolute;
    content: '';
    width: 95%;
    height: 5px;
    left: 0;
    top: 25%;
    border: 1px solid #52c5ff;
    overflow: hidden;
}
.container:nth-child(1) .b::before,
.container:nth-child(4) .b::before {
    position: absolute;
    content: '';
    width: 95%;
    z-index: -1;
    height: 5px;
    left: 0;
    top: 69%;
    border: 1px solid #52c5ff;
    overflow: hidden;
}
.f {
    transform: rotateY(0deg) translateZ(15px);
    border-radius: 2px;
    overflow: hidden;
    transform-style: preserve-3d;
}
.b {
    transform: rotateX(180deg) translateZ(15px);
    border-radius: 2px;
}
.f, .b {
    width: 30px;
    height: 100px;
    background: #212121;
    box-shadow: inset 0 0 0 2px #52c5ff;
    border: 2px solid #52c5ff;
}
.l {
    transform: rotateY(-90deg) translateZ(0px);
    border-radius: 2px;
}
.r {
    transform: rotateY(90deg) translateZ(-30px);
    border-radius: 2px;
}
.l, .r {
    width: 30px;
    height: 100px;
    left: 15px;
    position: relative;
    z-index: -1;
    background: #212121;
    box-shadow: inset 0 0 0 2px #52c5ff;
    border: 2px solid #52c5ff;
}
.t {
    transform: rotateX(90deg) translateZ(40px);
    border-radius: 2px;
}
.bot {
    transform: rotateX(-90deg) translateZ(60px);
    border-radius: 2px;
}
.t, .bot {
    width: 30px;
    height: 30px;
    top: 25px;
    position: relative;
    z-index: -1;
    background: #212121;
    box-shadow: inset 0 0 0 2px #52c5ff;
    border: 2px solid #52c5ff;
}
@keyframes rotateY3D {
    0% { transform: translateZ(0px) rotateX(0); }
    50% { transform: translateZ(0px) rotateX(-360deg); }
    100% { transform: translateZ(0px) rotateX(-360deg); }
}
@keyframes rotateX3D {
    0% { transform: translateX(0px) rotateY(0); }
    50% { transform: translateX(0px) rotateY(180deg); }
    100% { transform: translateX(0px) rotateY(360deg); }
}
@keyframes animMove {
    0% { transform: translateX(20px); }
    100% { transform: translateX(-10px); }
}
        `;
        document.head.appendChild(style);
    }, []);

    // ---------------------- 其他副作用 ----------------------
    useEffect(() => {
        const fetchVideo = async () => {
            if (!category || !name) {
                setError("URL 参数缺失。请检查链接是否包含 category 和 name。");
                setLoading(false);
                return;
            }
            try {
                const allVideos = await loadVideos();
                const foundVideo = allVideos.find(v =>
                    v.category === category && v.htmlName === name
                );
                if (foundVideo) {
                    setVideoData(foundVideo);
                } else {
                    setError(`未找到匹配的视频信息：分类=${category}, 链接名=${name}`);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchVideo();
    }, [category, name]);

    // ✅ 修复：useMemo 仅用于计算，不包含副作用
    const videoInfo = useMemo(() => {
        if (!videoData) return {};
        const categoryLabel = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === videoData.category) || videoData.category;
        const expiryDateStr = videoData.expiryDate;

        let isExpired = false;
        let expiryTimestamp = null;

        if (expiryDateStr) {
            const [datePart, timePart] = expiryDateStr.split(' ');
            if (datePart && timePart) {
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute, second] = timePart.split(':').map(Number);
                const expiryDate = new Date(year, month - 1, day, hour, minute, second || 0);
                if (!isNaN(expiryDate.getTime())) {
                    expiryTimestamp = expiryDate.getTime();
                    const now = new Date().getTime();
                    if (now >= expiryTimestamp) {
                        isExpired = true;
                    }
                }
            } else if (datePart && datePart.length === 10) {
                const [year, month, day] = datePart.split('-').map(Number);
                const expiryDate = new Date(year, month - 1, day);
                expiryTimestamp = expiryDate.getTime() + (24 * 60 * 60 * 1000) - 1;
                const now = new Date().getTime();
                if (now > expiryTimestamp) {
                    isExpired = true;
                }
            }
        }

        const formattedExpiryStr = expiryDateStr ? expiryDateStr.substring(0, 16) : '永久有效';
        const expiryDisplay = expiryDateStr
            ? `有效截止: ${formattedExpiryStr}`
            : '永久有效';

        return {
            categoryLabel,
            isExpired,
            expiryDisplay,
            videoUrl: videoData.videoUrl,
            title: videoData.title,
            expiryDateStr: formattedExpiryStr,
            expiryTimestamp,
        };
    }, [videoData]);

    // ✅ 合法同步初始过期状态
    useEffect(() => {
        if (videoInfo.isExpired !== undefined) {
            setIsExpiredLive(videoInfo.isExpired);
        }
    }, [videoInfo.isExpired]);

    useEffect(() => {
        if (videoInfo.title && videoInfo.categoryLabel) {
            document.title = `${videoInfo.title} | ${videoInfo.categoryLabel}`;
        }
    }, [videoInfo.title, videoInfo.categoryLabel]);

    useEffect(() => {
        if (!videoInfo.expiryTimestamp) return;
        const checkExpiration = () => {
            const now = new Date().getTime();
            if (now >= videoInfo.expiryTimestamp) {
                setIsExpiredLive(true);
                const videoElement = document.getElementById('videoPlayer');
                if (videoElement) {
                    if (!videoElement.paused) videoElement.pause();
                    videoElement.src = '';
                    videoElement.load();
                }
            }
        };
        const intervalId = setInterval(checkExpiration, 5000);
        return () => clearInterval(intervalId);
    }, [videoInfo.expiryTimestamp]);

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

    // ---------------------- 渲染逻辑：条件渲染必须在 Hooks 之后 ----------------------

    // 🌀 加载状态：带动效
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#f1f3f5',
                fontFamily: 'sans-serif',
                padding: '20px',
                boxSizing: 'border-box'
            }}>
                <div className="loader">
                    <div className="tars">
                        <div className="container 1">
                            <div className="shape">
                                <div className="f"></div>
                                <div className="b"></div>
                                <div className="l"></div>
                                <div className="r"></div>
                                <div className="t"></div>
                                <div className="bot"></div>
                            </div>
                        </div>
                        <div className="container 2">
                            <div className="shape">
                                <div className="f"></div>
                                <div className="b"></div>
                                <div className="l"></div>
                                <div className="r"></div>
                                <div className="t"></div>
                                <div className="bot"></div>
                            </div>
                        </div>
                        <div className="container 3">
                            <div className="shape">
                                <div className="f"></div>
                                <div className="b"></div>
                                <div className="l"></div>
                                <div className="r"></div>
                                <div className="t"></div>
                                <div className="bot"></div>
                            </div>
                        </div>
                        <div className="container 4">
                            <div className="shape">
                                <div className="f"></div>
                                <div className="b"></div>
                                <div className="l"></div>
                                <div className="r"></div>
                                <div className="t"></div>
                                <div className="bot"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{
                    marginTop: '30px',
                    textAlign: 'center',
                    maxWidth: '500px',
                    color: '#4b5563',
                    fontSize: '16px',
                    lineHeight: 1.6
                }}>
                    <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#1e293b' }}>📺 数据加载中...</h2>
                    <p>正在动态加载视频信息，请稍候...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return renderMessage("视频加载错误", error, true);
    }

    if (!videoData) {
        return renderMessage("未找到视频", "未找到匹配的视频信息，请检查 URL 参数。", true);
    }

    const finalIsExpired = videoInfo.isExpired || isExpiredLive;

    return (
        <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f1f3f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav className="top-navbar" style={styles.topNavbar}>
                <div style={styles.navLogoWrapper}>
                    <img
                        src="rsvideo.svg"
                        alt="RSV Logo"
                        style={styles.navLogo}
                    />
                </div>
                <div style={styles.logo}>您正在观看</div>
                <h2 style={styles.navTitle}>{videoInfo.title}</h2>
            </nav>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={styles.mainContent}>
                    <div style={styles.videoPlayerContainer}>
                        <video
                            id="videoPlayer"
                            src={!finalIsExpired ? videoInfo.videoUrl : undefined}
                            controls
                            autoPlay={!finalIsExpired}
                            playsInline
                            preload="metadata"
                            controlsList="nodownload nofullscreen noremoteplayback"
                            onContextMenu={(e) => e.preventDefault()}
                            disablePictureInPicture
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

            <div style={styles.reportFooter}>
                <a href="https://jsj.top/f/eA7DUc" target="_blank" rel="noopener noreferrer" style={styles.reportLink}>
                    网络违法违规内容举报
                </a>
            </div>
        </div>
    );
};

const styles = {
    navLogoWrapper: {
        position: 'absolute',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        height: '45px',
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