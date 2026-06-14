# Security Specification: SaaS Backoffice Platform

## 1. Data Invariants
- **Multi-Tenant Isolation**: No company, client, operation, invoice, expense, or audit log can be accessed or modified by an administrative session or user belonging to a different company tenant (`company_id` mismatch).
- **Immutability of Key Ownership**: Fields like `id` and `company_id` are strictly immutable once created.
- **Strict Input Validation**: Size enforcements on all string text, amount limitations on numbers, and valid date formats.
- **Verification Requirement**: Users must be fully authenticated and verified.

## 2. The "Dirty Dozen" Payloads (Attack Scenarios)
1. **Tenant ID Spoofing (Create client for another company)**: Trying to set `company_id` to `"comp-2"` as an authenticated actor belonging to `"comp-1"`.
2. **Key Hijacking (Update company ID of an existing client)**: Attempting to modify `company_id` field from `"comp-1"` to `"comp-2"` on update.
3. **Ghost Field Injection (Unregistered fields)**: Crafting a query or document payload containing `hack_isAdmin: true`.
4. **Denial of Wallet (Huge String ID/values)**: Creating a record with an ID that spans > 128 characters or descriptions exceeding maximum limits to cause memory/wallet load.
5. **PII Blanket Scrape**: Authenticated user trying to pull/list private company records for accounts they do not belong to.
6. **Self-Assigned Premium Plan**: Bypassing paid routes to self-promote subscription tier directly on company document. 
7. **Temporal Spoofing**: Sending client-system timestamp for `createdAt` / `updatedAt` instead of `request.time`.
8. **Invalid Format/Value types**: Writing string values to money fields like `cost` or `revenue`.
9. **Status Shortcutting/Overriding**: Skipping state checks to forcefully complete an operation without approval.
10. **Admin Spoofing**: Attempting to bypass validations by overriding `role` properties locally.
11. **Orphaned Registration**: Creating an invoice referring to a non-existent operations/client ID.
12. **Out of bounds amount validation**: Submitting negative numeric invoice amount values or extreme values.

## 3. Mock Test Runner Definition: firestore.rules.test.ts
```typescript
// Test assertions for security validations
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

// Standard security tests to run against drafted fortress rules.
// Rules unit testing will verify that all 12 dirty dozen payloads return permission denied.
```
