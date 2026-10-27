import { describe, expect, it } from "vitest";

import { toInvoiceListItem } from "./invoice-list-item";

describe("toInvoiceListItem", () => {
  it("keeps the narrow money-free invoice projection", () => {
    expect(
      toInvoiceListItem({
        amount: 99.99,
        applicationNumber: "SQ-001",
        bankAccount: "ignored",
        contactPhone: "ignored",
        contractId: 7,
        customFields: { source: ["campaign"] },
        customerId: 6,
        fileFields: {
          contract_file: [
            { actualBytes: 12, displayName: "合同.pdf", fileId: 16, mediaType: "application/pdf" },
          ],
          invalid: [{ fileId: 0 }],
        },
        id: 8,
        invoiceNumber: "FP-001",
        invoiceType: "VAT",
        issuedDate: "2026-07-26",
        requestedDate: "2026-07-25",
        shippingAddress: "ignored",
        status: "REQUESTED",
        taxNumber: "ignored",
        title: "ignored",
        version: 3,
      }),
    ).toEqual({
      applicationNumber: "SQ-001",
      contractId: 7,
      customFields: { source: ["campaign"] },
      customerId: 6,
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 12,
              displayName: "合同.pdf",
              fileId: 16,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "contract_file",
        },
      ],
      id: 8,
      invoiceNumber: "FP-001",
      invoiceType: "VAT",
      issuedDate: "2026-07-26",
      requestedDate: "2026-07-25",
      status: "REQUESTED",
      version: 3,
    });
  });

  it("fails closed without a stable invoice/customer/version identity", () => {
    expect(toInvoiceListItem({ customerId: 6, id: 8 })).toBeNull();
    expect(toInvoiceListItem({ customerId: 0, id: 8, version: 0 })).toBeNull();
  });
});
