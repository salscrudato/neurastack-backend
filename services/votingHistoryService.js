/**
 * 🗳️ Voting History Service - Advanced Voting Pattern Analytics
 *
 * 🎯 PURPOSE: Track voting patterns, model performance, and consensus history
 *            to enable dynamic weight adaptation and sophisticated voting mechanisms
 *
 * 📋 KEY FEATURES:
 * 1. Voting pattern tracking and analysis
 * 2. Model performance history with Brier score integration
 * 3. Consensus strength evolution over time
 * 4. Dynamic weight adaptation based on historical data
 * 5. Voting anomaly detection and alerting
 * 6. Meta-voting decision tracking
 *
 * 💡 ANALOGY: Like having a political analyst and data scientist
 *    continuously studying voting patterns to improve democratic processes
 */

const admin = require('firebase-admin');
const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class VotingHistoryService {
  constructor() {
    this.isFirestoreAvailable = false;
    this.localCache = new Map();
    this.firestore = null;
    this.votingMetrics = new Map();
    this.modelPerformanceHistory = new Map();
    this.consensusPatterns = new Map();
    
    // Configuration
    this.maxHistorySize = 1000; // Maximum voting records to keep per model
    this.adaptationWindow = 100; // Number of recent votes to consider for adaptation
    this.performanceDecayFactor = 0.95; // Decay factor for historical performance
    this.consensusThresholds = {
      veryWeak: 0.3,
      weak: 0.45,
      moderate: 0.6,
      strong: 0.75,
      veryStrong: 0.9
    };

    this.initializeFirestore();
  }

  /**
   * Initialize Firestore connection
   */
  async initializeFirestore() {
    try {
      if (admin.apps.length === 0) {
        // Firestore will be initialized by the main app
        return;
      }
      
      this.firestore = admin.firestore();
      await this.testFirestoreConnection();
      await this.initializeCollections();
    } catch (error) {
      logger.warning(
        'Voting History Service: Firestore initialization failed',
        {
          'Error': error.message,
          'Fallback': 'Local cache mode',
          'Impact': 'Voting history will not persist'
        },
        'voting'
      );
    }
  }

  /**
   * Test Firestore connection
   */
  async testFirestoreConnection() {
    if (!this.firestore) {
      this.isFirestoreAvailable = false;
      return;
    }

    try {
      await this.firestore.collection('_test').limit(1).get();
      this.isFirestoreAvailable = true;
      logger.success(
        'Voting History Service: Firestore connection established',
        {
          'Database': 'neurastack-backend',
          'Collections': 'votingHistory, modelPerformance, consensusPatterns',
          'Status': 'Connected and ready'
        },
        'voting'
      );
    } catch (error) {
      this.isFirestoreAvailable = false;
      logger.warning(
        'Voting History Service: Firestore unavailable - Using local cache',
        {
          'Error': error.message,
          'Fallback': 'Local cache active',
          'Impact': 'Voting history will not persist between restarts'
        },
        'voting'
      );
    }
  }

  /**
   * Initialize Firestore collections with proper indexes
   */
  async initializeCollections() {
    if (!this.isFirestoreAvailable) return;

    try {
      // Create initial documents to establish collections
      const collections = [
        'votingHistory',
        'modelPerformance', 
        'consensusPatterns',
        'votingMetrics',
        'metaVotingDecisions'
      ];

      for (const collection of collections) {
        const testDoc = this.firestore.collection(collection).doc('_init');
        await testDoc.set({
          initialized: true,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        await testDoc.delete();
      }

      logger.success(
        'Voting History Service: Collections initialized',
        {
          'Collections': collections.join(', '),
          'Status': 'Ready for voting data'
        },
        'voting'
      );
    } catch (error) {
      logger.warning(
        'Voting History Service: Collection initialization failed',
        {
          'Error': error.message,
          'Impact': 'May affect query performance'
        },
        'voting'
      );
    }
  }

  /**
   * Record a voting decision with comprehensive metadata
   */
  async recordVotingDecision(votingResult, roles, requestMetadata = {}) {
    try {
      const votingRecord = {
        votingId: `voting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        winner: votingResult.winner,
        confidence: votingResult.confidence,
        consensus: votingResult.consensus,
        weights: votingResult.weights,
        tieBreaking: votingResult.tieBreaking || false,
        metaVotingUsed: votingResult.metaVotingUsed || false,
        abstentionTriggered: votingResult.abstentionTriggered || false,
        
        // Model participation data
        participatingModels: roles.filter(r => r.status === 'fulfilled').map(r => ({
          model: r.metadata?.model || r.model || 'unknown',
          role: r.role,
          confidence: r.confidence || 0,
          responseTime: r.responseTime || 0,
          weight: votingResult.weights[r.role] || 0,
          semanticConfidence: r.semanticConfidence?.score || 0,
          brierScore: r.brierScore || null
        })),
        
        // Diversity and consensus metrics
        diversityScore: votingResult.diversityScore || 0,
        semanticSimilarity: votingResult.semanticSimilarity || {},
        consensusStrength: votingResult.consensusStrength || 0,
        
        // Request context
        requestType: requestMetadata.type || 'ensemble',
        userId: requestMetadata.userId || null,
        correlationId: requestMetadata.correlationId || null,
        
        // Performance metrics
        totalProcessingTime: roles.reduce((sum, r) => sum + (r.responseTime || 0), 0),
        successfulModels: roles.filter(r => r.status === 'fulfilled').length,
        failedModels: roles.filter(r => r.status === 'rejected').length
      };

      // Store in Firestore or local cache
      if (this.isFirestoreAvailable) {
        try {
          await this.firestore
            .collection('votingHistory')
            .doc(votingRecord.votingId)
            .set(votingRecord);
          
          monitoringService.log('info', 'Voting decision recorded', {
            votingId: votingRecord.votingId,
            winner: votingRecord.winner,
            consensus: votingRecord.consensus,
            participatingModels: votingRecord.participatingModels.length
          });
        } catch (error) {
          console.warn('⚠️ Failed to store voting record in Firestore:', error.message);
          this.isFirestoreAvailable = false;
          this.localCache.set(votingRecord.votingId, votingRecord);
        }
      } else {
        this.localCache.set(votingRecord.votingId, votingRecord);
      }

      // Update model performance tracking
      await this.updateModelPerformance(votingRecord);
      
      // Update consensus patterns
      await this.updateConsensusPatterns(votingRecord);

      return votingRecord.votingId;
    } catch (error) {
      monitoringService.log('error', 'Failed to record voting decision', {
        error: error.message,
        winner: votingResult.winner
      });
      throw error;
    }
  }

  /**
   * Update model performance tracking
   */
  async updateModelPerformance(votingRecord) {
    try {
      for (const model of votingRecord.participatingModels) {
        const performanceKey = model.model;
        
        // Get existing performance data
        let performanceData = this.modelPerformanceHistory.get(performanceKey) || {
          model: model.model,
          totalVotes: 0,
          wins: 0,
          averageWeight: 0,
          averageConfidence: 0,
          averageResponseTime: 0,
          consensusParticipation: {
            strong: 0,
            moderate: 0,
            weak: 0,
            veryWeak: 0
          },
          recentPerformance: [],
          lastUpdated: new Date().toISOString()
        };

        // Update performance metrics
        performanceData.totalVotes++;
        if (model.role === votingRecord.winner) {
          performanceData.wins++;
        }

        // Update running averages with decay
        const decayFactor = this.performanceDecayFactor;
        performanceData.averageWeight = (performanceData.averageWeight * decayFactor) + 
                                       (model.weight * (1 - decayFactor));
        performanceData.averageConfidence = (performanceData.averageConfidence * decayFactor) + 
                                           (model.confidence * (1 - decayFactor));
        performanceData.averageResponseTime = (performanceData.averageResponseTime * decayFactor) + 
                                             (model.responseTime * (1 - decayFactor));

        // Update consensus participation
        const consensusLevel = this.mapConsensusToLevel(votingRecord.consensus);
        performanceData.consensusParticipation[consensusLevel]++;

        // Add to recent performance history
        performanceData.recentPerformance.push({
          timestamp: votingRecord.timestamp,
          weight: model.weight,
          confidence: model.confidence,
          won: model.role === votingRecord.winner,
          consensus: votingRecord.consensus
        });

        // Keep only recent performance data
        if (performanceData.recentPerformance.length > this.adaptationWindow) {
          performanceData.recentPerformance = performanceData.recentPerformance
            .slice(-this.adaptationWindow);
        }

        performanceData.lastUpdated = new Date().toISOString();
        
        // Store updated performance data
        this.modelPerformanceHistory.set(performanceKey, performanceData);

        // Persist to Firestore if available
        if (this.isFirestoreAvailable) {
          try {
            await this.firestore
              .collection('modelPerformance')
              .doc(performanceKey)
              .set(performanceData);
          } catch (error) {
            console.warn(`⚠️ Failed to persist performance data for ${performanceKey}:`, error.message);
          }
        }
      }
    } catch (error) {
      monitoringService.log('error', 'Failed to update model performance', {
        error: error.message,
        votingId: votingRecord.votingId
      });
    }
  }

  /**
   * Map consensus string to level for tracking
   */
  mapConsensusToLevel(consensus) {
    const mapping = {
      'very-strong': 'strong',
      'strong': 'strong',
      'moderate': 'moderate',
      'weak': 'weak',
      'very-weak': 'veryWeak'
    };
    return mapping[consensus] || 'weak';
  }

  /**
   * Update consensus patterns tracking
   */
  async updateConsensusPatterns(votingRecord) {
    try {
      const patternKey = `consensus_${votingRecord.consensus}`;

      let patternData = this.consensusPatterns.get(patternKey) || {
        consensusType: votingRecord.consensus,
        occurrences: 0,
        averageConfidence: 0,
        averageDiversityScore: 0,
        modelCombinations: new Map(),
        timePatterns: {
          hourly: new Array(24).fill(0),
          daily: new Array(7).fill(0)
        },
        lastUpdated: new Date().toISOString()
      };

      // Update basic metrics
      patternData.occurrences++;
      const decayFactor = this.performanceDecayFactor;
      patternData.averageConfidence = (patternData.averageConfidence * decayFactor) +
                                     (votingRecord.confidence * (1 - decayFactor));
      patternData.averageDiversityScore = (patternData.averageDiversityScore * decayFactor) +
                                         (votingRecord.diversityScore * (1 - decayFactor));

      // Track model combinations that lead to this consensus
      const modelCombo = votingRecord.participatingModels
        .map(m => m.model)
        .sort()
        .join(',');

      const comboCount = patternData.modelCombinations.get(modelCombo) || 0;
      patternData.modelCombinations.set(modelCombo, comboCount + 1);

      // Update time patterns
      const timestamp = new Date(votingRecord.timestamp);
      patternData.timePatterns.hourly[timestamp.getHours()]++;
      patternData.timePatterns.daily[timestamp.getDay()]++;

      patternData.lastUpdated = new Date().toISOString();

      // Store updated pattern data
      this.consensusPatterns.set(patternKey, patternData);

      // Persist to Firestore if available
      if (this.isFirestoreAvailable) {
        try {
          // Convert Map to Object for Firestore storage
          const firestoreData = {
            ...patternData,
            modelCombinations: Object.fromEntries(patternData.modelCombinations)
          };

          await this.firestore
            .collection('consensusPatterns')
            .doc(patternKey)
            .set(firestoreData);
        } catch (error) {
          console.warn(`⚠️ Failed to persist consensus pattern ${patternKey}:`, error.message);
        }
      }
    } catch (error) {
      monitoringService.log('error', 'Failed to update consensus patterns', {
        error: error.message,
        consensus: votingRecord.consensus
      });
    }
  }

  /**
   * Get dynamic weights for models based on historical performance
   */
  async getDynamicWeights(participatingModels) {
    try {
      const dynamicWeights = {};

      for (const modelName of participatingModels) {
        const performanceData = this.modelPerformanceHistory.get(modelName);

        if (!performanceData || performanceData.totalVotes < 10) {
          // Use default weight for new or low-data models
          dynamicWeights[modelName] = 1.0;
          continue;
        }

        // Calculate dynamic weight based on multiple factors
        const winRate = performanceData.wins / performanceData.totalVotes;
        const avgWeight = performanceData.averageWeight;
        const avgConfidence = performanceData.averageConfidence;
        const responseTimeScore = Math.max(0.1, 1.0 - (performanceData.averageResponseTime / 30000)); // Normalize to 30s max

        // Recent performance trend
        const recentPerformance = performanceData.recentPerformance.slice(-20); // Last 20 votes
        const recentWinRate = recentPerformance.length > 0 ?
          recentPerformance.filter(p => p.won).length / recentPerformance.length : winRate;

        // Consensus participation quality
        const totalConsensus = Object.values(performanceData.consensusParticipation).reduce((a, b) => a + b, 0);
        const strongConsensusRate = totalConsensus > 0 ?
          performanceData.consensusParticipation.strong / totalConsensus : 0.5;

        // Combine factors with weights
        const dynamicWeight = (
          winRate * 0.3 +                    // Historical win rate
          avgWeight * 0.2 +                  // Average voting weight received
          avgConfidence * 0.15 +             // Average confidence
          responseTimeScore * 0.1 +          // Response time performance
          recentWinRate * 0.15 +             // Recent performance trend
          strongConsensusRate * 0.1          // Quality consensus participation
        );

        dynamicWeights[modelName] = Math.max(0.1, Math.min(2.0, dynamicWeight));
      }

      return dynamicWeights;
    } catch (error) {
      monitoringService.log('error', 'Failed to calculate dynamic weights', {
        error: error.message,
        models: participatingModels
      });

      // Return default weights on error
      const defaultWeights = {};
      participatingModels.forEach(model => {
        defaultWeights[model] = 1.0;
      });
      return defaultWeights;
    }
  }

  /**
   * Analyze voting patterns for anomalies
   */
  async analyzeVotingAnomalies(votingRecord) {
    try {
      const anomalies = [];

      // Check for unusual consensus patterns
      const consensusHistory = Array.from(this.consensusPatterns.values());
      const currentConsensusData = consensusHistory.find(p => p.consensusType === votingRecord.consensus);

      if (currentConsensusData) {
        // Check if confidence is unusually low/high for this consensus type
        const confidenceDiff = Math.abs(votingRecord.confidence - currentConsensusData.averageConfidence);
        if (confidenceDiff > 0.3) {
          anomalies.push({
            type: 'unusual_confidence',
            severity: confidenceDiff > 0.5 ? 'high' : 'medium',
            description: `Confidence ${votingRecord.confidence} is unusual for ${votingRecord.consensus} consensus (avg: ${currentConsensusData.averageConfidence.toFixed(3)})`,
            deviation: confidenceDiff
          });
        }
      }

      // Check for model performance anomalies
      for (const model of votingRecord.participatingModels) {
        const performanceData = this.modelPerformanceHistory.get(model.model);
        if (performanceData && performanceData.totalVotes > 20) {
          // Check if weight is unusually different from historical average
          const weightDiff = Math.abs(model.weight - performanceData.averageWeight);
          if (weightDiff > 0.4) {
            anomalies.push({
              type: 'unusual_model_weight',
              severity: weightDiff > 0.6 ? 'high' : 'medium',
              model: model.model,
              description: `Model ${model.model} received weight ${model.weight} vs historical avg ${performanceData.averageWeight.toFixed(3)}`,
              deviation: weightDiff
            });
          }
        }
      }

      // Check for tie-breaking frequency anomalies
      if (votingRecord.tieBreaking) {
        const recentVotes = await this.getRecentVotingHistory(50);
        const tieBreakerRate = recentVotes.filter(v => v.tieBreaking).length / recentVotes.length;
        if (tieBreakerRate > 0.3) {
          anomalies.push({
            type: 'high_tiebreaker_frequency',
            severity: 'medium',
            description: `High tie-breaker frequency: ${(tieBreakerRate * 100).toFixed(1)}% of recent votes`,
            rate: tieBreakerRate
          });
        }
      }

      // Log anomalies if found
      if (anomalies.length > 0) {
        monitoringService.log('warning', 'Voting anomalies detected', {
          votingId: votingRecord.votingId,
          anomalies: anomalies.length,
          details: anomalies
        });
      }

      return anomalies;
    } catch (error) {
      monitoringService.log('error', 'Failed to analyze voting anomalies', {
        error: error.message,
        votingId: votingRecord.votingId
      });
      return [];
    }
  }

  /**
   * Get recent voting history for analysis
   */
  async getRecentVotingHistory(limit = 100) {
    try {
      if (this.isFirestoreAvailable) {
        const snapshot = await this.firestore
          .collection('votingHistory')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        return snapshot.docs.map(doc => doc.data());
      } else {
        // Use local cache
        const allRecords = Array.from(this.localCache.values())
          .filter(record => record.votingId)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limit);

        return allRecords;
      }
    } catch (error) {
      monitoringService.log('error', 'Failed to get recent voting history', {
        error: error.message,
        limit
      });
      return [];
    }
  }
}

module.exports = VotingHistoryService;
