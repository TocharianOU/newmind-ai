import './Documentation.css';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const zhContent = {
  title: '部署与配置文档',
  subtitle: '在当前 OAP Hub 控制台内维护部署、MCP 和大模型接入说明，不需要单独文档项目。',
  sections: [
    {
      id: 'docker',
      title: 'Docker 部署',
      description: '适合单机、PoC、内网测试和小规模私有化部署。下载包内包含镜像、docker-compose.yml、install.sh 和 DEPLOY.md。',
      steps: [
        {
          title: '下载安装包',
          body: '在首页下载 Docker x86_64 包，或将 oaphub-docker-x86_64.tar.gz 上传到目标服务器。',
          code: 'sha256sum -c oaphub-docker-x86_64.tar.gz.sha256',
        },
        {
          title: '解压并检查配置',
          body: '解压后先编辑 .env。生产环境必须替换 POSTGRES_PASSWORD、JWT_SECRET、OAP_AUTH_TOKEN、ADMIN_PASSWORD，并按真实域名配置 ALLOWED_ORIGINS。',
          code: 'tar -xzf oaphub-docker-x86_64.tar.gz\ncd oaphub-docker-x86_64\ncp .env .env.backup\nvim .env',
        },
        {
          title: '启动服务',
          body: 'install.sh 会导入镜像、创建持久化卷并启动 Hub、MCP Host、Postgres。',
          code: 'chmod +x install.sh\n./install.sh\ndocker compose ps',
        },
        {
          title: '访问入口',
          body: '默认端口为 23000。/app/ 是主聊天应用，/console/ 是控制台；未登录时会统一跳转到 /console/login。',
          code: 'http://SERVER_IP:23000/app/\nhttp://SERVER_IP:23000/console/',
        },
      ],
      checks: [
        'docker compose ps 中 hub、mcp-host、postgres 均为 healthy。',
        'GET /api/health 返回 status: ok 且 db: ok。',
        '浏览器访问 /app/ 时未登录会跳转到统一登录页。',
      ],
    },
    {
      id: 'kubernetes',
      title: 'Kubernetes 部署',
      description: '适合集群环境。标准包包含镜像包、manifests/oaphub.yaml 和 install.sh；上线前应按集群环境调整镜像仓库、存储类、域名和 Secret。',
      steps: [
        {
          title: '准备镜像',
          body: '单节点 Docker/KinD/Minikube 可直接 docker load；生产集群建议导入后重新 tag 并推送到企业镜像仓库。',
          code: 'tar -xzf oaphub-kubernetes-standard.tar.gz\ncd oaphub-kubernetes-standard\ngzip -dc images/oaphub-images.tar.gz | docker load',
        },
        {
          title: '修改 Secret 与存储',
          body: '编辑 manifests/oaphub.yaml，替换默认密码和 token，并按集群环境设置 PVC、StorageClass、Service 或 Ingress。',
          code: 'vim manifests/oaphub.yaml\nkubectl create namespace oaphub --dry-run=client -o yaml | kubectl apply -f -',
        },
        {
          title: '部署并等待就绪',
          body: 'install.sh 会执行 kubectl apply 并等待核心 Deployment rollout。',
          code: 'chmod +x install.sh\n./install.sh\nkubectl -n oaphub get pods,svc,pvc',
        },
        {
          title: '暴露访问',
          body: '默认示例使用 NodePort 30080。生产环境建议改为 Ingress，并配置 HTTPS、域名和 ALLOWED_ORIGINS。',
          code: 'kubectl -n oaphub get svc hub\ncurl http://NODE_IP:30080/api/health',
        },
      ],
      checks: [
        'postgres、mcp-host、hub 三个 Deployment rollout 成功。',
        'PVC 均 Bound，Pod 没有 CrashLoopBackOff。',
        '通过 Service 或 Ingress 访问 /api/health 正常。',
      ],
    },
  ],
};

