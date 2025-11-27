import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency } from '../lib/supabase';
import { Product, ProductCategory } from '../lib/types';
import { Plus, Edit, Trash2, Package, Grid } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Products() {
  const [products, setProducts] = useState<(Product & { category_name: string })[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (data) {
      const productsWithCategories = await Promise.all(
        data.map(async (product) => {
          const { data: category } = await supabase
            .from('product_categories')
            .select('name')
            .eq('id', product.category_id)
            .maybeSingle();
          return { ...product, category_name: category?.name || 'Uncategorized' };
        })
      );
      setProducts(productsWithCategories);
    }
    setLoading(false);
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setCategories(data);
  }

  async function handleSaveProduct(productData: Partial<Product>) {
    try {
      if (editingProduct) {
        await supabase
          .from('products')
          .update({ ...productData, updated_at: new Date().toISOString() })
          .eq('id', editingProduct.id);
        toast.success('Product updated successfully');
      } else {
        await supabase.from('products').insert({
          ...productData,
          is_active: true
        });
        toast.success('Product created successfully');
      }
      await loadProducts();
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  }

  async function handleDeleteProduct(product: Product) {
    setProductToDelete(product);
    setShowDeleteModal(true);
  }

  async function confirmDeleteProduct() {
    if (!productToDelete) return;
    
    try {
      await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productToDelete.id);
      
      await loadProducts();
      toast.success(`${productToDelete.name} removed successfully`);
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  }

  async function handleSaveCategory(categoryData: { name: string; description: string }) {
    try {
      await supabase.from('product_categories').insert({
        ...categoryData,
        is_active: true
      });
      await loadCategories();
      setShowCategoryModal(false);
      toast.success('Category created successfully');
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    }
  }

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category_id === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Products</h1>
          <p className="text-neutral-500">Manage product catalog</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Grid className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Product
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-wood-700 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          All Products ({products.length})
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === category.id
                ? 'bg-wood-700 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {category.name} ({products.filter(p => p.category_id === category.id).length})
          </button>
        ))}
      </div>

      {/* Products Grid - Simplified */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="bg-gradient-to-br from-wood-50 to-cream-100 p-6 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-wood-600" />
                <div>
                  <h3 className="font-bold text-lg text-neutral-900">{product.name}</h3>
                  {product.product_code && (
                    <p className="text-sm text-neutral-500">SKU: {product.product_code}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditingProduct(product);
                    setShowModal(true);
                  }}
                  className="p-2 text-wood-600 hover:bg-wood-100 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteProduct(product)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 uppercase">Category</span>
                <span className="px-2 py-1 text-xs bg-wood-50 text-wood-700 rounded font-medium">
                  {product.category_name}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs font-medium text-neutral-500 uppercase">Quantity in Stock</span>
                <span className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg font-bold">
                  {product.quantity || 0}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Standard Price</span>
                  <span className="font-bold text-wood-700 text-lg">
                    {formatCurrency(product.standard_price_minor)}
                  </span>
                </div>

                {product.labor_cost_minor > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Labor Cost</span>
                    <span className="font-semibold text-blue-700">
                      {formatCurrency(product.labor_cost_minor)}
                    </span>
                  </div>
                )}

                {product.material_cost_minor > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Material Cost</span>
                    <span className="font-semibold text-green-700">
                      {formatCurrency(product.material_cost_minor)}
                    </span>
                  </div>
                )}
              </div>

              {product.description && (
                <div className="pt-2 border-t">
                  <span className="text-xs font-medium text-neutral-500 uppercase block mb-1">Notes</span>
                  <p className="text-sm text-neutral-700 line-clamp-3">{product.description}</p>
                </div>
              )}

              {product.is_custom && (
                <div className="pt-2">
                  <span className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded font-medium">
                    Custom Product
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
          <Package className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <p className="text-neutral-600">No products found</p>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="mt-4 text-wood-700 hover:text-wood-800 font-medium"
          >
            Create your first product
          </button>
        </div>
      )}

      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          onSave={handleSaveCategory}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {showDeleteModal && productToDelete && (
        <DeleteConfirmationModal
          product={productToDelete}
          onConfirm={confirmDeleteProduct}
          onCancel={() => {
            setShowDeleteModal(false);
            setProductToDelete(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ product, categories, onSave, onClose }: {
  product: Product | null;
  categories: ProductCategory[];
  onSave: (data: Partial<Product>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    product_code: product?.product_code || '',
    category_id: product?.category_id || (categories[0]?.id || ''),
    description: product?.description || '',
    is_custom: product?.is_custom || false,
    standard_price: product ? product.standard_price_minor / 100 : 0,
    labor_cost: product ? product.labor_cost_minor / 100 : 0,
    material_cost: product ? product.material_cost_minor / 100 : 0,
    quantity: product?.quantity || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category_id) {
      toast.error('Please fill in required fields');
      return;
    }
    onSave({
      name: formData.name,
      product_code: formData.product_code || null,
      category_id: formData.category_id,
      description: formData.description || null,
      is_custom: formData.is_custom,
      standard_price_minor: Math.round(formData.standard_price * 100),
      labor_cost_minor: Math.round(formData.labor_cost * 100),
      material_cost_minor: Math.round(formData.material_cost * 100),
      quantity: formData.quantity,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-bold text-neutral-900">
            {product ? 'Edit Product' : 'New Product'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                required
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                SKU / Product Code
              </label>
              <input
                type="text"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                required
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Standard Price (LKR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.standard_price}
                onChange={(e) => setFormData({ ...formData, standard_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                required
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Labor Cost (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.labor_cost}
                onChange={(e) => setFormData({ ...formData, labor_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Material Cost (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.material_cost}
                onChange={(e) => setFormData({ ...formData, material_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Quantity in Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Description / Notes
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Product description, notes, or specifications..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_custom"
              checked={formData.is_custom}
              onChange={(e) => setFormData({ ...formData, is_custom: e.target.checked })}
              className="w-4 h-4 text-wood-700 border-neutral-300 rounded focus:ring-wood-500"
            />
            <label htmlFor="is_custom" className="text-sm text-neutral-700">
              Custom Product
            </label>
          </div>

          <div className="bg-neutral-50 border-t -mx-6 -mb-6 px-6 py-4 flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
            >
              {product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({ onSave, onClose }: {
  onSave: (data: { name: string; description: string }) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Category name is required');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
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
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-wood-500"
            />
          </div>

          <div className="bg-neutral-50 border-t -mx-6 -mb-6 px-6 py-4 flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
            >
              Create Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmationModal({ product, onConfirm, onCancel }: {
  product: Product;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          Confirm Product Deletion
        </h3>
        <p className="text-neutral-600 mb-4">
          Are you sure you want to delete "{product.name}"? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete Product
          </button>
        </div>
      </div>
    </div>
  );
}
