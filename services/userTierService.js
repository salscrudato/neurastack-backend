/**
 * 👤 User Tier Management Service
 * 
 * 🎯 PURPOSE: Manage user tier upgrades, downgrades, and tier-based access control
 * 
 * 📋 FEATURES:
 * - Store user tiers in Firestore database
 * - Upgrade/downgrade users between free and premium tiers
 * - Validate tier-based access and limits
 * - Track tier usage and analytics
 * - Handle tier expiration and renewals
 */

const admin = require('firebase-admin');
const monitoringService = require('./monitoringService');

class UserTierService {
  constructor() {
    this.db = null;
    this.isFirestoreAvailable = false;
    this.tierCache = new Map(); // Cache user tiers for performance
    this.cacheExpiry = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache
    
    this.initializeFirestore();
    
    // Tier configurations
    this.tierConfigs = {
      free: {
        name: 'Free Tier',
        maxRequestsPerHour: 25,
        maxRequestsPerDay: 150,
        maxPromptLength: 5000,
        models: ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-5-haiku-latest'],
        features: ['basic_ensemble', 'memory_storage', 'caching'],
        costPerMonth: 0
      },
      premium: {
        name: 'Premium Tier',
        maxRequestsPerHour: 150,
        maxRequestsPerDay: 1500,
        maxPromptLength: 8000,
        models: ['gpt-4o', 'gemini-1.5-flash', 'claude-3-5-haiku-latest'],
        features: ['advanced_ensemble', 'priority_processing', 'extended_memory', 'analytics'],
        costPerMonth: 29.99
      }
    };
    
    console.log('👤 User Tier Service initialized');
  }

  /**
   * Initialize Firestore connection
   */
  async initializeFirestore() {
    try {
      if (admin.apps.length > 0) {
        this.db = admin.firestore();
        this.isFirestoreAvailable = true;

        // Ensure users collection exists with proper indexes
        await this.ensureUserCollection();

        console.log('✅ User Tier Service: Firestore connected');
      } else {
        console.warn('⚠️ User Tier Service: Firebase not initialized, using fallback mode');
        this.isFirestoreAvailable = false;
      }
    } catch (error) {
      console.warn('⚠️ User Tier Service: Firestore not available, using fallback mode');
      this.isFirestoreAvailable = false;
    }
  }

