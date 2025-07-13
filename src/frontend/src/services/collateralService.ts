// Enhanced Collateral Analysis Service
// Comprehensive document recognition and processing

import axios from '../utils/axios';

export interface DocumentType {
  id: string;
  name: string;
  category: 'primary' | 'security' | 'assignment' | 'modification' | 'supporting';
  required: boolean;
  subtypes?: string[];
  confidenceThreshold: number;
  validationRules: string[];
}

export interface EnhancedDocumentClassification {
  documentType: string;
  subtype?: string;
  confidence: number;
  category: string;
  required: boolean;
  validationStatus: 'valid' | 'needs_review' | 'invalid';
  extractedFields: DocumentFields;
  qualityMetrics: QualityMetrics;
}

export interface DocumentFields {
  // Property Information
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyType?: string;
  legalDescription?: string;
  
  // Borrower Information
  borrowerName?: string;
  coBorrowerName?: string;
  borrowerSSN?: string;
  
  // Loan Information
  loanAmount?: number;
  originalLoanAmount?: number;
  interestRate?: number;
  loanType?: string;
  maturityDate?: string;
  originationDate?: string;
  
  // Security Information
  lienPosition?: number;
  recordingDate?: string;
  instrumentNumber?: string;
  recordingLocation?: string;
  
  // Assignment Information
  assignor?: string;
  assignee?: string;
  assignmentDate?: string;
  
  // Document Metadata
  pageCount?: number;
  documentDate?: string;
  notaryInfo?: NotaryInfo;
  signatures?: SignatureInfo[];
}

export interface NotaryInfo {
  notaryName?: string;
  notaryState?: string;
  commissionExpires?: string;
  notaryStamp?: boolean;
}

export interface SignatureInfo {
  signerName?: string;
  signatureType?: 'wet' | 'electronic' | 'stamped';
  signatureDate?: string;
  witnessed?: boolean;
}

export interface QualityMetrics {
  textConfidence: number;
  imageQuality: number;
  completeness: number;
  readability: number;
  structuralIntegrity: number;
}

export interface UploadOptions {
  autoClassify?: boolean;
  extractFields?: boolean;
  validateDocument?: boolean;
  confidenceThreshold?: number;
  enableOCR?: boolean;
  languageHint?: string;
}

// Enhanced document types with subtypes
export const ENHANCED_DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'note',
    name: 'Promissory Note',
    category: 'primary',
    required: true,
    subtypes: [
      'Fixed Rate Note',
      'Adjustable Rate Note', 
      'Interest Only Note',
      'Balloon Note',
      'Construction Note',
      'HELOC Note'
    ],
    confidenceThreshold: 0.85,
    validationRules: ['has_loan_amount', 'has_borrower_signature', 'has_payment_terms']
  },
  {
    id: 'mortgage',
    name: 'Mortgage/Security Instrument',
    category: 'security',
    required: true,
    subtypes: [
      'Conventional Mortgage',
      'FHA Mortgage',
      'VA Mortgage',
      'USDA Mortgage',
      'Jumbo Mortgage'
    ],
    confidenceThreshold: 0.80,
    validationRules: ['has_property_description', 'has_security_provisions', 'recorded_properly']
  },
  {
    id: 'deed_of_trust',
    name: 'Deed of Trust',
    category: 'security',
    required: true,
    subtypes: [
      'First Deed of Trust',
      'Second Deed of Trust',
      'HELOC Deed of Trust',
      'Construction Deed of Trust'
    ],
    confidenceThreshold: 0.80,
    validationRules: ['has_trustee', 'has_property_description', 'has_power_of_sale']
  },
  {
    id: 'assignment',
    name: 'Assignment',
    category: 'assignment',
    required: false,
    subtypes: [
      'Assignment of Mortgage',
      'Assignment of Deed of Trust',
      'Assignment of Note',
      'Corporate Assignment',
      'MERS Assignment'
    ],
    confidenceThreshold: 0.75,
    validationRules: ['has_assignor', 'has_assignee', 'properly_executed']
  },
  {
    id: 'modification',
    name: 'Loan Modification',
    category: 'modification',
    required: false,
    subtypes: [
      'Rate Modification',
      'Term Extension',
      'Principal Reduction',
      'Payment Modification',
      'HAMP Modification'
    ],
    confidenceThreshold: 0.70,
    validationRules: ['references_original_loan', 'has_new_terms', 'properly_executed']
  },
  {
    id: 'allonge',
    name: 'Allonge',
    category: 'modification',
    required: false,
    subtypes: [
      'Blank Endorsement',
      'Special Endorsement',
      'Restrictive Endorsement'
    ],
    confidenceThreshold: 0.75,
    validationRules: ['attached_to_note', 'has_endorsement', 'properly_executed']
  },
  {
    id: 'rider',
    name: 'Rider/Amendment',
    category: 'modification',
    required: false,
    subtypes: [
      'Adjustable Rate Rider',
      'Balloon Rider',
      'Prepayment Rider',
      'Assumability Rider',
      'Property Insurance Rider'
    ],
    confidenceThreshold: 0.70,
    validationRules: ['references_original_document', 'properly_executed']
  },
  {
    id: 'title_insurance',
    name: 'Title Insurance Policy',
    category: 'supporting',
    required: false,
    subtypes: [
      'Owners Policy',
      'Lenders Policy',
      'Extended Coverage Policy'
    ],
    confidenceThreshold: 0.80,
    validationRules: ['has_policy_number', 'covers_property', 'current_effective']
  },
  {
    id: 'appraisal',
    name: 'Property Appraisal',
    category: 'supporting',
    required: false,
    subtypes: [
      'Full Appraisal',
      'Drive-by Appraisal',
      'Desktop Appraisal',
      'BPO (Broker Price Opinion)'
    ],
    confidenceThreshold: 0.75,
    validationRules: ['recent_date', 'licensed_appraiser', 'property_matches']
  },
  {
    id: 'closing_disclosure',
    name: 'Closing Disclosure',
    category: 'supporting',
    required: false,
    subtypes: [
      'Initial CD',
      'Revised CD',
      'Corrected CD'
    ],
    confidenceThreshold: 0.80,
    validationRules: ['matches_loan_terms', 'properly_dated', 'borrower_received']
  }
];

