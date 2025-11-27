#!/bin/bash

echo "🚀 Wood Ceylon Vercel Deployment Helper"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this from the wood-ceylon project directory."
    exit 1
fi

echo "📦 Current directory contains package.json - Good!"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "🔧 Initializing Git repository..."
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Stage all files
echo "📁 Staging files..."
git add .
echo "✅ Files staged"

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy Wood Ceylon to Vercel - $(date)"
echo "✅ Changes committed"

echo ""
echo "🔗 Next Steps:"
echo "1. Create a repository on GitHub.com"
echo "2. Push your code:"
echo "   git remote add origin https://github.com/YOUR-USERNAME/wood-ceylon.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Go to Vercel.com and deploy:"
echo "   - Sign in with GitHub"
echo "   - Click 'New Project'"
echo "   - Import your repository"
echo "   - Configure settings:"
echo "     * Framework Preset: Vite"
echo "     * Build Command: npm run build"
echo "     * Output Directory: dist"
echo ""
echo "4. Add environment variables if needed:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo ""
echo "🎉 Deploy! Your app will be live at: https://your-project-name.vercel.app"

echo ""
echo "📖 For detailed instructions, see: vercel-deployment-guide.md"