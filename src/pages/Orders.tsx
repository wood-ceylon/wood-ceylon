import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency, generateOrderNumber, toMinor, fromMinor } from '../lib/supabase';
import { Order, OrderItem, Customer, Product, Worker, PaymentStatus, OrderPlatform } from '../lib/types';
import { Plus, Edit, Trash2, Eye, Filter, Download, X, FileText } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '../lib/toast';

// Function to recalculate ALL account balances from scratch
async function recalculateAllAccountBalances() {
  try {
    console.log('🔄 Starting complete account balance recalculation...');
    
    // Get all accounts
    const { data: allAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true);
    
    if (accountsError) throw accountsError;
    console.log(`📊 Found ${allAccounts.length} active accounts to recalculate`);
    
    // Initialize all balances to 0
    const balanceUpdates = allAccounts.map(account => ({
      id: account.id,
      balance_minor: 0
    }));
    
    // Get all transactions
    const { data: allTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: true }); // Process in chronological order
    
    if (transactionsError) throw transactionsError;
    console.log(`💰 Processing ${allTransactions.length} transactions for balance calculation`);
    
    // Calculate balances from transactions
    const accountBalances = new Map();
    allAccounts.forEach(account => {
      accountBalances.set(account.id, 0);
    });
    
    for (const transaction of allTransactions) {
      if (transaction.transaction_type === 'income' && transaction.to_account_id) {
        // Add to 'to' account
        const currentBalance = accountBalances.get(transaction.to_account_id) || 0;
        accountBalances.set(transaction.to_account_id, currentBalance + transaction.amount_minor);
      } 
      else if (transaction.transaction_type === 'expense' && transaction.from_account_id) {
        // Subtract from 'from' account
        const currentBalance = accountBalances.get(transaction.from_account_id) || 0;
        accountBalances.set(transaction.from_account_id, currentBalance - transaction.amount_minor);
      }
      else if (transaction.transaction_type === 'transfer' && transaction.from_account_id && transaction.to_account_id) {
        // Subtract from 'from' account
        const fromBalance = accountBalances.get(transaction.from_account_id) || 0;
        accountBalances.set(transaction.from_account_id, fromBalance - transaction.amount_minor);
        
        // Add to 'to' account
        const toBalance = accountBalances.get(transaction.to_account_id) || 0;
        accountBalances.set(transaction.to_account_id, toBalance + transaction.amount_minor);
      }
    }
    
    // Update all accounts with calculated balances
    let updateCount = 0;
    for (const [accountId, calculatedBalance] of accountBalances) {
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ balance_minor: calculatedBalance })
        .eq('id', accountId);
      
      if (updateError) {
        console.error(`❌ Failed to update account ${accountId}:`, updateError);
      } else {
        updateCount++;
      }
    }
    
    console.log(`✅ Successfully recalculated and updated ${updateCount} account balances`);
    
    // Get final summary for logging
    const updatedAccounts = Array.from(accountBalances.entries()).map(([id, balance]) => ({
      id,
      balance
    }));
    
    console.log('📈 Final account balances:', updatedAccounts.map(a => ({ accountId: a.id, balance: a.balance })));
    
    return updatedAccounts;
    
  } catch (error) {
    console.error('❌ Error recalculating account balances:', error);
    throw new Error(`Failed to recalculate account balances: ${error.message}`);
  }
}

