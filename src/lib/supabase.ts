import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vinzjxjrawhiqwsnndxl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbnpqeGpyYXdoaXF3c25uZHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTA3MDksImV4cCI6MjA3OTUyNjcwOX0.w6W06jvSLBfc7jbzJmEGglQ48i9A_7k_ltZmn4YV68w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to format currency (LKR)
export const formatCurrency = (amountMinor: number): string => {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Helper to convert from display amount to minor units
export const toMinor = (amount: number): number => Math.round(amount * 100);

// Helper to convert from minor units to display amount
export const fromMinor = (amountMinor: number): number => amountMinor / 100;

// Generate order number using database function for atomic operations
export const generateOrderNumber = async (): Promise<string> => {
  try {
    // Use the database function to generate a unique order number atomically
    const { data, error } = await supabase
      .rpc('generate_unique_order_number');
    
    if (error) {
      console.error('Error generating order number:', error);
      // Fallback to timestamp-based approach if database function fails
      const year = new Date().getFullYear();
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `WC-${year}-${String(timestamp % 10000).padStart(4, '0')}-${randomSuffix}`;
    }
    
    return data as string;
  } catch (error) {
    console.error('Error in generateOrderNumber:', error);
    // Fallback to timestamp-based approach
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `WC-${year}-${String(timestamp % 10000).padStart(4, '0')}-${randomSuffix}`;
  }
};

// Reset order sequence counter (for data reset functionality)
export const resetOrderSequence = async (year?: number): Promise<void> => {
  try {
    // Use the database function to reset the sequence
    const { error } = await supabase
      .rpc('reset_order_sequence', { p_year: year });
    
    if (error) {
      console.error('Error resetting order sequence:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in resetOrderSequence:', error);
    throw error;
  }
};

// Generate quotation number
export const generateQuotationNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('quotations')
    .select('*', { count: 'exact', head: true });
  const num = (count || 0) + 1;
  return `QUO-${year}-${String(num).padStart(4, '0')}`;
};

// Generate invoice number
export const generateInvoiceNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true });
  const num = (count || 0) + 1;
  return `INV-${year}-${String(num).padStart(4, '0')}`;
};

// Generate transaction number
export const generateTransactionNumber = async (): Promise<string> => {
  try {
    const year = new Date().getFullYear();
    
    // Get the highest transaction number for this year
    const { data: transactions } = await supabase
      .from('transactions')
      .select('transaction_number')
      .like('transaction_number', `TXN-${year}-%`)
      .order('transaction_number', { ascending: false })
      .limit(1);
    
    let nextNumber = 1;
    if (transactions && transactions.length > 0) {
      const lastNumber = transactions[0].transaction_number;
      const match = lastNumber.match(/TXN-\d{4}-(\d{4})/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const transactionNumber = `TXN-${year}-${String(nextNumber).padStart(4, '0')}`;
    console.log('Generated transaction number:', transactionNumber);
    return transactionNumber;
  } catch (error) {
    console.error('Error generating transaction number:', error);
    // Fallback: use timestamp-based number
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `TXN-${year}-${timestamp}`;
  }
};
