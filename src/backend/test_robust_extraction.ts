import { RobustAssignmentExtractor } from './src/extraction/RobustAssignmentExtractor';

const testDocument = `NYC DEPARTMENT OF FINANCE
OFFICE OF THE CITY REGISTER

RECORDING AND ENDORSEMENT COVER PAGE

Document ID: 2020090200170001 Document Date: 08-26-2020

CROSS REFERENCE DATA

| ASSIGNOR/OLD LENDER:               | PARTIES                                      |
| ---------------------------------- | -------------------------------------------- |
| MORTGAGE ELECTRONIC REGISTRATION   | ASSIGNEE/NEW LENDER:                         |
| 1901 EAST VOORHEES STREET, SUITE C | STAR201, LLC, C/O RICHLAND & FALKOWSKI, PLLC |
| DANVILLE, IL 61834                 | 5 FAIRLAWN DRIVE                             |
|                                    | WASHINGTONVILLE,, NY 10992                   |

# EXHIBIT A

Legal Description

ALL that certain plot, piece or parcel of land, with the buildings and improvements thereon erected, situate, lying and being in the Borough of Brooklyn, County of Kings, City and State of New York, bounded and described as follows:

BEGINNING at a point on the Westerly side of Tompkins Avenue, distant 34 feet 9-1/2 inches Northerly from the corner formed by the intersection of the Northerly side of Hart Street and the Westerly side of Tompkins Avenue;

RUNNING THENCE Westerly parallel with Hart Street, 66 feet;

# ASSIGNMENT OF MORTGAGE

For good and valuable consideration, the sufficiency of which is hereby acknowledged, Mortgage Electronic Registration Systems, Inc. ("MERS"), as Mortgagee, Solely As Nominee For Lehman Brothers Bank, FSB, A Federal Savings Bank, Its Successors and Assigns, 1901 East Voorhees Street, Suite C, Danville, IL 61834, by these presents does convey, assign, transfer and set over to: Star201, LLC, c/o Richland & Falkowski, PLLC, 5 Fairlawn Drive Washingtonville, NY 10992, the following described Mortgage.`;

async function testRobustExtraction() {
  console.log('Testing Robust Assignment Extraction...\n');
  
  const extractor = new RobustAssignmentExtractor();
  const result = extractor.extractAssignmentParties(testDocument);
  
  console.log('Results:');
  console.log('========');
  console.log(`Assignor: ${result.assignor || 'NOT FOUND'}`);
  console.log(`Assignee: ${result.assignee || 'NOT FOUND'}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Method: ${result.method}`);
  
  console.log('\nValidation:');
  console.log('===========');
  const assignorCorrect = result.assignor?.includes('MORTGAGE ELECTRONIC REGISTRATION');
  const assigneeCorrect = result.assignee?.includes('STAR201');
  const noLegalDesc = !result.assignor?.includes('corner') && !result.assignee?.includes('Hart Street');
  
  console.log(`✓ Assignor contains MERS: ${assignorCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Assignee contains STAR201: ${assigneeCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`✓ No legal description extracted: ${noLegalDesc ? 'PASS' : 'FAIL'}`);
  console.log(`✓ High confidence (>0.8): ${result.confidence > 0.8 ? 'PASS' : 'FAIL'}`);
}

testRobustExtraction();