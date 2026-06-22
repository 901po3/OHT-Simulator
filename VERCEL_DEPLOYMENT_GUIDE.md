# Vercel Deployment Guide for OHT-Simulator

## Project Setup

The OHT-Simulator React + Vite project is now configured for deployment on Vercel.

### Configuration Files
- **vercel.json** - Vercel deployment configuration with build and output settings
- **.github/workflows/vercel-deploy.yml** - GitHub Actions workflow for automatic deployment
- **npm scripts** - Ready for production builds

### Build Information
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **Framework**: Vite
- **Runtime**: Node.js (auto-detected)

## Deployment Steps

### 1. Initial Setup (First Time Only)

```bash
# Navigate to project root
cd C:\Unity\Portfolio\OHT-Simulator

# Login to Vercel CLI
vercel login

# Follow the browser prompt to authenticate
```

### 2. Link Project to Vercel

```bash
# Link the project to Vercel
vercel link

# When prompted, choose:
# - Set up and deploy: Yes
# - Which scope to deploy to: Select your account
# - Link to existing project: No (first time) or Yes (if already exists)
# - Project name: oht-simulator
```

### 3. Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or for preview deployment (staging)
vercel
```

### 4. Automatic Deployments via GitHub Actions

For automatic deployments when pushing to GitHub:

1. Get your Vercel tokens:
   - Visit https://vercel.com/account/tokens
   - Create a new token and copy it

2. Add GitHub Secrets:
   - Go to: https://github.com/901po3/OHT-Simulator/settings/secrets/actions
   - Add the following secrets:
     - `VERCEL_TOKEN`: Your Vercel API token
     - `VERCEL_ORG_ID`: Your Vercel organization ID (from Vercel dashboard)
     - `VERCEL_PROJECT_ID`: The project ID created after first deployment

3. Push changes to trigger automatic deployment:
   ```bash
   git push origin master
   ```

## Expected Results

### First Deployment
- Build completes successfully
- Output: `dist/` directory with optimized production files
- Deployment URL: https://oht-simulator.vercel.app (or auto-generated subdomain)
- GitHub Actions workflow status checks pass

### Subsequent Deployments
- Automatic deployment on every push to `main` or `master` branches
- Preview deployments for pull requests
- Production deployments for merged PRs

## Monitoring & Logs

### Vercel Dashboard
- URL: https://vercel.com/dashboard
- Monitor deployment status, logs, and analytics
- View all deployment history

### GitHub Actions
- View workflow runs: Settings > Actions > Workflows > Deploy to Vercel
- Check logs for build and deployment details

## Troubleshooting

### Build Fails
- Check `npm run build` locally: `cd C:\Unity\Portfolio\OHT-Simulator && npm run build`
- Verify all dependencies are installed: `npm install`
- Check TypeScript errors: `npm run lint`

### Deployment URL Not Accessible
- Wait 1-2 minutes for Vercel CDN to propagate
- Check deployment status in Vercel dashboard
- Verify GitHub webhook is correctly configured

### GitHub Actions Not Running
- Ensure secrets are correctly set in GitHub Settings > Secrets and variables
- Check workflow file syntax
- Verify GitHub personal access token has necessary permissions

## Production Optimization

Current Vercel deployment includes:
- Gzip compression
- Automatic CDN caching
- HTTPS encryption
- Image optimization (if applicable)

Warning about chunk size (>500kB) - Consider implementing code splitting with dynamic imports for better performance.

## Project Structure

```
OHT-Simulator/
├── src/                 # React + TypeScript source code
├── public/              # Static assets
├── dist/                # Production build output
├── vercel.json          # Vercel configuration
├── package.json         # Node.js dependencies & scripts
├── vite.config.ts       # Vite build configuration
├── tsconfig.json        # TypeScript configuration
└── .github/
    └── workflows/
        └── vercel-deploy.yml  # GitHub Actions workflow
```

## Environment Variables

If needed, add environment variables to Vercel:
1. Go to: Project Settings > Environment Variables
2. Add variables for:
   - API endpoints
   - Feature flags
   - Analytics keys
   - etc.

Note: Never commit sensitive values to Git. Use Vercel environment variable management instead.

## Next Steps

1. Deploy the project: `vercel --prod`
2. Test the deployment at the provided URL
3. Configure custom domain (optional): Project Settings > Domains
4. Set up GitHub integration for automatic deployments
5. Monitor performance in Vercel Analytics dashboard

---

**Last Updated**: 2025-06-22  
**Deployment Status**: Ready for deployment
