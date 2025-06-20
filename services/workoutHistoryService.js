const admin = require('firebase-admin');
const { WORKOUT_COLLECTIONS, VALIDATION_SCHEMAS } = require('../types/workout');
const monitoringService = require('./monitoringService');

/**
 * Workout History Service
 * Manages workout storage, retrieval, and intelligent evolution
 */
class WorkoutHistoryService {
  constructor() {
    this.isFirestoreAvailable = false;
    this.localCache = new Map(); // Fallback cache
    this.firestore = null;

    // Initialize Firestore if available
    this.initializeFirestore();
  }

  /**
   * Initialize Firestore connection
   */
  initializeFirestore() {
    try {
      if (admin.apps.length > 0) {
        this.firestore = admin.firestore();
        this.isFirestoreAvailable = true;
        this.testFirestoreConnection();
      } else {
        console.warn('⚠️ Firebase not initialized, using local cache for workout history');
        this.isFirestoreAvailable = false;
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Firestore:', error.message);
      this.isFirestoreAvailable = false;
    }
  }

  /**
   * Test Firestore connection and set availability flag
   */
  async testFirestoreConnection() {
    if (!this.firestore) {
      this.isFirestoreAvailable = false;
      return;
    }

    try {
      await this.firestore.collection('_test').limit(1).get();
      this.isFirestoreAvailable = true;
      console.log('✅ Workout History Service: Firestore connection established');
    } catch (error) {
      this.isFirestoreAvailable = false;
      console.warn('⚠️ Workout History Service: Firestore unavailable, using local cache:', error.message);
    }
  }

  /**
   * Store a workout record
   * @param {Object} workoutRecord - Complete workout record
   * @returns {Promise<string>} - Workout ID
   */
  async storeWorkout(workoutRecord) {
    try {
      const workoutId = workoutRecord.workoutId;
      
      // Add timestamps
      const record = {
        ...workoutRecord,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (this.isFirestoreAvailable) {
        try {
          await this.firestore
            .collection(WORKOUT_COLLECTIONS.WORKOUTS)
            .doc(workoutId)
            .set(record);
          
          monitoringService.log('info', 'Workout stored successfully', {
            workoutId,
            userId: record.userId,
            workoutType: record.parameters.workoutType
          });
        } catch (error) {
          console.warn('⚠️ Failed to store workout in Firestore, using local cache:', error.message);
          this.isFirestoreAvailable = false;
          this.localCache.set(`workout_${workoutId}`, record);
        }
      } else {
        this.localCache.set(`workout_${workoutId}`, record);
      }

      // Update user stats
      await this.updateUserStats(record.userId);

      return workoutId;
    } catch (error) {
      monitoringService.log('error', 'Failed to store workout', {
        error: error.message,
        workoutId: workoutRecord.workoutId
      });
      throw error;
    }
  }

  /**
   * Store workout feedback
   * @param {Object} feedbackRecord - Feedback record
   * @returns {Promise<void>}
   */
  async storeFeedback(feedbackRecord) {
    try {
      const feedbackId = `${feedbackRecord.workoutId}_feedback`;
      
      if (this.isFirestoreAvailable) {
        try {
          await this.firestore
            .collection(WORKOUT_COLLECTIONS.FEEDBACK)
            .doc(feedbackId)
            .set(feedbackRecord);
          
          monitoringService.log('info', 'Workout feedback stored successfully', {
            workoutId: feedbackRecord.workoutId,
            userId: feedbackRecord.userId,
            completed: feedbackRecord.feedback.completed
          });
        } catch (error) {
          console.warn('⚠️ Failed to store feedback in Firestore, using local cache:', error.message);
          this.isFirestoreAvailable = false;
          this.localCache.set(`feedback_${feedbackId}`, feedbackRecord);
        }
      } else {
        this.localCache.set(`feedback_${feedbackId}`, feedbackRecord);
      }

      // Update user stats after feedback
      await this.updateUserStats(feedbackRecord.userId);
    } catch (error) {
      monitoringService.log('error', 'Failed to store workout feedback', {
        error: error.message,
        workoutId: feedbackRecord.workoutId
      });
      throw error;
    }
  }

  /**
   * Update workout status
   * @param {string} workoutId - Workout ID
   * @param {string} status - New status
   * @returns {Promise<void>}
   */
  async updateWorkoutStatus(workoutId, status) {
    try {
      if (!VALIDATION_SCHEMAS.workoutStatuses.includes(status)) {
        throw new Error(`Invalid workout status: ${status}`);
      }

      const updateData = {
        status,
        updatedAt: new Date()
      };

      if (this.isFirestoreAvailable) {
        try {
          await this.firestore
            .collection(WORKOUT_COLLECTIONS.WORKOUTS)
            .doc(workoutId)
            .update(updateData);
        } catch (error) {
          console.warn('⚠️ Failed to update workout status in Firestore:', error.message);
          this.isFirestoreAvailable = false;
          
          // Update local cache if available
          const cacheKey = `workout_${workoutId}`;
          if (this.localCache.has(cacheKey)) {
            const record = this.localCache.get(cacheKey);
            this.localCache.set(cacheKey, { ...record, ...updateData });
          }
        }
      } else {
        // Update local cache
        const cacheKey = `workout_${workoutId}`;
        if (this.localCache.has(cacheKey)) {
          const record = this.localCache.get(cacheKey);
          this.localCache.set(cacheKey, { ...record, ...updateData });
        }
      }

      monitoringService.log('info', 'Workout status updated', {
        workoutId,
        status
      });
    } catch (error) {
      monitoringService.log('error', 'Failed to update workout status', {
        error: error.message,
        workoutId,
        status
      });
      throw error;
    }
  }

  /**
   * Get user's workout history
   * @param {string} userId - User ID
   * @param {number} limit - Number of workouts to retrieve
   * @param {boolean} includeIncomplete - Include incomplete workouts
   * @returns {Promise<Array>} - Array of workout records
   */
  async getUserWorkoutHistory(userId, limit = 20, includeIncomplete = false) {
    try {
      let workouts = [];

      if (this.isFirestoreAvailable) {
        try {
          let query = this.firestore
            .collection(WORKOUT_COLLECTIONS.WORKOUTS)
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit);

          if (!includeIncomplete) {
            query = query.where('status', 'in', ['completed', 'started']);
          }

          const snapshot = await query.get();
          workouts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (error) {
          console.warn('⚠️ Failed to retrieve workouts from Firestore, using local cache:', error.message);
          this.isFirestoreAvailable = false;
          workouts = this.getWorkoutsFromCache(userId, limit, includeIncomplete);
        }
      } else {
        workouts = this.getWorkoutsFromCache(userId, limit, includeIncomplete);
      }

      // Enrich with feedback data
      for (let workout of workouts) {
        workout.feedback = await this.getWorkoutFeedback(workout.workoutId);
      }

      return workouts;
    } catch (error) {
      monitoringService.log('error', 'Failed to retrieve workout history', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get workouts from local cache
   * @param {string} userId - User ID
   * @param {number} limit - Limit
   * @param {boolean} includeIncomplete - Include incomplete
   * @returns {Array} - Cached workouts
   */
  getWorkoutsFromCache(userId, limit, includeIncomplete) {
    const workouts = [];
    for (let [key, value] of this.localCache.entries()) {
      if (key.startsWith('workout_') && value.userId === userId) {
        if (includeIncomplete || ['completed', 'started'].includes(value.status)) {
          workouts.push(value);
        }
      }
    }
    
    return workouts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  /**
   * Get workout feedback
   * @param {string} workoutId - Workout ID
   * @returns {Promise<Object|null>} - Feedback data
   */
  async getWorkoutFeedback(workoutId) {
    try {
      const feedbackId = `${workoutId}_feedback`;

      if (this.isFirestoreAvailable) {
        try {
          const doc = await this.firestore
            .collection(WORKOUT_COLLECTIONS.FEEDBACK)
            .doc(feedbackId)
            .get();
          
          return doc.exists ? doc.data() : null;
        } catch (error) {
          console.warn('⚠️ Failed to retrieve feedback from Firestore, checking local cache:', error.message);
          this.isFirestoreAvailable = false;
          return this.localCache.get(`feedback_${feedbackId}`) || null;
        }
      } else {
        return this.localCache.get(`feedback_${feedbackId}`) || null;
      }
    } catch (error) {
      monitoringService.log('warn', 'Failed to retrieve workout feedback', {
        error: error.message,
        workoutId
      });
      return null;
    }
  }

  /**
   * Get user workout statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User stats
   */
  async getUserWorkoutStats(userId) {
    try {
      if (this.isFirestoreAvailable) {
        try {
          const doc = await this.firestore
            .collection(WORKOUT_COLLECTIONS.STATS)
            .doc(userId)
            .get();
          
          if (doc.exists) {
            return doc.data();
          }
        } catch (error) {
          console.warn('⚠️ Failed to retrieve stats from Firestore:', error.message);
          this.isFirestoreAvailable = false;
        }
      }

      // Calculate stats from workout history if not cached
      return await this.calculateUserStats(userId);
    } catch (error) {
      monitoringService.log('error', 'Failed to retrieve user workout stats', {
        error: error.message,
        userId
      });
      return this.getDefaultStats();
    }
  }

  /**
   * Calculate user statistics from workout history
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Calculated stats
   */
  async calculateUserStats(userId) {
    try {
      const workouts = await this.getUserWorkoutHistory(userId, 100, true);
      const completedWorkouts = workouts.filter(w => w.status === 'completed');
      
      const stats = {
        totalWorkouts: workouts.length,
        completedWorkouts: completedWorkouts.length,
        completionRate: workouts.length > 0 ? (completedWorkouts.length / workouts.length) * 100 : 0,
        averageRating: 0,
        averageDuration: 0,
        preferredWorkoutTypes: {},
        equipmentUsage: {},
        goalProgress: {},
        lastWorkout: workouts.length > 0 ? workouts[0].createdAt : null,
        currentStreak: 0,
        longestStreak: 0
      };

      // Calculate averages and preferences
      if (completedWorkouts.length > 0) {
        const ratingsSum = completedWorkouts
          .filter(w => w.feedback && w.feedback.feedback && w.feedback.feedback.rating)
          .reduce((sum, w) => sum + w.feedback.feedback.rating, 0);
        
        const ratingsCount = completedWorkouts
          .filter(w => w.feedback && w.feedback.feedback && w.feedback.feedback.rating).length;
        
        stats.averageRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 0;

        // Calculate workout type preferences
        completedWorkouts.forEach(workout => {
          const type = workout.parameters.workoutType;
          stats.preferredWorkoutTypes[type] = (stats.preferredWorkoutTypes[type] || 0) + 1;
        });
      }

      return stats;
    } catch (error) {
      monitoringService.log('error', 'Failed to calculate user stats', {
        error: error.message,
        userId
      });
      return this.getDefaultStats();
    }
  }

  /**
   * Update user statistics
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async updateUserStats(userId) {
    try {
      const stats = await this.calculateUserStats(userId);
      stats.lastUpdated = new Date();

      if (this.isFirestoreAvailable) {
        try {
          await this.firestore
            .collection(WORKOUT_COLLECTIONS.STATS)
            .doc(userId)
            .set(stats, { merge: true });
        } catch (error) {
          console.warn('⚠️ Failed to update stats in Firestore:', error.message);
          this.isFirestoreAvailable = false;
          this.localCache.set(`stats_${userId}`, stats);
        }
      } else {
        this.localCache.set(`stats_${userId}`, stats);
      }
    } catch (error) {
      monitoringService.log('error', 'Failed to update user stats', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Get default stats structure
   * @returns {Object} - Default stats
   */
  getDefaultStats() {
    return {
      totalWorkouts: 0,
      completedWorkouts: 0,
      completionRate: 0,
      averageRating: 0,
      averageDuration: 0,
      preferredWorkoutTypes: {},
      equipmentUsage: {},
      goalProgress: {},
      lastWorkout: null,
      currentStreak: 0,
      longestStreak: 0,
      lastUpdated: new Date()
    };
  }
}

module.exports = new WorkoutHistoryService();
