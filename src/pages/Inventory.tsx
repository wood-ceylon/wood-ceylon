import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency, toMinor, fromMinor } from '../lib/supabase';
import { Product } from '../lib/types';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { showSuccess, showError } from '../lib/toast';

interface InventoryBatch {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  labor_cost_per_item_minor: number;
  total_labor_cost_minor: number;
  created_at: string;
  updated_at: string;
}

export default function Inventory() {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await Promise.all([loadBatches(), loadProducts()]);
    setLoading(false);
  }

  async function loadBatches() {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        products (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading inventory batches:', error);
      showError('Failed to load inventory batches');
      return;
    }

    if (data) {
      const batchesWithNames = data.map(batch => ({
        ...batch,
        product_name: batch.products?.name || 'Unknown Product'
      }));
      setBatches(batchesWithNames);
    }
  }

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setProducts(data);
  }

  function handleAddNew() {
    setEditingBatch(null);
    setShowModal(true);
  }

  function handleEdit(batch: InventoryBatch) {
    setEditingBatch(batch);
    setShowModal(true);
  }

  async function handleDelete(batch: InventoryBatch) {
    if (!confirm(`Are you sure you want to delete this inventory batch for ${batch.product_name}?`)) {
      return;
    }

    const { error } = await supabase
      .from('inventory_batches')
      .delete()
      .eq('id', batch.id);

    if (error) {
      console.error('Error deleting batch:', error);
      showError('Failed to delete batch');
      return;
    }

    showSuccess('Batch deleted successfully');
    loadBatches();
  }

  const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
  const totalLaborCost = batches.reduce((sum, batch) => sum + batch.total_labor_cost_minor, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Inventory</h1>
          <p className="text-neutral-500 mt-1">Track inventory batches and labor costs</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Inventory
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm opacity-90">Total Items</div>
              <div className="text-3xl font-bold">{totalQuantity}</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm opacity-90">Total Labor Cost</div>
              <div className="text-3xl font-bold">{formatCurrency(totalLaborCost)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Batches Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Inventory Batches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Labor Cost Per Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Total Labor Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    No inventory batches yet. Click "Add Inventory" to get started.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-neutral-900">{batch.product_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-neutral-900">{batch.quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-neutral-900">{formatCurrency(batch.labor_cost_per_item_minor)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-purple-700">
                        {formatCurrency(batch.total_labor_cost_minor)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-500">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(batch)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(batch)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
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

      {/* Add/Edit Modal */}
      {showModal && (
        <InventoryModal
          batch={editingBatch}
          products={products}
          onClose={() => {
            setShowModal(false);
            setEditingBatch(null);
          }}
          onSave={async (data) => {
            if (editingBatch) {
              const { error } = await supabase
                .from('inventory_batches')
                .update(data)
                .eq('id', editingBatch.id);

              if (error) {
                console.error('Error updating batch:', error);
                showError('Failed to update batch');
                return;
              }
              showSuccess('Batch updated successfully');
            } else {
              const { error } = await supabase
                .from('inventory_batches')
                .insert(data);

              if (error) {
                console.error('Error creating batch:', error);
                showError('Failed to create batch');
                return;
              }
              showSuccess('Batch added successfully');
            }
            setShowModal(false);
            setEditingBatch(null);
            loadBatches();
          }}
        />
      )}
    </div>
  );
}

interface InventoryModalProps {
  batch: InventoryBatch | null;
  products: Product[];
  onClose: () => void;
  onSave: (data: any) => void;
}

function InventoryModal({ batch, products, onClose, onSave }: InventoryModalProps) {
  const [formData, setFormData] = useState({
    product_id: batch?.product_id || '',
    quantity: batch?.quantity || 1,
    labor_cost_per_item: batch ? fromMinor(batch.labor_cost_per_item_minor) : 0,
  });

  const totalLaborCost = formData.quantity * formData.labor_cost_per_item;

  function handleSubmit() {
    if (!formData.product_id) {
      showError('Please select a product');
      return;
    }
    if (formData.quantity <= 0) {
      showError('Quantity must be greater than 0');
      return;
    }
    if (formData.labor_cost_per_item < 0) {
      showError('Labor cost cannot be negative');
      return;
    }

    const data = {
      product_id: formData.product_id,
      quantity: formData.quantity,
      labor_cost_per_item_minor: toMinor(formData.labor_cost_per_item),
      total_labor_cost_minor: toMinor(totalLaborCost),
    };

    onSave(data);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-neutral-900 mb-4">
          {batch ? 'Edit Inventory Batch' : 'Add Inventory Batch'}
        </h2>

        <div className="space-y-4">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Product <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              required
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              required
            />
          </div>

          {/* Labor Cost Per Item */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Labor Cost Per Item (LKR)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.labor_cost_per_item}
              onChange={(e) => setFormData({ ...formData, labor_cost_per_item: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>

          {/* Total Calculation */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-neutral-700 mb-2">
              {formData.quantity} items × {formatCurrency(toMinor(formData.labor_cost_per_item))} per item
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-neutral-700">Total Labor Cost:</span>
              <span className="text-2xl font-bold text-purple-700">
                {formatCurrency(toMinor(totalLaborCost))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
          >
            {batch ? 'Update' : 'Add'} Batch
          </button>
        </div>
      </div>
    </div>
  );
}
