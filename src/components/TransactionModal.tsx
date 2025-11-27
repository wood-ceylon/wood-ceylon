import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Account } from '../lib/types';

interface TransactionModalProps {
  accounts: Account[];
  transactionType: 'income' | 'expense' | 'transfer';
  setTransactionType: (type: 'income' | 'expense' | 'transfer') => void;
  onSave: (transaction: any) => void;
  onClose: () => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({
  accounts,
  transactionType,
  setTransactionType,
  onSave,
  onClose
}) => {
  const [formData, setFormData] = useState({
    transaction_type: transactionType,
    amount: '',
    description: '',
    category: '',
    payment_method: 'cash',
    transaction_date: new Date().toISOString().split('T')[0],
    from_account_id: '',
    to_account_id: '',
  });

  const categories = [
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

  useEffect(() => {
    setFormData(prev => ({ ...prev, transaction_type: transactionType }));
  }, [transactionType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (transactionType === 'expense' && !formData.from_account_id) {
      alert('Please select a from account for expenses');
      return;
    }

    if (transactionType === 'income' && !formData.to_account_id) {
      alert('Please select a to account for income');
      return;
    }

    if (transactionType === 'transfer' && (!formData.from_account_id || !formData.to_account_id)) {
      alert('Please select both from and to accounts for transfers');
      return;
    }

    // Create a clean, serializable object to prevent circular references
    const cleanFormData = {
      transaction_type: String(formData.transaction_type || ''),
      amount: String(formData.amount || '0'),
      description: String(formData.description || ''),
      category: String(formData.category || ''),
      payment_method: String(formData.payment_method || 'cash'),
      transaction_date: String(formData.transaction_date || new Date().toISOString().split('T')[0]),
      from_account_id: formData.from_account_id && formData.from_account_id.trim() !== '' 
        ? formData.from_account_id 
        : null,
      to_account_id: formData.to_account_id && formData.to_account_id.trim() !== '' 
        ? formData.to_account_id 
        : null,
    };

    console.log('TransactionModal - clean form data:', cleanFormData);
    onSave(cleanFormData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {transactionType === 'income' ? 'New Income' : transactionType === 'expense' ? 'New Expense' : 'New Transfer'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Transaction Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Transaction Type</label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as any)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 bg-white"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Amount (LKR) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              placeholder="0.00"
            />
          </div>

          {/* From Account (for expense/transfer) */}
          {(transactionType === 'expense' || transactionType === 'transfer') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                From Account {transactionType === 'expense' ? '*' : ''}
              </label>
              <select
                required={transactionType === 'expense'}
                value={formData.from_account_id}
                onChange={(e) => setFormData({...formData, from_account_id: e.target.value})}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 bg-white"
              >
                <option value="">Select Account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} ({account.account_type})
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">No accounts available - please check database connection</p>
              )}
            </div>
          )}

          {/* To Account (for income/transfer) */}
          {(transactionType === 'income' || transactionType === 'transfer') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                To Account {transactionType === 'income' ? '*' : ''}
              </label>
              <select
                required={transactionType === 'income'}
                value={formData.to_account_id}
                onChange={(e) => setFormData({...formData, to_account_id: e.target.value})}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 bg-white"
              >
                <option value="">Select Account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} ({account.account_type})
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">No accounts available - please check database connection</p>
              )}
            </div>
          )}

          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 bg-white"
              required
            >
              <option value="">Select Category *</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <p className="text-sm text-neutral-500 mt-1">Choose a category from the dropdown</p>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              rows={3}
              placeholder="Enter transaction description..."
            />
          </div>

          {/* Payment Method */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 bg-white"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
            </select>
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Date</label>
            <input
              type="date"
              required
              value={formData.transaction_date}
              onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;