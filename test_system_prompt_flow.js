#!/usr/bin/env node
/**
 * 测试系统提示词完整流程
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testSystemPromptFlow() {
  console.log('🧪 Testing System Prompt Flow...\n');

  try {
    // 1. 获取当前系统提示词
    console.log('1️⃣ Getting current system prompt...');
    const currentResponse = await fetch(`${BASE_URL}/api/v1/system-prompt/current`);
    const currentData = await currentResponse.json();
    console.log('Current:', currentData);

    // 2. 设置新的系统提示词 (需要认证token)
    console.log('\n2️⃣ Setting new system prompt...');
    const testPrompt = `测试最高优先级系统提示词 - ${new Date().toISOString()}`;
    
    // 注意: 这里需要有效的JWT token
    const authToken = process.env.TEST_AUTH_TOKEN;
    if (!authToken) {
      console.log('⚠️ TEST_AUTH_TOKEN not set, skipping authenticated tests');
      return;
    }

    const setResponse = await fetch(`${BASE_URL}/api/v1/system-prompt/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content: testPrompt })
    });
    const setData = await setResponse.json();
    console.log('Set result:', setData);

    // 3. 验证设置成功
    console.log('\n3️⃣ Verifying the setting...');
    const verifyResponse = await fetch(`${BASE_URL}/api/v1/system-prompt/current`);
    const verifyData = await verifyResponse.json();
    console.log('Verified:', verifyData);

    // 4. 检查环境变量
    console.log('\n4️⃣ Checking process environment...');
    console.log('DIVE_OVERRIDE_SYSTEM_PROMPT:', process.env.DIVE_OVERRIDE_SYSTEM_PROMPT);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// 运行测试
testSystemPromptFlow();
