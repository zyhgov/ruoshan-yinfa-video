// functions/api/upload-json.js

// 默认 Pages Functions 导出的处理函数，只处理 POST 请求
export async function onRequestPost(context) {
    // context.env 包含了您的 R2 绑定
    const { request, env } = context;

    // ❗️ 关键：使用您在 Pages 设置中定义的 R2 绑定变量名
    const R2_BUCKET = env['video-list']; 
    
    // 确保 R2 绑定存在
    if (!R2_BUCKET) {
        return new Response('Internal Server Error: R2 binding "video-list" not found.', { status: 500 });
    }

    try {
        // 1. 读取请求体中的 JSON 字符串
        const jsonContent = await request.text();
        const fileName = 'video_list.json';
        
        // 2. 将内容上传到 R2 存储桶
        // key: 文件名 (video_list.json)
        // value: 文件内容 (jsonContent)
        await R2_BUCKET.put(fileName, jsonContent, {
            // 设置正确的 MIME 类型，确保浏览器能正确读取
            httpMetadata: { contentType: 'application/json' }
        });

        console.log(`R2 Success: ${fileName} uploaded.`);

        // 3. 返回成功响应给前端
        return new Response(JSON.stringify({ success: true, message: `Successfully updated ${fileName}` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('R2 Upload Error:', error);
        return new Response(`R2 Upload Failed: ${error.message}`, { status: 500 });
    }
}