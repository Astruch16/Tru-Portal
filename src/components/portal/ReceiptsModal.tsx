'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, month, selectedPropertyId]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      let url = `/api/orgs/${orgId}/receipts?month=${month}`;
      if (selectedPropertyId) {
        url += `&propertyId=${selectedPropertyId}`;
      }
      const response = await fetch(url);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            📄 Receipts {selectedPropertyId && `- ${getPropertyName(selectedPropertyId)}`}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Form (Admin Only) */}
          {isAdmin && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Upload Receipt</h3>
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
                    <select
                      id="receipt-property"
                      value={uploadPropertyId}
                      onChange={(e) => setUploadPropertyId(e.target.value)}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1"
                    >
                      <option value="">Select property...</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
                  className="mt-4"
                >
                  {uploading ? 'Uploading...' : 'Upload Receipt'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Receipts List */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {month} Receipts {receipts.length > 0 && `(${receipts.length})`}
            </h3>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading receipts...</p>
            ) : receipts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                No receipts found for {month}
              </p>
            ) : (
              <div className="grid gap-4">
                {receipts.map((receipt) => (
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
                            <div>Uploaded: {new Date(receipt.date_added).toLocaleDateString()}</div>
                            {receipt.receipt_date && (
                              <div>Receipt Date: {new Date(receipt.receipt_date).toLocaleDateString()}</div>
                            )}
                            {receipt.amount_cents !== null && (
                              <div>Amount: {formatMoney(receipt.amount_cents)}</div>
                            )}
                            {receipt.description && (
                              <div>Note: {receipt.description}</div>
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
            )}
          </div>
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
