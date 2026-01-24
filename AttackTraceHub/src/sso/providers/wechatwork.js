/**
 * 企业微信 (WeCom/WeChat Work) SSO Provider
 * 实现企业微信网页授权登录
 * 
 * 企业微信 OAuth 2.0 流程：
 * 1. 跳转到企业微信授权页面
 * 2. 用户扫码/确认授权
 * 3. 回调获取 code
 * 4. 用 corpid + secret 获取 access_token
 * 5. 用 code + access_token 获取用户 userid
 * 6. 用 access_token + userid 获取用户详细信息
 */

import { SSOProvider } from '../types.js';
import logger from '../../utils/logger.js';
import { ProxyAgent } from 'undici';

// 创建支持代理的 fetch 配置
function createFetchOptions() {
  const options = {
    signal: AbortSignal.timeout(30000)
  };

  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    logger.info(`Using proxy for WeChatWork API requests: ${proxyUrl}`);
    options.dispatcher = new ProxyAgent(proxyUrl);
  }

  return options;
}

export class WeChatWorkSSOProvider extends SSOProvider {
  constructor(config) {
    super('wechatwork', config);

    // 企业微信 OAuth endpoints
    // 网页授权（适合第三方应用，扫码登录）
    this.authEndpoint = 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect';
    
    // 企业内部应用授权（需要在企业微信客户端内打开）
    // this.authEndpoint = 'https://open.weixin.qq.com/connect/oauth2/authorize';
    
    // API endpoints
    this.tokenEndpoint = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';
    this.userInfoEndpoint = 'https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo';
    this.userDetailEndpoint = 'https://qyapi.weixin.qq.com/cgi-bin/user/get';

    // 企业微信配置
    this.corpId = config.corpId;
    this.agentId = config.agentId;
    this.secret = config.clientSecret; // 使用 clientSecret 字段存储 secret
    
    // Default scope
    this.scope = config.scopes || ['snsapi_base'];
  }

  /**
   * Generate WeChatWork OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      appid: this.corpId,
      agentid: this.agentId,
      redirect_uri: this.getCallbackUrl(),
      state: state,
      usertype: 'member' // member=企业成员, admin=企业管理员
    });

    const url = `${this.authEndpoint}?${params.toString()}`;
    logger.info(`WeChatWork auth URL generated for state: ${state}`);
    return url;
  }

  /**
   * Get enterprise access token
   * 企业微信需要先用 corpid + secret 获取 access_token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      const fetchOptions = createFetchOptions();
      const url = `${this.tokenEndpoint}?corpid=${this.corpId}&corpsecret=${this.secret}`;
      
      logger.info('Getting WeChatWork access token');
      
      const response = await fetch(url, {
        method: 'GET',
        ...fetchOptions
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('WeChatWork access token request failed:', errorText);
        throw new Error(`Failed to get access token: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errcode !== 0) {
        logger.error('WeChatWork API error:', data);
        throw new Error(`WeChatWork API error: ${data.errmsg} (code: ${data.errcode})`);
      }

      return data.access_token;
    } catch (error) {
      logger.error('Failed to get WeChatWork access token:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for user info
   * @param {string} code - Authorization code from callback
   * @returns {Promise<SSOUserInfo>} User information
   */
  async handleCallback(code) {
    try {
      // Step 1: Get access token
      logger.info('Exchanging WeChatWork authorization code for user info');
      const accessToken = await this.getAccessToken();

      // Step 2: Get user basic info (userid)
      logger.info('Fetching WeChatWork user basic info');
      const fetchOptions = createFetchOptions();
      const userInfoUrl = `${this.userInfoEndpoint}?access_token=${accessToken}&code=${code}`;
      
      const userInfoResponse = await fetch(userInfoUrl, {
        method: 'GET',
        ...fetchOptions
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        logger.error('WeChatWork user info request failed:', errorText);
        throw new Error(`Failed to get user info: ${userInfoResponse.status}`);
      }

      const userInfoData = await userInfoResponse.json();
      
      if (userInfoData.errcode !== 0) {
        logger.error('WeChatWork user info API error:', userInfoData);
        throw new Error(`WeChatWork API error: ${userInfoData.errmsg} (code: ${userInfoData.errcode})`);
      }

      const userId = userInfoData.UserId || userInfoData.userid;
      
      if (!userId) {
        logger.error('No userid in WeChatWork response:', userInfoData);
        throw new Error('No userid returned from WeChatWork');
      }

      // Step 3: Get user detailed info
      logger.info(`Fetching WeChatWork user details for userid: ${userId}`);
      const fetchOptions2 = createFetchOptions();
      const userDetailUrl = `${this.userDetailEndpoint}?access_token=${accessToken}&userid=${userId}`;
      
      const userDetailResponse = await fetch(userDetailUrl, {
        method: 'GET',
        ...fetchOptions2
      });

      if (!userDetailResponse.ok) {
        const errorText = await userDetailResponse.text();
        logger.error('WeChatWork user detail request failed:', errorText);
        throw new Error(`Failed to get user detail: ${userDetailResponse.status}`);
      }

      const userDetail = await userDetailResponse.json();
      
      if (userDetail.errcode !== 0) {
        logger.error('WeChatWork user detail API error:', userDetail);
        throw new Error(`WeChatWork API error: ${userDetail.errmsg} (code: ${userDetail.errcode})`);
      }

      logger.info(`WeChatWork user detail retrieved: ${userDetail.userid}`);

      // Step 4: Map to our SSOUserInfo format
      // 注意：企业微信可能不返回邮箱，需要生成虚拟邮箱
      const email = userDetail.email || userDetail.biz_mail || `wechatwork_${userId}@sso.local`;
      const displayName = userDetail.name || userDetail.userid;

      return {
        providerUserId: userId,
        email: email,
        displayName: displayName,
        profilePicture: userDetail.avatar || userDetail.thumb_avatar,
        metadata: {
          userid: userDetail.userid,
          name: userDetail.name,
          department: userDetail.department,
          position: userDetail.position,
          mobile: userDetail.mobile,
          gender: userDetail.gender,
          status: userDetail.status,
          enable: userDetail.enable,
          isleader: userDetail.isleader,
          telephone: userDetail.telephone,
          alias: userDetail.alias,
          address: userDetail.address,
          open_userid: userDetail.open_userid,
          main_department: userDetail.main_department
        }
      };
    } catch (error) {
      logger.error('WeChatWork SSO callback error:', error);
      throw error;
    }
  }
}

/**
 * Create WeChatWork provider from environment variables
 * @returns {WeChatWorkSSOProvider}
 */
export function createWeChatWorkProvider() {
  const config = {
    enabled: process.env.SSO_WECHATWORK_ENABLED === 'true',
    corpId: process.env.SSO_WECHATWORK_CORP_ID,
    agentId: process.env.SSO_WECHATWORK_AGENT_ID,
    clientSecret: process.env.SSO_WECHATWORK_SECRET, // 使用统一的 clientSecret 字段
    callbackBaseUrl: process.env.SSO_CALLBACK_BASE_URL || 'http://localhost:23000',
    scopes: process.env.SSO_WECHATWORK_SCOPES
      ? [process.env.SSO_WECHATWORK_SCOPES]
      : undefined
  };

  // 验证必需配置
  if (config.enabled) {
    if (!config.corpId || !config.agentId || !config.clientSecret) {
      logger.warn('WeChatWork SSO is enabled but missing required configuration (corpId, agentId, or secret)');
      config.enabled = false;
    }
  }

  return new WeChatWorkSSOProvider(config);
}

export default WeChatWorkSSOProvider;

