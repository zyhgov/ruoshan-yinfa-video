import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// -------------------------------------------------------------------------
// 核心配置与常量
// -------------------------------------------------------------------------
const BASE_PATH = '';
const CLOUDFLARE_VIDEO_LIST_URL = 'https://rsa.zyhorg.cn/video_list.json';
const CATEGORY_MAP = {
    "第1频道": "bsjkb",
    "第2频道": "ddry",
    "第3频道": "fwdj",
    "第4频道": "gybnx",
    "第5频道": "msmk",
    "第6频道": "qjqf",
};
const CATEGORY_OPTIONS = [
    { label: "所有分类", value: "" },
    ...Object.entries(CATEGORY_MAP).map(([label, value]) => ({ label, value }))
];
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const FONT_FAMILY = 'MiSans-Semibold';

// 🆕 短信发送辅助函数
const SMS_UTILS = {
    // 检测是否为移动设备
    isMobileDevice: () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    
    // 检测是否为iOS
    isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
    
    // 检测链接是否包含 & 符号（可能被截断）
    hasAmpersand: (text) => text.includes('&'),
    
    // 智能编码短信内容
    encodeMessage: (message) => {
        // 方案1: 使用换行符分隔参数（某些设备支持）
        const messageWithLineBreaks = message.replace(/&/g, '\n&');
        
        // 方案2: 双重URL编码
        const doubleEncoded = encodeURIComponent(message);
        
        // 方案3: 替换 & 为全角符号（用户可以看到完整链接，但不可点击）
        const messageWithFullwidth = message.replace(/&/g, '＆');
        
        return {
            original: message,
            lineBreaks: messageWithLineBreaks,
            doubleEncoded: doubleEncoded,
            fullwidth: messageWithFullwidth
        };
    },
    
    // 生成SMS URI
    buildSmsUri: (phone, message, useDoubleEncode = true) => {
        const isIOS = SMS_UTILS.isIOS();
        const separator = isIOS ? '&' : '?';
        
        // 使用双重编码策略
        let encodedMessage = encodeURIComponent(message);
        
        // iOS 需要额外处理
        if (useDoubleEncode && isIOS) {
            encodedMessage = encodeURIComponent(encodedMessage);
        }
        
        return `sms:${phone}${separator}body=${encodedMessage}`;
    },
    
    // 复制到剪贴板
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            return false;
        }
    },
    
    // 生成用户友好的短信预览
    generatePreview: (message, maxLength = 200) => {
        if (message.length <= maxLength) {
            return message;
        }
        return message.substring(0, maxLength) + '...\n\n[内容较长，已省略]';
    }
};

// ----------------------------------------------------
// 辅助函数：数据读写（基于 JSON 文件）
// ----------------------------------------------------
const loadVideos = async () => {
    try {
        const response = await fetch(CLOUDFLARE_VIDEO_LIST_URL);
        if (!response.ok) {
            console.error(`❌ 加载 ${CLOUDFLARE_VIDEO_LIST_URL} 失败。状态码: ${response.status}。`);
            console.warn("请检查您的 Cloudflare Objects/Pages 是否为该文件设置了正确的 CORS (Access-Control-Allow-Origin: *) 响应头。");
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("加载视频列表数据失败:", error);
        return [];
    }
};

const uploadJsonToR2 = async (data) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const fileName = 'video_list.json';
    try {
        const response = await fetch('/api/upload-json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: jsonContent
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`API Upload Failed: ${response.status} - ${errorBody.message || 'Unknown Server Error'}`);
        }
        alert(`✅ ${fileName} 已通过 Pages Function 自动上传到 Cloudflare R2！`);
        return true;
    } catch (error) {
        console.error('❌ 自动上传失败，回退到浏览器下载:', error);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert(`
            📢 自动上传失败，已回退到下载：${fileName}。
            👉 错误信息: ${error.message}
            👉 重要！请手动上传文件到 Cloudflare R2 存储桶，覆盖原文件。
        `);
        return false;
    }
};

const highlightText = (text, highlight) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span key={`highlight-${text}`}>
            {parts.map((part, index) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <mark key={index} style={{ backgroundColor: '#ffcc00', padding: '0 2px', borderRadius: '2px' }}>
                        {part}
                    </mark>
                ) : part
            )}
        </span>
    );
};

const formatInternalDateToDatetimeLocal = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split(' ');
    const datePart = parts[0];
    if (parts.length === 1) {
        return `${datePart}T00:00`;
    }
    const timePart = parts[1];
    if (timePart) {
        const timeMinutes = timePart.substring(0, 5);
        return `${datePart}T${timeMinutes}`;
    }
    return '';
};

const useIsMobile = (maxWidth = 768) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= maxWidth);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= maxWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [maxWidth]);
    return isMobile;
};

const styles = {
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
    logoWrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
    },
    logo: {
        height: '45px',
        width: 'auto',
        objectFit: 'contain',
        flexShrink: 0,
    },
    headerSubtitle: {
        fontSize: '16px',
        fontWeight: 'normal',
        color: '#6c757d',
    },
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
        minWidth: '800px',
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
        flexWrap: 'wrap',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.3)',
    },
    modalCloseButton: {
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'none',
        border: 'none',
        fontSize: '28px',
        cursor: 'pointer',
        color: '#6c757d',
        lineHeight: '1',
        fontWeight: 'lighter',
        transition: 'color 0.2s',
    }
};

styles.mobileListItem = {
    ...styles.card(false), 
    ...styles.mobileListItem
};

