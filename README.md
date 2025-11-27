# Wood Ceylon Business Management System

A comprehensive business management system built with React, TypeScript, and Supabase.

## Features

- **Product Management**: Add, edit, and manage products with quantities
- **Order Management**: Create and track orders with customer details
- **Customer Management**: Manage customer information and order history
- **Worker Management**: Track workers, attendance, and labor costs
- **Inventory Management**: Monitor inventory levels and labor costs
- **Work Day Tracking**: Day-by-day attendance management with edit/delete options
- **Labor Cost Tracking**: Unified tracking for inventory and order labor costs
- **CSV Export**: Export labor costs and data for external use
- **Real-time Updates**: All data synchronized through Supabase

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, Radix UI components
- **Backend**: Supabase (Database, Authentication, Storage)
- **Charts**: Recharts for data visualization
- **PDF/Export**: jsPDF for document generation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/wood-ceylon-bms.git
cd wood-ceylon-bms
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run development server:
```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

## Deployment

This app is configured for deployment on Vercel:

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy automatically

## Database Schema

The app uses Supabase with the following main tables:
- `products` - Product information with quantities
- `customers` - Customer details
- `orders` - Order information
- `order_items` - Items within orders
- `workers` - Worker information
- `work_days` - Daily attendance tracking
- `inventory_batches` - Inventory with labor cost tracking

## License

Private repository - All rights reserved

## Author

Wood Ceylon Business Management System
