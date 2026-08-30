import api from './api';

const CompensationCycleService = {
  createProposal: async (cycleId, proposalData) => {
    return await api.post(`/compensation-cycles/proposals`, {
      cycleId,
      ...proposalData,
    });
  },

  approveProposal: async (proposalId, version, status, comment) => {
    return await api.patch(
      `/compensation-cycles/proposals/${proposalId}/approve`,
      { version, status, comment },
    );
  },

  closeCycle: async (cycleId) => {
    return await api.post(`/compensation-cycles/${cycleId}/close`);
  },
};

export default CompensationCycleService;
