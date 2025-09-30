import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// -------------------------------------------------------------------------
// 核心配置与常量
// -------------------------------------------------------------------------
const BASE_PATH = '';
// 检查当前环境是否为只读模式 (非 localhost 视为线上环境)
const isReadOnlyMode = !window.location.host.includes('localhost');

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

// 分页选项
const PAGE_SIZE_OPTIONS = [20, 50, 100];

// 字体定义
const FONT_FAMILY = 'MiSans-Semibold';

// ----------------------------------------------------
// 辅助函数：数据读写（基于 JSON 文件）
// ----------------------------------------------------

const loadVideos = async () => {
    try {
        const response = await fetch('/video_list.json');
        if (!response.ok) {
            console.warn("未找到 /video_list.json 文件或加载失败。将使用空列表。");
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("加载 video_list.json 失败:", error);
        return [];
    }
};

const downloadJsonFile = (data) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = 'video_list.json';

    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`
        📢 列表数据文件已生成并下载: ${fileName}。

        👉 重要！请手动操作：
        1. 将下载的 \`${fileName}\` 移动到您 Git 仓库的根目录下。
        2. 将此文件与您的代码一起提交并推送到 GitHub！
    `);
};

/**
 * 搜索关键词高亮辅助函数
 */
const highlightText = (text, highlight) => {
    if (!highlight) {
        return text;
    }
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span key={`highlight-${text}`}>
            {parts.map((part, index) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <mark key={index} style={{ backgroundColor: '#ffcc00', padding: '0 2px', borderRadius: '2px' }}>
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

// ----------------------------------------------------
// 辅助函数：日期时间格式转换 (新增，用于支持精确到秒的输入)
// ----------------------------------------------------

/**
 * 将内部存储格式 (YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS)
 * 转换为 <input type="datetime-local"> 所需的 YYYY-MM-DDTHH:MM 格式。
 */
const formatInternalDateToDatetimeLocal = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split(' ');
    const datePart = parts[0];
    
    // 如果是纯日期 (YYYY-MM-DD)，则补齐 T00:00
    if (parts.length === 1) {
        return `${datePart}T00:00`;
    }
    
    // 如果包含时间 (YYYY-MM-DD HH:MM:SS)，替换空格为 T，并保留到分钟
    const timePart = parts[1];
    if (timePart) {
        // 确保只取到分钟 (HH:MM)
        const timeMinutes = timePart.substring(0, 5); 
        return `${datePart}T${timeMinutes}`;
    }
    return '';
};


// ----------------------------------------------------
// 辅助函数：响应式 Hook
// ----------------------------------------------------

const useIsMobile = (maxWidth = 768) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= maxWidth);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= maxWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [maxWidth]);

    return isMobile;
};

// ----------------------------------------------------
// 样式定义
// ----------------------------------------------------