  /**
   * Ensure users collection exists with proper structure
   */
  async ensureUserCollection() {
    if (!this.isFirestoreAvailable) return;

    try {
      // Check if users collection exists
      const usersRef = this.db.collection('users');
      const snapshot = await usersRef.limit(1).get();
      
      if (snapshot.empty) {
        console.log('📋 Creating users collection structure...');
        
        // Create a sample user document to establish collection structure
        await usersRef.doc('_structure').set({
          userId: '_structure',
          tier: 'free',
          tierStartDate: new Date(),
          tierEndDate: null,
          isActive: true,
          usage: {
            requestsToday: 0,
            requestsThisHour: 0,
            lastRequestDate: new Date(),
            totalRequests: 0
          },
          billing: {
            customerId: null,
            subscriptionId: null,
            lastPaymentDate: null,
            nextBillingDate: null
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          _isStructureDoc: true
        });
        
        console.log('✅ Users collection structure created');
      }
    } catch (error) {
      console.warn('⚠️ Failed to ensure users collection:', error.message);
    }
  }

  /**
   * Get user's current tier
   * @param {string} userId - User ID
   * @returns {Promise<string>} User's tier ('free' or 'premium')
   */
  async getUserTier(userId) {
    if (!userId || userId === 'anonymous') {
      return 'free';
    }

    // Check cache first
    const cacheKey = `tier_${userId}`;
    if (this.tierCache.has(cacheKey) && Date.now() < this.cacheExpiry.get(cacheKey)) {
      return this.tierCache.get(cacheKey);
    }

    let userTier = 'free'; // Default to free tier

    if (this.isFirestoreAvailable) {
      try {
        const userDoc = await this.db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          userTier = userData.tier || 'free';
          
          // Check if premium tier has expired
          if (userTier === 'premium' && userData.tierEndDate) {
            const endDate = userData.tierEndDate.toDate();
            if (endDate < new Date()) {
              // Premium tier expired, downgrade to free
              await this.downgradeTier(userId, 'Premium tier expired');
              userTier = 'free';
            }
          }
        } else {
          // User doesn't exist, create with free tier
          await this.createUser(userId, 'free');
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get user tier for ${userId}:`, error.message);
        userTier = 'free'; // Fallback to free tier
      }
    }

    // Cache the result
    this.tierCache.set(cacheKey, userTier);
    this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTTL);

    return userTier;
  }

  /**
   * Create a new user with specified tier
   * @param {string} userId - User ID
   * @param {string} tier - Initial tier ('free' or 'premium')
   * @returns {Promise<Object>} Created user data
   */
  async createUser(userId, tier = 'free') {
    if (!this.isFirestoreAvailable) {
      return { userId, tier, created: false, reason: 'Database not available' };
    }

    try {
      const userData = {
        userId,
        tier,
        tierStartDate: new Date(),
        tierEndDate: tier === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null, // 30 days for premium
        isActive: true,
        usage: {
          requestsToday: 0,
          requestsThisHour: 0,
          lastRequestDate: new Date(),
          totalRequests: 0
        },
        billing: {
          customerId: null,
          subscriptionId: null,
          lastPaymentDate: null,
          nextBillingDate: tier === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.db.collection('users').doc(userId).set(userData);
      
      // Clear cache
      this.clearUserCache(userId);
      
      monitoringService.log('info', 'User created', { userId, tier });
      
      return { ...userData, created: true };
    } catch (error) {
      console.error(`❌ Failed to create user ${userId}:`, error.message);
      return { userId, tier: 'free', created: false, error: error.message };
    }
  }

  /**
   * Upgrade user to premium tier
   * @param {string} userId - User ID
   * @param {Object} options - Upgrade options
   * @returns {Promise<Object>} Upgrade result
   */
  async upgradeToPremium(userId, options = {}) {
    const {
      durationDays = 30,
      customerId = null,
      subscriptionId = null,
      reason = 'Manual upgrade'
    } = options;

    if (!this.isFirestoreAvailable) {
      return { success: false, error: 'Database not available' };
    }

    try {
      const userRef = this.db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // Create user if doesn't exist
        await this.createUser(userId, 'free');
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const updateData = {
        tier: 'premium',
        tierStartDate: now,
        tierEndDate: endDate,
        updatedAt: now,
        'billing.customerId': customerId,
        'billing.subscriptionId': subscriptionId,
        'billing.lastPaymentDate': now,
        'billing.nextBillingDate': endDate
      };

      await userRef.update(updateData);
      
      // Clear cache
      this.clearUserCache(userId);
      
      monitoringService.log('info', 'User upgraded to premium', { 
        userId, 
        durationDays, 
        endDate: endDate.toISOString(),
        reason 
      });
      
      return { 
        success: true, 
        tier: 'premium', 
        startDate: now,
        endDate,
        message: `Successfully upgraded to premium tier for ${durationDays} days`
      };
    } catch (error) {
      console.error(`❌ Failed to upgrade user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Downgrade user to free tier
   * @param {string} userId - User ID
   * @param {string} reason - Reason for downgrade
   * @returns {Promise<Object>} Downgrade result
   */
  async downgradeTier(userId, reason = 'Manual downgrade') {
    if (!this.isFirestoreAvailable) {
      return { success: false, error: 'Database not available' };
    }

    try {
      const userRef = this.db.collection('users').doc(userId);
      const now = new Date();

      const updateData = {
        tier: 'free',
        tierStartDate: now,
        tierEndDate: null,
        updatedAt: now
      };

      await userRef.update(updateData);
      
      // Clear cache
      this.clearUserCache(userId);
      
      monitoringService.log('info', 'User downgraded to free', { userId, reason });
      
      return { 
        success: true, 
        tier: 'free', 
        message: 'Successfully downgraded to free tier'
      };
    } catch (error) {
      console.error(`❌ Failed to downgrade user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tier configuration
   * @param {string} tier - Tier name
   * @returns {Object} Tier configuration
   */
  getTierConfig(tier) {
    return this.tierConfigs[tier] || this.tierConfigs.free;
  }

  /**
   * Clear user cache
   * @param {string} userId - User ID
   */
  clearUserCache(userId) {
    const cacheKey = `tier_${userId}`;
    this.tierCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }

  /**
   * Get user tier information with usage stats
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete user tier information
   */
  async getUserTierInfo(userId) {
    const tier = await this.getUserTier(userId);
    const config = this.getTierConfig(tier);
    
    let userData = null;
    if (this.isFirestoreAvailable) {
      try {
        const userDoc = await this.db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userData = userDoc.data();
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get user data for ${userId}:`, error.message);
      }
    }

    return {
      userId,
      tier,
      config,
      userData: userData ? {
        tierStartDate: userData.tierStartDate?.toDate(),
        tierEndDate: userData.tierEndDate?.toDate(),
        usage: userData.usage,
        billing: userData.billing,
        isActive: userData.isActive
      } : null
    };
  }
}

// Export singleton instance
let userTierService = null;

function getUserTierService() {
  if (!userTierService) {
    userTierService = new UserTierService();
  }
  return userTierService;
}

module.exports = {
  UserTierService,
  getUserTierService
};
