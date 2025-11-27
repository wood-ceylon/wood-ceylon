import React, { useState, useEffect } from 'react';
import { Plus, Download, Search, Filter, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toMinor, fromMinor, formatCurrency } from '../lib/utils';
import { Transaction, Account } from '../lib/types';
import TransactionModal from '../components/TransactionModal';

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'transfer'>('income');
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    transactionType: '',
    accountType: '',
    accountName: '',
    category: '',
    minAmount: '',
    maxAmount: ''
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      loadTransactions();
    }
  }, [accounts]);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  async function loadAccounts() {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('account_name');

    if (error) {
      console.error('Error loading accounts:', error);
    } else {
      setAccounts(data || []);
    }
  }

  async function loadTransactions() {
    setLoading(true);
    try {
      // Use simple query first to avoid foreign key join issues
      const { data: txns, error } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (error) {
        console.error('Error loading transactions:', error);
        setTransactions([]);
      } else if (txns) {
        // Enrich transaction data with account information
        const enriched = txns.map(txn => ({
          ...txn,
          from_account_name: accounts.find(a => a.id === txn.from_account_id)?.account_name || 'N/A',
          to_account_name: accounts.find(a => a.id === txn.to_account_id)?.account_name || 'N/A',
          account_type: accounts.find(a => 
            a.id === txn.from_account_id || a.id === txn.to_account_id
          )?.account_type || 'personal'
        }));
        setTransactions(enriched);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      // If everything fails, show empty array
      setTransactions([]);
    }
    setLoading(false);
  }

  function applyFilters() {
    let filtered = [...transactions];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(txn => 
        txn.description?.toLowerCase().includes(searchLower) ||
        txn.category?.toLowerCase().includes(searchLower) ||
        txn.transaction_number?.toLowerCase().includes(searchLower) ||
        txn.from_account_name?.toLowerCase().includes(searchLower) ||
        txn.to_account_name?.toLowerCase().includes(searchLower)
      );
    }

    // Date filters
    if (filters.dateFrom) {
      filtered = filtered.filter(txn => new Date(txn.transaction_date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(txn => new Date(txn.transaction_date) <= new Date(filters.dateTo + 'T23:59:59'));
    }

    // Transaction type filter
    if (filters.transactionType) {
      filtered = filtered.filter(txn => txn.transaction_type === filters.transactionType);
    }

    // Account type filter
    if (filters.accountType) {
      filtered = filtered.filter(txn => {
        const fromAccount = accounts.find(a => a.id === txn.from_account_id);
        const toAccount = accounts.find(a => a.id === txn.to_account_id);
        return fromAccount?.account_type === filters.accountType || toAccount?.account_type === filters.accountType;
      });
    }

    // Account name filter
    if (filters.accountName) {
      const accountNameLower = filters.accountName.toLowerCase();
      filtered = filtered.filter(txn => {
        const fromAccount = accounts.find(a => a.id === txn.from_account_id);
        const toAccount = accounts.find(a => a.id === txn.to_account_id);
        return fromAccount?.account_name.toLowerCase().includes(accountNameLower) ||
               toAccount?.account_name.toLowerCase().includes(accountNameLower);
      });
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(txn => txn.category === filters.category);
    }

    // Amount filters
    if (filters.minAmount) {
      filtered = filtered.filter(txn => txn.amount_minor >= toMinor(parseFloat(filters.minAmount)));
    }
    if (filters.maxAmount) {
      filtered = filtered.filter(txn => txn.amount_minor <= toMinor(parseFloat(filters.maxAmount)));
    }

    setFilteredTransactions(filtered);
  }

  function getActiveFiltersCount() {
    return Object.values(filters).filter(value => value !== '').length;
  }

  function clearFilters() {
    setFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      transactionType: '',
      accountType: '',
      accountName: '',
      category: '',
      minAmount: '',
      maxAmount: ''
    });
  }

  function exportToCSV() {
    const headers = ['Transaction ID', 'Date', 'Type', 'From Account', 'To Account', 'Amount (LKR)', 'Category', 'Description'];
    const rows = filteredTransactions.map(txn => [
      txn.transaction_number || '',
      new Date(txn.transaction_date).toLocaleDateString(),
      txn.transaction_type,
      txn.from_account_name || '',
      txn.to_account_name || '',
      fromMinor(txn.amount_minor).toFixed(2),
      txn.category || '',
      txn.description || ''
    ]);

    const totalIncome = filteredTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + fromMinor(t.amount_minor), 0);
    const totalExpense = filteredTransactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + fromMinor(t.amount_minor), 0);

    const csvContent = [
      ...[headers],
      ...rows,
      [],
      [`SUMMARY`, '', '', '', '', '', '', ''],
      [`Total Income:`, '', '', '', '', totalIncome.toFixed(2), '', ''],
      [`Total Expense:`, '', '', '', '', totalExpense.toFixed(2), '', ''],
      [`Net Amount:`, '', '', '', '', (totalIncome - totalExpense).toFixed(2), '', '']
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function generateTransactionNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getTime().toString().slice(-4);
    return `TXN${year}${month}${day}${time}`;
  }

  async function handleSaveTransaction(transactionData: any) {
    try {
      console.log('Transactions - Received transaction data:', transactionData);
      
      // Validate required fields first
      if (!transactionData) {
        throw new Error('No transaction data provided');
      }

      if (!transactionData.transaction_type) {
        throw new Error('Transaction type is required');
      }

      if (!transactionData.amount || isNaN(parseFloat(transactionData.amount)) || parseFloat(transactionData.amount) <= 0) {
        throw new Error('Valid amount is required');
      }

      if (!transactionData.category) {
        throw new Error('Category is required - please select from the dropdown');
      }
      
      // Ensure we have a clean, serializable object
      const cleanTransactionData = {
        transaction_type: String(transactionData.transaction_type || '').trim(),
        amount: String(transactionData.amount || '0').trim(),
        description: String(transactionData.description || '').trim(),
        category: String(transactionData.category || '').trim(),
        payment_method: String(transactionData.payment_method || 'cash').trim(),
        transaction_date: String(transactionData.transaction_date || new Date().toISOString().split('T')[0]).trim(),
        from_account_id: transactionData.from_account_id && 
                        transactionData.from_account_id.trim() !== '' && 
                        transactionData.from_account_id !== 'null' 
          ? transactionData.from_account_id.trim() 
          : null,
        to_account_id: transactionData.to_account_id && 
                      transactionData.to_account_id.trim() !== '' && 
                      transactionData.to_account_id !== 'null' 
          ? transactionData.to_account_id.trim() 
          : null,
      };

      console.log('Transactions - Clean transaction data:', cleanTransactionData);

      // Validate UUIDs if provided
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (cleanTransactionData.from_account_id && !uuidRegex.test(cleanTransactionData.from_account_id)) {
        throw new Error('Invalid from account ID format');
      }
      
      if (cleanTransactionData.to_account_id && !uuidRegex.test(cleanTransactionData.to_account_id)) {
        throw new Error('Invalid to account ID format');
      }

      // Validate transaction type
      const validTypes = ['income', 'expense', 'transfer'];
      if (!validTypes.includes(cleanTransactionData.transaction_type)) {
        throw new Error('Invalid transaction type');
      }

      const amount = parseFloat(cleanTransactionData.amount);
      if (amount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      // Convert amount to minor units
      const amountMinor = toMinor(amount);
      if (amountMinor <= 0) {
        throw new Error('Invalid amount after conversion');
      }

      if (transactionData.id) {
        // Update existing transaction
        const { error } = await supabase
          .from('transactions')
          .update({
            transaction_type: cleanTransactionData.transaction_type,
            amount_minor: amountMinor,
            description: cleanTransactionData.description,
            category: cleanTransactionData.category,
            payment_method: cleanTransactionData.payment_method,
            transaction_date: cleanTransactionData.transaction_date,
            from_account_id: cleanTransactionData.from_account_id,
            to_account_id: cleanTransactionData.to_account_id,
          })
          .eq('id', transactionData.id);

        if (error) {
          console.error('Supabase update error:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      } else {
        // Create new transaction
        const { error } = await supabase
          .from('transactions')
          .insert([{
            id: crypto.randomUUID(),
            transaction_number: generateTransactionNumber(),
            transaction_type: cleanTransactionData.transaction_type,
            amount_minor: amountMinor,
            description: cleanTransactionData.description,
            category: cleanTransactionData.category,
            payment_method: cleanTransactionData.payment_method,
            transaction_date: cleanTransactionData.transaction_date,
            from_account_id: cleanTransactionData.from_account_id,
            to_account_id: cleanTransactionData.to_account_id,
            reference_type: null,
            reference_id: null,
          }]);

        if (error) {
          console.error('Supabase insert error:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      }

      console.log('Transaction saved successfully!');
      await loadTransactions();
      setShowModal(false);
      
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert('Error saving transaction: ' + errorMessage);
    }
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    if (!transaction) return;

    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;

      loadTransactions();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      alert('Error deleting transaction: ' + error.message);
    }
  }

  const availableCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();

  // Add predefined categories from the modal to the filter dropdown
  const predefinedCategories = [
    'Office Supplies',
    'Utilities',
    'Rent',
    'Salaries',
    'Marketing',
    'Travel',
    'Meals',
    'Transportation',
    'Equipment',
    'Maintenance',
    'Insurance',
    'Professional Services',
    'Software & Tools',
    'Materials',
    'Sales',
    'Services',
    'Investment',
    'Loan Payment',
    'Other Income',
    'Other Expense'
  ];
  
  const allCategories = [...new Set([...availableCategories, ...predefinedCategories])].sort();

  // Helper function to handle navigation with error recovery
  const handleNavigation = (path: string) => {
    try {
      navigate(path);
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback: direct window navigation
      window.location.href = path;
    }
  };

  // Debug: Log current navigation status
  useEffect(() => {
    console.log('Transactions page loaded successfully');
    console.log('Navigation available:', typeof navigate !== 'undefined');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Transactions</h1>
          <p className="text-neutral-500">
            Track income, expenses, and account transfers
            {filteredTransactions.length !== transactions.length && (
              <span className="ml-2 text-sm text-wood-600">
                ({filteredTransactions.length} of {transactions.length} shown)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV ({filteredTransactions.length})
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

      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-wood-700" />
            <h3 className="text-lg font-semibold text-neutral-900">Filter Transactions</h3>
            {getActiveFiltersCount() > 0 && (
              <span className="bg-wood-100 text-wood-700 text-xs px-2 py-1 rounded-full font-medium">
                {getActiveFiltersCount()} active
              </span>
            )}
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Clear All ({getActiveFiltersCount()})
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search description, category..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              />
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Transaction Type</label>
            <select
              value={filters.transactionType}
              onChange={(e) => setFilters({...filters, transactionType: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            >
              <option value="">All Categories</option>
              {allCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Account</label>
            <select
              value={filters.accountName}
              onChange={(e) => setFilters({...filters, accountName: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.account_name}>{account.account_name}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>

          {/* Min Amount */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Min Amount (LKR)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.minAmount}
              onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>

          {/* Max Amount */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Max Amount (LKR)</label>
            <input
              type="number"
              step="0.01"
              placeholder="999999.99"
              value={filters.maxAmount}
              onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>
        </div>
      </div>

      {/* Account Balances */}
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

      {/* Debug Info (only show if accounts array is empty) */}
      {accounts.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ No accounts loaded. This might be a database connection issue.
          </p>
        </div>
      )}

      {/* Debug Info for transactions */}
      {!loading && transactions.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            ℹ️ No transactions found. You can add new transactions using the "New Transaction" button.
          </p>
        </div>
      )}

      {/* Debug Info for data counts */}
      {accounts.length > 0 && transactions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-700 text-xs">
            📊 Debug: {accounts.length} accounts loaded, {transactions.length} transactions loaded, {filteredTransactions.length} after filtering
          </p>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">Transaction ID</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">Type</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">From/To</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">Amount</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">Category</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-900">Description</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm text-neutral-900">
                      {transaction.transaction_number || transaction.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.transaction_type === 'income' 
                          ? 'bg-green-100 text-green-700'
                          : transaction.transaction_type === 'expense'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="space-y-1">
                        {transaction.transaction_type === 'transfer' ? (
                          <>
                            <div className="text-red-600">→ {transaction.to_account_name}</div>
                            <div className="text-green-600">← {transaction.from_account_name}</div>
                          </>
                        ) : (
                          <div className="text-neutral-900">
                            {transaction.from_account_name || transaction.to_account_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <span className={transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.transaction_type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount_minor)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {transaction.category || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {transaction.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setTransactionType(transaction.transaction_type);
                            // You'd populate modal with transaction data for editing
                            setShowModal(true);
                          }}
                          className="text-wood-600 hover:text-wood-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
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
};

export default Transactions;