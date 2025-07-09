# NPLVision Score Framework - 07-09-2025

## Executive Summary
The NPLVision Score is a proprietary loan-level and portfolio-level risk scoring system that provides a comprehensive assessment of non-performing loan recovery potential and investment quality. This dynamic scoring framework integrates multiple data sources and risk factors to generate actionable insights for portfolio managers and investors.

## Scoring Philosophy

### Core Principle
The NPLVision Score moves beyond simple delinquency status to provide a holistic view of loan quality, recovery potential, and investment opportunity. Rather than treating all NPLs as uniformly risky, the system identifies diamonds in the rough while flagging truly problematic assets.

### Dynamic Assessment
Scores are recalculated monthly with real-time updates triggered by significant events (payments received, legal actions, market changes). This ensures portfolio managers always have current intelligence for decision-making.

## Score Framework Architecture

### Base Score Components (Weighted Calculation)

#### 1. Payment Status & History (35% Weight)
**Current Payment Status**
- Performing (90-100 points)
- 1-30 days delinquent (80-89 points)
- 31-60 days delinquent (70-79 points)
- 61-90 days delinquent (60-69 points)
- 90+ days delinquent (40-59 points)
- Foreclosure status (20-39 points)

**Payment Pattern Analysis**
- Consecutive payment streak (bonus points)
- Payment amount vs. required payment ratio
- Partial payment behavior (shows intent to pay)
- Seasonal payment patterns
- Modification compliance history

**Historical Performance**
- Lifetime delinquency rate
- Previous workout attempts and outcomes
- Bankruptcy history and current status
- REO/short sale history on borrower's other properties

#### 2. Equity Position (25% Weight)
**Loan-to-Value (LTV) Analysis**
- Current LTV < 70% (90-100 points)
- Current LTV 70-80% (80-89 points)
- Current LTV 80-90% (70-79 points)
- Current LTV 90-100% (60-69 points)
- Current LTV 100-110% (40-59 points)
- Current LTV > 110% (20-39 points)

**Property Value Trends**
- Local market appreciation/depreciation rates
- Property-specific valuation changes
- Neighborhood price stability
- Comparative market analysis (CMA) accuracy

**Value Estimation Sources**
- Automated Valuation Models (AVMs)
- Broker Price Opinions (BPOs)
- Full appraisals (when available)
- Tax assessments and trends

#### 3. Legal/Recovery Timeline (15% Weight)
**Foreclosure Environment**
- Judicial vs. non-judicial state (timeline impact)
- Average foreclosure timeline by county
- Court backlog and processing speed
- State-specific borrower protections

**Legal Complexity**
- Title complications and clouds
- Multiple lien positions
- Bankruptcy proceedings status
- Contested foreclosures and litigation risk

**Recovery Timeline Estimation**
- Notice of default to sale completion
- Right of redemption periods
- Eviction timeline for occupied properties
- Marketing time for distressed sales

#### 4. Property & Market Risk (10% Weight)
**Property Characteristics**
- Property type (SFR, condo, multi-family, commercial)
- Property condition from inspection reports
- Age and maintenance requirements
- Unique features affecting marketability

**Market Liquidity**
- Days on market for comparable sales
- Inventory levels in local market
- Price volatility and stability
- Buyer demand indicators

**Geographic Risk Factors**
- Natural disaster exposure (flood, earthquake, hurricane)
- Environmental hazards (contamination, sinkholes)
- Economic base diversity and stability
- Infrastructure and transportation access

#### 5. Borrower Profile (10% Weight)
**Demographics & Stability**
- Employment history and industry
- Income stability and verification level
- Age and life stage considerations
- Household composition and dependents

**Financial Behavior**
- Credit score trends and history
- Other debt obligations and payment patterns
- Asset ownership and financial reserves
- Bank account analysis (when available)

**Cooperation Level**
- Responsiveness to servicer outreach
- Willingness to provide financial documentation
- Participation in workout discussions
- History of broken payment arrangements

#### 6. Loan Characteristics (5% Weight)
**Origination Factors**
- Original loan purpose (purchase vs. refinance vs. cash-out)
- Documentation level (full doc, low doc, NINJA)
- Debt-to-income ratio at origination
- Loan seasoning and performance history

