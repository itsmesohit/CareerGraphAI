import { prisma } from '@careergraph/db';
import { InvoiceDto, PaymentProviderType, InvoiceStatus } from '@careergraph/shared';

export interface GenerateInvoiceParams {
  userId: string;
  orgId?: string | null;
  subscriptionId?: string | null;
  provider: PaymentProviderType;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  amount: number; // in smallest unit (paise / cents)
  currency: string;
  planName: string;
  customerGstin?: string | null;
  legalEntityName?: string | null;
  legalAddress?: string | null;
}

export class InvoiceService {
  // Provider Company Details for Invoicing
  public static readonly COMPANY_DETAILS = {
    name: 'CareerGraph Technologies India Private Limited',
    gstin: '07AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    state: 'Delhi (07)',
    stateCode: '07',
    address: 'Plot 42, Cyber Hub, Sector 24, New Delhi - 110001, India',
    sacCode: '998314', // Information Technology Software & Application Services
    email: 'billing@careergraph.ai',
  };

  /**
   * Generates a unique sequential invoice number (e.g., CG-2026-0001).
   */
  static async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count();
    const sequence = String(count + 1).padStart(4, '0');
    return `CG-${year}-${sequence}`;
  }

  /**
   * Calculates GST breakdown for a given subtotal.
   * Standard software SaaS rate in India is 18% GST (CGST 9% + SGST 9% or IGST 18%).
   */
  static calculateTax(
    subtotal: number,
    currency: string,
    customerGstin?: string | null
  ): {
    subtotal: number;
    taxAmount: number;
    total: number;
    taxType: 'CGST_SGST' | 'IGST' | 'NONE';
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  } {
    if (currency.toUpperCase() !== 'INR') {
      return {
        subtotal,
        taxAmount: 0,
        total: subtotal,
        taxType: 'NONE',
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      };
    }

    // 18% GST
    const taxAmount = Math.round(subtotal * 0.18);
    const total = subtotal + taxAmount;

    // Check customer state from GSTIN (first 2 digits)
    const customerStateCode = customerGstin ? customerGstin.substring(0, 2) : null;
    const isIntraState = customerStateCode === this.COMPANY_DETAILS.stateCode;

    if (isIntraState) {
      const halfTax = Math.round(taxAmount / 2);
      return {
        subtotal,
        taxAmount,
        total,
        taxType: 'CGST_SGST',
        cgstAmount: halfTax,
        sgstAmount: taxAmount - halfTax,
        igstAmount: 0,
      };
    } else {
      return {
        subtotal,
        taxAmount,
        total,
        taxType: 'IGST',
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: taxAmount,
      };
    }
  }

  /**
   * Validates Indian GSTIN format (15 characters alphanumeric).
   */
  static isValidGstin(gstin?: string | null): boolean {
    if (!gstin) return false;
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return regex.test(gstin.trim().toUpperCase());
  }

  /**
   * Generates and persists a GST tax invoice upon successful payment.
   */
  static async createInvoice(params: GenerateInvoiceParams): Promise<InvoiceDto> {
    const invoiceNumber = await this.getNextInvoiceNumber();
    const taxCalc = this.calculateTax(params.amount, params.currency, params.customerGstin);

    const lineItems = [
      {
        description: `${params.planName} SaaS Subscription`,
        quantity: 1,
        unitPrice: taxCalc.subtotal,
        amount: taxCalc.subtotal,
      },
    ];

    const invoice = await prisma.invoice.create({
      data: {
        userId: params.userId,
        orgId: params.orgId || null,
        subscriptionId: params.subscriptionId || null,
        invoiceNumber,
        provider: params.provider as any,
        providerPaymentId: params.providerPaymentId || null,
        providerOrderId: params.providerOrderId || null,
        subtotal: taxCalc.subtotal,
        taxAmount: taxCalc.taxAmount,
        total: taxCalc.total,
        currency: params.currency.toUpperCase(),
        status: 'PAID',
        customerGstin: params.customerGstin ? params.customerGstin.trim().toUpperCase() : null,
        legalEntityName: params.legalEntityName || null,
        legalAddress: params.legalAddress || null,
        sacCode: this.COMPANY_DETAILS.sacCode,
        lineItems: lineItems as any,
        paidAt: new Date(),
      },
    });

    return this.toDto(invoice);
  }

  /**
   * Lists invoices for a user.
   */
  static async listUserInvoices(userId: string): Promise<InvoiceDto[]> {
    const invoices = await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv) => this.toDto(inv));
  }

  /**
   * Retrieves an invoice by ID.
   */
  static async getInvoiceById(id: string, userId: string): Promise<InvoiceDto | null> {
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId },
    });

    return invoice ? this.toDto(invoice) : null;
  }

  /**
   * Generates a complete, beautiful HTML/CSS printable GST Tax Invoice.
   */
  static renderInvoiceHtml(invoice: InvoiceDto, userName: string, userEmail: string): string {
    const isInr = invoice.currency === 'INR';
    const subtotalFormatted = (invoice.subtotal / 100).toFixed(2);
    const taxFormatted = (invoice.taxAmount / 100).toFixed(2);
    const totalFormatted = (invoice.total / 100).toFixed(2);
    const currencySymbol = isInr ? '₹' : '$';

    const customerName = invoice.legalEntityName || userName;
    const customerGstin = invoice.customerGstin || 'Unregistered Consumer (B2C)';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px;
      color: #1e293b;
      background: #ffffff;
      font-size: 14px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 36px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #38bdf8;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .logo span {
      color: #0284c7;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      text-align: right;
    }
    .invoice-number {
      font-size: 14px;
      color: #64748b;
      font-family: monospace;
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      background: #ecfdf5;
      color: #059669;
      margin-top: 8px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .meta-card {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }
    .meta-card h4 {
      margin: 0 0 8px 0;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-card p {
      margin: 3px 0;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
    }
    td {
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .totals-area {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .totals-table {
      width: 320px;
    }
    .totals-table tr td:first-child {
      color: #64748b;
      font-weight: 500;
    }
    .totals-table tr td:last-child {
      text-align: right;
      font-weight: 600;
    }
    .totals-table .grand-total td {
      border-top: 2px solid #0f172a;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer {
      margin-top: 36px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .invoice-container { border: none; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <div class="logo">CareerGraph<span>AI</span></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Autonomous Career Intelligence Platform</div>
      </div>
      <div>
        <div class="invoice-title">Tax Invoice</div>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <div class="badge">PAID</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <h4>Issued By (Supplier)</h4>
        <p><strong>${this.COMPANY_DETAILS.name}</strong></p>
        <p>${this.COMPANY_DETAILS.address}</p>
        <p>GSTIN: <strong>${this.COMPANY_DETAILS.gstin}</strong> | PAN: ${this.COMPANY_DETAILS.pan}</p>
        <p>Email: ${this.COMPANY_DETAILS.email}</p>
      </div>

      <div class="meta-card">
        <h4>Billed To (Recipient)</h4>
        <p><strong>${customerName}</strong></p>
        <p>Email: ${userEmail}</p>
        ${invoice.legalAddress ? `<p>${invoice.legalAddress}</p>` : ''}
        <p>GSTIN / Tax ID: <strong>${customerGstin}</strong></p>
        <p>Invoice Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>HSN / SAC</th>
          <th>Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lineItems
          .map(
            (item) => `<tr>
            <td><strong>${item.description}</strong></td>
            <td><code>${invoice.sacCode}</code></td>
            <td>${item.quantity}</td>
            <td style="text-align: right;">${currencySymbol}${(item.unitPrice / 100).toFixed(2)}</td>
            <td style="text-align: right;">${currencySymbol}${(item.amount / 100).toFixed(2)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="totals-area">
      <table class="totals-table">
        <tr>
          <td>Subtotal</td>
          <td>${currencySymbol}${subtotalFormatted}</td>
        </tr>
        ${
          isInr && invoice.taxAmount > 0
            ? `<tr>
            <td>GST (18% - SAC ${invoice.sacCode})</td>
            <td>${currencySymbol}${taxFormatted}</td>
          </tr>`
            : ''
        }
        <tr class="grand-total">
          <td>Total Paid</td>
          <td>${currencySymbol}${totalFormatted}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>This is a computer-generated tax invoice issued in accordance with GST Rules. No physical signature is required.</p>
      <p>Payment processed securely via ${invoice.provider}. Transaction reference: ${invoice.id}</p>
    </div>
  </div>
</body>
</html>`;
  }

  static toDto(inv: any): InvoiceDto {
    return {
      id: inv.id,
      userId: inv.userId,
      orgId: inv.orgId,
      subscriptionId: inv.subscriptionId,
      invoiceNumber: inv.invoiceNumber,
      provider: inv.provider,
      subtotal: inv.subtotal,
      taxAmount: inv.taxAmount,
      total: inv.total,
      currency: inv.currency,
      status: inv.status,
      customerGstin: inv.customerGstin,
      legalEntityName: inv.legalEntityName,
      legalAddress: inv.legalAddress,
      sacCode: inv.sacCode,
      lineItems: (inv.lineItems as any) || [],
      paidAt: inv.paidAt?.toISOString(),
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt.toISOString(),
    };
  }
}
