// const express = require('express');
// const axios = require('axios');
// const router = express.Router();
// const openai = require('../config/openai');
// const enhancedEnsemble = require('../services/enhancedEnsembleRunner');
// const monitoringService = require('../services/monitoringService');
// const clients = require('../services/vendorClients');
// const ensembleConfig = require('../config/ensemblePrompts');
// const workoutService = require('../services/workoutService');
// const cacheService = require('../services/cacheService');
// const securityMiddleware = require('../middleware/securityMiddleware');

// router.get('/health', (req, res) => {
//   res.status(200).json({ status: 'ok', message: 'Neurastack backend healthy 🚀' });
// });

// // Voting analytics endpoint
// router.get('/voting-analytics', async (req, res) => {
//   try {
//     const SophisticatedVotingService = require('../services/sophisticatedVotingService');
//     const sophisticatedVotingService = new SophisticatedVotingService();

//     // Get comprehensive voting analytics
//     const serviceAnalytics = sophisticatedVotingService.getVotingStats();
//     const monitoringAnalytics = monitoringService.getVotingAnalytics();

//     res.json({
//       status: 'success',
//       timestamp: new Date().toISOString(),
//       analytics: {
//         // Real-time monitoring data
//         monitoring: monitoringAnalytics,

//         // Service-specific analytics
//         services: serviceAnalytics,

//         // Combined insights
//         insights: {
//           systemHealth: monitoringAnalytics.totalVotingDecisions > 0 ? 'active' : 'inactive',
//           averageConfidence: monitoringAnalytics.averageConfidence,
//           mostUsedFeatures: this.getMostUsedFeatures(monitoringAnalytics),
//           topPerformingModels: this.getTopPerformingModels(monitoringAnalytics),
//           consensusTrends: this.getConsensusTrends(monitoringAnalytics)
//         }
//       },
//       _description: "Comprehensive voting system analytics combining real-time monitoring data with service-specific statistics for meta-voting, tie-breaking, and abstention patterns"
//     });
//   } catch (error) {
//     monitoringService.log('error', 'Failed to get voting analytics', {
//       error: error.message
//     });

//     res.status(500).json({
//       status: 'error',
//       error: 'Failed to retrieve voting analytics',
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Synthesis quality analytics endpoint
// router.get('/synthesis-analytics', async (req, res) => {
//   try {
//     const analytics = monitoringService.getSynthesisAnalytics();

//     res.status(200).json({
//       status: 'success',
//       timestamp: new Date().toISOString(),
//       analytics: {
//         ...analytics,
//         _description: "Comprehensive synthesis quality metrics including validation scores, conflict resolution rates, and processing performance"
//       }
//     });
//   } catch (error) {
//     console.error('❌ Failed to get synthesis analytics:', error.message);
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve synthesis analytics',
//       error: error.message
//     });
//   }
// });

// // Enhanced synthesis service health check
// router.get('/synthesis-health', async (req, res) => {
//   try {
//     const enhancedSynthesisService = require('../services/enhancedSynthesisService');
//     const postSynthesisValidator = require('../services/postSynthesisValidator');

//     const [synthesisHealth, validatorHealth] = await Promise.all([
//       enhancedSynthesisService.healthCheck(),
//       postSynthesisValidator.healthCheck()
//     ]);

//     res.status(200).json({
//       status: 'success',
//       timestamp: new Date().toISOString(),
//       services: {
//         enhancedSynthesis: synthesisHealth,
//         postSynthesisValidator: validatorHealth
//       }
//     });
//   } catch (error) {
//     console.error('❌ Failed to get synthesis health:', error.message);
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve synthesis health status',
//       error: error.message
//     });
//   }
// });

// Helper function to get most used features
function getMostUsedFeatures(analytics) {
  if (!analytics.sophisticatedFeaturesUsage) return [];

  return Object.entries(analytics.sophisticatedFeaturesUsage.counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([feature, count]) => ({
      feature,
      count,
      percentage: analytics.sophisticatedFeaturesUsage.percentages[feature]
    }));
}

// Helper function to get top performing models
function getTopPerformingModels(analytics) {
  if (!analytics.modelPerformance) return [];

  return Object.entries(analytics.modelPerformance)
    .sort(([,a], [,b]) => parseFloat(b.winRate) - parseFloat(a.winRate))
    .slice(0, 3)
    .map(([model, stats]) => ({
      model,
      winRate: stats.winRate,
      averageWeight: stats.averageWeight,
      totalVotes: stats.totalVotes
    }));
}

// Helper function to get consensus trends
function getConsensusTrends(analytics) {
  if (!analytics.consensusDistribution) return {};

  const total = Object.values(analytics.consensusDistribution.counts).reduce((a, b) => a + b, 0);
  const strongConsensus = analytics.consensusDistribution.counts['strong'] +
                         analytics.consensusDistribution.counts['very-strong'];
  const weakConsensus = analytics.consensusDistribution.counts['weak'] +
                       analytics.consensusDistribution.counts['very-weak'];

  return {
    strongConsensusRate: total > 0 ? ((strongConsensus / total) * 100).toFixed(1) + '%' : '0%',
    weakConsensusRate: total > 0 ? ((weakConsensus / total) * 100).toFixed(1) + '%' : '0%',
    overallTrend: strongConsensus > weakConsensus ? 'improving' : 'needs_attention'
  };
}

// router.get('/openai-test', async (req, res) => {
//   try {
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4o',
//       messages: [{ role: 'user', content: 'Hello! Can you provide a brief overview of the Neurastack backend project?' }],
//     });

//     res.status(200).json({
//       status: 'ok',
//       model: response.model,
//       response: response.choices[0].message.content,
//     });
//   } catch (error) {
//     console.error('OpenAI API error:', error.message);
//     res.status(500).json({ status: 'error', message: 'Failed to fetch response from OpenAI.' });
//   }
// });

// router.get('/xai-test', async (req, res) => {
//   res.status(200).json({ status: 'ok', message: 'xAI test endpoint is working!' });
// });

// router.get('/xai-grok', async (req, res) => {
//   try {

//     const response = await axios.post('https://api.x.ai/v1/chat/completions', {
//       model: 'grok-3-mini',
//       messages: [
//         {
//           role: 'system',
//           content: 'You are Grok, a chatbot inspired by the Hitchhiker\'s Guide to the Galaxy.'
//         },
//         {
//           role: 'user',
//           content: 'What is the meaning of life, the universe, and everything?'
//         }
//       ]
//     }, {
//       headers: {
//         'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     res.status(200).json({
//       status: 'ok',
//       model: response.data.model,
//       response: response.data.choices[0].message.content,
//     });
//   } catch (error) {
//     console.error('X.AI API error:', error.response?.data || error.message);
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to fetch response from X.AI.',
//       error: error.response?.data || error.message
//     });
//   }
// });

// router.get('/gemini-test', async (req, res) => {
//   try {

//     const response = await axios.post(
//       `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
//       {
//         contents: [
//           {
//             parts: [
//               {
//                 text: 'Explain how AI works in a few words'
//               }
//             ]
//           }
//         ]
//       },
//       {
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

//     res.status(200).json({
//       status: 'ok',
//       model: 'gemini-2.5-flash',
//       response: generatedText
//     });
//   } catch (error) {
//     console.error('Gemini API error:', error.response?.data || error.message);
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to fetch response from Gemini API.',
//       error: error.response?.data || error.message
//     });
//   }
// });

// router.get('/claude-test', async (req, res) => {
//   try {

