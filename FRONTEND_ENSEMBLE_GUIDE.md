# NeuraStack AI Ensemble Frontend Developer Guide

## Overview
This guide provides comprehensive instructions for integrating the NeuraStack AI Ensemble API into your React/Vite frontend application. The ensemble system combines responses from multiple AI models (GPT-4o, Gemini, Claude) using sophisticated voting mechanisms and synthesis algorithms.

## API Endpoint
```
POST /default-ensemble
```

### Required Headers
```javascript
{
  'Content-Type': 'application/json',
  'X-User-Id': 'user-identifier',
  'X-Session-Id': 'session-identifier', 
  'X-Correlation-ID': 'correlation-identifier'
}
```

### Request Body
```javascript
{
  "prompt": "Your question or request here",
  "sessionId": "session-identifier"
}
```

## Response Structure Overview

The API returns a comprehensive response with the following main sections:
- **synthesis**: The final combined response from all models
- **roles**: Individual responses from each AI model
- **voting**: Sophisticated voting analysis and winner selection
- **metadata**: Processing metrics, confidence analysis, and diagnostics

## 1. Main Response Display

### Primary Synthesis Content
Display the main synthesized response from `data.synthesis.content`:

```javascript
const synthesizedResponse = response.data.synthesis.content;
```

**Key Fields:**
- `synthesis.content` - The main response text to display
- `synthesis.confidence.score` - Overall confidence (0-1)
- `synthesis.confidence.level` - Confidence level ("low", "medium", "high")
- `synthesis.status` - Processing status ("success", "failed")

## 2. AI Ensemble Info Section

Create an elegant info section with buttons to open detailed modals:

### Suggested UI Layout
```
┌─────────────────────────────────────────┐
│ 🤖 AI Ensemble Info                     │
├─────────────────────────────────────────┤
│ [GPT-4o] [Gemini] [Claude] [📊 Details] │
└─────────────────────────────────────────┘
```

### Button Configuration
- **Individual Model Buttons**: One button per model (GPT-4o, Gemini, Claude)
- **Ensemble Details Button**: Opens comprehensive metrics modal

## 3. Individual Model Modals

Create one modal per AI model showing:

### Modal Content Structure
```javascript
// Access individual model data
const modelData = response.data.roles.find(role => role.role === 'gpt4o'); // or 'gemini', 'claude'
```

### Display Fields:
1. **Model Response**: `modelData.content`
2. **Confidence Score**: `modelData.confidence.score` (0-1)
3. **Processing Time**: `modelData.responseTime` (milliseconds)

### 3 Key Metrics to Display:

#### Metric 1: Response Quality
```javascript
{
  label: "Response Quality",
  value: modelData.quality.complexity, // "low", "medium", "high"
  description: "Assessment of response structure and depth"
}
```

#### Metric 2: Semantic Confidence  
```javascript
{
  label: "Semantic Confidence",
  value: modelData.semanticConfidence.score, // 0-1
  description: "AI model's confidence in semantic accuracy and relevance"
}
```

#### Metric 3: Word Efficiency
```javascript
{
  label: "Word Efficiency", 
  value: `${modelData.wordCount} words in ${modelData.responseTime}ms`,
  description: "Response length and generation speed efficiency"
}
```

## 4. Ensemble Info Modal (Main Analytics)

Display 9-12 key metrics in a 2-column grid layout with help text:

### Grid Layout Suggestion
```
┌─────────────────┬─────────────────┐
│ Overall         │ Model           │
│ Confidence      │ Agreement       │
│ 87%            │ 65%            │
├─────────────────┼─────────────────┤
│ Voting Winner   │ Consensus       │
│ Claude         │ Strong         │
├─────────────────┼─────────────────┤
│ Processing      │ Cost           │
│ Time           │ Estimate       │
│ 45.4s          │ $0.0012        │
└─────────────────┴─────────────────┘
```

### Key Metrics to Display:

#### Row 1: Confidence Metrics
1. **Overall Confidence**
   - Path: `data.metadata.confidenceAnalysis.overallConfidence`
   - Display: Progress bar (0-100%)
   - Help: "Final confidence score combining synthesis quality with voting consensus"

