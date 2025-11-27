# Deploy to Vercel - Quick Start

## 🚀 One-Click Deployment

### Option 1: GitHub + Vercel (Recommended)

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/wood-ceylon.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project" → Import your repository
   - Vercel auto-detects Vite configuration
   - Click "Deploy" ✅

### Option 2: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

## ⚙️ Configuration

**Framework Preset**: Vite
**Build Command**: `npm run build`
**Output Directory**: `dist`

## 🔑 Environment Variables

Add in Vercel Dashboard → Settings → Environment Variables:
- `VITE_SUPABASE_URL` → Your Supabase URL
- `VITE_SUPABASE_ANON_KEY` → Your Supabase Anon Key

## 🌐 Custom Domain

1. Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed

## 📊 Monitor

- Vercel Dashboard → Analytics
- Vercel Dashboard → Functions → View logs

## ❓ Need Help?

- Check [vercel-deployment-guide.md](./vercel-deployment-guide.md) for detailed instructions
- Visit [Vercel Docs](https://vercel.com/docs)