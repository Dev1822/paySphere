const jobOrchestrator = require('../../services/jobOrchestrator.service');
const JobDependency = require('../../models/jobDependency.model');

describe('Job Orchestrator Service', () => {
  const tenantId = 'tenant-123';
  const workflowId = 'workflow-001';

  beforeEach(async () => {
    await JobDependency.deleteMany({ workflowId });
  });

  describe('createWorkflow', () => {
    it('should create workflow with dependent jobs', async () => {
      const jobs = [
        {
          jobId: 'job-1',
          jobType: 'payroll-finalization',
          data: { payrollCycleId: 'cycle-123' },
        },
        {
          jobId: 'job-2',
          jobType: 'payslip-generation',
          data: { payrollCycleId: 'cycle-123' },
          dependencies: [{ jobId: 'job-1', jobType: 'payroll-finalization' }],
        },
      ];

      await jobOrchestrator.createWorkflow(workflowId, jobs, tenantId);

      const createdJobs = await JobDependency.find({ workflowId });
      expect(createdJobs).toHaveLength(2);
      expect(createdJobs[0].status).toBe('in_progress');
      expect(createdJobs[1].status).toBe('pending');
    });
  });

  describe('completeJob', () => {
    it('should trigger dependent jobs when parent completes', async () => {
      const parentJob = await JobDependency.create({
        jobId: 'parent-job',
        workflowId,
        jobType: 'payroll-finalization',
        status: 'in_progress',
        tenantId,
        dependents: [{ jobId: 'child-job', jobType: 'payslip-generation' }],
      });

      const childJob = await JobDependency.create({
        jobId: 'child-job',
        workflowId,
        jobType: 'payslip-generation',
        status: 'pending',
        dependencies: [{ jobId: 'parent-job', jobType: 'payroll-finalization' }],
        tenantId,
      });

      await jobOrchestrator.completeJob('parent-job', workflowId, { success: true });

      const updated = await JobDependency.findById(parentJob._id);
      expect(updated.status).toBe('completed');
      expect(updated.result).toEqual({ success: true });
    });
  });

  describe('failJob', () => {
    it('should schedule retry for failed jobs', async () => {
      await JobDependency.create({
        jobId: 'failing-job',
        workflowId,
        jobType: 'payslip-generation',
        status: 'in_progress',
        tenantId,
        retryCount: 0,
        maxRetries: 3,
      });

      const error = new Error('Temporary failure');
      await jobOrchestrator.failJob('failing-job', workflowId, error);

      const updated = await JobDependency.findOne({ jobId: 'failing-job' });
      expect(updated.status).toBe('pending');
      expect(updated.retryCount).toBe(1);
      expect(updated.nextRetryAt).toBeTruthy();
    });

    it('should mark job as failed after max retries', async () => {
      await JobDependency.create({
        jobId: 'failing-job',
        workflowId,
        jobType: 'payslip-generation',
        status: 'in_progress',
        tenantId,
        retryCount: 2,
        maxRetries: 3,
      });

      const error = new Error('Final failure');
      await jobOrchestrator.failJob('failing-job', workflowId, error);

      const updated = await JobDependency.findOne({ jobId: 'failing-job' });
      expect(updated.status).toBe('failed');
      expect(updated.retryCount).toBe(3);
    });
  });

  describe('getWorkflowProgress', () => {
    it('should return accurate workflow status counts', async () => {
      await JobDependency.insertMany([
        { jobId: 'job-1', workflowId, jobType: 'payroll-finalization', status: 'completed', tenantId },
        { jobId: 'job-2', workflowId, jobType: 'payslip-generation', status: 'in_progress', tenantId },
        { jobId: 'job-3', workflowId, jobType: 'export', status: 'pending', tenantId },
      ]);

      const progress = await jobOrchestrator.getWorkflowProgress(workflowId, tenantId);

      expect(progress.total).toBe(3);
      expect(progress.statusCounts.completed).toBe(1);
      expect(progress.statusCounts.in_progress).toBe(1);
      expect(progress.statusCounts.pending).toBe(1);
    });
  });
});