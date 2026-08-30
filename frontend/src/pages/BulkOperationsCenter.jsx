import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  MenuItem,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  IconButton,
} from '@mui/material';
import { ArrowLeft, ArrowRight, Save, RotateCcw } from 'lucide-react';
import api from '../services/api';
import EmployeeMultiSelect from '../components/BulkOperations/EmployeeMultiSelect';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';

const steps = ['Select Operation', 'Select Employees', 'Define & Preview'];

const BulkOperationsCenter = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [operationType, setOperationType] = useState('SALARY_REVISION');
  const [spec, setSpec] = useState({ type: 'percentage', value: 0 });
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const user = useAppStore((state) => state.user);

  useEffect(() => {
    fetchEmployees();
    fetchHistory();
    setupSocket();

    return () => {
      // Clean up socket listener if needed
      // Currently handled by global socket or specific effect cleanup
    };
  }, []);

  const setupSocket = () => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(socketUrl, {
      auth: { token },
    });

    socket.on('connect', () => {
      // Already handles joining user room based on auth token
    });

    socket.on('bulk_operation_progress', (data) => {
      setHistory((prev) =>
        prev.map((op) => {
          if (op._id === data.operationId) {
            return {
              ...op,
              progress: data.progress,
              status: data.isRollback ? 'rolling_back' : 'processing',
            };
          }
          return op;
        }),
      );
    });

    socket.on('bulk_operation_completed', (data) => {
      toast.success('Bulk operation completed successfully');
      fetchHistory();
      fetchEmployees();
    });

    socket.on('bulk_operation_rolled_back', (data) => {
      toast.success('Bulk operation rolled back successfully');
      fetchHistory();
      fetchEmployees();
    });

    return () => socket.disconnect();
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get('/employees?limit=10000'); // Note: virtualized list allows large limits
      if (data && data.employees) {
        setEmployees(data.employees);
      }
    } catch (err) {
      toast.error('Failed to load employees');
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await api.get('/bulk-operations');
      setHistory(data);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNext = async () => {
    if (activeStep === 1) {
      if (selectedIds.length === 0) {
        return toast.error('Please select at least one employee');
      }
    }

    if (activeStep === 2) {
      return submitOperation();
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handlePreview = async () => {
    if (!spec.value && operationType === 'SALARY_REVISION') {
      return toast.error('Please enter a valid value');
    }

    setLoading(true);
    try {
      const { data } = await api.post('/bulk-operations/preview', {
        operationType,
        employeeIds: selectedIds,
        spec,
      });
      setPreviewData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const submitOperation = async () => {
    setLoading(true);
    try {
      await api.post('/bulk-operations/execute', {
        operationType,
        employeeIds: selectedIds,
        spec,
      });
      toast.success('Bulk operation queued for execution');
      setActiveStep(0);
      setSelectedIds([]);
      setPreviewData(null);
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (id) => {
    if (!window.confirm('Are you sure you want to rollback this operation?'))
      return;
    try {
      await api.post(`/bulk-operations/${id}/rollback`);
      toast.success('Rollback initiated');
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rollback failed');
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'completed':
        return <Chip size="small" label="Completed" color="success" />;
      case 'processing':
        return <Chip size="small" label="Processing" color="info" />;
      case 'rolling_back':
        return <Chip size="small" label="Rolling Back" color="warning" />;
      case 'rolled_back':
        return <Chip size="small" label="Rolled Back" color="default" />;
      case 'failed':
        return <Chip size="small" label="Failed" color="error" />;
      default:
        return <Chip size="small" label={status} />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ fontWeight: 600 }}
      >
        Bulk Operations Center
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 4,
          flexDirection: { xs: 'column', lg: 'row' },
        }}
      >
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Box sx={{ minHeight: 400 }}>
              {activeStep === 0 && (
                <Box sx={{ maxWidth: 400, mx: 'auto', pt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Select Operation Type
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    label="Operation Type"
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    sx={{ mb: 3 }}
                  >
                    <MenuItem value="SALARY_REVISION">Salary Revision</MenuItem>
                    <MenuItem value="DEPARTMENT_TRANSFER">
                      Department Transfer
                    </MenuItem>
                    <MenuItem value="ROLE_CHANGE">Role Change</MenuItem>
                  </TextField>
                  <Typography variant="body2" color="textSecondary">
                    Choose the type of mass update you want to perform.
                    Currently selected: {operationType.replace('_', ' ')}.
                  </Typography>
                </Box>
              )}

              {activeStep === 1 && (
                <Box sx={{ height: 500 }}>
                  <EmployeeMultiSelect
                    employees={employees}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                  />
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Define Configuration
                  </Typography>

                  {operationType === 'SALARY_REVISION' && (
                    <Box sx={{ display: 'flex', gap: 2, mb: 4, maxWidth: 600 }}>
                      <TextField
                        select
                        label="Change Type"
                        value={spec.type}
                        onChange={(e) =>
                          setSpec({ ...spec, type: e.target.value })
                        }
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="percentage">Percentage (%)</MenuItem>
                        <MenuItem value="fixed">Fixed Increment</MenuItem>
                        <MenuItem value="absolute">Absolute Value</MenuItem>
                      </TextField>
                      <TextField
                        label="Value"
                        type="number"
                        value={spec.value}
                        onChange={(e) =>
                          setSpec({ ...spec, value: Number(e.target.value) })
                        }
                        fullWidth
                      />
                      <Button
                        variant="outlined"
                        onClick={handlePreview}
                        disabled={loading}
                      >
                        Generate Preview
                      </Button>
                    </Box>
                  )}

                  {/* Department and Role change configuration could go here */}

                  {previewData && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Preview ({previewData.totalCount} employees)
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{ maxHeight: 300, overflow: 'auto' }}
                      >
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr',
                            p: 2,
                            borderBottom: '1px solid #eee',
                            fontWeight: 'bold',
                          }}
                        >
                          <Typography variant="subtitle2">Employee</Typography>
                          <Typography variant="subtitle2">
                            Current Value
                          </Typography>
                          <Typography variant="subtitle2">
                            Proposed Value
                          </Typography>
                        </Box>
                        {previewData.snapshots.map((snap) => {
                          const emp = employees.find(
                            (e) => e._id === snap.employeeId,
                          );
                          return (
                            <Box
                              key={snap.employeeId}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr',
                                p: 2,
                                borderBottom: '1px solid #f5f5f5',
                              }}
                            >
                              <Typography variant="body2">
                                {emp?.fullName}
                              </Typography>
                              <Typography variant="body2">
                                {snap.previousValue}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="primary.main"
                                fontWeight="bold"
                              >
                                {snap.newValue}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Paper>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                mt: 4,
                gap: 2,
              }}
            >
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                startIcon={<ArrowLeft size={18} />}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={activeStep === 2 && !previewData}
                endIcon={
                  activeStep === 2 ? (
                    <Save size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )
                }
              >
                {activeStep === steps.length - 1 ? 'Execute Operation' : 'Next'}
              </Button>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Operation History
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Recent bulk operations and their status.
            </Typography>

            {loadingHistory ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : history.length === 0 ? (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ textAlign: 'center', py: 4 }}
              >
                No operations found.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {history.map((op) => (
                  <Card key={op._id} variant="outlined">
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 1,
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="600">
                          {op.operationType.replace('_', ' ')}
                        </Typography>
                        {getStatusChip(op.status)}
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        Target: {op.totalCount} employees
                      </Typography>

                      {(op.status === 'processing' ||
                        op.status === 'rolling_back') && (
                        <Box sx={{ mt: 2 }}>
                          <Box
                            sx={{
                              width: '100%',
                              bg: '#eee',
                              height: 4,
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                width: `${op.progress || 0}%`,
                                bg: 'primary.main',
                                height: '100%',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            {op.progress || 0}% complete
                          </Typography>
                        </Box>
                      )}

                      {op.status === 'completed' && (
                        <Box
                          sx={{
                            mt: 2,
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleRollback(op._id)}
                            startIcon={<RotateCcw size={14} />}
                          >
                            Rollback
                          </Button>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    </Container>
  );
};

export default BulkOperationsCenter;
