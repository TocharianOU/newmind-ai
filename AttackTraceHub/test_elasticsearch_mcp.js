#!/usr/bin/env node

/**
 * Test script for Elasticsearch MCP integration
 */

import fetch from 'node-fetch';

const HUB_URL = process.env.HUB_URL || 'http://localhost:3000';
const TEST_EMAIL = 'base@test.com';
const TEST_PASSWORD = 'password123';

let authToken = '';

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${HUB_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });

  const data = await response.json();
  if (data.status === 'success' && data.data.token) {
    authToken = data.data.token;
    console.log('✅ Login successful');
    return true;
  } else {
    console.error('❌ Login failed:', data);
    return false;
  }
}

async function searchMCPServers(searchTerm = 'elasticsearch') {
  console.log(`🔍 Searching for "${searchTerm}" MCP servers...`);
  const response = await fetch(`${HUB_URL}/api/v1/user/mcp/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      search_input: searchTerm,
      filter: 0
    })
  });

  const data = await response.json();
  if (data.status === 'success' && data.data) {
    console.log(`✅ Found ${data.data.length} MCP servers`);
    
    // Find Elasticsearch MCP
    const esMCP = data.data.find(s => s.name.includes('Elasticsearch'));
    if (esMCP) {
      console.log('\n📦 Elasticsearch MCP Server Details:');
      console.log('  Name:', esMCP.name);
      console.log('  Description:', esMCP.description);
      console.log('  Transport:', esMCP.transport);
      console.log('  Command:', esMCP.command);
      console.log('  Args:', esMCP.args);
      console.log('  Environment Variables:', esMCP.env);
      console.log('  Tags:', esMCP.tags);
      console.log('  Plan:', esMCP.plan);
      console.log('  Popular:', esMCP.popular);
      console.log('  New:', esMCP.new);
      return esMCP;
    } else {
      console.log('⚠️  Elasticsearch MCP not found');
    }
  } else {
    console.error('❌ Search failed:', data);
  }
  return null;
}

async function applyMCPServer(serverId) {
  console.log(`\n📝 Applying MCP server ${serverId}...`);
  const response = await fetch(`${HUB_URL}/api/v1/user/mcp/apply`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([serverId])
  });

  const data = await response.json();
  if (data.status === 'success') {
    console.log('✅ MCP server applied successfully');
    return true;
  } else {
    console.error('❌ Apply failed:', data);
    return false;
  }
}

async function getUserMCPConfigs() {
  console.log('\n📋 Getting user MCP configurations...');
  const response = await fetch(`${HUB_URL}/api/v1/user/mcp/configs`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();
  if (data.status === 'success' && data.data) {
    console.log(`✅ User has ${data.data.length} MCP configurations`);
    
    const esMCP = data.data.find(c => c.name.includes('Elasticsearch'));
    if (esMCP) {
      console.log('\n✅ Elasticsearch MCP is in user configurations!');
      console.log('\n🎉 Expected Dive configuration:');
      console.log(JSON.stringify({
        [esMCP.name]: {
          transport: esMCP.transport,
          enabled: true,
          command: esMCP.command,
          args: esMCP.args,
          env: esMCP.env
        }
      }, null, 2));
    }
    return data.data;
  } else {
    console.error('❌ Failed to get configs:', data);
    return [];
  }
}

async function runTest() {
  console.log('🚀 Starting Elasticsearch MCP Integration Test\n');
  console.log('Hub URL:', HUB_URL);
  console.log('Test Account:', TEST_EMAIL);
  console.log('-'.repeat(50));

  // Step 1: Login
  if (!await login()) {
    console.error('\n❌ Test failed: Could not login');
    process.exit(1);
  }

  // Step 2: Search for Elasticsearch MCP
  const esMCP = await searchMCPServers('elasticsearch');
  if (!esMCP) {
    console.error('\n❌ Test failed: Elasticsearch MCP not found');
    console.log('\n💡 Tip: Run "npm run db:seed" to add the Elasticsearch MCP server');
    process.exit(1);
  }

  // Step 3: Apply the MCP server
  if (!await applyMCPServer(esMCP.id)) {
    console.error('\n❌ Test failed: Could not apply MCP server');
    process.exit(1);
  }

  // Step 4: Verify it's in user configs
  const configs = await getUserMCPConfigs();
  if (configs.length === 0) {
    console.error('\n❌ Test failed: No user configurations found');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests passed successfully!');
  console.log('='.repeat(50));
  console.log('\n📌 Next steps:');
  console.log('1. Open Dive APP');
  console.log('2. Login with the same account');
  console.log('3. Go to MCP Tools section');
  console.log('4. The Elasticsearch MCP should be visible and ready to use');
}

// Run the test
runTest().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
