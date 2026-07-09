import express from 'express';
import { getMenuRecommendations, getPersonalizedRecommendations } from '../services/recommendationService.js';

const router = express.Router();

/**
 * POST /api/menu/recommendations
 * Get smart menu recommendations based on cart contents
 * Body: { currentCartItems: Array, branchId: String }
 */
router.post('/recommendations', async (req, res) => {
  try {
    const { currentCartItems, branchId } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const recommendations = await getMenuRecommendations(
      currentCartItems || [],
      branchId
    );

    if (!recommendations.success) {
      return res.status(500).json(recommendations);
    }

    return res.status(200).json(recommendations);
  } catch (error) {
    console.error('Error in recommendations route:', error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/menu/personalized-recommendations/:customerId/:branchId
 * Get personalized recommendations based on customer history
 * Params: customerId, branchId
 */
router.get('/personalized-recommendations/:customerId/:branchId', async (req, res) => {
  try {
    const { customerId, branchId } = req.params;

    const recommendations = await getPersonalizedRecommendations(customerId, branchId);

    if (!recommendations.success) {
      return res.status(500).json(recommendations);
    }

    return res.status(200).json(recommendations);
  } catch (error) {
    console.error('Error in personalized recommendations route:', error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch personalized recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;
