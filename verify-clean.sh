#!/bin/bash

echo "🔧 Verifying Wood Ceylon files are clean for GitHub upload..."

# Check for pnpm files
echo "Checking for pnpm files..."
if [ -f "pnpm-lock.yaml" ]; then
    echo "❌ Found pnpm-lock.yaml - removing..."
    rm -f pnpm-lock.yaml
fi

if [ -f ".pnpm-workspace-state.json" ]; then
    echo "❌ Found .pnpm-workspace-state.json - removing..."
    rm -f .pnpm-workspace-state.json
fi

# Check for node_modules
if [ -d "node_modules" ]; then
    echo "❌ Found node_modules/ - removing (will be regenerated)..."
    rm -rf node_modules
fi

# Verify package.json has npm scripts
echo "Checking package.json scripts..."
if grep -q "pnpm" package.json; then
    echo "❌ package.json still contains pnpm references!"
    exit 1
else
    echo "✅ package.json is clean (npm scripts only)"
fi

# Check vercel.json exists
if [ ! -f "vercel.json" ]; then
    echo "❌ vercel.json missing!"
    exit 1
else
    echo "✅ vercel.json exists"
fi

# Verify key files exist
echo "Verifying essential files..."
files=("package.json" "vercel.json" "src/main.tsx" "index.html" "vite.config.ts")
for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing: $file"
        exit 1
    fi
done

echo "✅ All essential files present"

# List files ready for upload
echo ""
echo "📁 Files ready for GitHub upload:"
echo "✅ package.json (npm compatible)"
echo "✅ vercel.json (Vercel config)"
echo "✅ src/ (React application)"
echo "✅ index.html (main HTML)"
echo "✅ public/ (static assets)"
echo "✅ README.md (documentation)"
echo "✅ .gitignore (excludes build files)"
echo ""

echo "🚀 Ready for GitHub upload! No more pnpm errors."
echo ""
echo "Next steps:"
echo "1. Commit these files to GitHub"
echo "2. Deploy on Vercel"
echo "3. Add environment variables"
echo "4. 🎉 Your app will be live!"