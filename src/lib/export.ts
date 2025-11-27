import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { formatCurrency, fromMinor } from './supabase';

// Export data to CSV
export const exportToCSV = <T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) => {
  if (data.length === 0) {
    // Return false to let calling code show error toast
    return false;
  }

  let exportData = data;

  // If columns specified, filter and rename
  if (columns) {
    exportData = data.map(row => {
      const newRow: any = {};
      columns.forEach(col => {
        newRow[col.label] = row[col.key];
      });
      return newRow;
    });
  }

  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  return true;
};

// Generate PDF for quotation
export const generateQuotationPDF = (quotation: any, customer: any, items: any[]) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Wood Ceylon', 15, 15);
  doc.setFontSize(10);
  doc.text('Teak Wood Products', 15, 22);
  
  // Quotation title
  doc.setFontSize(16);
  doc.text('QUOTATION', 150, 15);
  doc.setFontSize(10);
  doc.text(`Number: ${quotation.quotation_number}`, 150, 22);
  doc.text(`Date: ${new Date(quotation.issue_date).toLocaleDateString()}`, 150, 28);
  doc.text(`Valid Until: ${new Date(quotation.valid_until_date).toLocaleDateString()}`, 150, 34);
  
  // Customer details
  doc.setFontSize(12);
  doc.text('Bill To:', 15, 45);
  doc.setFontSize(10);
  doc.text(customer.name, 15, 52);
  if (customer.address) doc.text(customer.address, 15, 58);
  if (customer.phone) doc.text(`Phone: ${customer.phone}`, 15, 64);
  if (customer.email) doc.text(`Email: ${customer.email}`, 15, 70);
  
  // Items table
  const tableData = items.map(item => [
    item.product_name || item.custom_item_description || 'N/A',
    item.quantity,
    formatCurrency(item.unit_price_minor),
    formatCurrency(item.total_price_minor),
  ]);
  
  autoTable(doc, {
    startY: 85,
    head: [['Item', 'Quantity', 'Unit Price', 'Total']],
    body: tableData,
    foot: [
      ['', '', 'Subtotal:', formatCurrency(quotation.total_amount_minor)],
      ['', '', 'Total:', formatCurrency(quotation.total_amount_minor)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [92, 64, 51] }, // Wood Ceylon brand color
  });
  
  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(9);
  doc.text('Terms & Conditions:', 15, finalY + 15);
  doc.text('Payment is due within 30 days of quotation date.', 15, finalY + 20);
  doc.text('This quotation is valid for 30 days from the issue date.', 15, finalY + 25);
  
  // Save
  doc.save(`Quotation_${quotation.quotation_number}.pdf`);
};

// Generate PDF for invoice
export const generateInvoicePDF = (invoice: any, customer: any, items: any[]) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Wood Ceylon', 15, 15);
  doc.setFontSize(10);
  doc.text('Teak Wood Products', 15, 22);
  
  // Invoice title
  doc.setFontSize(16);
  doc.text('INVOICE', 150, 15);
  doc.setFontSize(10);
  doc.text(`Number: ${invoice.invoice_number}`, 150, 22);
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 150, 28);
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 150, 34);
  
  // Customer details
  doc.setFontSize(12);
  doc.text('Bill To:', 15, 45);
  doc.setFontSize(10);
  doc.text(customer.name, 15, 52);
  if (customer.address) doc.text(customer.address, 15, 58);
  if (customer.phone) doc.text(`Phone: ${customer.phone}`, 15, 64);
  if (customer.email) doc.text(`Email: ${customer.email}`, 15, 70);
  
  // Items table
  const tableData = items.map(item => [
    item.product_name || item.custom_item_description || 'N/A',
    item.quantity,
    formatCurrency(item.unit_price_minor),
    formatCurrency(item.total_price_minor),
  ]);
  
  autoTable(doc, {
    startY: 85,
    head: [['Item', 'Quantity', 'Unit Price', 'Total']],
    body: tableData,
    foot: [
      ['', '', 'Subtotal:', formatCurrency(invoice.total_amount_minor)],
      ['', '', 'Paid:', formatCurrency(invoice.paid_amount_minor || 0)],
      ['', '', 'Balance Due:', formatCurrency(invoice.balance_due_minor || invoice.total_amount_minor)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [92, 64, 51] },
  });
  
  // Payment status
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(12);
  doc.text(`Status: ${invoice.payment_status.toUpperCase()}`, 15, finalY + 15);
  
  // Footer
  doc.setFontSize(9);
  doc.text('Thank you for your business!', 15, finalY + 25);
  doc.text('Please make payment by the due date.', 15, finalY + 30);
  
  // Save
  doc.save(`Invoice_${invoice.invoice_number}.pdf`);
};

