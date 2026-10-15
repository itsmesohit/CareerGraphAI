import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Shield,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  RotateCw,
  Building,
  User,
  Check,
  X,
} from 'lucide-react';
import { PlanDto, InvoiceDto } from '@careergraph/shared';

export const BillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'plans' | 'usage' | 'invoices'>('plans');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanDto | null>(null);
  const [gstin, setGstin] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Queries
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => api.getPlans(),
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.getSubscription(),
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => api.getUsage(),
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => api.getInvoices(),
  });

  // Mutations
  const checkoutMutation = useMutation({
    mutationFn: (data: any) => api.createCheckoutSession(data),
    onSuccess: async (res) => {
      // In dev or live checkout
      if (res.session.isDevMode || res.session.provider === 'FREE_DEV') {
        // Complete checkout immediately via verification
        await api.verifyPayment({
          provider: res.session.provider,
          orderId: res.session.orderId,
          planKey: res.session.planKey,
          customerGstin: gstin.trim() || undefined,
          legalEntityName: companyName.trim() || undefined,
          legalAddress: companyAddress.trim() || undefined,
        });
        queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
        queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
        queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
        setCheckoutModalOpen(false);
      } else if (res.session.checkoutUrl) {
        window.location.href = res.session.checkoutUrl;
      }
    },
    onError: (err: any) => {
      setCheckoutError(err.message || 'Failed to initialize checkout');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelSubscription(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => api.reactivateSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
    },
  });

  const currentPlanKey = subData?.subscription?.plan?.key || 'FREE';
  const plans = plansData?.plans || [];
  const currentSub = subData?.subscription;
  const usage = usageData?.usage;
  const invoices = invoicesData?.invoices || [];

  const handleOpenCheckout = (plan: PlanDto) => {
    setSelectedPlan(plan);
    setCheckoutError(null);
    setCheckoutModalOpen(true);
  };

  const handleProceedCheckout = () => {
    if (!selectedPlan) return;
    setCheckoutError(null);
    checkoutMutation.mutate({
      planKey: selectedPlan.key,
      currency,
      provider: currency === 'INR' ? 'RAZORPAY' : 'STRIPE',
      customerGstin: gstin.trim() || null,
      legalEntityName: companyName.trim() || null,
      legalAddress: companyAddress.trim() || null,
    });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                  Plans, Billing & Metering
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500">
                    Phase 9
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subscription tiers, transparent usage meters, GST-compliant invoices, and enterprise quotas.
                </p>
              </div>
            </div>
          </div>

          {/* Current Tier Badge */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-2xl">
            <div className="flex flex-col text-right">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Active Tier
              </span>
              <span className="text-sm font-bold text-amber-600">
                {currentSub?.plan?.name || 'Free Starter'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-100">
            <button
              onClick={() => setActiveTab('plans')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'plans'
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Subscription Tiers
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'usage'
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Usage & Quotas
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'invoices'
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              Invoices & Receipts ({invoices.length})
            </button>
          </div>

          {/* Currency Toggle */}
          {activeTab === 'plans' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Currency:</span>
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setCurrency('INR')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    currency === 'INR' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-500'
                  }`}
                >
                  INR (₹)
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    currency === 'USD' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-500'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: PLANS & TIERS */}
        {activeTab === 'plans' && (
          <div className="space-y-8">
            {/* Interval Switcher */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 bg-slate-100/90 border border-slate-200 p-1 rounded-2xl shadow-xl">
                <button
                  onClick={() => setBillingInterval('MONTHLY')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    billingInterval === 'MONTHLY'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  onClick={() => setBillingInterval('ANNUAL')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    billingInterval === 'ANNUAL'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Save ~20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Filter plans by interval or free */}
              {plans
                .filter((p) => p.tier === 'INDIVIDUAL')
                .filter((p) => p.price === 0 || p.interval === billingInterval)
                .map((plan) => {
                  const isCurrent = currentPlanKey === plan.key;
                  const priceDisplay =
                    plan.price === 0
                      ? 'Free'
                      : currency === 'INR'
                      ? `₹${(plan.price / 100).toLocaleString('en-IN')}`
                      : `$${(plan.price / 100 / 83).toFixed(0)}`;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
                        plan.isPopular
                          ? 'bg-gradient-to-b from-slate-50/95 via-slate-900/80 to-[#0c1222] border-2 border-amber-500/50 shadow-2xl shadow-amber-500/10'
                          : 'bg-slate-100 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {plan.isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[11px] font-extrabold tracking-wider uppercase shadow-lg shadow-amber-500/30">
                          Most Popular Copilot
                        </div>
                      )}

                      <div>
                        {/* Plan Header */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                          {isCurrent && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 min-h-[36px]">{plan.description}</p>

                        {/* Price */}
                        <div className="my-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                              {priceDisplay}
                            </span>
                            {plan.price > 0 && (
                              <span className="text-xs text-slate-500 font-medium">
                                /{plan.interval === 'ANNUAL' ? 'year' : 'month'}
                              </span>
                            )}
                          </div>
                          {plan.price > 0 && currency === 'INR' && (
                            <span className="text-[11px] text-slate-500">+ 18% GST</span>
                          )}
                        </div>

                        {/* Entitlements Checklist */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong>{plan.entitlements.discoveryRunsPerDay}</strong> Job Discovery runs/day
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong>{plan.entitlements.preparedApplicationsPerMonth}</strong> Applications prepared/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                plan.entitlements.autoApplyAllowancePerMonth > 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-600'
                              }`}
                            />
                            <span>
                              <strong>{plan.entitlements.autoApplyAllowancePerMonth}</strong> Assisted Auto-Applies/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong>{plan.entitlements.tailoredResumesPerMonth}</strong> Tailored Resumes/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                plan.entitlements.outreachEmailsPerDay > 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-600'
                              }`}
                            />
                            <span>
                              <strong>{plan.entitlements.outreachEmailsPerDay}</strong> Cold Outreach emails/day
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                plan.entitlements.extensionAccess ? 'text-emerald-600' : 'text-slate-600'
                              }`}
                            />
                            <span>Chrome MV3 Extension Autofill</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                plan.entitlements.mailboxTracking ? 'text-emerald-600' : 'text-slate-600'
                              }`}
                            />
                            <span>Gmail & Outlook Mailbox Sync</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-8 pt-4 border-t border-slate-100">
                        {isCurrent ? (
                          <button
                            disabled
                            className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider cursor-default border border-slate-100"
                          >
                            Current Plan
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenCheckout(plan)}
                            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                              plan.isPopular
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:scale-[1.02]'
                                : 'bg-slate-100 hover:bg-slate-700 text-slate-900 border border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span>{plan.price === 0 ? 'Downgrade to Free' : 'Upgrade Plan'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Active Subscription Status & Cancellation Card */}
            {currentSub && currentSub.plan && currentSub.plan.price > 0 && (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    Subscription Management
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your {currentSub.plan.name} plan renews on{' '}
                    <strong>
                      {new Date(currentSub.currentPeriodEnd).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </strong>
                    .{' '}
                    {currentSub.cancelAtPeriodEnd
                      ? 'Cancellation scheduled: plan will lapse at period end.'
                      : 'Automatic renewal enabled.'}
                  </p>
                </div>

                <div>
                  {currentSub.cancelAtPeriodEnd ? (
                    <button
                      onClick={() => reactivateMutation.mutate()}
                      disabled={reactivateMutation.isPending}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                    >
                      {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
                    </button>
                  ) : (
                    <button
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                    >
                      {cancelMutation.isPending ? 'Scheduling...' : 'Cancel at Period End'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USAGE & METERS */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Live Resource Quota Meters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quotas are enforced automatically in the backend. Daily quotas reset at 00:00 UTC.
                  </p>
                </div>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['billing-usage'] })}
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg bg-slate-100 border border-slate-100"
                  title="Refresh Quota Telemetry"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {usage ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Discovery Runs (Daily) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Job Discovery Runs (Daily)
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {usage.quotas.discoveryRuns.used} / {usage.quotas.discoveryRuns.limit}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          usage.quotas.discoveryRuns.percentage > 85
                            ? 'bg-rose-500'
                            : usage.quotas.discoveryRuns.percentage > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usage.quotas.discoveryRuns.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{usage.quotas.discoveryRuns.remaining} runs remaining today</span>
                      <span>{usage.quotas.discoveryRuns.percentage}% used</span>
                    </div>
                  </div>

                  {/* Outreach Emails (Daily) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Cold Outreach Emails (Daily)
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {usage.quotas.outreachEmails.used} / {usage.quotas.outreachEmails.limit}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          usage.quotas.outreachEmails.percentage > 85
                            ? 'bg-rose-500'
                            : usage.quotas.outreachEmails.percentage > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usage.quotas.outreachEmails.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{usage.quotas.outreachEmails.remaining} emails remaining today</span>
                      <span>{usage.quotas.outreachEmails.percentage}% used</span>
                    </div>
                  </div>

                  {/* Prepared Applications (Monthly) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Prepared Applications (Monthly)
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {usage.quotas.applicationsPrepared.used} / {usage.quotas.applicationsPrepared.limit}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          usage.quotas.applicationsPrepared.percentage > 85
                            ? 'bg-rose-500'
                            : usage.quotas.applicationsPrepared.percentage > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usage.quotas.applicationsPrepared.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{usage.quotas.applicationsPrepared.remaining} apps remaining</span>
                      <span>{usage.quotas.applicationsPrepared.percentage}% used</span>
                    </div>
                  </div>

                  {/* Auto-Applies Executed (Monthly) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Assisted Auto-Applies (Monthly)
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {usage.quotas.autoAppliesExecuted.used} / {usage.quotas.autoAppliesExecuted.limit}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          usage.quotas.autoAppliesExecuted.percentage > 85
                            ? 'bg-rose-500'
                            : usage.quotas.autoAppliesExecuted.percentage > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usage.quotas.autoAppliesExecuted.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{usage.quotas.autoAppliesExecuted.remaining} auto-applies remaining</span>
                      <span>{usage.quotas.autoAppliesExecuted.percentage}% used</span>
                    </div>
                  </div>

                  {/* Tailored Resumes (Monthly) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Tailored Resumes (Monthly)
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {usage.quotas.tailoredResumes.used} / {usage.quotas.tailoredResumes.limit}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          usage.quotas.tailoredResumes.percentage > 85
                            ? 'bg-rose-500'
                            : usage.quotas.tailoredResumes.percentage > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usage.quotas.tailoredResumes.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{usage.quotas.tailoredResumes.remaining} resumes remaining</span>
                      <span>{usage.quotas.tailoredResumes.percentage}% used</span>
                    </div>
                  </div>

                  {/* AI Tokens (Monthly) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800">
                        AI Reasoning & Graph Memory Tokens
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {usage.quotas.aiTokens.used.toLocaleString()} /{' '}
                        {usage.quotas.aiTokens.limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          usage.quotas.aiTokens.percentage > 85
                            ? 'bg-rose-500'
                            : usage.quotas.aiTokens.percentage > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usage.quotas.aiTokens.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{usage.quotas.aiTokens.remaining.toLocaleString()} tokens remaining</span>
                      <span>{usage.quotas.aiTokens.percentage}% used</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">Loading quota meters...</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INVOICES & GST RECEIPTS */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-base font-bold text-slate-900">GST Tax Invoices & Payment Receipts</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compliant with Indian GST rules (SAC 998314). Invoices include tax breakdown and GSTIN details.
                </p>
              </div>

              {invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="pb-3 px-3">Invoice Number</th>
                        <th className="pb-3 px-3">Date</th>
                        <th className="pb-3 px-3">Amount</th>
                        <th className="pb-3 px-3">Tax (18% GST)</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3">Customer GSTIN</th>
                        <th className="pb-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-amber-600">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {new Date(inv.createdAt).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {inv.currency === 'INR' ? '₹' : '$'}
                            {(inv.total / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {inv.taxAmount > 0
                              ? `${inv.currency === 'INR' ? '₹' : '$'}${(inv.taxAmount / 100).toFixed(2)}`
                              : 'None'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {inv.customerGstin || 'B2C Individual'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <a
                              href={api.getInvoiceDownloadUrl(inv.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-700 text-amber-600 font-semibold text-xs border border-slate-100 hover:border-amber-500/30 transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Tax Invoice
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                  <FileText className="w-8 h-8 text-slate-600" />
                  <p className="text-sm">No paid invoices found yet.</p>
                  <p className="text-xs text-slate-500">
                    Paid subscription renewals and upgrades will automatically appear here with full GST breakdown.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHECKOUT MODAL */}
        {checkoutModalOpen && selectedPlan && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative">
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="absolute top-5 right-5 text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Zap className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Upgrade to {selectedPlan.name}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedPlan.interval === 'ANNUAL' ? 'Annual plan (Save ~20%)' : 'Monthly plan'}
                  </p>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Price summary */}
              <div className="p-4 rounded-xl bg-white border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Base Plan Price:</span>
                  <span className="font-semibold text-slate-900">
                    {currency === 'INR' ? '₹' : '$'}
                    {(selectedPlan.price / 100).toLocaleString('en-IN')}
                  </span>
                </div>
                {currency === 'INR' && selectedPlan.price > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>GST (18% - SAC 998314):</span>
                    <span>₹{((selectedPlan.price * 0.18) / 100).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-amber-600 pt-2 border-t border-slate-100">
                  <span>Total Amount:</span>
                  <span>
                    {currency === 'INR' ? '₹' : '$'}
                    {currency === 'INR' && selectedPlan.price > 0
                      ? ((selectedPlan.price * 1.18) / 100).toLocaleString('en-IN')
                      : (selectedPlan.price / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Optional Corporate GST Details */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Corporate Invoicing Details (Optional)
                </span>
                <div>
                  <label className="text-xs text-slate-700 block mb-1">
                    GSTIN (Indian Tax Identification Number)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 07AAAAA0000A1Z5"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-700 block mb-1">Company / Entity Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Technologies LLP"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-700 block mb-1">Billing Address</label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Sector 24, Cyber City, Gurgaon"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Checkout Trigger */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setCheckoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedCheckout}
                  disabled={checkoutMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02]"
                >
                  {checkoutMutation.isPending ? (
                    'Processing Checkout...'
                  ) : (
                    <>
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
