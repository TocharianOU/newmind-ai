/**
 * Passport配置模块
 * 动态注册启用的OAuth策略，统一用户查找/创建逻辑
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GitLabStrategy } from 'passport-gitlab2';
import { prisma } from './database.js';
import { getOAuthConfig } from './oauth.js';
import logger from '../utils/logger.js';

/**
 * 设置Passport OAuth策略
 */
export function setupPassport() {
  const oauthConfig = getOAuthConfig();

  if (!oauthConfig.enabled) {
    logger.info('OAuth is disabled, skipping Passport setup');
    return;
  }

  logger.info(`Setting up Passport with ${oauthConfig.providers.length} OAuth providers`);

  oauthConfig.providers.forEach(providerConfig => {
    try {
      switch (providerConfig.name) {
        case 'google':
          setupGoogleStrategy(providerConfig);
          break;
        case 'microsoft':
          setupMicrosoftStrategy(providerConfig);
          break;
        case 'github':
          setupGitHubStrategy(providerConfig);
          break;
        case 'gitlab':
          setupGitLabStrategy(providerConfig);
          break;
        default:
          logger.warn(`Unknown OAuth provider: ${providerConfig.name}`);
      }
      logger.info(`✓ Registered OAuth strategy: ${providerConfig.name}`);
    } catch (error) {
      logger.error(`Failed to setup ${providerConfig.name} strategy:`, error);
    }
  });
}

/**
 * 设置Google OAuth策略
 */
function setupGoogleStrategy(config) {
  passport.use(new GoogleStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    scope: config.scope
  }, async (accessToken, refreshToken, profile, done) => {
    return handleOAuthCallback('google', profile, done);
  }));
}

/**
 * 设置Microsoft OAuth策略
 */
function setupMicrosoftStrategy(config) {
  passport.use(new MicrosoftStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    tenant: config.tenant,
    scope: config.scope
  }, async (accessToken, refreshToken, profile, done) => {
    return handleOAuthCallback('microsoft', profile, done);
  }));
}

/**
 * 设置GitHub OAuth策略
 */
function setupGitHubStrategy(config) {
  passport.use(new GitHubStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    scope: config.scope
  }, async (accessToken, refreshToken, profile, done) => {
    return handleOAuthCallback('github', profile, done);
  }));
}

/**
 * 设置GitLab OAuth策略
 */
function setupGitLabStrategy(config) {
  passport.use(new GitLabStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    baseURL: config.baseURL,
    scope: config.scope
  }, async (accessToken, refreshToken, profile, done) => {
    return handleOAuthCallback('gitlab', profile, done);
  }));
}

/**
 * 统一的OAuth回调处理逻辑（混合模式）
 * @param {string} provider - OAuth提供商名称
 * @param {Object} profile - OAuth profile
 * @param {Function} done - Passport回调
 */
async function handleOAuthCallback(provider, profile, done) {
  try {
    // 提取email（不同提供商格式可能不同）
    let email = null;
    if (profile.emails && profile.emails.length > 0) {
      email = profile.emails[0].value;
    } else if (profile.email) {
      email = profile.email;
    } else if (profile._json && profile._json.email) {
      email = profile._json.email;
    }

    if (!email) {
      logger.error(`No email found in ${provider} profile:`, profile.id);
      return done(new Error('No email provided by OAuth provider'));
    }

    const oauthId = profile.id;
    
    logger.info(`OAuth callback for ${provider}: ${email}`);

    // 查找用户（通过email或oauthId）
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { oauthProvider: provider, oauthId }
        ]
      },
      include: { subscription: true }
    });

    if (user && !user.oauthId) {
      // 关联现有账户（用户之前通过密码注册）
      logger.info(`Linking existing account ${email} to ${provider}`);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          oauthProvider: provider, 
          oauthId,
          picture: profile.photos?.[0]?.value || user.picture
        },
        include: { subscription: true }
      });
    } else if (!user) {
      // 创建新用户（首次OAuth登录）
      logger.info(`Creating new user from ${provider}: ${email}`);
      
      // 生成username（优先使用displayName，否则从email提取）
      const username = profile.displayName || 
                      profile.username || 
                      email.split('@')[0];

      user = await prisma.user.create({
        data: {
          email,
          oauthProvider: provider,
          oauthId,
          username,
          picture: profile.photos?.[0]?.value || profile.avatar_url || profile._json?.picture,
          password: null, // OAuth用户无密码
          subscription: {
            create: {
              planName: 'BASE',
              isDefaultPlan: true,
              isActive: true
            }
          }
        },
        include: { subscription: true }
      });

      logger.info(`✓ New user created: ${user.id} (${email})`);
    } else {
      // 用户已通过OAuth注册，正常登录
      logger.info(`OAuth login for existing user: ${email}`);
      
      // 更新用户头像（如果有新的）
      if (profile.photos?.[0]?.value && profile.photos[0].value !== user.picture) {
        await prisma.user.update({
          where: { id: user.id },
          data: { picture: profile.photos[0].value }
        });
      }
    }

    return done(null, user);
  } catch (error) {
    logger.error(`OAuth callback error for ${provider}:`, error);
    return done(error);
  }
}

/**
 * Passport序列化/反序列化（虽然我们不使用session，但某些策略需要这些方法）
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { subscription: true }
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

