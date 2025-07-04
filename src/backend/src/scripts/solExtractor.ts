import * as fs from 'fs';
import * as path from 'path';

interface SOLRule {
  state_code: string;
  state_name: string;
  foreclosure_type: string[];
  sol_periods: {
    lien_years?: number;
    note_years?: number;
    foreclosure_years?: number;
    deficiency_years?: number;
    additional_periods?: Record<string, number>;
  };
  trigger_events: string[];
  tolling_provisions: string[];
  revival_methods: {
    partial_payment?: boolean;
    written_acknowledgment?: boolean;
    new_promise?: boolean;
    other?: string[];
  };
  effect_of_expiration: {
    lien_extinguished?: boolean;
    foreclosure_barred?: boolean;
    deficiency_barred?: boolean;
    becomes_unsecured?: boolean;
    special_effects?: string[];
  };
  special_provisions: string[];
  statute_citations: string[];
  key_cases?: string[];
  notes: string[];
  last_updated?: string;
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SOLDatabase {
  metadata: {
    document_title: string;
    extraction_date: string;
    total_jurisdictions: number;
    version: string;
  };
  jurisdictions: Record<string, SOLRule>;
}

class SOLExtractor {
  private textContent: string;
  private database: SOLDatabase;

  constructor(textFilePath: string) {
    this.textContent = fs.readFileSync(textFilePath, 'utf-8');
    this.database = {
      metadata: {
        document_title: "Comprehensive 51-Jurisdiction Analysis of Mortgage Foreclosure Statutes of Limitations",
        extraction_date: new Date().toISOString().split('T')[0],
        total_jurisdictions: 51,
        version: "1.0"
      },
      jurisdictions: {}
    };
  }

  public extractAll(): SOLDatabase {
    console.log('🚀 Starting SOL extraction...');
    
    // Step 1: Extract table data
    console.log('📊 Extracting summary table data...');
    this.extractTableData();
    
    // Step 2: Extract detailed state analyses
    console.log('📚 Extracting detailed state analyses...');
    this.extractDetailedAnalyses();
    
    // Step 3: Classify risk levels
    console.log('🎯 Classifying risk levels...');
    this.classifyRiskLevels();
    
    console.log(`✅ Extraction complete! Found ${Object.keys(this.database.jurisdictions).length} jurisdictions`);
    return this.database;
  }

  private extractTableData(): void {
    // Find the table section
    const tableStart = this.textContent.indexOf('State\nPrimary\nStatute of');
    const tableEnd = this.textContent.indexOf('III. Detailed Jurisdictional Analysis');
    
    if (tableStart === -1 || tableEnd === -1) {
      console.warn('⚠️ Could not locate summary table boundaries');
      return;
    }

    const tableSection = this.textContent.substring(tableStart, tableEnd);
    const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // State name to code mapping
    const stateNameToCode = this.getStateNameToCodeMapping();
    
    let currentState = '';
    let currentRule: Partial<SOLRule> = {};
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('Statute of') || line.includes('Limitations') || line.includes('Period (Years)')) {
        continue;
      }
      
      // Check if this is a state name
      const stateCode = stateNameToCode[line];
      if (stateCode) {
        // Save previous state if exists
        if (currentState && Object.keys(currentRule).length > 0) {
          this.saveTableRule(currentState, currentRule);
        }
        
        // Start new state
        currentState = stateCode;
        currentRule = {
          state_code: stateCode,
          state_name: line,
          foreclosure_type: [],
          sol_periods: {},
          trigger_events: [],
          tolling_provisions: [],
          revival_methods: {},
          effect_of_expiration: {},
          special_provisions: [],
          statute_citations: [],
          notes: []
        };
        continue;
      }
      
      if (currentState) {
        // Parse foreclosure type
        if (line.includes('Non-Judicial') || line.includes('Judicial') || line.includes('Both')) {
          currentRule.foreclosure_type = this.parseForeclosureType(line);
        }
        
        // Parse SOL periods
        if (this.containsNumbers(line)) {
          this.parseSOLPeriods(line, currentRule);
        }
        
        // Parse trigger events
        if (line.includes('Maturity') || line.includes('Default') || line.includes('Acceleration')) {
          currentRule.trigger_events = this.parseTriggerEvents(line);
        }
        
        // Parse statute citations
        if (this.isStatuteCitation(line)) {
          currentRule.statute_citations!.push(line);
        }
      }
    }
    
