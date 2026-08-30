import axios from 'axios';

const BASE_URL = '/api/v1/admin/diversity';

export const diversityAPI = {
    getProjections: async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/projections`);
            return data;
        } catch (e) {
            console.error('api err', e);
            throw e;
        }
    },

    getDepartmentMatrix: async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/department-matrix`);
            return data;
        } catch (e) {
            console.error('api err', e);
            throw e;
        }
    },

    getInclusionTrends: async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/inclusion-trends`);
            return data;
        } catch (e) {
            console.error('api err', e);
            throw e;
        }
    },

    seedDemoData: async () => {
        try {
            const { data } = await axios.post(`${BASE_URL}/seed`);
            return data;
        } catch (e) {
            console.error('api err', e);
            throw e;
        }
    }
};
