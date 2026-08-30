const diversityService = require('../services/diversityService');

class DiversityController {

    /**
     * Generates long range D&I predictive model
     */
    async getPredictiveProjections(req, res) {
        try {
            const data = await diversityService.getPredictiveDemographics();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Projections Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate predictive parity data.' });
        }
    }

    /**
     * Retrieves department cross-sectional matrix
     */
    async getDepartmentMatrix(req, res) {
        try {
            const data = await diversityService.getDepartmentMatrix();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Matrix Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch department demographics.' });
        }
    }

    /**
     * Retrieves psychological safety inclusion trends
     */
    async getInclusionTrends(req, res) {
        try {
            const trends = await diversityService.getInclusionTrends();
            return res.status(200).json({ success: true, data: trends });
        } catch (error) {
            console.error('Inclusion Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch inclusion trends.' });
        }
    }

    /**
     * Seeds demo massive dataset
     */
    async seedDemoData(req, res) {
        try {
            const result = await diversityService.seedDemoData();
            return res.status(201).json({ success: true, message: 'Seeded big data successfully', data: result });
        } catch (error) {
            console.error('Seed error:', error);
            return res.status(500).json({ success: false, error: 'Failed to seed dataset.' });
        }
    }
}

module.exports = new DiversityController();