2. **Model Agreement** 
   - Path: `data.metadata.confidenceAnalysis.modelAgreement`
   - Display: Progress bar (0-100%)
   - Help: "Similarity between different AI model responses"

#### Row 2: Voting Results
3. **Voting Winner**
   - Path: `data.voting.winner`
   - Display: Model name with icon
   - Help: "AI model selected as having the best response using sophisticated voting"

4. **Consensus Strength**
   - Path: `data.voting.consensus` 
   - Display: Badge with color coding
   - Help: "Voting agreement strength: strong (>60%), moderate (>45%), weak (<45%)"

#### Row 3: Performance Metrics  
5. **Processing Time**
   - Path: `data.synthesis.processingTime`
   - Display: Time in seconds
   - Help: "Total time to generate and synthesize all responses"

6. **Cost Estimate**
   - Path: `data.metadata.costEstimate.totalCost`
   - Display: Dollar amount
   - Help: "Estimated API costs for this ensemble request"

#### Row 4: Quality Metrics
7. **Response Quality**
   - Path: `data.metadata.responseQuality`
   - Display: Progress bar (0-100%)
   - Help: "Overall quality assessment of the synthesized response"

8. **Successful Models**
   - Path: `data.metadata.successfulRoles` / `data.metadata.totalRoles`
   - Display: Fraction (e.g., "3/3")
   - Help: "Number of AI models that successfully contributed responses"

#### Row 5: Advanced Analytics
9. **Memory Context Used**
   - Path: `data.metadata.memoryContextUsed`
   - Display: Boolean indicator
   - Help: "Whether previous conversation context was used for personalization"

10. **Synthesis Strategy**
    - Path: `data.synthesis.synthesisStrategy`
    - Display: Strategy name
    - Help: "Method used to combine individual model responses"

#### Row 6: Voting Details (Optional)
11. **Voting Confidence**
    - Path: `data.voting.confidence`
    - Display: Progress bar (0-100%)
    - Help: "Confidence in the voting decision from sophisticated analysis"

12. **Winner Margin**
    - Path: `data.metadata.confidenceAnalysis.votingAnalysis.winnerMargin`
    - Display: Percentage difference
    - Help: "How decisively the winning model was selected"

## 5. UI/UX Recommendations

### Design Principles
- **Clean & Modern**: Use card-based layouts with subtle shadows
- **Color Coding**: 
  - Green: High confidence/quality (>70%)
  - Yellow: Medium confidence/quality (40-70%)
  - Red: Low confidence/quality (<40%)
- **Progressive Disclosure**: Show essential info first, details in modals
- **Loading States**: Show skeleton loaders during API calls
- **Error Handling**: Graceful fallbacks for missing data

### Component Structure Suggestion
```
MainResponse
├── SynthesizedContent
├── EnsembleInfoSection
│   ├── ModelButton (GPT-4o)
│   ├── ModelButton (Gemini) 
│   ├── ModelButton (Claude)
│   └── DetailsButton
└── Modals
    ├── ModelModal (x3)
    └── EnsembleDetailsModal
```

### Responsive Considerations
- **Mobile**: Stack metrics vertically, use accordions for details
- **Tablet**: 2-column grid for metrics
- **Desktop**: Full grid layout with hover states

## 6. Error Handling

Handle these potential error states:
- API timeout or failure
- Missing model responses
- Synthesis failures
- Invalid confidence scores

```javascript
// Example error handling
if (response.data.synthesis.status === 'failed') {
  // Show error state with fallback content
}

if (!response.data.roles || response.data.roles.length === 0) {
  // Handle missing model responses
}
```

## 7. Performance Optimization

- **Lazy Load Modals**: Only render when opened
- **Memoize Calculations**: Cache computed metrics
- **Debounce API Calls**: Prevent rapid successive requests
- **Progressive Loading**: Show synthesis first, then load details

This guide provides the foundation for creating an elegant, informative interface that showcases the sophisticated AI ensemble capabilities while maintaining excellent user experience.

## 8. Implementation Examples

