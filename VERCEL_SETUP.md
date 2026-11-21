# Vercel Independent Projects Setup Guide

This monorepo contains three independent Next.js applications that can be deployed as separate Vercel projects.

## Applications

1. **Platform Admin** (`apps/platform-admin`) - Platform administration dashboard
2. **Prop Admin** (`apps/prop-admin`) - Property administration dashboard  
3. **Trader** (`apps/trader`) - Trading dashboard

## Deployment Steps

### Step 1: Create Vercel Projects

For each application, create a new Vercel project:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Create New** → **Project**
3. Import your Git repository
4. Configure each project with the following settings:

#### Platform Admin
- **Root Directory**: `apps/platform-admin`
- **Framework Preset**: Next.js
- **Install Command**: `bun install`
- **Build Command**: `next build`
- **Output Directory**: `.next`

#### Prop Admin
- **Root Directory**: `apps/prop-admin`
- **Framework Preset**: Next.js
- **Install Command**: `bun install`
- **Build Command**: `next build`
- **Output Directory**: `.next`

#### Trader
- **Root Directory**: `apps/trader`
- **Framework Preset**: Next.js
- **Install Command**: `bun install`
- **Build Command**: `next build`
- **Output Directory**: `.next`

### Step 2: Configure Environment Variables

Each project may need environment variables. Common variables include:

- `NODE_ENV`: Set to `production`
- Database connection strings (if applicable)
- API keys and secrets
- Any application-specific configuration

### Step 3: Configure Domains

Each project will get a default Vercel domain. You can:
- Keep the default `*.vercel.app` domain
- Add custom domains in each project's **Settings** → **Domains**

## Key Configuration Files

### vercel.json (per app)
Each app has its own `vercel.json` with:
- Framework configuration
- Build and install commands
- Security headers
- Basic rewrites

### next.config.ts (per app)
Updated to:
- Remove `basePath` for independent deployment
- Keep `output: process.env.VERCEL ? undefined : "standalone"` for Vercel compatibility

## Build Optimization

Vercel automatically optimizes builds for Next.js. The build command is simplified to `next build` (without `--webpack` flag) as Vercel handles the bundler configuration.

## Monorepo Considerations

### Workspace Dependencies
The monorepo uses Bun workspaces. Vercel will:
1. Install dependencies at the root level
2. Build the specific project based on root directory

### Shared Packages
Shared packages (`packages/*`) are automatically resolved during build. No additional configuration needed.

## Troubleshooting

### Build Failures
- Check that `bun install` completes successfully
- Verify all dependencies are available in the workspace
- Check Vercel build logs for specific errors

### Missing Dependencies
If dependencies are missing:
1. Ensure they're listed in the app's `package.json`
2. Run `bun install` locally to update the lockfile
3. Commit the updated `bun.lock` file

### Environment Variable Issues
- Ensure all required environment variables are set in Vercel Dashboard
- Check for any hardcoded values that should be environment variables

## Migration from Multi-Service Deployment

The previous `vercel.json` at the root used a multi-service configuration with rewrites. This has been deprecated in favor of independent project deployment.

**Benefits of Independent Projects:**
- Each app deploys independently
- Better isolation and resource management
- Independent scaling and configuration
- Simpler CI/CD pipelines per app
- Easier debugging and monitoring

## CI/CD Integration

With independent projects, each app has its own:
- Deployment pipeline
- Preview deployments
- Production deployments
- Build logs and metrics

This allows teams to work on different apps without affecting each other's deployments.