const enContent = {
  title: 'Deployment & Configuration',
  subtitle: 'Deployment, MCP, and model integration guidance lives inside this OAP Hub console. No separate documentation project is required.',
  sections: [
    {
      id: 'docker',
      title: 'Docker Deployment',
      description: 'Best for a single server, PoC, internal testing, or small private deployments. The package includes images, docker-compose.yml, install.sh, and DEPLOY.md.',
      steps: [
        {
          title: 'Download the package',
          body: 'Download the Docker x86_64 package from the home page or upload oaphub-docker-x86_64.tar.gz to the target server.',
          code: 'sha256sum -c oaphub-docker-x86_64.tar.gz.sha256',
        },
        {
          title: 'Extract and review settings',
          body: 'Edit .env before production use. Replace POSTGRES_PASSWORD, JWT_SECRET, OAP_AUTH_TOKEN, ADMIN_PASSWORD, and set ALLOWED_ORIGINS for the real domain.',
          code: 'tar -xzf oaphub-docker-x86_64.tar.gz\ncd oaphub-docker-x86_64\ncp .env .env.backup\nvim .env',
        },
        {
          title: 'Start services',
          body: 'install.sh loads images, creates persistent volumes, and starts Hub, MCP Host, and Postgres.',
          code: 'chmod +x install.sh\n./install.sh\ndocker compose ps',
        },
        {
          title: 'Open the apps',
          body: 'The default port is 23000. /app/ is the chat app and /console/ is the management console. Anonymous users are redirected to /console/login.',
          code: 'http://SERVER_IP:23000/app/\nhttp://SERVER_IP:23000/console/',
        },
      ],
      checks: [
        'hub, mcp-host, and postgres are healthy in docker compose ps.',
        'GET /api/health returns status: ok and db: ok.',
        'Opening /app/ while signed out redirects to the unified login page.',
      ],
    },
    {
      id: 'kubernetes',
      title: 'Kubernetes Deployment',
      description: 'Best for cluster environments. The standard package includes image archives, manifests/oaphub.yaml, and install.sh. Adjust registry, storage, domain, and secrets before production.',
      steps: [
        {
          title: 'Prepare images',
          body: 'For single-node Docker, KinD, or Minikube, docker load is enough. For production clusters, tag and push images to your private registry.',
          code: 'tar -xzf oaphub-kubernetes-standard.tar.gz\ncd oaphub-kubernetes-standard\ngzip -dc images/oaphub-images.tar.gz | docker load',
        },
        {
          title: 'Update secrets and storage',
          body: 'Edit manifests/oaphub.yaml to replace default passwords and tokens, then adjust PVCs, StorageClass, Service, or Ingress for your cluster.',
          code: 'vim manifests/oaphub.yaml\nkubectl create namespace oaphub --dry-run=client -o yaml | kubectl apply -f -',
        },
        {
          title: 'Deploy and wait',
          body: 'install.sh applies the manifests and waits for core deployments to roll out.',
          code: 'chmod +x install.sh\n./install.sh\nkubectl -n oaphub get pods,svc,pvc',
        },
        {
          title: 'Expose access',
          body: 'The example uses NodePort 30080. For production, prefer Ingress with HTTPS, a real domain, and ALLOWED_ORIGINS.',
          code: 'kubectl -n oaphub get svc hub\ncurl http://NODE_IP:30080/api/health',
        },
      ],
      checks: [
        'postgres, mcp-host, and hub deployments roll out successfully.',
        'PVCs are Bound and pods are not CrashLoopBackOff.',
        '/api/health is reachable through Service or Ingress.',
      ],
    },
  ],
};