// ----------------------------------------------------
// 核心组件：AdminDashboard
// ----------------------------------------------------
function AdminDashboard() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [isReadOnlyMode, setIsReadOnlyMode] = useState(true);

    useEffect(() => {
        const checkPermission = () => {
            const hasEdit = localStorage.getItem('hasEditPermission') === 'true';
            setIsReadOnlyMode(!hasEdit);
        };
        checkPermission();
        window.addEventListener('storage', checkPermission);
        return () => window.removeEventListener('storage', checkPermission);
    }, []);

    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedVideoIds, setSelectedVideoIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const [formData, setFormData] = useState({
        id: null,
        htmlName: '',
        category: '',
        title: '',
        videoUrl: '',
        expiryDate: '',
        remarks: '',
    });
    const [batchInput, setBatchInput] = useState('');
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [showComplianceNotice, setShowComplianceNotice] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    
    // 🆕 短信功能相关状态（增强版）
    const [smsModalOpen, setSmsModalOpen] = useState(false);
    const [smsTarget, setSmsTarget] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [batchSmsModalOpen, setBatchSmsModalOpen] = useState(false);
    const [batchPhones, setBatchPhones] = useState('');
    const [showSmsPreview, setShowSmsPreview] = useState(false);
    const [smsPreviewData, setSmsPreviewData] = useState(null);

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

    const totalPages = Math.ceil(filteredVideos.length / pageSize);
    const paginatedVideos = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredVideos.slice(startIndex, endIndex);
    }, [filteredVideos, currentPage, pageSize]);

    const isAllSelected = paginatedVideos.length > 0 && paginatedVideos.every(v => selectedVideoIds.includes(v.id));

    useEffect(() => {
        loadVideos().then(data => {
            setVideos(data);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        const hasSeenNotice = localStorage.getItem('complianceNoticeSeen');
        if (!hasSeenNotice) {
            setShowComplianceNotice(true);
        }
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('hasEditPermission');
        navigate('/admin', { replace: true });
    }, [navigate]);

    const resetForm = useCallback(() => {
        setFormData({
            id: null, htmlName: '', category: '', title: '', videoUrl: '', expiryDate: '', remarks: '',
        });
    }, []);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const openBatchModal = useCallback(() => {
        if (!isReadOnlyMode) {
            setIsBatchModalOpen(true);
        }
    }, [isReadOnlyMode]);

    const closeBatchModal = useCallback(() => {
        setBatchInput('');
        setIsBatchModalOpen(false);
    }, []);

    const handleSelectVideo = useCallback((id) => {
        setSelectedVideoIds(prev =>
            prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
        );
    }, []);

    const handleSelectAll = useCallback((checked) => {
        const currentPageIds = paginatedVideos.map(v => v.id);
        setSelectedVideoIds(prev => {
            if (checked) {
                const newIds = new Set([...prev, ...currentPageIds]);
                return Array.from(newIds);
            } else {
                return prev.filter(id => !currentPageIds.includes(id));
            }
        });
    }, [paginatedVideos]);

    const handleEdit = useCallback((video) => {
        if (isReadOnlyMode) return;
        setEditingVideo(video);
        setEditModalOpen(true);
    }, [isReadOnlyMode]);

    const handleEditChange = useCallback((e) => {
        const { name, value } = e.target;
        setEditingVideo(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleExpiryDateChangeForEdit = useCallback((e) => {
        const value = e.target.value;
        let newExpiryDate = '';
        if (value) {
            newExpiryDate = value.replace('T', ' ') + ':00';
        }
        setEditingVideo(prev => ({ ...prev, expiryDate: newExpiryDate }));
    }, []);

    const handleEditSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (isReadOnlyMode || !editingVideo) return;

        const { htmlName, category, title, videoUrl } = editingVideo;
        if (!htmlName || !category || !title || !videoUrl) {
            alert('请填写所有必填字段！');
            return;
        }
        if (!Object.values(CATEGORY_MAP).includes(category)) {
            alert(`档期分类代码 ${category} 无效！请使用预设的分类代码。`);
            return;
        }

        const generatedLink = `${BASE_PATH}/player?category=${category}&name=${htmlName}`;
        const updatedVideo = { ...editingVideo, generatedLink };
        const updatedVideos = videos.map(v => (v.id === updatedVideo.id ? updatedVideo : v));
        setVideos(updatedVideos);

        await uploadJsonToR2(updatedVideos);
        alert('✅ 视频信息已更新并自动上传到 Cloudflare R2！');
        setEditModalOpen(false);
        setEditingVideo(null);
    }, [editingVideo, videos, isReadOnlyMode]);

    const handleSubmit = useCallback(async (e) => {
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
            alert('视频信息已更新！正在自动上传新的数据列表文件至 Cloudflare R2 对象存储');
        } else {
            const newVideo = {
                ...formData,
                id: uuidv4(),
                generatedLink
            };
            updatedVideos = [...videos, newVideo];
            alert('视频信息已新增！正在自动上传新的数据列表文件至 Cloudflare R2 对象存储');
        }
        setVideos(updatedVideos);
        await uploadJsonToR2(updatedVideos);
        resetForm();
        setCurrentPage(1);
    }, [formData, videos, resetForm, isReadOnlyMode]);

    const handleDelete = useCallback(async (id) => {
        if (isReadOnlyMode) return;
        if (window.confirm('确定要删除这条链接吗？\n警告：删除后将自动上传最新的数据列表文件到 Cloudflare R2！')) {
            const updatedVideos = videos.filter(v => v.id !== id);
            setVideos(updatedVideos);
            await uploadJsonToR2(updatedVideos);
            alert('✅ 链接已删除！最新的数据列表文件到 Cloudflare R2。');
            setCurrentPage(1);
        }
    }, [videos, isReadOnlyMode]);

    const handleBatchSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (isReadOnlyMode) return;
        if (!batchInput.trim()) {
            alert('请输入批量数据！');
            return;
        }
        const lines = batchInput.trim().split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
            alert('请输入有效的数据行！');
            return;
        }
        const newVideos = [];
        const errors = [];
        const categoryValues = Object.values(CATEGORY_MAP);
        lines.forEach((line, index) => {
            const parts = line.split('|').map(part => part.trim());
            if (parts.length < 4) {
                errors.push(`第 ${index + 1} 行数据格式错误 (至少需要 4 个字段)。`);
                return;
            }
            const [htmlName, category, title, videoUrl, expiryDateInput = '', remarks = ''] = parts;
            if (!htmlName || !category || !title || !videoUrl) {
                errors.push(`第 ${index + 1} 行有必填字段为空。`);
                return;
            }
            if (!categoryValues.includes(category)) {
                errors.push(`第 ${index + 1} 行的档期分类代码 ${category} 无效！`);
                return;
            }
            const generatedLink = `${BASE_PATH}/player?category=${category}&name=${htmlName}`;
            let formattedExpiryDate = expiryDateInput.replace('T', ' ').substring(0, 16);
            if (formattedExpiryDate && formattedExpiryDate.length === 16 && formattedExpiryDate.includes(' ')) {
                formattedExpiryDate = formattedExpiryDate + ':00';
            } else {
                formattedExpiryDate = '';
            }
            newVideos.push({
                id: uuidv4(),
                htmlName,
                category,
                title,
                videoUrl,
                expiryDate: formattedExpiryDate,
                remarks,
                generatedLink,
            });
        });
        if (errors.length > 0) {
            alert('批量新增失败，请检查以下错误：\n' + errors.join('\n'));
            return;
        }
        const updatedVideos = [...videos, ...newVideos];
        setVideos(updatedVideos);
        setBatchInput('');
        await uploadJsonToR2(updatedVideos);
        alert(`✅ 成功新增 ${newVideos.length} 条视频记录！最新的数据列表文件已自动上传到 Cloudflare R2。`);
        resetForm();
        setCurrentPage(1);
        closeBatchModal();
    }, [batchInput, videos, resetForm, closeBatchModal, isReadOnlyMode]);

    const handleCopy = useCallback((video) => {
        const fullLink = `${window.location.origin}${video.generatedLink}`;
        const expiry = video.expiryDate || '永久';
        const remarks = video.remarks || '无备注';
        const copyText = `${video.title}
    链接: ${fullLink}
    过期时间: ${expiry}
    备注: ${remarks}`;
        const alertMessage = `✅ ${video.title} 的完整信息已复制！`;
        navigator.clipboard.writeText(copyText)
            .then(() => alert(alertMessage))
            .catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请确保在 HTTPS 或 localhost 环境下操作。');
            });
    }, []);

    const handleBatchCopy = useCallback(() => {
        if (selectedVideoIds.length === 0) {
            alert('请先勾选需要复制的视频！');
            return;
        }
        const selectedVideosData = videos.filter(v => selectedVideoIds.includes(v.id));
        const baseUrl = window.location.origin;
        const copyText = selectedVideosData
            .map(video => {
                const fullLink = `${baseUrl}${video.generatedLink}`;
                const expiry = video.expiryDate || '永久';
                const remarks = video.remarks || '无备注';
                return `${video.title}
        链接: ${fullLink}
        过期时间: ${expiry}
        备注: ${remarks}`;
            })
            .join('\n\n');
        navigator.clipboard.writeText(copyText)
            .then(() => {
                alert(`✅ 成功批量复制 ${selectedVideosData.length} 条链接！\n内容已复制到剪贴板，格式为：\n[视频标题]\n[完整链接]\n...`);
                setSelectedVideoIds([]);
            })
            .catch(err => {
                console.error('批量复制失败:', err);
                alert('批量复制失败，请确保您在安全环境（HTTPS/localhost）下操作并授予了剪贴板权限。');
            });
    }, [selectedVideoIds, videos]);

    // 🆕 打开单条发送模态框（增强版）
    const handleOpenSmsModal = useCallback((video) => {
        setSmsTarget(video);
        setPhoneNumber('');
        const fullLink = `${window.location.origin}/player?category=${video.category}&name=${video.htmlName}`;
        const expiry = video.expiryDate || '永久';
        const defaultMsg = `【RSV视频】${video.title}\n链接: ${fullLink}\n有效期: ${expiry}${video.remarks ? `\n备注: ${video.remarks}` : ''}`;
        setCustomMessage(defaultMsg);
        setSmsModalOpen(true);
    }, []);

    // 🆕 打开批量发送模态框
    const handleOpenBatchSmsModal = useCallback(() => {
        if (selectedVideoIds.length === 0) {
            alert('请先勾选要发送的视频！');
            return;
        }
        setBatchPhones('');
        setBatchSmsModalOpen(true);
    }, [selectedVideoIds]);

    // 🆕 单条发送短信（健壮版本）
    const handleSendSms = useCallback(() => {
        if (!phoneNumber) {
            alert('请输入手机号！');
            return;
        }
        
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phoneNumber)) {
            alert('请输入有效的11位手机号！');
            return;
        }
        
        if (!customMessage.trim()) {
            alert('短信内容不能为空！');
            return;
        }
        
        const isMobileDevice = SMS_UTILS.isMobileDevice();
        const hasAmpersand = SMS_UTILS.hasAmpersand(customMessage);
        
        // 桌面端：直接复制
        if (!isMobileDevice) {
            SMS_UTILS.copyToClipboard(customMessage)
                .then(() => {
                    alert(`✅ 短信内容已复制到剪贴板！\n\n请在手机上打开短信应用，发送到 ${phoneNumber}，粘贴内容后手动发送。\n\n━━━━━━━━━━━━━━━━\n${SMS_UTILS.generatePreview(customMessage)}`);
                })
                .catch(() => {
                    alert(`⚠️ 请复制以下内容到手机短信应用发送到 ${phoneNumber}：\n\n━━━━━━━━━━━━━━━━\n${customMessage}`);
                });
            setSmsModalOpen(false);
            setPhoneNumber('');
            setSmsTarget(null);
            setCustomMessage('');
            return;
        }
        
        // 移动端：显示预览确认
        setSmsPreviewData({
            phone: phoneNumber,
            message: customMessage,
            hasAmpersand: hasAmpersand
        });
        setShowSmsPreview(true);
        
    }, [phoneNumber, customMessage]);

    // 🆕 确认发送短信（多重策略）
    const handleConfirmSendSms = useCallback(async (strategy = 'auto') => {
        if (!smsPreviewData) return;
        
        const { phone, message, hasAmpersand } = smsPreviewData;
        
        // 策略1: 智能兜底 - 先复制再跳转
        if (strategy === 'auto' && hasAmpersand) {
            const copied = await SMS_UTILS.copyToClipboard(message);
            
            if (copied) {
                alert(`✅ 检测到链接包含特殊字符，已自动复制完整内容到剪贴板！\n\n即将打开短信应用，如果内容不完整，请从剪贴板粘贴。\n\n📋 已复制内容预览：\n${SMS_UTILS.generatePreview(message)}`);
            }
        }
        
        // 策略2: 尝试打开短信应用
        try {
            const smsUri = SMS_UTILS.buildSmsUri(phone, message, false);
            window.location.href = smsUri;
            
            // 延迟关闭和提示
            setTimeout(() => {
                let tipMessage = '✅ 已打开系统短信应用\n\n';
                
                if (hasAmpersand) {
                    tipMessage += `⚠️ 重要提示：\n您的链接包含 "&" 符号，部分设备可能会截断。\n\n请务必检查短信中的链接是否完整：\n应包含 "category=xxx&name=xxx"\n\n如果被截断，请点击【从剪贴板粘贴】按钮手动粘贴完整内容。\n\n`;
                }
                
                tipMessage += '💡 短信费用将从您的手机话费中扣除（约0.1元/条）。';
                
                alert(tipMessage);
                setShowSmsPreview(false);
                setSmsModalOpen(false);
                setPhoneNumber('');
                setSmsTarget(null);
                setCustomMessage('');
                setSmsPreviewData(null);
            }, 1000);
            
        } catch (error) {
            console.error('打开短信应用失败:', error);
            alert(`❌ 无法打开短信应用\n\n内容已复制到剪贴板，请手动打开短信应用粘贴发送。`);
            await SMS_UTILS.copyToClipboard(message);
        }
        
    }, [smsPreviewData]);

    // 🆕 仅复制不跳转
    const handleCopyOnly = useCallback(async () => {
        if (!smsPreviewData) return;
        
        const { message } = smsPreviewData;
        const copied = await SMS_UTILS.copyToClipboard(message);
        
        if (copied) {
            alert(`✅ 完整短信内容已复制到剪贴板！\n\n请手动打开短信应用，选择收件人后粘贴发送。\n\n📋 内容预览：\n${SMS_UTILS.generatePreview(message)}`);
            setShowSmsPreview(false);
            setSmsModalOpen(false);
            setPhoneNumber('');
            setSmsTarget(null);
            setCustomMessage('');
            setSmsPreviewData(null);
        } else {
            alert('❌ 复制失败，请手动复制以下内容：\n\n' + message);
        }
        
    }, [smsPreviewData]);

    // 🆕 批量发送短信（健壮版本）
    const handleBatchSendSms = useCallback(async () => {
        if (!batchPhones.trim()) {
            alert('请输入至少一个手机号！');
            return;
        }
        
        if (selectedVideoIds.length === 0) {
            alert('请先勾选要发送的视频！');
            return;
        }
        
        // 解析手机号
        const phones = batchPhones
            .split(/[,，\s\n]+/)
            .map(p => p.trim())
            .filter(p => p);
        
        const phoneRegex = /^1[3-9]\d{9}$/;
        const invalidPhones = phones.filter(p => !phoneRegex.test(p));
        
        if (invalidPhones.length > 0) {
            alert(`以下手机号格式错误：\n${invalidPhones.join('\n')}`);
            return;
        }
        
        if (phones.length === 0) {
            alert('未检测到有效的手机号！');
            return;
        }
        
        // 获取选中的视频
        const selectedVideos = videos.filter(v => selectedVideoIds.includes(v.id));
        
        // 构建消息内容
        const baseUrl = window.location.origin;
        const messages = selectedVideos.map(video => {
            const fullLink = `${baseUrl}/player?category=${video.category}&name=${video.htmlName}`;
            const expiry = video.expiryDate || '永久';
            return `【RSV视频】${video.title}\n链接: ${fullLink}\n有效期: ${expiry}${video.remarks ? `\n备注: ${video.remarks}` : ''}`;
        }).join('\n\n━━━━━━━━━━━━━━\n\n');
        
        const isMobileDevice = SMS_UTILS.isMobileDevice();
        
        // 桌面端：复制全部内容
        if (!isMobileDevice) {
            const allContent = phones.map(phone => `📱 发送到: ${phone}\n${messages}`).join('\n\n═══════════════════\n\n');
            const copied = await SMS_UTILS.copyToClipboard(allContent);
            
            if (copied) {
                alert(`✅ 批量内容已复制到剪贴板！\n\n将向 ${phones.length} 个号码发送 ${selectedVideos.length} 条视频信息。\n\n请在手机上手动发送。\n\n目标号码：\n${phones.join('\n')}`);
            } else {
                alert(`⚠️ 将向以下 ${phones.length} 个号码发送信息：\n${phones.join('\n')}\n\n请在手机上手动操作。`);
            }
            setBatchSmsModalOpen(false);
            setBatchPhones('');
            return;
        }
        
        // 移动端：先复制完整内容作为兜底
        await SMS_UTILS.copyToClipboard(messages);
        
        // 警告用户需要逐条发送
        const confirmMsg = `⚠️ 批量发送说明\n\n将向 ${phones.length} 个号码发送 ${selectedVideos.length} 条视频信息。\n\n✅ 完整内容已复制到剪贴板作为备份\n\n📱 系统会逐个打开短信应用，每次需要您手动点击"发送"。\n\n⚠️ 如果短信内容不完整，请从剪贴板粘贴\n\n预计操作 ${phones.length} 次\n\n确认继续吗？`;
        
        if (!window.confirm(confirmMsg)) {
            return;
        }
        
        // 逐条发送
        let currentIndex = 0;
        
        const sendNext = () => {
            if (currentIndex >= phones.length) {
                alert(`✅ 已完成所有 ${phones.length} 条短信的准备工作！\n\n💡 提示：完整内容仍在剪贴板中，可随时粘贴使用。`);
                setBatchSmsModalOpen(false);
                setBatchPhones('');
                setSelectedVideoIds([]);
                return;
            }
            
            const phone = phones[currentIndex];
            const smsUri = SMS_UTILS.buildSmsUri(phone, messages, false);
            
            try {
                window.location.href = smsUri;
            } catch (error) {
                console.error('打开短信应用失败:', error);
            }
            
            currentIndex++;
            
            if (currentIndex < phones.length) {
                setTimeout(() => {
                    const continueMsg = `已准备第 ${currentIndex}/${phones.length} 条短信\n\n发送到: ${phones[currentIndex - 1]}\n\n💡 如内容不完整，请从剪贴板粘贴\n\n点击确定继续准备下一条`;
                    if (window.confirm(continueMsg)) {
                        sendNext();
                    } else {
                        alert(`已取消批量发送。\n\n已准备 ${currentIndex} 条短信，剩余 ${phones.length - currentIndex} 条未处理。\n\n💡 完整内容仍在剪贴板中。`);
                        setBatchSmsModalOpen(false);
                    }
                }, 1500);
            } else {
                setTimeout(() => {
                    alert(`✅ 已完成所有 ${phones.length} 条短信的准备工作！\n\n请在短信应用中逐条检查并发送。`);
                    setBatchSmsModalOpen(false);
                    setBatchPhones('');
                    setSelectedVideoIds([]);
                }, 1000);
            }
        };
        
        sendNext();
        
    }, [batchPhones, selectedVideoIds, videos]);

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

    if (loading) {
        return (
            <div style={{ padding: '50px', textAlign: 'center', fontSize: '20px', fontFamily: FONT_FAMILY }}>
                正在动态加载视频列表数据... 
            </div>
        );
    }

    const renderForm = () => (
        <form onSubmit={handleSubmit} style={styles.card(isReadOnlyMode)}>
            <h3 style={styles.formTitle}>{formData.id ? '编辑视频信息' : '新增视频信息 (单条)'}</h3>
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
                <input 
                    name="expiryDate" 
                    value={formatInternalDateToDatetimeLocal(formData.expiryDate)} 
                    onChange={(e) => {
                        const value = e.target.value;
                        let newExpiryDate = value ? value.replace('T', ' ') + ':00' : '';
                        setFormData(prev => ({ ...prev, expiryDate: newExpiryDate }));
                    }}
                    type="datetime-local" 
                    placeholder="页面有效过期时间 (年-月-日 时:分)" 
                    disabled={isReadOnlyMode} 
                    style={styles.input} 
                />
                <input 
                    name="remarks" 
                    value={formData.remarks} 
                    onChange={handleChange} 
                    placeholder="备注（选填）" 
                    disabled={isReadOnlyMode} 
                    style={styles.input} 
                />
            </div>
            {!isReadOnlyMode && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="submit" style={{ ...styles.buttonBase, ...(formData.id ? styles.buttonWarning : styles.buttonSuccess) }}>
                        {formData.id ? '更新并自动上传列表文件 (JSON)' : '新增并自动上传列表文件 (JSON)'}
                    </button>
                    <button 
                        type="button" 
                        onClick={openBatchModal} 
                        style={{ ...styles.buttonBase, backgroundColor: '#20c997' }}
                    >
                        批量新增/导入 (Batch Import)
                    </button>
                    {formData.id && (
                        <button type="button" onClick={resetForm} style={{ ...styles.buttonBase, ...styles.buttonSecondary }}>
                            取消编辑
                        </button>
                    )}
                </div>
            )}
            {isReadOnlyMode && 
            <p style={{ color: '#dc3545', marginTop: '10px', fontWeight: 'bold' }}>当前为只读模式，无法编辑或新增。</p>}
        </form>
    );

    const renderBatchModal = () => {
        if (!isBatchModalOpen) return null;
        return (
            <div style={styles.modalOverlay} onClick={closeBatchModal}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={closeBatchModal}>&times;</button>
                    <h3 style={{ ...styles.formTitle, borderBottom: '2px solid #20c997', marginBottom: '15px' }}>
                        批量新增/导入 (Batch Import)
                    </h3>
                    <p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '14px' }}>
                        将多条视频数据粘贴到下方，每行一条记录，字段间用英文竖线 `|` 管道符号分隔。字段顺序是：
                        <br />
                        HTML Name | 分类代码 | 视频标题 | 视频直链 | 页面有效过期时间 (可选) 例如2025-12-31T23:59 | 备注（可选）
                        <br />
                        <b style={{ color: '#d32f2f' }}>⚠️ 视频标题请勿包含"医、健、康、百岁、奇方"等敏感词！</b>
                    </p>
                    <textarea 
                        name="batchInput" 
                        value={batchInput} 
                        onChange={(e) => setBatchInput(e.target.value)} 
                        placeholder={`示例数据模板 (复制此行到下方即可):
video-001 | ddry | 第1期 | https://example.com/v1.mp4 | 2025-12-31T23:59 | 备注
video-002 | bsjkb | 第2期 | https://example.com/v2.mp4 |`}
                        required 
                        disabled={isReadOnlyMode} 
                        style={{ 
                            ...styles.input, 
                            minHeight: '200px', 
                            whiteSpace: 'pre',
                            fontFamily: 'monospace',
                        }} 
                    />
                    {!isReadOnlyMode && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                            <button 
                                type="button" 
                                onClick={handleBatchSubmit} 
                                style={{ ...styles.buttonBase, backgroundColor: '#20c997' }}
                            >
                                批量新增并自动上传列表文件 (JSON)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderEditModal = () => {
        if (!editModalOpen || !editingVideo) return null;
        return (
            <div style={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={() => setEditModalOpen(false)}>&times;</button>
                    <h3 style={{ ...styles.formTitle, borderBottom: '2px solid #17a2b8' }}>编辑视频信息</h3>
                    <form onSubmit={handleEditSubmit}>
                        <div style={styles.formGrid(isMobile)}>
                            <input
                                name="htmlName"
                                value={editingVideo.htmlName || ''}
                                onChange={handleEditChange}
                                placeholder="HTML Name *"
                                required
                                style={styles.input}
                            />
                            <select
                                name="category"
                                value={editingVideo.category || ''}
                                onChange={handleEditChange}
                                required
                                style={styles.input}
                            >
                                <option value="" disabled>选择档期分类代码 *</option>
                                {Object.entries(CATEGORY_MAP).map(([label, value]) => (
                                    <option key={value} value={value}>{label} ({value})</option>
                                ))}
                            </select>
                            <input
                                name="title"
                                value={editingVideo.title || ''}
                                onChange={handleEditChange}
                                placeholder="视频标题 *"
                                required
                                style={styles.input}
                            />
                            <input
                                name="videoUrl"
                                value={editingVideo.videoUrl || ''}
                                onChange={handleEditChange}
                                placeholder="视频直链 *"
                                required
                                style={styles.input}
                            />
                            <input
                                name="expiryDate"
                                value={formatInternalDateToDatetimeLocal(editingVideo.expiryDate)}
                                onChange={handleExpiryDateChangeForEdit}
                                type="datetime-local"
                                placeholder="页面有效过期时间"
                                style={styles.input}
                            />
                            <input
                                name="remarks"
                                value={editingVideo.remarks || ''}
                                onChange={handleEditChange}
                                placeholder="备注（选填）"
                                style={styles.input}
                            />
                        </div>
                        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', gap: '10px' }}>
                            <button type="submit" style={{ ...styles.buttonBase, ...styles.buttonWarning }}>
                                保存并上传
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditModalOpen(false)}
                                style={{ ...styles.buttonBase, ...styles.buttonSecondary }}
                            >
                                取消
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // 🆕 单条发送短信模态框（增强版）
    const renderSmsModal = () => {
        if (!smsModalOpen || !smsTarget) return null;
        
        const isMobileDevice = SMS_UTILS.isMobileDevice();
        const hasAmpersand = SMS_UTILS.hasAmpersand(customMessage);
        
        return (
            <div style={styles.modalOverlay} onClick={() => setSmsModalOpen(false)}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={() => setSmsModalOpen(false)}>&times;</button>
                    <h3 style={{ ...styles.formTitle, borderBottom: '2px solid #28a745' }}>
                        📱 发送视频短信（系统短信应用）
                    </h3>
                    
                    {!isMobileDevice && (
                        <div style={{
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '15px',
                            color: '#856404',
                            fontSize: '14px'
                        }}>
                            ⚠️ 检测到您在桌面设备上操作，点击后将复制内容到剪贴板，请在手机上手动发送短信。
                        </div>
                    )}
                    
                    {isMobileDevice && hasAmpersand && (
                        <div style={{
                            backgroundColor: '#ffebee',
                            border: '1px solid #f44336',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '15px',
                            color: '#c62828',
                            fontSize: '14px'
                        }}>
                            ⚠️ 检测到链接包含 "&" 符号，部分设备可能会截断！<br/>
                            💡 我们会自动复制完整内容到剪贴板作为备份。
                        </div>
                    )}
                    
                    {isMobileDevice && !hasAmpersand && (
                        <div style={{
                            backgroundColor: '#e3f2fd',
                            border: '1px solid #2196f3',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '15px',
                            color: '#1565c0',
                            fontSize: '14px'
                        }}>
                            💡 点击"打开短信应用"后，将跳转到系统短信应用，内容已预填充，请手动点击"发送"完成。
                        </div>
                    )}
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#333', fontSize: '15px' }}>
                            📱 接收手机号 *
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                            placeholder="请输入11位手机号"
                            maxLength={11}
                            style={styles.input}
                            autoFocus
                        />
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#333', fontSize: '15px' }}>
                            ✏️ 短信内容（可编辑）*
                        </label>
                        <textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="编辑短信内容..."
                            style={{ 
                                ...styles.input, 
                                minHeight: '150px',
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                lineHeight: '1.6'
                            }}
                        />
                        <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                            💡 已输入 {customMessage.length} 字符 | 约 {Math.ceil(customMessage.length / 70)} 条短信
                            {hasAmpersand && <span style={{ color: '#f44336', fontWeight: 'bold' }}> | ⚠️ 包含特殊字符</span>}
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button
                            onClick={handleSendSms}
                            disabled={phoneNumber.length !== 11 || !customMessage.trim()}
                            style={{ 
                                ...styles.buttonBase, 
                                ...styles.buttonSuccess, 
                                flex: 1,
                                opacity: (phoneNumber.length !== 11 || !customMessage.trim()) ? 0.5 : 1,
                                cursor: (phoneNumber.length !== 11 || !customMessage.trim()) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isMobileDevice ? '📲 打开短信应用' : '📋 复制到剪贴板'}
                        </button>
                        <button
                            onClick={() => setSmsModalOpen(false)}
                            style={{ ...styles.buttonBase, ...styles.buttonSecondary, flex: 1 }}
                        >
                            取消
                        </button>
                    </div>
                    
                    <p style={{ fontSize: '12px', color: '#28a745', marginTop: '15px', textAlign: 'center' }}>
                        💰 费用: 约 0.1元/条 · 从手机话费扣除
                    </p>
                </div>
            </div>
        );
    };

    // 🆕 短信预览确认模态框
    const renderSmsPreviewModal = () => {
        if (!showSmsPreview || !smsPreviewData) return null;
        
        const { phone, message, hasAmpersand } = smsPreviewData;
        
        return (
            <div style={styles.modalOverlay} onClick={() => setShowSmsPreview(false)}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={() => setShowSmsPreview(false)}>&times;</button>
                    <h3 style={{ ...styles.formTitle, borderBottom: '2px solid #ff9800' }}>
                        📋 发送前预览确认
                    </h3>
                    
                    <div style={{
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '8px',
                        padding: '15px',
                        marginBottom: '20px'
                    }}>
                        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#856404' }}>
                            📱 收件人: {phone}
                        </p>
                        <p style={{ margin: '0', fontSize: '13px', color: '#856404' }}>
                            {hasAmpersand ? '⚠️ 检测到链接包含特殊字符，可能被截断' : '✅ 内容格式正常'}
                        </p>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#333' }}>
                            📝 短信内容预览：
                        </label>
                        <div style={{
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '15px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                        }}>
                            {message}
                        </div>
                    </div>
                    
                    {hasAmpersand && (
                        <div style={{
                            backgroundColor: '#ffebee',
                            border: '1px solid #f44336',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '15px',
                            fontSize: '13px',
                            color: '#c62828'
                        }}>
                            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>⚠️ 重要提示：</p>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                <li>完整内容已自动复制到剪贴板</li>
                                <li>打开短信应用后，如果内容被截断，请从剪贴板粘贴</li>
                                <li>请确保链接包含完整的 "category=xxx&name=xxx" 参数</li>
                            </ul>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        <button
                            onClick={() => handleConfirmSendSms('auto')}
                            style={{ 
                                ...styles.buttonBase, 
                                ...styles.buttonSuccess,
                                width: '100%'
                            }}
                        >
                            ✅ 确认发送（{hasAmpersand ? '已备份到剪贴板' : '直接跳转'}）
                        </button>
                        
                        <button
                            onClick={handleCopyOnly}
                            style={{ 
                                ...styles.buttonBase, 
                                backgroundColor: '#2196f3',
                                width: '100%'
                            }}
                        >
                            📋 仅复制内容（手动发送）
                        </button>
                        
                        <button
                            onClick={() => setShowSmsPreview(false)}
                            style={{ ...styles.buttonBase, ...styles.buttonSecondary, width: '100%' }}
                        >
                            取消
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // 🆕 批量发送短信模态框（系统短信版本）
    const renderBatchSmsModal = () => {
        if (!batchSmsModalOpen) return null;
        
        const selectedVideos = videos.filter(v => selectedVideoIds.includes(v.id));
        const isMobileDevice = SMS_UTILS.isMobileDevice();
        
        return (
            <div style={styles.modalOverlay} onClick={() => setBatchSmsModalOpen(false)}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={() => setBatchSmsModalOpen(false)}>&times;</button>
                    <h3 style={{ ...styles.formTitle, borderBottom: '2px solid #ff6b6b' }}>
                        📮 批量发送短信（系统短信）
                    </h3>
                    
                    {!isMobileDevice && (
                        <div style={{
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '15px',
                            color: '#856404',
                            fontSize: '14px'
                        }}>
                            ⚠️ 检测到您在桌面设备上操作，点击后将复制所有内容到剪贴板，请在手机上手动发送。
                        </div>
                    )}
                    
                    {isMobileDevice && (
                        <div style={{
                            backgroundColor: '#ffebee',
                            border: '1px solid #f44336',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '15px',
                            color: '#c62828',
                            fontSize: '14px'
                        }}>
                            ⚠️ 由于浏览器限制，系统会逐个打开短信应用，每次需要您手动点击"发送"按钮。<br/>
                            💡 完整内容会自动复制到剪贴板作为备份。
                        </div>
                    )}
                    
                    <div style={{
                        backgroundColor: '#e3f2fd',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        fontSize: '14px'
                    }}>
                        已选择 <strong>{selectedVideos.length}</strong> 条视频，将发送到指定的所有手机号
                    </div>
                    
                    <div style={{
                        backgroundColor: '#f8f9fa',
                        padding: '10px',
                        borderRadius: '6px',
                        marginBottom: '15px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        fontSize: '13px'
                    }}>
                        <strong>选中的视频：</strong>
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                            {selectedVideos.map(v => (
                                <li key={v.id}>{v.title}</li>
                            ))}
                        </ul>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#333', fontSize: '15px' }}>
                            📱 接收手机号列表 * （每行一个或用逗号分隔）
                        </label>
                        <textarea
                            value={batchPhones}
                            onChange={(e) => setBatchPhones(e.target.value)}
                            placeholder={`示例：\n13800138000\n13900139000\n或: 13800138000, 13900139000`}
                            style={{ 
                                ...styles.input, 
                                minHeight: '120px',
                                fontFamily: 'monospace'
                            }}
                            autoFocus
                        />
                        <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                            💡 已输入 {batchPhones.split(/[,，\s\n]+/).filter(p => p.trim()).length} 个号码
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button
                            onClick={handleBatchSendSms}
                            disabled={!batchPhones.trim() || selectedVideos.length === 0}
                            style={{ 
                                ...styles.buttonBase, 
                                backgroundColor: '#ff6b6b',
                                flex: 1,
                                opacity: (!batchPhones.trim() || selectedVideos.length === 0) ? 0.5 : 1,
                                cursor: (!batchPhones.trim() || selectedVideos.length === 0) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isMobileDevice ? '📲 开始批量发送' : '📋 复制全部内容'}
                        </button>
                        <button
                            onClick={() => setBatchSmsModalOpen(false)}
                            style={{ ...styles.buttonBase, ...styles.buttonSecondary, flex: 1 }}
                        >
                            取消
                        </button>
                    </div>
                    
                    <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '15px', textAlign: 'center' }}>
                        💰 预计费用: ￥{(batchPhones.split(/[,，\s\n]+/).filter(p => p.trim()).length * 0.1).toFixed(2)} · 从手机话费扣除
                    </p>
                </div>
            </div>
        );
    };

    const renderComplianceNotice = () => {
        if (!showComplianceNotice) return null;

        const handleClose = () => {
            localStorage.setItem('complianceNoticeSeen', 'true');
            setShowComplianceNotice(false);
        };

        return (
            <div style={styles.modalOverlay} onClick={handleClose}>
                <div style={{ ...styles.modalContent, maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                    <h3 style={{ color: '#d32f2f', fontWeight: 700, fontSize: '22px', marginBottom: '16px', textAlign: 'center' }}>
                        ⚠️ 重要合规整改通知 ⚠️
                    </h3>
                    <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#333', marginBottom: '20px' }}>
                        为严格遵守《<b>微信外部链接内容管理规范</b>》，避免因高风险关键词导致<b>域名被封禁</b>，系统已对视频分类名称进行如下整改：
                    </p>
                    <div style={{ backgroundColor: '#fff8e1', border: '1px solid #ffd54f', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#e65100' }}>🔴 以下敏感词已全部删除：</p>
                        <p style={{ margin: 0, fontSize: '14px', color: '#d32f2f' }}>
                            百岁健康班、大道仁医、防危度健、国医伴你行、美食每刻、奇酒奇方、羊奶粉
                        </p>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#1976d2' }}>✅ 新旧分类对应关系：</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#e3f2fd' }}>原分类名称</th>
                                <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#e3f2fd' }}>新分类名称</th>
                                <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#e3f2fd' }}>对应代码</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td style={{ border: '1px solid #ddd', padding: '8px' }}>百岁健康班</td><td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600 }}>第1频道</td><td style={{ border: '1px solid #ddd', padding: '8px' }}>bsjkb</td></tr>
                            <tr><td style={{ border: '1px solid #ddd', padding: '8px' }}>大道仁医</td><td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600 }}>第2频道</td><td style={{ border: '1px solid #ddd', padding: '8px' }}>ddry</td></tr>
                            <tr><td style={{ border: '1px solid #ddd', padding: '8px' }}>防危度健</td><td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600 }}>第3频道</td><td style={{ border: '1px solid #ddd', padding: '8px' }}>fwdj</td></tr>
                            <tr><td style={{ border: '1px solid #ddd', padding: '8px' }}>国医伴你行</td><td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600 }}>第4频道</td><td style={{ border: '1px solid #ddd', padding: '8px' }}>gybnx</td></tr>
                            <tr><td style={{ border: '1px solid #ddd', padding: '8px' }}>美食每刻</td><td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600 }}>第5频道</td><td style={{ border: '1px solid #ddd', padding: '8px' }}>msmk</td></tr>
                            <tr><td style={{ border: '1px solid #ddd', padding: '8px' }}>奇酒奇方</td><td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600 }}>第6频道</td><td style={{ border: '1px solid #ddd', padding: '8px' }}>qjqf</td></tr>
                        </tbody>
                    </table>
                    <p style={{ fontSize: '14px', color: '#555', marginTop: '16px', fontStyle: 'italic' }}>
                        💡 此调整仅影响前端显示名称，<b>URL 路由参数和数据库结构保持不变</b>，不影响现有链接访问。
                    </p>
                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <button
                            onClick={handleClose}
                            style={{
                                padding: '10px 24px',
                                backgroundColor: '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '16px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            我已知晓
                        </button>
                    </div>
                </div>
            </div>
        );
    };

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
                            <span><b>勾选:</b></span>
                            <input 
                                type="checkbox" 
                                checked={selectedVideoIds.includes(video.id)} 
                                onChange={() => handleSelectVideo(video.id)} 
                                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                        </div>
                        <div style={styles.mobileMetaItem}>
                            <span><b>档期分类:</b></span>
                            <span>{categoryLabel}</span>
                        </div>
                        <div style={styles.mobileMetaItem}>
                            <span><b>链接:</b></span>
                            <a href={video.generatedLink} target="_blank" rel="noopener noreferrer" 
                                style={{ color: '#007bff', textDecoration: 'none', fontSize: '12px', wordBreak: 'break-all' }}>
                                {video.generatedLink}
                            </a>
                        </div>
                        <div style={{ ...styles.mobileMetaItem, borderBottom: 'none' }}>
                            <span><b>过期时间:</b></span>
                            <span style={{ color: isExpired ? '#dc3545' : '#28a745', fontWeight: 600 }}>
                                {video.expiryDate || '永久'}
                            </span>
                        </div>
                        <div style={styles.mobileMetaItem}>
                            <span><b>备注:</b></span>
                            <span>{video.remarks || '无'}</span>
                        </div>
                        <div style={styles.mobileActions}>
                            {!isReadOnlyMode && (
                                <>
                                    <button onClick={() => handleEdit(video)} style={styles.buttonAction('#17a2b8')}>编辑</button>
                                    <button onClick={() => handleDelete(video.id)} style={styles.buttonAction('#dc3545')}>删除</button>
                                    <button onClick={() => handleOpenSmsModal(video)} style={styles.buttonAction('#28a745')}>发短信</button>
                                </>
                            )}
                            <button onClick={() => handleCopy(video)} style={styles.buttonAction('#007bff')}>复制链接</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderDesktopTable = () => (
        <div style={styles.tableContainer(isMobile)}>
            <table style={styles.table}>
                <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ ...styles.tableHeader, width: '40px' }}>
                            <input 
                                type="checkbox" 
                                checked={isAllSelected} 
                                onChange={(e) => handleSelectAll(e.target.checked)} 
                                style={{ cursor: 'pointer' }}
                            />
                        </th>
                        <th style={styles.tableHeader}>视频标题</th>
                        <th style={styles.tableHeader}>链接路由</th>
                        <th style={styles.tableHeader}>档期分类</th>
                        <th style={styles.tableHeader}>过期时间</th>
                        <th style={styles.tableHeader}>备注</th>
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
                                    <input 
                                        type="checkbox" 
                                        checked={selectedVideoIds.includes(video.id)} 
                                        onChange={() => handleSelectVideo(video.id)} 
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>
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
                                    {video.remarks || '-'}
                                </td>
                                <td style={styles.tableCell}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        {!isReadOnlyMode && (
                                            <>
                                                <button onClick={() => handleEdit(video)} style={styles.buttonAction('#17a2b8')}>编辑</button>
                                                <button onClick={() => handleDelete(video.id)} style={styles.buttonAction('#dc3545')}>删除</button>
                                                <button onClick={() => handleOpenSmsModal(video)} style={styles.buttonAction('#28a745')}>发短信</button>
                                            </>
                                        )}
                                        <button onClick={() => handleCopy(video)} style={styles.buttonAction('#007bff')}>复制</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div>
            <h3 style={styles.listHeader}>已生成的链接列表 ({filteredVideos.length} / {videos.length} 条)</h3>
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
                {selectedVideoIds.length > 0 && (
                    <>
                        <button 
                            onClick={handleBatchCopy} 
                            style={{ 
                                ...styles.buttonBase, 
                                ...styles.buttonPrimary,
                                flex: isMobile ? 'none' : '200px',
                                backgroundColor: '#20c997',
                            }}
                        >
                            批量复制 ({selectedVideoIds.length} 条)
                        </button>
                        {!isReadOnlyMode && (
                            <button 
                                onClick={handleOpenBatchSmsModal} 
                                style={{ 
                                    ...styles.buttonBase,
                                    flex: isMobile ? 'none' : '200px',
                                    backgroundColor: '#ff6b6b',
                                }}
                            >
                                📮 批量发短信 ({selectedVideoIds.length})
                            </button>
                        )}
                    </>
                )}
            </div>
            {paginatedVideos.length > 0 ? (isMobile ? renderMobileList() : renderDesktopTable()) : (
                <p style={{ textAlign: 'center', marginTop: '20px', color: '#6c757d' }}>
                    {searchTerm || selectedCategory ? `未找到匹配结果。` : '当前列表为空。'}
                </p>
            )}
            {renderPagination()}
        </div>
    );

    return (
        <div style={styles.pageContainer}>
            <div style={styles.header}>
                <div style={styles.logoWrapper}>
                    <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                        <img src="/rsvideo.svg" alt="RSV Logo" style={styles.logo} />
                    </a>
                    <h1 style={styles.headerTitle}>
                        RSV 管理后台 <br /> <span style={styles.headerSubtitle}>({isReadOnlyMode ? '只读模式' : '可编辑模式'})</span>
                    </h1>
                </div>

                <button onClick={handleLogout} 
                    style={{ ...styles.buttonBase, ...styles.buttonDanger }}>
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
            {renderBatchModal()}
            {renderEditModal()}
            {renderSmsModal()}
            {renderSmsPreviewModal()}
            {renderBatchSmsModal()}
            {renderComplianceNotice()}
        </div>
    );
}

export default AdminDashboard;