class CollateralService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  }

  // Enhanced document upload with advanced options
  async uploadDocuments(
    loanId: string, 
    files: File[], 
    options: UploadOptions = {}
  ): Promise<EnhancedDocumentClassification[]> {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // Add processing options
    formData.append('options', JSON.stringify({
      autoClassify: options.autoClassify ?? true,
      extractFields: options.extractFields ?? true,
      validateDocument: options.validateDocument ?? true,
      confidenceThreshold: options.confidenceThreshold ?? 0.75,
      enableOCR: options.enableOCR ?? true,
      languageHint: options.languageHint ?? 'en'
    }));

    const response = await axios.post(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/enhanced`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 180000, // 3 minutes for enhanced processing
      }
    );

    return response.data.classifications;
  }

  // Validate file before upload
  validateFile(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check file type - support more formats
    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
    
    if (!supportedTypes.includes(file.type) && 
        !this.hasValidExtension(file.name)) {
      errors.push('Unsupported file type. Please use PDF, JPEG, PNG, or TIFF files.');
    }

    // Check file size (100MB limit for enhanced processing)
    if (file.size > 100 * 1024 * 1024) {
      errors.push('File size exceeds 100MB limit.');
    }

    // Check file name for potential issues
    if (!/^[\w\-. ]+$/.test(file.name)) {
      errors.push('File name contains invalid characters.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private hasValidExtension(filename: string): boolean {
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return validExtensions.includes(extension);
  }

  // Re-classify document with different settings
  async reclassifyDocument(
    loanId: string, 
    documentId: string, 
    options: Partial<UploadOptions> = {}
  ): Promise<EnhancedDocumentClassification> {
    const response = await axios.post(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/${documentId}/reclassify`,
      { options }
    );

    return response.data.classification;
  }

  // Manual document type override
  async setDocumentType(
    loanId: string,
    documentId: string,
    documentType: string,
    subtype?: string
  ): Promise<void> {
    await axios.patch(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/${documentId}`,
      {
        documentType,
        subtype,
        manuallyClassified: true
      }
    );
  }

  // Get document completeness analysis
  async getCompletenessAnalysis(loanId: string): Promise<{
    completeness: number;
    required: DocumentType[];
    present: string[];
    missing: string[];
    recommendations: string[];
  }> {
    const response = await axios.get(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/completeness`
    );

    return response.data;
  }

  // Advanced document analysis with field extraction
  async analyzeDocument(
    loanId: string,
    documentId: string,
    extractionRules?: string[]
  ): Promise<{
    fields: DocumentFields;
    confidence: QualityMetrics;
    validation: { field: string; status: string; message?: string }[];
  }> {
    const response = await axios.post(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/${documentId}/analyze`,
      { extractionRules }
    );

    return response.data;
  }

  // Batch processing for multiple documents
  async batchProcess(
    loanId: string,
    operations: {
      documentId: string;
      operation: 'reclassify' | 'extract' | 'validate';
      options?: any;
    }[]
  ): Promise<{ documentId: string; result: any; error?: string }[]> {
    const response = await axios.post(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/batch`,
      { operations }
    );

    return response.data.results;
  }

  // Get processing status for long-running operations
  async getProcessingStatus(loanId: string, jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    message?: string;
    result?: any;
  }> {
    const response = await axios.get(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/status/${jobId}`
    );

    return response.data;
  }

  // Document comparison and chain validation
  async validateDocumentChain(loanId: string): Promise<{
    valid: boolean;
    chain: { document: string; linkTo: string; status: string }[];
    gaps: string[];
    recommendations: string[];
  }> {
    const response = await axios.get(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/chain-validation`
    );

    return response.data;
  }

  // AI-powered document insights
  async getDocumentInsights(loanId: string): Promise<{
    riskFactors: { factor: string; severity: 'low' | 'medium' | 'high'; description: string }[];
    opportunities: string[];
    complianceIssues: string[];
    recommendations: { priority: string; action: string; impact: string }[];
  }> {
    const response = await axios.get(
      `${this.baseUrl}/api/v2/loans/${loanId}/collateral/insights`
    );

    return response.data;
  }
}

export const collateralService = new CollateralService();
export default collateralService;