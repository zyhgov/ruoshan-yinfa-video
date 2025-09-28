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

// ----------------------------------------------------
// 辅助函数：数据读写（基于 JSON 文件）
// ----------------------------------------------------

// 异步加载视频列表数据
const loadVideos = async () => {
    // 尝试从项目根目录的 video_list.json 加载数据
    try {
        const response = await fetch('/video_list.json');

        // 如果文件不存在或加载失败 (如第一次运行)，返回空数组
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

// 触发 JSON 文件下载（用于保存数据）
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

        👉 **重要！请手动操作：**
        1. 将下载的 \`${fileName}\` **移动到您 Git 仓库的根目录下**。
        2. 将此文件与您的代码一起提交并推送到 GitHub！
    `);
};

/**
 * 搜索关键词高亮辅助函数
 * @param {string} text 原始文本
 * @param {string} highlight 关键词
 * @returns {JSX.Element} 带有 <mark> 标签的 React 元素
 */
const highlightText = (text, highlight) => {
    if (!highlight) {
        return text;
    }
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <>
            {parts.map((part, index) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <mark key={index} style={{ backgroundColor: '#ffcc00', padding: '0 2px', borderRadius: '2px' }}>
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
};


// ----------------------------------------------------
// 核心组件：AdminDashboard
// ----------------------------------------------------

function AdminDashboard() {
    const navigate = useNavigate();
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

    // 使用 useEffect 钩子在组件加载时异步获取数据
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

    // **原 downloadHtmlFile 函数已删除**

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

        // 修改生成的链接：指向一个通用播放器路由，并使用查询参数传递信息
        // 假设通用播放器路由为 /player，并传入 category 和 name 作为参数
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

        // 1. 更新状态
        setVideos(updatedVideos);

        // **2. 移除自动下载 HTML 文件的逻辑**

        // 3. 自动下载最新的 JSON 列表文件 (核心数据保存逻辑)
        downloadJsonFile(updatedVideos);

        // 4. 重置表单并回到第一页
        resetForm();
        setCurrentPage(1);
    }, [formData, videos, resetForm]);


    const handleDelete = useCallback((id) => {
        if (isReadOnlyMode) return;

        if (window.confirm('确定要删除这条链接吗？\n\n警告：这只会删除列表记录，你需要手动提交最新的 JSON 列表文件！')) {
            const updatedVideos = videos.filter(v => v.id !== id);
            setVideos(updatedVideos);

            // 自动下载最新的 JSON 列表文件
            downloadJsonFile(updatedVideos);

            alert('✅ 链接已删除！请记得提交最新的 JSON 列表文件到 Git。');
            // 删除后重置到第一页，防止当前页为空
            setCurrentPage(1);
        }
    }, [videos]);

    const handleCopy = useCallback((link) => {
        // 由于链接已修改为通用模板路由，这里不再拼接 '/video/${category}/${htmlName}.html'
        // 而是直接使用生成的通用路由链接
        let fullLink = `${window.location.origin}${link}`;

        navigator.clipboard.writeText(fullLink)
            .then(() => alert(`✅ 链接已复制（${isReadOnlyMode ? '线上' : '本地'}完整链接）：${fullLink}`))
            .catch(err => console.error('复制失败:', err));
    }, [isReadOnlyMode]);


    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // 搜索时重置到第一页
    }, []);

    const handleCategoryFilterChange = useCallback((e) => {
        setSelectedCategory(e.target.value);
        setCurrentPage(1); // 筛选时重置到第一页
    }, []);
    
    const handlePageSizeChange = useCallback((e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1); // 改变每页大小时重置到第一页
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
            <div style={{ padding: '50px', textAlign: 'center', fontSize: '20px' }}>
                正在加载视频列表数据... 请确保项目根目录有 video_list.json 文件。
            </div>
        );
    }


    // 渲染表单 (样式代码省略，保持不变)
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
                <input name="htmlName" value={formData.htmlName} onChange={handleChange} placeholder="HTML Name" required disabled={isReadOnlyMode} style={inputStyle} />

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
                <input name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="视频直链" required disabled={isReadOnlyMode} style={inputStyle} />
                <input name="expiryDate" value={formData.expiryDate} onChange={handleChange} type="date" placeholder="页面有效过期时间" disabled={isReadOnlyMode} style={inputStyle} />
            </div>

            {!isReadOnlyMode && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                    <button type="submit" style={{ ...buttonStyle, backgroundColor: formData.id ? '#ffc107' : '#28a745' }}>
                        {formData.id ? '更新并下载列表文件 (JSON)' : '新增并下载列表文件 (JSON)'}
                    </button>
                    {formData.id && (
                        <button type="button" onClick={resetForm} style={{ ...buttonStyle, backgroundColor: '#6c757d', marginLeft: '10px' }}>
                            取消编辑
                        </button>
                    )}
                </div>
            )}

            {isReadOnlyMode && <p style={{ color: '#dc3545', marginTop: '10px', fontWeight: 'bold' }}>当前为只读模式（上线环境），无法编辑或新增。编辑操作请联系运维小张。</p>}
        </form>
    );
    
    // 渲染分页控制组件
    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const maxButtons = 5;
        const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        const endPage = Math.min(totalPages, startPage + maxButtons - 1);

        const pageButtons = [];
        for (let i = startPage; i <= endPage; i++) {
            pageButtons.push(
                <button
                    key={i}
                    onClick={() => goToPage(i)}
                    style={{
                        ...pageButtonStyle,
                        backgroundColor: i === currentPage ? '#007bff' : '#f0f0f0',
                        color: i === currentPage ? 'white' : '#333',
                    }}
                >
                    {i}
                </button>
            );
        }

        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '20px', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6c757d', marginRight: '10px' }}>
                    共 {filteredVideos.length} 条记录 / 第 {currentPage} 页 / 共 {totalPages} 页
                </span>

                <select onChange={handlePageSizeChange} value={pageSize} style={{ ...inputStyle, width: 'auto', padding: '5px 8px', cursor: 'pointer' }}>
                    {PAGE_SIZE_OPTIONS.map(size => (
                        <option key={size} value={size}>{size} 条/页</option>
                    ))}
                </select>

                <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={pageNavButtonStyle}>首页</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={pageNavButtonStyle}>上一页</button>
                
                {pageButtons}

                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={pageNavButtonStyle}>下一页</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={pageNavButtonStyle}>尾页</button>
            </div>
        );
    };


    // 渲染列表 (样式代码省略，保持不变)
    const renderList = () => (
        <div>
            <h3 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px', color: '#333' }}>已生成的链接列表 ({filteredVideos.length} / {videos.length} 条)</h3>

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
                        <th style={tableHeaderStyle}>链接 (通用播放器路由)</th>
                        <th style={tableHeaderStyle}>档期分类</th>
                        <th style={tableHeaderStyle}>过期时间</th>
                        <th style={tableHeaderStyle}>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedVideos.map(video => (
                        <tr key={video.id} style={{ backgroundColor: '#fff', borderBottom: '1px solid #eee', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                            <td style={tableCellStyle}>
                                {highlightText(video.title, searchTerm)}
                            </td>
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
            
            {paginatedVideos.length === 0 && (
                <p style={{ textAlign: 'center', marginTop: '20px', color: '#6c757d' }}>
                    {searchTerm || selectedCategory ? `未找到匹配结果。` : '当前列表为空。'}
                </p>
            )}
            
            {/* 分页组件 */}
            {renderPagination()}
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
        width: '100%',
        minWidth: '50px'
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
    
    const pageButtonStyle = {
        padding: '8px 12px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        minWidth: '35px',
    };

    const pageNavButtonStyle = {
        ...pageButtonStyle,
        backgroundColor: '#f0f0f0',
        color: '#333',
        border: '1px solid #ccc',
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#f4f7f9', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                <h1 style={{ color: '#333' }}>视频管理后台 <span style={{ fontSize: '16px', fontWeight: 'normal', color: '#6c757d' }}>({isReadOnlyMode ? '上线只读模式' : '本地开发模式'})</span></h1>
                <button onClick={handleLogout} style={{ ...buttonStyle, backgroundColor: '#dc3545' }}>
                    退出登录
                </button>
            </div>

            {renderForm()}
            {renderList()}

            <p style={{ marginTop: '50px', padding: '15px', borderLeft: '3px solid #007bff', backgroundColor: '#e9f7ff', color: '#333' }}>
                <b>分类代码列表: </b>请确保新增/编辑时使用以下编号：
                <ul style={{ paddingLeft: '20px', marginTop: '5px', fontSize: '14px' }}>
                    {Object.entries(CATEGORY_MAP).map(([label, value]) => (
                        <li key={value}>{label} 对应代码: <b>{value}</b></li>
                    ))}
                </ul>
            </p>
        </div>
    );
}
export default AdminDashboard;