**Loan Structure**
- Interest rate type (fixed vs. ARM)
- Rate level vs. current market rates
- Loan term and amortization schedule
- Prepayment penalties and restrictions

## Score Modifiers & Adjustments

### Critical Override Factors
**Statute of Limitations Expiration (-90 points)**
- Automatic severe penalty for time-barred debt
- State-specific SOL rules application
- Last payment date verification
- Tolling event analysis

**Senior Lien Performance (+10 points)**
- Boost for performing senior liens
- Property maintenance indicator
- Borrower payment capacity signal
- Workout cooperation likelihood

### Dynamic Adjustments
**Market Condition Modifiers (+/- 5 points)**
- Local market heating/cooling cycles
- Interest rate environment changes
- Economic indicators (unemployment, GDP growth)
- Seasonal market variations

**Regulatory Environment (+/- 5 points)**
- CFPB enforcement activity
- State law changes affecting collection
- COVID-related protections and moratoriums
- SCRA (military) protection status

**Workout Success Probability (+/- 10 points)**
- HAMP and proprietary program eligibility
- Hardship type (temporary vs. permanent)
- Payment capacity analysis results
- Previous modification success rates

## Score Ranges & Interpretation

### Individual Loan Scores
**90-100: Premium Performing Loans**
- Current or minimal delinquency
- Strong equity position (LTV < 70%)
- Cooperative borrower with stable income
- Minimal legal/title complications
- High recovery probability

**80-89: Standard Performing Loans**
- Generally current with occasional delays
- Adequate equity position (LTV 70-80%)
- Stable borrower profile
- Standard legal/recovery timeline
- Good recovery probability

**70-79: Watch List / Early Delinquency**
- 30-60 days delinquent with payment history
- Moderate equity position (LTV 80-90%)
- Some borrower stress but cooperative
- Minimal legal complications
- Workout potential exists

**60-69: Moderate NPLs with Recovery Potential**
- 60-90 days delinquent
- Break-even to slight equity (LTV 90-100%)
- Borrower experiencing temporary hardship
- Standard foreclosure timeline
- Recovery possible with workout

**50-59: Challenging NPLs**
- 90+ days delinquent or foreclosure initiated
- Underwater position (LTV 100-110%)
- Borrower non-responsive or financially distressed
- Complex legal/title issues
- Limited recovery potential

**Below 50: Severe Problem Loans**
- Deep delinquency or REO status
- Significant negative equity (LTV > 110%)
- Borrower disappeared or hostile
- Major legal/title complications
- Minimal recovery expected

### Portfolio Health Calculation
**Portfolio NPLVision Score = Weighted Average**
- Weight = Unpaid Principal Balance (UPB) of each loan
- Provides portfolio-level health assessment
- Tracks trends over time
- Enables peer comparison and benchmarking

**Portfolio Distribution Analysis**
- Percentage of loans in each score range
- Average score by vintage, state, loan type
- Risk concentration identification
- Performance trend analysis

## Data Integration Requirements

### Primary Data Sources
**Loan Servicing Data**
- Payment history and current status
- Loan characteristics and terms
- Borrower contact information and responses
- Modification and workout history

**Property Valuation Services**
- Multiple AVM providers for accuracy
- BPO and appraisal management
- Tax assessment data integration
- Market trend analysis feeds

**Credit and Public Records**
- Credit bureau updates (monthly/quarterly)
- Bankruptcy and legal filings
- Property transfers and liens
- Occupancy and inspection data

**Market and Economic Data**
- Local MLS data feeds
- Economic indicators by geography
- Interest rate and market conditions
- Regulatory and legal updates

### Real-Time Update Triggers
**Payment Events**
- Payment received (amount and timing)
- Missed payment deadline
- Partial payment patterns
- NSF/returned payment incidents

**Legal Events**
- Notice of default filing
- Foreclosure sale scheduling
- Bankruptcy filing or discharge
- Title issue discovery

**Market Events**
- Significant property value changes
- Local market condition shifts
- Interest rate movements
- Regulatory changes

## Implementation Strategy

### Phase 1: Foundation (Months 1-3)
**Core Scoring Engine**
- Basic algorithm implementation
- Payment and equity components
- Simple score calculation and display
- Historical backtesting and validation

