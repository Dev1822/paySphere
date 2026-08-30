const esgService = require('../services/esgService');
const esgGenerator = require('../services/esgDataGenerator');

class ESGController {

    async getCarbonProjections(req, res) {
        try {
            const data = await esgService.getCarbonProjections();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Projections Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate decarbonization timeline.' });
        }
    }

    async getRegionalMatrix(req, res) {
        try {
            const data = await esgService.getRegionalMatrix();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Matrix Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch regional impacts.' });
        }
    }

    async getLogFeeds(req, res) {
        try {
            const logs = await esgService.getIncidentLogs();
            return res.status(200).json({ success: true, data: logs });
        } catch (error) {
            console.error('Log Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch tracking streams.' });
        }
    }

    async seedDemoData(req, res) {
        try {
            const result = await esgGenerator.runMassiveSimulation();
            return res.status(201).json({ success: true, message: 'Seeded ESG mass data correctly.', data: result });
        } catch (error) {
            console.error('Seed error:', error);
            return res.status(500).json({ success: false, error: 'Failed to seed dataset.' });
        }
    }
}

module.exports = new ESGController();