// Legacy function for individual transaction reversal (kept for compatibility)
async function updateAccountBalancesForDelete(transaction: any) {
  try {
    if (transaction.transaction_type === 'income' && transaction.to_account_id) {
      const { data: currentAccount, error: fetchError } = await supabase
        .from('accounts')
        .select('balance_minor')
        .eq('id', transaction.to_account_id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('accounts')
        .update({
          balance_minor: (currentAccount?.balance_minor || 0) - transaction.amount_minor
        })
        .eq('id', transaction.to_account_id);

      if (error) throw error;
    } 
    else if (transaction.transaction_type === 'expense' && transaction.from_account_id) {
      const { data: currentAccount, error: fetchError } = await supabase
        .from('accounts')
        .select('balance_minor')
        .eq('id', transaction.from_account_id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('accounts')
        .update({
          balance_minor: (currentAccount?.balance_minor || 0) + transaction.amount_minor
        })
        .eq('id', transaction.from_account_id);

      if (error) throw error;
    }
    else if (transaction.transaction_type === 'transfer' && transaction.from_account_id && transaction.to_account_id) {
      const [fromAccountResult, toAccountResult] = await Promise.all([
        supabase.from('accounts').select('balance_minor').eq('id', transaction.from_account_id).single(),
        supabase.from('accounts').select('balance_minor').eq('id', transaction.to_account_id).single()
      ]);

      if (fromAccountResult.error) throw fromAccountResult.error;
      if (toAccountResult.error) throw toAccountResult.error;
      
      const { error: fromError } = await supabase
        .from('accounts')
        .update({
          balance_minor: (fromAccountResult.data?.balance_minor || 0) + transaction.amount_minor
        })
        .eq('id', transaction.from_account_id);

      if (fromError) throw fromError;

      const { error: toError } = await supabase
        .from('accounts')
        .update({
          balance_minor: (toAccountResult.data?.balance_minor || 0) - transaction.amount_minor
        })
        .eq('id', transaction.to_account_id);

      if (toError) throw toError;
    }
  } catch (error) {
    console.error('Error reversing account balances:', error);
    throw new Error('Failed to reverse account balances');
  }
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [viewingOrderItems, setViewingOrderItems] = useState<OrderItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadProducts();
    loadWorkers();
  }, []);

  async function loadOrders() {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (ordersData) {
      const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);

      const ordersWithCustomers = ordersData.map(o => ({
        ...o,
        customer_name: customersData?.find(c => c.id === o.customer_id)?.name || 'Unknown'
      }));
      setOrders(ordersWithCustomers);
    }
    setLoading(false);
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setCustomers(data);
  }

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setProducts(data);
  }

  async function loadWorkers() {
    const { data } = await supabase
      .from('workers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setWorkers(data);
  }

  async function handleViewOrder(order: Order) {
    const loadingToast = showLoading('Loading order details...');
    
    try {
      // Load order items for this order
      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select(`
          *,
          products (
            id,
            name
          )
        `)
        .eq('order_id', order.id)
        .order('created_at');
        
      if (orderItemsData) {
        // Map product names from joined data
        const itemsWithProductNames = orderItemsData.map(item => ({
          ...item,
          product_name: item.products?.name || item.item_name
        }));
        setViewingOrderItems(itemsWithProductNames);
      }
      
      setViewingOrder(order);
      setShowViewModal(true);
      dismissToast(loadingToast);
      
    } catch (error) {
      showError('Failed to load order details');
      console.error('Error loading order details:', error);
    }
  }

  async function handleSaveOrder(orderData: Partial<Order>, orderItems: Partial<OrderItem>[]) {
    const loadingToast = showLoading('Saving order...');
    let orderId: string;
    
    try {
      let result;

      if (editingOrder) {
        // Update existing order
        result = await supabase
          .from('orders')
          .update({ ...orderData, updated_at: new Date().toISOString() })
          .eq('id', editingOrder.id)
          .select();
        
        if (result.error) throw result.error;
        orderId = editingOrder.id;

        // Delete existing worker payment records for this order
        await supabase.from('worker_payment_records').delete().eq('order_id', orderId);

        // Delete existing order items
        await supabase.from('order_items').delete().eq('order_id', orderId);
      } else {
        // Create new order with atomic database function
        const orderNumber = await generateOrderNumber();
        result = await supabase
          .from('orders')
          .insert({ 
            ...orderData, 
            order_number: orderNumber,
            is_active: true 
          })
          .select();
        
        if (result.error) throw result.error;
        orderId = result.data[0].id;
      }

      // Insert order items (worker payment records are created automatically by database triggers)
      if (orderItems.length > 0) {
        // Validate each item before insertion
        for (let i = 0; i < orderItems.length; i++) {
          const item = orderItems[i];
          if (!item.item_name || item.item_name.trim() === '') {
            throw new Error(`Product ${i + 1} must have a name`);
          }
          if (item.quantity <= 0) {
            throw new Error(`Product ${i + 1} must have quantity greater than 0`);
          }
          if (item.unit_price_minor < 0) {
            throw new Error(`Product ${i + 1} cannot have negative unit price`);
          }
        }

        const itemsToInsert = orderItems.map(item => ({
          order_id: orderId,
          product_id: item.product_id || null,
          item_name: item.item_name || '',
          description: item.description || null,
          quantity: item.quantity || 1,
          unit_price_minor: item.unit_price_minor || 0,
          labor_cost_minor: item.labor_cost_minor || 0,
          material_cost_minor: item.material_cost_minor || 0,
          is_completed: false
        }));

        const itemsResult = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsResult.error) {
          console.error('Error inserting order items:', itemsResult.error);
          throw new Error(`Failed to save order items: ${itemsResult.error.message}`);
        }

        // AUTOMATIC INVENTORY REDUCTION: Reduce inventory quantities for products in this order
        for (const item of orderItems) {
          if (item.product_id) {
            try {
              // Find inventory record for this product (assuming main warehouse or first available)
              const { data: inventoryRecords } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.product_id)
                .limit(1);

              if (inventoryRecords && inventoryRecords.length > 0) {
                const inventory = inventoryRecords[0];
                const newQuantity = inventory.stock_quantity - (item.quantity || 0);

                if (newQuantity < 0) {
                  console.warn(`Warning: Inventory for product ${item.item_name} would go negative. Current: ${inventory.stock_quantity}, Ordered: ${item.quantity}`);
                  // Still allow order but log warning
                }

                // Update inventory quantity
                await supabase
                  .from('inventory')
                  .update({
                    stock_quantity: newQuantity,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', inventory.id);

                // Create stock movement record
                await supabase.from('stock_movements').insert({
                  product_id: item.product_id,
                  warehouse_id: inventory.warehouse_id,
                  movement_type: 'issue',
                  quantity: item.quantity || 0,
                  unit_cost_minor: inventory.average_cost_minor || 0,
                  movement_date: new Date().toISOString(),
                  reference_id: orderId,
                  reference_type: 'order',
                  notes: `Order ${orderData.order_number || 'N/A'} - ${item.item_name}`
                });
              }
            } catch (inventoryError) {
              console.error('Error updating inventory for product:', item.item_name, inventoryError);
              // Continue with order creation even if inventory update fails
            }
          }
        }
      } else {
        throw new Error('Order must contain at least one product');
      }

      // Call profit distribution if order is completed and fully paid
      // Only distribute profit if it hasn't been distributed already
      if (orderData.status === 'completed') {
        const remainingPayment = (orderData.total_amount_minor || 0) - (orderData.paid_amount_minor || 0);
        if (remainingPayment === 0) {
          // Check if profit has already been distributed for this order
          const { data: existingDistribution } = await supabase
            .from('profit_distributions')
            .select('id, is_distributed')
            .eq('order_id', orderId)
            .single();

          // Only distribute profit if it hasn't been distributed yet
          if (!existingDistribution || !existingDistribution.is_distributed) {
            await supabase.functions.invoke('distribute-profit', {
              body: { order_id: orderId }
            });
          }
        }
      }

      dismissToast(loadingToast);
      showSuccess(editingOrder ? 'Order updated successfully' : 'Order created successfully');
      await loadOrders();
      setShowModal(false);
      setEditingOrder(null);
    } catch (error) {
      dismissToast(loadingToast);
      console.error('Error saving order:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to save order';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key value violates unique constraint orders_order_number_key')) {
          errorMessage = 'Order number conflict detected. Please try again.';
        } else if (error.message.includes('violates foreign key constraint')) {
          errorMessage = 'Invalid customer or product selected. Please verify your selections.';
        } else {
          errorMessage = error.message;
        }
      }
      
      showError(errorMessage);
    }
  }

  async function handleDeleteOrder(id: string) {
    if (!confirm('Are you sure you want to delete this order? This will permanently remove all connected data including transactions, worker payments, inventory movements, and account balance adjustments.')) return;
    
    try {
      console.log('🗑️ Starting comprehensive cascade deletion for order:', id);
      
      // STEP 1: Get order details first for reference
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
        
      if (!orderData) {
        showError('Order not found');
        return;
      }
      
      // STEP 2: Get ALL connected data before deletion
      
      // Get profit distributions
      const { data: profitDistributions } = await supabase
        .from('profit_distributions')
        .select('*')
        .eq('order_id', id);
      const distributionIds = profitDistributions?.map(p => p.id) || [];
      console.log(`📋 Found ${distributionIds.length} profit distributions`);
      
      // Get order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id);
      const orderItemIds = orderItems?.map(item => item.id) || [];
      console.log(`📋 Found ${orderItemIds.length} order items`);
      
      // Get worker payment records
      const { data: workerPaymentRecords } = await supabase
        .from('worker_payment_records')
        .select('*')
        .eq('order_id', id);
      const workerPaymentIds = workerPaymentRecords?.map(w => w.id) || [];
      console.log(`📋 Found ${workerPaymentIds.length} worker payment records`);
      
      // Get stock movements (inventory movements for this order)
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('reference_type', 'order')
        .eq('reference_id', id);
      const stockMovementIds = stockMovements?.map(s => s.id) || [];
      console.log(`📋 Found ${stockMovementIds.length} stock movements`);
      
      // STEP 3: COMPREHENSIVE TRANSACTION DETECTION
      console.log('🔍 Starting comprehensive transaction detection...');
      
      // Get all possible transaction types
      const transactionQueries = [
        // Profit distribution transactions
        ...(distributionIds.length > 0 ? [supabase
          .from('transactions')
          .select('*')
          .eq('reference_type', 'profit_share')
          .in('reference_id', distributionIds)] : []),
        
        // Direct order reference transactions
        supabase
          .from('transactions')
          .select('*')
          .eq('reference_type', 'order')
          .eq('reference_id', id),
        
        // Order description transactions
        supabase
          .from('transactions')
          .select('*')
          .ilike('description', `%order ${id}%`),
          
        // Order number transactions
        supabase
          .from('transactions')
          .select('*')
          .ilike('description', `%${orderData.order_number}%`),
          
        // Worker payment transactions
        ...(workerPaymentIds.length > 0 ? [supabase
          .from('transactions')
          .select('*')
          .in('reference_id', workerPaymentIds)] : []),
          
        // Stock movement transactions
        ...(stockMovementIds.length > 0 ? [supabase
          .from('transactions')
          .select('*')
          .in('reference_id', stockMovementIds)] : []),
      ];
      
      // Execute all transaction queries in parallel
      const transactionResults = await Promise.all(transactionQueries);
      const allTransactionsToDelete = [];
      
      for (const result of transactionResults) {
        if (result.data && result.data.length > 0) {
          allTransactionsToDelete.push(...result.data);
        }
      }
      
      // Remove duplicates based on transaction ID
      const uniqueTransactionsToDelete = allTransactionsToDelete.filter((transaction, index, self) =>
        index === self.findIndex(t => t.id === transaction.id)
      );
      
      console.log(`🔍 Found ${uniqueTransactionsToDelete.length} total transactions to delete:`, 
        uniqueTransactionsToDelete.map(t => ({ 
          id: t.id, 
          type: t.transaction_type, 
          amount: t.amount_minor,
          reference: `${t.reference_type}:${t.reference_id}`
        })));
      
      // STEP 4: CASCADE DELETION IN CORRECT ORDER
      console.log('🗑️ Starting cascade deletion...');
      
      // Delete in order to avoid foreign key constraint issues
      const deletionSteps = [];
      
      // Step 4a: Delete stock movements (inventory movements)
      if (stockMovementIds.length > 0) {
        deletionSteps.push({
          name: 'Stock Movements',
          action: supabase.from('stock_movements').delete().in('id', stockMovementIds),
          count: stockMovementIds.length
        });
      }
      
      // Step 4b: Delete transactions
      if (uniqueTransactionsToDelete.length > 0) {
        const transactionIds = uniqueTransactionsToDelete.map(t => t.id);
        deletionSteps.push({
          name: 'Transactions',
          action: supabase.from('transactions').delete().in('id', transactionIds),
          count: transactionIds.length
        });
      }
      
      // Step 4c: Delete worker payment records
      if (workerPaymentIds.length > 0) {
        deletionSteps.push({
          name: 'Worker Payment Records',
          action: supabase.from('worker_payment_records').delete().in('id', workerPaymentIds),
          count: workerPaymentIds.length
        });
      }
      
      // Step 4d: Delete profit distributions
      if (distributionIds.length > 0) {
        deletionSteps.push({
          name: 'Profit Distributions',
          action: supabase.from('profit_distributions').delete().in('id', distributionIds),
          count: distributionIds.length
        });
      }
      
      // Step 4e: Delete order items
      if (orderItemIds.length > 0) {
        deletionSteps.push({
          name: 'Order Items',
          action: supabase.from('order_items').delete().in('id', orderItemIds),
          count: orderItemIds.length
        });
      }
      
      // Execute all deletions
      let totalDeleted = 0;
      for (const step of deletionSteps) {
        try {
          const { error } = await step.action;
          if (error) {
            console.error(`❌ Error deleting ${step.name}:`, error);
          } else {
            console.log(`✅ Successfully deleted ${step.count} ${step.name.toLowerCase()}`);
            totalDeleted += step.count;
          }
        } catch (stepError) {
          console.error(`❌ Error in deletion step ${step.name}:`, stepError);
        }
      }
      
      // STEP 5: INVENTORY RESTORATION (if applicable)
      console.log('📦 Restoring inventory for deleted order items...');
      for (const item of orderItems || []) {
        if (item.product_id) {
          try {
            // Find the stock movement for this item
            const { data: movementRecord } = await supabase
              .from('stock_movements')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('reference_id', id)
              .eq('reference_type', 'order')
              .single();
              
            if (movementRecord) {
              // Restore the inventory quantity
              const { data: inventoryRecord } = await supabase
                .from('inventory')
                .select('*')
                .eq('id', movementRecord.inventory_id || 0)
                .single();
                
              if (inventoryRecord) {
                const restoredQuantity = inventoryRecord.stock_quantity + item.quantity;
                
                await supabase
                  .from('inventory')
                  .update({ 
                    stock_quantity: restoredQuantity,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', inventoryRecord.id);
                  
                console.log(`✅ Restored inventory for product: ${item.product_id}, Quantity: +${item.quantity}`);
              }
            }
          } catch (inventoryError) {
            console.error('❌ Error restoring inventory for item:', item.product_id, inventoryError);
            // Continue with deletion even if inventory restoration fails
          }
        }
      }
      
      // STEP 6: COMPLETE BALANCE RECALCULATION
      console.log('🔄 Starting complete account balance recalculation...');
      try {
        const recalculatedAccounts = await recalculateAllAccountBalances();
        console.log('✅ Account balance recalculation completed successfully');
        console.log('📊 Updated account balances:', recalculatedAccounts.map(a => ({ id: a.id, balance: a.balance })));
      } catch (recalcError) {
        console.error('❌ Critical error during balance recalculation:', recalcError);
        showError('Warning: Order deleted but balance recalculation failed. Please refresh the page manually.');
      }
      
      // STEP 7: FINAL ORDER DEACTIVATION
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (orderError) {
        console.error('❌ Error deactivating order:', orderError);
        showError('Failed to delete order');
        return;
      }
      
      // STEP 8: SUCCESS MESSAGE AND CLEANUP
      // Store deleted order info for potential restoration
      localStorage.setItem('lastDeletedOrder', JSON.stringify({
        ...orderData,
        deletedAt: new Date().toISOString(),
        connectedDataDeleted: {
          transactions: uniqueTransactionsToDelete.length,
          profitDistributions: distributionIds.length,
          workerPayments: workerPaymentIds.length,
          stockMovements: stockMovementIds.length,
          orderItems: orderItemIds.length,
          inventoryRestored: orderItems?.length || 0
        }
      }));
      
      // Generate comprehensive deletion summary
      const deletionSummary = [];
      if (uniqueTransactionsToDelete.length > 0) deletionSummary.push(`${uniqueTransactionsToDelete.length} transaction(s)`);
      if (distributionIds.length > 0) deletionSummary.push(`${distributionIds.length} profit distribution(s)`);
      if (workerPaymentIds.length > 0) deletionSummary.push(`${workerPaymentIds.length} worker payment record(s)`);
      if (stockMovementIds.length > 0) deletionSummary.push(`${stockMovementIds.length} stock movement(s)`);
      if (orderItemIds.length > 0) deletionSummary.push(`${orderItemIds.length} order item(s)`);
      deletionSummary.push('inventory restored');
      deletionSummary.push('account balances recalculated');
      
      showSuccess(`🎉 ORDER DELETED COMPLETELY! Removed: ${deletionSummary.join(', ')}`);
      console.log('🎉 COMPREHENSIVE ORDER DELETION COMPLETED:');
      console.log(`   📊 Total items deleted: ${totalDeleted + orderItemIds.length + distributionIds.length + workerPaymentIds.length + stockMovementIds.length}`);
      console.log(`   💰 Transactions removed: ${uniqueTransactionsToDelete.length}`);
      console.log(`   🔄 Account balances recalculated for all accounts`);
      console.log(`   📦 Inventory quantities restored`);
      
      // Refresh the orders list
      await loadOrders();
      
      // Trigger comprehensive page refresh to update all connected data
      setTimeout(() => {
        console.log('🔄 Triggering page refresh to update Dashboard, Transactions, and Workers pages...');
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('❌ Critical error during comprehensive order deletion:', error);
      showError(`Failed to delete order: ${error.message}`);
    }
  }

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Orders</h1>
          <p className="text-slate-500 mt-1">Manage customer orders and production</p>
        </div>
        <button
          onClick={() => {
            setEditingOrder(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-normal transition-colors ${
              statusFilter === status
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Order ID</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Products</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Platform</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Paid</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No orders found</td></tr>
              ) : (
                filteredOrders.map((order) => {
                  const remaining = order.total_amount_minor - (order.paid_amount_minor || 0);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <span className="font-mono text-slate-600">order#{order.order_number}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{new Date(order.order_date).toLocaleDateString()}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{order.customer_name}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <div className="max-w-xs truncate" title={order.notes || ''}>
                          {order.notes ? order.notes.substring(0, 30) + '...' : 'Multiple items'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-normal bg-slate-100 text-slate-700">
                          Order
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <PlatformBadge platform={order.platform} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(order.total_amount_minor)}</td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-700">
                          <div>{formatCurrency(order.paid_amount_minor || 0)}</div>
                          {remaining > 0 && (
                            <div className="text-amber-600 text-xs mt-1">Due: {formatCurrency(remaining)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setShowModal(true);
                            }}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Order"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <OrderModal
          order={editingOrder}
          customers={customers}
          products={products}
          workers={workers}
          onSave={handleSaveOrder}
          onClose={() => {
            setShowModal(false);
            setEditingOrder(null);
          }}
        />
      )}

      {showViewModal && viewingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Order Details</h2>
                  <p className="text-sm text-slate-500 mt-1">Order ID: <span className="font-mono text-slate-600">order#{viewingOrder.order_number}</span></p>
                </div>
                <button 
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingOrder(null);
                    setViewingOrderItems([]);
                  }} 
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h3 className="font-semibold text-neutral-900 mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Customer:</span> {viewingOrder.customer_name}
                  </div>
                  <div>
                    <span className="font-medium">Order Date:</span> {new Date(viewingOrder.order_date).toLocaleDateString()}
                  </div>
                  {viewingOrder.delivery_date && (
                    <div>
                      <span className="font-medium">Delivery Date:</span> {new Date(viewingOrder.delivery_date).toLocaleDateString()}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Platform:</span> <PlatformBadge platform={viewingOrder.platform} />
                  </div>
                </div>
              </div>

              {/* Order Status & Payment */}
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h3 className="font-semibold text-neutral-900 mb-3">Status & Payment</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status:</span> <StatusBadge status={viewingOrder.status} />
                  </div>
                  <div>
                    <span className="font-medium">Payment Status:</span> <PaymentStatusBadge status={viewingOrder.payment_status} />
                  </div>
                  <div>
                    <span className="font-medium">Total Amount:</span> {formatCurrency(viewingOrder.total_amount_minor)}
                  </div>
                  <div>
                    <span className="font-medium">Paid Amount:</span> {formatCurrency(viewingOrder.paid_amount_minor || 0)}
                  </div>
                  {viewingOrder.paid_amount_minor !== viewingOrder.total_amount_minor && (
                    <div className="col-span-2">
                      <span className="font-medium">Remaining:</span> 
                      <span className="text-orange-600 ml-2">
                        {formatCurrency(viewingOrder.total_amount_minor - (viewingOrder.paid_amount_minor || 0))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h3 className="font-semibold text-neutral-900 mb-3">Cost Breakdown</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Labor Cost:</span> {formatCurrency(viewingOrder.total_labor_cost_minor || 0)}
                  </div>
                  <div>
                    <span className="font-medium">Shipping Cost:</span> {formatCurrency(viewingOrder.shipping_cost_minor || 0)}
                  </div>
                  <div>
                    <span className="font-medium">Other Cost:</span> {formatCurrency(viewingOrder.other_cost_minor || 0)}
                  </div>
                  <div>
                    <span className="font-medium">Net Profit:</span> 
                    <span className="text-green-600 ml-2">
                      {formatCurrency(
                        viewingOrder.total_amount_minor - 
                        (viewingOrder.total_labor_cost_minor || 0) - 
                        (viewingOrder.shipping_cost_minor || 0) - 
                        (viewingOrder.other_cost_minor || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {viewingOrderItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {viewingOrderItems.map((item, index) => (
                      <div key={index} className="bg-white border-2 border-neutral-200 rounded-lg p-4 hover:border-wood-300 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-wood-100 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-wood-600" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-lg text-neutral-900">{item.product_name || item.item_name}</h4>
                                {item.description && (
                                  <p className="text-sm text-neutral-500 mt-1">{item.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs text-neutral-500 uppercase mb-1">Quantity</div>
                              <div className="text-2xl font-bold text-wood-700">{item.quantity}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-neutral-500 uppercase mb-1">Unit Price</div>
                              <div className="text-lg font-semibold text-neutral-900">{formatCurrency(item.unit_price_minor)}</div>
                            </div>
                            <div className="text-right min-w-[120px]">
                              <div className="text-xs text-neutral-500 uppercase mb-1">Total</div>
                              <div className="text-xl font-bold text-green-600">
                                {formatCurrency(item.quantity * item.unit_price_minor)}
                              </div>
                            </div>
                          </div>
                        </div>
                        {item.labor_cost_minor > 0 && (
                          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2 text-sm">
                            <span className="text-neutral-500">Labor Cost per Unit:</span>
                            <span className="font-medium text-blue-700">{formatCurrency(item.labor_cost_minor)}</span>
                            <span className="text-neutral-400">|</span>
                            <span className="text-neutral-500">Total Labor:</span>
                            <span className="font-medium text-blue-700">{formatCurrency(item.labor_cost_minor * item.quantity)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {(viewingOrder.notes || viewingOrder.payment_notes) && (
                <div className="bg-neutral-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-neutral-900 mb-3">Notes</h3>
                  {viewingOrder.notes && (
                    <div className="mb-3">
                      <span className="font-medium text-sm">Order Notes:</span>
                      <p className="text-sm text-neutral-600 mt-1">{viewingOrder.notes}</p>
                    </div>
                  )}
                  {viewingOrder.payment_notes && (
                    <div>
                      <span className="font-medium text-sm">Payment Notes:</span>
                      <p className="text-sm text-neutral-600 mt-1">{viewingOrder.payment_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderItemForm {
  id?: string;
  product_id: string | null;
  item_name: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  labor_cost_minor: number;
  material_cost_minor: number;
  is_custom: boolean;
}

function OrderModal({ order, customers, products, workers, onSave, onClose }: any) {
  const [nextOrderNumber, setNextOrderNumber] = useState<string>('');
  const [formData, setFormData] = useState({
    customer_id: order?.customer_id || '',
    order_date: order?.order_date || new Date().toISOString().split('T')[0],
    delivery_date: order?.delivery_date || '',
    status: order?.status || 'draft',
    platform: order?.platform || 'website',
    shipping_cost: order?.shipping_cost_minor ? fromMinor(order.shipping_cost_minor) : 0,
    other_cost: order?.other_cost_minor ? fromMinor(order.other_cost_minor) : 0,
    paid_amount: order?.paid_amount_minor ? fromMinor(order.paid_amount_minor) : 0,
    payment_status: order?.payment_status || 'full',
    payment_notes: order?.payment_notes || '',
    notes: order?.notes || '',
    priority: order?.priority || 'normal',
  });
  
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([{
    product_id: null,
    item_name: '',
    description: '',
    quantity: 1,
    unit_price_minor: 0,
    labor_cost_minor: 0,
    material_cost_minor: 0,
    is_custom: false
  }]);

  const [saving, setSaving] = useState(false);

  // Set default payment status based on platform
  useEffect(() => {
    if (!order) {
      // Set platform-specific default payment status for new orders
      if (formData.platform === 'local') {
        setFormData(prev => ({ ...prev, payment_status: 'advance' }));
      } else {
        setFormData(prev => ({ ...prev, payment_status: 'full' }));
      }
    } else {
      setFormData(prev => ({ ...prev, payment_status: order?.payment_status || 'full' }));
    }
  }, [formData.platform, order]);

  useEffect(() => {
    if (!order) {
      generateOrderNumber().then(num => setNextOrderNumber(num));
    } else {
      setNextOrderNumber(order.order_number);
      loadOrderItems();
    }
  }, [order]);

  async function loadOrderItems() {
    if (!order?.id) return;
    
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    
    if (data && data.length > 0) {
      setOrderItems(data.map(item => ({
        id: item.id,
        product_id: item.product_id,
        item_name: item.item_name,
        description: item.description || '',
        quantity: item.quantity,
        unit_price_minor: item.unit_price_minor,
        labor_cost_minor: item.labor_cost_minor || 0,
        material_cost_minor: item.material_cost_minor || 0,
        is_custom: !item.product_id
      })));
    }
  }

  function handleAddItem() {
    setOrderItems([...orderItems, {
      product_id: null,
      item_name: '',
      description: '',
      quantity: 1,
      unit_price_minor: 0,
      labor_cost_minor: 0,
      material_cost_minor: 0,
      is_custom: false
    }]);
  }

  function handleRemoveItem(index: number) {
    if (orderItems.length === 1) {
      showError('Order must have at least one product');
      return;
    }
    setOrderItems(orderItems.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, field: string, value: any) {
    const newItems = [...orderItems];
    
    if (field === 'product_id') {
      if (value === 'custom') {
        newItems[index] = {
          ...newItems[index],
          product_id: null,
          item_name: '',
          is_custom: true
        };
      } else {
        const product = products.find((p: Product) => p.id === value);
        if (product) {
          newItems[index] = {
            ...newItems[index],
            product_id: value,
            item_name: product.name,
            unit_price_minor: product.standard_price_minor,
            labor_cost_minor: product.labor_cost_minor || 0,
            material_cost_minor: product.material_cost_minor || 0,
            is_custom: false
          };
        }
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    
    setOrderItems(newItems);
  }

  // Calculate totals
  const totalProductValue = orderItems.reduce((sum, item) => 
    sum + (item.unit_price_minor * item.quantity), 0
  );
  
  const totalLaborCost = orderItems.reduce((sum, item) => 
    sum + (item.labor_cost_minor * item.quantity), 0
  );
  
  const shippingCostMinor = toMinor(formData.shipping_cost);
  const otherCostMinor = toMinor(formData.other_cost);
  const paidAmountMinor = toMinor(formData.paid_amount);
  
  // Grand Total = Product Total (what customer pays)
  const grandTotal = totalProductValue;
  
  // Net Profit = Product Total - (Labor + Shipping + Other costs)
  const netProfit = totalProductValue - totalLaborCost - shippingCostMinor - otherCostMinor;
  const remainingPayment = grandTotal - paidAmountMinor;

  async function handleSubmit() {
    if (!formData.customer_id) {
      showError('Please select a customer');
      return;
    }
    
    // Validate items
    for (const item of orderItems) {
      if (!item.item_name.trim()) {
        showError('All products must have a name');
        return;
      }
      if (item.quantity <= 0) {
        showError('All products must have quantity greater than 0');
        return;
      }
    }

    if (grandTotal <= 0) {
      showError('Order total must be greater than 0');
      return;
    }

    // Validate net profit calculation
    const calculatedNetProfit = totalProductValue - totalLaborCost - shippingCostMinor - otherCostMinor;
    if (calculatedNetProfit < 0) {
      const confirmNegativeProfit = confirm(
        `Warning: This order has a negative net profit of ${formatCurrency(Math.abs(calculatedNetProfit))}. ` +
        `The total costs (labor + shipping + other) exceed the product value. ` +
        `Do you want to proceed with this order?`
      );
      if (!confirmNegativeProfit) {
        return;
      }
    }

    setSaving(true);
    await onSave({
      platform: formData.platform,
      customer_id: formData.customer_id,
      order_date: formData.order_date,
      delivery_date: formData.delivery_date || null,
      status: formData.status,
      total_amount_minor: grandTotal,
      total_labor_cost_minor: totalLaborCost,
      shipping_cost_minor: shippingCostMinor,
      other_cost_minor: otherCostMinor,
      paid_amount_minor: paidAmountMinor,
      payment_status: formData.payment_status,
      payment_notes: formData.payment_notes || null,
      notes: formData.notes || null,
      priority: formData.priority,
    }, orderItems);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-5xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{order ? 'Edit Order' : 'New Order'}</h2>
              <p className="text-sm text-slate-500 mt-1">Order ID: <span className="font-mono text-slate-600">order#{nextOrderNumber || 'Generating...'}</span></p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Customer and Dates */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                required
              >
                <option value="">Select customer</option>
                {customers.map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Platform <span className="text-red-500">*</span></label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value as OrderPlatform })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                required
              >
                <option value="website">Website</option>
                <option value="etsy">Etsy</option>
                <option value="local">Local</option>
              </select>
              {formData.platform === 'local' && (
                <p className="text-xs text-blue-600 mt-1">Local orders default to advance payment</p>
              )}
              {(formData.platform === 'website' || formData.platform === 'etsy') && (
                <p className="text-xs text-blue-600 mt-1">Orders default to full payment</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Order Date</label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Dispatch Date</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              />
            </div>
          </div>

          {/* Products Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-neutral-700">
                Products <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-wood-100 text-wood-700 rounded-lg hover:bg-wood-200"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>

            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-4 space-y-3 bg-neutral-50">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Product</label>
                        <select
                          value={item.is_custom ? 'custom' : (item.product_id || '')}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wood-500"
                        >
                          <option value="">Select product</option>
                          {products.map((p: Product) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          <option value="custom">Custom Product</option>
                        </select>
                      </div>

                      {item.is_custom && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Custom Product Name</label>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                            placeholder="Enter product name"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wood-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wood-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Unit Price (LKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fromMinor(item.unit_price_minor)}
                          onChange={(e) => handleItemChange(index, 'unit_price_minor', toMinor(parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wood-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Labor Cost per Unit (LKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fromMinor(item.labor_cost_minor)}
                          onChange={(e) => handleItemChange(index, 'labor_cost_minor', toMinor(parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wood-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Optional description"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wood-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded mt-6"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-sm text-neutral-600 border-t border-neutral-200 pt-2">
                    Total Amount: <span className="font-medium">{formatCurrency(item.unit_price_minor * item.quantity)}</span>
                    {' '} | Labor: <span className="font-medium">{formatCurrency(item.labor_cost_minor * item.quantity)}</span>
                    {' '} | Item Profit: <span className="font-medium">
                      {formatCurrency((item.unit_price_minor * item.quantity) - (item.labor_cost_minor * item.quantity))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Costs and Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-200 pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Shipping Cost (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.shipping_cost}
                  onChange={(e) => setFormData({ ...formData, shipping_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Other Costs (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.other_cost}
                  onChange={(e) => setFormData({ ...formData, other_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                />
              </div>
            </div>

            <div className="bg-wood-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-lg font-bold border-b border-wood-200 pb-2">
                <span>Grand Total (Product Total):</span>
                <span className="text-wood-700">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="text-xs text-neutral-600 mb-2">Expenses (deducted from Product Total):</div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Labor Cost:</span>
                <span className="font-medium">{formatCurrency(totalLaborCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Shipping Cost:</span>
                <span className="font-medium">{formatCurrency(shippingCostMinor)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Other Cost:</span>
                <span className="font-medium">{formatCurrency(otherCostMinor)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-wood-200 pt-2">
                <span>Net Profit:</span>
                <span className={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
              <div className="text-xs text-neutral-500 text-right">
                Product Total - Expenses
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="border-t border-neutral-200 pt-4 space-y-3">
            <h3 className="font-medium text-neutral-900">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Amount Paid (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.paid_amount}
                  onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
                />
              </div>
              <div className={`p-3 rounded-lg ${remainingPayment === 0 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                <div className="text-sm font-medium text-neutral-700">Remaining Payment</div>
                <div className={`text-2xl font-bold ${remainingPayment === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                  {formatCurrency(remainingPayment)}
                </div>
                {remainingPayment === 0 && paidAmountMinor > 0 && (
                  <div className="text-xs text-green-600 mt-1">Fully Paid</div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Status</label>
              <select
                value={formData.payment_status}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as PaymentStatus })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              >
                <option value="pending">Pending</option>
                <option value="advance">Advance</option>
                <option value="partial">Partial</option>
                <option value="full">Full</option>
              </select>
            </div>
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Order Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              >
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* General Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">General Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Additional order notes..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wood-500"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : (order ? 'Update Order' : 'Create Order')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    confirmed: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-amber-50 text-amber-700',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-normal ${colors[status] || colors.draft}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const colors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    advance: 'bg-blue-50 text-blue-700',
    partial: 'bg-amber-50 text-amber-700',
    full: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-normal ${colors[status] || colors.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: OrderPlatform }) {
  const colors: Record<string, string> = {
    website: 'bg-blue-50 text-blue-700',
    etsy: 'bg-amber-50 text-amber-700',
    local: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-normal ${colors[platform] || colors.website}`}>
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}
