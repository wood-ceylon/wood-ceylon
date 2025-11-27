import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency, generateTransactionNumber, toMinor, fromMinor } from '../lib/supabase';
import { Transaction, Account } from '../lib/types';
import { Plus, ArrowUpRight, ArrowDownRight, RefreshCw, Download, Trash2 } from 'lucide-react';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'transfer'>('income');

  useEffect(() => {
    loadTransactions();
    loadAccounts();
  }, []);

  async function loadTransactions() {
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (txns) {
      // Only process transactions if accounts are already loaded
      if (accounts.length > 0) {
        const txnsWithAccounts = txns.map(t => ({
          ...t,
          from_account_name: accounts.find(a => a.id === t.from_account_id)?.account_name,
          to_account_name: accounts.find(a => a.id === t.to_account_id)?.account_name
        }));
        setTransactions(txnsWithAccounts);
      } else {
        // If accounts not loaded yet, set transactions without account names
        setTransactions(txns);
      }
    }
    setLoading(false);
  }

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_name');
    if (data) {
      // Sort accounts to ensure loan accounts appear last
      const sortedAccounts = data.sort((a, b) => {
        if (a.account_type === 'loan' && b.account_type !== 'loan') return 1;
        if (a.account_type !== 'loan' && b.account_type === 'loan') return -1;
        return a.account_name.localeCompare(b.account_name);
      });
      setAccounts(sortedAccounts);
      // Always reload transactions when accounts are loaded to ensure proper account names
      loadTransactions();
    }
  }

  async function handleSaveTransaction(txnData: Partial<Transaction>) {
    try {
      // Always generate transaction number if not provided
      let finalTxnData = { ...txnData };
      if (!txnData.transaction_number) {
        finalTxnData.transaction_number = await generateTransactionNumber();
      }
      
      // Clean up the data to ensure proper null handling
      const cleanedTxnData = {
        transaction_date: finalTxnData.transaction_date,
        transaction_type: finalTxnData.transaction_type,
        from_account_id: finalTxnData.from_account_id || null,
        to_account_id: finalTxnData.to_account_id || null,
        amount_minor: finalTxnData.amount_minor,
        description: finalTxnData.description || null,
        category: finalTxnData.category || null,
        reference_type: finalTxnData.reference_type || null,
        reference_id: finalTxnData.reference_id || null,
        payment_method: finalTxnData.payment_method || 'cash',
        transaction_number: finalTxnData.transaction_number
      };
      
      console.log('Inserting transaction:', cleanedTxnData);
      const { data, error } = await supabase.from('transactions').insert(cleanedTxnData).select();
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      console.log('Transaction inserted successfully:', data);

      // Update account balances only if transaction was successful
      if (txnData.transaction_type === 'income' && txnData.to_account_id) {
        const account = accounts.find(a => a.id === txnData.to_account_id);
        if (account) {
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: account.balance_minor + (txnData.amount_minor || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', txnData.to_account_id);
        }
      } else if (txnData.transaction_type === 'expense' && txnData.from_account_id) {
        const account = accounts.find(a => a.id === txnData.from_account_id);
        if (account) {
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: account.balance_minor - (txnData.amount_minor || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', txnData.from_account_id);
        }
      } else if (txnData.transaction_type === 'transfer' && txnData.from_account_id && txnData.to_account_id) {
        const fromAccount = accounts.find(a => a.id === txnData.from_account_id);
        const toAccount = accounts.find(a => a.id === txnData.to_account_id);
        if (fromAccount && toAccount) {
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: fromAccount.balance_minor - (txnData.amount_minor || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', txnData.from_account_id);
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: toAccount.balance_minor + (txnData.amount_minor || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', txnData.to_account_id);
        }
      }

      // Close modal and reload data
      setShowModal(false);
      await loadTransactions();
      await loadAccounts();
    } catch (error) {
      console.error('Error saving transaction:', error);
      const errorMessage = error?.message || 'Failed to save transaction';
      alert(`Failed to save transaction: ${errorMessage}`);
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) return;
    
    // Prevent deletion of profit distribution transactions
    if (transaction.category === 'profit_distribution' || transaction.reference_type === 'profit_share') {
      alert('Profit distribution transactions cannot be deleted. They are automatically created when orders are completed.');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
      
      if (error) throw error;
      
      // Update account balances
      if (transaction.transaction_type === 'income' && transaction.to_account_id) {
        const account = accounts.find(a => a.id === transaction.to_account_id);
        if (account) {
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: account.balance_minor - transaction.amount_minor,
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.to_account_id);
        }
      } else if (transaction.transaction_type === 'expense' && transaction.from_account_id) {
        const account = accounts.find(a => a.id === transaction.from_account_id);
        if (account) {
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: account.balance_minor + transaction.amount_minor,
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.from_account_id);
        }
      } else if (transaction.transaction_type === 'transfer' && transaction.from_account_id && transaction.to_account_id) {
        const fromAccount = accounts.find(a => a.id === transaction.from_account_id);
        const toAccount = accounts.find(a => a.id === transaction.to_account_id);
        if (fromAccount && toAccount) {
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: fromAccount.balance_minor + transaction.amount_minor,
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.from_account_id);
          await supabase
            .from('accounts')
            .update({ 
              balance_minor: toAccount.balance_minor - transaction.amount_minor,
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.to_account_id);
        }
      }
      
      await loadTransactions();
      await loadAccounts();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    }
  }

  function exportToCSV() {
    const headers = ['Date', 'Type', 'From Account', 'To Account', 'Amount', 'Category', 'Description'];
    const rows = transactions.map(t => [
      t.transaction_date,
      t.transaction_type,
      t.from_account_name || '-',
      t.to_account_name || '-',
      fromMinor(t.amount_minor),
      t.category || '-',
      t.description || '-'
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Transactions</h1>
          <p className="text-neutral-500">Track income, expenses, and account transfers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {accounts.map(account => (
          <div key={account.id} className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
            <div className="text-sm text-neutral-500">{account.account_name}</div>
            <div className="text-2xl font-bold text-neutral-900 mt-1">
              {formatCurrency(account.balance_minor)}
            </div>
            <div className="text-xs text-neutral-400 mt-1 capitalize">{account.account_type}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">From/To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No transactions yet</td></tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">{new Date(txn.transaction_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {txn.transaction_type === 'income' ? (
                          <ArrowUpRight className="w-4 h-4 text-green-600" />
                        ) : txn.transaction_type === 'expense' ? (
                          <ArrowDownRight className="w-4 h-4 text-red-600" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="capitalize">{txn.transaction_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {txn.transaction_type === 'transfer' 
                        ? `${txn.from_account_name} → ${txn.to_account_name}`
                        : txn.from_account_name || txn.to_account_name || '-'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${
                      txn.transaction_type === 'income' ? 'text-green-600' : 
                      txn.transaction_type === 'expense' ? 'text-red-600' : 
                      'text-blue-600'
                    }`}>
                      {formatCurrency(txn.amount_minor)}
                    </td>
                    <td className="px-4 py-3">
                      {(txn.category === 'profit_distribution' || txn.reference_type === 'profit_share') ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                          Profit Distribution
                        </span>
                      ) : txn.category ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full capitalize">
                          {txn.category}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {txn.description ? (
                        <div className="max-w-xs">
                          <div 
                            className="text-sm text-neutral-600 truncate" 
                            title={txn.description}
                          >
                            {txn.description}
                          </div>
                          {txn.description.length > 50 && (
                            <div className="text-xs text-neutral-400 italic">
                              (hover to see full description)
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(txn.category === 'profit_distribution' || txn.reference_type === 'profit_share') ? (
                          <span 
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full cursor-help" 
                            title="This transaction was automatically created when an order was completed"
                          >
                            System
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteTransaction(txn.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <TransactionModal
          accounts={accounts}
          transactionType={transactionType}
          setTransactionType={setTransactionType}
          onSave={handleSaveTransaction}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function TransactionModal({ accounts, transactionType, setTransactionType, onSave, onClose }: any) {
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: transactionType,
    from_account_id: null,
    to_account_id: null,
    amount: 0,
    category: '',
    description: '',
    payment_method: 'cash',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">New Transaction</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {['income', 'expense', 'transfer'].map(type => (
              <button
                key={type}
                onClick={() => {
                  setTransactionType(type);
                  setFormData({ 
                    ...formData, 
                    transaction_type: type,
                    from_account_id: null,
                    to_account_id: null
                  });
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium capitalize ${
                  formData.transaction_type === type
                    ? 'bg-wood-700 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              required
            />
          </div>
          {formData.transaction_type === 'transfer' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">From Account</label>
                <select
                  value={formData.from_account_id || ''}
                  onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a: Account) => (
                    <option key={a.id} value={a.id}>{a.account_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">To Account</label>
                <select
                  value={formData.to_account_id || ''}
                  onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a: Account) => (
                    <option key={a.id} value={a.id}>{a.account_name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {formData.transaction_type === 'income' ? 'To Account' : 'From Account'}
              </label>
              <select
                value={formData.transaction_type === 'income' ? (formData.to_account_id || '') : (formData.from_account_id || '')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  [formData.transaction_type === 'income' ? 'to_account_id' : 'from_account_id']: e.target.value || null 
                })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                required
              >
                <option value="">Select account</option>
                {accounts.map((a: Account) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Amount (LKR)</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              required
            />
          </div>
          <CategoryDropdown
            value={formData.category}
            onChange={(category) => setFormData({ ...formData, category })}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>
        </div>
        <div className="bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Validate form before submission
              if (!formData.amount || formData.amount <= 0) {
                alert('Please enter a valid amount');
                return;
              }
              
              // Validate account selection based on transaction type
              if (formData.transaction_type === 'income' && !formData.to_account_id) {
                alert('Please select a destination account for income');
                return;
              }
              
              if (formData.transaction_type === 'expense' && !formData.from_account_id) {
                alert('Please select a source account for expense');
                return;
              }
              
              if (formData.transaction_type === 'transfer' && (!formData.from_account_id || !formData.to_account_id)) {
                alert('Please select both source and destination accounts for transfer');
                return;
              }
              
              onSave({ ...formData, amount_minor: toMinor(formData.amount) });
            }}
            disabled={!formData.amount}
            className="px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors disabled:opacity-50"
          >
            Create Transaction
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryDropdown({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  // Common categories for transactions
  const commonCategories = [
    'Materials',
    'Labor',
    'Sales',
    'Utilities',
    'Rent',
    'Transportation',
    'Office Supplies',
    'Marketing',
    'Equipment',
    'Insurance',
    'Taxes',
    'Maintenance',
    'Consulting',
    'Commission',
    'Revenue',
    'Service Fee',
    'Interest',
    'Investment',
    'Dividend',
    'Other'
  ];

  useEffect(() => {
    // Load existing categories from transactions
    const loadCategories = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('category')
        .not('category', 'is', null);
      
      if (data) {
        const existingCategories = data
          .map(t => t.category)
          .filter((category): category is string => category !== null)
          .filter((category, index, arr) => arr.indexOf(category) === index)
          .sort();
        setCategories([...new Set([...commonCategories, ...existingCategories])]);
      }
    };
    loadCategories();
  }, []);

  const handleCreateCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updatedCategories = [...categories, newCategory.trim()].sort();
      setCategories(updatedCategories);
    }
    onChange(newCategory.trim());
    setNewCategory('');
    setIsOpen(false);
  };

  const handleSelectCategory = (category: string) => {
    onChange(category);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Select or enter category"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 pr-10"
          onFocus={() => setIsOpen(true)}
          readOnly
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {categories.map((category) => (
            <div
              key={category}
              onClick={() => handleSelectCategory(category)}
              className="px-3 py-2 hover:bg-neutral-50 cursor-pointer text-sm"
            >
              {category}
            </div>
          ))}
          <div className="border-t border-neutral-200 p-2">
            <div className="text-xs text-neutral-500 mb-1">Add new category:</div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="flex-1 px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-wood-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
              />
              <button
                onClick={handleCreateCategory}
                disabled={!newCategory.trim()}
                className="px-2 py-1 text-xs bg-wood-700 text-white rounded hover:bg-wood-800 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