// Generate PDF for order
export const generateOrderPDF = (order: any, customer: any, items: any[]) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Wood Ceylon', 15, 15);
  doc.setFontSize(10);
  doc.text('Teak Wood Products', 15, 22);
  
  // Order title
  doc.setFontSize(16);
  doc.text('ORDER CONFIRMATION', 145, 15);
  doc.setFontSize(10);
  doc.text(`Order #: ${order.order_number}`, 145, 22);
  doc.text(`Date: ${new Date(order.order_date).toLocaleDateString()}`, 145, 28);
  doc.text(`Status: ${order.status}`, 145, 34);
  
  // Customer details
  doc.setFontSize(12);
  doc.text('Customer:', 15, 45);
  doc.setFontSize(10);
  doc.text(customer.name, 15, 52);
  if (customer.address) doc.text(customer.address, 15, 58);
  if (customer.phone) doc.text(`Phone: ${customer.phone}`, 15, 64);
  
  // Items table
  const tableData = items.map(item => [
    item.product_name || item.custom_item_description || 'N/A',
    item.quantity,
    formatCurrency(item.unit_price_minor),
    formatCurrency(item.total_price_minor),
  ]);
  
  autoTable(doc, {
    startY: 75,
    head: [['Item', 'Quantity', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [92, 64, 51] },
  });
  
  // Costs breakdown
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  doc.setFontSize(10);
  doc.text(`Labor Cost: ${formatCurrency(order.labor_cost_minor)}`, 140, finalY + 10);
  doc.text(`Shipping Cost: ${formatCurrency(order.shipping_cost_minor)}`, 140, finalY + 16);
  doc.text(`Other Cost: ${formatCurrency(order.other_cost_minor)}`, 140, finalY + 22);
  doc.setFontSize(12);
  doc.text(`Total: ${formatCurrency(order.total_amount_minor)}`, 140, finalY + 30);
  
  // Save
  doc.save(`Order_${order.order_number}.pdf`);
};