**Data Infrastructure**
- Primary data source integration
- Automated calculation workflows
- Score storage and versioning
- Basic reporting capabilities

### Phase 2: Enhancement (Months 4-6)
**Advanced Factors**
- Legal and borrower profile components
- Market risk integration
- Score modifier implementation
- Dynamic update triggers

**Analytical Tools**
- Portfolio distribution analysis
- Trend tracking and alerts
- Comparative analytics
- Custom scoring parameters

### Phase 3: Intelligence (Months 7-12)
**Predictive Analytics**
- Machine learning model integration
- Outcome prediction algorithms
- Risk migration forecasting
- Optimal action recommendations

**Advanced Features**
- Custom score weightings by portfolio
- Stress testing capabilities
- Scenario analysis tools
- API access for third-party integration

## Validation and Benchmarking

### Performance Validation
**Historical Backtesting**
- Apply scoring to historical loans
- Compare scores to actual outcomes
- Measure predictive accuracy
- Calibrate weighting factors

**Industry Benchmarking**
- Compare to industry loss rates
- Validate against third-party scores
- Peer portfolio comparison
- Market standard correlation

### Continuous Improvement
**Monthly Model Review**
- Score accuracy assessment
- Factor weight optimization
- New data source evaluation
- Market condition adjustments

**Annual Model Validation**
- Comprehensive model review
- Regulatory compliance check
- Industry best practice comparison
- Strategic enhancement planning

## Business Applications

### Portfolio Management
**Asset Selection**
- Identify undervalued opportunities
- Prioritize workout resources
- Guide acquisition decisions
- Optimize portfolio composition

**Risk Management**
- Monitor portfolio health trends
- Early warning system for deterioration
- Concentration risk identification
- Regulatory capital allocation

### Operational Efficiency
**Workflow Prioritization**
- Focus resources on highest-potential assets
- Automate low-score asset decisions
- Optimize servicing strategies
- Reduce manual review requirements

**Performance Measurement**
- Track portfolio improvement over time
- Measure strategy effectiveness
- Benchmark against industry standards
- Support investor reporting

### Strategic Planning
**Market Positioning**
- Demonstrate analytical sophistication
- Support premium pricing for services
- Enable expansion into new markets
- Attract institutional investors

**Competitive Advantage**
- Proprietary scoring methodology
- Superior risk assessment capabilities
- Data-driven decision making
- Improved investment returns

## Regulatory and Compliance Considerations

### Fair Lending Compliance
**Protected Class Analysis**
- Ensure scoring doesn't discriminate
- Regular disparate impact testing
- Documentation of business justification
- Ongoing monitoring and adjustment

### Model Risk Management
**Governance Framework**
- Model validation requirements
- Change control procedures
- Documentation standards
- Risk management oversight

**Regulatory Reporting**
- Model performance metrics
- Validation results summary
- Risk management effectiveness
- Compliance attestation

## Future Enhancements

### Advanced Analytics
**Machine Learning Integration**
- Neural network score refinement
- Pattern recognition algorithms
- Automated feature selection
- Ensemble modeling approaches

**Predictive Capabilities**
- Default probability modeling
- Recovery amount forecasting
- Optimal timing predictions
- Market cycle adjustments

### Technology Evolution
**Real-Time Processing**
- Streaming data integration
- Instant score updates
- Live portfolio monitoring
- Alert automation

**API Ecosystem**
- Third-party data integration
- Score sharing with partners
- Client system integration
- Mobile application support

## Conclusion

The NPLVision Score represents a quantum leap beyond traditional NPL assessment methods, providing nuanced, data-driven insights that enable superior investment decisions and risk management. By integrating multiple risk factors into a dynamic, validated scoring framework, NPLVision delivers the analytical sophistication institutional investors demand while maintaining the operational efficiency modern portfolio management requires.

The framework's flexibility allows for customization to specific investment strategies while its comprehensive data integration ensures scores remain current and actionable. As the NPL market evolves, the NPLVision Score will continue to adapt, providing lasting competitive advantage through superior analytical capabilities.

---

*Last Updated: July 9, 2025*  
*Next Review: Upon Phase 1 implementation completion*