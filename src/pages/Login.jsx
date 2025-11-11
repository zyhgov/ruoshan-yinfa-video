// Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissionKey, setPermissionKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('authToken') === 'logged_in_admin_token') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 🆕 账号配置
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'admin';
    const EDIT_PERMISSION_KEY = 'qq123123';
    
    // 🆕 新增：只能发短信和复制的账号
    const SHARE_USER = '123456';
    const SHARE_PASS = '123456';

    // 🆕 权限级别定义：
    // - 'full': 完全权限（增删改查+发短信+复制）
    // - 'share': 分享权限（仅查看+发短信+复制）
    // - 'readonly': 只读权限（仅查看）

    let permissionLevel = 'readonly';
    let successMessage = '';

    // 1️⃣ 验证 123456 账号（分享权限）
    if (username === SHARE_USER && password === SHARE_PASS) {
      if (permissionKey.trim() !== '') {
        setError('该账号无需输入权限密钥');
        return;
      }
      permissionLevel = 'share';
      successMessage = '✅ 登录成功！您可以查看、复制链接和发送短信。';
    }
    // 2️⃣ 验证 admin 账号
    else if (username === ADMIN_USER && password === ADMIN_PASS) {
      // 验证权限密钥
      if (permissionKey.trim() !== '' && permissionKey !== EDIT_PERMISSION_KEY) {
        setError('权限密钥错误，登录被拒绝');
        return;
      }
      
      // 根据是否输入密钥决定权限
      if (permissionKey === EDIT_PERMISSION_KEY) {
        permissionLevel = 'full';
        successMessage = '✅ 登录成功！您拥有完全管理权限。';
      } else {
        permissionLevel = 'readonly';
        successMessage = '✅ 登录成功！当前为只读模式（无编辑权限）。';
      }
    }
    // 3️⃣ 账号密码错误
    else {
      setError('账号或密码错误');
      return;
    }

    // 🆕 存储权限级别
    localStorage.setItem('authToken', 'logged_in_admin_token');
    localStorage.setItem('permissionLevel', permissionLevel);
    
    // 兼容旧代码（可选）
    localStorage.setItem('hasEditPermission', String(permissionLevel === 'full'));

    // 显示成功提示
    setSuccess(successMessage);

    // 1.5秒后跳转
    setTimeout(() => {
      navigate('/admin/dashboard', { replace: true });
    }, 1500);
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.loginCard}>
        <div style={styles.logoContainer}>
          <img 
            src="/rsvideo.svg" 
            alt="Logo" 
            style={styles.logo}
          />
        </div>
        <div style={styles.header}>
          <h1 style={styles.title}>RSV 管理后台</h1>
          <p style={styles.subtitle}>请输入管理员凭证登录</p>
        </div>

        {/* 自定义提示弹窗 */}
        {(error || success) && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            fontWeight: 600,
            backgroundColor: error ? '#ffebee' : '#e8f5e9',
            color: error ? '#c62828' : '#2e7d32',
            border: error ? '1px solid #ffcdd2' : '1px solid #c8e6c9',
          }}>
            {error || success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="username" style={styles.label}>👤 账号</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="username"
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>🔑 密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="password"
              autoComplete="current-password"
              required
            />
          </div>

          {/* 🆕 只有 admin 账号才显示权限密钥输入框 */}
          {username === 'admin' && (
            <div style={styles.inputGroup}>
              <label htmlFor="permissionKey" style={styles.label}>🔐 增删改权限密钥（选填）</label>
              <input
                id="permissionKey"
                type="password"
                value={permissionKey}
                onChange={(e) => setPermissionKey(e.target.value)}
                style={styles.input}
                placeholder="输入密钥可获得编辑权限"
                autoComplete="off"
              />
            </div>
          )}

          <button type="submit" style={styles.button}>
            登录系统
          </button>

          {/* 🆕 根据输入账号显示不同提示 */}
          {username === 'admin' && (
            <p style={styles.note}>⚠️ 权限密钥错误将导致登录失败 ⚠️</p>
          )}
          {username === '123456' && (
            <p style={{ ...styles.note, color: '#2e7d32' }}>💡 该账号拥有分享权限（查看+复制+发短信）</p>
          )}
        </form>

        {/* 🆕 账号说明 */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#6c757d',
          lineHeight: 1.6
        }}>
          <strong style={{ color: '#495057' }}>账号说明：</strong><br/>
          • <b>admin</b>：管理员账号，输入密钥可获得完全权限<br/>
          • <b>123456</b>：分享账号，只能查看、复制和发送短信
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f0f2f5', 
    padding: '20px',
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  logoContainer: {
    position: 'absolute',
    top: '20px',
    left: '25px',
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logo: {
    width: '100%',
    height: 'auto',
    maxWidth: '40px',
    maxHeight: '40px',
    objectFit: 'contain', 
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    margin: '0 0 12px',
    fontSize: '28px',
    fontWeight: '700',
    color: '#2d3748',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '15px',
    color: '#718096',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#4a5568',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '17px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#3182ce', 
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background-color 0.3s, transform 0.2s',
    marginTop: '8px',
  },
  note: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#e53e3e',
    lineHeight: 1.5,
  },
};

export default Login;