'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/utils';

type Property = {
  id: string;
  name: string;
  airbnb_name: string;
  airbnb_url: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  bill_month: string;
  amount_due_cents: number;
  status: 'due' | 'paid' | 'void';
};

interface UserProfileModalProps {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userPlan?: string;
  orgId: string;
  onClose: () => void;
}

export default function UserProfileModal({
  userId,
  userName,
  userEmail,
  userRole,
  userPlan,
  orgId,
  onClose,
}: UserProfileModalProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  async function loadUserData() {
    setLoading(true);
    try {
      // Load user's assigned properties
      const propsRes = await fetch(`/api/admin/user-properties/list?org_id=${orgId}&user_id=${userId}`);
      if (propsRes.ok) {
        const propsData = await propsRes.json();
        setProperties(propsData.assignments || []);
      }

      // Load user's invoices
      const invoicesRes = await fetch(`/api/orgs/${orgId}/invoices/list?user_id=${userId}`);
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData.invoices || []);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }

  const dueInvoices = invoices.filter(i => i.status === 'due');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalDue = dueInvoices.reduce((sum, i) => sum + i.amount_due_cents, 0);
  const totalPaid = paidInvoices.reduce((sum, i) => sum + i.amount_due_cents, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">User Profile</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-muted"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-muted-foreground">Loading user data...</p>
            </div>
          ) : (
            <>
              {/* User Info Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/30">
                      <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>

                    {/* User Details */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{userName}</h3>
                      <p className="text-sm text-muted-foreground">{userEmail}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="capitalize">
                          {userRole}
                        </Badge>
                        {userPlan && (
                          <Badge variant="outline" className="capitalize bg-primary/10 text-primary border-primary/30">
                            {userPlan}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Properties Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Assigned Properties ({properties.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {properties.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      No properties assigned yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {properties.map((prop) => (
                        <div
                          key={prop.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{prop.airbnb_name}</p>
                            <p className="text-xs text-muted-foreground">Property: {prop.name}</p>
                          </div>
                          {prop.airbnb_url && (
                            <a
                              href={prop.airbnb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                            >
                              View
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Status Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Invoice Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs font-medium text-red-800 uppercase mb-1">Outstanding</p>
                      <p className="text-2xl font-bold text-red-900">{formatMoney(totalDue)}</p>
                      <p className="text-xs text-red-700 mt-1">{dueInvoices.length} invoice{dueInvoices.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs font-medium text-green-800 uppercase mb-1">Paid</p>
                      <p className="text-2xl font-bold text-green-900">{formatMoney(totalPaid)}</p>
                      <p className="text-xs text-green-700 mt-1">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Recent Invoices */}
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      No invoices generated yet
                    </p>
                  ) : (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Recent Invoices</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {invoices.slice(0, 10).map((invoice) => (
                          <div
                            key={invoice.id}
                            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">Invoice #{invoice.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">{invoice.bill_month}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-semibold tabular-nums">{formatMoney(invoice.amount_due_cents)}</p>
                              <Badge
                                variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                                className={
                                  invoice.status === 'paid'
                                    ? 'bg-green-100 text-green-800 border-green-300'
                                    : 'bg-red-100 text-red-800 border-red-300'
                                }
                              >
                                {invoice.status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 flex justify-end">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