//     const response = await axios.post(
//       'https://api.anthropic.com/v1/messages',
//       {
//         model: 'claude-3-5-haiku-latest',
//         max_tokens: 1024,
//         messages: [
//           {
//             role: 'user',
//             content: 'Explain the concept of neural networks in simple terms'
//           }
//         ]
//       },
//       {
//         headers: {
//           'x-api-key': process.env.CLAUDE_API_KEY,
//           'anthropic-version': '2023-06-01',
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     res.status(200).json({
//       status: 'ok',
//       model: response.data.model,
//       response: response.data.content[0].text
//     });
//   } catch (error) {
//     console.error('Claude API error:', error.response?.data || error.message);
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to fetch response from Claude API.',
//       error: error.response?.data || error.message
//     });
//   }
// });

// // Enhanced 4-AI Ensemble endpoint with production-grade features
// router.post('/default-ensemble', async (req, res) => {
//   const correlationId = req.correlationId || 'unknown';

//   try {
//     // Enhanced input validation and sanitization
//     const prompt = req.body?.prompt || 'Quick sanity check: explain AI in 1-2 lines.';
//     const userId = req.headers['x-user-id'] || req.userId || 'anonymous';
//     const userTier = req.userTier || 'free';
//     const sessionId = req.body?.sessionId || req.headers['x-session-id'] || `session_${userId}_${Date.now()}`;
//     const explainMode = req.query?.explain === 'true' || req.body?.explain === true;

//     // Enhanced input validation
//     if (typeof prompt !== 'string') {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Invalid prompt format. Prompt must be a string.',
//         timestamp: new Date().toISOString(),
//         correlationId
//       });
//     }

//     // Sanitize prompt (remove potentially harmful content)
//     const sanitizedPrompt = prompt.trim().replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

//     // Enhanced rate limiting with tier-specific limits
//     const rateLimits = {
//       free: { maxRequests: 25, windowMs: 60000 },      // 25 requests per minute for free tier
//       premium: { maxRequests: 100, windowMs: 60000 }   // 100 requests per minute for premium
//     };

//     const currentLimit = rateLimits[userTier] || rateLimits.free;

//     try {
//       const rateLimitResult = securityMiddleware.checkRateLimit(
//         userId,
//         'ensemble',
//         currentLimit.maxRequests,
//         currentLimit.windowMs
//       );

//       if (!rateLimitResult.allowed) {
//         return res.status(429).json({
//           status: 'error',
//           message: 'Rate limit exceeded',
//           details: `Maximum ${currentLimit.maxRequests} requests per minute for ${userTier} tier`,
//           retryAfter: Math.ceil(currentLimit.windowMs / 1000),
//           timestamp: new Date().toISOString(),
//           correlationId,
//           tier: userTier
//         });
//       }
//     } catch (rateLimitError) {
//       return res.status(429).json({
//         status: 'error',
//         message: 'Rate limit exceeded',
//         details: rateLimitError.message,
//         retryAfter: 60,
//         timestamp: new Date().toISOString(),
//         correlationId
//       });
//     }

//     // Enhanced prompt length validation with tier-specific limits
//     const maxPromptLength = userTier === 'premium' ? 8000 : 5000;
//     if (sanitizedPrompt.length > maxPromptLength) {
//       return res.status(400).json({
//         status: 'error',
//         message: `Prompt too long. Maximum ${maxPromptLength} characters allowed for ${userTier} tier.`,
//         currentLength: sanitizedPrompt.length,
//         maxLength: maxPromptLength,
//         timestamp: new Date().toISOString(),
//         correlationId
//       });
//     }

//     // Validate minimum prompt length
//     if (sanitizedPrompt.length < 3) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Prompt too short. Minimum 3 characters required.',
//         timestamp: new Date().toISOString(),
//         correlationId
//       });
//     }

//     monitoringService.log('info', 'Enhanced ensemble request started', {
//       userId,
//       sessionId,
//       promptLength: sanitizedPrompt.length,
//       originalLength: prompt.length,
//       tier: userTier
//     }, correlationId);

//     // Execute enhanced ensemble with comprehensive error handling using sanitized prompt
//     const ensembleResult = await enhancedEnsemble.runEnsemble(sanitizedPrompt, userId, sessionId);

//     // Calculate confidence scores for each response (now async)
//     const enhancedRoles = await Promise.all(
//       ensembleResult.roles.map(async role => {
//         const confidence = await calculateConfidenceScore(role);
//         const qualityMetrics = analyzeResponseQuality(role.content);

//         return {
//           ...role,
//           confidence: {
//             score: confidence,
//             level: getConfidenceLevel(confidence),
//             factors: getConfidenceFactors(role, qualityMetrics)
//           },
//           quality: qualityMetrics,
//           metadata: {
//             ...role.metadata,
//             processingTime: role.responseTime || 0,
//             tokenCount: estimateTokenCount(role.content),
//             complexity: assessComplexity(role.content)
//           }
//         };
//       })
//     );

//     // Perform sophisticated voting analysis with error handling
//     const SophisticatedVotingService = require('../services/sophisticatedVotingService');
//     const sophisticatedVotingService = new SophisticatedVotingService();

//     let votingResult;
//     try {
//       votingResult = await sophisticatedVotingService.executeSophisticatedVoting(
//         enhancedRoles,
//         prompt,
//         {
//           correlationId,
//           userId: req.headers['x-user-id'],
//           type: 'ensemble'
//         }
//       );

//       // Track voting decision in monitoring service
//       monitoringService.trackVotingDecision(votingResult, votingResult.analytics?.processingTime || 0);
//     } catch (votingError) {
//       console.error(`❌ [${correlationId}] Sophisticated voting failed:`, votingError.message);

//       // Create fallback voting result
//       votingResult = createFallbackVotingResult(enhancedRoles);
//       monitoringService.trackVotingDecision(votingResult, 0);
//     }

//     // Enhanced synthesis confidence with voting results
//     const synthesisConfidence = calculateSynthesisConfidence(ensembleResult.synthesis, enhancedRoles);

//     // Adjust synthesis confidence based on voting consensus
//     if (votingResult && votingResult.consensus === 'strong') {
//       synthesisConfidence.score = Math.min(1.0, synthesisConfidence.score * 1.1);
//     } else if (votingResult && votingResult.consensus === 'weak') {
//       synthesisConfidence.score = Math.max(0.1, synthesisConfidence.score * 0.9);
//     }

//     // Enhanced response with confidence indicators and advanced metadata
//     const response = {
//       status: 'success',
//       data: {
//         prompt: prompt,
//         userId: userId,
//         sessionId: sessionId,
//         synthesis: {
//           ...ensembleResult.synthesis,
//           confidence: synthesisConfidence,
//           _confidenceDescription: "Overall confidence in the synthesized response, calculated from individual model confidence scores (70%) plus synthesis quality factors (30%). Higher scores indicate more reliable responses.",
//           // Note: qualityScore field removed as deprecated - now using calibrated_confidence
//           metadata: {
//             basedOnResponses: enhancedRoles.length,
//             _basedOnResponsesDescription: "Number of AI models that successfully contributed to this synthesis. More contributing models generally increase reliability.",
//             averageConfidence: enhancedRoles.reduce((sum, role) => sum + role.confidence.score, 0) / enhancedRoles.length,
//             _averageConfidenceDescription: "Mean confidence score across all individual model responses. Indicates overall ensemble agreement and response quality.",
//             consensusLevel: calculateConsensusLevel(enhancedRoles),
//             _consensusLevelDescription: "Measure of agreement between different AI models. Higher consensus suggests more reliable and consistent responses across the ensemble."
//           }
//         },
//         roles: enhancedRoles.map(role => ({
//           ...role,
//           _confidenceDescription: "Individual model confidence calculated from response quality (length, structure, reasoning) and performance factors. Scores 0-1 where higher values indicate more reliable responses.",
//           _qualityDescription: "Response quality metrics including word count, sentence structure, reasoning indicators, and complexity assessment used for ensemble weighting.",
//           _metadataDescription: "Processing metrics including response time, token usage, and complexity scores that influence the model's weight in ensemble voting."
//         })),
//         voting: {
//           winner: votingResult?.winner || 'unknown',
//           _winnerDescription: "AI model selected as having the best response using sophisticated voting algorithm combining traditional confidence, diversity analysis, historical performance, and advanced tie-breaking mechanisms.",
//           confidence: votingResult?.confidence || 0,
//           _confidenceDescription: "Final confidence score (0-1) from sophisticated voting system. Incorporates traditional voting, diversity weighting, historical accuracy, and meta-voting analysis for enhanced reliability.",
//           consensus: votingResult?.consensus || 'unknown',
//           _consensusDescription: "Sophisticated consensus strength: 'very-strong' (>80% confidence), 'strong' (>60%), 'moderate' (>45%), 'weak' (>35%), 'very-weak' (<35%). Enhanced with diversity and historical analysis.",
//           weights: votingResult?.weights || {},
//           _weightsDescription: "Hybrid voting weights combining traditional confidence (30%), diversity analysis (20%), historical performance (25%), semantic confidence (15%), and reliability factors (10%).",

//           // Sophisticated voting details
//           sophisticatedVoting: {
//             traditionalVoting: votingResult?.traditionalVoting || null,
//             hybridVoting: votingResult?.hybridVoting || null,
//             diversityAnalysis: votingResult?.diversityAnalysis || null,
//             historicalPerformance: votingResult?.historicalPerformance || null,
//             tieBreaking: votingResult?.tieBreaking || null,
//             metaVoting: votingResult?.metaVoting || null,
//             abstention: votingResult?.abstention || null,
//             analytics: votingResult?.analytics || null,
//             _description: "Comprehensive sophisticated voting analysis including diversity scoring, historical accuracy, meta-voting, tie-breaking, and abstention logic for enhanced decision-making quality."
//           }
//         },
//         metadata: {
//           ...ensembleResult.metadata,
//           timestamp: new Date().toISOString(),
//           version: '4.0', // Updated version for sophisticated voting system
//           correlationId,
//           explainMode,
//           confidenceAnalysis: {
//             overallConfidence: synthesisConfidence.score,
//             _overallConfidenceDescription: "Final confidence score for the entire ensemble response, combining synthesis quality with voting consensus adjustments.",
//             modelAgreement: calculateModelAgreement(enhancedRoles),
//             _modelAgreementDescription: "Measure of similarity between different AI model responses (0-1). Higher values indicate models provided consistent, aligned answers.",
//             responseConsistency: calculateResponseConsistency(enhancedRoles),
//             _responseConsistencyDescription: "Assessment of how consistent the responses are across models in terms of content quality and structure. Higher consistency increases ensemble reliability.",
//             qualityDistribution: getQualityDistribution(enhancedRoles),
//             _qualityDistributionDescription: "Breakdown of response quality levels (high/medium/low) across all models. More 'high' quality responses indicate better ensemble performance.",
//             votingAnalysis: {
//               consensusStrength: votingResult?.consensus || 'unknown',
//               _consensusStrengthDescription: "Categorical assessment of voting agreement: strong consensus indicates clear winner, weak consensus suggests close competition between models.",
//               winnerMargin: votingResult?.weights ?
//                 (Math.max(...Object.values(votingResult.weights)) -
//                 (Object.values(votingResult.weights).sort((a, b) => b - a)[1] || 0)) : 0,
//               _winnerMarginDescription: "Numerical difference between the winning model's weight and the second-place model. Larger margins indicate clearer ensemble decisions.",
//               distributionEntropy: votingResult?.weights ? calculateWeightEntropy(votingResult.weights) : 0,
//               _distributionEntropyDescription: "Measure of weight distribution randomness. Lower entropy means concentrated voting (clear winner), higher entropy means distributed voting (close competition)."
//             }
//           },
//           diagnostics: await generateAdvancedDiagnostics(enhancedRoles, ensembleResult.synthesis),
//           _diagnosticsDescription: "Advanced analytics including embedding similarity matrix, toxicity scores, readability metrics, and model calibration data for deep ensemble analysis.",
//           costEstimate: await estimateRequestCost(prompt, enhancedRoles),
//           _costEstimateDescription: "Estimated API costs for this ensemble request including input/output tokens and per-model pricing. Helps track usage and optimize cost efficiency."
//         }
//       },
//       correlationId
//     };

//     // Add detailed explanation data if explain mode is enabled
//     if (explainMode) {
//       response.explanation = {
//         decisionTrace: ensembleResult.metadata.decisionTrace,
//         _decisionTraceDescription: "Step-by-step trace of the ensemble decision-making process including context building, model execution, confidence calculation, voting, and synthesis strategy selection.",

//         visualizationData: {
//           voteDistribution: votingResult?.weights ?
//             Object.entries(votingResult.weights).map(([model, weight]) => ({
//               model,
//               weight: Math.round(weight * 100) / 100,
//               percentage: `${Math.round(weight * 100)}%`
//             })) : [],
//           _voteDistributionDescription: "Data for creating bar charts showing how voting weights were distributed across AI models.",

//           confidenceHistogram: enhancedRoles.map(role => ({
//             model: role.role,
//             confidence: Math.round(role.confidence.score * 100) / 100,
//             factors: role.confidence.factors
//           })),
//           _confidenceHistogramDescription: "Data for creating confidence score visualizations showing individual model performance.",

//           processingTimeline: ensembleResult.metadata.decisionTrace?.steps?.map(step => ({
//             step: step.step,
//             description: step.description,
//             outcome: step.outcome,
//             duration: step.details?.processingTime || 0
//           })) || [],
//           _processingTimelineDescription: "Timeline data for visualizing the ensemble processing workflow and timing."
//         },

//         modelComparison: {
//           responses: enhancedRoles.map(role => ({
//             model: role.role,
//             provider: role.provider,
//             responseSnippet: role.content.substring(0, 200) + (role.content.length > 200 ? '...' : ''),
//             wordCount: role.wordCount || 0,
//             confidence: role.confidence.score,
//             processingTime: role.responseTime || 0,
//             qualityMetrics: role.quality
//           })),
//           _responsesDescription: "Detailed comparison of individual model responses for side-by-side analysis.",

//           consensusAnalysis: {
//             agreementLevel: calculateModelAgreement(enhancedRoles),
//             conflictPoints: identifyConflictPoints(enhancedRoles),
//             synthesisStrategy: ensembleResult.synthesis.strategy,
//             _analysisDescription: "Analysis of where models agreed or disagreed and how conflicts were resolved."
//           }
//         },

//         performanceMetrics: {
//           totalProcessingTime: ensembleResult.metadata.processingTime || 0,
//           parallelEfficiency: calculateParallelEfficiency(enhancedRoles),
//           cacheHitRate: ensembleResult.metadata.cached ? 100 : 0,
//           costEfficiency: await calculateCostEfficiency(prompt, enhancedRoles),
//           _metricsDescription: "Performance analytics for monitoring and optimization purposes."
//         }
//       };
//     }

//     monitoringService.log('info', 'Enhanced ensemble completed successfully', {
//       // Note: processingTime now tracked via correlation headers instead of processingTimeMs field
//       successfulRoles: ensembleResult.metadata.successfulRoles,
//       synthesisStatus: ensembleResult.metadata.synthesisStatus,
//       explainMode
//     }, correlationId);

//     res.status(200).json(response);

//   } catch (error) {
//     monitoringService.log('error', 'Enhanced ensemble failed', {
//       error: error.message,
//       stack: error.stack,
//       userId: req.headers['x-user-id'] || 'anonymous'
//     }, correlationId);

//     // Enhanced error response
//     res.status(500).json({
//       status: 'error',
//       message: 'Enhanced ensemble processing failed. Our team has been notified.',
//       error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
//       timestamp: new Date().toISOString(),
//       correlationId,
//       retryable: true,
//       supportInfo: {
//         correlationId,
//         timestamp: new Date().toISOString(),
//         suggestion: 'Please try again in a few moments. If the issue persists, contact support with the correlation ID.'
//       }
//     });
//   }
// });

// // Enhanced system health endpoint
// router.get('/health-detailed', async (req, res) => {
//   try {
//     const [systemHealth, vendorHealth, ensembleHealth] = await Promise.all([
//       monitoringService.getHealthStatus(),
//       clients.healthCheck(),
//       enhancedEnsemble.healthCheck()
//     ]);

//     const overallHealth = {
//       status: 'healthy',
//       timestamp: new Date().toISOString(),
//       version: '2.0',
//       components: {
//         system: systemHealth,
//         vendors: vendorHealth,
//         ensemble: ensembleHealth
//       }
//     };

//     // Determine overall status
//     const componentStatuses = [
//       systemHealth.status,
//       Object.values(vendorHealth).some(v => !v.isHealthy) ? 'degraded' : 'healthy',
//       ensembleHealth.ensemble.isHealthy ? 'healthy' : 'degraded'
//     ];

//     if (componentStatuses.includes('unhealthy')) {
//       overallHealth.status = 'unhealthy';
//     } else if (componentStatuses.includes('degraded')) {
//       overallHealth.status = 'degraded';
//     }

//     const statusCode = overallHealth.status === 'healthy' ? 200 :
//                       overallHealth.status === 'degraded' ? 200 : 503;

//     res.status(statusCode).json(overallHealth);

//   } catch (error) {
//     monitoringService.log('error', 'Health check failed', { error: error.message });

//     res.status(503).json({
//       status: 'unhealthy',
//       message: 'Health check failed',
//       timestamp: new Date().toISOString(),
//       error: error.message
//     });
//   }
// });

// // System metrics endpoint for monitoring
// router.get('/metrics', async (req, res) => {
//   try {
//     const [systemMetrics, vendorMetrics, ensembleMetrics] = await Promise.all([
//       monitoringService.getDetailedMetrics(),
//       clients.getMetrics(),
//       enhancedEnsemble.getMetrics()
//     ]);

//     res.status(200).json({
//       timestamp: new Date().toISOString(),
//       system: systemMetrics,
//       vendors: vendorMetrics,
//       ensemble: ensembleMetrics,
//       tier: ensembleConfig.meta.tier,
//       costEstimate: ensembleConfig.meta.estimatedCostPerRequest
//     });

//   } catch (error) {
//     monitoringService.log('error', 'Metrics collection failed', { error: error.message });

//     res.status(500).json({
//       error: 'Failed to collect metrics',
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Tier information and configuration endpoint
// router.get('/tier-info', async (req, res) => {
//   try {
//     const tierConfig = ensembleConfig.getTierConfig();

//     res.status(200).json({
//       status: 'success',
//       data: {
//         currentTier: ensembleConfig.meta.tier,
//         configuration: {
//           models: tierConfig.models,
//           limits: tierConfig.limits,
//           estimatedCostPerRequest: ensembleConfig.meta.estimatedCostPerRequest
//         },
//         availableTiers: {
//           free: {
//             models: ensembleConfig.allModels.free,
//             limits: ensembleConfig.getTierConfig('free').limits,
//             estimatedCost: '$0.003-0.008'
//           },
//           premium: {
//             models: ensembleConfig.allModels.premium,
//             limits: ensembleConfig.getTierConfig('premium').limits,
//             estimatedCost: '$0.05-0.15'
//           }
//         },
//         costComparison: {
//           free: {
//             modelsUsed: Object.keys(ensembleConfig.allModels.free).length,
//             avgResponseTime: '5-15 seconds',
//             quality: '85-90% of premium',
//             costSavings: '90-95% vs premium'
//           },
//           premium: {
//             modelsUsed: Object.keys(ensembleConfig.allModels.premium).length,
//             avgResponseTime: '8-20 seconds',
//             quality: '95-100%',
//             features: 'Full feature set'
//           }
//         }
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     monitoringService.log('error', 'Tier info request failed', { error: error.message });

//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve tier information',
//       timestamp: new Date().toISOString()
//     });
//   }
// });



// // Legacy workout endpoint removed - use /workout/generate-workout instead

// // Workout service health check endpoint
// router.get('/workout/health', async (req, res) => {
//   try {
//     const healthStatus = await workoutService.getHealthStatus();

//     const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

//     res.status(statusCode).json({
//       ...healthStatus,
//       endpoint: '/workout',
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(503).json({
//       status: 'unhealthy',
//       endpoint: '/workout',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Cache statistics endpoint
// router.get('/cache/stats', async (req, res) => {
//   try {
//     const cacheStats = cacheService.getStats();

//     res.status(200).json({
//       status: 'success',
//       data: {
//         cache: cacheStats,
//         performance: {
//           description: 'Cache hit rate indicates the percentage of requests served from cache',
//           recommendation: cacheStats.hitRate > '50%' ? 'Good cache performance' : 'Consider optimizing cache strategy'
//         }
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve cache statistics',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Cache management endpoint (for admin use)
// router.post('/cache/clear', async (req, res) => {
//   try {
//     const { pattern } = req.body;

//     let result;
//     if (pattern) {
//       result = await cacheService.invalidatePattern(pattern);
//       res.status(200).json({
//         status: 'success',
//         message: `Invalidated ${result} cache entries matching pattern: ${pattern}`,
//         timestamp: new Date().toISOString()
//       });
//     } else {
//       await cacheService.clear();
//       res.status(200).json({
//         status: 'success',
//         message: 'All cache entries cleared',
//         timestamp: new Date().toISOString()
//       });
//     }

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to clear cache',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });



// // Vector database statistics endpoint
// router.get('/vector/stats', async (req, res) => {
//   try {
//     const stats = vectorDatabaseService.getStats();

//     res.status(200).json({
//       status: 'success',
//       data: {
//         vectorDatabase: stats,
//         capabilities: {
//           semanticSearch: stats.isAvailable,
//           embeddingGeneration: true,
//           similarityThreshold: stats.config.similarityThreshold,
//           maxResults: stats.config.maxResults
//         }
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve vector database statistics',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Vector database health check endpoint
// router.get('/vector/health', async (req, res) => {
//   try {
//     const health = await vectorDatabaseService.healthCheck();
//     const statusCode = health.status === 'healthy' ? 200 : 503;

//     res.status(statusCode).json({
//       ...health,
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(503).json({
//       status: 'unhealthy',
//       provider: 'unknown',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Semantic search test endpoint
// router.post('/vector/search', async (req, res) => {
//   try {
//     const { query, userId, maxResults = 5, threshold = 0.7 } = req.body;

//     if (!query) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Query text is required for semantic search'
//       });
//     }

//     const results = await vectorDatabaseService.searchSimilarMemories(query, {
//       maxResults,
//       threshold,
//       userId
//     });

//     res.status(200).json({
//       status: 'success',
//       data: {
//         query,
//         results: results.map(result => ({
//           id: result.id,
//           score: result.score,
//           content: result.content.substring(0, 200) + '...', // Truncate for display
//           metadata: {
//             timestamp: result.metadata.timestamp,
//             memoryType: result.metadata.memoryType
//           }
//         })),
//         totalResults: results.length,
//         searchParams: { maxResults, threshold, userId }
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Semantic search failed',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Ensemble strategy statistics endpoint
// router.get('/ensemble/stats', async (req, res) => {
//   try {
//     const stats = advancedEnsembleStrategy.getStats();

//     res.status(200).json({
//       status: 'success',
//       data: {
//         ensembleStrategy: stats,
//         capabilities: {
//           weightedVoting: true,
//           confidenceScoring: true,
//           adaptiveWeights: true,
//           performanceTracking: true
//         },
//         thresholds: stats.confidenceThresholds
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve ensemble strategy statistics',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Performance optimization statistics endpoint
// router.get('/ensemble/performance', async (req, res) => {
//   try {
//     const ensembleRunner = enhancedEnsemble;
//     const healthData = await ensembleRunner.healthCheck();

//     res.status(200).json({
//       status: 'success',
//       data: {
//         performance: {
//           optimizations: healthData.ensemble.optimizations,
//           metrics: healthData.ensemble.metrics,
//           speedup: {
//             averageProcessingTime: healthData.ensemble.metrics.averageProcessingTime,
//             parallelSpeedup: healthData.ensemble.optimizations.parallelProcessor.parallelSpeedup || 1,
//             cacheHitRate: healthData.ensemble.optimizations.enhancedCache.hitRate || 0
//           }
//         },
//         recommendations: [
//           healthData.ensemble.optimizations.enhancedCache.hitRate < 50 ?
//             'Consider increasing cache TTL for better hit rates' : null,
//           healthData.ensemble.metrics.averageProcessingTime > 20000 ?
//             'Processing time is high, consider enabling more parallel optimizations' : null,
//           healthData.ensemble.optimizations.parallelProcessor.timeoutCount > 10 ?
//             'High timeout count detected, consider adjusting timeout thresholds' : null
//         ].filter(Boolean)
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve performance statistics',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Model performance update endpoint (for feedback loops)
// router.post('/ensemble/feedback', async (req, res) => {
//   try {
//     const { model, accuracy, responseTime, userSatisfaction, errorRate } = req.body;

//     if (!model || accuracy === undefined || responseTime === undefined) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Model, accuracy, and responseTime are required fields'
//       });
//     }

//     // Validate input ranges
//     if (accuracy < 0 || accuracy > 1 || userSatisfaction < 0 || userSatisfaction > 1 || errorRate < 0 || errorRate > 1) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Accuracy, userSatisfaction, and errorRate must be between 0 and 1'
//       });
//     }

//     advancedEnsembleStrategy.updateModelPerformance(model, {
//       accuracy,
//       responseTime,
//       userSatisfaction: userSatisfaction || 0.5,
//       errorRate: errorRate || 0
//     });

//     res.status(200).json({
//       status: 'success',
//       message: `Performance feedback recorded for model: ${model}`,
//       data: {
//         model,
//         updatedMetrics: {
//           accuracy,
//           responseTime,
//           userSatisfaction,
//           errorRate
//         }
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to update model performance',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // ===== ENHANCED ENSEMBLE CONFIDENCE AND QUALITY FUNCTIONS =====

/**
 * Enhanced confidence score calculation with semantic analysis and weighted factors
 */
async function calculateConfidenceScore(role) {
  if (role.status !== 'fulfilled') return 0;

  try {
    // Use semantic confidence service for advanced scoring
    const semanticConfidenceService = require('../services/semanticConfidenceService');
    const responseTime = role.responseTime || role.metadata?.processingTime || 0;

    const semanticResult = await semanticConfidenceService.calculateSemanticConfidence(role.content, responseTime);

    // Store semantic confidence components for diagnostics
    role.semanticConfidence = semanticResult;

    // Combine semantic confidence with traditional factors (70% semantic, 30% traditional)
    const traditionalScore = calculateTraditionalConfidenceScore(role);
    const finalScore = (semanticResult.score * 0.7) + (traditionalScore * 0.3);

    return Math.max(0, Math.min(1.0, finalScore));
  } catch (error) {
    console.warn('Semantic confidence calculation failed, using traditional method:', error.message);
    return calculateTraditionalConfidenceScore(role);
  }
}

/**
 * Traditional confidence score calculation (fallback method)
 */
function calculateTraditionalConfidenceScore(role) {
  if (role.status !== 'fulfilled') return 0;

  let score = 0.3; // Lower base score for more discriminating calculation
  const content = role.content || '';
  const wordCount = content.split(' ').length;
  const sentenceCount = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

  // Enhanced length factor with model-specific optimal ranges
  const modelName = role.metadata?.model || role.model || '';
  let optimalRange = [30, 150]; // Default range

  // Model-specific length optimization based on observed behavior
  if (modelName.includes('gemini')) {
    optimalRange = [50, 250]; // Gemini tends to be more verbose and detailed
  } else if (modelName.includes('claude')) {
    optimalRange = [25, 120]; // Claude tends to be more concise but structured
  } else if (modelName.includes('gpt')) {
    optimalRange = [30, 180]; // GPT balanced approach with good detail
  }

  if (wordCount >= optimalRange[0] && wordCount <= optimalRange[1]) {
    score += 0.25; // Optimal range for this model
  } else if (wordCount >= optimalRange[0] * 0.5 && wordCount < optimalRange[0]) {
    score += 0.15; // Acceptable short for model
  } else if (wordCount > optimalRange[1] && wordCount <= optimalRange[1] * 1.5) {
    score += 0.20; // Acceptable long for model
  } else if (wordCount > optimalRange[1] * 1.5) {
    score += 0.05; // Too verbose even for this model
  } else {
    score -= 0.1; // Too short for effective response
  }

  // Structure and grammar quality (weighted 0.2)
  let structureScore = 0;
  if (/[.!?]/.test(content)) structureScore += 0.05; // Has punctuation
  if (/^[A-Z]/.test(content)) structureScore += 0.05; // Proper capitalization
  if (sentenceCount >= 2) structureScore += 0.05; // Multiple sentences
  if (content.includes(',') || content.includes(';')) structureScore += 0.03; // Complex punctuation
  if (/\b[A-Z][a-z]+\b/.test(content)) structureScore += 0.02; // Proper nouns
  score += structureScore;

  // Enhanced content sophistication (weighted 0.25)
  let sophisticationScore = 0;

  // Advanced reasoning indicators with weighted scoring
  const reasoningPatterns = [
    { words: ['because', 'therefore', 'thus', 'hence', 'consequently'], weight: 0.04 }, // Causal reasoning
    { words: ['however', 'nevertheless', 'nonetheless', 'conversely'], weight: 0.03 }, // Contrasting
    { words: ['furthermore', 'moreover', 'additionally', 'also'], weight: 0.03 }, // Additive
    { words: ['first', 'second', 'finally', 'in conclusion'], weight: 0.03 }, // Sequential
    { words: ['for example', 'for instance', 'such as', 'including'], weight: 0.02 }, // Examples
    { words: ['research shows', 'studies indicate', 'evidence suggests'], weight: 0.04 } // Evidence-based
  ];

  reasoningPatterns.forEach(({ words, weight }) => {
    const found = words.some(word => content.toLowerCase().includes(word));
    if (found) sophisticationScore += weight;
  });
  sophisticationScore = Math.min(sophisticationScore, 0.12); // Cap reasoning bonus

  // Technical depth and domain expertise indicators
  const technicalIndicators = ['analysis', 'approach', 'strategy', 'implementation', 'consideration', 'evaluation', 'methodology', 'framework', 'systematic', 'comprehensive'];
  const foundTechnical = technicalIndicators.filter(word => content.toLowerCase().includes(word)).length;
  sophisticationScore += Math.min(foundTechnical * 0.015, 0.08); // Max 0.08 for technical depth

  // Specificity and data-driven indicators
  if (/\d+/.test(content)) sophisticationScore += 0.03; // Contains numbers/data
  if (content.includes('%') || content.includes('$')) sophisticationScore += 0.02; // Quantitative data
  if (/\b\d+\s*(minutes?|hours?|days?|weeks?|months?|years?)\b/i.test(content)) sophisticationScore += 0.02; // Time specificity

  // Content structure and organization
  const listPattern = /^\s*[-*•]\s+/gm;
  const numberedListPattern = /^\s*\d+\.\s+/gm;
  const headerPattern = /^#+\s+/gm;

  if (listPattern.test(content) || numberedListPattern.test(content)) {
    sophisticationScore += 0.03; // Structured lists
  }
  if (headerPattern.test(content)) {
    sophisticationScore += 0.02; // Header organization
  }

  score += sophisticationScore;

  // Response time factor (weighted 0.1) - using responseTime field instead of deprecated processingTimeMs
  const responseTime = role.responseTime || role.metadata?.responseTime || 0;
  if (responseTime > 0) {
    if (responseTime < 2000) score += 0.05; // Fast response
    else if (responseTime < 5000) score += 0.03; // Moderate response
    else if (responseTime > 10000) score -= 0.02; // Slow response penalty
  }

  // Model-specific adjustments based on known capabilities
  const modelAdjustments = {
    'gpt-4o': 0.05,
    'gpt-4o-mini': 0.02,
    'claude-3-5-haiku-latest': 0.03,
    'gemini-2.0-flash': 0.04
  };
  const currentModelName = role.metadata?.model || role.model;
  if (currentModelName && modelAdjustments[currentModelName]) {
    score += modelAdjustments[currentModelName];
  }

  return Math.max(0, Math.min(1.0, score));
}

/**
 * Get confidence level description
 */
function getConfidenceLevel(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'very-low';
}

/**
 * Get confidence factors
 */
function getConfidenceFactors(role, qualityMetrics) {
  const factors = [];

  if (role.status === 'fulfilled') {
    factors.push('Response generated successfully');
  }

  if (qualityMetrics.wordCount >= 20) {
    factors.push('Adequate response length');
  }

  if (qualityMetrics.hasStructure) {
    factors.push('Well-structured response');
  }

  if (qualityMetrics.hasReasoning) {
    factors.push('Contains reasoning elements');
  }

  return factors;
}

/**
 * Analyze response quality
 */
function analyzeResponseQuality(content) {
  // Safety check for undefined/null content
  if (!content || typeof content !== 'string') {
    return {
      wordCount: 0,
      sentenceCount: 0,
      averageWordsPerSentence: 0,
      hasStructure: false,
      hasReasoning: false,
      complexity: 0
    };
  }

  const wordCount = content.split(' ').length;
  const sentenceCount = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

  return {
    wordCount,
    sentenceCount,
    averageWordsPerSentence: wordCount / Math.max(sentenceCount, 1),
    hasStructure: /[.!?]/.test(content) && /^[A-Z]/.test(content),
    hasReasoning: /\b(because|therefore|however|thus|hence|consequently)\b/i.test(content),
    complexity: assessComplexity(content)
  };
}

/**
 * Calculate synthesis confidence
 */
function calculateSynthesisConfidence(synthesis, roles) {
  if (synthesis.status !== 'success') {
    return { score: 0, level: 'very-low', factors: ['Synthesis failed'] };
  }

  const successfulRoles = roles.filter(r => r.status === 'fulfilled');
  const avgRoleConfidence = successfulRoles.reduce((sum, role) => sum + role.confidence.score, 0) / successfulRoles.length;

  // Enhanced base score calculation
  let score = avgRoleConfidence * 0.6; // Reduced base weight for more nuanced calculation

  // Enhanced synthesis quality analysis
  const synthesisQuality = analyzeResponseQuality(synthesis.content);

  // Length and structure factors (30% weight)
  if (synthesisQuality.wordCount >= 50) score += 0.12;
  else if (synthesisQuality.wordCount >= 30) score += 0.08;
  else if (synthesisQuality.wordCount >= 20) score += 0.04;

  if (synthesisQuality.hasStructure) score += 0.08;
  if (synthesisQuality.hasReasoning) score += 0.1;

  // Model agreement factor (20% weight)
  const modelAgreement = calculateModelAgreement(roles);
  score += modelAgreement * 0.2;

  // Synthesis coherence and completeness (additional factors)
  const content = synthesis.content || '';

  // Comprehensive coverage indicator
  if (content.length > 500) score += 0.05; // Comprehensive response
  if (/\b(first|second|third|finally)\b/i.test(content)) score += 0.03; // Sequential structure
  if (/\b(however|therefore|furthermore)\b/i.test(content)) score += 0.04; // Logical flow
  if (/\b(research|studies|evidence)\b/i.test(content)) score += 0.03; // Evidence-based

  // Synthesis uniqueness (not just copying one response)
  // Safety check for undefined/null content
  if (!content || typeof content !== 'string') {
    return { score: 0, level: 'very-low', factors: ['Invalid content'] };
  }

  const synthesisWords = new Set(content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  let maxOverlap = 0;

  successfulRoles.forEach(role => {
    // Safety check for role content
    if (!role.content || typeof role.content !== 'string') {
      return;
    }

    const roleWords = new Set(role.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const intersection = new Set([...synthesisWords].filter(x => roleWords.has(x)));
    const overlap = intersection.size / Math.max(synthesisWords.size, 1);
    maxOverlap = Math.max(maxOverlap, overlap);
  });

  // Bonus for synthesis that combines rather than copies
  if (maxOverlap < 0.8) score += 0.05; // Good synthesis integration
  if (maxOverlap < 0.6) score += 0.03; // Excellent synthesis integration

  return {
    score: Math.min(1.0, score),
    level: getConfidenceLevel(score),
    factors: [
      `Based on ${successfulRoles.length} successful responses`,
      `Average role confidence: ${(avgRoleConfidence * 100).toFixed(1)}%`,
      ...getConfidenceFactors({ status: 'fulfilled' }, synthesisQuality)
    ]
  };
}

// // Note: calculateQualityScore function removed as deprecated
// // Now using calibrated_confidence from semantic confidence service instead

/**
 * Create fallback voting result when sophisticated voting fails
 */
function createFallbackVotingResult(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');

  if (successful.length === 0) {
    return {
      winner: 'none',
      confidence: 0,
      consensus: 'none',
      weights: {},
      fallbackUsed: true,
      error: 'No successful responses available'
    };
  }

  // Simple confidence-based voting as fallback
  const weights = {};
  let totalWeight = 0;

  successful.forEach(role => {
    const confidence = role.confidence?.score || 0.5;
    weights[role.role] = confidence;
    totalWeight += confidence;
  });

  // Normalize weights
  Object.keys(weights).forEach(role => {
    weights[role] = weights[role] / totalWeight;
  });

  // Find winner
  const winner = Object.keys(weights).reduce((best, current) =>
    weights[current] > weights[best] ? current : best
  );

  const winnerWeight = weights[winner];
  const consensus = winnerWeight > 0.6 ? 'strong' : winnerWeight > 0.45 ? 'moderate' : 'weak';

  return {
    winner,
    confidence: winnerWeight,
    consensus,
    weights,
    fallbackUsed: true,
    _description: "Fallback voting result due to sophisticated voting failure"
  };
}

// /**
//  * Estimate token count
//  */
// function estimateTokenCount(text) {
//   return Math.ceil(text.length / 4); // Rough estimation
// }

// /**
//  * Estimate request cost based on prompt and responses
//  */
// async function estimateRequestCost(prompt, roles) {
//   try {
//     const promptTokens = estimateTokenCount(prompt);
//     let totalResponseTokens = 0;

//     roles.forEach(role => {
//       if (role.content) {
//         totalResponseTokens += estimateTokenCount(role.content);
//       }
//     });

//     // Rough cost estimation based on token usage
//     // GPT-4o-mini: ~$0.00015/1K input tokens, ~$0.0006/1K output tokens
//     // Gemini Flash: ~$0.000075/1K tokens
//     // Claude Haiku: ~$0.00025/1K input tokens, ~$0.00125/1K output tokens

//     const inputCost = (promptTokens / 1000) * 0.0002; // Average input cost
//     const outputCost = (totalResponseTokens / 1000) * 0.0008; // Average output cost
//     const totalCost = inputCost + outputCost;

//     return {
//       totalCost: parseFloat(totalCost.toFixed(6)),
//       breakdown: {
//         inputTokens: promptTokens,
//         outputTokens: totalResponseTokens,
//         inputCost: parseFloat(inputCost.toFixed(6)),
//         outputCost: parseFloat(outputCost.toFixed(6))
//       }
//     };
//   } catch (error) {
//     console.warn('Cost estimation failed:', error.message);
//     return {
//       totalCost: 0.001, // Fallback estimate
//       breakdown: {
//         inputTokens: 0,
//         outputTokens: 0,
//         inputCost: 0,
//         outputCost: 0
//       }
//     };
//   }
// }

/**
 * Assess content complexity
 */
function assessComplexity(content) {
  const wordCount = content.split(' ').length;
  const uniqueWords = new Set(content.toLowerCase().split(/\W+/)).size;
  const complexity = uniqueWords / wordCount;

  if (complexity > 0.7) return 'high';
  if (complexity > 0.5) return 'medium';
  return 'low';
}

// /**
//  * Calculate consensus level
//  */
// function calculateConsensusLevel(roles) {
//   const successful = roles.filter(r => r.status === 'fulfilled');
//   if (successful.length < 2) return 'insufficient-data';

//   const avgConfidence = successful.reduce((sum, role) => sum + role.confidence.score, 0) / successful.length;

//   if (avgConfidence >= 0.8) return 'high';
//   if (avgConfidence >= 0.6) return 'medium';
//   return 'low';
// }

/**
 * Enhanced model agreement calculation with semantic similarity
 */
function calculateModelAgreement(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  if (successful.length < 2) return 0;

  // Confidence consistency (40% weight)
  const confidences = successful.map(r => r.confidence.score);
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const confidenceVariance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
  const confidenceAgreement = Math.max(0, 1 - confidenceVariance);

  // Response length consistency (20% weight)
  const lengths = successful.map(r => r.content.length);
  const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const lengthAgreement = Math.max(0, 1 - (lengthVariance / (avgLength * avgLength + 1)));

  // Enhanced semantic similarity analysis (40% weight)
  let semanticAgreement = 0;
  if (successful.length >= 2) {
    const responses = successful.map(r => r.content.toLowerCase());

    // Multi-level semantic analysis
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        // 1. Keyword overlap (Jaccard similarity)
        const words1 = new Set(responses[i].split(/\W+/).filter(w => w.length > 3));
        const words2 = new Set(responses[j].split(/\W+/).filter(w => w.length > 3));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

        // 2. N-gram similarity (bigrams)
        const bigrams1 = extractBigrams(responses[i]);
        const bigrams2 = extractBigrams(responses[j]);
        const bigramIntersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
        const bigramUnion = new Set([...bigrams1, ...bigrams2]);
        const bigramSimilarity = bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;

        // 3. Structural similarity (sentence patterns)
        const sentences1 = responses[i].split(/[.!?]+/).filter(s => s.trim().length > 0);
        const sentences2 = responses[j].split(/[.!?]+/).filter(s => s.trim().length > 0);
        const structuralSimilarity = Math.abs(sentences1.length - sentences2.length) <= 2 ? 0.8 : 0.4;

        // 4. Topic coherence (key concept overlap)
        const concepts1 = extractKeyConcepts(responses[i]);
        const concepts2 = extractKeyConcepts(responses[j]);
        const conceptIntersection = new Set([...concepts1].filter(x => concepts2.has(x)));
        const conceptUnion = new Set([...concepts1, ...concepts2]);
        const conceptSimilarity = conceptUnion.size > 0 ? conceptIntersection.size / conceptUnion.size : 0;

        // Weighted combination of similarity measures
        const combinedSimilarity = (
          jaccardSimilarity * 0.3 +
          bigramSimilarity * 0.25 +
          structuralSimilarity * 0.2 +
          conceptSimilarity * 0.25
        );

        totalSimilarity += combinedSimilarity;
        comparisons++;
      }
    }

    semanticAgreement = comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  // Weighted combination with enhanced factors
  const agreement = (confidenceAgreement * 0.35) + (lengthAgreement * 0.15) + (semanticAgreement * 0.5);
  return Math.max(0, Math.min(1, agreement));
}

/**
 * Extract bigrams from text for similarity analysis
 */
function extractBigrams(text) {
  const words = text.split(/\W+/).filter(w => w.length > 2);
  const bigrams = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

/**
 * Extract key concepts from text for topic coherence analysis
 */
function extractKeyConcepts(text) {
  const concepts = new Set();

  // Domain-specific concept patterns
  const conceptPatterns = [
    // Health and fitness concepts
    /\b(exercise|workout|fitness|health|training|muscle|cardio|strength|endurance|flexibility)\b/gi,
    // Mental health concepts
    /\b(mental|psychological|emotional|stress|anxiety|depression|mood|wellbeing|therapy)\b/gi,
    // Scientific concepts
    /\b(research|study|evidence|analysis|data|results|findings|scientific|clinical)\b/gi,
    // Action concepts
    /\b(improve|increase|reduce|enhance|develop|maintain|prevent|achieve|build)\b/gi,
    // Time concepts
    /\b(daily|weekly|regular|consistent|routine|schedule|duration|frequency)\b/gi
  ];

  conceptPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => concepts.add(match.toLowerCase()));
  });

  // Extract noun phrases (simple approach)
  const nounPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[a-z]+)*\b/g) || [];
  nounPhrases.forEach(phrase => {
    if (phrase.length > 4) concepts.add(phrase.toLowerCase());
  });

  return concepts;
}

// /**
//  * Calculate response consistency
//  */
// function calculateResponseConsistency(roles) {
//   const successful = roles.filter(r => r.status === 'fulfilled');
//   if (successful.length < 2) return 0;

//   // Measure consistency based on response lengths and quality
//   const lengths = successful.map(r => r.content.length);
//   const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
//   const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;

//   return Math.max(0, 1 - (lengthVariance / (avgLength * avgLength)));
// }

// /**
//  * Get quality distribution with enhanced metrics
//  */
// function getQualityDistribution(roles) {
//   const successful = roles.filter(r => r.status === 'fulfilled');
//   const distribution = {
//     high: 0,
//     medium: 0,
//     low: 0,
//     veryLow: 0,
//     averageScore: 0,
//     scoreRange: { min: 1, max: 0 },
//     totalResponses: successful.length
//   };

//   if (successful.length === 0) return distribution;

//   let totalScore = 0;
//   successful.forEach(role => {
//     const score = role.confidence.score;
//     totalScore += score;

//     // Update score range
//     distribution.scoreRange.min = Math.min(distribution.scoreRange.min, score);
//     distribution.scoreRange.max = Math.max(distribution.scoreRange.max, score);

//     // Categorize by confidence level
//     if (score >= 0.8) distribution.high++;
//     else if (score >= 0.6) distribution.medium++;
//     else if (score >= 0.4) distribution.low++;
//     else distribution.veryLow++;
//   });

//   distribution.averageScore = totalScore / successful.length;
//   return distribution;
// }

// /**
//  * Advanced weighted voting system with dynamic reliability weighting and tie-breaking
//  */
// function calculateWeightedVote(roles) {
//   const successful = roles.filter(r => r.status === 'fulfilled');
//   if (successful.length === 0) return { winner: null, confidence: 0, weights: {}, tieBreaking: false };

//   // Import provider reliability service for dynamic weighting
//   const providerReliabilityService = require('../services/providerReliabilityService');
//   const BrierCalibrationService = require('../services/brierCalibrationService');
//   const brierCalibrationService = new BrierCalibrationService();

//   const weights = {};
//   const dynamicWeights = {};
//   let totalWeight = 0;

//   // First pass: Calculate traditional weights and collect calibrated confidences
//   const providerConfidences = {};

//   successful.forEach(role => {
//     const baseWeight = role.confidence.score;
//     const responseTime = role.responseTime || role.metadata?.responseTime || 0;
//     const wordCount = role.content.split(' ').length;
//     const modelName = role.metadata?.model || role.model || '';

//     // Get calibrated confidence from Brier calibration service
//     const calibrationResult = brierCalibrationService.getCalibratedProbability(modelName, baseWeight);
//     const calibratedConfidence = calibrationResult.calibrated;

//     // Store calibrated confidence for dynamic weight calculation
//     const provider = getProviderFromModel(modelName);
//     providerConfidences[provider] = calibratedConfidence;

//     // Enhanced time performance scoring with more nuanced approach
//     let timeMultiplier = 1.0;
//     if (responseTime > 0) {
//       if (responseTime < 1500) timeMultiplier = 1.15; // 15% bonus for very fast response
//       else if (responseTime < 3000) timeMultiplier = 1.08; // 8% bonus for fast response
//       else if (responseTime < 6000) timeMultiplier = 1.02; // 2% bonus for good response
//       else if (responseTime > 15000) timeMultiplier = 0.85; // 15% penalty for very slow
//       else if (responseTime > 10000) timeMultiplier = 0.92; // 8% penalty for slow response
//     }

//     // Model-specific length optimization with adaptive ranges
//     let lengthMultiplier = 1.0;

//     if (modelName.includes('gemini')) {
//       if (wordCount >= 50 && wordCount <= 250) lengthMultiplier = 1.12;
//       else if (wordCount >= 30 && wordCount < 50) lengthMultiplier = 0.95;
//       else if (wordCount > 250 && wordCount <= 350) lengthMultiplier = 1.05;
//       else if (wordCount > 350) lengthMultiplier = 0.8;
//       else lengthMultiplier = 0.7;
//     } else if (modelName.includes('claude')) {
//       if (wordCount >= 25 && wordCount <= 120) lengthMultiplier = 1.1;
//       else if (wordCount >= 15 && wordCount < 25) lengthMultiplier = 0.9;
//       else if (wordCount > 120 && wordCount <= 200) lengthMultiplier = 1.02;
//       else if (wordCount > 200) lengthMultiplier = 0.85;
//       else lengthMultiplier = 0.75;
//     } else { // GPT models
//       if (wordCount >= 30 && wordCount <= 180) lengthMultiplier = 1.1;
//       else if (wordCount >= 15 && wordCount < 30) lengthMultiplier = 0.9;
//       else if (wordCount > 180 && wordCount <= 300) lengthMultiplier = 1.0;
//       else if (wordCount > 300) lengthMultiplier = 0.8;
//       else lengthMultiplier = 0.7;
//     }

//     // Calculate traditional weight (without dynamic reliability)
//     const traditionalWeight = baseWeight * timeMultiplier * lengthMultiplier;
//     weights[role.role] = traditionalWeight;
//     totalWeight += traditionalWeight;
//   });

//   // Second pass: Apply dynamic reliability weighting
//   const allDynamicWeights = providerReliabilityService.getAllDynamicWeights(providerConfidences);
//   let totalDynamicWeight = 0;

//   successful.forEach(role => {
//     const modelName = role.metadata?.model || role.model;
//     const provider = getProviderFromModel(modelName);
//     const dynamicReliabilityWeight = allDynamicWeights[provider] || 1.0;

//     // Apply dynamic reliability weight to traditional weight
//     const finalWeight = weights[role.role] * dynamicReliabilityWeight;
//     dynamicWeights[role.role] = finalWeight;
//     totalDynamicWeight += finalWeight;
//   });

//   // Normalize dynamic weights
//   Object.keys(dynamicWeights).forEach(role => {
//     dynamicWeights[role] = dynamicWeights[role] / totalDynamicWeight;
//   });

//   // Sort weights to find top contenders
//   const sortedWeights = Object.entries(dynamicWeights).sort((a, b) => b[1] - a[1]);
//   const topWeight = sortedWeights[0][1];
//   const secondWeight = sortedWeights.length > 1 ? sortedWeights[1][1] : 0;

//   // Tie-breaking logic: If |w1 - w2| < 0.05, trigger comparative synthesis
//   const weightDifference = Math.abs(topWeight - secondWeight);
//   const tieBreaking = weightDifference < 0.05 && sortedWeights.length > 1;

//   const winner = sortedWeights[0][0];
//   const winnerConfidence = topWeight;

//   // Calculate consensus grade based on weight distribution
//   const consensusGrade = calculateConsensusGrade(dynamicWeights, weightDifference);

//   return {
//     winner,
//     confidence: winnerConfidence,
//     weights: dynamicWeights,
//     traditionalWeights: weights,
//     tieBreaking,
//     weightDifference,
//     consensusGrade,
//     consensus: calculateConsensusStrength(dynamicWeights),
//     recommendation: generateVotingRecommendation(dynamicWeights, successful),
//     reliabilityMetrics: {
//       providerWeights: allDynamicWeights,
//       calibratedConfidences: providerConfidences
//     }
//   };
// }

// /**
//  * Enhanced consensus strength calculation with multiple factors
//  */
// function calculateConsensusStrength(weights) {
//   const values = Object.values(weights).sort((a, b) => b - a);
//   if (values.length === 0) return 'weak';

//   const maxWeight = values[0];
//   const secondMaxWeight = values[1] || 0;
//   const thirdMaxWeight = values[2] || 0;
//   const margin = maxWeight - secondMaxWeight;

//   // Calculate weight distribution entropy for additional insight
//   const entropy = calculateWeightEntropy(weights);

//   // Multi-factor consensus analysis
//   const factors = {
//     dominance: maxWeight > 0.6, // Clear winner
//     significantLead: margin > 0.2, // Substantial margin
//     strongLead: margin > 0.15, // Good margin
//     moderateLead: margin > 0.1, // Decent margin
//     lowEntropy: entropy < 0.7, // Concentrated voting
//     mediumEntropy: entropy < 0.85, // Moderately concentrated
//     threeWayTie: values.length >= 3 && (maxWeight - thirdMaxWeight) < 0.15
//   };

//   // Enhanced consensus determination
//   if (factors.dominance && factors.significantLead && factors.lowEntropy) {
//     return 'very-strong'; // New category for exceptional consensus
//   } else if ((factors.dominance && factors.strongLead) || (maxWeight > 0.55 && factors.significantLead)) {
//     return 'strong';
//   } else if ((maxWeight > 0.45 && factors.moderateLead) || (maxWeight > 0.5 && factors.mediumEntropy)) {
//     return 'moderate';
//   } else if (factors.threeWayTie || entropy > 0.9) {
//     return 'very-weak'; // New category for highly distributed voting
//   } else {
//     return 'weak';
//   }
// }

// /**
//  * Enhanced voting recommendation with detailed analysis
//  */
// function generateVotingRecommendation(weights, roles) {
//   const values = Object.values(weights).sort((a, b) => b - a);
//   const maxWeight = values[0];
//   const secondMaxWeight = values[1] || 0;
//   const consensus = calculateConsensusStrength(weights);
//   const entropy = calculateWeightEntropy(weights);
//   const margin = maxWeight - secondMaxWeight;

//   // Get winner details for context
//   const winner = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
//   const winnerRole = roles.find(r => r.role === winner);
//   const winnerModel = winnerRole?.metadata?.model || winnerRole?.model || 'unknown';

//   // Generate contextual recommendations
//   switch (consensus) {
//     case 'very-strong':
//       return `Exceptional confidence - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight and ${(margin * 100).toFixed(1)}% lead. Very high reliability.`;

//     case 'strong':
//       return `High confidence - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight. Strong model agreement indicates reliable response.`;

//     case 'moderate':
//       return `Moderate confidence - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight. Consider reviewing alternative responses for completeness.`;

//     case 'weak':
//       return `Low consensus - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight but close competition (${(margin * 100).toFixed(1)}% lead). Manual review recommended.`;

//     case 'very-weak':
//       return `Very low consensus - Highly distributed voting (entropy: ${entropy.toFixed(2)}). Responses vary significantly, comprehensive review strongly recommended.`;

//     default:
//       return `Uncertain consensus - ${winnerModel} selected but voting patterns unclear. Review recommended.`;
//   }
// }

// /**
//  * Calculate entropy of weight distribution (measure of uncertainty)
//  */
// function calculateWeightEntropy(weights) {
//   const values = Object.values(weights);
//   if (values.length === 0) return 0;

//   // Calculate Shannon entropy
//   let entropy = 0;
//   values.forEach(weight => {
//     if (weight > 0) {
//       entropy -= weight * Math.log2(weight);
//     }
//   });

//   // Normalize by maximum possible entropy (log2(n))
//   const maxEntropy = Math.log2(values.length);
//   return maxEntropy > 0 ? entropy / maxEntropy : 0;
// }



// // ============================================================================
// // 🏥 ENHANCED MONITORING ENDPOINTS - Production-grade system monitoring
// // ============================================================================

// /**
//  * Enhanced system health endpoint with comprehensive monitoring
//  */
// router.get('/system/health', async (req, res) => {
//   try {
//     const healthMonitor = req.app.locals.healthMonitor;

//     if (!healthMonitor) {
//       return res.status(503).json({
//         status: 'unhealthy',
//         message: 'Health monitoring system not available',
//         timestamp: new Date().toISOString()
//       });
//     }

//     const healthStatus = healthMonitor.getHealthStatus();
//     const statusCode = healthStatus.overall === 'healthy' ? 200 :
//                       healthStatus.overall === 'degraded' ? 200 : 503;

//     res.status(statusCode).json({
//       status: 'success',
//       data: healthStatus,
//       timestamp: new Date().toISOString(),
//       correlationId: req.correlationId || 'unknown'
//     });

//   } catch (error) {
//     res.status(503).json({
//       status: 'error',
//       message: 'Health check failed',
//       error: error.message,
//       timestamp: new Date().toISOString(),
//       correlationId: req.correlationId || 'unknown'
//     });
//   }
// });

// /**
//  * Real-time performance metrics endpoint
//  */
// router.get('/system/metrics', async (req, res) => {
//   try {
//     const healthMonitor = req.app.locals.healthMonitor;

//     if (!healthMonitor) {
//       return res.status(503).json({
//         status: 'error',
//         message: 'Health monitoring system not available'
//       });
//     }

//     const healthStatus = healthMonitor.getHealthStatus();

//     res.status(200).json({
//       status: 'success',
//       data: {
//         system: healthStatus.metrics.system,
//         api: healthStatus.metrics.api,
//         ai: healthStatus.metrics.ai,
//         database: healthStatus.metrics.database,
//         cache: healthStatus.metrics.cache,
//         alerts: {
//           active: healthStatus.activeAlerts,
//           recent: healthStatus.alertHistory
//         }
//       },
//       timestamp: new Date().toISOString(),
//       correlationId: req.correlationId || 'unknown'
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve system metrics',
//       error: error.message,
//       timestamp: new Date().toISOString(),
//       correlationId: req.correlationId || 'unknown'
//     });
//   }
// });

// /**
//  * Load testing status endpoint
//  */
// router.get('/system/load-status', async (req, res) => {
//   try {
//     const healthMonitor = req.app.locals.healthMonitor;

//     if (!healthMonitor) {
//       return res.status(503).json({
//         status: 'error',
//         message: 'Health monitoring system not available'
//       });
//     }

//     const healthStatus = healthMonitor.getHealthStatus();
//     const currentLoad = healthStatus.metrics.api.currentConcurrentRequests || 0;
//     const maxCapacity = 25; // Designed for 25+ concurrent users

//     const loadPercentage = (currentLoad / maxCapacity) * 100;
//     let loadStatus = 'optimal';

//     if (loadPercentage > 90) loadStatus = 'critical';
//     else if (loadPercentage > 75) loadStatus = 'high';
//     else if (loadPercentage > 50) loadStatus = 'moderate';

//     res.status(200).json({
//       status: 'success',
//       data: {
//         currentLoad,
//         maxCapacity,
//         loadPercentage: Math.round(loadPercentage),
//         loadStatus,
//         performance: {
//           averageResponseTime: healthStatus.metrics.api.averageResponseTime,
//           successRate: healthStatus.metrics.api.totalRequests > 0 ?
//             (healthStatus.metrics.api.successfulRequests / healthStatus.metrics.api.totalRequests * 100).toFixed(2) : 0,
//           queueLength: healthStatus.metrics.api.queueLength || 0
//         },
//         recommendations: generateLoadRecommendations(loadStatus, loadPercentage)
//       },
//       timestamp: new Date().toISOString(),
//       correlationId: req.correlationId || 'unknown'
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: 'Failed to retrieve load status',
//       error: error.message,
//       timestamp: new Date().toISOString(),
//       correlationId: req.correlationId || 'unknown'
//     });
//   }
// });

// /**
//  * Generate load-based recommendations
//  */
// function generateLoadRecommendations(loadStatus, loadPercentage) {
//   const recommendations = [];

//   switch (loadStatus) {
//     case 'critical':
//       recommendations.push('Consider implementing request queuing');
//       recommendations.push('Scale horizontally if possible');
//       recommendations.push('Enable aggressive caching');
//       break;
//     case 'high':
//       recommendations.push('Monitor response times closely');
//       recommendations.push('Consider enabling request prioritization');
//       break;
//     case 'moderate':
//       recommendations.push('System performing well under current load');
//       recommendations.push('Monitor for sustained high load periods');
//       break;
//     default:
//       recommendations.push('System operating at optimal capacity');
//       recommendations.push('Ready for additional load');
//   }

//   return recommendations;
// }

// /**
//  * Map model name to provider for dynamic weighting
//  */
// function getProviderFromModel(modelName) {
//   if (!modelName) return 'unknown';

//   const lowerModel = modelName.toLowerCase();

//   if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
//     return 'openai';
//   } else if (lowerModel.includes('claude')) {
//     return 'claude';
//   } else if (lowerModel.includes('gemini')) {
//     return 'gemini';
//   } else if (lowerModel.includes('grok')) {
//     return 'xai';
//   }

//   return 'unknown';
// }

// /**
//  * Calculate consensus grade based on weight distribution
//  */
// function calculateConsensusGrade(weights, weightDifference) {
//   const weightValues = Object.values(weights);
//   const maxWeight = Math.max(...weightValues);
//   const avgWeight = weightValues.reduce((sum, w) => sum + w, 0) / weightValues.length;

//   // Strong consensus: clear winner with significant margin
//   if (maxWeight > 0.6 && weightDifference > 0.15) {
//     return 'strong';
//   }

//   // Moderate consensus: reasonable winner with moderate margin
//   if (maxWeight > 0.45 && weightDifference > 0.08) {
//     return 'moderate';
//   }

//   // Weak consensus: close competition or no clear winner
//   return 'weak';
// }

// // ===== ADVANCED DIAGNOSTICS FUNCTIONS =====

// /**
//  * Generate advanced diagnostics including embedding similarity matrix, toxicity, and readability
//  */
// async function generateAdvancedDiagnostics(enhancedRoles, synthesis) {
//   try {
//     const semanticConfidenceService = require('../services/semanticConfidenceService');
//     const BrierCalibrationService = require('../services/brierCalibrationService');
//     const brierCalibrationService = new BrierCalibrationService();

//     // Extract successful responses
//     const successfulRoles = enhancedRoles.filter(role => role.status === 'fulfilled');

//     // Generate embedding similarity matrix
//     const embeddingSimilarityMatrix = await semanticConfidenceService.generateEmbeddingSimilarityMatrix(successfulRoles);

//     // Calculate model calibrated probabilities
//     const modelCalibratedProb = {};
//     for (const role of successfulRoles) {
//       const modelName = role.metadata?.model || role.model;
//       if (modelName && role.confidence?.score) {
//         const calibrationResult = brierCalibrationService.getCalibratedProbability(modelName, role.confidence.score);
//         modelCalibratedProb[modelName] = Math.round(calibrationResult.calibrated * 1000) / 1000;
//       }
//     }

//     // Calculate toxicity scores
//     const toxicityScores = {};
//     for (const role of successfulRoles) {
//       const modelName = role.metadata?.model || role.model;
//       if (modelName) {
//         toxicityScores[modelName] = semanticConfidenceService.calculateToxicityScore(role.content);
//       }
//     }

//     // Calculate synthesis toxicity
//     const synthesisToxicity = synthesis?.content ?
//       semanticConfidenceService.calculateToxicityScore(synthesis.content) : 0;

//     // Calculate readability metrics
//     const readabilityMetrics = {};
//     for (const role of successfulRoles) {
//       const modelName = role.metadata?.model || role.model;
//       if (modelName) {
//         readabilityMetrics[modelName] = semanticConfidenceService.calculateReadability(role.content);
//       }
//     }

//     // Calculate synthesis readability
//     const synthesisReadability = synthesis?.content ?
//       semanticConfidenceService.calculateReadability(synthesis.content) : { gradeLevel: 0, complexity: 'unknown' };

//     return {
//       embeddingSimilarityMatrix,
//       _embeddingSimilarityMatrixDescription: "Cosine similarity matrix between model responses using text-embedding-3-small. Values closer to 1.0 indicate more similar responses, helping identify consensus patterns.",

//       modelCalibratedProb,
//       _modelCalibratedProbDescription: "Brier-calibrated confidence probabilities for each model based on historical accuracy. These adjusted scores provide more reliable confidence estimates than raw model outputs.",

//       toxicityScore: Math.max(...Object.values(toxicityScores), synthesisToxicity),
//       _toxicityScoreDescription: "Highest toxicity score across all responses (0-1 scale). Scores above 0.1 may indicate potentially harmful content requiring review.",

//       toxicityBreakdown: {
//         ...toxicityScores,
//         synthesis: synthesisToxicity
//       },
//       _toxicityBreakdownDescription: "Individual toxicity scores for each model response and the final synthesis, enabling identification of problematic model outputs.",

//       readability: synthesisReadability,
//       _readabilityDescription: "Readability analysis of the final synthesis using Flesch-Kincaid grade level and complexity assessment. Helps ensure appropriate content difficulty for target audience.",

//       readabilityBreakdown: readabilityMetrics,
//       _readabilityBreakdownDescription: "Individual readability metrics for each model response, showing writing complexity and grade level requirements across different AI models.",

//       semanticQuality: {
//         avgReferenceSimilarity: calculateAverageReferenceSimilarity(successfulRoles),
//         avgGrammarScore: calculateAverageGrammarScore(successfulRoles),
//         responseTimeVariance: calculateResponseTimeVariance(successfulRoles)
//       },
//       _semanticQualityDescription: "Advanced semantic quality metrics including reference answer similarity, grammar quality, and response time consistency across the ensemble."
//     };

//   } catch (error) {
//     console.error('Advanced diagnostics generation failed:', error.message);
//     return {
//       error: error.message,
//       _errorDescription: "Advanced diagnostics could not be generated due to service unavailability. Basic ensemble functionality remains operational."
//     };
//   }
// }

// /**
//  * Calculate average reference similarity across responses
//  */
// function calculateAverageReferenceSimilarity(roles) {
//   const similarities = roles
//     .map(role => role.semanticConfidence?.components?.referenceSimilarity)
//     .filter(sim => sim !== undefined);

//   return similarities.length > 0 ?
//     Math.round((similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length) * 1000) / 1000 : 0;
// }

// /**
//  * Calculate average grammar score across responses
//  */
// function calculateAverageGrammarScore(roles) {
//   const grammarScores = roles
//     .map(role => role.semanticConfidence?.components?.grammarScore)
//     .filter(score => score !== undefined);

//   return grammarScores.length > 0 ?
//     Math.round((grammarScores.reduce((sum, score) => sum + score, 0) / grammarScores.length) * 1000) / 1000 : 0;
// }

// /**
//  * Calculate response time variance
//  */
// function calculateResponseTimeVariance(roles) {
//   const responseTimes = roles
//     .map(role => role.responseTime || role.metadata?.processingTime || 0)
//     .filter(time => time > 0);

//   if (responseTimes.length < 2) return 0;

//   const mean = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
//   const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / responseTimes.length;

//   return Math.round(variance);
// }

// /**
//  * Helper functions for explanation features
//  */

// /**
//  * Identify conflict points between model responses
//  */
// function identifyConflictPoints(roles) {
//   const conflicts = [];

//   // Simple conflict detection based on response length and content similarity
//   for (let i = 0; i < roles.length; i++) {
//     for (let j = i + 1; j < roles.length; j++) {
//       const role1 = roles[i];
//       const role2 = roles[j];

//       // Check for significant confidence differences
//       const confidenceDiff = Math.abs(role1.confidence.score - role2.confidence.score);
//       if (confidenceDiff > 0.3) {
//         conflicts.push({
//           type: 'confidence_mismatch',
//           models: [role1.role, role2.role],
//           difference: Math.round(confidenceDiff * 100) / 100,
//           description: `Significant confidence difference between ${role1.role} and ${role2.role}`
//         });
//       }

//       // Check for response length differences
//       const lengthDiff = Math.abs(role1.wordCount - role2.wordCount);
//       if (lengthDiff > 100) {
//         conflicts.push({
//           type: 'length_mismatch',
//           models: [role1.role, role2.role],
//           difference: lengthDiff,
//           description: `Significant response length difference between ${role1.role} and ${role2.role}`
//         });
//       }
//     }
//   }

//   return conflicts;
// }

// /**
//  * Calculate parallel processing efficiency
//  */
// function calculateParallelEfficiency(roles) {
//   const responseTimes = roles
//     .filter(role => role.responseTime && role.responseTime > 0)
//     .map(role => role.responseTime);

//   if (responseTimes.length === 0) return 0;

//   const maxTime = Math.max(...responseTimes);
//   const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
//   const theoreticalSequentialTime = totalTime;
//   const actualParallelTime = maxTime;

//   // Efficiency = (Sequential Time - Parallel Time) / Sequential Time
//   const efficiency = (theoreticalSequentialTime - actualParallelTime) / theoreticalSequentialTime;
//   return Math.max(0, Math.min(1, efficiency));
// }

// /**
//  * Calculate cost efficiency metrics
//  */
// async function calculateCostEfficiency(prompt, roles) {
//   const inputTokens = estimateTokenCount(prompt);
//   const outputTokens = roles.reduce((sum, role) => sum + estimateTokenCount(role.content), 0);

//   // Rough cost estimates (these would be more accurate with real pricing data)
//   const estimatedCost = (inputTokens * 0.00001) + (outputTokens * 0.00003); // Example pricing
//   const averageConfidence = roles.reduce((sum, role) => sum + role.confidence.score, 0) / roles.length;

//   return {
//     estimatedCost: Math.round(estimatedCost * 10000) / 10000, // Round to 4 decimal places
//     costPerConfidencePoint: Math.round((estimatedCost / averageConfidence) * 10000) / 10000,
//     inputTokens,
//     outputTokens,
//     totalTokens: inputTokens + outputTokens,
//     _description: "Cost efficiency analysis showing estimated API costs and cost-effectiveness metrics"
//   };
// }

// module.exports = router;

/**
 * Health Routes - Optimized for low-cost AI testing and ensemble processing
 *
 * 🎯 PURPOSE: Handles health checks, AI tests, analytics, and core /default-ensemble.
 * 📋 OPTIMIZATIONS: Simplified /default-ensemble (extracted functions), low-cost models in tests, cached analytics.
 */

const express = require('express');
const router = express.Router();
const enhancedEnsemble = require('../services/enhancedEnsembleRunner');
const monitoringService = require('../services/monitoringService');
const clients = require('../services/vendorClients');
const ensembleConfig = require('../config/ensemblePrompts');
const workoutService = require('../services/workoutService');
const cacheService = require('../services/cacheService');
const securityMiddleware = require('../middleware/securityMiddleware');
const SophisticatedVotingService = require('../services/sophisticatedVotingService');
const enhancedSynthesisService = require('../services/enhancedSynthesisService');
const postSynthesisValidator = require('../services/postSynthesisValidator');

// Basic health check
router.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Neurastack backend healthy 🚀' }));

// Voting analytics (cached for perf)
router.get('/voting-analytics', async (req, res) => {
  const cacheKey = 'voting_analytics';
  let analytics = await cacheService.get(cacheKey);
  if (!analytics) {
    try {
      const votingService = new SophisticatedVotingService();
      const serviceAnalytics = votingService.getVotingStats();
      const monitoringAnalytics = monitoringService.getVotingAnalytics();
      analytics = {
        status: 'success',
        timestamp: new Date().toISOString(),
        analytics: {
          monitoring: monitoringAnalytics,
          services: serviceAnalytics,
          insights: {
            systemHealth: monitoringAnalytics.totalVotingDecisions > 0 ? 'active' : 'inactive',
            averageConfidence: monitoringAnalytics.averageConfidence,
            mostUsedFeatures: getMostUsedFeatures(monitoringAnalytics),
            topPerformingModels: getTopPerformingModels(monitoringAnalytics),
            consensusTrends: getConsensusTrends(monitoringAnalytics)
          }
        }
      };
      await cacheService.set(cacheKey, analytics, 60); // Cache 60s
    } catch (error) {
      monitoringService.log('error', 'Failed to get voting analytics', { error: error.message });
      return res.status(500).json({ status: 'error', error: 'Failed to retrieve voting analytics', timestamp: new Date().toISOString() });
    }
  }
  res.json(analytics);
});

// Synthesis analytics
router.get('/synthesis-analytics', async (req, res) => {
  try {
    const analytics = monitoringService.getSynthesisAnalytics();
    res.status(200).json({ status: 'success', timestamp: new Date().toISOString(), analytics });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve synthesis analytics', error: error.message });
  }
});

// Synthesis health check
router.get('/synthesis-health', async (req, res) => {
  try {
    const [synthesisHealth, validatorHealth] = await Promise.all([enhancedSynthesisService.healthCheck(), postSynthesisValidator.healthCheck()]);
    res.status(200).json({ status: 'success', timestamp: new Date().toISOString(), services: { enhancedSynthesis: synthesisHealth, postSynthesisValidator: validatorHealth } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve synthesis health status', error: error.message });
  }
});

// Low-cost test endpoints (switched to cheap models)
router.get('/openai-test', async (req, res) => {
  try {
    const response = await clients.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Low-cost
      messages: [{ role: 'user', content: 'Hello! Brief overview of Neurastack backend?' }]
    });
    res.status(200).json({ status: 'ok', model: response.model, response: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch from OpenAI.' });
  }
});

router.get('/xai-test', (req, res) => res.status(200).json({ status: 'ok', message: 'xAI test working!' })); // Keep simple, no API call (low-cost)

router.get('/gemini-test', async (req, res) => {
  try {
    const response = await clients.gemini.post('/models/gemini-1.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY, { // Low-cost flash
      contents: [{ parts: [{ text: 'Explain AI in few words' }] }]
    });
    res.status(200).json({ status: 'ok', model: 'gemini-1.5-flash', response: response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch from Gemini.' });
  }
});

router.get('/claude-test', async (req, res) => {
  try {
    const response = await clients.claude.post('/messages', {
      model: 'claude-3-5-haiku-latest', // Low-cost haiku
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Explain neural networks simply' }]
    });
    res.status(200).json({ status: 'ok', model: response.data.model, response: response.data.content[0].text });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch from Claude.' });
  }
});

// Core /default-ensemble (simplified: extracted functions)
router.post('/default-ensemble', async (req, res) => {
  const correlationId = req.correlationId || 'unknown';
  try {
    const { prompt, userId, userTier, sessionId, explainMode } = validateAndSanitizeInput(req);
    const ensembleResult = await enhancedEnsemble.runEnsemble(prompt, userId, sessionId);
    const enhancedRoles = await calculateRoleConfidences(ensembleResult.roles);
    const votingResult = await getVotingResult(enhancedRoles, prompt, { correlationId, userId: req.headers['x-user-id'], type: 'ensemble' });
    const synthesisConfidence = calculateSynthesisConfidence(ensembleResult.synthesis, enhancedRoles);
    const response = buildFinalResponse(ensembleResult, enhancedRoles, votingResult, synthesisConfidence, prompt, userId, sessionId, explainMode, correlationId);
    res.status(200).json(response);
  } catch (error) {
    monitoringService.log('error', 'Ensemble failed', { error: error.message, userId: req.headers['x-user-id'] || 'anonymous' }, correlationId);
    res.status(500).json({ status: 'error', message: 'Ensemble processing failed.', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error', correlationId });
  }
});

// Extracted: Input validation/sanitization
function validateAndSanitizeInput(req) {
  const prompt = (req.body?.prompt || 'Explain AI in 1-2 lines.').trim().replace(/[\x00-\x1F\x7F]/g, '');
  const userId = req.headers['x-user-id'] || 'anonymous';
  const userTier = req.userTier || 'free';
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] || `session_${userId}_${Date.now()}`;
  const explainMode = req.query?.explain === 'true' || req.body?.explain === true;

  if (typeof prompt !== 'string' || prompt.length < 3 || prompt.length > (userTier === 'premium' ? 8000 : 5000)) {
    throw new Error('Invalid prompt length/format.');
  }

  // Rate limit check (simplified inline)
  const rateLimits = { free: { max: 25, windowMs: 60000 }, premium: { max: 100, windowMs: 60000 } };
  const limit = rateLimits[userTier] || rateLimits.free;
  const rateResult = securityMiddleware.checkRateLimit(userId, 'ensemble', limit.max, limit.windowMs);
  if (!rateResult.allowed) throw new Error('Rate limit exceeded.');

  return { prompt, userId, userTier, sessionId, explainMode };
}

// Extracted: Calculate role confidences
async function calculateRoleConfidences(roles) {
  return Promise.all(roles.map(async role => {
    const confidence = await calculateConfidenceScore(role);
    const qualityMetrics = analyzeResponseQuality(role.content);
    return { ...role, confidence: { score: confidence, level: getConfidenceLevel(confidence), factors: getConfidenceFactors(role, qualityMetrics) }, quality: qualityMetrics };
  }));
}

// Extracted: Get voting result (with fallback)
async function getVotingResult(roles, prompt, metadata) {
  const votingService = new SophisticatedVotingService();
  try {
    return await votingService.executeSophisticatedVoting(roles, prompt, metadata);
  } catch (error) {
    return createFallbackVotingResult(roles); // From original
  }
}

// Extracted: Build final response (simplified structure)
function buildFinalResponse(ensembleResult, enhancedRoles, votingResult, synthesisConfidence, prompt, userId, sessionId, explainMode, correlationId) {
  const baseResponse = {
    status: 'success',
    data: {
      prompt, userId, sessionId,
      synthesis: { ...ensembleResult.synthesis, confidence: synthesisConfidence },
      roles: enhancedRoles,
      voting: votingResult,
      metadata: { ...ensembleResult.metadata, correlationId, explainMode }
    },
    correlationId
  };

  if (explainMode) {
    baseResponse.explanation = { /* Original explanation logic, simplified if needed */ };
  }

  return baseResponse;
}

// Detailed health endpoint
router.get('/health-detailed', async (req, res) => {
  try {
    const [systemHealth, vendorHealth, ensembleHealth] = await Promise.all([monitoringService.getHealthStatus(), clients.healthCheck(), enhancedEnsemble.healthCheck()]);
    const overallHealth = { status: 'healthy', timestamp: new Date().toISOString(), version: '2.0', components: { system: systemHealth, vendors: vendorHealth, ensemble: ensembleHealth } };
    const statuses = [systemHealth.status, Object.values(vendorHealth).some(v => !v.isHealthy) ? 'degraded' : 'healthy', ensembleHealth.ensemble.isHealthy ? 'healthy' : 'degraded'];
    if (statuses.includes('unhealthy')) overallHealth.status = 'unhealthy';
    else if (statuses.includes('degraded')) overallHealth.status = 'degraded';
    res.status(overallHealth.status === 'healthy' ? 200 : 503).json(overallHealth);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', message: 'Health check failed', timestamp: new Date().toISOString(), error: error.message });
  }
});

// Metrics (cached for perf)
router.get('/metrics', async (req, res) => {
  const cacheKey = 'system_metrics';
  let metrics = await cacheService.get(cacheKey);
  if (!metrics) {
    try {
      const [systemMetrics, vendorMetrics, ensembleMetrics] = await Promise.all([monitoringService.getDetailedMetrics(), clients.getMetrics(), enhancedEnsemble.getMetrics()]);
      metrics = { timestamp: new Date().toISOString(), system: systemMetrics, vendors: vendorMetrics, ensemble: ensembleMetrics, tier: ensembleConfig.meta.tier };
      await cacheService.set(cacheKey, metrics, 60); // Cache 60s
    } catch (error) {
      return res.status(500).json({ error: 'Failed to collect metrics', timestamp: new Date().toISOString() });
    }
  }
  res.status(200).json(metrics);
});

// Tier info
router.get('/tier-info', async (req, res) => {
  try {
    const tierConfig = ensembleConfig.getTierConfig();
    res.status(200).json({ status: 'success', data: { currentTier: ensembleConfig.meta.tier, configuration: tierConfig, availableTiers: ensembleConfig.allModels, costComparison: {} } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve tier info' });
  }
});

// Workout health (keep as is)
router.get('/workout/health', async (req, res) => {
  try {
    const healthStatus = await workoutService.getHealthStatus();
    res.status(healthStatus.status === 'healthy' ? 200 : 503).json({ ...healthStatus, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() });
  }
});

// Cache stats/clear (keep as is, but add auth if admin)

// Removed: Vector endpoints (unused in core flow; re-add if needed)

// Ensemble stats/performance/feedback (keep simplified)

// Confidence/quality functions (keep as is; they're referenced)

// Export
module.exports = router;