### React Component Structure
```jsx
import React, { useState } from 'react';
import { Modal, Button, Progress, Badge, Grid, Card } from '@chakra-ui/react';

const EnsembleResponse = ({ response }) => {
  const [activeModal, setActiveModal] = useState(null);

  return (
    <div className="ensemble-response">
      <SynthesizedContent content={response.data.synthesis.content} />
      <EnsembleInfoSection
        response={response}
        onModalOpen={setActiveModal}
      />
      <EnsembleModals
        response={response}
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
};
```

### Confidence Score Display
```jsx
const ConfidenceIndicator = ({ score, level }) => {
  const getColor = (level) => {
    switch(level) {
      case 'high': return 'green';
      case 'medium': return 'yellow';
      case 'low': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="confidence-indicator">
      <Progress
        value={score * 100}
        colorScheme={getColor(level)}
        size="lg"
      />
      <span>{Math.round(score * 100)}% {level}</span>
    </div>
  );
};
```

### Model Button Component
```jsx
const ModelButton = ({ model, onClick }) => {
  const modelIcons = {
    'gpt4o': '🧠',
    'gemini': '💎',
    'claude': '🎭'
  };

  const modelNames = {
    'gpt4o': 'GPT-4o',
    'gemini': 'Gemini',
    'claude': 'Claude'
  };

  return (
    <Button
      variant="outline"
      leftIcon={<span>{modelIcons[model.role]}</span>}
      onClick={() => onClick(model.role)}
      size="sm"
    >
      {modelNames[model.role]}
    </Button>
  );
};
```

## 9. Advanced Features

### Voting Visualization
Display voting weights as a pie chart or bar chart:
```jsx
const VotingWeights = ({ weights }) => {
  const data = Object.entries(weights).map(([model, weight]) => ({
    name: model,
    value: weight * 100
  }));

  return (
    <div className="voting-weights">
      <h4>Model Voting Weights</h4>
      {/* Implement with your preferred chart library */}
      <BarChart data={data} />
    </div>
  );
};
```

### Processing Timeline
Show the ensemble processing steps:
```jsx
const ProcessingTimeline = ({ steps }) => {
  return (
    <div className="processing-timeline">
      {steps.map((step, index) => (
        <div key={index} className="timeline-step">
          <div className="step-indicator">{index + 1}</div>
          <div className="step-content">
            <h5>{step.description}</h5>
            <span className="step-outcome">{step.outcome}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Real-time Metrics Dashboard
For admin users, display live ensemble performance:
```jsx
const EnsembleDashboard = () => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    // Poll metrics endpoint
    const interval = setInterval(async () => {
      const response = await fetch('/ensemble/stats');
      const data = await response.json();
      setMetrics(data);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Grid templateColumns="repeat(3, 1fr)" gap={6}>
      <MetricCard
        title="Average Confidence"
        value={metrics?.averageConfidence}
        format="percentage"
      />
      <MetricCard
        title="Processing Time"
        value={metrics?.averageProcessingTime}
        format="milliseconds"
      />
      <MetricCard
        title="Success Rate"
        value={metrics?.successRate}
        format="percentage"
      />
    </Grid>
  );
};
```

## 10. Testing Recommendations

### Unit Tests
```javascript
describe('EnsembleResponse', () => {
  it('displays synthesized content correctly', () => {
    const mockResponse = {
      data: {
        synthesis: {
          content: 'Test response',
          confidence: { score: 0.85, level: 'high' }
        }
      }
    };

    render(<EnsembleResponse response={mockResponse} />);
    expect(screen.getByText('Test response')).toBeInTheDocument();
  });

  it('opens model modal when button clicked', () => {
    // Test modal opening functionality
  });
});
```

### Integration Tests
- Test API integration with mock responses
- Verify error handling for failed requests
- Test responsive behavior across devices

## 11. Accessibility Guidelines

- Use semantic HTML elements
- Provide ARIA labels for interactive elements
- Ensure keyboard navigation works
- Maintain color contrast ratios
- Add screen reader descriptions for metrics

## 12. Browser Compatibility

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers

This comprehensive guide enables frontend developers to create a sophisticated, user-friendly interface for the NeuraStack AI Ensemble system.