    // Save the last state
    if (currentState && Object.keys(currentRule).length > 0) {
      this.saveTableRule(currentState, currentRule);
    }
  }

  private extractDetailedAnalyses(): void {
    // Find the detailed analysis section
    const analysisStart = this.textContent.indexOf('III. Detailed Jurisdictional Analysis');
    if (analysisStart === -1) {
      console.warn('⚠️ Could not locate detailed analysis section');
      return;
    }

    const analysisSection = this.textContent.substring(analysisStart);
    
    // Split by state sections (looking for state names at start of line)
    const stateNameToCode = this.getStateNameToCodeMapping();
    const stateNames = Object.keys(stateNameToCode);
    
    for (const stateName of stateNames) {
      const stateCode = stateNameToCode[stateName];
      
      // Find this state's analysis section
      const stateRegex = new RegExp(`^${stateName}\\s*$`, 'm');
      const match = analysisSection.match(stateRegex);
      
      if (match) {
        const stateStart = match.index! + analysisStart;
        
        // Find the end (next state or end of document)
        let stateEnd = analysisSection.length + analysisStart;
        for (const nextStateName of stateNames) {
          if (nextStateName !== stateName) {
            const nextRegex = new RegExp(`^${nextStateName}\\s*$`, 'm');
            const nextMatch = this.textContent.substring(stateStart + stateName.length).match(nextRegex);
            if (nextMatch) {
              const nextStart = nextMatch.index! + stateStart + stateName.length;
              if (nextStart < stateEnd) {
                stateEnd = nextStart;
              }
            }
          }
        }
        
        const stateAnalysis = this.textContent.substring(stateStart, stateEnd);
        this.parseStateAnalysis(stateCode, stateAnalysis);
      }
    }
  }

  private parseStateAnalysis(stateCode: string, analysis: string): void {
    if (!this.database.jurisdictions[stateCode]) {
      this.database.jurisdictions[stateCode] = this.createEmptyRule(stateCode);
    }
    
    const rule = this.database.jurisdictions[stateCode];
    
    // Extract tolling provisions
    const tollingSection = this.extractSection(analysis, 'Tolling');
    if (tollingSection) {
      rule.tolling_provisions = this.parseTollingProvisions(tollingSection);
    }
    
    // Extract effect of expiration
    const effectSection = this.extractSection(analysis, 'Effect of Expiration');
    if (effectSection) {
      rule.effect_of_expiration = this.parseEffectOfExpiration(effectSection);
    }
    
    // Extract triggering events details
    const triggerSection = this.extractSection(analysis, 'Triggering Events');
    if (triggerSection) {
      rule.trigger_events = [...rule.trigger_events, ...this.parseDetailedTriggers(triggerSection)];
      rule.trigger_events = [...new Set(rule.trigger_events)]; // Remove duplicates
    }
    
    // Extract special provisions
    rule.special_provisions = this.extractSpecialProvisions(analysis);
    
    // Extract additional notes
    rule.notes = this.extractNotes(analysis);
    
    // Extract additional statute citations
    const additionalCitations = this.extractStatuteCitations(analysis);
    rule.statute_citations = [...rule.statute_citations, ...additionalCitations];
    rule.statute_citations = [...new Set(rule.statute_citations)]; // Remove duplicates
  }

  private extractSection(text: string, sectionName: string): string | null {
    const regex = new RegExp(`${sectionName}:?([^•]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  private parseTollingProvisions(text: string): string[] {
    const provisions: string[] = [];
    
    // Common tolling scenarios
    const tollingPatterns = [
      { pattern: /bankruptcy/gi, provision: 'bankruptcy_filing' },
      { pattern: /automatic stay/gi, provision: 'bankruptcy_automatic_stay' },
      { pattern: /out.?of.?state/gi, provision: 'out_of_state_residence' },
      { pattern: /military service/gi, provision: 'military_service' },
      { pattern: /minority/gi, provision: 'borrower_minority' },
      { pattern: /mental.?incapacity/gi, provision: 'mental_incapacity' },
      { pattern: /fraud/gi, provision: 'fraud_concealment' },
      { pattern: /acknowledgment/gi, provision: 'debt_acknowledgment' },
      { pattern: /partial payment/gi, provision: 'partial_payment' }
    ];
    
    for (const { pattern, provision } of tollingPatterns) {
      if (pattern.test(text)) {
        provisions.push(provision);
      }
    }
    
    return provisions;
  }

  private parseEffectOfExpiration(text: string): SOLRule['effect_of_expiration'] {
    const effect: SOLRule['effect_of_expiration'] = {};
    
    // Check for lien extinguishment
    if (/extinguish|extinguishment/gi.test(text)) {
      effect.lien_extinguished = true;
    }
    
    // Check for foreclosure barred
    if (/bars?.*(foreclosure|action)|foreclosure.*barred/gi.test(text)) {
      effect.foreclosure_barred = true;
    }
    
    // Check for deficiency barred
    if (/deficiency.*barred|bars.*deficiency/gi.test(text)) {
      effect.deficiency_barred = true;
    }
    
    // Check for becomes unsecured
    if (/unsecured|lose.*security|security.*lost/gi.test(text)) {
      effect.becomes_unsecured = true;
    }
    
    return effect;
  }

  private parseDetailedTriggers(text: string): string[] {
    const triggers: string[] = [];
    
    const triggerPatterns = [
      { pattern: /maturity.*date/gi, trigger: 'maturity_date' },
      { pattern: /default/gi, trigger: 'default_date' },
      { pattern: /acceleration/gi, trigger: 'acceleration_date' },
      { pattern: /missed.*payment/gi, trigger: 'missed_payment_date' },
      { pattern: /charge.?off/gi, trigger: 'charge_off_date' },
      { pattern: /last.*payment/gi, trigger: 'last_payment_date' },
      { pattern: /breach/gi, trigger: 'breach_date' },
      { pattern: /recording.*date/gi, trigger: 'recording_date' }
    ];
    
    for (const { pattern, trigger } of triggerPatterns) {
      if (pattern.test(text)) {
        triggers.push(trigger);
      }
    }
    
    return triggers;
  }

  private extractSpecialProvisions(analysis: string): string[] {
    const provisions: string[] = [];
    
    // Look for special provisions, case law, exceptions
    const specialPatterns = [
      /deceleration/gi,
      /zombie mortgage/gi,
      /power of sale/gi,
      /right of redemption/gi,
      /judicial foreclosure/gi,
      /non-judicial foreclosure/gi,
      /deed of trust/gi,
      /choice of law/gi,
      /revival/gi,
      /reinstatement/gi
    ];
    
    for (const pattern of specialPatterns) {
      const matches = analysis.match(pattern);
      if (matches) {
        provisions.push(...matches.map(m => m.toLowerCase()));
      }
    }
    
    return [...new Set(provisions)];
  }

  private extractNotes(analysis: string): string[] {
    const notes: string[] = [];
    
    // Extract sentences that contain important information
    const sentences = analysis.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    for (const sentence of sentences) {
      // Look for sentences with important keywords
      if (/important|critical|note|however|but|warning|caution/gi.test(sentence)) {
        notes.push(sentence.trim());
      }
    }
    
    return notes;
  }

  private extractStatuteCitations(text: string): string[] {
    const citations: string[] = [];
    
    // Pattern for statute citations
    const citationPatterns = [
      /\d+\s+[A-Z][a-z]*\.?\s*[A-Z][a-z]*\.?\s*[§§?]\s*[\d-]+/g, // e.g., "11 U.S.C. § 108"
      /[A-Z][a-z]*\.?\s*Code\s*[§§?]\s*[\d-]+/g, // e.g., "Cal. Code § 337"
      /[A-Z][a-z]*\.?\s*Stat\.?\s*[§§?]\s*[\d-]+/g // e.g., "Fla. Stat. § 95.11"
    ];
    
    for (const pattern of citationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        citations.push(...matches);
      }
    }
    
    return [...new Set(citations)];
  }

  private classifyRiskLevels(): void {
    for (const stateCode in this.database.jurisdictions) {
      const rule = this.database.jurisdictions[stateCode];
      rule.risk_level = this.calculateRiskLevel(rule);
    }
  }

  private calculateRiskLevel(rule: SOLRule): 'HIGH' | 'MEDIUM' | 'LOW' {
    let riskScore = 0;
    
    // Short SOL periods increase risk
    const minSOL = Math.min(
      rule.sol_periods.lien_years || 999,
      rule.sol_periods.note_years || 999,
      rule.sol_periods.foreclosure_years || 999
    );
    
    if (minSOL <= 5) riskScore += 3;
    else if (minSOL <= 10) riskScore += 2;
    else if (minSOL <= 15) riskScore += 1;
    
    // Lien extinguishment increases risk
    if (rule.effect_of_expiration.lien_extinguished) riskScore += 2;
    
    // Acceleration triggers increase risk
    if (rule.trigger_events.includes('acceleration_date')) riskScore += 1;
    
    // Limited tolling increases risk
    if (rule.tolling_provisions.length < 2) riskScore += 1;
    
    if (riskScore >= 5) return 'HIGH';
    if (riskScore >= 3) return 'MEDIUM';
    return 'LOW';
  }

  // Helper methods
  private saveTableRule(stateCode: string, rule: Partial<SOLRule>): void {
    this.database.jurisdictions[stateCode] = {
      ...this.createEmptyRule(stateCode),
      ...rule
    } as SOLRule;
  }

  private createEmptyRule(stateCode: string): SOLRule {
    return {
      state_code: stateCode,
      state_name: this.getStateNameFromCode(stateCode),
      foreclosure_type: [],
      sol_periods: {},
      trigger_events: [],
      tolling_provisions: [],
      revival_methods: {},
      effect_of_expiration: {},
      special_provisions: [],
      statute_citations: [],
      notes: []
    };
  }

  private parseForeclosureType(line: string): string[] {
    const types: string[] = [];
    if (/non.?judicial/gi.test(line)) types.push('non_judicial');
    if (/judicial/gi.test(line) && !/non.?judicial/gi.test(line)) types.push('judicial');
    if (/both/gi.test(line)) types.push('judicial', 'non_judicial');
    if (/quasi.?judicial/gi.test(line)) types.push('quasi_judicial');
    return types;
  }

  private parseSOLPeriods(line: string, rule: Partial<SOLRule>): void {
    if (!rule.sol_periods) rule.sol_periods = {};
    
    // Extract numbers followed by context
    const periodMatches = line.match(/(\d+)\s*(?:\([^)]*\))?/g);
    if (periodMatches) {
      for (const match of periodMatches) {
        const num = parseInt(match);
        if (line.toLowerCase().includes('lien')) {
          rule.sol_periods.lien_years = num;
        } else if (line.toLowerCase().includes('note')) {
          rule.sol_periods.note_years = num;
        } else if (line.toLowerCase().includes('deficiency')) {
          rule.sol_periods.deficiency_years = num;
        } else {
          rule.sol_periods.foreclosure_years = num;
        }
      }
    }
  }

  private parseTriggerEvents(line: string): string[] {
    const events: string[] = [];
    if (/maturity/gi.test(line)) events.push('maturity_date');
    if (/default/gi.test(line)) events.push('default_date');
    if (/acceleration/gi.test(line)) events.push('acceleration_date');
    if (/recording/gi.test(line)) events.push('recording_date');
    if (/payment/gi.test(line)) events.push('last_payment_date');
    return events;
  }

  private containsNumbers(line: string): boolean {
    return /\d+/.test(line);
  }

  private isStatuteCitation(line: string): boolean {
    return /[§§]\s*\d+|Code|Stat/gi.test(line);
  }

  private getStateNameToCodeMapping(): Record<string, string> {
    return {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
      'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
      'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
      'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
      'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
      'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
      'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
      'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
      'District of Columbia': 'DC'
    };
  }

  private getStateNameFromCode(code: string): string {
    const mapping = this.getStateNameToCodeMapping();
    for (const [name, stateCode] of Object.entries(mapping)) {
      if (stateCode === code) return name;
    }
    return code;
  }

  public saveToFile(outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(this.database, null, 2));
    console.log(`💾 SOL database saved to: ${outputPath}`);
  }
}

// Main execution
if (require.main === module) {
  const textFilePath = '/tmp/nplvision/projects/statute-of-limitations-research.txt';
  const outputPath = '/tmp/nplvision/projects/sol-database.json';
  
  const extractor = new SOLExtractor(textFilePath);
  const database = extractor.extractAll();
  extractor.saveToFile(outputPath);
  
  console.log('\n📊 Extraction Summary:');
  console.log(`Total jurisdictions: ${Object.keys(database.jurisdictions).length}`);
  console.log(`High risk states: ${Object.values(database.jurisdictions).filter(r => r.risk_level === 'HIGH').length}`);
  console.log(`Medium risk states: ${Object.values(database.jurisdictions).filter(r => r.risk_level === 'MEDIUM').length}`);
  console.log(`Low risk states: ${Object.values(database.jurisdictions).filter(r => r.risk_level === 'LOW').length}`);
}

export { SOLExtractor, SOLRule, SOLDatabase };