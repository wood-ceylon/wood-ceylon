import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency } from '../lib/supabase';
import { Account, Order, Transaction, ProfitDistribution } from '../lib/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

// Type assertion helper for Recharts components to avoid React 18 typing issues
const RechartsBarChart = BarChart as any;
const RechartsBar = Bar as any;
const RechartsXAxis = XAxis as any;
const RechartsYAxis = YAxis as any;
const RechartsTooltip = Tooltip as any;
const RechartsPieChart = PieChart as any;
const RechartsPie = Pie as any;
const RechartsCell = Cell as any;

interface DashboardData {
  accounts: Account[];
  recentOrders: Order[];
  recentTransactions: Transaction[];
  recentProfitDistributions: ProfitDistribution[];
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyLaborCost: number;
  monthlyShippingCost: number;
  monthlyNetProfit: number;
  ordersCompleted: number;
  ordersPending: number;
  totalCustomers: number;
  totalProducts: number;
  totalBusinessExpenses: number;
}

const COLORS = ['#6D4C41', '#5C4033', '#4E342E', '#3E2723'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // Load accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);

      // Load recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get customer names for orders
      let ordersWithCustomers = orders || [];
      if (orders && orders.length > 0) {
        const customerIds = [...new Set(orders.map(o => o.customer_id))];
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds);
        ordersWithCustomers = orders.map(o => ({
          ...o,
          customer_name: customers?.find(c => c.id === o.customer_id)?.name || 'Unknown'
        }));
      }

      // Load recent transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get account names for transactions
      let transactionsWithAccounts = transactions || [];
      if (transactions && transactions.length > 0 && accounts) {
        transactionsWithAccounts = transactions.map(t => ({
          ...t,
          from_account_name: accounts.find(a => a.id === t.from_account_id)?.account_name,
          to_account_name: accounts.find(a => a.id === t.to_account_id)?.account_name
        }));
      }

      // Load recent profit distributions
      const { data: profitDistributions } = await supabase
        .from('profit_distributions')
        .select('*')
        .eq('is_distributed', true)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get order numbers for profit distributions
      let profitDistributionsWithOrders = profitDistributions || [];
      if (profitDistributions && profitDistributions.length > 0) {
        const orderIds = profitDistributions.filter(p => p.order_id).map(p => p.order_id);
        if (orderIds.length > 0) {
          const { data: profitOrders } = await supabase
            .from('orders')
            .select('id, order_number')
            .in('id', orderIds);
          profitDistributionsWithOrders = profitDistributions.map(p => ({
            ...p,
            order_number: profitOrders?.find(o => o.id === p.order_id)?.order_number
          }));
        }
      }

      // Calculate monthly stats with improved date handling
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
      
      const { data: monthlyOrders } = await supabase
        .from('orders')
        .select('total_amount_minor, total_labor_cost_minor, total_material_cost_minor, shipping_cost_minor, other_cost_minor, status, order_date')
        .gte('order_date', startOfMonthStr)
        .eq('is_active', true);

      // Debug log to see what we're getting
      console.log('Monthly orders data:', monthlyOrders);
      
      const monthlyRevenue = monthlyOrders?.reduce((sum, o) => sum + (o.total_amount_minor || 0), 0) || 0;
      const monthlyLaborCost = monthlyOrders?.reduce((sum, o) => sum + (o.total_labor_cost_minor || 0), 0) || 0;
      const monthlyShippingCost = monthlyOrders?.reduce((sum, o) => sum + (o.shipping_cost_minor || 0), 0) || 0;
      const ordersCompleted = monthlyOrders?.filter(o => o.status === 'completed').length || 0;
      const ordersPending = monthlyOrders?.filter(o => ['draft', 'confirmed', 'in_progress'].includes(o.status)).length || 0;
      
      // Calculate total business expenses (labor + shipping + other costs from all orders)
      const totalBusinessExpenses = monthlyOrders?.reduce((sum, o) => {
        const laborCost = o.total_labor_cost_minor || 0;
        const shippingCost = o.shipping_cost_minor || 0;
        const otherCost = o.other_cost_minor || 0;
        return sum + laborCost + shippingCost + otherCost;
      }, 0) || 0;

      // Calculate net profit from profit distributions (actual order profit data)
      const { data: monthlyProfitDistributions } = await supabase
        .from('profit_distributions')
        .select('total_profit_minor, distribution_date')
        .eq('is_distributed', true)
        .gte('distribution_date', startOfMonthStr);

      console.log('Monthly profit distributions:', monthlyProfitDistributions);
      
      const monthlyNetProfit = monthlyProfitDistributions?.reduce((sum, p) => sum + (p.total_profit_minor || 0), 0) || 0;

      const { data: monthlyTxns } = await supabase
        .from('transactions')
        .select('amount_minor, transaction_type, transaction_date')
        .gte('transaction_date', startOfMonthStr);

      const monthlyExpenses = monthlyTxns
        ?.filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + (t.amount_minor || 0), 0) || 0;
        
      console.log('Dashboard monthly data:', {
        monthlyRevenue,
        monthlyLaborCost,
        monthlyShippingCost,
        monthlyNetProfit,
        totalBusinessExpenses,
        monthlyExpenses,
        ordersCompleted,
        ordersPending,
        startOfMonthStr
      });

      // Count totals
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setData({
        accounts: accounts || [],
        recentOrders: ordersWithCustomers,
        recentTransactions: transactionsWithAccounts,
        recentProfitDistributions: profitDistributionsWithOrders,
        monthlyRevenue,
        monthlyExpenses,
        monthlyLaborCost,
        monthlyShippingCost,
        monthlyNetProfit,
        ordersCompleted,
        ordersPending,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        totalBusinessExpenses,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  // Chart data
  const accountBalanceData = data.accounts.map(a => ({
    name: a.account_name,
    value: a.balance_minor
  }));

  const orderStatusData = [
    { name: 'Completed', value: data.ordersCompleted },
    { name: 'Pending', value: data.ordersPending },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-500">Overview of your business performance</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
          className="px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Monthly Revenue"
          value={formatCurrency(data.monthlyRevenue)}
          icon={DollarSign}
          trend={data.monthlyRevenue > 0 ? 'up' : 'neutral'}
          color="green"
        />
        <KPICard
          title="Labor Costs"
          value={formatCurrency(data.monthlyLaborCost)}
          icon={Users}
          trend={data.monthlyLaborCost > 0 ? 'up' : 'neutral'}
          color="red"
        />
        <KPICard
          title="Shipping Costs"
          value={formatCurrency(data.monthlyShippingCost)}
          icon={ShoppingCart}
          trend={data.monthlyShippingCost > 0 ? 'up' : 'neutral'}
          color="red"
        />
        <KPICard
          title="Net Profit"
          value={formatCurrency(data.monthlyNetProfit)}
          icon={data.monthlyNetProfit >= 0 ? TrendingUp : TrendingDown}
          trend={data.monthlyNetProfit >= 0 ? 'up' : 'down'}
          color={data.monthlyNetProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Account Balances */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Account Balances</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {data.accounts
            .sort((a, b) => {
              // Put loan account last
              if (a.account_type === 'loan') return 1;
              if (b.account_type === 'loan') return -1;
              return 0;
            })
            .map((account) => (
            <div
              key={account.id}
              className="bg-gradient-to-br from-primary-light to-accent-light rounded-lg p-4 border border-primary"
            >
              <div className="text-sm text-primary-hover font-medium">{account.account_name}</div>
              <div className="text-xl font-bold text-primary-selected mt-1">
                {formatCurrency(account.balance_minor)}
              </div>
              <div className="text-xs text-primary-hover mt-1 capitalize">{account.account_type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Order Status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <RechartsPie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {orderStatusData.map((_, index) => (
                    <RechartsCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </RechartsPie>
                <RechartsTooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Balance Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Account Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={accountBalanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <RechartsXAxis dataKey="name" />
                <RechartsYAxis tickFormatter={(v) => `${(v / 100).toFixed(0)}`} />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <RechartsBar dataKey="value" fill="#8AA624" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Orders Completed" value={data.ordersCompleted} icon={ShoppingCart} />
        <StatCard title="Orders Pending" value={data.ordersPending} icon={ShoppingCart} />
        <StatCard title="Total Customers" value={data.totalCustomers} icon={Users} />
        <StatCard title="Total Products" value={data.totalProducts} icon={Package} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Recent Orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-neutral-500 text-center py-4">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-neutral-900">{order.order_number}</div>
                    <div className="text-sm text-neutral-500">{order.customer_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-neutral-900">
                      {formatCurrency(order.total_amount_minor)}
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Recent Transactions</h2>
          {data.recentTransactions.length === 0 ? (
            <p className="text-neutral-500 text-center py-4">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentTransactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        txn.transaction_type === 'income'
                          ? 'bg-green-100 text-green-600'
                          : txn.transaction_type === 'expense'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {txn.transaction_type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">{txn.transaction_number}</div>
                      <div className="text-sm text-neutral-500">{txn.description || txn.category || 'Transaction'}</div>
                    </div>
                  </div>
                  <div
                    className={`font-medium ${
                      txn.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {txn.transaction_type === 'income' ? '+' : '-'}
                    {formatCurrency(txn.amount_minor)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profit Distributions */}
      {data.recentProfitDistributions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-neutral-900">Recent Profit Distributions</h2>
          </div>
          <div className="space-y-3">
            {data.recentProfitDistributions.map((dist) => (
              <div
                key={dist.id}
                className="border border-primary rounded-lg p-4 bg-primary-light"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-neutral-900">
                      {dist.order_number ? `Order ${dist.order_number}` : 'Profit Distribution'}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {new Date(dist.distribution_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-neutral-600">Total Profit</div>
                    <div className="text-lg font-bold text-green-700">
                      {formatCurrency(dist.total_profit_minor)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-primary">
                  <div className="text-center">
                    <div className="text-xs text-neutral-600">Ashan</div>
                    <div className="font-semibold text-primary-selected">
                      {formatCurrency(dist.ashan_share_minor)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-neutral-600">Praveen</div>
                    <div className="font-semibold text-primary-selected">
                      {formatCurrency(dist.praveen_share_minor)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-neutral-600">Business</div>
                    <div className="font-semibold text-primary-selected">
                      {formatCurrency(dist.business_share_minor)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// KPI Card Component
function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
  color: 'green' | 'red' | 'blue' | 'yellow';
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  };

  return (
    <div className={`rounded-xl p-5 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium opacity-80">{title}</span>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-bold text-neutral-900">{value}</div>
          <div className="text-sm text-neutral-500">{title}</div>
        </div>
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-neutral-100 text-neutral-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        statusColors[status] || statusColors.draft
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
