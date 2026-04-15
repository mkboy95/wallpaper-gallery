#!/usr/bin/env node
/**
 * 触发 wallpaper-gallery 部署的脚本
 * 
 * 用法：
 *   node scripts/trigger-deploy.js
 * 
 * 说明：
 *   此脚本用于在图床仓库的 GitHub Actions 中调用，
 *   当图床处理完新壁纸后，自动触发 wallpaper-gallery 的部署流程。
 */

import fetch from 'node-fetch';

async function triggerDeployment() {
  const token = process.env.GITHUB_TOKEN;
  const repoOwner = 'mkboy95';
  const repoName = 'wallpaper-gallery';
  const eventType = 'nuanXinProPic-updated';

  if (!token) {
    console.error('❌ 缺少 GITHUB_TOKEN 环境变量');
    process.exit(1);
  }

  try {
    console.log('📡 触发 wallpaper-gallery 部署...');
    
    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: eventType,
          client_payload: {
            timestamp: new Date().toISOString(),
            message: '图床更新完成，触发壁纸网站部署'
          }
        })
      }
    );

    if (response.ok) {
      console.log('✅ 部署触发成功！');
      console.log('📅 触发时间:', new Date().toISOString());
    } else {
      const errorData = await response.json();
      console.error('❌ 部署触发失败:', errorData.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 触发部署时发生错误:', error.message);
    process.exit(1);
  }
}

// 执行触发
if (import.meta.url === `file://${process.argv[1]}`) {
  triggerDeployment();
}

export default triggerDeployment;