const configSections = {
  zh: [
    {
      id: 'mcp',
      title: 'MCP 部署与配置',
      cards: [
        {
          title: '内置 MCP Host',
          body: 'Docker 和 Kubernetes 部署都会启动 mcp-host 服务。Hub 通过 MCP_HOST_URL 访问它，并通过 MCP_HOST_INTERNAL_TOKEN / OAP_AUTH_TOKEN 做内部鉴权。',
        },
        {
          title: '安装工具',
          body: '进入主应用 /app/，在 Settings -> Tools 或集成市场中安装工具。HTTP/SSE 类型工具适合集群部署；stdio 类型工具需要运行环境具备对应二进制和依赖。',
        },
        {
          title: '持久化',
          body: 'Docker 部署使用 oaphub_mcp_data 卷；Kubernetes 部署使用 mcp-data PVC。升级或重启前不要删除这些数据卷。',
        },
        {
          title: '排查',
          body: '优先检查 mcp-host 日志、工具启动命令、网络出口、环境变量和 Hub 到 MCP Host 的 token 是否一致。',
        },
      ],
    },
    {
      id: 'models',
      title: '大模型配置',
      cards: [
        {
          title: '内置模型入口',
          body: '客户部署默认不绑定平台托管模型。上线时请由客户接入自己的模型供应商，并在控制台中维护可用模型。',
        },
        {
          title: '自定义模型',
          body: '管理员进入 Custom Models 页面添加模型供应商。字段包括 Display Name、Model ID、Provider Type、Base URL、API Key、Notes 和 Active。OpenAI-Compatible 会调用 /chat/completions，Anthropic 会调用 /messages。',
        },
        {
          title: '权限与额度',
          body: '模型可按用户、组织和工具额度控制。生产环境需同步设置 DEPLOYMENT_MODE、BILLING_ENABLED、LICENSE_ENABLED，并按客户模型成本维护计量策略。',
        },
        {
          title: '验证',
          body: '配置完成后在 /app/ 选择对应模型发起一次短对话，再检查模型调用日志、Token 统计和错误返回。',
        },
      ],
    },
  ],
  en: [
    {
      id: 'mcp',
      title: 'MCP Deployment & Configuration',
      cards: [
        {
          title: 'Built-in MCP Host',
          body: 'Docker and Kubernetes deployments start mcp-host. Hub reaches it through MCP_HOST_URL and authenticates with MCP_HOST_INTERNAL_TOKEN / OAP_AUTH_TOKEN.',
        },
        {
          title: 'Install tools',
          body: 'Open /app/, then install tools from Settings -> Tools or the integration marketplace. HTTP/SSE tools fit clusters; stdio tools require binaries and dependencies in the runtime.',
        },
        {
          title: 'Persistence',
          body: 'Docker uses the oaphub_mcp_data volume. Kubernetes uses the mcp-data PVC. Do not delete these volumes during upgrades or restarts.',
        },
        {
          title: 'Troubleshooting',
          body: 'Check mcp-host logs, tool commands, outbound network access, environment variables, and token consistency between Hub and MCP Host.',
        },
      ],
    },
    {
      id: 'models',
      title: 'Model Configuration',
      cards: [
        {
          title: 'Managed model IDs',
          body: 'Customer deployments do not require platform-managed model bindings. Customers should connect their own model providers and manage available models in the console.',
        },
        {
          title: 'Custom models',
          body: 'Admins can add model providers in Custom Models. Fields include Display Name, Model ID, Provider Type, Base URL, API Key, Notes, and Active. OpenAI-Compatible calls /chat/completions; Anthropic calls /messages.',
        },
        {
          title: 'Access and quota',
          body: 'Models can be controlled by user, organization, and tool quota. For production, align DEPLOYMENT_MODE, BILLING_ENABLED, LICENSE_ENABLED, and customer-specific model cost metering.',
        },
        {
          title: 'Validation',
          body: 'After saving, open /app/, select the model, send a short prompt, then check model logs, token usage, and error responses.',
        },
      ],
    },
  ],
};

const Documentation = () => {
  const { language } = useLanguage();
  const content = language === 'en' ? enContent : zhContent;
  const configs = configSections[language === 'en' ? 'en' : 'zh'];

  return (
    <div className="docs-page">
      <div className="docs-hero">
        <div>
          <p className="docs-eyebrow">OAP Hub Docs</p>
          <h1>{content.title}</h1>
          <p>{content.subtitle}</p>
        </div>
        <div className="docs-hero-actions">
          <Link to="/" className="docs-home-link">
            {language === 'en' ? 'Back to Home' : '返回官网首页'}
          </Link>
        </div>
      </div>

      <div className="docs-grid">
        <aside className="docs-toc">
          {[...content.sections, ...configs].map(section => (
            <a key={section.id} href={`#${section.id}`}>{section.title}</a>
          ))}
        </aside>

        <div className="docs-content">
          {content.sections.map(section => (
            <section key={section.id} id={section.id} className="docs-section">
              <div className="docs-section-header">
                <span className="docs-section-index">{section.id}</span>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
              </div>

              <div className="docs-steps">
                {section.steps.map((step, index) => (
                  <article key={step.title} className="docs-step">
                    <div className="docs-step-number">{index + 1}</div>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                      <pre><code>{step.code}</code></pre>
                    </div>
                  </article>
                ))}
              </div>

              <div className="docs-checks">
                <h3>{language === 'en' ? 'Verification' : '验证检查'}</h3>
                <ul>
                  {section.checks.map(check => <li key={check}>{check}</li>)}
                </ul>
              </div>
            </section>
          ))}

          {configs.map(section => (
            <section key={section.id} id={section.id} className="docs-section">
              <div className="docs-section-header">
                <span className="docs-section-index">{section.id}</span>
                <div>
                  <h2>{section.title}</h2>
                </div>
              </div>

              <div className="docs-card-grid">
                {section.cards.map(card => (
                  <article key={card.title} className="docs-card">
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Documentation;
