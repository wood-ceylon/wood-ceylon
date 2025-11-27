import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency } from '../lib/supabase';
import { Customer } from '../lib/types';
import { Plus, Edit, Trash2, Search, Download } from 'lucide-react';
import { showSuccess, showError } from '../lib/toast';
import { exportToCSV } from '../lib/export';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setCustomers(data);
    setLoading(false);
  }

  async function handleSaveCustomer(customerData: Partial<Customer>) {
    try {
      let result;
      if (editingCustomer) {
        result = await supabase
          .from('customers')
          .update({ ...customerData, updated_at: new Date().toISOString() })
          .eq('id', editingCustomer.id)
          .select();
      } else {
        result = await supabase
          .from('customers')
          .insert(customerData)
          .select();
      }
      
      if (result.error) {
        console.error('Error saving customer:', result.error);
        showError(`Failed to save customer: ${result.error.message}`);
        return;
      }
      
      console.log('Customer saved successfully:', result.data);
      showSuccess(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');
      await loadCustomers();
      setShowModal(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      showError('Failed to save customer: ' + (error as Error).message);
    }
  }

  async function handleDeleteCustomer(id: string) {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
    if (error) {
      showError('Failed to delete customer');
    } else {
      showSuccess('Customer deleted successfully');
      loadCustomers();
    }
  }

  function handleExportCSV() {
    if (customers.length === 0) {
      showError('No customers to export');
      return;
    }
    const success = exportToCSV(
      customers,
      'customers',
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'city', label: 'City' },
        { key: 'country', label: 'Country' },
        { key: 'address', label: 'Address' },
        { key: 'total_spent_minor', label: 'Total Spent (Minor)' },
      ]
    );
    if (success) {
      showSuccess('Customers exported to CSV');
    } else {
      showError('Failed to export customers');
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customers</h1>
          <p className="text-neutral-500">Manage customer information and relationships</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">City</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase bg-wood-50">Country</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Total Spent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Loading...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No customers found</td></tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium">{customer.name}</td>
                    <td className="px-4 py-3">{customer.email || '-'}</td>
                    <td className="px-4 py-3">{customer.phone || '-'}</td>
                    <td className="px-4 py-3">{customer.city || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-wood-700 bg-wood-50">{customer.country || '-'}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(customer.total_spent_minor || 0)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setShowModal(true);
                          }}
                          className="p-1 text-wood-600 hover:bg-wood-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <CustomerModal
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onClose={() => {
            setShowModal(false);
            setEditingCustomer(null);
          }}
        />
      )}
    </div>
  );
}

function CustomerModal({ customer, onSave, onClose }: any) {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    city: customer?.city || '',
    country: customer?.country || '',
    notes: customer?.notes || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">{customer ? 'Edit Customer' : 'New Customer'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-wood-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500 bg-wood-50"
                placeholder="e.g., Sri Lanka, USA, UK"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
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
            onClick={() => onSave(formData)}
            disabled={!formData.name}
            className="px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors disabled:opacity-50"
          >
            {customer ? 'Update' : 'Create'} Customer
          </button>
        </div>
      </div>
    </div>
  );
}
