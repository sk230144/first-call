/**
 * Ready-made document templates offered as a starting point when creating a
 * new document template — so staff don't have to write one from scratch.
 * Bodies use {{key}} placeholders directly (same format FieldEditor
 * produces), and `variables` is pre-populated to match.
 */
export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  body: string;
  variables: { key: string; label: string; required: boolean }[];
};

export const DOCUMENT_STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'service-agreement',
    name: 'Service Agreement',
    description: 'A general agreement for one party providing a paid service to another.',
    body:
      `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into between {{provider_name}}, located at {{provider_address}} ("Provider"), and {{customer_name}}, located at {{customer_address}} ("Customer"), effective as of {{start_date}}.

1. Services
Provider agrees to provide {{service_description}} to Customer, beginning on {{start_date}} and continuing until {{end_date}}, unless terminated earlier as provided in this Agreement.

2. Payment
Customer agrees to pay Provider {{payment_amount}} for the services described above. Payment is due {{payment_terms}}.

3. Term and Termination
This Agreement remains in effect until {{end_date}}. Either party may terminate this Agreement with {{notice_period}} written notice to the other party.

4. Confidentiality
Both parties agree to keep confidential any non-public information shared during the course of this Agreement.

5. Governing Law
This Agreement shall be governed by the laws of {{governing_law}}.

6. Signatures
By signing below, both parties agree to the terms of this Agreement.

Customer: {{customer_name}}
Date: {{signing_date}}`,
    variables: [
      { key: 'provider_name', label: 'Provider Name', required: true },
      { key: 'provider_address', label: 'Provider Address', required: true },
      { key: 'customer_name', label: 'Customer Name', required: true },
      { key: 'customer_address', label: 'Customer Address', required: true },
      { key: 'start_date', label: 'Start Date', required: true },
      { key: 'service_description', label: 'Service Description', required: true },
      { key: 'end_date', label: 'End Date', required: true },
      { key: 'payment_amount', label: 'Payment Amount', required: true },
      { key: 'payment_terms', label: 'Payment Terms', required: true },
      { key: 'notice_period', label: 'Notice Period', required: true },
      { key: 'governing_law', label: 'Governing Law', required: true },
      { key: 'signing_date', label: 'Signing Date', required: true },
    ],
  },
  {
    id: 'nda',
    name: 'Non-Disclosure Agreement (NDA)',
    description: 'A mutual confidentiality agreement between two parties.',
    body:
      `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is made effective as of {{effective_date}}, between {{disclosing_party}} ("Disclosing Party") and {{receiving_party}} ("Receiving Party").

1. Purpose
The parties wish to explore {{purpose_of_disclosure}} and, in connection with this opportunity, Disclosing Party may share confidential information with Receiving Party.

2. Confidential Information
Receiving Party agrees to hold all confidential information in strict confidence and not disclose it to any third party without prior written consent from Disclosing Party.

3. Term
This Agreement shall remain in effect for {{confidentiality_period}} from the date first written above.

4. Governing Law
This Agreement shall be governed by the laws of {{governing_law}}.

5. Signatures

Receiving Party: {{receiving_party}}
Date: {{signing_date}}`,
    variables: [
      { key: 'effective_date', label: 'Effective Date', required: true },
      { key: 'disclosing_party', label: 'Disclosing Party', required: true },
      { key: 'receiving_party', label: 'Receiving Party', required: true },
      { key: 'purpose_of_disclosure', label: 'Purpose of Disclosure', required: true },
      { key: 'confidentiality_period', label: 'Confidentiality Period', required: true },
      { key: 'governing_law', label: 'Governing Law', required: true },
      { key: 'signing_date', label: 'Signing Date', required: true },
    ],
  },
  {
    id: 'freelance-contract',
    name: 'Freelance / Contractor Agreement',
    description: 'For hiring an independent contractor for a defined project.',
    body:
      `FREELANCE SERVICES AGREEMENT

This Agreement is entered into between {{client_name}} ("Client") and {{contractor_name}} ("Contractor") as of {{start_date}}.

1. Project Scope
Contractor agrees to complete the following work: {{project_description}}.

2. Timeline
Work will begin on {{start_date}} and is expected to be completed by {{delivery_date}}.

3. Compensation
Client agrees to pay Contractor {{payment_amount}}, payable {{payment_terms}}.

4. Ownership
Upon full payment, all work product created under this Agreement becomes the property of Client.

5. Independent Contractor Status
Contractor is an independent contractor, not an employee of Client, and is responsible for their own taxes and insurance.

6. Signatures

Contractor: {{contractor_name}}
Date: {{signing_date}}`,
    variables: [
      { key: 'client_name', label: 'Client Name', required: true },
      { key: 'contractor_name', label: 'Contractor Name', required: true },
      { key: 'start_date', label: 'Start Date', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'delivery_date', label: 'Delivery Date', required: true },
      { key: 'payment_amount', label: 'Payment Amount', required: true },
      { key: 'payment_terms', label: 'Payment Terms', required: true },
      { key: 'signing_date', label: 'Signing Date', required: true },
    ],
  },
  {
    id: 'rental-agreement',
    name: 'Rental Agreement',
    description: 'A basic residential/property rental agreement.',
    body:
      `RENTAL AGREEMENT

This Rental Agreement is made between {{landlord_name}} ("Landlord") and {{tenant_name}} ("Tenant") for the property located at {{property_address}}.

1. Term
The rental term begins on {{lease_start_date}} and ends on {{lease_end_date}}.

2. Rent
Tenant agrees to pay {{monthly_rent}} per month, due on the {{rent_due_day}} of each month.

3. Security Deposit
Tenant shall pay a security deposit of {{security_deposit}} prior to move-in.

4. Use of Property
The property shall be used solely as a residence for Tenant and shall not be used for any unlawful purpose.

5. Signatures

Tenant: {{tenant_name}}
Date: {{signing_date}}`,
    variables: [
      { key: 'landlord_name', label: 'Landlord Name', required: true },
      { key: 'tenant_name', label: 'Tenant Name', required: true },
      { key: 'property_address', label: 'Property Address', required: true },
      { key: 'lease_start_date', label: 'Lease Start Date', required: true },
      { key: 'lease_end_date', label: 'Lease End Date', required: true },
      { key: 'monthly_rent', label: 'Monthly Rent', required: true },
      { key: 'rent_due_day', label: 'Rent Due Day', required: true },
      { key: 'security_deposit', label: 'Security Deposit', required: true },
      { key: 'signing_date', label: 'Signing Date', required: true },
    ],
  },
];
