/**
 * Memory Lifecycle Management Service
 * Handles memory cleanup, archiving, and maintenance tasks
 */

const cron = require('node-cron');
const admin = require('firebase-admin');
const { MEMORY_TYPE_CONFIG } = require('../types/memory');

class MemoryLifecycleManager {
  constructor() {
    this.firestore = null; // Will be initialized when needed
    this.isRunning = false;
    this.scheduledTasks = [];
  }

  /**
   * Get Firestore instance, initializing if needed
   */
  getFirestore() {
    if (!this.firestore) {
      try {
        this.firestore = admin.firestore();
      } catch (error) {
        console.warn('⚠️ Firebase not available for memory lifecycle management:', error.message);
        return null;
      }
    }
    return this.firestore;
  }

  /**
   * Start all scheduled memory management tasks
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Memory lifecycle manager already running');
      return;
    }

    console.log('🔄 Starting memory lifecycle management...');
    this.isRunning = true;

    // Optimized cleanup schedule for 25+ concurrent users
    // Daily cleanup at 2 AM (reduced frequency for better performance)
    const dailyCleanup = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Starting optimized daily memory cleanup...');
      await this.performOptimizedDailyCleanup();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Hourly weight updates
    const hourlyWeightUpdate = cron.schedule('0 * * * *', async () => {
      console.log('⚖️ Updating memory weights...');
      await this.updateMemoryWeights();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Weekly archive old memories
    const weeklyArchive = cron.schedule('0 3 * * 0', async () => {
      console.log('📦 Starting weekly memory archival...');
      await this.archiveOldMemories();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Start all tasks
    dailyCleanup.start();
    hourlyWeightUpdate.start();
    weeklyArchive.start();

    this.scheduledTasks = [dailyCleanup, hourlyWeightUpdate, weeklyArchive];
    console.log('✅ Memory lifecycle management started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Memory lifecycle manager not running');
      return;
    }

    console.log('🛑 Stopping memory lifecycle management...');
    this.scheduledTasks.forEach(task => task.stop());
    this.scheduledTasks = [];
    this.isRunning = false;
    console.log('✅ Memory lifecycle management stopped');
  }

  /**
   * Perform optimized daily cleanup tasks for high-load scenarios
   */
  async performOptimizedDailyCleanup() {
    try {
      const startTime = Date.now();
      let totalProcessed = 0;
      let totalDeleted = 0;

      console.log('🧹 Starting optimized memory cleanup for high-load environment...');

      // Batch cleanup operations for better performance
      const cleanupPromises = [
        this.deleteExpiredMemories(),
        this.deleteLowQualityMemories(),
        this.enforceMemoryLimits()
      ];

      // Execute cleanup operations in parallel for better performance
      const results = await Promise.allSettled(cleanupPromises);

      results.forEach((result, index) => {
        const operationNames = ['expired memories', 'low-quality memories', 'memory limits'];
        if (result.status === 'fulfilled') {
          totalDeleted += result.value.deleted || 0;
          console.log(`✅ ${operationNames[index]} cleanup: ${result.value.deleted || 0} deleted`);
        } else {
          console.error(`❌ ${operationNames[index]} cleanup failed:`, result.reason);
        }
      });

      const processingTime = Date.now() - startTime;
      console.log(`🧹 Optimized daily cleanup completed: ${totalDeleted} memories deleted in ${processingTime}ms`);

      return {
        success: true,
        deleted: totalDeleted,
        processingTime
      };
    } catch (error) {
      console.error('❌ Daily cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete expired memories
   */
  async deleteExpiredMemories() {
    try {
      const firestore = this.getFirestore();
      if (!firestore) {
        console.warn('⚠️ Firestore not available, skipping expired memory cleanup');
        return { deleted: 0 };
      }

      const now = new Date();
      const expiredQuery = firestore.collection('memories')
        .where('retention.expiresAt', '<=', now)
        .limit(100); // Process in batches

      const snapshot = await expiredQuery.get();
      const batch = firestore.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      if (snapshot.docs.length > 0) {
        await batch.commit();
        console.log(`🗑️ Deleted ${snapshot.docs.length} expired memories`);
      }

      return { deleted: snapshot.docs.length };
    } catch (error) {
      console.error('❌ Failed to delete expired memories:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Delete low-quality memories that are old
   */
  async deleteLowQualityMemories() {
    try {
      const firestore = this.getFirestore();
      if (!firestore) {
        console.warn('⚠️ Firestore not available, skipping low-quality memory cleanup');
        return { deleted: 0 };
      }

      const cutoffDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago

      const lowQualityQuery = firestore.collection('memories')
        .where('weights.composite', '<', 0.2)
        .where('createdAt', '<', cutoffDate)
        .limit(50);

      const snapshot = await lowQualityQuery.get();
      const batch = firestore.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      if (snapshot.docs.length > 0) {
        await batch.commit();
        console.log(`🗑️ Deleted ${snapshot.docs.length} low-quality memories`);
      }

      return { deleted: snapshot.docs.length };
    } catch (error) {
      console.error('❌ Failed to delete low-quality memories:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Enforce memory limits per user and memory type
   */
  async enforceMemoryLimits() {
    try {
      const firestore = this.getFirestore();
      if (!firestore) {
        console.warn('⚠️ Firestore not available, skipping memory limit enforcement');
        return { deleted: 0 };
      }

      let totalDeleted = 0;

      // Get all users with memories
      const usersQuery = firestore.collection('memories')
        .select('userId')
        .limit(1000);
      
      const snapshot = await usersQuery.get();
      const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))];

      for (const userId of userIds) {
        for (const [memoryType, config] of Object.entries(MEMORY_TYPE_CONFIG)) {
          const deleted = await this.enforceUserMemoryTypeLimit(userId, memoryType, config.maxCount);
          totalDeleted += deleted;
        }
      }

      if (totalDeleted > 0) {
        console.log(`🗑️ Deleted ${totalDeleted} memories to enforce limits`);
      }

      return { deleted: totalDeleted };
    } catch (error) {
      console.error('❌ Failed to enforce memory limits:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Enforce memory limit for a specific user and memory type
   */
  async enforceUserMemoryTypeLimit(userId, memoryType, maxCount) {
    try {
      const firestore = this.getFirestore();
      if (!firestore) {
        return 0;
      }

      const userMemoriesQuery = firestore.collection('memories')
        .where('userId', '==', userId)
        .where('memoryType', '==', memoryType)
        .orderBy('weights.composite', 'desc');

      const snapshot = await userMemoriesQuery.get();
      
      if (snapshot.docs.length <= maxCount) {
        return 0; // No cleanup needed
      }

      // Delete excess memories (keep the highest weighted ones)
      const toDelete = snapshot.docs.slice(maxCount);
      const batch = firestore.batch();
      
      toDelete.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return toDelete.length;
    } catch (error) {
      console.error(`❌ Failed to enforce limit for ${userId}/${memoryType}:`, error);
      return 0;
    }
  }

  /**
   * Update memory weights with decay
   */
  async updateMemoryWeights() {
    try {
      const firestore = this.getFirestore();
      if (!firestore) {
        console.warn('⚠️ Firestore not available, skipping memory weight updates');
        return { updated: 0 };
      }

      const startTime = Date.now();
      let totalUpdated = 0;

      // Process memories in batches
      const batchSize = 100;
      let lastDoc = null;

      while (true) {
        let query = firestore.collection('memories')
          .where('retention.isArchived', '==', false)
          .orderBy('updatedAt')
          .limit(batchSize);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        
        if (snapshot.empty) break;

        const batch = firestore.batch();
        
        snapshot.docs.forEach(doc => {
          const memory = doc.data();
          const updatedWeights = this.applyDecayToWeights(memory);
          
          batch.update(doc.ref, {
            'weights.recency': updatedWeights.recency,
            'weights.composite': updatedWeights.composite,
            updatedAt: new Date()
          });
        });

        await batch.commit();
        totalUpdated += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // Break if we got less than a full batch
        if (snapshot.docs.length < batchSize) break;
      }

      const processingTime = Date.now() - startTime;
      console.log(`⚖️ Updated weights for ${totalUpdated} memories in ${processingTime}ms`);

      return { updated: totalUpdated, processingTime };
    } catch (error) {
      console.error('❌ Failed to update memory weights:', error);
      return { updated: 0 };
    }
  }

  /**
   * Apply decay to memory weights
   */
  applyDecayToWeights(memory) {
    const now = Date.now();
    const age = now - memory.createdAt.toDate().getTime();
    const hoursAge = age / (1000 * 60 * 60);
    
    // Apply decay to recency weight
    const decayedRecency = memory.weights.recency * Math.exp(-memory.retention.decayRate * hoursAge);
    
    // Recalculate composite score
    const weights = { ...memory.weights, recency: decayedRecency };
    const composite = (
      weights.recency * 0.3 +
      weights.importance * 0.4 +
      weights.frequency * 0.15 +
      weights.emotional * 0.1 +
      weights.contextual * 0.05
    );

    return {
      recency: decayedRecency,
      composite: Math.max(0, composite)
    };
  }

  /**
   * Archive old memories instead of deleting them
   */
  async archiveOldMemories() {
    try {
      const firestore = this.getFirestore();
      if (!firestore) {
        console.warn('⚠️ Firestore not available, skipping memory archival');
        return { archived: 0 };
      }

      const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago

      const oldMemoriesQuery = firestore.collection('memories')
        .where('createdAt', '<', cutoffDate)
        .where('retention.isArchived', '==', false)
        .where('weights.composite', '<', 0.5)
        .limit(100);

      const snapshot = await oldMemoriesQuery.get();
      const batch = firestore.batch();
      
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          'retention.isArchived': true,
          updatedAt: new Date()
        });
      });

      if (snapshot.docs.length > 0) {
        await batch.commit();
        console.log(`📦 Archived ${snapshot.docs.length} old memories`);
      }

      return { archived: snapshot.docs.length };
    } catch (error) {
      console.error('❌ Failed to archive old memories:', error);
      return { archived: 0 };
    }
  }

  /**
   * Get lifecycle management status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: this.scheduledTasks.length,
      nextRuns: this.scheduledTasks.map(task => ({
        running: task.running,
        scheduled: task.scheduled
      }))
    };
  }
}

module.exports = MemoryLifecycleManager;