const styles = {
    // === 基础布局样式 ===
    pageContainer: {
        padding: '20px',
        maxWidth: '1400px',
        margin: '0 auto',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh',
        fontFamily: FONT_FAMILY,
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        borderBottom: '2px solid #e9ecef',
        paddingBottom: '15px',
    },
    headerTitle: {
        color: '#212529',
        fontWeight: 600,
        fontSize: '28px',
    },
    headerSubtitle: {
        fontSize: '16px',
        fontWeight: 'normal',
        color: '#6c757d',
        marginLeft: '10px',
    },

    // === 表单/卡片基础样式 (作为函数定义) ===
    card: (isReadOnly) => ({
        border: 'none',
        padding: '25px',
        borderRadius: '12px',
        marginBottom: '30px',
        backgroundColor: isReadOnly ? '#f9f9f9' : '#fff',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
        transition: 'box-shadow 0.3s',
    }),
    formGrid: (isMobile) => ({
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
    }),
    formTitle: {
        borderBottom: '2px solid #007bff',
        paddingBottom: '10px',
        marginBottom: '20px',
        color: '#333',
        fontWeight: 600,
        fontSize: '22px',
    },
    input: {
        padding: '12px',
        border: '1px solid #ced4da',
        borderRadius: '8px',
        fontSize: '15px',
        boxSizing: 'border-box',
        width: '100%',
        minWidth: '50px',
        fontFamily: FONT_FAMILY,
        transition: 'border-color 0.2s',
    },

    // === 按钮样式 ===
    buttonBase: {
        padding: '10px 18px',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '15px',
        fontWeight: 600,
        transition: 'background-color 0.2s, transform 0.1s',
        minWidth: '100px',
    },
    buttonAction: (color) => ({
        padding: '5px 10px',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        backgroundColor: color,
        fontWeight: 600,
        transition: 'opacity 0.2s',
    }),
    buttonPrimary: { backgroundColor: '#007bff' },
    buttonSuccess: { backgroundColor: '#28a745' },
    buttonWarning: { backgroundColor: '#ffc107', color: '#333' },
    buttonDanger: { backgroundColor: '#dc3545' },
    buttonSecondary: { backgroundColor: '#6c757d' },

    // === 列表/表格样式 ===
    listHeader: {
        borderBottom: '2px solid #007bff',
        paddingBottom: '10px',
        color: '#333',
        fontWeight: 600,
        fontSize: '22px',
        marginBottom: '20px',
    },
    filterContainer: (isMobile) => ({
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '10px',
        marginBottom: '20px',
    }),
    tableContainer: (isMobile) => ({
        overflowX: isMobile ? 'scroll' : 'visible',
        marginTop: '10px',
        paddingBottom: '10px',
    }),
    table: {
        width: '100%',
        minWidth: '700px', // 确保在移动设备上可以水平滚动
        borderCollapse: 'separate',
        borderSpacing: '0 10px',
    },
    tableHeader: {
        padding: '15px 10px',
        textAlign: 'center',
        fontSize: '14px',
        color: '#6c757d',
        fontWeight: 600,
        backgroundColor: '#e9ecef',
    },
    tableRow: {
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        transition: 'box-shadow 0.2s',
    },
    tableCell: {
        padding: '15px 10px',
        textAlign: 'center',
        fontSize: '14px',
        wordBreak: 'break-word',
    },

    // === 移动端卡片列表样式 (临时基础定义) ===
    mobileListItem: {
        marginBottom: '15px',
        padding: '15px',
    },
    mobileTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#007bff',
        marginBottom: '8px',
        textAlign: 'left',
    },
    mobileMetaItem: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        fontSize: '14px',
        color: '#6c757d',
        marginBottom: '5px',
        paddingBottom: '5px',
        borderBottom: '1px dashed #eee',
    },
    mobileActions: {
        display: 'flex',
        gap: '10px',
        marginTop: '10px',
        justifyContent: 'flex-start',
        width: '100%',
    },
};

// ----------------------------------------------------
// 修正错误：在 styles 对象初始化完成后，进行依赖属性的合并
// ----------------------------------------------------
styles.mobileListItem = {
    ...styles.card(false), // 修正：在 styles 对象定义完成后引用 styles.card
    ...styles.mobileListItem
};


// ----------------------------------------------------
// 核心组件：AdminDashboard
// ----------------------------------------------------