// Comprehensive Worker Worksheet Export
export const generateWorkerWorksheetPDF = async (data: {
  workers: any[];
  paymentRecords: any[];
  assignments: any[];
  workLogs: any[];
  advances: any[];
  startDate: string;
  endDate: string;
}) => {
  const { workers, paymentRecords, assignments, workLogs, advances, startDate, endDate } = data;
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text('Wood Ceylon', 15, 20);
  doc.setFontSize(12);
  doc.text('Worker Worksheet Report', 15, 30);
  doc.setFontSize(10);
  doc.text(`Period: ${startDate} to ${endDate}`, 15, 37);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 44);
  
  let currentY = 55;
  
  // For each worker, create a detailed worksheet
  for (const worker of workers) {
    const workerPayments = paymentRecords.filter(p => p.worker_id === worker.id);
    const workerAssignments = assignments.filter(a => a.worker_id === worker.id);
    const workerWorkLogs = workLogs.filter(w => w.worker_id === worker.id);
    const workerAdvances = advances.filter(a => a.worker_id === worker.id);
    
    // Worker Summary
    doc.setFontSize(14);
    doc.text(`Worker: ${worker.name}`, 15, currentY);
    currentY += 7;
    doc.setFontSize(10);
    if (worker.phone) doc.text(`Phone: ${worker.phone}`, 15, currentY);
    currentY += 5;
    if (worker.email) doc.text(`Email: ${worker.email}`, 15, currentY);
    currentY += 10;
    
    // Calculate totals
    const totalOrderPayments = workerPayments.reduce((sum, p) => sum + p.total_labor_cost_minor, 0);
    const totalAdvances = workerAdvances.reduce((sum, a) => sum + a.amount_minor, 0);
    const totalOrderPaid = workerPayments.reduce((sum, p) => sum + p.advance_payment_minor, 0);
    const totalEarnings = totalOrderPayments;
    const totalBalance = totalEarnings - totalOrderPaid - totalAdvances;
    
    // Summary table
    doc.setFontSize(11);
    doc.text('EARNINGS SUMMARY:', 15, currentY);
    currentY += 6;
    doc.setFontSize(10);
    
    const summaryData = [
      ['Order-based Payments:', formatCurrency(totalOrderPayments)],
      ['Advance Payments:', formatCurrency(totalAdvances)],
      ['Total Earnings:', formatCurrency(totalEarnings)],
      ['Total Paid:', formatCurrency(totalOrderPaid + totalAdvances)],
      ['Remaining Balance:', formatCurrency(totalBalance)]
    ];
    
    autoTable(doc, {
      startY: currentY,
      head: [['Description', 'Amount']],
      body: summaryData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [92, 64, 51] }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;
    
    // Daily Work Records
    if (workerWorkLogs.length > 0) {
      doc.setFontSize(11);
      doc.text('DAILY WORK RECORDS:', 15, currentY);
      currentY += 6;
      
      const workLogData = workerWorkLogs.map(log => [
        log.work_date ? new Date(log.work_date).toLocaleDateString() : '',
        log.hours_worked?.toFixed(2) || '0.00',
        log.items_completed?.toString() || '0',
        formatCurrency(log.earnings_minor),
        log.description || ''
      ]);
      
      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Hours', 'Items', 'Earnings', 'Description']],
        body: workLogData,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [92, 64, 51] }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Order-based Payments
    if (workerPayments.length > 0) {
      doc.setFontSize(11);
      doc.text('ORDER-BASED PAYMENTS:', 15, currentY);
      currentY += 6;
      
      const paymentData = workerPayments.map(payment => [
        payment.product_name || '',
        payment.quantity?.toString() || '0',
        formatCurrency(payment.labor_cost_per_item_minor),
        formatCurrency(payment.total_labor_cost_minor),
        formatCurrency(payment.advance_payment_minor),
        formatCurrency(payment.remaining_balance_minor),
        payment.payment_status || 'pending'
      ]);
      
      autoTable(doc, {
        startY: currentY,
        head: [['Product', 'Qty', 'Rate', 'Total', 'Paid', 'Balance', 'Status']],
        body: paymentData,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [92, 64, 51] }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Standalone Payments
    if (workerAdvances.length > 0) {
      doc.setFontSize(11);
      doc.text('ADVANCE PAYMENTS:', 15, currentY);
      currentY += 6;
      
      const advanceData = workerAdvances.map(advance => [
        new Date(advance.advance_date).toLocaleDateString(),
        formatCurrency(advance.amount_minor),
        advance.payment_method || '',
        advance.description || ''
      ]);
      
      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Amount', 'Method', 'Description']],
        body: advanceData,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [92, 64, 51] }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Add new page for next worker (except last one)
    if (workers.indexOf(worker) < workers.length - 1) {
      doc.addPage();
      currentY = 20;
    }
  }
  
  // Save
  doc.save(`worker-worksheet-${startDate}-to-${endDate}.pdf`);
};

// Comprehensive Worker Worksheet CSV Export
export const exportWorkerWorksheetCSV = async (data: {
  workers: any[];
  paymentRecords: any[];
  assignments: any[];
  workLogs: any[];
  advances: any[];
  startDate: string;
  endDate: string;
}) => {
  const { workers, paymentRecords, workLogs, advances, startDate, endDate } = data;
  
  // Create comprehensive CSV data
  const csvData: any[] = [];
  
  // Add header information
  csvData.push({
    'Report_Type': 'Worker Worksheet',
    'Period_Start': startDate,
    'Period_End': endDate,
    'Generated_Date': new Date().toISOString().split('T')[0],
    'Company': 'Wood Ceylon - Teak Wood Products'
  });
  csvData.push({}); // Empty row
  
  // For each worker, create detailed records
  for (const worker of workers) {
    const workerPayments = paymentRecords.filter(p => p.worker_id === worker.id);
    const workerWorkLogs = workLogs.filter(w => w.worker_id === worker.id);
    const workerAdvances = advances.filter(a => a.worker_id === worker.id);
    
    // Worker header
    csvData.push({
      'Worker_Name': worker.name,
      'Worker_Phone': worker.phone || '',
      'Worker_Email': worker.email || '',
      'Record_Type': 'Worker_Summary',
      'Date': '',
      'Hours': '',
      'Items_Completed': '',
      'Product': '',
      'Quantity': '',
      'Labor_Cost': '',
      'Payment_Amount': '',
      'Payment_Type': '',
      'Status': '',
      'Description': ''
    });
    
    // Calculate worker totals
    const totalOrderPayments = workerPayments.reduce((sum, p) => sum + p.total_labor_cost_minor, 0);
    const totalAdvances = workerAdvances.reduce((sum, a) => sum + a.amount_minor, 0);
    const totalOrderPaid = workerPayments.reduce((sum, p) => sum + p.advance_payment_minor, 0);
    const totalEarnings = totalOrderPayments;
    const totalBalance = totalEarnings - totalOrderPaid - totalAdvances;
    
    // Add summary row
    csvData.push({
      'Worker_Name': worker.name,
      'Worker_Phone': worker.phone || '',
      'Worker_Email': worker.email || '',
      'Record_Type': 'Earnings_Summary',
      'Date': '',
      'Hours': '',
      'Items_Completed': '',
      'Product': 'TOTAL EARNINGS',
      'Quantity': '',
      'Labor_Cost': (totalEarnings / 100).toFixed(2),
      'Payment_Amount': '',
      'Payment_Type': 'Earnings_Total',
      'Status': '',
      'Description': `Order Payments: ${(totalOrderPayments / 100).toFixed(2)}`
    });
    
    csvData.push({
      'Worker_Name': worker.name,
      'Worker_Phone': worker.phone || '',
      'Worker_Email': worker.email || '',
      'Record_Type': 'Earnings_Summary',
      'Date': '',
      'Hours': '',
      'Items_Completed': '',
      'Product': 'TOTAL ADVANCES',
      'Quantity': '',
      'Labor_Cost': (totalAdvances / 100).toFixed(2),
      'Payment_Amount': '',
      'Payment_Type': 'Advance_Total',
      'Status': '',
      'Description': `Total Advances: ${(totalAdvances / 100).toFixed(2)}`
    });
    
    csvData.push({
      'Worker_Name': worker.name,
      'Worker_Phone': worker.phone || '',
      'Worker_Email': worker.email || '',
      'Record_Type': 'Earnings_Summary',
      'Date': '',
      'Hours': '',
      'Items_Completed': '',
      'Product': 'BALANCE DUE',
      'Quantity': '',
      'Labor_Cost': (totalBalance / 100).toFixed(2),
      'Payment_Amount': '',
      'Payment_Type': 'Balance_Due',
      'Status': totalBalance > 0 ? 'Pending' : 'Cleared',
      'Description': `Remaining Balance`
    });
    
    csvData.push({}); // Empty row
    
    // Daily work logs
    if (workerWorkLogs.length > 0) {
      csvData.push({
        'Worker_Name': worker.name,
        'Record_Type': 'Daily_Work_Logs',
        'Section': 'WORK_ATTENDANCE'
      });
      
      workerWorkLogs.forEach(log => {
        csvData.push({
          'Worker_Name': worker.name,
          'Record_Type': 'Work_Attendance',
          'Date': log.work_date,
          'Hours': log.hours_worked?.toFixed(2) || '0.00',
          'Items_Completed': log.items_completed?.toString() || '0',
          'Earnings': (log.earnings_minor / 100).toFixed(2),
          'Description': log.description || '',
          'Product': '',
          'Quantity': '',
          'Labor_Cost': '',
          'Payment_Amount': '',
          'Payment_Type': 'Daily_Work',
          'Status': ''
        });
      });
      
      csvData.push({}); // Empty row
    }
    
    // Order-based payments
    if (workerPayments.length > 0) {
      csvData.push({
        'Worker_Name': worker.name,
        'Record_Type': 'Order_Payments',
        'Section': 'ORDER_BASED_PAYMENTS'
      });
      
      workerPayments.forEach(payment => {
        csvData.push({
          'Worker_Name': worker.name,
          'Record_Type': 'Order_Payment',
          'Date': payment.created_at ? new Date(payment.created_at).toISOString().split('T')[0] : '',
          'Product': payment.product_name || '',
          'Quantity': payment.quantity?.toString() || '0',
          'Labor_Cost': (payment.total_labor_cost_minor / 100).toFixed(2),
          'Payment_Amount': (payment.advance_payment_minor / 100).toFixed(2),
          'Payment_Type': 'Order_Payment',
          'Status': payment.payment_status || 'pending',
          'Description': `Rate per item: ${(payment.labor_cost_per_item_minor / 100).toFixed(2)}`
        });
      });
      
      csvData.push({}); // Empty row
    }
    
    // Standalone payments
    if (workerAdvances.length > 0) {
      csvData.push({
        'Worker_Name': worker.name,
        'Record_Type': 'Advance_Payments',
        'Section': 'STANDALONE_PAYMENTS'
      });
      
      workerAdvances.forEach(advance => {
        csvData.push({
          'Worker_Name': worker.name,
          'Record_Type': 'Advance_Payment',
          'Date': advance.advance_date,
          'Payment_Amount': (advance.amount_minor / 100).toFixed(2),
          'Payment_Type': 'Advance',
          'Payment_Method': advance.payment_method || '',
          'Description': advance.description || '',
          'Product': '',
          'Quantity': '',
          'Labor_Cost': '',
          'Status': ''
        });
      });
      
      csvData.push({}); // Empty row
    }
    
    // Separator between workers
    csvData.push({
      'Worker_Name': '--- SEPARATOR ---',
      'Record_Type': 'Worker_Divider'
    });
    csvData.push({});
  }
  
  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `worker-worksheet-${startDate}-to-${endDate}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  return true;
};
