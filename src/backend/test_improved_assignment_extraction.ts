import { MarkdownFieldExtractor } from './src/extraction/markdownFieldExtractor';
import { DocumentType } from './src/ml/documentClassifier';

// Test document - the problematic assignment from the user
const testDocument = `NYC DEPARTMENT OF FINANCE
OFFICE OF THE CITY REGISTER

This page is part of the instrument. The City Register will rely on the information provided by you on this page for purposes of indexing this instrument. The information on this page will control for indexing purposes in the event of any conflict with the rest of the document.

2020090200170001001E2A5E PAGE 1 OF 3

RECORDING AND ENDORSEMENT COVER PAGE

Document ID: 2020090200170001 Document Date: 08-26-2020 Preparation Date: 09-02-2020
Document Type: ASSIGNMENT, MORTGAGE
Document Page Count: 2

PRESENTER:
TITLE365
5000 BIRCH ST STE 300
NEWPORT BEACH, CA 92660-2147

RETURN TO:
TITLE365
5000 BIRCH ST STE 300
NEWPORT BEACH, CA 92660-2147

PROPERTY DATA

| Borough  | Block | Lot           | Unit | Address            |
| -------- | ----- | ------------- | ---- | ------------------ |
| BROOKLYN | 1767  | 43 Entire Lot |      | 160 TOMKINS AVENUE |

Property Type: DWELLING ONLY - 2 FAMILY

CRFN: 2006000084092

CROSS REFERENCE DATA

| ASSIGNOR/OLD LENDER:               | PARTIES                                      |
| ---------------------------------- | -------------------------------------------- |
| MORTGAGE ELECTRONIC REGISTRATION   | ASSIGNEE/NEW LENDER:                         |
| 1901 EAST VOORHEES STREET, SUITE C | STAR201, LLC, C/O RICHLAND & FALKOWSKI, PLLC |
| DANVILLE, IL 61834                 | 5 FAIRLAWN DRIVE                             |
|                                    | WASHINGTONVILLE,, NY 10992                   |

-------------------------------------------------------------------------------- Page 2

# EXHIBIT A

Legal Description

ALL that certain plot, piece or parcel of land, with the buildings and improvements thereon erected, situate, lying and being in the Borough of Brooklyn, County of Kings, City and State of New York, bounded and described as follows:

BEGINNING at a point on the Westerly side of Tompkins Avenue, distant 34 feet 9-1/2 inches Northerly from the corner formed by the intersection of the Northerly side of Hart Street and the Westerly side of Tompkins Avenue;

RUNNING THENCE Westerly parallel with Hart Street, 66 feet;

THENCE Northerly parallel with Tompkins Avenue, 20 feet 2-1/2 inches;

THENCE Easterly again parallel with Hart Street, feet to the Westerly side of Tompkins Avenue;

THENCE Southerly along the Westerly side of Tompkins Avenue, 20 feet 2-1/2 inches to the point or place of BEGINNING.

-------------------------------------------------------------------------------- Page 3

# ASSIGNMENT OF MORTGAGE

For good and valuable consideration, the sufficiency of which is hereby acknowledged, Mortgage Electronic Registration Systems, Inc. ("MERS"), as Mortgagee, Solely As Nominee For Lehman Brothers Bank, FSB, A Federal Savings Bank, Its Successors and Assigns, 1901 East Voorhees Street, Suite C, Danville, IL 61834, by these presents does convey, assign, transfer and set over to: Star201, LLC, c/o Richland & Falkowski, PLLC, 5 Fairlawn Drive Washingtonville, NY 10992, the following described Mortgage, with all interest, all liens, and any rights due or to become due thereon.`;

async function testImprovedExtraction() {
  console.log('Testing improved assignment extraction...\n');
  
  const extractor = new MarkdownFieldExtractor();
  
  try {
    const fields = await extractor.extractFields(testDocument, DocumentType.ASSIGNMENT);
    
    console.log('Extraction Results:');
    console.log('===================');
    console.log(`Assignor: ${fields.assignor || 'NOT FOUND'}`);
    console.log(`Assignee: ${fields.assignee || 'NOT FOUND'}`);
    console.log(`Recording Date: ${fields.recordingDate || 'NOT FOUND'}`);
    console.log(`Instrument Number: ${fields.instrumentNumber || 'NOT FOUND'}`);
    console.log('\nConfidence Scores:');
    fields.fieldConfidence.forEach((confidence, field) => {
      console.log(`  ${field}: ${confidence}`);
    });
    
    // Validate results
    console.log('\nValidation:');
    console.log('===========');
    const expectedAssignor = 'MORTGAGE ELECTRONIC REGISTRATION';
    const expectedAssignee = 'STAR201, LLC';
    
    const assignorCorrect = fields.assignor?.includes(expectedAssignor);
    const assigneeCorrect = fields.assignee?.includes(expectedAssignee);
    
    console.log(`✓ Assignor contains "${expectedAssignor}": ${assignorCorrect ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Assignee contains "${expectedAssignee}": ${assigneeCorrect ? 'PASS' : 'FAIL'}`);
    console.log(`✓ No legal description text extracted: ${
      !fields.assignor?.includes('corner') && !fields.assignee?.includes('Hart Street') ? 'PASS' : 'FAIL'
    }`);
    
  } catch (error) {
    console.error('Error during extraction:', error);
  }
}

// Run the test
testImprovedExtraction();