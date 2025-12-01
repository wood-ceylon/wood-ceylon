import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  CreditCard,
  Hammer,
  Tags,
  Settings,
  Menu,
  X,
  Boxes,
  Package,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Tags, label: 'Products' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/workers', icon: Hammer, label: 'Workers' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/transactions', icon: CreditCard, label: 'Transactions' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-neutral-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary to-primary-selected text-white transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-primary-selected">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-hover rounded-lg flex items-center justify-center">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Wood Ceylon</span>
          </div>
          <button
            className="lg:hidden p-1 hover:bg-primary-hover rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-hover text-white shadow-md'
                    : 'text-primary-light hover:bg-primary-hover hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-selected">
          <div className="text-xs text-primary-light text-center">
            Wood Ceylon BMS v1.0
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <button
            className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6 text-neutral-700" />
          </button>
          <div className="flex-1 lg:ml-0 ml-4">
            <h1 className="text-lg font-semibold text-neutral-800">
              Business Management System
            </h1>
          </div>
          <div className="text-sm text-neutral-500">
            Currency: LKR
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
