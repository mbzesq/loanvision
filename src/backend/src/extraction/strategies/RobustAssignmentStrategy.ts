import { 
  ExtractionStrategy, 
  ExtractedCandidate, 
  ExtractorConfig 
} from '../markdownFieldExtractorV2';
import { RobustAssignmentExtractor } from '../RobustAssignmentExtractor';

export class RobustAssignmentStrategy implements ExtractionStrategy {
  name = 'RobustAssignment';
  priority = 99; // Highest priority - should run before other strategies
  
  private extractor = new RobustAssignmentExtractor();

  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    // Only run for assignment fields
    const hasAssignmentFields = config.fields.some(f => 
      f.name === 'assignor' || f.name === 'assignee'
    );
    
    if (!hasAssignmentFields) {
      return results;
    }
    
    console.log('[RobustAssignmentStrategy] =========================');
    console.log('[RobustAssignmentStrategy] Starting robust assignment extraction...');
    console.log('[RobustAssignmentStrategy] Text preview:', text.substring(0, 200) + '...');
    
    const extraction = this.extractor.extractAssignmentParties(text);
    
    console.log('[RobustAssignmentStrategy] Extraction result:', {
      assignor: extraction.assignor,
      assignee: extraction.assignee,
      confidence: extraction.confidence,
      method: extraction.method
    });
    
    if (extraction.assignor) {
      results.set('assignor', {
        value: extraction.assignor,
        confidence: extraction.confidence,
        strategy: this.name,
        justification: `Robust extraction via ${extraction.method}`
      });
      console.log('[RobustAssignmentStrategy] Added assignor to results:', extraction.assignor);
    }
    
    if (extraction.assignee) {
      results.set('assignee', {
        value: extraction.assignee,
        confidence: extraction.confidence,
        strategy: this.name,
        justification: `Robust extraction via ${extraction.method}`
      });
      console.log('[RobustAssignmentStrategy] Added assignee to results:', extraction.assignee);
    }
    
    if (extraction.confidence === 0) {
      console.log('[RobustAssignmentStrategy] No valid assignment parties found');
    }
    
    console.log('[RobustAssignmentStrategy] Final results size:', results.size);
    console.log('[RobustAssignmentStrategy] =========================');
    
    return results;
  }
}