function AdminDashboard() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    
    // 状态用于存储视频列表和加载状态
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    
    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

    const [formData, setFormData] = useState({
        id: null,
        htmlName: '',
        category: '',
        title: '',
        videoUrl: '',
        expiryDate: '',
    });

    // ----------------------------------------
    // 数据加载
    // ----------------------------------------
    useEffect(() => {
        loadVideos().then(data => {
            setVideos(data);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, []);

    // ----------------------------------------
    // 业务逻辑函数
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

    const handleEdit = useCallback((video) => {
        if (isReadOnlyMode) return;
        setFormData(video);
    }, []);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        if (isReadOnlyMode) return;

        const { htmlName, category, title, videoUrl } = formData;
        if (!htmlName || !category || !title || !videoUrl) {
            alert('请填写所有必填字段！');
            return;
        }

        if (!Object.values(CATEGORY_MAP).includes(category)) {
            alert(`档期分类代码 ${category} 无效！请使用预设的分类代码。`);
            return;
        }

        const generatedLink = `${BASE_PATH}/player?category=${category}&name=${htmlName}`;

        let updatedVideos;

        if (formData.id) {
            updatedVideos = videos.map(v =>
                v.id === formData.id ? { ...formData, generatedLink } : v
            );
            alert('视频信息已更新！新的 JSON 列表文件已自动下载，请提交 Git。');
        } else {
            const newVideo = {
                ...formData,
                id: uuidv4(),
                generatedLink
            };
            updatedVideos = [...videos, newVideo];
            alert('视频信息已新增！新的 JSON 列表文件已自动下载，请提交 Git。');
        }

        setVideos(updatedVideos);
        downloadJsonFile(updatedVideos);
        resetForm();
        setCurrentPage(1);
    }, [formData, videos, resetForm]);


    const handleDelete = useCallback((id) => {
        if (isReadOnlyMode) return;

        if (window.confirm('确定要删除这条链接吗？\n\n警告：这只会删除列表记录，你需要手动提交最新的 JSON 列表文件！')) {
            const updatedVideos = videos.filter(v => v.id !== id);
            setVideos(updatedVideos);
            downloadJsonFile(updatedVideos);
            alert('✅ 链接已删除！请记得提交最新的 JSON 列表文件到 Git。');
            setCurrentPage(1);
        }
    }, [videos]);

    const handleCopy = useCallback((link) => {
        let fullLink = `${window.location.origin}${link}`;

        navigator.clipboard.writeText(fullLink)
            .then(() => alert(`✅ 链接已复制（${isReadOnlyMode ? '线上' : '本地'}完整链接）：${fullLink}`))
            .catch(err => console.error('复制失败:', err));
    }, [isReadOnlyMode]);


    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleCategoryFilterChange = useCallback((e) => {
        setSelectedCategory(e.target.value);
        setCurrentPage(1);
    }, []);
    
    const handlePageSizeChange = useCallback((e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1);
    }, []);

    const goToPage = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    // ----------------------------------------
    // 数据计算与渲染 (过滤和分页)
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

    // 分页数据计算
    const totalPages = Math.ceil(filteredVideos.length / pageSize);
    const paginatedVideos = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredVideos.slice(startIndex, endIndex);
    }, [filteredVideos, currentPage, pageSize]);

    if (loading) {
        return (
            <div style={{ padding: '50px', textAlign: 'center', fontSize: '20px', fontFamily: FONT_FAMILY }}>
                正在动态加载视频列表数据... 
            </div>
        );
    }


    // 渲染表单
    const renderForm = () => (
        <form onSubmit={handleSubmit} style={styles.card(isReadOnlyMode)}>
            <h3 style={styles.formTitle}>{formData.id ? '编辑视频信息' : '新增视频信息'}</h3>

            <div style={styles.formGrid(isMobile)}>
                <input name="htmlName" value={formData.htmlName} onChange={handleChange} placeholder="HTML Name *" required disabled={isReadOnlyMode} style={styles.input} />

                <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    disabled={isReadOnlyMode}
                    style={styles.input}
                >
                    <option value="" disabled>选择档期分类代码 *</option>
                    {Object.entries(CATEGORY_MAP).map(([label, value]) => (
                        <option key={value} value={value}>{label} ({value})</option>
                    ))}
                </select>

                <input name="title" value={formData.title} onChange={handleChange} placeholder="视频标题 *" required disabled={isReadOnlyMode} style={styles.input} />
                <input name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="视频直链 *" required disabled={isReadOnlyMode} style={styles.input} />
                
                {/* ---------- 修改点 1：更换为 datetime-local 并处理格式转换 ---------- */}
                <input 
                    name="expiryDate" 
                    // 使用辅助函数将内部数据格式转换为 input 所需格式
                    value={formatInternalDateToDatetimeLocal(formData.expiryDate)} 
                    onChange={(e) => {
                        const value = e.target.value; // 格式为 YYYY-MM-DDTHH:MM
                        let newExpiryDate = value;

                        if (value) {
                            // 将 input 值 (YYYY-MM-DDTHH:MM) 转换为内部存储标准格式 (YYYY-MM-DD HH:MM:00)
                            // 此时精确到秒为 00
                            newExpiryDate = value.replace('T', ' ') + ':00'; 
                        } else {
                            // 清空时设置为空字符串
                            newExpiryDate = '';
                        }
                        
                        // 由于是特殊处理，不使用通用的 handleChange，直接调用 setFormData
                        setFormData(prev => ({ ...prev, expiryDate: newExpiryDate }));
                    }}
                    // 修改为 datetime-local 支持日期和时间
                    type="datetime-local" 
                    placeholder="页面有效过期时间 (年-月-日 时:分)" 
                    disabled={isReadOnlyMode} 
                    style={styles.input} 
                />
                {/* ------------------------------------------------------------- */}

            </div>

            {!isReadOnlyMode && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', gap: '10px' }}>
                    <button type="submit" style={{ ...styles.buttonBase, ...(formData.id ? styles.buttonWarning : styles.buttonSuccess) }}>
                        {formData.id ? '更新并下载列表文件 (JSON)' : '新增并下载列表文件 (JSON)'}
                    </button>
                    {formData.id && (
                        <button type="button" onClick={resetForm} style={{ ...styles.buttonBase, ...styles.buttonSecondary }}>
                            取消编辑
                        </button>
                    )}
                </div>
            )}

            {isReadOnlyMode && <p style={{ color: '#dc3545', marginTop: '10px', fontWeight: 'bold' }}>当前为只读模式（上线环境），无法编辑或新增。</p>}
        </form>
    );
    
    // 渲染分页控制组件
    const renderPagination = () => {
        if (totalPages <= 1 && filteredVideos.length === 0) return null;

        const maxButtons = isMobile ? 3 : 5; 
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        const pageButtons = [];
        for (let i = startPage; i <= endPage; i++) {
            pageButtons.push(
                <button
                    key={i}
                    onClick={() => goToPage(i)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        minWidth: '35px',
                        backgroundColor: i === currentPage ? '#007bff' : '#f0f0f0',
                        color: i === currentPage ? 'white' : '#333',
                        fontWeight: i === currentPage ? 600 : 'normal',
                    }}
                >
                    {i}
                </button>
            );
        }

        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '20px', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', color: '#6c757d', marginRight: '10px' }}>
                    共 {filteredVideos.length} 条记录 / 第 {currentPage} 页 / 共 {totalPages} 页
                </span>

                <select onChange={handlePageSizeChange} value={pageSize} style={{ ...styles.input, width: 'auto', padding: '5px 8px', cursor: 'pointer' }}>
                    {PAGE_SIZE_OPTIONS.map(size => (
                        <option key={size} value={size}>{size} 条/页</option>
                    ))}
                </select>

                <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ ...styles.buttonBase, ...styles.buttonSecondary, minWidth: 'auto', padding: '8px 12px' }}>首页</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ ...styles.buttonBase, ...styles.buttonSecondary, minWidth: 'auto', padding: '8px 12px' }}>上一页</button>
                
                {pageButtons}

                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ ...styles.buttonBase, ...styles.buttonSecondary, minWidth: 'auto', padding: '8px 12px' }}>下一页</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ ...styles.buttonBase, ...styles.buttonSecondary, minWidth: 'auto', padding: '8px 12px' }}>尾页</button>
            </div>
        );
    };

    // 移动端卡片列表渲染
    const renderMobileList = () => (
        <div>
            {paginatedVideos.map(video => {
                const isExpired = video.expiryDate && new Date(video.expiryDate) < new Date();
                const categoryLabel = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === video.category) || video.category;
                
                return (
                    <div key={video.id} style={styles.mobileListItem}>
                        <div style={styles.mobileTitle}>
                            {highlightText(video.title, searchTerm)}
                        </div>
                        <div style={styles.mobileMetaItem}>
                            <span><b>分类:</b></span>
                            <span style={{ fontWeight: 600 }}>{categoryLabel}</span>
                        </div>
                        <div style={styles.mobileMetaItem}>
                            <span><b>链接:</b></span>
                            <a href={video.generatedLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none', fontSize: '12px', wordBreak: 'break-all' }}>
                                {video.generatedLink}
                            </a>
                        </div>
                        <div style={{ ...styles.mobileMetaItem, borderBottom: 'none' }}>
                            <span><b>过期时间:</b></span>
                            <span style={{ color: isExpired ? '#dc3545' : '#28a745', fontWeight: 600 }}>
                                {video.expiryDate || '永久'}
                            </span>
                        </div>
                        
                        <div style={styles.mobileActions}>
                            {!isReadOnlyMode && (
                                <>
                                    <button onClick={() => handleEdit(video)} style={styles.buttonAction('#17a2b8')}>编辑</button>
                                    <button onClick={() => handleDelete(video.id)} style={styles.buttonAction('#dc3545')}>删除</button>
                                </>
                            )}
                            <button onClick={() => handleCopy(video.generatedLink)} style={styles.buttonAction('#007bff')}>复制链接</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
    
    // 桌面端表格渲染
    const renderDesktopTable = () => (
        <div style={styles.tableContainer(isMobile)}>
            <table style={styles.table}>
                <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={styles.tableHeader}>视频标题</th>
                        <th style={styles.tableHeader}>链接路由</th>
                        <th style={styles.tableHeader}>档期分类</th>
                        <th style={styles.tableHeader}>过期时间</th>
                        <th style={styles.tableHeader}>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedVideos.map(video => {
                        const isExpired = video.expiryDate && new Date(video.expiryDate) < new Date();
                        const categoryLabel = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === video.category) || video.category;
                        
                        return (
                            <tr key={video.id} style={styles.tableRow}>
                                <td style={styles.tableCell}>
                                    <b>{highlightText(video.title, searchTerm)}</b>
                                </td>
                                <td style={{ ...styles.tableCell, fontSize: '11px' }}>
                                    <a href={video.generatedLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none' }}>{video.generatedLink}</a>
                                </td>
                                <td style={styles.tableCell}>
                                    {categoryLabel}
                                </td>
                                <td style={{ ...styles.tableCell, color: isExpired ? '#dc3545' : '#28a745', fontWeight: 600 }}>
                                    {video.expiryDate || '永久'}
                                </td>
                                <td style={styles.tableCell}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        {!isReadOnlyMode && (
                                            <>
                                                <button onClick={() => handleEdit(video)} style={styles.buttonAction('#17a2b8')}>编辑</button>
                                                <button onClick={() => handleDelete(video.id)} style={styles.buttonAction('#dc3545')}>删除</button>
                                            </>
                                        )}
                                        <button onClick={() => handleCopy(video.generatedLink)} style={styles.buttonAction('#007bff')}>复制</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );


    // 渲染列表
    const renderList = () => (
        <div>
            <h3 style={styles.listHeader}>已生成的链接列表 ({filteredVideos.length} / {videos.length} 条)</h3>

            {/* 搜索过滤区域 */}
            <div style={styles.filterContainer(isMobile)}>
                <select
                    value={selectedCategory}
                    onChange={handleCategoryFilterChange}
                    style={{ ...styles.input, flex: isMobile ? 'none' : '200px', cursor: 'pointer' }}
                >
                    {CATEGORY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>

                <input
                    type="text"
                    placeholder="🔍 搜索视频标题..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    style={{ ...styles.input, flex: '1' }}
                />
            </div>
            
            {/* 根据屏幕宽度选择渲染表格还是卡片列表 */}
            {paginatedVideos.length > 0 ? (isMobile ? renderMobileList() : renderDesktopTable()) : (
                <p style={{ textAlign: 'center', marginTop: '20px', color: '#6c757d' }}>
                    {searchTerm || selectedCategory ? `未找到匹配结果。` : '当前列表为空。'}
                </p>
            )}
            
            {/* 分页组件 */}
            {renderPagination()}
        </div>
    );

    return (
        <div style={styles.pageContainer}>
            <div style={styles.header}>
                <h1 style={styles.headerTitle}>
                    视频管理后台 <span style={styles.headerSubtitle}>({isReadOnlyMode ? '上线只读模式' : '本地开发模式'})</span>
                </h1>
                <button onClick={handleLogout} style={{ ...styles.buttonBase, ...styles.buttonDanger }}>
                    退出登录
                </button>
            </div>

            {renderForm()}
            {renderList()}

            <div style={{ marginTop: '50px', padding: '15px', borderLeft: '3px solid #007bff', backgroundColor: '#e9f7ff', color: '#333', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                <b>分类代码列表: </b>请确保新增/编辑时使用以下编号：
                <ul style={{ paddingLeft: '20px', marginTop: '5px', fontSize: '14px' }}>
                    {Object.entries(CATEGORY_MAP).map(([label, value]) => (
                        <li key={value}>{label} 对应代码: <b>{value}</b></li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default AdminDashboard;