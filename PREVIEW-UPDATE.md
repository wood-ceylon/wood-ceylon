# Update Your Wood Ceylon Preview App

## 🚀 Updated Preview App
**Live URL**: https://6vkugou66nkb.space.minimax.io

## ✨ What's New in This Update

### 🔧 Fixed Issues
- **UUID Error**: No more "invalid input syntax for type uuid" errors
- **Data Serialization**: Resolved circular reference issues
- **Transaction Loading**: Simplified queries to prevent foreign key errors

### 🆕 New Features
- **Category Dropdown**: Predefined categories instead of text input
- **Account Display**: Shows "Account Name (Type)" format
- **Enhanced Validation**: Better error messages and form validation
- **Improved Filtering**: Account name filter added

### 📊 UI Improvements
- White background styling for dropdowns
- Required field indicators (*)
- Better form validation warnings
- Responsive design enhancements

## 🔄 How to Update Preview App

### Quick Update (After Code Changes)
1. Make your code changes
2. Build the project: `npm run build`
3. Deploy: Use the MiniMax deploy button or run `update-preview.sh`

### Preview App URLs
- **Current Updated**: https://6vkugou66nkb.space.minimax.io
- **Previous Version**: https://2z4b5xs5g6aw.space.minimax.io
- **Original**: https://krkqgeyjd2w9.space.minimax.io

## 🛠️ Development Workflow

### Make Changes
1. Edit files in `src/` directory
2. Test changes locally: `npm run dev`

### Build & Deploy
```bash
# Build the project
npm run build

# Update preview (MiniMax platform automatically deploys)
# Your changes will be live in ~2-3 minutes
```

### Testing Checklist
- [ ] Create new income transaction
- [ ] Create new expense transaction  
- [ ] Create transfer between accounts
- [ ] Test category dropdown selection
- [ ] Verify account display formatting
- [ ] Check transaction filtering
- [ ] Test CSV export functionality

## 🌐 Deploy to Production (Vercel)

For production deployment, see [VERCEL.md](./VERCEL.md) or [vercel-deployment-guide.md](./vercel-deployment-guide.md)

## 📱 Mobile Testing
The updated app is fully responsive and works on:
- Desktop browsers
- Mobile phones
- Tablets

## 🔧 Environment
- **Node.js**: v20.19.0
- **Framework**: React + Vite
- **Database**: Supabase
- **Styling**: Tailwind CSS