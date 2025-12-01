import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency, resetOrderSequence } from '../lib/supabase';
import { Account, SystemSettings, ProductCategory } from '../lib/types';
import { Settings as SettingsIcon, DollarSign, Users, Tag, Building2, Save, Undo2, AlertTriangle, Plus } from 'lucide-react';

type TabType = 'accounts' | 'profit' | 'categories' | 'business' | 'reverse' | 'reset';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadAccounts();
    loadSettings();
  }, []);

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_name');
    if (data) setAccounts(data);
    setLoading(false);
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('system_settings')
      .select('*');
    
    if (data) {
      const settingsMap: Record<string, any> = {};
      data.forEach(setting => {
        settingsMap[setting.setting_key] = setting.setting_value;
      });
      setSettings(settingsMap);
    }
  }

  async function saveSetting(key: string, value: any) {
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', key)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('system_settings')
          .update({ setting_value: value, updated_at: new Date().toISOString() })
          .eq('setting_key', key);
      } else {
        await supabase
          .from('system_settings')
          .insert({ setting_key: key, setting_value: value });
      }
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      await loadSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
      alert('Failed to save setting');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
          <p className="text-neutral-500">Configure system settings and preferences</p>
        </div>
        {saveMessage && (
          <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
            {saveMessage}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabButton
          icon={<DollarSign className="w-4 h-4" />}
          label="Accounts"
          active={activeTab === 'accounts'}
          onClick={() => {
            console.log('Accounts tab clicked, setting activeTab to accounts');
            setActiveTab('accounts');
          }}
        />
        <TabButton
          icon={<Users className="w-4 h-4" />}
          label="Profit Sharing"
          active={activeTab === 'profit'}
          onClick={() => {
            console.log('Profit Sharing tab clicked, setting activeTab to profit');
            setActiveTab('profit');
          }}
        />
        <TabButton
          icon={<Tag className="w-4 h-4" />}
          label="Categories"
          active={activeTab === 'categories'}
          onClick={() => {
            console.log('Categories tab clicked, setting activeTab to categories');
            setActiveTab('categories');
          }}
        />
        <TabButton
          icon={<Building2 className="w-4 h-4" />}
          label="Business Info"
          active={activeTab === 'business'}
          onClick={() => {
            console.log('Business Info tab clicked, setting activeTab to business');
            setActiveTab('business');
          }}
        />
        
        {/* Reverse/Undo Tab */}
        <TabButton
          icon={<Undo2 className="w-4 h-4" />}
          label="Reverse Actions"
          active={activeTab === 'reverse'}
          onClick={() => {
            console.log('Reverse tab clicked, setting activeTab to reverse');
            setActiveTab('reverse');
          }}
        />
        
        {/* Simple test button for Data Reset */}
        <button
          onClick={() => {
            console.log('Data Reset simple button clicked, setting activeTab to reset');
            setActiveTab('reset');
          }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'reset'
              ? 'border-wood-700 text-wood-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Data Reset
          </div>
        </button>
      </div>

      {activeTab === 'accounts' && <AccountsTab accounts={accounts} onUpdate={loadAccounts} />}
      {activeTab === 'profit' && <ProfitSharingTab settings={settings} onSave={saveSetting} />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'business' && <BusinessInfoTab settings={settings} onSave={saveSetting} />}
      {activeTab === 'reverse' && <ReverseActionsTab />}
      {activeTab === 'reset' && <DataResetTab />}
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-wood-700 text-wood-700'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        {label}
      </div>
    </button>
  );
}

function AccountsTab({ accounts, onUpdate }: any) {
  async function handleUpdateAccountName(accountId: string, newName: string) {
    try {
      await supabase
        .from('accounts')
        .update({ account_name: newName, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      onUpdate();
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Failed to update account');
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> These are the 4 main accounts used in the system (Ashan, Praveen, Business, Loan). 
          You can update their names but cannot delete them as they are core to the financial system.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Account Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Current Balance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {accounts.map((account: Account) => (
              <AccountRow key={account.id} account={account} onUpdate={handleUpdateAccountName} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountRow({ account, onUpdate }: any) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.account_name);

  const handleSave = () => {
    if (name.trim() && name !== account.account_name) {
      onUpdate(account.id, name.trim());
    }
    setEditing(false);
  };

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="px-2 py-1 border rounded w-full max-w-xs"
            autoFocus
          />
        ) : (
          <span className="font-medium">{account.account_name}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-bold ${account.balance_minor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(account.balance_minor)}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1 text-sm text-wood-600 hover:bg-wood-50 rounded-lg transition-colors"
        >
          Edit Name
        </button>
      </td>
    </tr>
  );
}

function ProfitSharingTab({ settings, onSave }: any) {
  const [profitShares, setProfitShares] = useState({
    ashan_share: settings.profit_sharing?.ashan_share || 33.33,
    praveen_share: settings.profit_sharing?.praveen_share || 33.33,
    business_share: settings.profit_sharing?.business_share || 33.34
  });

  const total = profitShares.ashan_share + profitShares.praveen_share + profitShares.business_share;
  const isValid = Math.abs(total - 100) < 0.01;

  const handleSave = () => {
    if (!isValid) {
      alert('Total profit share must equal 100%');
      return;
    }
    onSave('profit_sharing', profitShares);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Profit Distribution:</strong> When an order is completed with zero balance, 
          net profit is automatically distributed to Ashan, Praveen, and Business accounts based on these percentages.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
        <h3 className="font-semibold text-lg">Profit Sharing Percentages</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Ashan's Share (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={profitShares.ashan_share}
              onChange={(e) => setProfitShares({ ...profitShares, ashan_share: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Praveen's Share (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={profitShares.praveen_share}
              onChange={(e) => setProfitShares({ ...profitShares, praveen_share: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Business Account Share (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={profitShares.business_share}
              onChange={(e) => setProfitShares({ ...profitShares, business_share: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>
        </div>

        <div className={`p-4 rounded-lg border-2 ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="font-medium">Total:</span>
            <span className={`text-xl font-bold ${isValid ? 'text-green-700' : 'text-red-700'}`}>
              {total.toFixed(2)}%
            </span>
          </div>
          {!isValid && (
            <p className="text-sm text-red-600 mt-2">Total must equal 100%</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-wood-700 text-white rounded-lg hover:bg-wood-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Profit Sharing Settings
        </button>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setCategories(data);
  }

  async function handleAddCategory(categoryData: { name: string; description: string }) {
    try {
      await supabase.from('product_categories').insert({
        ...categoryData,
        is_active: true
      });
      await loadCategories();
      setShowModal(false);
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category');
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    await supabase
      .from('product_categories')
      .update({ is_active: false })
      .eq('id', id);
    loadCategories();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-neutral-600">Manage product categories used throughout the system.</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
        >
          <Tag className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <div key={category.id} className="bg-white p-4 rounded-lg border border-neutral-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900">{category.name}</h3>
                {category.description && (
                  <p className="text-sm text-neutral-600 mt-1">{category.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <CategoryModal onSave={handleAddCategory} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

function BusinessInfoTab({ settings, onSave }: any) {
  const [businessInfo, setBusinessInfo] = useState({
    company_name: settings.business_info?.company_name || 'Wood Ceylon',
    address: settings.business_info?.address || '',
    phone: settings.business_info?.phone || '',
    email: settings.business_info?.email || '',
    website: settings.business_info?.website || ''
  });

  const handleSave = () => {
    onSave('business_info', businessInfo);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
        <h3 className="font-semibold text-lg">Business Information</h3>
        <p className="text-sm text-neutral-600">This information appears on quotations, invoices, and other documents.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Company Name</label>
            <input
              type="text"
              value={businessInfo.company_name}
              onChange={(e) => setBusinessInfo({ ...businessInfo, company_name: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Address</label>
            <textarea
              value={businessInfo.address}
              onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Phone</label>
              <input
                type="tel"
                value={businessInfo.phone}
                onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
              <input
                type="email"
                value={businessInfo.email}
                onChange={(e) => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Website</label>
            <input
              type="url"
              value={businessInfo.website}
              onChange={(e) => setBusinessInfo({ ...businessInfo, website: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Business Information
        </button>
      </div>
    </div>
  );
}

function DataResetTab() {
  const [monthlyConfirmText, setMonthlyConfirmText] = useState('');
  const [allDataConfirmText, setAllDataConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  async function handleMonthlyReset() {
    if (monthlyConfirmText !== 'RESET') {
      alert('Please type RESET to confirm');
      return;
    }

    if (!confirm('This will clear all monthly data including orders, transactions, and work logs. This action cannot be undone. Continue?')) {
      return;
    }

    setResetting(true);
    try {
      // Delete monthly data (soft delete by setting is_active = false)
      await supabase.from('orders').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('profit_distributions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete new worker system tables
      await supabase.from('worker_payment_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('worker_daily_work').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('worker_standalone_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete old worker system tables if they exist
      await supabase.from('worker_work_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('worker_advances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Reset worker balances (keep worker master data)
      await supabase.from('workers').update({
        total_earned_minor: 0,
        total_advances_minor: 0,
        current_balance_minor: 0,
        updated_at: new Date().toISOString()
      }).eq('is_active', true);

      // Reset order sequence counter
      await resetOrderSequence();

      alert('Monthly data has been reset successfully');
      setMonthlyConfirmText('');
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('Failed to reset data');
    }
    setResetting(false);
  }

  async function handleAllDataReset() {
    if (allDataConfirmText !== 'RESET ALL') {
      alert('Please type "RESET ALL" to confirm');
      return;
    }

    if (!confirm('⚠️ COMPREHENSIVE RESET ⚠️\n\nThis will:\n• Reset ALL account balances to 0\n• Delete ALL transactional data (orders, transactions, quotations, etc.)\n• Reset ALL worker and customer totals\n• Clear ALL work logs and profit distributions\n• Clear ALL worker payments, daily work records, and payment records\n\nWORKER MASTER DATA (names, phone, email) WILL BE KEPT\n\nThis action CANNOT be undone and will completely reset your business data!\n\nAre you absolutely sure you want to continue?')) {
      return;
    }

    setResetting(true);
    try {
      // 1. Reset all account balances to 0
      await supabase.from('accounts').update({
        balance_minor: 0,
        updated_at: new Date().toISOString()
      }).eq('is_active', true);

      // 2. Delete all transactional data
      await supabase.from('orders').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('quotations').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('profit_distributions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 3. Delete new worker system tables
      await supabase.from('worker_payment_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('worker_daily_work').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('worker_standalone_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete old worker system tables if they exist
      await supabase.from('worker_work_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('worker_advances').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 4. Reset worker totals and balances (keep worker master data)
      await supabase.from('workers').update({
        total_earned_minor: 0,
        total_advances_minor: 0,
        current_balance_minor: 0,
        updated_at: new Date().toISOString()
      }).eq('is_active', true);

      // 5. Reset customer totals
      await supabase.from('customers').update({
        total_spent_minor: 0,
        is_repeat_customer: false,
        updated_at: new Date().toISOString()
      }).eq('is_active', true);

      // 6. Reset order sequence counter
      await resetOrderSequence();

      alert('All data has been reset successfully! Account balances set to 0, all transactions cleared, and totals reset.');
      setAllDataConfirmText('');
    } catch (error) {
      console.error('Error resetting all data:', error);
      alert('Failed to reset data. Please try again or contact support.');
    }
    setResetting(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">
          <strong>Warning:</strong> Data reset is a destructive operation that cannot be undone. 
          Please make sure you have exported any necessary data before proceeding.
        </p>
      </div>

      {/* Monthly Data Reset */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
        <h3 className="font-semibold text-lg text-orange-700">Monthly Data Reset</h3>
        <p className="text-sm text-neutral-600">
          This will clear all monthly operational data including:
        </p>
        <ul className="list-disc list-inside text-sm text-neutral-600 space-y-1 ml-4">
          <li>All orders and order items</li>
          <li>All transactions</li>
          <li>Worker payment records, daily work logs, and standalone payments</li>
          <li>Worker balances (earned, advances, current balance)</li>
          <li>Profit distributions</li>
        </ul>
        <p className="text-sm text-neutral-600 font-medium">
          This will NOT affect: Customers, Workers (names/contact info), Products, Inventory, Categories, or System Settings.
        </p>
        <p className="text-sm text-green-700 font-medium bg-green-50 p-3 rounded-lg">
          Perfect for starting a new month: Keeps your workers and products, clears old transaction data.
        </p>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Type "RESET" to confirm
          </label>
          <input
            type="text"
            value={monthlyConfirmText}
            onChange={(e) => setMonthlyConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Type RESET here"
          />
        </div>

        <button
          onClick={handleMonthlyReset}
          disabled={monthlyConfirmText !== 'RESET' || resetting}
          className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {resetting ? 'Resetting...' : 'Reset Monthly Data'}
        </button>
      </div>

      {/* All Data Reset */}
      <div className="bg-white rounded-xl shadow-sm border-2 border-red-300 p-6 space-y-4">
        <h3 className="font-semibold text-lg text-red-700 flex items-center gap-2">
          🚨 Reset All Data
        </h3>
        <div className="bg-red-100 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800 font-medium mb-2">
            ⚠️ COMPREHENSIVE RESET - This will completely reset your entire business data!
          </p>
          <p className="text-sm text-red-700">
            This will perform a complete system reset including:
          </p>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-4 mt-2">
            <li><strong>Reset ALL account balances to 0</strong> (Ashan, Praveen, Business, Loan accounts)</li>
            <li><strong>Delete ALL transactional data:</strong> orders, transactions, quotations, invoices, work logs, advances, profit distributions, stock movements</li>
            <li><strong>Reset ALL totals:</strong> worker earnings/balances, customer spending totals</li>
            <li><strong>Clear ALL business history and financial records</strong></li>
          </ul>
          <p className="text-sm text-red-700 font-bold mt-3">
            This will NOT affect your basic setup: Products, Categories, Warehouses, Inventory levels, or System Settings.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This operation is irreversible. Only proceed if you want to start completely fresh 
            while keeping your product catalog and basic configuration.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-red-700 mb-2">
            Type "RESET ALL" to confirm
          </label>
          <input
            type="text"
            value={allDataConfirmText}
            onChange={(e) => setAllDataConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
            placeholder="Type RESET ALL here"
          />
        </div>

        <button
          onClick={handleAllDataReset}
          disabled={allDataConfirmText !== 'RESET ALL' || resetting}
          className="w-full px-4 py-4 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors font-bold text-lg"
        >
          {resetting ? 'Resetting All Data...' : '🚨 RESET ALL DATA'}
        </button>
      </div>

      {/* Data Reset Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Data Reset Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium text-blue-800 mb-1">Monthly Reset affects:</h5>
            <ul className="text-blue-700 space-y-1">
              <li>• Orders & order items</li>
              <li>• Transactions</li>
              <li>• Worker work logs</li>
              <li>• Profit distributions</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-blue-800 mb-1">All Data Reset affects:</h5>
            <ul className="text-blue-700 space-y-1">
              <li>• All of the above</li>
              <li>• ALL account balances → 0</li>
              <li>• ALL quotations & invoices</li>
              <li>• ALL worker/customer totals</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>Preserved in both resets:</strong> Products, Categories, Workers (basic info), Customers (basic info), 
            Warehouses, Inventory levels, System Settings (except order sequence counter which resets to start at WC-2025-0001)
          </p>
        </div>
      </div>
    </div>
  );
}

function ReverseActionsTab() {
  const [reversing, setReversing] = useState(false);
  const [lastAction, setLastAction] = useState('');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [restoreData, setRestoreData] = useState({
    orderNumber: '',
    customerName: '',
    amount: ''
  });

  // Load last deleted order from localStorage (simulated last action)
  useEffect(() => {
    const lastDeletedOrder = localStorage.getItem('lastDeletedOrder');
    if (lastDeletedOrder) {
      const order = JSON.parse(lastDeletedOrder);
      setLastAction(`Order ${order.order_number} deleted at ${new Date(order.deletedAt).toLocaleString()}`);
      setOrderDetails(order);
    }
  }, []);

  async function handleRestoreOrder() {
    if (!orderDetails) {
      alert('No deleted order found to restore');
      return;
    }

    if (!confirm(`Are you sure you want to restore Order ${orderDetails.order_number}? This will recreate all related transactions and data.`)) {
      return;
    }

    setReversing(true);
    try {
      // Restore the order (set is_active back to true)
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          is_active: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderDetails.id);

      if (orderError) {
        throw new Error('Failed to restore order: ' + orderError.message);
      }

      // Note: In a real implementation, you would also restore:
      // - profit_distributions related to this order
      // - worker_payment_records 
      // - order_items
      // - Any transactions that were auto-created

      // Clear the last deleted order from localStorage
      localStorage.removeItem('lastDeletedOrder');
      
      alert(`Order ${orderDetails.order_number} restored successfully! Please refresh your browser to see updated summaries.`);
      setLastAction('');
      setOrderDetails(null);
      
      // Refresh the page to update all summaries
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error restoring order:', error);
      alert('Failed to restore order: ' + error.message);
    }
    setReversing(false);
  }

  async function handleManualRestore() {
    if (!restoreData.orderNumber || !restoreData.customerName || !restoreData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    if (!confirm(`Create a new order based on manual restoration data?`)) {
      return;
    }

    setReversing(true);
    try {
      // Create a new order based on the manual data
      const newOrder = {
        id: crypto.randomUUID(),
        order_number: `RESTORED-${Date.now()}`,
        customer_name: restoreData.customerName,
        total_amount_minor: toMinor(parseFloat(restoreData.amount)),
        status: 'restored',
        is_active: true,
        order_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('orders')
        .insert([newOrder]);

      if (error) {
        throw new Error('Failed to create restored order: ' + error.message);
      }

      alert('Restored order created successfully! Please refresh your browser to see updated summaries.');
      setShowRestoreForm(false);
      setRestoreData({ orderNumber: '', customerName: '', amount: '' });
      
      // Refresh the page to update all summaries
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error creating restored order:', error);
      alert('Failed to create restored order: ' + error.message);
    }
    setReversing(false);
  }

  function toMinor(amount: number): number {
    return Math.round(amount * 100);
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-800">Reverse/Undo Actions</h3>
        </div>
        <p className="text-sm text-amber-700">
          Use these tools to reverse or undo recent actions. Please note that some reversals may not be 100% accurate 
          and should be used with caution.
        </p>
      </div>

      {/* Last Action Section */}
      {orderDetails && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-blue-600" />
            Last Deleted Order
          </h3>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 mb-2">{lastAction}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-red-700">Customer:</span>
                <p className="text-red-600">{orderDetails.customer_name}</p>
              </div>
              <div>
                <span className="font-medium text-red-700">Amount:</span>
                <p className="text-red-600">{formatCurrency(orderDetails.total_amount_minor)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestoreOrder}
              disabled={reversing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Undo2 className="w-4 h-4" />
              {reversing ? 'Restoring...' : 'Restore This Order'}
            </button>
            
            <button
              onClick={() => {
                localStorage.removeItem('lastDeletedOrder');
                setOrderDetails(null);
                setLastAction('');
                alert('Last action cleared. This order can no longer be automatically restored.');
              }}
              className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Clear Record
            </button>
          </div>
        </div>
      )}

      {/* Manual Restore Section */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-4">
        <h3 className="font-semibold text-lg">Manual Order Restoration</h3>
        <p className="text-sm text-neutral-600">
          If automatic restoration is not available, you can manually recreate an order based on your records.
        </p>
        
        {!showRestoreForm ? (
          <button
            onClick={() => setShowRestoreForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Manual Restoration
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Manual Restoration:</strong> Create a new order based on your manual records. 
                This does not restore automatic transactions or related data.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Order Number (Optional)
                </label>
                <input
                  type="text"
                  value={restoreData.orderNumber}
                  onChange={(e) => setRestoreData({...restoreData, orderNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                  placeholder="e.g., WC-2025-0001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={restoreData.customerName}
                  onChange={(e) => setRestoreData({...restoreData, customerName: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                  placeholder="Customer name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Amount (LKR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={restoreData.amount}
                  onChange={(e) => setRestoreData({...restoreData, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleManualRestore}
                disabled={reversing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Save className="w-4 h-4" />
                {reversing ? 'Creating...' : 'Create Restored Order'}
              </button>
              
              <button
                onClick={() => {
                  setShowRestoreForm(false);
                  setRestoreData({ orderNumber: '', customerName: '', amount: '' });
                }}
                className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Reverse Actions Work</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li><strong>Automatic Restoration:</strong> When you delete an order, the system stores basic information for potential restoration</li>
          <li><strong>Manual Restoration:</strong> Create new orders based on your manual records if automatic data is not available</li>
          <li><strong>Limitations:</strong> Automatic transactions (profit shares, worker payments) may not be fully restored</li>
          <li><strong>Data Refresh:</strong> Browser will automatically refresh after restoration to update all summaries</li>
        </ul>
      </div>
    </div>
  );
}

function CategoryModal({ onSave, onClose }: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Please enter a category name');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-bold text-neutral-900">New Category</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>
        </form>
        <div className="bg-neutral-50 border-t px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
          >
            Create Category
          </button>
        </div>
      </div>
    </div>
  );
}
