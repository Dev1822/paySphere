import axios from 'axios';

const BASE_URL = '/api/v1/admin/esg';

export const esgAPI = {
    getCarbonProjections: async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/carbon`);
            return data;
        } catch (e) {
            console.error('ESG err', e);
            throw e;
        }
    },

    getRegionalMatrix: async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/regions`);
            return data;
        } catch (e) {
            console.error('ESG err', e);
            throw e;
        }
    },

    getLogFeeds: async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/logs`);
            return data;
        } catch (e) {
            console.error('ESG err', e);
            throw e;
        }
    },

    seedDemoData: async () => {
        try {
            const { data } = await axios.post(`${BASE_URL}/seed`);
            return data;
        } catch (e) {
            console.error('ESG err', e);
            throw e;
        }
    }
};
