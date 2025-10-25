'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Listbox, Transition } from '@headlessui/react';
import { formatMoney } from '@/lib/utils';

type Receipt = {
  id: string;
  org_id: string;
  property_id: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  date_added: string;
  receipt_date: string | null;
  amount_cents: number | null;
  description: string | null;
  note?: string | null;
};

type Property = {
  id: string;
  name: string;
};

interface ReceiptsModalProps {
  orgId: string;
  month: string;
  properties: Property[];
  selectedPropertyId?: string | null;
  isAdmin: boolean;
  onClose: () => void;
}

export default function ReceiptsModal({
  orgId,
  month,
  properties,
  selectedPropertyId,
  isAdmin,
  onClose
}: ReceiptsModalProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPropertyId, setUploadPropertyId] = useState(selectedPropertyId || '');
  const [receiptDate, setReceiptDate] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [viewingImage, setViewingImage] = useState<Receipt | null>(null);
  const [isReceiptsExpanded, setIsReceiptsExpanded] = useState(true);
  const [receiptCategoryFilter, setReceiptCategoryFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(month);

  // Lock body scroll when modal is open
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, selectedMonth, selectedPropertyId]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const { supabaseClient } = await import('@/lib/supabase/client');
      const sb = supabaseClient();
      const { data: { session } } = await sb.auth.getSession();

      let url = `/api/orgs/${orgId}/receipts?month=${selectedMonth}`;
      if (selectedPropertyId) {
        url += `&propertyId=${selectedPropertyId}`;
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();
      if (data.ok) {
        setReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadPropertyId) {
      alert('Please select a file and property');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('propertyId', uploadPropertyId);
      if (receiptDate) formData.append('receiptDate', receiptDate);
      if (amount) formData.append('amountCents', (parseFloat(amount) * 100).toString());
      if (description) formData.append('description', description);

      const response = await fetch(`/api/orgs/${orgId}/receipts/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.ok) {
        alert('Receipt uploaded successfully!');
        setSelectedFile(null);
        setReceiptDate('');
        setAmount('');
        setDescription('');
        fetchReceipts();
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (receiptId: string) => {
    if (!confirm('Delete this receipt?')) return;

    try {
      const response = await fetch(`/api/orgs/${orgId}/receipts?receiptId=${receiptId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.ok) {
        alert('Receipt deleted');
        fetchReceipts();
      } else {
        alert(`Delete failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed');
    }
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property?.name || 'Unknown Property';
  };

  // Generate list of available months (last 12 months, excluding 2024)
  const getAvailableMonths = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      // Skip any months from 2024
      if (date.getFullYear() < 2025) continue;
      const monthStr = date.toISOString().slice(0, 7); // YYYY-MM
      const displayStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ value: monthStr, label: displayStr });
    }
    return months;
  };

  const availableMonths = getAvailableMonths();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[#F8F6F2] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200 modal-scrollbar"
        style={{
          border: '2px solid #E1ECDB',
          scrollbarGutter: 'stable'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          const target = e.currentTarget;
          const atTop = target.scrollTop === 0;
          const atBottom = target.scrollHeight - target.scrollTop === target.clientHeight;

          if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
            e.preventDefault();
          }
        }}
      >
        {/* Header */}
        <div className="sticky top-0 text-white px-6 py-5 rounded-t-2xl border-b border-white/20 z-10" style={{ background: 'linear-gradient(to right, #eab308, #ca8a04)', backgroundColor: '#eab308' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Receipts</h2>
                <p className="text-white/90 text-sm mt-0.5">
                  {selectedPropertyId ? `${getPropertyName(selectedPropertyId)}` : 'View and manage receipts'}
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              className="text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Form (Admin Only) */}
          {isAdmin && (
            <Card className="shadow-lg bg-white" style={{ border: '2px solid #9db896' }}>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#9db896]/20">
                    <svg className="w-5 h-5 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  Upload Receipt
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="receipt-file">Receipt File (Image or PDF) *</Label>
                    <Input
                      id="receipt-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receipt-property">Property *</Label>
                    <Listbox value={uploadPropertyId} onChange={setUploadPropertyId}>
                      <div className="relative mt-1">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border transition-all" style={{ borderColor: '#e5e7eb' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#eab30880'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'} onFocus={(e) => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.boxShadow = '0 0 0 2px #eab30840'; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                          <span className="block truncate text-sm">
                            {uploadPropertyId ? properties.find(p => p.id === uploadPropertyId)?.name : 'Select property...'}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Listbox.Button>
                        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                          <Listbox.Options className="absolute left-0 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border">
                            <Listbox.Option
                              value=""
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  Select property...
                                </span>
                              )}
                            </Listbox.Option>
                            {properties.map(p => (
                              <Listbox.Option
                                key={p.id}
                                value={p.id}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    {p.name}
                                  </span>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>
                  <div>
                    <Label htmlFor="receipt-date">Receipt Date (Optional)</Label>
                    <Input
                      id="receipt-date"
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receipt-amount">Amount (Optional)</Label>
                    <Input
                      id="receipt-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receipt-description">Description (Optional)</Label>
                    <Input
                      id="receipt-description"
                      type="text"
                      placeholder="e.g., Cleaning supplies"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !uploadPropertyId || uploading}
                  className="mt-4 bg-[#9db896] hover:bg-[#88a882] text-white"
                >
                  {uploading ? 'Uploading...' : 'Upload Receipt'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Receipts List */}
          <Card className="shadow-lg bg-white" style={{ border: '1px solid #eab30820' }}>
            {/* Header - Always Visible */}
            <button
              onClick={() => setIsReceiptsExpanded(!isReceiptsExpanded)}
              className={`w-full text-left cursor-pointer group relative overflow-hidden rounded-t-lg ${!isReceiptsExpanded ? 'rounded-b-lg' : ''} transition-all duration-500 backdrop-blur-sm`}
              style={{
                background: 'linear-gradient(135deg, #eab30805 0%, transparent 100%)',
                borderBottom: isReceiptsExpanded ? '2px solid #eab30820' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #eab30815 0%, #eab30805 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px -4px #eab30830';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #eab30805 0%, transparent 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Animated gradient border overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(90deg, #eab30800, #eab30840, #eab30800)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 3s infinite',
                  pointerEvents: 'none',
                }}
              />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12" style={{ background: 'linear-gradient(135deg, #eab30820, #eab30840)', boxShadow: '0 4px 12px #eab30830' }}>
                      <svg className="w-5 h-5 text-white transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        All Receipts {receipts.length > 0 && `(${receipts.length})`}
                      </h3>
                      <p className="text-sm text-muted-foreground">View and manage receipts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #eab30815, #eab30825)', border: '1px solid #eab30840', boxShadow: '0 4px 12px #eab30820' }}>
                    <span className="text-xs font-bold tracking-wide text-white">
                      {isReceiptsExpanded ? 'HIDE' : 'SHOW'}
                    </span>
                    <div className="relative w-5 h-5">
                      <svg className={`absolute inset-0 transition-all duration-700 ${isReceiptsExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#eab308' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </button>

            {/* Add shimmer keyframe animation */}
            <style jsx>{`
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
            `}</style>

            {/* Content - Collapsible */}
            <div
              className={`overflow-hidden rounded-b-lg ${isReceiptsExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
              style={{
                transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* Filters */}
              <div className="px-6 py-4 border-t border-[#E1ECDB]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Month Filter */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor="month-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Month:
                    </Label>
                    <Listbox value={selectedMonth} onChange={setSelectedMonth}>
                      <div className="relative w-full">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border transition-all" style={{ borderColor: '#e5e7eb' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#eab30880'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'} onFocus={(e) => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.boxShadow = '0 0 0 2px #eab30840'; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                          <span className="block truncate text-sm">
                            {availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Listbox.Button>
                        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                          <Listbox.Options className="absolute left-0 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border yellow-scrollbar">
                            {availableMonths.map((m) => (
                              <Listbox.Option
                                key={m.value}
                                value={m.value}
                                className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                              >
                                {({ selected, active }) => (
                                  <span
                                    className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                    style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                  >
                                    {m.label}
                                  </span>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Category:
                    </Label>
                    <Listbox value={receiptCategoryFilter} onChange={setReceiptCategoryFilter}>
                      <div className="relative w-full">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border transition-all" style={{ borderColor: '#e5e7eb' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#eab30880'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'} onFocus={(e) => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.boxShadow = '0 0 0 2px #eab30840'; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                          <span className="block truncate text-sm">
                            {receiptCategoryFilter === 'all' && 'All Categories'}
                            {receiptCategoryFilter === 'cleanings' && 'Cleanings'}
                            {receiptCategoryFilter === 'repairs' && 'Repairs'}
                            {receiptCategoryFilter === 'maintenance' && 'Maintenance'}
                            {receiptCategoryFilter === 'restocks' && 'Restocks'}
                            {receiptCategoryFilter === 'photography' && 'Photography'}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Listbox.Button>
                        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                          <Listbox.Options className="absolute left-0 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border yellow-scrollbar">
                            <Listbox.Option
                              value="all"
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  All Categories
                                </span>
                              )}
                            </Listbox.Option>
                            <Listbox.Option
                              value="cleanings"
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  Cleanings
                                </span>
                              )}
                            </Listbox.Option>
                            <Listbox.Option
                              value="repairs"
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  Repairs
                                </span>
                              )}
                            </Listbox.Option>
                            <Listbox.Option
                              value="maintenance"
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  Maintenance
                                </span>
                              )}
                            </Listbox.Option>
                            <Listbox.Option
                              value="restocks"
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  Restocks
                                </span>
                              )}
                            </Listbox.Option>
                            <Listbox.Option
                              value="photography"
                              className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4`}
                            >
                              {({ selected, active }) => (
                                <span
                                  className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}
                                  style={active ? { backgroundColor: '#eab30810', color: '#ca8a04' } : {}}
                                >
                                  Photography
                                </span>
                              )}
                            </Listbox.Option>
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>
                </div>
              </div>

              {/* Receipts Content */}
              <CardContent className="pt-6">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading receipts...</p>
                ) : receipts.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    No receipts found for {availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}
                  </p>
                ) : (() => {
                  // Apply category filter
                  let filteredReceipts = receipts;
                  if (receiptCategoryFilter !== 'all') {
                    filteredReceipts = receipts.filter(r =>
                      r.description?.toLowerCase().includes(receiptCategoryFilter.toLowerCase())
                    );
                  }

                  return filteredReceipts.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      No {receiptCategoryFilter === 'all' ? '' : receiptCategoryFilter} receipts found for {availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {filteredReceipts.map((receipt) => (
                        <Card key={receipt.id} className="border-border hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{receipt.file_name}</span>
                                  {receipt.mime_type?.includes('pdf') && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">PDF</span>
                                  )}
                                  {receipt.mime_type?.includes('image') && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Image</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <div>Property: {getPropertyName(receipt.property_id)}</div>
                                  {receipt.receipt_date && (
                                    <div>Month: <span className="font-medium">{(() => {
                                      // Parse YYYY-MM-DD and create date in local timezone to avoid UTC issues
                                      const [year, month] = receipt.receipt_date.split('-').map(Number);
                                      const date = new Date(year, month - 1, 15); // Use 15th to avoid timezone edge cases
                                      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                    })()}</span></div>
                                  )}
                                  <div>Uploaded: {new Date(receipt.date_added).toLocaleDateString()}</div>
                                  {receipt.amount_cents !== null && (
                                    <div>Amount: {formatMoney(receipt.amount_cents)}</div>
                                  )}
                                  {receipt.description && (
                                    <div>Category: <span className="font-medium text-primary">{receipt.description}</span></div>
                                  )}
                                  {receipt.note && (
                                    <div>Note: <span className="font-medium text-foreground">{receipt.note}</span></div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewingImage(receipt)}
                                >
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(receipt.file_url, '_blank')}
                                >
                                  Download
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(receipt.id)}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        ))}
                      </div>
                    );
                  })()}
              </CardContent>
            </div>
          </Card>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 bg-white text-black hover:bg-gray-200"
              onClick={() => setViewingImage(null)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
            {viewingImage.mime_type?.includes('pdf') ? (
              <iframe
                src={viewingImage.file_url}
                className="w-full h-full bg-white rounded-lg"
                title={viewingImage.file_name}
              />
            ) : (
              <img
                src={viewingImage.file_url}
                alt={viewingImage.file_name}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
