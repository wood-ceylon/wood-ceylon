import React, { useEffect, useState } from 'react';
import { supabase, formatCurrency } from '../lib/supabase';
import { Worker, WorkerPaymentRecord, WorkerProductAssignment, WorkerDailyWork, AttendanceType, StandalonePayment } from '../lib/types';
import { Plus, Edit, DollarSign, FileText, Calendar, Users, TrendingUp, Wallet, Clock, Download, CheckCircle2, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

interface InventoryBatch {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  labor_cost_per_item_minor: number;
  total_labor_cost_minor: number;
  created_at: string;
}

interface LaborCostRow {
  date: string;
  type: 'inventory' | 'order';
  product_name: string;
  quantity: number;
  cost_per_item_minor: number;
  total_cost_minor: number;
}

export default function Workers() {
  // State management
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<WorkerPaymentRecord[]>([]);
  const [dailyWork, setDailyWork] = useState<WorkerDailyWork[]>([]);
  const [standalonePayments, setStandalonePayments] = useState<StandalonePayment[]>([]);
  const [inventoryBatches, setInventoryBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWorkdayModal, setShowWorkdayModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWorkdayDeleteModal, setShowWorkdayDeleteModal] = useState(false);
  const [showWorkdayEditModal, setShowWorkdayEditModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [workdayToDelete, setWorkdayToDelete] = useState<WorkerDailyWork | null>(null);
  const [editingWorkday, setEditingWorkday] = useState<WorkerDailyWork | null>(null);

  // Work day marking state
  const [selectedWorkerForWork, setSelectedWorkerForWork] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [workdayFilterWorker, setWorkdayFilterWorker] = useState<string>('');
  const [workdayFilterAttendance, setWorkdayFilterAttendance] = useState<string>('');

  // Payment section state
  const [selectedWorkerForPayment, setSelectedWorkerForPayment] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await Promise.all([
      loadWorkers(),
      loadPaymentRecords(),
      loadDailyWork(),
      loadStandalonePayments(),
      loadInventoryBatches()
    ]);
    setLoading(false);
  }

  async function loadWorkers() {
    const { data } = await supabase
      .from('workers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setWorkers(data);
  }

  async function loadPaymentRecords() {
    const { data } = await supabase
      .from('worker_payment_records')
      .select(`
        *,
        workers(name)
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (data) {
      const recordsWithNames = data.map(record => ({
        ...record,
        worker_name: record.workers?.name || 'Unknown'
      }));
      setPaymentRecords(recordsWithNames);
    }
  }

  async function loadDailyWork() {
    const { data } = await supabase
      .from('worker_daily_work')
      .select(`
        *,
        workers(name)
      `)
      .order('work_date', { ascending: false });
    
    if (data) {
      const workWithNames = data.map(work => ({
        ...work,
        worker_name: work.workers?.name || 'Unknown'
      }));
      setDailyWork(workWithNames);
    }
  }

  async function loadStandalonePayments() {
    const { data } = await supabase
      .from('worker_standalone_payments')
      .select(`
        *,
        workers(name)
      `)
      .order('payment_date', { ascending: false });
    
    if (data) {
      const paymentsWithNames = data.map(payment => ({
        ...payment,
        worker_name: payment.workers?.name || 'Unknown'
      }));
      setStandalonePayments(paymentsWithNames);
    }
  }

  async function loadInventoryBatches() {
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
      // Don't show error toast, just log it (table might not exist yet)
      return;
    }

    if (data) {
      const batchesWithNames = data.map(batch => ({
        ...batch,
        product_name: batch.products?.name || 'Unknown Product'
      }));
      setInventoryBatches(batchesWithNames);
    }
  }

  // Calculate summary metrics - from unified labor costs (inventory + orders)
  const totalLaborCosts = inventoryBatches.reduce((sum, batch) => sum + batch.total_labor_cost_minor, 0) + 
                         paymentRecords.reduce((sum, record) => sum + record.total_labor_cost_minor, 0);
  const totalWorkerPayments = standalonePayments.reduce((sum, payment) => sum + payment.amount_minor, 0);
  const totalAdvances = standalonePayments.reduce((sum, payment) => sum + payment.amount_minor, 0);
  const remainingBalance = totalLaborCosts - totalAdvances;

  async function handleMarkAttendance(workerId: string, date: string, attendanceType: AttendanceType, notes?: string) {
    try {
      // Check if attendance already exists for this worker and date
      const { data: existing } = await supabase
        .from('worker_daily_work')
        .select('id')
        .eq('worker_id', workerId)
        .eq('work_date', date)
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('worker_daily_work')
          .update({
            attendance_type: attendanceType,
            hours_worked: attendanceType === 'full_day' ? 8 : attendanceType === 'half_day' ? 4 : 0,
            notes: notes || null
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('worker_daily_work')
          .insert({
            worker_id: workerId,
            work_date: date,
            attendance_type: attendanceType,
            hours_worked: attendanceType === 'full_day' ? 8 : attendanceType === 'half_day' ? 4 : 0,
            notes: notes || null
          });
        
        if (error) throw error;
      }

      await loadDailyWork();
      toast.success('Attendance marked successfully');
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('Failed to mark attendance');
    }
  }

  async function handleEditWorkday(workday: WorkerDailyWork) {
    setEditingWorkday(workday);
    setShowWorkdayEditModal(true);
  }

  async function handleUpdateWorkday(workdayData: { attendance_type: AttendanceType; hours_worked: number; notes?: string }) {
    if (!editingWorkday) return;

    try {
      const { error } = await supabase
        .from('worker_daily_work')
        .update({
          attendance_type: workdayData.attendance_type,
          hours_worked: workdayData.hours_worked,
          notes: workdayData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingWorkday.id);

      if (error) throw error;

      await loadDailyWork();
      toast.success('Work day updated successfully');
      setShowWorkdayEditModal(false);
      setEditingWorkday(null);
    } catch (error) {
      console.error('Error updating work day:', error);
      toast.error('Failed to update work day');
    }
  }

  async function handleDeleteWorkday(workday: WorkerDailyWork) {
    setWorkdayToDelete(workday);
    setShowWorkdayDeleteModal(true);
  }

  async function confirmDeleteWorkday() {
    if (!workdayToDelete) return;

    try {
      const { error } = await supabase
        .from('worker_daily_work')
        .delete()
        .eq('id', workdayToDelete.id);

      if (error) throw error;

      await loadDailyWork();
      toast.success('Work day entry deleted successfully');
      setShowWorkdayDeleteModal(false);
      setWorkdayToDelete(null);
    } catch (error) {
      console.error('Error deleting work day:', error);
      toast.error('Failed to delete work day entry');
    }
  }

  async function handleSavePayment(paymentData: { worker_id: string; amount: number; payment_type: 'advance' | 'full'; notes?: string }) {
    try {
      const { error } = await supabase.from('worker_standalone_payments').insert({
        worker_id: paymentData.worker_id,
        amount_minor: Math.round(paymentData.amount * 100),
        payment_type: paymentData.payment_type,
        payment_date: new Date().toISOString().split('T')[0],
        notes: paymentData.notes || null
      });
      
      if (error) throw error;
      
      await loadStandalonePayments();
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('Failed to record payment');
    }
  }

  async function handleSaveWorker(workerData: Partial<Worker>) {
    try {
      if (editingWorker) {
        const { error } = await supabase
          .from('workers')
          .update({ ...workerData, updated_at: new Date().toISOString() })
          .eq('id', editingWorker.id);
        if (error) throw error;
        toast.success('Worker updated successfully');
      } else {
        const { error } = await supabase.from('workers').insert({
          ...workerData,
          total_earned_minor: 0,
          total_advances_minor: 0,
          current_balance_minor: 0,
          hourly_rate_minor: 100000,
          hire_date: new Date().toISOString(),
          is_active: true
        });
        if (error) throw error;
        toast.success('Worker added successfully');
      }
      await loadWorkers();
      setShowWorkerModal(false);
      setEditingWorker(null);
    } catch (error) {
      console.error('Error saving worker:', error);
      toast.error('Failed to save worker');
    }
  }

  async function handleDeleteWorker(worker: Worker) {
    setWorkerToDelete(worker);
    setShowDeleteModal(true);
  }

  async function confirmDeleteWorker() {
    if (!workerToDelete) return;

    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('workers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', workerToDelete.id);

      if (error) throw error;

      await loadWorkers();
      toast.success(`${workerToDelete.name} has been removed successfully`);
      setShowDeleteModal(false);
      setWorkerToDelete(null);
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast.error('Failed to remove worker');
    }
  }

  function handleEditWorker(worker: Worker) {
    setEditingWorker(worker);
    setShowWorkerModal(true);
  }

  function exportAttendance() {
    const attendanceData = dailyWork.map(work => ({
      'Worker Name': work.worker_name,
      'Date': work.work_date,
      'Attendance': work.attendance_type === 'full_day' ? 'Full Day' : 
                   work.attendance_type === 'half_day' ? 'Half Day' : 'Leave',
      'Notes': work.notes || ''
    }));

    const csv = Papa.unparse(attendanceData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance report exported');
  }

  function exportMonthlyWorksheet() {
    // Group attendance by worker and calculate totals
    const workerAttendance: Record<string, { fullDays: number; halfDays: number; leaves: number; workerId: string }> = {};
    
    workers.forEach(worker => {
      workerAttendance[worker.id] = {
        fullDays: 0,
        halfDays: 0,
        leaves: 0,
        workerId: worker.id
      };
    });

    // Count attendance for the current month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    dailyWork.forEach(work => {
      const workDate = new Date(work.work_date);
      if (workDate >= monthStart && workDate <= monthEnd && workerAttendance[work.worker_id]) {
        if (work.attendance_type === 'full_day') {
          workerAttendance[work.worker_id].fullDays++;
        } else if (work.attendance_type === 'half_day') {
          workerAttendance[work.worker_id].halfDays++;
        } else {
          workerAttendance[work.worker_id].leaves++;
        }
      }
    });

    // Create worksheet data
    const worksheetData = workers.map(worker => {
      const attendance = workerAttendance[worker.id];
      const totalDays = attendance.fullDays + (attendance.halfDays * 0.5);
      
      return {
        'Worker Name': worker.name,
        'Month': format(currentMonth, 'MMMM yyyy'),
        'Full Days': attendance.fullDays,
        'Half Days': attendance.halfDays,
        'Leaves': attendance.leaves,
        'Total Working Days': totalDays,
        'Phone': worker.phone || '',
        'Status': 'Active'
      };
    });

    const csv = Papa.unparse(worksheetData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `monthly_worksheet_${format(currentMonth, 'yyyy-MM')}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Monthly worksheet exported');
  }

  function exportPayments() {
    const paymentData = standalonePayments.map(payment => ({
      'Date': payment.payment_date,
      'Worker Name': payment.worker_name,
      'Amount (LKR)': formatCurrency(payment.amount_minor),
      'Payment Type': payment.payment_type === 'advance' ? 'Advance' : 'Full Payment',
      'Notes': payment.notes || ''
    }));

    const csv = Papa.unparse(paymentData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_records_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Payment records exported');
  }

  function exportLaborCosts() {
    // Combine inventory and order labor costs
    const laborCostRows: LaborCostRow[] = [];

    // Add inventory batch labor costs
    inventoryBatches.forEach(batch => {
      laborCostRows.push({
        date: format(new Date(batch.created_at), 'yyyy-MM-dd'),
        type: 'inventory',
        product_name: batch.product_name || 'Unknown Product',
        quantity: batch.quantity,
        cost_per_item_minor: batch.labor_cost_per_item_minor,
        total_cost_minor: batch.total_labor_cost_minor
      });
    });

    // Add order labor costs
    paymentRecords.forEach(record => {
      laborCostRows.push({
        date: format(new Date(record.created_at), 'yyyy-MM-dd'),
        type: 'order',
        product_name: record.product_name || 'Unknown Product',
        quantity: record.quantity,
        cost_per_item_minor: record.labor_cost_per_item_minor,
        total_cost_minor: record.total_labor_cost_minor
      });
    });

    // Sort by date (newest first)
    laborCostRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Export to CSV
    const csvData = laborCostRows.map(row => ({
      'Date': row.date,
      'Type': row.type === 'inventory' ? 'Inventory' : 'Order',
      'Product': row.product_name,
      'Quantity': row.quantity,
      'Cost Per Item (LKR)': formatCurrency(row.cost_per_item_minor),
      'Total Cost (LKR)': formatCurrency(row.total_cost_minor)
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `labor_costs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Labor costs exported successfully');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading worker data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Worker Management</h1>
          <p className="text-neutral-600 mt-1">Simple and efficient worker tracking system</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowWorkerModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Workers
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Add Payment
          </button>
          <button
            onClick={() => setShowWorkdayModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Add Workdays
          </button>
        </div>
      </div>

      {/* Current Workers List Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Current Workers</h2>
              <p className="text-neutral-600 mt-1">Total Workers: {workers.length}</p>
            </div>
          </div>
        </div>
        
        {workers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No workers added yet. Click "Add New Workers" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left p-4 font-medium text-neutral-900">Name</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Phone</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Email</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Address</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Status</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-neutral-50">
                    <td className="p-4">
                      <div className="font-medium text-neutral-900">{worker.name}</div>
                    </td>
                    <td className="p-4 text-neutral-600">
                      {worker.phone || '-'}
                    </td>
                    <td className="p-4 text-neutral-600">
                      {worker.email || '-'}
                    </td>
                    <td className="p-4 text-neutral-600">
                      {worker.address || '-'}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditWorker(worker)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteWorker(worker)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 1: Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Labor Costs</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(totalLaborCosts)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Workers</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{workers.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Advance Payments</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(totalAdvances)}</p>
            </div>
            <Wallet className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Remaining Balance</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(remainingBalance)}</p>
            </div>
            <Clock className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Unified Labor Cost Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Labor Costs Tracking</h2>
              <p className="text-neutral-600 mt-1">Combined inventory and order labor costs</p>
            </div>
            <button
              onClick={exportLaborCosts}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Labor Costs
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left p-4 font-medium text-neutral-900">Date</th>
                <th className="text-left p-4 font-medium text-neutral-900">Type</th>
                <th className="text-left p-4 font-medium text-neutral-900">Product Name</th>
                <th className="text-left p-4 font-medium text-neutral-900">Quantity</th>
                <th className="text-left p-4 font-medium text-neutral-900">Cost Per Item</th>
                <th className="text-left p-4 font-medium text-neutral-900">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(() => {
                // Combine inventory and order labor costs
                const laborCostRows: LaborCostRow[] = [];

                // Add inventory batch labor costs
                inventoryBatches.forEach(batch => {
                  laborCostRows.push({
                    date: batch.created_at,
                    type: 'inventory',
                    product_name: batch.product_name || 'Unknown Product',
                    quantity: batch.quantity,
                    cost_per_item_minor: batch.labor_cost_per_item_minor,
                    total_cost_minor: batch.total_labor_cost_minor
                  });
                });

                // Add order labor costs
                paymentRecords.forEach(record => {
                  laborCostRows.push({
                    date: record.created_at,
                    type: 'order',
                    product_name: record.product_name || 'Unknown Product',
                    quantity: record.quantity,
                    cost_per_item_minor: record.labor_cost_per_item_minor,
                    total_cost_minor: record.total_labor_cost_minor
                  });
                });

                // Sort by date (newest first)
                laborCostRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (laborCostRows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-500">
                        No labor costs recorded yet
                      </td>
                    </tr>
                  );
                }

                return laborCostRows.map((row, index) => (
                  <tr key={`${row.type}-${index}`} className="hover:bg-neutral-50">
                    <td className="p-4 text-neutral-600">
                      {format(new Date(row.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.type === 'inventory' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {row.type === 'inventory' ? 'Inventory' : 'Order'}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-900 font-medium">
                      {row.product_name}
                    </td>
                    <td className="p-4 text-neutral-600">
                      {row.quantity}
                    </td>
                    <td className="p-4 text-neutral-900">
                      {formatCurrency(row.cost_per_item_minor)}
                    </td>
                    <td className="p-4 font-semibold text-purple-700">
                      {formatCurrency(row.total_cost_minor)}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Work Day Marking */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Work Day Marking</h2>
              <p className="text-neutral-600 mt-1">Track and manage daily attendance for workers</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWorkdayModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Work Day
              </button>
              <button
                onClick={exportAttendance}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={exportMonthlyWorksheet}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Worksheet
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Filter by Worker:</label>
              <select
                value={workdayFilterWorker}
                onChange={(e) => setWorkdayFilterWorker(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              >
                <option value="">All Workers</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>{worker.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Filter by Attendance:</label>
              <select
                value={workdayFilterAttendance}
                onChange={(e) => setWorkdayFilterAttendance(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              >
                <option value="">All Types</option>
                <option value="full_day">Full Day</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          {/* Work Day Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left p-4 font-medium text-neutral-900">Date</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Worker</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Attendance</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Hours</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Notes</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {(() => {
                  // Filter daily work
                  let filteredWork = dailyWork;
                  
                  if (workdayFilterWorker) {
                    filteredWork = filteredWork.filter(work => work.worker_id === workdayFilterWorker);
                  }
                  
                  if (workdayFilterAttendance) {
                    filteredWork = filteredWork.filter(work => work.attendance_type === workdayFilterAttendance);
                  }

                  if (filteredWork.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-neutral-500">
                          No work day records found. Click "Add Work Day" to get started.
                        </td>
                      </tr>
                    );
                  }

                  return filteredWork.map((work) => (
                    <tr key={work.id} className="hover:bg-neutral-50">
                      <td className="p-4 font-medium text-neutral-900">
                        {format(new Date(work.work_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="p-4 text-neutral-900">
                        {work.worker_name}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          work.attendance_type === 'full_day' 
                            ? 'bg-green-100 text-green-800' 
                            : work.attendance_type === 'half_day'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {work.attendance_type === 'full_day' ? 'Full Day' :
                           work.attendance_type === 'half_day' ? 'Half Day' : 'Absent'}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-600">
                        {work.hours_worked} hrs
                      </td>
                      <td className="p-4 text-neutral-600 max-w-xs truncate">
                        {work.notes || '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditWorkday(work)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteWorkday(work)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 4: Payment Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Payment Records</h2>
              <p className="text-neutral-600 mt-1">Track advances and payments to workers</p>
            </div>
            <button
              onClick={exportPayments}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Payments
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Worker Selection for Payment View */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-900 mb-2">Filter by Worker:</label>
            <select
              value={selectedWorkerForPayment}
              onChange={(e) => setSelectedWorkerForPayment(e.target.value)}
              className="w-full max-w-xs border border-neutral-300 rounded-lg px-3 py-2"
            >
              <option value="">All workers</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left p-4 font-medium text-neutral-900">Date</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Worker Name</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Amount</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Payment Type</th>
                  <th className="text-left p-4 font-medium text-neutral-900">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {standalonePayments
                  .filter(payment => !selectedWorkerForPayment || payment.worker_id === selectedWorkerForPayment)
                  .slice(0, 20)
                  .map((payment) => (
                    <tr key={payment.id} className="hover:bg-neutral-50">
                      <td className="p-4 text-neutral-600">
                        {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="p-4 font-medium text-neutral-900">
                        {payment.worker_name}
                      </td>
                      <td className="p-4 font-medium text-neutral-900">
                        {formatCurrency(payment.amount_minor)}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          payment.payment_type === 'advance' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {payment.payment_type === 'advance' ? 'Advance' : 'Full Payment'}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-600">
                        {payment.notes || '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {standalonePayments.length === 0 && (
              <div className="p-8 text-center text-neutral-500">
                No payment records found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showWorkerModal && (
        <WorkerModal
          worker={editingWorker}
          onSave={handleSaveWorker}
          onClose={() => {
            setShowWorkerModal(false);
            setEditingWorker(null);
          }}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          workers={workers}
          onSave={handleSavePayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {showWorkdayModal && (
        <WorkdayModal
          workers={workers}
          onMarkAttendance={handleMarkAttendance}
          onClose={() => setShowWorkdayModal(false)}
        />
      )}

      {showWorkdayEditModal && editingWorkday && (
        <WorkdayEditModal
          workday={editingWorkday}
          onSave={handleUpdateWorkday}
          onClose={() => {
            setShowWorkdayEditModal(false);
            setEditingWorkday(null);
          }}
        />
      )}

      {showDeleteModal && workerToDelete && (
        <DeleteConfirmationModal
          workerName={workerToDelete.name}
          onConfirm={confirmDeleteWorker}
          onClose={() => {
            setShowDeleteModal(false);
            setWorkerToDelete(null);
          }}
        />
      )}

      {showWorkdayDeleteModal && workdayToDelete && (
        <WorkdayDeleteConfirmationModal
          workday={workdayToDelete}
          onConfirm={confirmDeleteWorkday}
          onClose={() => {
            setShowWorkdayDeleteModal(false);
            setWorkdayToDelete(null);
          }}
        />
      )}
    </div>
  );
}

// Worker Modal Component
function WorkerModal({ 
  worker, 
  onSave, 
  onClose 
}: { 
  worker: Worker | null; 
  onSave: (worker: Partial<Worker>) => void; 
  onClose: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: worker?.name || '',
    phone: worker?.phone || '',
    address: worker?.address || '',
    email: worker?.email || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900">
            {worker ? 'Edit Worker' : 'Add New Worker'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 h-20"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-wood-700 text-white rounded-lg hover:bg-wood-800"
            >
              {worker ? 'Update' : 'Add'} Worker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Payment Modal Component
function PaymentModal({ 
  workers, 
  onSave, 
  onClose 
}: { 
  workers: Worker[]; 
  onSave: (payment: any) => void; 
  onClose: () => void; 
}) {
  const [formData, setFormData] = useState({
    worker_id: '',
    amount: '',
    payment_type: 'advance' as 'advance' | 'full',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.worker_id || !formData.amount) return;
    
    onSave({
      worker_id: formData.worker_id,
      amount: parseFloat(formData.amount),
      payment_type: formData.payment_type,
      notes: formData.notes
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900">Record Payment</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Worker</label>
            <select
              value={formData.worker_id}
              onChange={(e) => setFormData({ ...formData, worker_id: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">Select worker...</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Amount (LKR)</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Type</label>
            <select
              value={formData.payment_type}
              onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as 'advance' | 'full' })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            >
              <option value="advance">Advance Payment</option>
              <option value="full">Full Payment</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 h-20"
              placeholder="Optional notes..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Workday Modal Component
function WorkdayModal({ 
  workers, 
  onMarkAttendance, 
  onClose 
}: { 
  workers: Worker[]; 
  onMarkAttendance: (workerId: string, date: string, type: AttendanceType, notes?: string) => void; 
  onClose: () => void; 
}) {
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('full_day');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    
    onMarkAttendance(selectedWorker, selectedDate, attendanceType, notes);
    toast.success('Workday marked successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900">Mark Workday</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Worker</label>
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">Select worker...</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Attendance Type</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="full_day"
                  checked={attendanceType === 'full_day'}
                  onChange={(e) => setAttendanceType(e.target.value as AttendanceType)}
                  className="mr-2"
                />
                Full Day (8 hours)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="half_day"
                  checked={attendanceType === 'half_day'}
                  onChange={(e) => setAttendanceType(e.target.value as AttendanceType)}
                  className="mr-2"
                />
                Half Day (4 hours)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="absent"
                  checked={attendanceType === 'absent'}
                  onChange={(e) => setAttendanceType(e.target.value as AttendanceType)}
                  className="mr-2"
                />
                Absent (0 hours)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 h-20"
              placeholder="Add any additional notes..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Mark Workday
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal Component
function DeleteConfirmationModal({
  workerName,
  onConfirm,
  onClose
}: {
  workerName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900">
            Confirm Worker Removal
          </h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-neutral-900 font-medium">
                Are you sure you want to remove {workerName}?
              </p>
              <p className="text-neutral-600 text-sm mt-2">
                This will remove the worker from your system. This action cannot be undone.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Remove Worker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Workday Edit Modal Component
function WorkdayEditModal({
  workday,
  onSave,
  onClose
}: {
  workday: WorkerDailyWork;
  onSave: (data: { attendance_type: AttendanceType; hours_worked: number; notes?: string }) => void;
  onClose: () => void;
}) {
  const [attendanceType, setAttendanceType] = useState<AttendanceType>(workday.attendance_type);
  const [hoursWorked, setHoursWorked] = useState(workday.hours_worked.toString());
  const [notes, setNotes] = useState(workday.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      attendance_type: attendanceType,
      hours_worked: parseFloat(hoursWorked) || 0,
      notes: notes
    });
  };

  // Auto-update hours when attendance type changes
  const handleAttendanceTypeChange = (type: AttendanceType) => {
    setAttendanceType(type);
    if (type === 'full_day') setHoursWorked('8');
    else if (type === 'half_day') setHoursWorked('4');
    else setHoursWorked('0');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900">Edit Work Day</h3>
          <p className="text-sm text-neutral-600 mt-1">
            {workday.worker_name} - {format(new Date(workday.work_date), 'MMM dd, yyyy')}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Attendance Type</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="full_day"
                  checked={attendanceType === 'full_day'}
                  onChange={(e) => handleAttendanceTypeChange(e.target.value as AttendanceType)}
                  className="mr-2"
                />
                Full Day
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="half_day"
                  checked={attendanceType === 'half_day'}
                  onChange={(e) => handleAttendanceTypeChange(e.target.value as AttendanceType)}
                  className="mr-2"
                />
                Half Day
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="absent"
                  checked={attendanceType === 'absent'}
                  onChange={(e) => handleAttendanceTypeChange(e.target.value as AttendanceType)}
                  className="mr-2"
                />
                Absent
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Hours Worked</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 h-20"
              placeholder="Add any additional notes..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update Work Day
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Workday Delete Confirmation Modal Component
function WorkdayDeleteConfirmationModal({
  workday,
  onConfirm,
  onClose
}: {
  workday: WorkerDailyWork;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900">
            Confirm Work Day Deletion
          </h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-neutral-900 font-medium">
                Are you sure you want to delete this work day entry?
              </p>
              <div className="mt-2 space-y-1 text-sm text-neutral-600">
                <p><span className="font-medium">Worker:</span> {workday.worker_name}</p>
                <p><span className="font-medium">Date:</span> {format(new Date(workday.work_date), 'MMM dd, yyyy')}</p>
                <p><span className="font-medium">Attendance:</span> {
                  workday.attendance_type === 'full_day' ? 'Full Day' :
                  workday.attendance_type === 'half_day' ? 'Half Day' : 'Absent'
                }</p>
              </div>
              <p className="text-neutral-600 text-sm mt-3">
                This action cannot be undone.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
